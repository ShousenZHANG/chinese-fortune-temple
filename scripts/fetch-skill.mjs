// Fetch the pinned chinese-fortune release and refuse it unless every check passes:
//   1. the archive's SHA-256 matches its line in SHA256SUMS;
//   2. CI-PROVENANCE.json lists the same checksum and required a successful CI run;
//   3. the release tag points at the commit the provenance names.
// Skills the release does not ship (life-guide, for 问心堂) are taken file by file from that same commit, and each
// file must hash to its git blob id there, so a single changed byte is refused.
// The version in skill.config.json is the only place an upgrade happens (spec, issue #1).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'skill');
const { repo, version, sourceSkills = [] } = JSON.parse(readFileSync(join(ROOT, 'skill.config.json'), 'utf8'));
const archive = `chinese-fortune-v${version}.zip`;
const base = `https://github.com/${repo}/releases/download/v${version}`;
const manifestPath = join(OUT, 'manifest.json');
const apiHeaders = { Accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) apiHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

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
const gitBlob = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

async function tagCommit() {
  let ref = JSON.parse(await get(`https://api.github.com/repos/${repo}/git/ref/tags/v${version}`, apiHeaders));
  // An annotated tag points at a tag object first.
  while (ref.object.type === 'tag') ref = JSON.parse(await get(ref.object.url, apiHeaders));
  return ref.object.sha;
}

async function verifiedRelease(kept) {
  if (kept?.version === version && existsSync(join(OUT, archive))
      && kept.sha256 === sha256(readFileSync(join(OUT, archive)))) {
    console.log(`fetch-skill: v${version} already verified (${kept.commit.slice(0, 7)})`);
    return { version, archive, sha256: kept.sha256, commit: kept.commit, ciRunId: kept.ciRunId, repo };
  }
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
  console.log(`fetch-skill: v${version} verified (${commit.slice(0, 7)}, CI ${provenance.ci_run_id})`);
  return { version, archive, sha256: digest, commit, ciRunId: String(provenance.ci_run_id), repo };
}

function keptSource(kept, name, commit) {
  const source = kept?.sources?.[name];
  if (source?.commit !== commit) return null;
  const intact = source.files.every((file) => {
    const path = join(OUT, name, file.path);
    return existsSync(path) && gitBlob(readFileSync(path)) === file.sha;
  });
  return intact ? source : null;
}

async function verifiedSource(name, commit, kept) {
  const reused = keptSource(kept, name, commit);
  if (reused) {
    console.log(`fetch-skill: ${name} already verified at ${commit.slice(0, 7)} (${reused.files.length} files)`);
    return reused;
  }
  const tree = JSON.parse(await get(`https://api.github.com/repos/${repo}/git/trees/${commit}?recursive=1`, apiHeaders));
  if (tree.truncated) fail(`the tree at ${commit} is truncated; ${name} cannot be listed completely`);
  const prefix = `skills/${name}/`;
  const blobs = tree.tree.filter((entry) => entry.type === 'blob' && entry.path.startsWith(prefix));
  if (!blobs.length) fail(`${prefix} does not exist at ${commit}`);
  const files = await Promise.all(blobs.map(async (blob) => {
    const bytes = await get(`https://raw.githubusercontent.com/${repo}/${commit}/${blob.path}`);
    if (gitBlob(bytes) !== blob.sha) fail(`${blob.path} does not match its git blob at ${commit}`);
    const path = blob.path.slice(prefix.length);
    mkdirSync(dirname(join(OUT, name, path)), { recursive: true });
    writeFileSync(join(OUT, name, path), bytes);
    return { path, sha: blob.sha, size: bytes.length };
  }));
  console.log(`fetch-skill: ${name} verified at ${commit.slice(0, 7)} (${files.length} files)`);
  return { commit, files: files.sort((a, b) => a.path.localeCompare(b.path)) };
}

// 香客簿 picks a birthplace before Python has loaded, so the Skill's own city table is served as a plain file, taken
// from the archive just verified rather than kept as a second copy.
// SKILL.md is sent with a visitor's own-key follow-up question as the rules the model must keep.
function extractServedFiles() {
  const wanted = { 'chinese-fortune/assets/cities_cn.json': 'cities_cn.json', 'chinese-fortune/SKILL.md': 'SKILL.md' };
  const files = unzipSync(readFileSync(join(OUT, archive)), { filter: (file) => file.name in wanted });
  for (const [entry, name] of Object.entries(wanted)) {
    if (!files[entry]) fail(`${archive} has no ${entry}`);
    writeFileSync(join(OUT, name), files[entry]);
  }
}

// The 缘起 page names the third-party packages the Skill runs with. They are read from the vendored wheels' own
// METADATA, so an upgrade of the Skill updates the page.
function vendoredPackages() {
  const entry = 'chinese-fortune/scripts/vendor.zip';
  const outer = unzipSync(readFileSync(join(OUT, archive)), { filter: (file) => file.name === entry });
  if (!outer[entry]) fail(`${archive} has no ${entry}`);
  const inner = unzipSync(outer[entry], { filter: (file) => /\.dist-info\/METADATA$/.test(file.name) });
  return Object.values(inner).map((bytes) => {
    const fields = Object.fromEntries(Buffer.from(bytes).toString('utf8').split(/\r?\n/)
      .map((line) => line.match(/^(Name|Version|License): (.+)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
    return { name: fields.Name, version: fields.Version, license: fields.License };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const kept = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  const release = await verifiedRelease(kept);
  // After an upgrade the previous version's archive would otherwise ship too, and the service worker would precache it.
  for (const name of readdirSync(OUT)) {
    if (/^chinese-fortune-v.+\.zip$/.test(name) && name !== archive) rmSync(join(OUT, name));
  }
  extractServedFiles();
  const sources = {};
  for (const name of sourceSkills) sources[name] = await verifiedSource(name, release.commit, kept);
  writeFileSync(manifestPath, `${JSON.stringify({ ...release, sources, vendored: vendoredPackages() }, null, 2)}\n`);
}

try {
  await main();
} catch (error) {
  console.error(`fetch-skill: ${error instanceof Refused ? '' : 'unexpected error: '}${error.message}`);
  process.exitCode = 1;
}
