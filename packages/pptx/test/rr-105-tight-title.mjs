// RR-105 (opf#1291 x LH-189): a two-line display title at LH-189's tight pitch (1.0 em, under PowerPoint's 1.2 em single line) is
// still one Title placeholder of fixed lines: paragraph 1 at single spacing, paragraph 2 at its own spacing under 100%, set from the
// pitch less the face's residual measured in PowerPoint (probe 3, variant K). A face not measured falls back to line boxes unless the
// worst residual stays within 1 px. Import reads the title back as written; the spacing is not an authored property.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {strFromU8, unzipSync} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {fromPptx, toPptx} from './helpers/default-catalog.mjs';

const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
const sampler = JSON.parse(readFileSync(new URL('../../../examples/technical/layout-sampler.opf.json', import.meta.url), 'utf8'));
// Probe 3: line 2 below the pitch by this many px at 960 at the size in points (spcPct = 1.0 em / 1.2 em).
const RESIDUAL = {Roboto: 1.24 / 48.75, 'Arial Black': .49 / 40.5, 'Aptos Display': 1.25 / 48.75, Montserrat: 1 / 40};
const CASES = [['Impact', 'The pilot pays back in one quarter'], ['Bookman Old Style', 'A smaller pilot. Pilot plan.'], ['Roboto', 'A smaller pilot. A clearer decision.'],
  ['Arial Black', 'A clearer plan for the harbor'], ['Aptos Display', 'A smaller pilot. A clearer decision.'], ['Montserrat', 'A smaller pilot hamburg quay']];
const deck = {...sampler, slides: [...CASES, ['Georgia', 'Quarterly growth in every region']].map(([face, title], index) => ({...sampler.slides[0], id: `tight-${index + 1}`, title,
  design: {...sampler.slides[0].design, fontScheme: {major: face, minor: 'Aptos'}}}))};
await fonts.ensure(deck);
const diagnostics = [];
const bytes = new Uint8Array(await toPptx(deck, {fonts, onDiagnostic: value => diagnostics.push(value)}));
const entries = unzipSync(bytes);
const titleShapes = index => [...strFromU8(entries[`ppt/slides/slide${index + 1}.xml`]).matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape)
  .filter(shape => shape.includes(`name="OPF heading slides.${index}.title line `));
for (const [index, [face]] of CASES.entries()) {
  const shapes = titleShapes(index);
  assert.equal(shapes.length, 1, `${face}: one title`);
  const [shape] = shapes;
  assert.match(shape, /<p:ph type="(?:ctrTitle|title)"\/>/, `${face}: the Title placeholder`);
  assert.match(shape, /<a:bodyPr\b[^>]*\bwrap="none"/);
  assert.equal((shape.match(/<a:p>/g) ?? []).length, 2, `${face}: one paragraph per line`);
  const spacing = [...shape.matchAll(/<a:lnSpc><a:spcPct val="(\d+)"\/><\/a:lnSpc>/g)].map(match => Number(match[1]));
  assert.equal(spacing[0], 100000, `${face}: line 1 at single spacing`);
  assert.ok(spacing[1] > 80000 && spacing[1] < 100000, `${face}: line 2 under single spacing (${spacing[1]})`);
  assert.doesNotMatch(shape, /<a:spcBef>/, `${face}: no space before`);
  // At LH-189's 1.0 em pitch the spacing is (1.0 - residual) / 1.2 exactly.
  if (RESIDUAL[face] !== undefined) assert.equal(spacing[1], Math.round((1 - RESIDUAL[face]) / 1.2 * 100000), `${face}: the measured residual`);
  assert.ok(!diagnostics.some(value => value.code === 'native-body-fallback' && value.path === `slides.${index}.title`));
}
// Georgia was not measured: at 48.75 pt the worst residual (0.031 em, 1.5 px) exceeds 1 px, so the title keeps its line boxes.
assert.equal(titleShapes(6).length, 2, 'a face not measured keeps the measured line boxes');
assert.ok(diagnostics.some(value => value.code === 'native-body-fallback' && value.path === 'slides.6.title' && /line pitch/.test(value.message)));
// Import: the authored titles, no line spacing in the document.
const imported = await fromPptx(bytes);
assert.deepEqual(imported.slides.map(slide => slide.title), deck.slides.map(slide => slide.title));
assert.ok(!JSON.stringify(imported.slides).includes('lineSpacing'), 'the spacing under 100% is not imported as an authored property');
console.log(`RR-105 tight titles passed: ${CASES.length} faces bound at a pitch under the single line, a face not measured falls back, the titles round trip.`);
