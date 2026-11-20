// Runs scripts/parity_reference.py with whichever Python this machine has. On Windows "python3" can be the
// Microsoft Store stub (exit 49), so each name is probed with --version first.
import { spawnSync } from 'node:child_process';

const python = ['python3', 'python'].find((name) => spawnSync(name, ['--version']).status === 0);
if (!python) {
  console.error('parity-reference: no working python3 or python found');
  process.exit(1);
}
const done = spawnSync(python, ['-X', 'utf8', 'scripts/parity_reference.py'], { stdio: 'inherit' });
process.exit(done.status ?? 1);
