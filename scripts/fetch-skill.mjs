// Fetch the pinned chinese-fortune release and refuse it unless every check passes:
//   1. the archive's SHA-256 matches its line in SHA256SUMS;
//   2. CI-PROVENANCE.json lists the same checksum and required a successful CI run;
//   3. the release tag points at the commit the provenance names.
// The version in skill.config.json is the only place an upgrade happens (spec, issue #1).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'skill');
const { repo, version } = JSON.parse(readFileSync(join(ROOT, 'skill.config.json'), 'utf8'));
const archive = `chinese-fortune-v${version}.zip`;
const base = `https://github.com/${repo}/releases/download/v${version}`;

class Refused extends Error {}

// Throw instead of process.exit: exiting with downloads still in flight trips a libuv assertion on Windows.
function fail(message) {
  throw new Refused(message);
}

async function get(url, headers = {}) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
      if (response.status < 500) fail(`${url} answered ${response.status}`);
    } catch (error) {
      if (error instanceof Refused || attempt === 3) throw error;   // a 4xx will not change on retry
    }
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
  }
  return fail(`${url} did not answer`);
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function tagCommit() {
  const headers = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  let ref = JSON.parse(await get(`https://api.github.com/repos/${repo}/git/ref/tags/v${version}`, headers));
  // An annotated tag points at a tag object first.
  while (ref.object.type === 'tag') ref = JSON.parse(await get(ref.object.url, headers));
  return ref.object.sha;
}

async function main() {
  const manifestPath = join(OUT, 'manifest.json');
  if (existsSync(manifestPath) && existsSync(join(OUT, archive))) {
    const kept = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (kept.version === version && kept.sha256 === sha256(readFileSync(join(OUT, archive)))) {
      console.log(`fetch-skill: v${version} already verified (${kept.commit.slice(0, 7)})`);
      return;
    }
  }

  mkdirSync(OUT, { recursive: true });
  const [zip, sums, provenanceBytes] = await Promise.all(
    [archive, 'SHA256SUMS', 'CI-PROVENANCE.json'].map((name) => get(`${base}/${name}`)),
  );
  const digest = sha256(zip);
  const line = `${digest}  ${archive}`;
  if (!sums.toString('utf8').split(/\r?\n/).includes(line)) fail(`${archive} does not match SHA256SUMS`);
  const provenance = JSON.parse(provenanceBytes.toString('utf8'));
  if (provenance.require_workflow_conclusion !== 'success') fail('provenance does not require a successful CI run');
  if (!String(provenance.checksums).split('\n').includes(line)) fail('provenance checksums do not list this archive');
  const commit = await tagCommit();
  if (commit !== provenance.commit) fail(`tag v${version} is ${commit}, provenance says ${provenance.commit}`);

  writeFileSync(join(OUT, archive), zip);
  writeFileSync(join(OUT, 'SHA256SUMS'), sums);
  writeFileSync(join(OUT, 'CI-PROVENANCE.json'), provenanceBytes);
  const manifest = { version, archive, sha256: digest, commit, ciRunId: String(provenance.ci_run_id), repo };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`fetch-skill: v${version} verified (${commit.slice(0, 7)}, CI ${provenance.ci_run_id})`);
}

try {
  await main();
} catch (error) {
  console.error(`fetch-skill: ${error instanceof Refused ? '' : 'unexpected error: '}${error.message}`);
  process.exitCode = 1;
}
