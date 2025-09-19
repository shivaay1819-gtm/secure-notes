// Run: node scripts/inject-sw.js
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const manifestPath = resolve('public/build/hash-manifest.json');
const swPath = resolve('public/sw.js');

const hashes = JSON.parse(readFileSync(manifestPath, 'utf8'));
let sw = readFileSync(swPath, 'utf8');

// Replace the APP_HASHES block entirely
const newBlock = 'const APP_HASHES = ' + JSON.stringify(hashes, null, 2) + ';';
sw = sw.replace(/const APP_HASHES = [\\s\\S]*?;\\n/, newBlock + '\n');

writeFileSync(swPath, sw);
console.log('Injected APP_HASHES into sw.js');
