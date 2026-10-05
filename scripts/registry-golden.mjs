// RR-20: golden selection for the registry fidelity run (scripts/test-registry-fidelity.mjs).
// The pinned opf-render golden test compares the installed core's examples against its own baseline, which records the
// examples digest of one core release. When the core under test ships different examples (core 0.12.1 moved 81 examples
// to singular audience ids without moving a pixel), the reviewed core copy of that baseline, which ecosystem.lock.json
// selects for the ecosystem shards, is used instead. Pixel hashes stay exact either way: this only chooses the file.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

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
  // RR-41 corpus (digest 485b5c07..., core 0.12.1 and 0.12.2); RR-20 example decks moved the checkout to a new corpus.
  'scripts/fixtures/opf-examples-png.audience-ids.sha256.json',
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
