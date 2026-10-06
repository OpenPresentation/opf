// RR-17 (opf-pptx#162): the pptxgenjs-plus output changes opf-pptx does not take (src/vendor-compat.js,
// docs/pptxgenjs-plus-migration.md rows 8 to 10), and a raster declared as SVG (row 17).
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import PptxGenJS from '../vendor/pptxgenjs/pptxgen.es.js';
import {legacyVendorOutput} from '../dist/vendor-compat.js';
import {toPptx} from '../dist/index.js';

// The vendor still writes what the module undoes; if upstream changes it, revisit vendor-compat.js.
const pptx = new PptxGenJS();
const slide = pptx.addSlide();
slide.addShape('rect', {x: 1, y: 1, w: 2, h: 1, fill: {color: 'FFAA00'}});
slide.addText('Text', {x: 1, y: 3, w: 2, h: 1});
slide.addNotes('Notes');
const raw = unzipSync(await pptx.write({outputType: 'uint8array'}));
const rawSlide = strFromU8(raw['ppt/slides/slide1.xml']);
assert.match(rawSlide, /<p:txBody><a:bodyPr\/><a:lstStyle\/><a:p><a:endParaRPr lang="en-US"\/><\/a:p><\/p:txBody><\/p:sp>/, 'vendor: empty text body in a shape without text');
assert.doesNotMatch(strFromU8(raw['ppt/notesMasters/notesMaster1.xml']), /<p:sp>/, 'vendor: minimal notes master');
assert.match(strFromU8(raw['ppt/notesMasters/_rels/notesMaster1.xml.rels']), /Target="\.\.\/theme\/theme2\.xml"/, 'vendor: notes master has its own theme');
assert.match(strFromU8(raw['ppt/theme/theme2.xml']), /<a:clrScheme name="Office">/, 'vendor: default Office notes theme');

const entries = legacyVendorOutput({...raw});
const fixed = strFromU8(entries['ppt/slides/slide1.xml']);
assert.equal((fixed.match(/<p:txBody>/g) ?? []).length, 1, 'only the text shape keeps a text body');
assert.match(fixed, /<a:t>Text<\/a:t>/);
assert.equal(fixed, rawSlide.replace(/<p:txBody><a:bodyPr\/><a:lstStyle\/><a:p><a:endParaRPr lang="en-US"\/><\/a:p><\/p:txBody>(?=<\/p:sp>)/, ''), 'nothing else in the slide changes');
const master = strFromU8(entries['ppt/notesMasters/notesMaster1.xml']);
for (const type of ['hdr', 'dt', 'sldImg', 'body', 'ftr', 'sldNum']) assert.match(master, new RegExp(`<p:ph type="${type}"`), `notes master placeholder ${type}`);
assert.ok(master.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<p:notesMaster '), 'the PptxGenJS 4.0.1 notes master, byte for byte');
assert.match(strFromU8(entries['ppt/notesMasters/_rels/notesMaster1.xml.rels']), /Target="\.\.\/theme\/theme1\.xml"/, 'notes master points at theme1 again');
assert.equal(entries['ppt/theme/theme2.xml'], undefined, 'the vendor notes theme is dropped');
assert.doesNotMatch(strFromU8(entries['[Content_Types].xml']), /theme2\.xml/, 'and its content type');
assert.match(strFromU8(entries['ppt/notesSlides/notesSlide1.xml']), /Notes/, 'notes text is untouched');

// The export: card frames and other text-less shapes have no text body; the notes theme is a copy of the deck theme.
const deck = {slides: [{title: 'Cards', blocks: [{type: 'metric', metric: {value: '42', label: 'Answer'}}], notes: 'Speaker'}], design: {theme: 'bold'}};
const exported = unzipSync(await toPptx(deck, {zipDate: '2026-01-01'}));
const exportedSlide = strFromU8(exported['ppt/slides/slide1.xml']);
for (const [shape] of exportedSlide.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)) {
  assert.doesNotMatch(shape, /<p:txBody><a:bodyPr\/><a:lstStyle\/><a:p>(?:<a:pPr\b[^>]*\/>)?<a:endParaRPr lang="[^"]*"\/><\/a:p><\/p:txBody>/, 'no vendor empty text body in an export');
}
assert.match(strFromU8(exported['ppt/notesMasters/notesMaster1.xml']), /<p:ph type="sldImg"/);
assert.match(strFromU8(exported['ppt/notesMasters/_rels/notesMaster1.xml.rels']), /Target="\.\.\/theme\/theme2\.xml"/);
assert.equal(strFromU8(exported['ppt/theme/theme2.xml']), strFromU8(exported['ppt/theme/theme1.xml']), 'FF-05: the notes theme is the deck theme');

// A raster declared as SVG is embedded as the raster it is (no vendor broken-image fallback, no svgBlip).
const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO8sAAAAASUVORK5CYII=', 'base64'));
const mislabelled = unzipSync(await toPptx({assets: {d: {src: './d.svg', mediaType: 'image/svg+xml'}}, slides: [{title: 'S', image: {src: 'asset:d'}}]}, {imageResolver: async () => png}));
const media = Object.keys(mislabelled).filter(name => name.startsWith('ppt/media/'));
assert.deepEqual(media, ['ppt/media/image-1-1.png']);
assert.deepEqual([...mislabelled[media[0]]], [...png], 'the supplied raster is the picture');
assert.doesNotMatch(strFromU8(mislabelled['ppt/slides/slide1.xml']), /svgBlip/);
console.log('Vendor compatibility: empty shape text bodies, the 4.0.1 notes master and the FF-05 notes theme are restored; a mislabelled raster stays a raster.');
