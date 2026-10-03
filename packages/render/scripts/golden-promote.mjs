// RR-52: promote a reviewed golden candidate into a per-deck baseline directory.
//
//   node scripts/golden-promote.mjs [--candidate artifacts/golden/candidate.json] [--baseline <selection>] [--out artifacts/golden]
//
// Only the deck files whose hashes differ are rewritten (and decks that left the corpus are removed), so the commit
// touches exactly the decks that moved. The scale, format and font policy of the baseline are never changed here:
// the comparison itself is exact hashes at a fixed scale, and a different scale is a different golden. Writes
// <out>/diff.json (changed decks and slides) for the review. This script does not review anything: the reviewer
// compares the changed slides in the review sheets first.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diffManifests, readBaseline, resolveBaseline, writeBaseline } from '../test/golden-store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; };
const out = path.resolve(option('--out', process.env.OPF_GOLDEN_OUT ?? path.join(root, 'artifacts/golden')));
const candidatePath = path.resolve(option('--candidate', path.join(out, 'candidate.json')));
const selection = option('--baseline', process.env.OPF_GOLDEN_BASELINE ?? path.join(root, 'test/golden/opf-examples-png.cover-centering.sha256.json'));

const resolved = resolveBaseline(selection);
assert.equal(resolved.kind, 'directory', `${selection}: promotion needs a per-deck baseline directory (run scripts/golden-migrate.mjs on a single-file manifest first)`);
const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
const expected = readBaseline(resolved.path);
for (const field of ['version', 'format', 'scale', 'systemFonts']) {
  assert.deepEqual(candidate[field], expected[field], `Golden ${field} differs from the baseline; regeneration never changes how goldens are compared`);
}
const sourceMatches = JSON.stringify(candidate.source) === JSON.stringify(expected.source);
const { changedSlides, changedDecks } = diffManifests(expected, candidate);
const files = writeBaseline(resolved.path, candidate);
const report = { baseline: path.relative(root, resolved.path), sourceMatches, changedSlides, changedDecks, filesWritten: files.written, filesRemoved: files.removed };
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'diff.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Golden promote: ${changedSlides.length} slides in ${changedDecks.length} decks changed; ${files.written.length} files written, ${files.removed.length} removed, ${files.unchanged} untouched${sourceMatches ? '' : '; the corpus digest changed (new core examples)'}.`);
