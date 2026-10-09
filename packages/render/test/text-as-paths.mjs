// RR-64: `textAsPaths: true` draws every <text> as glyph outlines (<use> of outlines kept once per slide in <defs>), so the SVG
// needs no font. Checked here: the option contract, the markup (no <text>, no @font-face, content-addressed glyph ids, byte
// stability), the trace and labels an editor and assistive technology read, links, decorations, empty text, right-to-left text,
// the colour-font fallback, and that resvg draws the outlined SVG like the <text> SVG on a set of core example decks.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { examples } from '@openpresentation/opf/examples';
import { loadFonts } from '../dist/fonts-node.js';
import { OPFRenderError, renderSlideSvg, renderSvg, svgToPng } from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the examples name gallery records)

const fonts = await loadFonts({ pack: 'office', substitutionPolicy: 'visual', scripts: 'all' });
const count = (svg, pattern) => (svg.match(pattern) ?? []).length;
const TEXT = /<text[\s>/]/g;

// The option contract: it needs a handle that can outline, and it is a boolean.
const plain = { name: 'Paths', design: { fontScheme: 'roboto' }, slides: [{ title: 'Quarterly review', text: 'Revenue grew in every region.' }] };
assert.throws(() => renderSlideSvg(plain, 0, { textAsPaths: true }), (error) => error instanceof OPFRenderError && error.code === 'text-as-paths-needs-fonts');
assert.throws(() => renderSlideSvg(plain, 0, { fonts: { textMeasurement: fonts.textMeasurement }, textAsPaths: true }), { code: 'text-as-paths-needs-fonts' });
assert.throws(() => renderSlideSvg(plain, 0, { fonts, textAsPaths: 'yes' }), { code: 'invalid-render-options' });
assert.equal(renderSlideSvg(plain, 0, { fonts, textAsPaths: false }), renderSlideSvg(plain, 0, { fonts }), 'false changes nothing');
assert.equal(typeof fonts.outlines.outlineSlideText, 'function', 'the Node handle carries the outline engine');

// The markup: no text and no face, every glyph a <use> of an outline defined once, byte-stable, the same from both entry points.
const rich = { name: 'Rich', design: { fontScheme: 'roboto' }, slides: [{ title: 'Quarterly review', text: [{ text: 'Revenue grew in ' }, { text: 'every', bold: true }, { text: ' region, ' }, { text: 'see link', link: 'https://example.com' }, { text: ' and ' }, { text: 'italic', italic: true }, { text: ' and ' }, { text: 'struck', strikethrough: true }] }] };
const text = renderSlideSvg(rich, 0, { fonts });
const paths = renderSlideSvg(rich, 0, { fonts, textAsPaths: true });
assert.equal(count(paths, TEXT), 0, 'no <text> is left');
assert.doesNotMatch(paths, /@font-face/, 'nothing is embedded');
assert.match(paths, /^<svg[^>]*>\n<defs><path id="opf-g-[0-9A-F]{12}-\d+" d="m/, 'the outlines come first, in <defs>, under content-addressed ids');
const ids = [...paths.matchAll(/<path id="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'each outline is defined once');
for (const [, id] of paths.matchAll(/<use href="#([^"]+)"/g)) assert.ok(ids.includes(id), `${id} is defined`);
assert.equal(renderSlideSvg(rich, 0, { fonts, textAsPaths: true }), paths, 'byte-stable');
assert.equal(renderSvg(rich, { fonts, textAsPaths: true })[0], paths, 'renderSvg draws the same slide');
assert.ok(paths.length < 40_000 && paths.length * 10 < text.length, `outlined ${paths.length} bytes against ${text.length} with embedded faces`);
// Everything outside the <text> elements is the renderer's own markup, byte for byte; ancestors' attributes style the text.
{
  const rect = '<rect x="0" y="0" width="10" height="10" fill="#123456"/>';
  const before = '<g data-x="1" font-family="Roboto" font-size="20" fill="#FF0000"><circle r="2"/>', after = '<path d="M0 0L1 1"/></g>';
  const { content, defs } = fonts.outlines.outlineSlideText([rect, `${before}<text x="5" y="30">Hi</text>${after}`], { fail: (code, message) => new Error(message) });
  assert.equal(content[0], rect, 'markup without text is untouched');
  assert.ok(content[1].startsWith(before) && content[1].endsWith(after), 'only the <text> element is replaced');
  assert.match(content[1], /<g role="img" aria-label="Hi"><g fill="#FF0000"><g transform="matrix\(0\.00976563 0 0 -0\.00976563 5 30\)"><use href="#opf-g-[0-9A-F]{12}-\d+"\/><use href="#opf-g-[0-9A-F]{12}-\d+" x="[\d.]+"\/><\/g><\/g><\/g>/, 'Roboto 20 px (2048 units) inherited from the group, in its fill');
  assert.equal(count(defs, /<path id=/g), 2);
}

// Links stay links around their glyphs; underline and line-through are rectangles in the text colour.
assert.match(paths, /<a href="https:\/\/example\.com"[^>]*><g [^>]*aria-label="see link"><g fill="#FFFFFF"><g transform="matrix\([^)]*\)">(<use [^>]*>)+<\/g><rect [^>]*stroke="none"\/><\/g><\/g><\/a>/);
assert.equal(count(paths, /<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="[\d.]+" stroke="none"\/>/g), 2, 'the link underline and the line-through');

// The trace an editor reads stays on the groups, and each outlined element is labelled with its text; aria-hidden text stays hidden.
const traced = { name: 'Traced', design: { fontScheme: 'roboto' }, slides: [{ title: 'Review', text: 'Plain words', items: ['One', 'Two'] }] };
const tracedText = renderSlideSvg(traced, 0, { fonts, trace: true }), tracedPaths = renderSlideSvg(traced, 0, { fonts, trace: true, textAsPaths: true });
const traceOf = (svg) => [...svg.matchAll(/data-opf-(?:text-start|text-end|source-start|source-end|path)="[^"]*"/g)].map((match) => match[0]);
assert.deepEqual(traceOf(tracedPaths), traceOf(tracedText), 'every data-opf trace attribute is kept, in order');
assert.deepEqual([...tracedPaths.matchAll(/aria-label="([^"]*)"/g)].map((match) => match[1]), ['Review', 'Review', 'Plain words', 'One', 'Two'], 'the slide label, then one label per text');
assert.equal(count(tracedPaths, /<g aria-hidden="true" fill="#FFFFFF"><g fill/g), 2, 'the two bullets stay hidden and unlabelled');

// An empty <text/> (an empty table cell) becomes an empty group.
const table = examples.find((example) => example.file.endsWith('table-cell-types.opf.json')).deck;
const tableSvg = renderSlideSvg(table, 0, { fonts, textAsPaths: true });
assert.equal(count(tableSvg, TEXT), 0, 'empty table cells leave no <text>');

// Right-to-left text: the label is the source text in logical order.
const arabic = { name: 'ar', language: 'ar', design: { fontScheme: 'roboto' }, slides: [{ title: 'التقرير الفصلي', text: 'نما الإيراد في كل منطقة.' }] };
const arabicPaths = renderSlideSvg(arabic, 0, { fonts, textAsPaths: true });
assert.equal(count(arabicPaths, TEXT), 0);
assert.ok(arabicPaths.includes('aria-label="التقرير الفصلي"') && arabicPaths.includes('aria-label="نما الإيراد في كل منطقة."'), 'labels in logical order');

// A colour font has no plain outlines: that text stays text, is reported, and only its faces are embedded.
const emoji = { name: 'Emoji', design: { fontScheme: 'roboto' }, slides: [{ title: 'Launch 🚀 day', text: 'Plain text only' }] };
const diagnostics = [];
const emojiPaths = renderSlideSvg(emoji, 0, { fonts, textAsPaths: true, onDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });
assert.equal(count(emojiPaths, TEXT), 1, 'the title with the emoji stays text');
assert.ok(emojiPaths.includes('aria-label="Plain text only"'), 'the body is outlined');
assert.deepEqual(diagnostics.filter((diagnostic) => diagnostic.code === 'text-as-paths-kept-text').map((diagnostic) => diagnostic.fontFamily), ['noto color emoji']);

// resvg draws the outlined SVG like the <text> SVG: core example decks, every slide.
const decks = examples.filter((example, index) => index % 12 === 0 || example.file.endsWith('table-cell-types.opf.json'));
let slides = 0, worst = 0, worstKey = '';
for (const { file, deck } of decks) {
  const asText = renderSvg(deck, { fonts }), asPaths = renderSvg(deck, { fonts, textAsPaths: true });
  for (const [index, svg] of asPaths.entries()) {
    assert.equal(count(svg, TEXT), 0, `${file}#${index}: no <text> is left`);
    const [a, b] = await Promise.all([asText[index], svg].map(async (source) => sharp(await svgToPng(source, { fonts, scale: 0.5 })).raw().toBuffer()));
    let sum = 0, strong = 0;
    for (let byte = 0; byte < a.length; byte++) { const delta = Math.abs(a[byte] - b[byte]); sum += delta; if (delta > 64) strong++; }
    const mean = sum / a.length;
    if (mean > worst) { worst = mean; worstKey = `${file}#${index}`; }
    assert.ok(mean < 0.02 && strong === 0, `${file}#${index}: outlined PNG differs from the text PNG (mean ${mean.toFixed(4)}, ${strong} channel values over 64)`);
    slides++;
  }
}
console.log(`Text as paths passed: options, markup, trace, labels, links, decorations, empty text, right-to-left, colour fallback; ${slides} example slides draw like their text (worst mean ${worst.toFixed(4)} at ${worstKey}).`);
