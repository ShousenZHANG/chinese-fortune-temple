import { defineConfig } from 'vite';

// Module workers: the Skill worker imports the self-hosted Pyodide at run time.
export default defineConfig({ worker: { format: 'es' } });
