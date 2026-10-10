// opf-render#189: the raster path pins each complex-script cluster at the pen of its run shaped as a whole (src/raster-text.js), not at
// the advance of the run's prefix shaped alone. A prefix ends without the context of the next character: a Thai leading vowel kerned
// to its consonant (ไ ด, เ ต) ended 0.25 px wider at 25 px, so the consonant and its tone and vowel marks were drawn off the browser's
// place. Checked against HarfBuzz (harfbuzzjs, the browser's shaper): every pinned cluster of the issue's line and of the Thai, Lao,
// Tamil and Telugu samples that showed it starts at HarfBuzz's pen, and toPng draws those lines like HarfBuzz's own outlines. Also
// (opf-render#125) a pin does not depend on the outlines drawn before it.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import * as hb from 'harfbuzzjs';
import {toPng} from '../dist/index.js';
import {pinScriptClusters} from '../dist/raster-text.js';
import {loadCorpora, loadFaces} from '../scripts/script-corpora.mjs';

const corpora = await loadCorpora();
const {faces} = await loadFaces();
const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const faceOf = script => faces.find(face => face.scripts.includes(script) && face.weight === 400 && !face.italic);
const sample = (script, id) => ({script, ...corpora.groups.find(group => group.script === script).samples.find(item => item.id === id)});
const lines = [
  {script: 'Thai', id: 'issue-189', lang: 'th', text: 'รายได้เติบโตในทุกภูมิภาค'},
  sample('Thai', 'thai-digits'), sample('Laoo', 'laoo-words'), sample('Taml', 'taml-pulli'), sample('Telu', 'telu-zwnj'),
];

// opf-render#125: the raster path's own fontkit faces pin each glyph's code points. Drawing the outline of a Devanagari letter whose
// component is the nukta glyph (ऱ, ऴ, ऩ, क़, ख़ are outlined clusters) cached the nukta with no code points, and a later text with a
// decomposed nukta shaped it as an unknown character with a dotted circle: a pin of that text must equal a fresh process's.
{
  const {execFileSync} = await import('node:child_process');
  const face = faceOf('Deva');
  const svg = text => `<svg><text x="10" y="45" font-family="${face.family}" font-size="25" xml:space="preserve">${text}</text></svg>`;
  const nukta = 'क़ानून ड़र';
  const fresh = execFileSync(process.execPath, ['--input-type=module', '-e', `import {pinScriptClusters} from ${JSON.stringify(new URL('../dist/raster-text.js', import.meta.url).href)}; process.stdout.write(await pinScriptClusters(${JSON.stringify(svg(nukta))}, {fontFiles: [${JSON.stringify(face.file)}]}));`], {encoding: 'utf8'});
  await pinScriptClusters(svg('ऱ ऴ ऩ क़ ख़'), {fontFiles: [face.file]});
  assert.equal(await pinScriptClusters(svg(nukta), {fontFiles: [face.file]}), fresh, 'a nukta after outlined nukta letters pins as in a fresh process');
}

// HarfBuzz's pen at the start of each cluster (UTF-16 offset), and its glyphs as outlines, for `text` at `size` from x = 10.
function harfBuzz(face, text, lang, size, y) {
  const buffer = new hb.Buffer();
  buffer.addText(text); buffer.guessSegmentProperties(); buffer.setLanguage(lang);
  hb.shape(face.hbFont, buffer);
  const infos = buffer.getGlyphInfos(), positions = buffer.getGlyphPositions(), scale = size / face.hbFace.upem;
  const starts = new Map();
  let x = 10, paths = '';
  for (const [index, info] of infos.entries()) {
    if (!starts.has(info.cluster)) starts.set(info.cluster, x);
    const outline = face.hbFont.glyphToPath(info.codepoint);
    if (outline) paths += `<path transform="translate(${(x + positions[index].xOffset * scale).toFixed(3)} ${(y - positions[index].yOffset * scale).toFixed(3)}) scale(${scale} ${-scale})" d="${outline}"/>`;
    x += positions[index].xAdvance * scale;
  }
  return {starts, paths};
}

for (const size of [25, 60]) {
  const width = size * 30, height = Math.round(size * 2.4), y = Math.round(size * 1.6);
  for (const line of lines) {
    const face = faceOf(line.script);
    const reference = harfBuzz(face, line.text, line.lang, size, y);
    const label = `${line.script} ${line.id} at ${size} px`;
    // Thai and Lao clusters are graphemes, HarfBuzz's clusters: each pinned piece starts at HarfBuzz's pen for its first character.
    if (line.script === 'Thai' || line.script === 'Laoo') {
      const pinned = await pinScriptClusters(`<svg><text x="10" y="${y}" font-family="${face.family}" font-size="${size}" lang="${line.lang}" xml:space="preserve">${escape(line.text)}</text></svg>`, {fontFiles: [face.file]});
      let offset = 0, checked = 0;
      for (const [, x, piece] of pinned.matchAll(/<text x="(-?[\d.]+)" [^>]*>([^<]*)<\/text>/g)) {
        const expected = reference.starts.get(offset);
        if (expected !== undefined) { assert.ok(Math.abs(Number(x) - expected) <= 0.01, `${label}: the cluster ${JSON.stringify(piece)} at ${x}, HarfBuzz ${expected.toFixed(3)}`); checked++; }
        offset += piece.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').length;
      }
      assert.equal(offset, line.text.length, `${label}: the pieces are the line`);
      assert.ok(checked >= 8, `${label}: ${checked} clusters checked`);
    }
    // The raster draws the line as HarfBuzz's outlines through the same resvg: no channel off by more than 64, mean under 0.01.
    const options = {fonts: {fontFiles: [face.file], useBundledFonts: false}};
    const [drawn, outlines] = await Promise.all([
      toPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><text x="10" y="${y}" font-family="${face.family}" font-size="${size}" lang="${line.lang}" xml:space="preserve" fill="#000">${escape(line.text)}</text></svg>`, options),
      toPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${reference.paths}</g></svg>`, options),
    ]);
    const [a, b] = await Promise.all([sharp(drawn).greyscale().raw().toBuffer(), sharp(outlines).greyscale().raw().toBuffer()]);
    let sum = 0, large = 0;
    for (let index = 0; index < a.length; index++) { const difference = Math.abs(a[index] - b[index]); sum += difference; if (difference > 64) large++; }
    assert.ok(large === 0 && sum / a.length < 0.01, `${label}: the raster is HarfBuzz's (${large} values off by more than 64, mean ${(sum / a.length).toFixed(4)})`);
  }
}
console.log(`Raster cluster context: ${lines.length} lines at 25 and 60 px pinned at HarfBuzz's pens and drawn like HarfBuzz's outlines; a nukta pins alike after outlined nukta letters.`);
