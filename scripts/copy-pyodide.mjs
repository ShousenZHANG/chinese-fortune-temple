// Self-host the Pyodide core next to the site (no CDN at runtime; the Service Worker can cache it for offline use).
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FROM = join(ROOT, 'node_modules', 'pyodide');
const TO = join(ROOT, 'public', 'pyodide');
const FILES = ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];

mkdirSync(TO, { recursive: true });
for (const name of FILES) copyFileSync(join(FROM, name), join(TO, name));
console.log(`copy-pyodide: ${FILES.length} files`);
