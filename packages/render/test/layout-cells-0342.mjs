// OPF 0.35 step 8: a 0.34 slide with a `layout` and cell keys, fixed by core's fix(), draws exactly as the v0.34.2 engine drew it.
// Through 0.34 the cells composed such a slide and the layout's regions were not used, but the layout record still reached it: its
// design keys (read as the layout's), its color variant, its composition and, for some records, rules that read its regions. fix()
// removes the layout and writes what it gave on the slide when the slide then composes exactly as before, and leaves the slide otherwise.
// The fixture holds 88 such slides (every built-in layout of 0.34.2 with a slide of two column cells; the layouts that gave a slide
// something, and chart and section, with rows, corner cells and a deck that sets the alignment) and the SHA-256 of each one's SVG by
// the v0.34.2 engine. Each slide fix() rewrites must draw to that digest on this engine; each slide it leaves must say why.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gallery } from '@openpresentation/gallery';
import { fix } from '@openpresentation/opf';
import { toSvg } from '../dist/index.js';

const sha = (text) => createHash('sha256').update(text).digest('hex');
const { cases } = JSON.parse(readFileSync(new URL('./fixtures/layout-cells-0342.json', import.meta.url), 'utf8'));
assert.equal(cases.length, 88);
let rewritten = 0, left = 0;
for (const { id, deck, svg034, rewritten: expected } of cases) {
  const result = fix(deck, { catalogs: [gallery] });
  const [entry] = result.layoutWithCells;
  assert.deepEqual([entry?.slide, entry?.layout, entry?.rewritten], [0, deck.slides[0].layout, expected], `${id}: reported`);
  if (expected) {
    assert.equal(result.document.slides[0].layout, undefined, `${id}: the layout is removed`);
    assert.equal(sha(toSvg(result.document, { catalogs: [gallery] })[0]), svg034, `${id}: the fixed slide draws as the 0.34 slide did on v0.34.2`);
    rewritten++;
  } else {
    assert.match(entry.reason, /regions also shaped how its cells drew|drew differently from the same key on the slide/, `${id}: the reason`);
    assert.equal(result.document.slides[0].layout, deck.slides[0].layout, `${id}: left as it is`);
    left++;
  }
}
assert.ok(cases.some((entry) => entry.id === 'columns/plain/chart' && entry.rewritten) && cases.some((entry) => entry.id === 'rows/plain/section' && entry.rewritten));
console.log(`Cells beside a layout: ${rewritten} slides fixed draw as on v0.34.2, ${left} left with the reason.`);
