// RR-20: reviewed golden helpers. Registry fidelity binds the fixture to the installed core's immutable release ref;
// corpus-only lookup is retained below for historical reviewed fixtures. Neither path changes any pixel comparison.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Registry geometry belongs to the immutable source that qualified the installed release. The examples digest alone
// cannot distinguish two cores that compose identical documents differently (for example metric default alignment).
// Like test-packed-ecosystem.mjs's readHarnessBytes, read only blobs at release-plan.json's verificationRefs.opf.
export function readPublishedCoreGolden({ root, ref, version, digest }) {
  if (!/^[a-f0-9]{40}$/.test(ref ?? '')) throw new Error('Missing immutable registry verification ref for opf');
  const read = (file) => execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 });
  const manifest = JSON.parse(read('packages/javascript/package.json'));
  if (manifest.version !== version) throw new Error(`Registry core verification ref version ${manifest.version} does not match installed ${version}`);
  const { golden } = JSON.parse(read('ecosystem.lock.json'));
  if (!golden || golden.repository !== 'opf') return undefined;
  const relative = golden.path;
  if (typeof relative !== 'string' || !relative.startsWith('scripts/fixtures/') || path.posix.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error('Published core golden path leaves the fixture directory');
  }
  const bytes = read(relative);
  const baseline = JSON.parse(bytes);
  if (baseline.source?.sha256 !== digest) throw new Error('Published core golden does not match the installed examples digest');
  return { path: relative, bytes, ref };
}

// Same digest as the renderer's test/golden.mjs: sha256 of the sorted [file, key-sorted deck] pairs.
export function examplesDigest(examples) {
  const corpus = examples.map(({ file, deck }) => ({ file: file.replace(/^examples\//, ''), deck }));
  corpus.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  return createHash('sha256').update(JSON.stringify(corpus.map(({ file, deck }) => [file, canonical(deck)]))).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

// Reviewed core baselines of an example corpus that a published core release ships, kept after the checkout's examples
// moved on (the lock's golden always records this checkout's corpus). The registry run installs the release-plan core,
// which can ship such an older corpus until the next core release; each file still compares every pixel hash exactly.
// Remove an entry once no release-plan core ships its corpus.
export const RETAINED_CORE_GOLDENS = [
  // Published 0.19 examples remain qualified independently of the array-area source candidate.
  'scripts/fixtures/opf-examples-png.rr83-v2-reviewed.sha256.json',
  // RR-20 corpus (digest 394c4ce7..., core 0.13.0); the FA 0.14 examples moved the checkout to a new corpus.
  'scripts/fixtures/opf-examples-png.example-decks.sha256.json',
];

// Returns the absolute path of the reviewed core golden that records exactly the installed core's examples: the lock's
// core golden, else a retained one (RETAINED_CORE_GOLDENS); otherwise undefined (the renderer then uses its own
// baseline, which fails if it does not match either). A golden in another repository is the renderer's own business and
// is never selected here.
export function reviewedCoreGolden({ root, lock, digest, retained = RETAINED_CORE_GOLDENS }) {
  const golden = lock?.golden;
  if (!golden || golden.repository !== 'opf') return undefined;
  for (const relative of [golden.path, ...retained]) {
    const file = path.resolve(root, relative);
    if (path.relative(root, file).startsWith('..') || path.isAbsolute(path.relative(root, file))) throw new Error(`Golden path leaves the checkout: ${relative}`);
    const baseline = JSON.parse(readFileSync(file, 'utf8'));
    if (baseline.source?.sha256 === digest) return file;
  }
  return undefined;
}
