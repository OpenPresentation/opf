// FF-44 (RR-17): the script corpora through the raster path (resvg-js, which draws PNG and the PDF built from it).
// Each regular-weight sample is drawn twice with resvg from the same pinned face and compared:
//   - reference: HarfBuzz (harfbuzzjs) shapes the text with the sample's language and every glyph is drawn as an SVG path;
//   - resvg: the same text as an ordinary SVG <text> element, which resvg shapes itself.
// Ink width and the mean absolute pixel difference of the two ink boxes say whether resvg's shaping equals HarfBuzz's.
//   - Latin, Cyrillic, Greek, CJK (apart from Korean, whose lang resvg ignores), Arabic and Hebrew letter samples, Armenian, Georgian, Ethiopic,
//     Mongolian, Tibetan, Thaana and Syriac agree (ink width within 2 percent; the largest differences are mark positions in Hebrew niqqud
//     and Nastaliq Pashto letters, 0.6 and 1.6 percent);
//   - resvg-js 2.6.2 (and 2.7.0-alpha.2) mis-shapes the scripts listed in the fixture's `rasterLimits`: a spacing vowel sign or a space after a
//     cluster loses its advance, so letters overlap and words run together. This test records that limit instead of hiding it: each listed
//     script must still deviate (when a resvg release fixes it the test fails and the fixture and docs are updated), and every other script
//     must agree. Browsers draw all of them correctly (test/script-corpora-browser.mjs); the SVG is not affected.
// Right-to-left samples with Latin, digits or punctuation are skipped: HarfBuzz shapes one directional run, not a bidirectional paragraph.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import * as hb from 'harfbuzzjs';
import {svgToPng} from '../dist/index.js';
import {loadCorpora, loadFaces} from '../scripts/script-corpora.mjs';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const corpora = await loadCorpora();
const {faces} = await loadFaces();
const limited = new Set(corpora.rasterLimits.scripts), languageDependent = new Set(corpora.rasterLimits.languageDependent.scripts);
const SIZE = 60, WIDTH = 2400, HEIGHT = 140;
const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function ink(png) {
  const {data, info} = await sharp(png).greyscale().raw().toBuffer({resolveWithObject: true});
  let x0 = info.width, x1 = -1, y0 = info.height, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[y * info.width + x] < 250) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : {left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1};
}
async function crop(png, box, width, height) {
  return sharp(png).extract(box).extend({right: width - box.width, bottom: height - box.height, background: '#fff'}).greyscale().raw().toBuffer();
}
const rows = [];
for (const face of faces) {
  if (face.weight !== 400 || face.italic) continue;
  for (const group of corpora.groups) {
    if (!face.scripts.includes(group.script)) continue;
    for (const sample of group.samples) {
      const rtl = group.direction === 'rtl';
      if (rtl && /[A-Za-z0-9٠-٩۰-۹]|[.,;:!?،؛؟־׳״()—]/u.test(sample.text) && ['bidi-mixed', 'digits', 'punctuation'].includes(sample.category)) continue;
      const buffer = new hb.Buffer();
      buffer.addText(sample.text); buffer.guessSegmentProperties(); if (sample.lang) buffer.setLanguage(sample.lang);
      hb.shape(face.hbFont, buffer);
      const infos = buffer.getGlyphInfos(), positions = buffer.getGlyphPositions(), scale = SIZE / face.hbFace.upem;
      let x = 40, paths = '';
      for (const [index, info] of infos.entries()) {
        const outline = face.hbFont.glyphToPath(info.codepoint);
        if (outline) paths += `<path transform="translate(${(x + positions[index].xOffset * scale).toFixed(3)} ${(100 - positions[index].yOffset * scale).toFixed(3)}) scale(${scale} ${-scale})" d="${outline}"/>`;
        x += positions[index].xAdvance * scale;
      }
      const startX = rtl ? x : 40;
      const reference = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${paths}</g></svg>`;
      const drawn = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"><rect width="100%" height="100%" fill="#fff"/><text x="${startX}" y="100" font-family="${face.family}" font-size="${SIZE}" ${rtl ? 'direction="rtl" ' : ''}xml:lang="${sample.lang}" xml:space="preserve" fill="#000">${escape(sample.text)}</text></svg>`;
      const options = {fontFiles: [face.file], useBundledFonts: false};
      const [a, b] = await Promise.all([svgToPng(reference, options), svgToPng(drawn, options)]);
      const boxA = await ink(a), boxB = await ink(b);
      assert.ok(boxA && boxB, `${face.family} ${sample.id}: both renderings have ink`);
      const width = Math.max(boxA.width, boxB.width), height = Math.max(boxA.height, boxB.height);
      const [pixelsA, pixelsB] = await Promise.all([crop(a, boxA, width, height), crop(b, boxB, width, height)]);
      let sum = 0;
      for (let index = 0; index < pixelsA.length; index++) sum += Math.abs(pixelsA[index] - pixelsB[index]);
      rows.push({family: face.family, script: group.script, id: sample.id, referenceWidth: boxA.width, resvgWidth: boxB.width, ratio: Number((boxB.width / boxA.width).toFixed(4)), meanDiff: Number((sum / pixelsA.length).toFixed(2))});
    }
  }
}
const output = process.argv[2];
if (output) { await mkdir(path.dirname(output), {recursive: true}); await writeFile(output, `${JSON.stringify({rows}, null, 2)}\n`); }

let agreeing = 0, deviating = 0;
for (const script of new Set(rows.map(row => row.script))) {
  const group = rows.filter(row => row.script === script);
  const bad = group.filter(row => Math.abs(row.ratio - 1) > 0.02 || row.meanDiff > 40);
  if (limited.has(script)) {
    assert.ok(bad.length > 0, `${script}: resvg now agrees with HarfBuzz; remove it from rasterLimits.scripts and update the docs`);
    assert.ok(bad.some(row => row.ratio < 0.99), `${script}: the recorded resvg limit (narrower, lost advances) no longer shows`);
    deviating += bad.length;
  } else if (languageDependent.has(script)) {
    assert.ok(group.every(row => row.ratio < 0.999 && row.ratio > 0.97), `${script}: resvg ignores lang, so its Korean advances are slightly narrower`);
    deviating += group.length;
  } else {
    assert.deepEqual(bad, [], `${script}: resvg disagrees with HarfBuzz where it was expected to agree`);
    agreeing += group.length;
  }
}
console.log(`Script corpora raster: ${rows.length} regular-weight samples through resvg; ${agreeing} agree with HarfBuzz (ink width within 2 percent, no glyph out of place), ${deviating} deviate as recorded (${[...limited].join(', ')} shaping; ${[...languageDependent].join(', ')} lang).`);
