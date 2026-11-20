"""Run every parity case through the pinned Skill's own CLI and save what it prints (tests/parity/reference.json).

The reference is regenerated from the package the build verified, so a Skill upgrade regenerates it too.
"""
import json
import os
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
manifest = json.loads((ROOT / 'public' / 'skill' / 'manifest.json').read_text(encoding='utf-8'))
cases = json.loads((ROOT / 'tests' / 'parity' / 'cases.json').read_text(encoding='utf-8'))['cases']
with tempfile.TemporaryDirectory() as tmp:
    zipfile.ZipFile(ROOT / 'public' / 'skill' / manifest['archive']).extractall(tmp)
    scripts = Path(tmp) / 'chinese-fortune' / 'scripts'
    out = {}
    for case in cases:
        # The browser has no system zone files, so the Skill reads its own vendored tzdata there. An empty
        # PYTHONTZPATH makes the reference read the same data instead of /usr/share/zoneinfo (CI run 44653387556).
        done = subprocess.run([sys.executable, '-X', 'utf8', str(scripts / case['script']), *case['argv']],
                              input=case.get('stdin', ''), capture_output=True, text=True, encoding='utf-8',
                              env={**os.environ, 'PYTHONTZPATH': ''})
        out[case['id']] = {'exitCode': done.returncode, 'stdout': done.stdout.replace('\r\n', '\n')}
(ROOT / 'tests' / 'parity' / 'reference.json').write_text(
    json.dumps({'skill': manifest, 'python': sys.version.split()[0], 'results': out}, ensure_ascii=False, indent=1),
    encoding='utf-8')
print(f'parity reference: {len(out)} cases from chinese-fortune v{manifest["version"]}')
