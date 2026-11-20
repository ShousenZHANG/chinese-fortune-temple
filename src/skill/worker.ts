/// <reference lib="webworker" />
// Runs the verified chinese-fortune package inside Pyodide. Each call imports the tool module once and calls its
// main(argv) with stdin/stdout swapped, exactly as `python scripts/<tool> <argv>` would.
import type { PyodideInterface } from 'pyodide';
import type { WorkerReply, WorkerRequest } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

const RUNNER = String.raw`
import io, json, sys, importlib
sys.path.insert(0, '/skill/chinese-fortune/scripts')

def run_tool(script, argv, stdin):
    name = script[:-3] if script.endswith('.py') else script
    module = importlib.import_module(name)
    saved = (sys.stdin, sys.stdout, sys.stderr, sys.argv)
    out_bytes, err_bytes = io.BytesIO(), io.BytesIO()
    out = io.TextIOWrapper(out_bytes, encoding='utf-8', newline='\n')
    err = io.TextIOWrapper(err_bytes, encoding='utf-8', newline='\n')
    sys.stdin = io.TextIOWrapper(io.BytesIO((stdin or '').encode('utf-8')), encoding='utf-8')
    sys.stdout, sys.stderr, sys.argv = out, err, [script, *list(argv)]
    try:
        code = module.main(list(argv))
    except SystemExit as exc:
        code = exc.code if isinstance(exc.code, int) else (0 if exc.code is None else 1)
    finally:
        out.flush()
        err.flush()
        sys.stdin, sys.stdout, sys.stderr, sys.argv = saved
    return json.dumps({'exitCode': code or 0, 'stdout': out_bytes.getvalue().decode('utf-8'),
                       'stderr': err_bytes.getvalue().decode('utf-8')}, ensure_ascii=False)
`;

let python: Promise<PyodideInterface> | null = null;

function reply(message: WorkerReply): void {
  self.postMessage(message);
}

async function boot(base: string, archive: string): Promise<PyodideInterface> {
  const origin = new URL(base, self.location.origin).href;
  reply({ type: 'stage', stage: 'python' });
  const { loadPyodide } = await import(/* @vite-ignore */ `${origin}pyodide/pyodide.mjs`);
  const py: PyodideInterface = await loadPyodide({ indexURL: `${origin}pyodide/` });
  reply({ type: 'stage', stage: 'skill' });
  const response = await fetch(`${origin}skill/${archive}`);
  if (!response.ok) throw new Error(`skill package answered ${response.status}`);
  py.unpackArchive(await response.arrayBuffer(), 'zip', { extractDir: '/skill' });
  py.runPython(RUNNER);
  reply({ type: 'stage', stage: 'ready' });
  return py;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === 'boot') {
    python = boot(message.base, message.archive);
    python.catch((error: unknown) => reply({ type: 'stage', stage: 'failed', detail: String(error) }));
    return;
  }
  try {
    if (!python) throw new Error('worker was asked to run before boot');
    const py = await python;
    const runTool = py.globals.get('run_tool');
    const raw: string = runTool(message.call.script, py.toPy(message.call.argv), message.call.stdin ?? '');
    runTool.destroy();
    reply({ type: 'result', id: message.id, result: JSON.parse(raw) });
  } catch (error) {
    reply({ type: 'error', id: message.id, message: String(error) });
  }
};
