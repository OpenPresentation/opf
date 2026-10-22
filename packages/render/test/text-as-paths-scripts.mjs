// RR-64 phase 2: outlined text is shaped by HarfBuzz, the browser's shaper. Checked here over the 30 script corpora: every drawn
// glyph of an outlined sample has HarfBuzz's glyph id and pen position (an independent harfbuzzjs shaping of the same text, face
// and language); fontkit, which the layout measures with, differs on several of them (so shaping with it would not draw what the
// browser draws); a run with no pinned width whose HarfBuzz and fontkit advances differ stays text; and text in a face whose fsType
// restricts embedding stays text. Both fallbacks are reported as `text-as-paths-fallback` with their reason.
import assert from 'node:assert/strict';
import * as hb from 'harfbuzzjs';
import { loadCorpora, loadFaces } from '../scripts/script-corpora.mjs';
import { loadFonts } from '../dist/fonts-node.js';
import { FontLibrary, shape } from '../dist/pdf-fonts.js';
import { openTypeLanguage } from '../dist/script-fonts.js';

const fonts = await loadFonts({ pack: 'office', scripts: 'all' });
const corpora = await loadCorpora();
const { faces } = await loadFaces();
const fontkitLibrary = new FontLibrary({});
const SIZE = 25;
const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const outline = (family, text, lang, rtl, extra = '') => {
  const diagnostics = [];
  const { content } = fonts.outlines.outlineSlideText([`<text x="10" y="50" font-family="${family}" font-size="${SIZE}"${lang ? ` lang="${lang}"` : ''}${rtl ? ' direction="rtl"' : ''} xml:space="preserve"${extra}>${escape(text)}</text>`], { fail: (code, message) => new Error(message), report: (diagnostic) => diagnostics.push(diagnostic) });
  return { markup: content[0], diagnostics };
};
// The drawn glyphs of an outlined element, left to right: gid and position in pixels (each run's transform plus its <use> offsets).
const drawn = (markup) => {
  const glyphs = [];
  for (const [, a, d, e, f, uses] of markup.matchAll(/<g transform="matrix\((-?[\d.e-]+) 0 0 (-?[\d.e-]+) (-?[\d.]+) (-?[\d.]+)\)">((?:<use [^>]*\/>)+)<\/g>/g)) {
    for (const [, gid, x = '0', y = '0'] of uses.matchAll(/<use href="#opf-g-[0-9A-F]+-(\d+)"(?: x="(-?[\d.]+)")?(?: y="(-?[\d.]+)")?\/>/g)) glyphs.push([Number(gid), Number(e) + Number(a) * Number(x), Number(f) + Number(d) * Number(y)]);
  }
  return relative(glyphs);
};
// Positions relative to the leftmost glyph, rounded to a hundredth of a pixel, in left-to-right order.
const relative = (glyphs) => { const left = Math.min(...glyphs.map(([, x]) => x)); return glyphs.map(([gid, x, y]) => [gid, Math.round((x - left) * 100) / 100, Math.round(y * 100) / 100]).sort((p, q) => p[1] - q[1] || p[0] - q[0]); };
const reference = (face, text, lang, rtl) => {
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.setDirection(rtl ? 'rtl' : 'ltr');
  buffer.guessSegmentProperties();
  if (lang) buffer.setLanguage(lang);
  hb.shape(face.hbFont, buffer);
  const infos = buffer.getGlyphInfos(), positions = buffer.getGlyphPositions();
  let pen = 0;
  const scale = SIZE / face.font.unitsPerEm;
  const glyphs = relative(infos.map((info, index) => { const glyph = [info.codepoint, 10 + (pen + positions[index].xOffset) * scale, 50 - positions[index].yOffset * scale]; pen += positions[index].xAdvance; return glyph; })
    .filter(([gid]) => face.font.getGlyph(gid).path.commands.length > 0));
  // The width the renderer pins every line to (textLength): here HarfBuzz's own advance, so nothing is scaled.
  glyphs.width = pen * scale;
  return glyphs;
};

let compared = 0, skipped = 0, divergent = 0;
const divergentSamples = [];
for (const group of corpora.groups ?? corpora) {
  const face = faces.find((candidate) => candidate.scripts.includes(group.script) && candidate.weight === 400 && !candidate.italic);
  if (!face) continue;
  const rtl = group.direction === 'rtl';
  for (const sample of group.samples) {
    const expected = reference(face, sample.text, sample.lang, rtl);
    // A whole-buffer reference fits one run: skip text mixing directions (Latin, or digits, which bidi lays out left to right), and text the face cannot draw entirely (another face
    // would draw part of it).
    if ((rtl && /[A-Za-z0-9٠-٩۰-۹]/.test(sample.text)) || [...sample.text].some((character) => /\S/.test(character) && !face.font.hasGlyphForCodePoint(character.codePointAt(0)))) { skipped++; continue; }
    const { markup } = outline(face.family, sample.text, sample.lang, rtl, ` textLength="${expected.width.toFixed(6)}" lengthAdjust="spacingAndGlyphs"`);
    const actual = drawn(markup);
    assert.deepEqual(actual.map(([gid]) => gid), expected.map(([gid]) => gid), `${group.script} ${sample.id}: the outlines are HarfBuzz's glyphs`);
    for (const [index, [, x, y]] of actual.entries()) assert.ok(Math.abs(x - expected[index][1]) <= 0.02 && Math.abs(y - expected[index][2]) <= 0.02, `${group.script} ${sample.id}: glyph ${index} at ${x},${y} against HarfBuzz ${expected[index][1]},${expected[index][2]}`);
    compared++;
    const libraryFace = fontkitLibrary.addData(new Uint8Array(face.font.stream.buffer), 'corpus', face.family);
    const fontkit = shape(libraryFace, sample.text, { language: openTypeLanguage(sample.lang), direction: rtl ? 'rtl' : 'ltr' });
    const fontkitGlyphs = fontkit.filter((glyph) => face.font.getGlyph(glyph.gid).path.commands.length > 0).map((glyph) => glyph.gid).sort((p, q) => p - q).join();
    if (fontkitGlyphs !== expected.map(([gid]) => gid).sort((p, q) => p - q).join()) { divergent++; divergentSamples.push(`${group.script}/${sample.id}`); }
  }
}
assert.ok(compared >= 120, `${compared} corpus samples compared (${skipped} skipped)`);
assert.ok(divergent >= 5, `fontkit picks other glyphs than HarfBuzz on ${divergent} samples: ${divergentSamples}`);

// A run with no pinned width whose HarfBuzz and fontkit advances differ stays text; with a textLength it is outlined, scaled to it.
{
  const face = faces.find((candidate) => candidate.scripts.includes('Mymr') && candidate.weight === 400);
  const text = corpora.groups.find((group) => group.script === 'Mymr').samples.find((sample) => sample.id === 'mymr-words').text;
  const free = outline(face.family, text, 'my', false);
  assert.match(free.markup, /<text [^>]*textLength="[\d.]+" lengthAdjust="spacingAndGlyphs"[^>]*>/, 'the unpinned Myanmar run stays text, pinned to the measured width');
  assert.deepEqual(free.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.reason]), [['text-as-paths-fallback', 'shaping']]);
  const pinned = outline(face.family, text, 'my', false, ' textLength="420" lengthAdjust="spacingAndGlyphs"');
  assert.ok(/<use href="#opf-g-/.test(pinned.markup) && [...pinned.markup.matchAll(/<text\b[^>]*>/g)].every(([tag]) => / fill="none"/.test(tag)), 'inside a textLength the run is outlined (only the invisible readable line is text)');
  assert.deepEqual(pinned.diagnostics, []);
}

// A face whose fsType restricts embedding is never outlined: its text stays text.
{
  const roboto = fonts.registry.exportFaces().find((face) => face.family === 'Roboto').data;
  const locked = Uint8Array.from(roboto), view = new DataView(locked.buffer);
  for (let index = 0; index < view.getUint16(4); index++) { const at = 12 + index * 16; if (String.fromCharCode(...locked.subarray(at, at + 4)) === 'OS/2') view.setUint16(view.getUint32(at + 8) + 8, 0x0002); }
  const restricted = await loadFonts({ pack: 'base', faces: [{ data: locked, family: 'Locked', weight: 400 }] });
  const diagnostics = [];
  const { content } = restricted.outlines.outlineSlideText(['<text x="10" y="50" font-family="Locked" font-size="25">Private</text>'], { fail: (code, message) => new Error(message), report: (diagnostic) => diagnostics.push(diagnostic) });
  assert.match(content[0], /<text [^>]*font-family="Locked"[^>]*>Private<\/text>/, 'text in a restricted face stays text');
  assert.deepEqual(diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.reason]), [['text-as-paths-fallback', 'restricted']]);
}
console.log(`Text as paths, scripts: ${compared} corpus samples outlined with HarfBuzz's glyphs and positions (${skipped} mixed or multi-face samples skipped); fontkit differs on ${divergent} (${divergentSamples.join(', ')}); unpinned divergent runs and restricted faces stay text.`);
