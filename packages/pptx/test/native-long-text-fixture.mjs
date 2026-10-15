import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {unzipSync, strFromU8} from 'fflate';
import {XMLParser, XMLValidator} from 'fast-xml-parser';

// Source integrity only: opening this retained deck in a native app is a separate check.
const root = new URL('./fixtures/native-long-text/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
const bytes = await readFile(new URL('llmreference.pptx', root));
const digest = createHash('sha256').update(bytes).digest('hex');
assert.equal(digest, 'a16ba26a8e6822c30b96b47e4d929ed805af0653fcccf9d4682ff7edf08cc29a');
assert.equal(digest, manifest.source.sha256);
assert.equal(bytes.length, 97474);
assert.equal(bytes.length, manifest.source.bytes);
assert.equal(manifest.source.file, 'llmreference.pptx');
assert.equal(manifest.expectedSlideCount, 7);
assert.deepEqual(manifest.slides.map(slide => slide.number), [3, 5]);

const parts = unzipSync(bytes);
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', trimValues: false, parseTagValue: false});
const xml = name => {
  assert.ok(parts[name], `Missing ${name}`);
  const source = strFromU8(parts[name]);
  assert.equal(XMLValidator.validate(source), true, `Invalid XML in ${name}`);
  return parser.parse(source);
};
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const unique = values => [...new Set(values)].sort();
const presentation = xml('ppt/presentation.xml')['p:presentation'];
assert.equal(array(presentation['p:sldIdLst']['p:sldId']).length, 7);
assert.equal(Object.keys(parts).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length, 7);
const size = {width: Number(presentation['p:sldSz'].cx), height: Number(presentation['p:sldSz'].cy)};
assert.deepEqual(size, manifest.slideSizeEmu);
assert.deepEqual(Object.keys(parts).filter(name => /^ppt\/fonts\//.test(name)), []);
assert.equal(manifest.embeddedFontPrograms, false);

for (const slide of manifest.slides) {
  assert.equal(slide.part, `ppt/slides/slide${slide.number}.xml`);
  const shapes = array(xml(slide.part)['p:sld']['p:cSld']['p:spTree']['p:sp']).filter(shape => shape['p:txBody']);
  const observed = shapes.map(shape => {
    const identity = shape['p:nvSpPr']['p:cNvPr'];
    const body = shape['p:txBody'];
    const paragraphs = array(body['a:p']);
    const runs = paragraphs.flatMap(paragraph => array(paragraph['a:r']));
    const transform = shape['p:spPr']['a:xfrm'];
    return {
      id: identity.id, name: identity.name,
      paragraphs: paragraphs.map(paragraph => array(paragraph['a:r']).map(run => run['a:t'] ?? '').join('')),
      explicitBreaks: paragraphs.reduce((count, paragraph) => count + array(paragraph['a:br']).length, 0),
      latinTypefaces: unique(runs.map(run => run['a:rPr']['a:latin'].typeface)),
      fontSizesHundredthsPt: unique(runs.map(run => Number(run['a:rPr'].sz))),
      wrap: body['a:bodyPr'].wrap,
      boxEmu: {x: Number(transform['a:off'].x), y: Number(transform['a:off'].y), width: Number(transform['a:ext'].cx), height: Number(transform['a:ext'].cy)},
    };
  });
  assert.deepEqual(observed, slide.textShapes, `Slide ${slide.number}: exact source line boxes, spaces, fonts and sizes`);
  for (const shape of observed) {
    const box = shape.boxEmu;
    assert.ok(Object.values(box).every(Number.isSafeInteger));
    assert.ok(box.x >= 0 && box.y >= 0 && box.width > 0 && box.height > 0);
    assert.ok(box.x + box.width <= size.width && box.y + box.height <= size.height, `${shape.name}: source box outside slide`);
  }
}
console.log('Retained llmreference fixture: exact bytes, seven slides, source text/font/line-box facts verified; native appearance untested by this check.');
