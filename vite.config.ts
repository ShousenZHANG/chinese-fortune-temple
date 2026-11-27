import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { defineConfig, type Plugin } from 'vite';

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

// v2 spec 3D 场景: three.js and every 3D asset stay within about 2 MB gzipped, or the build fails. Counted as what the
// 3D court downloads beyond the page itself: its chunk, and every chunk and asset only it pulls in. So 3D assets are
// imported from src/scene3d, never put under public/, where nothing would count them.
const BUDGET_3D = 2_000_000;
const COURT_3D = /[\\/]src[\\/]scene3d[\\/]court3d\.ts$/;

function budget3d(): Plugin {
  return {
    name: 'budget-3d',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = new Map(Object.values(bundle).flatMap((file) => (file.type === 'chunk' ? [[file.fileName, file] as const] : [])));
      const reach = (from: string[], dynamic: boolean, page = new Set<string>()): Set<string> => {
        const seen = new Set<string>();
        const visit = (name: string): void => {
          const chunk = chunks.get(name);
          if (seen.has(name) || page.has(name) || !chunk) return;
          seen.add(name);
          [...chunk.imports, ...(dynamic ? chunk.dynamicImports : [])].forEach(visit);
        };
        from.forEach(visit);
        return seen;
      };
      const court = [...chunks.values()].find((chunk) => COURT_3D.test(chunk.facadeModuleId ?? ''));
      if (!court) return this.error('budget-3d: no chunk was built for src/scene3d/court3d.ts');
      const page = reach([...chunks.values()].filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName), false);
      const files = new Set([...reach([court.fileName], true, page)].flatMap((name) => {
        const meta = chunks.get(name)?.viteMetadata;
        return [name, ...(meta?.importedAssets ?? []), ...(meta?.importedCss ?? [])];
      }));
      const bytes = [...files].reduce((sum, name) => {
        const file = bundle[name];
        return sum + gzipSync(file.type === 'chunk' ? file.code : file.source).length;
      }, 0);
      const mb = (count: number): string => (count / 1e6).toFixed(2);
      if (bytes > BUDGET_3D) this.error(`budget-3d: 3D code and assets are ${mb(bytes)} MB gzipped, over the ${mb(BUDGET_3D)} MB budget`);
      console.log(`budget-3d: ${files.size} file(s), ${mb(bytes)} MB gzipped of ${mb(BUDGET_3D)} MB`);
    },
  };
}

// Module workers: the Skill worker imports the self-hosted Pyodide at run time. The Pyodide version is named on the
// 缘起 page; package.json is its only source.
export default defineConfig({
  worker: { format: 'es' },
  define: { __PYODIDE_VERSION__: JSON.stringify(pkg.devDependencies.pyodide) },
  preview: { headers: siteHeaders() },
  plugins: [budget3d()],
  // three.js is one chunk of about 530 kB, loaded only for 3D; budget3d holds it to its real limit.
  build: { chunkSizeWarningLimit: 1000 },
});
