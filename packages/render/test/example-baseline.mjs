import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {exampleBaseline, LEGACY_EXAMPLE_BASELINE, CENTERED_EXAMPLE_BASELINE, FIRST_USE_EXAMPLE_BASELINE} from '../scripts/example-baseline.mjs';
import {readBaseline, diffManifests} from './golden-store.mjs';

assert.equal(exampleBaseline('left'), LEGACY_EXAMPLE_BASELINE);
assert.equal(exampleBaseline('center'), CENTERED_EXAMPLE_BASELINE);
// RR-90: a core that draws table text at the body size selects the first-use baseline; the reviewed rr85 fixture stays as it is.
assert.equal(exampleBaseline('center', 25), FIRST_USE_EXAMPLE_BASELINE);
assert.equal(exampleBaseline('center', 16), CENTERED_EXAMPLE_BASELINE);
assert.equal(exampleBaseline('left', 25), LEGACY_EXAMPLE_BASELINE, 'Published-core baseline remains separate');
for (const size of [0, -1, NaN, 'x']) assert.throws(() => exampleBaseline('center', size), /Unknown table text size/);
for (const alignment of [undefined, 'right', 'unexpected']) {
  assert.throws(() => exampleBaseline(alignment), /Unknown metric default alignment/);
}
const root = fileURLToPath(new URL('../', import.meta.url));
assert.equal(readBaseline(path.join(root, FIRST_USE_EXAMPLE_BASELINE)).entries && Object.keys(readBaseline(path.join(root, FIRST_USE_EXAMPLE_BASELINE)).entries).length, 807, 'the first-use baseline has the 807 example slides');
const legacy = readBaseline(path.join(root, exampleBaseline('left')));
const bytes = readFileSync(path.join(root, exampleBaseline('center')));
assert.equal(createHash('sha256').update(bytes).digest('hex'),
  '683a70a34c85a98cc0d9cadbc705646cd45894eaf03302bd01c6c79964738d35',
  'Centered fixture must retain exact bytes of the reviewed Core b1f0aa3c source fixture');
const centered = readBaseline(path.join(root, exampleBaseline('center')));
assert.equal(Object.keys(centered.entries).length, 807);
assert.deepEqual(Object.keys(centered.entries), Object.keys(legacy.entries));
for (const field of ['version', 'source', 'format', 'scale', 'systemFonts']) {
  assert.deepEqual(centered[field], legacy[field], `Unchanged golden ${field}`);
}
assert.deepEqual(diffManifests(legacy, centered).changedSlides, [
  'technical/block-composition.opf.json#0',
  'technical/content-payload-matrix.opf.json#8',
  'technical/metrics-quotes-timeline.opf.json#0',
  'technical/promoted-region-grid.opf.json#2',
]);
const temp = mkdtempSync(path.join(tmpdir(), 'example-baseline-'));
try {
  mkdirSync(path.join(temp, 'test/golden'), {recursive: true});
  writeFileSync(path.join(temp, LEGACY_EXAMPLE_BASELINE), JSON.stringify(legacy));
  assert.throws(() => readBaseline(path.join(temp, exampleBaseline('center'))), /ENOENT/,
    'Missing centered baseline cannot fall back to the legacy baseline');
  writeFileSync(path.join(temp, CENTERED_EXAMPLE_BASELINE), '{invalid');
  assert.throws(() => readBaseline(path.join(temp, exampleBaseline('center'))), SyntaxError);
} finally { rmSync(temp, {recursive: true, force: true}); }
console.log('Example baseline: exact approved bytes, 807 unchanged keys/policy, four metric changes and unknown/missing/malformed rejection passed.');
