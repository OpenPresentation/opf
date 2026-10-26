import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {composeSlide} from '@openpresentation/opf/composition';
import {defaultCatalog, toPptx} from './helpers/default-catalog.mjs';

// WI-3 (P23): a video's placeholder is drawn in the 16:9 frame core composes (item.box), not in the whole portrait cell of the
// column: the frame shape, the badge and the caption all follow it, and a presentation the export reads back keeps the frame.
const EMU = 9525;
const clips = Array.from({length: 3}, (_, index) => ({video: {src: `https://example.com/clip-${index}.mp4`, title: `Walkthrough ${index + 1}`}}));
const slide = {layout: 'three-column', title: 'Three peer columns of video', blocks: clips};
const deck = {$schema: 'https://openpresentation.org/schema/opf/v1', name: 'Video frames', design: {fontScheme: 'roboto'}, slides: [slide]};
const entries = unzipSync(await toPptx(structuredClone(deck), {seed: 1}));
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const shapes = [parser.parse(new TextDecoder().decode(entries['ppt/slides/slide1.xml']))['p:sld']['p:cSld']['p:spTree']['p:sp']].flat();
const named = suffix => shapes.filter(shape => shape['p:nvSpPr']['p:cNvPr'].name.endsWith(suffix));
const boxOf = shape => {
  const xfrm = shape['p:spPr']['a:xfrm'];
  return {x: Number(xfrm['a:off'].x) / EMU, y: Number(xfrm['a:off'].y) / EMU, width: Number(xfrm['a:ext'].cx) / EMU, height: Number(xfrm['a:ext'].cy) / EMU};
};
const composed = composeSlide(slide, {layout: defaultCatalog.layouts['three-column']}).items.filter(item => item.field === 'video');
const frames = named(' frame').map(boxOf);

assert.equal(frames.length, 3, 'one placeholder frame per video');
for (const [index, frame] of frames.entries()) {
  const item = composed[index].box;
  for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(frame[key] - item[key]) < 1, `frame ${index} ${key}: ${frame[key]} vs core ${item[key]}`);
  assert.ok(Math.abs(frame.width / frame.height - 16 / 9) < 0.02, `frame ${index} is 16:9`);
}
const badge = named(' badge').map(boxOf);
for (const [index, frame] of frames.entries()) {
  assert.ok(Math.abs(badge[index].x + badge[index].width / 2 - (frame.x + frame.width / 2)) < 1, 'the play badge is centered on the frame');
  assert.ok(Math.abs(badge[index].y + badge[index].height / 2 - (frame.y + frame.height / 2)) < 1);
}
console.log('video-frame: ok');
