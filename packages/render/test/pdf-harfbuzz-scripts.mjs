// opf-render#188: the vector PDF is shaped by HarfBuzz, the browser's shaper, when the fonts handle carries it (the Node handle
// always). Checked here over the 30 script corpora, as test/text-as-paths-scripts.mjs checks the outlines: each sample is one
// <text> line pinned to HarfBuzz's own width (the renderer pins every line to its measured width), exported with the handle, and
// the PDF's content stream is read back: every glyph it shows has HarfBuzz's glyph id and pen position (an independent harfbuzzjs
// shaping of the same text, face and language), to 0.02 px, and the glyphs it draws as filled outlines (no character of their own)
// are the rest of HarfBuzz's. Without a shaper the PDF keeps fontkit, which draws other glyphs on several samples. Exports are
// deterministic, a Latin-only PDF is the same with HarfBuzz as with fontkit, and the text of a HarfBuzz PDF reads back.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as hb from 'harfbuzzjs';
import { loadCorpora, loadFaces } from '../scripts/script-corpora.mjs';
import { toPdf } from '../dist/index.js';
import { loadFonts } from '../dist/fonts-node.js';
import { FontEmbedder } from '../dist/pdf-fonts.js';
import { openPdf, pageText, pdfiumText, popplerText } from './pdf-helpers.mjs';

const fonts = await loadFonts({ pack: 'office', scripts: 'all' });
const corpora = await loadCorpora();
const { faces } = await loadFaces();
const SIZE = 25;
const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

// The glyph id of every CID the PDF writer hands out, per font resource of the current export, and every glyph it records with
// no character of its own (those it draws as filled outlines, not as text).
let recorded = new Map(), outlinedGlyphs = [];
const record = FontEmbedder.prototype.record;
FontEmbedder.prototype.record = function (entry, glyph) {
  const cid = record.call(this, entry, glyph);
  if (!glyph.codePoints.length) outlinedGlyphs.push(glyph.gid);
  if (!recorded.has(entry.resource)) recorded.set(entry.resource, new Map());
  recorded.get(entry.resource).set(cid, { gid: glyph.gid, upem: entry.face.upem, font: entry.face.font, codePoints: glyph.codePoints });
  return cid;
};

// The glyphs an uncompressed page shows, with their origins in page pixels (user space, y down), from the text operators the
// writer emits (Tf, Tz, Tm, Td, Tj, TJ; widths are the font's own advances, as in the /W array).
function shown(pdf) {
  const text = Buffer.from(pdf).toString('latin1');
  const content = [...text.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(([, body]) => body).find((body) => /(^|\n)BT\n/.test(body) && / Tf\n/.test(body)) ?? '';
  const glyphs = [];
  let font = null, size = 0, scale = 1, line = [0, 0], pen = [0, 0];
  const show = (hex) => {
    for (let index = 0; index < hex.length; index += 4) {
      const glyph = recorded.get(font).get(parseInt(hex.slice(index, index + 4), 16));
      glyphs.push([glyph.gid, pen[0], pen[1], glyph]);
      pen[0] += Math.round(glyph.font.getGlyph(glyph.gid).advanceWidth * 1000 / glyph.upem * 100) / 100 / 1000 * size * scale;
    }
  };
  for (const raw of content.split('\n')) {
    const op = raw.trim();
    let match;
    if ((match = /^\/(F\d+) ([\d.]+) Tf$/.exec(op))) { font = match[1]; size = Number(match[2]); }
    else if ((match = /^([\d.]+) Tz$/.exec(op))) scale = Number(match[1]) / 100;
    else if (op === 'BT') scale = 1;
    else if ((match = /^1 0 0 -1 (-?[\d.]+) (-?[\d.]+) Tm$/.exec(op))) { line = [Number(match[1]), Number(match[2])]; pen = [...line]; }
    else if ((match = /^(-?[\d.]+) (-?[\d.]+) Td$/.exec(op))) { line = [line[0] + Number(match[1]), line[1] - Number(match[2])]; pen = [...line]; }
    else if ((match = /^<([0-9A-F]+)> Tj$/.exec(op))) show(match[1]);
    else if ((match = /^\[(.*)\] TJ$/.exec(op))) {
      for (const [, hex, number] of match[1].matchAll(/<([0-9A-F]+)>|(-?[\d.]+)/g)) {
        if (hex) show(hex);
        else pen[0] -= Number(number) / 1000 * size * scale;
      }
    }
  }
  return glyphs;
}

// HarfBuzz's glyphs of the whole sample, left to right, at its pen positions from x = 10, y = 50; `width` is its advance.
const reference = (face, text, lang, rtl) => {
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.setDirection(rtl ? 'rtl' : 'ltr');
  buffer.guessSegmentProperties();
  if (lang) buffer.setLanguage(lang);
  hb.shape(face.hbFont, buffer);
  const infos = buffer.getGlyphInfos(), positions = buffer.getGlyphPositions();
  const scale = SIZE / face.font.unitsPerEm;
  let pen = 0;
  // The writer draws a vertical placement of at most 0.03 em on the baseline unless the glyph is also moved more than 0.025 em
  // sideways (a glyph with its own text matrix splits the text for PDF readers); every horizontal placement is drawn.
  const placed = ({ xOffset, yOffset }) => Math.abs(xOffset * scale) > 0.025 * SIZE || Math.abs(yOffset * scale) > 0.03 * SIZE;
  const glyphs = infos.map((info, index) => { const glyph = [info.codepoint, 10 + (pen + positions[index].xOffset) * scale, 50 - (placed(positions[index]) ? positions[index].yOffset * scale : 0)]; pen += positions[index].xAdvance; return glyph; });
  glyphs.width = pen * scale;
  return glyphs;
};
const inked = (font) => ([gid]) => font.getGlyph(gid).path.commands.length > 0;
const order = (glyphs) => [...glyphs].sort((p, q) => p[1] - q[1] || p[0] - q[0]);
const svgOf = (family, text, lang, rtl, width) => `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="100"><text x="10" y="50" font-family="${family}" font-size="${SIZE}"${lang ? ` lang="${lang}"` : ''}${rtl ? ' direction="rtl"' : ''} xml:space="preserve" textLength="${width.toFixed(6)}" lengthAdjust="spacingAndGlyphs">${escape(text)}</text></svg>`;
const plain = { fontFiles: fonts.fontFiles, useBundledFonts: false };

let compared = 0, skipped = 0;
const fontkitDivergent = [];
const changed = [];
for (const group of corpora.groups ?? corpora) {
  const face = faces.find((candidate) => candidate.scripts.includes(group.script) && candidate.weight === 400 && !candidate.italic);
  if (!face) continue;
  const rtl = group.direction === 'rtl';
  for (const sample of group.samples) {
    // As in text-as-paths-scripts.mjs: a whole-buffer reference fits one run, so text mixing directions and text the face cannot
    // draw entirely are skipped.
    if ((rtl && /[A-Za-z0-9٠-٩۰-۹]/.test(sample.text)) || [...sample.text].some((character) => /\S/.test(character) && !face.font.hasGlyphForCodePoint(character.codePointAt(0)))) { skipped++; continue; }
    const expected = reference(face, sample.text, sample.lang, rtl);
    const svg = svgOf(face.family, sample.text, sample.lang, rtl, expected.width);
    recorded = new Map(); outlinedGlyphs = [];
    const pdf = await toPdf(svg, { fonts, compress: false });
    const outlinedHere = outlinedGlyphs.filter((gid) => inked(face.font)([gid])).sort((p, q) => p - q);
    const actual = shown(pdf);
    const label = `${group.script} ${sample.id}`;
    // Each shown glyph is a HarfBuzz glyph of the same id at the same pen position (to 0.02 px); marks share a base's position, so
    // the glyphs are matched, not sorted.
    const want = order(expected.filter(inked(face.font)));
    const got = order(actual.filter(inked(face.font)));
    const unmatched = [...want];
    for (const [gid, x, y] of got) {
      const at = unmatched.findIndex(([candidate, cx, cy]) => candidate === gid && Math.abs(x - cx) <= 0.02 && Math.abs(y - cy) <= 0.02);
      const nearest = unmatched.filter(([candidate]) => candidate === gid).sort((p, q) => Math.abs(p[1] - x) - Math.abs(q[1] - x))[0];
      assert.ok(at >= 0, `${label}: glyph ${gid} at ${x.toFixed(3)},${y.toFixed(3)} is a HarfBuzz glyph at its position${nearest ? ` (nearest: ${nearest[1].toFixed(3)},${nearest[2].toFixed(3)})` : ' (HarfBuzz has no such glyph left)'}`);
      unmatched.splice(at, 1);
    }
    // Glyphs the writer draws as filled outlines (a glyph that carries no character of its own) are not in the text: they are the
    // rest of HarfBuzz's.
    assert.deepEqual(unmatched.map(([gid]) => gid).sort((p, q) => p - q), outlinedHere, `${label}: every HarfBuzz glyph the text does not show is drawn as an outline`);
    // Deterministic bytes; and the fontkit export (no shaper) of the same SVG, to tell which samples change.
    assert.deepEqual(await toPdf(svg, { fonts, compress: false }), pdf, `${label}: repeatable bytes`);
    recorded = new Map(); outlinedGlyphs = [];
    const fontkitPdf = await toPdf(svg, { fonts: plain, compress: false });
    const fontkitGlyphs = [...shown(fontkitPdf).filter(inked(face.font)).map(([gid]) => gid), ...outlinedGlyphs.filter((gid) => inked(face.font)([gid]))].sort((p, q) => p - q).join();
    if (fontkitGlyphs !== want.map(([gid]) => gid).sort((p, q) => p - q).join()) fontkitDivergent.push(`${group.script}/${sample.id}`);
    if (sha(fontkitPdf) !== sha(pdf)) changed.push(`${group.script}/${sample.id}`);
    compared++;
  }
}
assert.ok(compared >= 120, `${compared} corpus samples compared (${skipped} skipped)`);
assert.ok(fontkitDivergent.length >= 5, `fontkit picks other glyphs than HarfBuzz on ${fontkitDivergent.length} samples (the gate tells the shapers apart)`);

// A Latin-only PDF is the same with HarfBuzz as with fontkit (kerning, ligatures, marks).
for (const text of ['Quarterly review: revenue grew 12% year on year.', 'Résumé: naïve façade ﬁnal ﬂow office ﬃ AVATAR Type Wave', 'Café déjà vu é ö — “quoted” text']) {
  for (const family of ['Roboto', 'Carlito', 'Noto Sans']) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="100"><text x="10" y="50" font-family="${family}" font-size="${SIZE}" xml:space="preserve">${escape(text)}</text><text x="10" y="80" font-family="${family}" font-size="18" font-weight="700" xml:space="preserve" textLength="500" lengthAdjust="spacingAndGlyphs">${escape(text)}</text></svg>`;
    assert.equal(sha(await toPdf(svg, { fonts })), sha(await toPdf(svg, { fonts: plain })), `${family}: a Latin PDF is byte-identical with HarfBuzz and with fontkit`);
  }
}
// The text of a HarfBuzz-shaped PDF reads back in logical order, as test/pdf-vector.mjs checks the fontkit PDF: pdf.js, PDFium and,
// when it is installed, poppler. The readers named in `skip` do not read that script from Chromium's own PDF either (PDFium and
// poppler on Thai and Burmese marks, poppler on Gujarati) or ignore /ActualText (pdf.js, which reports a reordered Indic, Khmer or
// Burmese syllable in drawing order: HarfBuzz draws the Burmese medial ra before its consonant, as the browser does).
{
  const rtl = (text) => `⁧${text}⁩`;
  const strip = (text) => text.replace(/[\s​‎‏]/g, '').normalize('NFKC');
  const cases = [
    ['latin ligatures', 'Roboto', 'Résumé: naïve façade ﬁnal ﬂow office ﬃ', 'Résumé: naïve façade final flow office ffi', []],
    ['hebrew', 'Noto Sans Hebrew', rtl('ההכנסות צמחו לעומת השנה שעברה'), 'ההכנסות צמחו לעומת השנה שעברה', []],
    ['arabic', 'Noto Naskh Arabic', rtl('نمت الإيرادات بنسبة مقارنة بالعام الماضي'), 'نمت الإيرادات بنسبة مقارنة بالعام الماضي', []],
    ['arabic lam-alef ligature', 'Noto Naskh Arabic', rtl('لا يوجد الله'), 'لا يوجد الله', []],
    ['syriac', 'Noto Sans Syriac', rtl('ܠܫܢܐ ܣܘܪܝܝܐ'), 'ܠܫܢܐ ܣܘܪܝܝܐ', []],
    ['devanagari', 'Noto Sans Devanagari', 'किताब हिन्दी क्षत्रिय तिमाही', 'किताब हिन्दी क्षत्रिय तिमाही', ['pdfjs']],
    ['bengali', 'Noto Sans Bengali', 'বাংলা ভাষা কিতাব কৌতুক', 'বাংলা ভাষা কিতাব কৌতুক', ['pdfjs']],
    ['tamil', 'Noto Sans Tamil', 'தமிழ் மொழி கொடு சௌ', 'தமிழ் மொழி கொடு சௌ', ['pdfjs']],
    ['telugu', 'Noto Sans Telugu', 'తెలుగు భాష క్ష్మ', 'తెలుగు భాష క్ష్మ', ['pdfjs']],
    ['gujarati', 'Noto Sans Gujarati', 'ગુજરાતી ભાષા કિતાબ', 'ગુજરાતી ભાષા કિતાબ', ['pdfjs', 'poppler']],
    ['khmer', 'Noto Sans Khmer', 'ភាសាខ្មែរ ខ្មែរ', 'ភាសាខ្មែរ ខ្មែរ', ['pdfjs']],
    ['thai', 'Noto Sans Thai', 'ภาษาไทย ที่ปรึกษา น้ำ', 'ภาษาไทย ที่ปรึกษา น้ำ', ['pdfium', 'poppler']],
    ['burmese', 'Noto Sans Myanmar', 'မြန်မာဘာသာ ကျွန်ုပ်', 'မြန်မာဘာသာ ကျွန်ုပ်', ['pdfjs', 'pdfium', 'poppler']],
  ];
  const readers = { pdfjs: async (pdf) => pageText(await openPdf(pdf), 1), pdfium: pdfiumText, poppler: popplerText };
  for (const [name, family, text, expected, skip] of cases) {
    const pdf = await toPdf(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="140"><text x="40" y="90" font-family="${family}" font-size="32" xml:space="preserve">${text}</text></svg>`, { fonts });
    for (const [reader, read] of Object.entries(readers)) {
      if (skip.includes(reader)) continue;
      const got = await read(pdf);
      if (got !== null) assert.equal(strip(got), strip(expected), `${name}: ${reader} reads "${got}" from the HarfBuzz PDF, expected "${expected}"`);
    }
  }
}
console.log(`PDF shaping, scripts: ${compared} corpus samples drawn with HarfBuzz's glyphs and positions (${skipped} mixed or multi-face samples skipped); fontkit draws other glyphs on ${fontkitDivergent.length} (${fontkitDivergent.join(', ')}); the HarfBuzz PDF differs from the fontkit PDF on ${changed.length} (${changed.join(', ')}); Latin PDFs are byte-identical; the text reads back in pdf.js, PDFium and poppler.`);
