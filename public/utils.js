export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export const nowIso = () => new Date().toISOString();
export function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString([], { hour: '2-digit', minute: '2-digit', year: 'numeric', month: 'short', day: '2-digit' });
}
export function debounce(fn, ms = 300) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }
export function estimateEntropy(pw) {
  const L = pw.length;
  const sets = [
    /[a-z]/.test(pw), /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw),
  ].filter(Boolean).length;
  return Math.min(120, L * (sets ? 8 + (sets - 1) * 6 : 0));
}
