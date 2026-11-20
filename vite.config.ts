import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  devDependencies: Record<string, string>;
};

// Module workers: the Skill worker imports the self-hosted Pyodide at run time. The Pyodide version is named on the
// 缘起 page; package.json is its only source.
export default defineConfig({
  worker: { format: 'es' },
  define: { __PYODIDE_VERSION__: JSON.stringify(pkg.devDependencies.pyodide) },
});
