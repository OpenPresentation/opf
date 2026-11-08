// RR-105 (opf#1091): a rich line whose runs are all smaller than its fit size (an eyebrow-like title of 20 pt runs under a 40.5 pt title
// role) has core's baseline one fit size below its top. Written at single spacing, PowerPoint 16.0.20527 took the first baseline from the
// small runs and drew the line about 22 pt above the preview. The line is now written with exact spacing whose pitch puts PowerPoint's first
// baseline (three quarters of the pitch below the top, SH-07's measurement) on core's baseline. Lines whose largest run is the fit size keep
// single spacing. The PowerPoint position is checked through COM by the qualification session (see the PR).
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {resolveSlideContext} from '@openpresentation/opf';
import {composeSlide} from '@openpresentation/opf/composition';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {catalogs, fromPptx, toPptx} from './helpers/default-catalog.mjs';

const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
const EMU = 12700; // per point
const options = {fonts, timestamp: '2026-11-07T00:00:00Z', zipDate: '2026-11-07T00:00:00Z'};
const deck = {$schema: 'https://openpresentation.org/schema/opf/v1', name: 'Small title run', language: 'en-US', slides: [
  {title: [{text: 'Where AI fits', fontSize: 20}], text: 'A short body.'},
  {title: 'A plain title', text: 'A short body.'},
  {title: [{text: 'Mixed '}, {text: 'title', fontSize: 20}], text: 'A short body.'},
  {title: [{text: 'Two small runs, ', fontSize: 17}, {text: 'one italic', fontSize: 17, italic: true}], text: 'A short body.'}
]};
const bytes = new Uint8Array(await toPptx(deck, options)), entries = unzipSync(bytes);
const heading = slide => [...strFromU8(entries[`ppt/slides/slide${slide + 1}.xml`]).matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape)
  .filter(shape => shape.includes(`name="OPF heading slides.${slide}.title line `));
const title = slide => {
  const context = resolveSlideContext(deck, slide, {catalogs, fonts});
  return composeSlide(context.slide, context.options).items.find(item => item.field === 'title');
};

// 1. Small runs: exact spacing whose three quarters put the first baseline on core's.
for (const slide of [0, 3]) {
  const [shape] = heading(slide), item = title(slide), placed = item.text.placement.lines[0];
  assert.equal(heading(slide).length, 1);
  const top = Number(/<a:off x="-?\d+" y="(\d+)"\/>/.exec(shape)[1]) / EMU;
  const pitch = Number(/<a:lnSpc><a:spcPts val="(\d+)"\/><\/a:lnSpc>/.exec(shape)?.[1]) / 100;
  assert.ok(pitch > 0, `slide ${slide + 1}: exact line spacing`);
  assert.ok(!/spcPct/.test(shape), `slide ${slide + 1}: no single spacing`);
  assert.ok(Math.abs(top + .75 * pitch - placed.baseline * .75) < .02, `slide ${slide + 1}: PowerPoint's baseline ${top + .75 * pitch} pt, core's ${placed.baseline * .75} pt`);
  const largest = Math.max(...item.text.richLines[0].fragments.map(fragment => fragment.fontSize)) * .75;
  assert.ok(pitch >= 1.35 * largest, 'the pitch is in the range the three-quarters rule was measured for');
}
// The repro's numbers: a 54 px (40.5 pt) title role over a 20 pt run; core's baseline 54 px below the top, a 54 pt pitch.
assert.match(heading(0)[0], /<a:lnSpc><a:spcPts val="5400"\/><\/a:lnSpc>/);
assert.match(heading(0)[0], /<a:rPr\b[^>]*\bsz="2000"/);

// 2. A plain title and a rich title with a run at the title size keep single spacing.
for (const slide of [1, 2]) for (const shape of heading(slide)) {
  assert.match(shape, /<a:lnSpc><a:spcPct val="100000"\/><\/a:lnSpc>/, `slide ${slide + 1} keeps single spacing`);
}

// 3. Import still reads the authored runs.
const back = await fromPptx(bytes);
assert.deepEqual(back.slides[0].title, [{text: 'Where AI fits', fontSize: 20}]);
assert.deepEqual(back.slides[3].title, [{text: 'Two small runs, ', fontSize: 17}, {text: 'one italic', fontSize: 17, italic: true}]);

console.log('RR-105: a title of runs smaller than its role size is written with the exact pitch that puts PowerPoint\'s baseline on the preview\'s.');
