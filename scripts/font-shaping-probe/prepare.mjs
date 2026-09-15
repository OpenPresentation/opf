import {createRequire} from 'node:module';
import {readFile, writeFile, readdir, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {json} from './json.mjs';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../../../opf-render/package.json', import.meta.url));
const {create} = require('fontkit');
const [fontRoot, root] = process.argv.slice(2);
if (!fontRoot || !root) throw new Error('Usage: node prepare.mjs FONT_DIRECTORY NEW_OUTPUT_DIRECTORY');
await mkdir(root);
const prior = JSON.parse(await readFile(new URL('../../docs/evidence/akasia-assessment/open-fonts-node24.json', import.meta.url), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const faces = [], samples = [];
for (const file of (await readdir(fontRoot)).filter(file => file.endsWith('.ttf')).sort()) {
  const bytes = await readFile(`${fontRoot}/${file}`), font = create(bytes);
  const record = prior.records.find(record => record.file === file);
  if (!record || record.sha256 !== hash(bytes)) throw new Error(`Unexpected font: ${file}`);
  const id = `Probe${faces.length}`;
  faces.push({id, file, sha256: hash(bytes), weight: record.weight, italic: record.italic, unitsPerEm: font.unitsPerEm});
  for (const cp of font.characterSet) {
    const composed = String.fromCodePoint(cp), decomposed = composed.normalize('NFD');
    if (composed === decomposed || ![...decomposed].every(c => font.hasGlyphForCodePoint(c.codePointAt(0)))) continue;
    for (const [form, text] of [['composed', composed], ['decomposed', decomposed]]) {
      const run = font.layout(text), glyphs = run.glyphs.map((glyph, index) => ({id: glyph.id, name: glyph.name, ...run.positions[index]}));
      samples.push({id: `${id}-${cp}-${form}`, face: id, cp, form, text, codepoints: [...text].map(c => c.codePointAt(0)), script: run.script, glyphs, fontkitAt32: run.advanceWidth * 32 / font.unitsPerEm});
    }
  }
}
assert.equal(faces.length, prior.records.length, 'Every reviewed face must be supplied.');
const fontkitVersion = JSON.parse(await readFile(new URL('../../../opf-render/node_modules/fontkit/package.json', import.meta.url), 'utf8')).version;
await writeFile(`${root}/fontkit-matrix.json`, json({node: process.version, fontkit: fontkitVersion, faces, samples}));
console.log(`Recorded ${samples.length} canonical-form specimens across ${faces.length} hash-verified open faces.`);
