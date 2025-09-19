// Run: node scripts/hash.js
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const root = resolve('public');
const files = [
  '/index.html', '/app.css', '/app.js', '/sanitize.js', '/crypto.js', '/idb.js', '/utils.js',
  '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'
];
const hashes = {};
for (const f of files) {
  const buf = readFileSync(resolve(root + f));
  const h = createHash('SHA-256').update(buf).digest('base64');
  hashes['/secure-notes' + f] = 'sha256-' + h; // prefix for GitHub Pages subpath
}
mkdirSync(resolve('public/build'), { recursive: true });
writeFileSync('public/build/hash-manifest.json', JSON.stringify(hashes, null, 2));
console.log('Wrote public/build/hash-manifest.json');
