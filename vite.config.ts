import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  devDependencies: Record<string, string>;
};

/** The site-wide block of public/_headers (Cloudflare Pages), so local preview and the tests run under the same CSP. */
function siteHeaders(): Record<string, string> {
  const text = readFileSync(new URL('./public/_headers', import.meta.url), 'utf8');
  const block = text.split(/\r?\n(?=\S)/).find((section) => section.startsWith('/*')) ?? '';
  return Object.fromEntries(block.split(/\r?\n/).slice(1).map((line) => line.trim()).filter(Boolean)
    .map((line) => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1).trim()]));
}

// Module workers: the Skill worker imports the self-hosted Pyodide at run time. The Pyodide version is named on the
// 缘起 page; package.json is its only source.
export default defineConfig({
  worker: { format: 'es' },
  define: { __PYODIDE_VERSION__: JSON.stringify(pkg.devDependencies.pyodide) },
  preview: { headers: siteHeaders() },
});
