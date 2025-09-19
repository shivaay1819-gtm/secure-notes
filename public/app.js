import { sanitizeHtml } from './sanitize.js';
import { putNote, getNote, getAllNotes, putMeta, getMeta } from './idb.js';
import { nowIso, formatTime, debounce, estimateEntropy } from './utils.js';
import { deriveFromPassphrase, encryptJson, decryptJson, isUnlocked, clearKey, getSaltB64 } from './crypto.js';

let currentId = null;
let lockTimer;
const LOCK_TIMEOUT = 8 * 60 * 1000;

const els = {
  list: document.getElementById('notesList'),
  title: document.getElementById('titleInput'),
  content: document.getElementById('contentInput'),
  status: document.getElementById('statusBadge'),
  newBtn: document.getElementById('newNoteBtn'),
  backupBtn: document.getElementById('backupBtn'),
  restoreInput: document.getElementById('restoreInput'),
  lockBtn: document.getElementById('lockBtn'),
  dialog: document.getElementById('lockDialog'),
  unlockForm: document.getElementById('unlockForm'),
  pass: document.getElementById('passphraseInput'),
  createVaultBtn: document.getElementById('createVaultBtn'),
  unlockBtn: document.getElementById('unlockBtn'),
  lockError: document.getElementById('lockError'),
  entropyMeter: document.getElementById('entropyMeter'),
  searchInput: document.getElementById('searchInput'),
  tpl: document.getElementById('noteItemTpl'),
};

function armAutoLock() { clearTimeout(lockTimer); lockTimer = setTimeout(lock, LOCK_TIMEOUT); }
['pointerdown','keydown','visibilitychange'].forEach(ev => addEventListener(ev, armAutoLock));

function setStatus(text, ok = true) {
  els.status.textContent = text;
  els.status.style.background = ok ? 'linear-gradient(90deg, var(--ok), #a7f3d0)' : 'linear-gradient(90deg, var(--danger), #fecaca)';
}

async function saveCurrent() {
  if (!isUnlocked() || currentId === null) return;
  const title = els.title.value.trim();
  const contentRaw = els.content.value;
  const content = sanitizeHtml(contentRaw.replace(/\n/g, '\n'));
  const payload = await encryptJson({ title, content });
  const note = {
    id: currentId,
    payload,
    titlePreview: title.slice(0, 120),
    snippetPreview: contentRaw.slice(0, 140).replace(/\n/g, ' '),
    updatedAt: nowIso(),
  };
  await putNote(note);
  setStatus('Saved');
  renderList();
}
const saveDebounced = debounce(saveCurrent, 400);

function newNote() {
  currentId = crypto.randomUUID();
  els.title.value = '';
  els.content.value = '';
  setStatus('New note');
  els.title.focus();
}

async function loadNote(id) {
  const n = await getNote(id);
  if (!n) return;
  const dec = await decryptJson(n.payload);
  currentId = id;
  els.title.value = dec.title || '';
  els.content.value = (dec.content || '').replace(/\n/g, '\n');
  setStatus('Loaded');
}

async function renderList(filter = '') {
  const notes = await getAllNotes();
  const q = filter.toLowerCase();
  notes.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
  const frag = document.createDocumentFragment();
  for (const n of notes) {
    if (q && !(n.titlePreview.toLowerCase().includes(q) || n.snippetPreview.toLowerCase().includes(q))) continue;
    const node = els.tpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = n.id;
    node.querySelector('.note-title').textContent = n.titlePreview || '(Untitled)';
    node.querySelector('.note-snippet').textContent = n.snippetPreview || '';
    node.querySelector('.note-time').textContent = formatTime(n.updatedAt);
    node.querySelector('.note-time').setAttribute('datetime', n.updatedAt);
    node.addEventListener('click', () => loadNote(n.id));
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadNote(n.id); });
    frag.appendChild(node);
  }
  els.list.replaceChildren(frag);
}

async function exportBackup() {
  const saltB64 = getSaltB64();
  if (!saltB64) { alert('Unlock or create a vault first.'); return; }
  const notes = await getAllNotes();
  const backup = {
    version: 1,
    kdf: { name: 'PBKDF2', iterations: 310000, hash: 'SHA-256', saltB64 },
    cipher: { name: 'AES-GCM' },
    createdAt: nowIso(),
    appVersion: '1.0.0',
    records: notes,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `secure-notes-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importBackup(file) {
  const text = await file.text();
  let data; try { data = JSON.parse(text); } catch { alert('Invalid backup file'); return; }
  if (!data || !Array.isArray(data.records)) { alert('Invalid backup structure'); return; }
  for (const r of data.records) { await putNote(r); }
  await renderList();
  alert('Restore complete.');
}

function lock() {
  clearKey(); currentId = null;
  els.title.value = ''; els.content.value = '';
  els.dialog.showModal();
  els.pass.value = ''; els.pass.focus();
  setStatus('Locked', false);
}

async function unlock(passphrase, createIfMissing = false) {
  const metaSalt = await getMeta('saltB64');
  if (!metaSalt && !createIfMissing) throw new Error('No vault found. Create a new vault.');
  const salt = metaSalt ? Uint8Array.from(atob(metaSalt), c => c.charCodeAt(0)) : undefined;
  const { salt: s } = await deriveFromPassphrase(passphrase, salt);
  if (!metaSalt) { await putMeta('saltB64', btoa(String.fromCharCode(...s))); }
}

function bindEvents() {
  els.newBtn.addEventListener('click', () => { newNote(); saveCurrent(); });
  els.title.addEventListener('input', () => { setStatus('Editing…', true); saveDebounced(); });
  els.content.addEventListener('input', () => { setStatus('Editing…', true); saveDebounced(); });
  els.searchInput.addEventListener('input', (e) => renderList(e.target.value));
  els.backupBtn.addEventListener('click', exportBackup);
  els.restoreInput.addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f) importBackup(f); e.target.value = ''; });
  els.lockBtn.addEventListener('click', lock);
  els.unlockForm.addEventListener('submit', (e) => e.preventDefault());
  els.unlockBtn.addEventListener('click', async () => {
    els.lockError.textContent = '';
    try { await unlock(els.pass.value, false); els.dialog.close(); armAutoLock(); await renderList(); }
    catch (err) { els.lockError.textContent = err.message; }
  });
  els.createVaultBtn.addEventListener('click', async (e) => {
    e.preventDefault(); els.lockError.textContent = '';
    if (els.pass.value.length < 12) { els.lockError.textContent = 'Use at least 12 characters for your passphrase.'; return; }
    try { await unlock(els.pass.value, true); els.dialog.close(); armAutoLock(); await renderList(); newNote(); }
    catch (err) { els.lockError.textContent = err.message; }
  });
  els.pass.addEventListener('input', () => { els.entropyMeter.value = estimateEntropy(els.pass.value); });
}

async function boot() { bindEvents(); lock(); }
boot();
