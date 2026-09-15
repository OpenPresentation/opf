import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fitText} from '../../packages/javascript/dist/composition.js';
import {createProbeShaper, engineVersion} from './model.mjs';
import {json} from './json.mjs';
const require = createRequire(new URL('../../../opf-render/package.json', import.meta.url));
const {create} = require('fontkit');
const [fontRoot, root] = process.argv.slice(2);
if (!fontRoot || !root) throw new Error('Usage: node shape-js.mjs FONT_DIRECTORY OUTPUT_DIRECTORY');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceBytes = await readFile(path.join(root, 'fontkit-matrix.json'));
const source = JSON.parse(sourceBytes), fonts = new Map();
for (const face of source.faces) {
  const bytes = await readFile(path.join(fontRoot, face.file));
  assert.equal(hash(bytes), face.sha256);
  fonts.set(face.id, {probe: createProbeShaper(bytes), fontkit: create(bytes), face});
}
const results = source.samples.map(item => {
  const run = fonts.get(item.face).probe.shape(item.text);
  return {id: item.id, ...run, harfbuzzAt32: run.width * 32};
});
const definitions = [
  {id: 'underestimated-greek', file: 'Akasia-BlackItalic.ttf', text: 'ω\u0301'.repeat(10), width: 250},
  {id: 'overestimated-greek', file: 'Akasia-Black.ttf', text: 'Ι\u0301'.repeat(10), width: 120},
  {id: 'source-boundaries', file: 'Akasia-BlackItalic.ttf', text: '  o\u0302\u0301\tω\u0301 ω\u0301\r\n\rU\u031b  \n', width: 120},
];
const fits = definitions.map(item => {
  const {probe, fontkit, face} = [...fonts.values()].find(value => value.face.file === item.file);
  const box = {x: 0, y: 0, width: item.width, height: 1000};
  const before = fitText(item.text, box, 32, 32, (text, size) => fontkit.layout(text).advanceWidth * size / fontkit.unitsPerEm);
  const after = fitText(item.text, box, 32, 32, (text, size) => probe.shape(text).width * size);
  for (const fit of [before, after]) {
    assert.equal(fit.fontSize, 32);
    assert.equal(fit.sourceLines.map(line => item.text.slice(line.start, line.nextStart)).join(''), item.text);
    const boundaries = new Set([0, item.text.length, ...[...new Intl.Segmenter('und', {granularity:'grapheme'}).segment(item.text)].map(segment => segment.index)]);
    for (const line of fit.sourceLines) for (const offset of [line.start, line.end, line.nextStart]) assert.ok(boundaries.has(offset));
  }
  return {...item, face: face.id, box, before, after};
});
const probe = fonts.get('Probe0').probe;
const mappingText = 'A😀o\u0302\u0301Z';
const mapping = probe.shape(mappingText);
assert.deepEqual([...new Set(mapping.glyphs.map(glyph => glyph.cluster))], [0, 1, 3, 6]);
assert.ok(mapping.glyphs.some(glyph => glyph.id === 0)); // Explicit missing-glyph control, not coverage acceptance.
assert.throws(() => probe.shape('\ud800'), TypeError);
const independent = JSON.parse(await readFile(path.join(root, 'harfbuzz-matrix.json'), 'utf8'));
assert.equal(independent.sourceSha256, hash(sourceBytes));
for (const [index, item] of results.entries()) {
  assert.equal(item.id, independent.results[index].id);
  assert.equal(item.harfbuzzAt32, independent.results[index].harfbuzzAt32);
  assert.deepEqual(item.glyphs, independent.results[index].glyphs);
}
const report = {node: process.version, binding: 'harfbuzzjs@1.6.1', harfbuzz: engineVersion, sourceSha256: hash(sourceBytes),
  results, fits, mappingControl: {text: mappingText, ...mapping, scope: 'UTF-16 cluster offsets only; emoji is deliberately missing.'}};
await writeFile(path.join(root, 'javascript-matrix.json'), json(report));
console.log(JSON.stringify({cases: results.length, harfbuzz: engineVersion, independentGlyphRunsMatch: true,
  fits: fits.map(item => ({id:item.id, before:item.before.lines.length, after:item.after.lines.length}))}, null, 2));
