const enc = new TextEncoder();
const dec = new TextDecoder();

const ITERATIONS = 310000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

let memKey = null;
let memSalt = null;

export function isUnlocked() { return !!memKey; }
export function clearKey() { memKey = null; memSalt = null; }

export async function deriveFromPassphrase(passphrase, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const s = salt || crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: s, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  memKey = key;
  memSalt = s;
  return { key, salt: s };
}

export function getSaltB64() { return memSalt ? btoa(String.fromCharCode(...memSalt)) : null; }

export async function encryptJson(obj) {
  if (!memKey) throw new Error('locked');
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const data = enc.encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, memKey, data);
  return { iv: Array.from(iv), ct: Array.from(new Uint8Array(ct)) };
}
export async function decryptJson(payload) {
  if (!memKey) throw new Error('locked');
  const iv = new Uint8Array(payload.iv);
  const ct = new Uint8Array(payload.ct);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, memKey, ct);
  return JSON.parse(dec.decode(pt));
}
