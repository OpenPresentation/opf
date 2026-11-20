// RR-105 (opf#1291, probe 2): PowerPoint wraps a title itself (one native wrapped title) only in a face whose single-spaced line was
// measured in PowerPoint in that face's own font. Probe 2 measured 38 Latin faces from the slide images; 36 were drawn in their own
// font (ink width within 2 px of the face's file) at 1.2 sizes, and join TITLE_LINE_HEIGHTS. Raleway and Work Sans were drawn about
// 3 px wider, so they are not taken as measured and their wrapped titles keep fixed lines.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {fromPptx, toPptx} from './helpers/default-catalog.mjs';

const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
const title = 'Quarterly results show steady growth in every region we serve';
async function tier(face) {
  const deck = {design: {fontScheme: {major: face, minor: face}}, slides: [{title, items: ['One', 'Two']}]};
  await fonts.ensure(deck);
  const bytes = new Uint8Array(await toPptx(deck, {fonts}));
  const shapes = [...strFromU8(unzipSync(bytes)['ppt/slides/slide1.xml']).matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape)
    .filter(shape => shape.includes('name="OPF heading slides.0.title line '));
  assert.equal(shapes.length, 1, `${face}: one title`);
  assert.match(shapes[0], /<p:ph type="(?:ctrTitle|title)"\/>/, `${face}: the Title placeholder`);
  assert.equal((await fromPptx(bytes)).slides[0].title, title, `${face}: the title round trips`);
  return /<a:bodyPr\b[^>]*\bwrap="square"/.test(shapes[0]) ? 'soft' : 'fixed';
}
// Faces probe 2 added, whose title here wraps: PowerPoint wraps them itself.
for (const face of ['Arial', 'Open Sans', 'Poppins', 'Noto Sans', 'Courier New']) assert.equal(await tier(face), 'soft', `${face}: measured, a native wrap`);
// Not confirmed in their own font: fixed lines.
for (const face of ['Raleway', 'Work Sans']) assert.equal(await tier(face), 'fixed', `${face}: not measured, fixed lines`);
console.log('RR-105 soft-wrap faces passed: faces measured in probe 2 wrap natively; Raleway and Work Sans keep fixed lines.');
