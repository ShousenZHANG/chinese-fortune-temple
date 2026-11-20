/// <reference lib="webworker" />
// Runs the verified chinese-fortune package inside Pyodide. Each call imports the tool module once and calls its
// main(argv) with stdin/stdout swapped, exactly as `python scripts/<tool> <argv>` would.
import type { PyodideInterface } from 'pyodide';
import type { WorkerReply, WorkerRequest } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

type WorkerSources = Extract<WorkerRequest, { type: 'boot' }>['sources'];

const RUNNER = String.raw`
import io, json, sys, importlib

SKILLS = {'chinese-fortune': '/skill/chinese-fortune/scripts', 'life-guide': '/skill/life-guide/scripts'}
_current = None

def _use(skill):
    # Each skill runs with its own scripts directory first, as its CLI does; modules imported from the other
    # skill's directory are dropped, so a same-named module (safety_stop.py) always comes from the right skill.
    global _current
    if skill == _current:
        return
    target = SKILLS[skill]
    for name, module in list(sys.modules.items()):
        path = getattr(module, '__file__', None) or ''
        if path.startswith('/skill/') and not path.startswith(target + '/'):
            del sys.modules[name]
    sys.path[:] = [target] + [p for p in sys.path if p not in SKILLS.values()]
    _current = skill

def run_tool(skill, script, argv, stdin):
    _use(skill)
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

async function writeSources(py: PyodideInterface, origin: string, sources: WorkerSources): Promise<void> {
  await Promise.all(Object.entries(sources).flatMap(([name, source]) => source.files.map(async (file) => {
    const response = await fetch(`${origin}skill/${name}/${file.path}`);
    if (!response.ok) throw new Error(`${name}/${file.path} answered ${response.status}`);
    const target = `/skill/${name}/${file.path}`;
    py.FS.mkdirTree(target.slice(0, target.lastIndexOf('/')));
    py.FS.writeFile(target, new Uint8Array(await response.arrayBuffer()));
  })));
}

async function boot(base: string, archive: string, sources: WorkerSources): Promise<PyodideInterface> {
  const origin = new URL(base, self.location.origin).href;
  reply({ type: 'stage', stage: 'python' });
  const { loadPyodide } = await import(/* @vite-ignore */ `${origin}pyodide/pyodide.mjs`);
  const py: PyodideInterface = await loadPyodide({ indexURL: `${origin}pyodide/` });
  reply({ type: 'stage', stage: 'skill' });
  const response = await fetch(`${origin}skill/${archive}`);
  if (!response.ok) throw new Error(`skill package answered ${response.status}`);
  py.unpackArchive(await response.arrayBuffer(), 'zip', { extractDir: '/skill' });
  await writeSources(py, origin, sources);
  py.runPython(RUNNER);
  reply({ type: 'stage', stage: 'ready' });
  return py;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === 'boot') {
    python = boot(message.base, message.archive, message.sources);
    python.catch((error: unknown) => reply({ type: 'stage', stage: 'failed', detail: String(error) }));
    return;
  }
  try {
    if (!python) throw new Error('worker was asked to run before boot');
    const py = await python;
    const runTool = py.globals.get('run_tool');
    const { skill = 'chinese-fortune', script, argv, stdin = '' } = message.call;
    const raw: string = runTool(skill, script, py.toPy(argv), stdin);
    runTool.destroy();
    reply({ type: 'result', id: message.id, result: JSON.parse(raw) });
  } catch (error) {
    reply({ type: 'error', id: message.id, message: String(error) });
  }
};
