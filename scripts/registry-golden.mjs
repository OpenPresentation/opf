// RR-20: reviewed golden helpers. Registry fidelity binds the fixture to the installed core's immutable release ref and
// changes no pixel comparison. MR-31: the checkout's own baseline is the renderer's (packages/render/test/golden/), so the
// corpus-only lookup of core fixtures (`reviewedCoreGolden`, the retained fixtures) is gone; the published core's golden is
// still read from the git history at its verification ref, where the lock selected a core fixture.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Registry geometry belongs to the immutable source that qualified the installed release. The examples digest alone
// cannot distinguish two cores that compose identical documents differently (for example metric default alignment).
// Like test-packed-ecosystem.mjs's readHarnessBytes, read only blobs at the registry plan's verificationRefs.opf
// (scripts/registry-plan.mjs: the commit the published core was built from).
export function readPublishedCoreGolden({ root, ref, version, digest }) {
  if (!/^[a-f0-9]{40}$/.test(ref ?? '')) throw new Error('Missing immutable registry verification ref for opf');
  const read = (file) => execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 });
  const manifest = JSON.parse(read('packages/javascript/package.json'));
  if (manifest.version !== version) throw new Error(`Registry core verification ref version ${manifest.version} does not match installed ${version}`);
  // MR-34: a release commit with no ecosystem lock (or none with a golden) has no core golden fixture; its baseline is the
  // renderer's own (packages/render/test/golden/), which the pinned renderer tests select themselves.
  let lock;
  try {
    lock = read('ecosystem.lock.json');
  } catch {
    return undefined;
  }
  const { golden } = JSON.parse(lock);
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
