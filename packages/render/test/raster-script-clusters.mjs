// RR-17 (FF-44): the raster path draws complex scripts cluster by cluster (src/raster-text.js). Covers the cluster segmentation, the
// rewrite of hand-written SVG text (outlines for Devanagari, pinned clusters for Thai, text-anchor middle and end, textLength, nested
// and positioned tspans, whitespace collapsing, what is left alone), real renderSvg output through svgToPng and svgToPdf with
// prepareNodeFonts({pack: 'office', scripts: 'auto', presentation}) for Hindi, Thai, Myanmar, Korean and mixed Latin lines (ink width
// equal to the measured advance, deterministic bytes), and that Latin output is byte-identical to resvg's own.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {renderSvg, svgToPng, svgToPdf} from '../dist/index.js';
import {prepareNodeFonts} from '../dist/fonts-node.js';
import {clusterPieces, pinScriptClusters} from '../dist/raster-text.js';

const pieces = text => clusterPieces(text).map(piece => text.slice(piece.start, piece.end));
const affected = text => clusterPieces(text).map(piece => piece.affected);

// Segmentation: HarfBuzz syllables (graphemes joined across a virama, coeng or Myanmar virama), runs of other text as one piece.
assert.deepEqual(pieces('भाषा कामा'), ['भा', 'षा', ' ', 'का', 'मा']);
assert.deepEqual(pieces('विज्ञान क्षत्रिय'), ['वि', 'ज्ञा', 'न', ' ', 'क्ष', 'त्रि', 'य']);
assert.deepEqual(pieces('कार्य'), ['का', 'र्य'], 'reph stays with its syllable');
assert.deepEqual(pieces('क्‌ष'), ['क्‌', 'ष'], 'ZWNJ after the halant ends the syllable');
assert.deepEqual(pieces('ක්‍ෂ'), ['ක්‍ෂ'], 'Sinhala al-lakuna with ZWJ joins');
assert.deepEqual(pieces('ក្រុម ស្រី'), ['ក្រុ', 'ម', ' ', 'ស្រី'], 'Khmer coeng joins');
assert.deepEqual(pieces('မြန်မာ မင်္ဂလာ ကျေးဇူး'), ['မြ', 'န်', 'မာ', ' ', 'မ', 'င်္ဂ', 'လာ', ' ', 'ကျေး', 'ဇူး'], 'Myanmar vowel sign aa, visarga and kinzi join');
assert.deepEqual(pieces('สำนักงาน คำสั่ง'), ['สำ', 'นั', 'ก', 'ง', 'า', 'น', ' ', 'คำ', 'สั่', 'ง'], 'Thai sara am and tone marks stay with the consonant, sara aa is its own cluster');
assert.deepEqual(pieces('கொ கை'), ['கொ', ' ', 'கை'], 'Tamil split vowels stay with the consonant');
assert.deepEqual(pieces('रिपोर्ट Q3 2026 और OPF'), ['रि', 'पो', 'र्ट', ' Q3 2026 ', 'औ', 'र', ' OPF']);
assert.deepEqual(affected('रिपोर्ट Q3'), [true, true, true, false]);
assert.deepEqual(pieces('Quarterly review 2026'), ['Quarterly review 2026'], 'text without an affected script is one piece');
assert.deepEqual(clusterPieces('한글 한', true).map(piece => piece.affected), [true, true, true, true], 'KOR text pins every grapheme');

const hindi = {$schema: 'https://openpresentation.org/schema/opf/v1', name: 'Hindi', language: 'hi', slides: [{title: 'हिन्दी भाषा में तिमाही समीक्षा', text: 'रिपोर्ट Q3 2026 और OPF: विज्ञान क्षत्रिय श्रीमान द्वार'}]};
const {registry, options} = await prepareNodeFonts({pack: 'office', scripts: ['Deva', 'Thai', 'Mymr', 'Kore'], presentation: hindi});
const fontFiles = options.fontFiles;
const measure = (text, size, family, lang) => registry.textMeasurement.measure(text, size, {fontFamily: family, fontWeight: 400, lang});
const svgOf = (body, attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="200" xml:lang="hi"${attrs}><rect width="100%" height="100%" fill="#fff"/>${body}</svg>`;
const firstX = markup => Number(/<path[^>]*transform="translate\(([-\d.]+) |<text x="([-\d.]+)"/.exec(markup).slice(1).find(Boolean));
const pathStarts = markup => [...markup.matchAll(/<path[^>]*transform="translate\(([-\d.]+) ([-\d.]+)\)/g)].map(found => [Number(found[1]), Number(found[2])]);
const textStarts = markup => [...markup.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"/g)].map(found => [Number(found[1]), Number(found[2])]);

// Latin text is left byte-identical, affected scripts become a group of positioned pieces.
{
  const latin = svgOf('<text x="40" y="100" font-family="Roboto" font-size="40" textLength="300" lengthAdjust="spacingAndGlyphs" text-anchor="middle">Quarterly review</text>');
  assert.equal(await pinScriptClusters(latin, {fontFiles}), latin);
  const devanagari = svgOf('<text x="40" y="100" font-family="Noto Sans Devanagari, sans-serif" font-size="40" fill="#123456" data-opf-path="slides.0.title" xml:space="preserve">भाषा कामा</text>');
  const pinned = await pinScriptClusters(devanagari, {fontFiles});
  assert.notEqual(pinned, devanagari);
  assert.match(pinned, /<g font-family="Noto Sans Devanagari, sans-serif" font-size="40" fill="#123456" data-opf-path="slides.0.title" xml:space="preserve">/, 'the group keeps the text attributes minus its position');
  assert.deepEqual(pinned.match(/<text [^>]*>[^<]*<\/text>/g), ['<text x="111.96" y="100" text-anchor="start" xml:space="preserve"> </text>'], 'Devanagari clusters are fontkit outlines; only the space is a text piece');
  const starts = pathStarts(pinned);
  assert.equal(starts.length, 8, `one path per glyph (भ ा ष ा क ा म ा): ${starts.length}`);
  assert.equal(starts[0][0], 40);
  assert.ok(starts.every(([, y]) => y === 100));
  assert.ok(starts.every(([x], index) => index === 0 || x >= starts[index - 1][0]), 'glyphs advance left to right');
  const last = starts.at(-2)[0], expected = 40 + measure('भाषा का', 40, 'Noto Sans Devanagari', 'hi');
  assert.ok(Math.abs(last - expected) < 0.5, `the last syllable starts at the measured prefix: ${last} vs ${expected}`);
  assert.match(pinned, /<\/g><\/svg>$/);
}

// Thai: resvg-shaped clusters, each its own <text> at the measured prefix, spaces and Latin runs pinned after a cluster.
{
  const thai = svgOf('<text x="40" y="100" font-family="Noto Sans Thai, sans-serif" font-size="40" xml:lang="th" xml:space="preserve">สำนักงาน Q3 คำสั่ง</text>');
  const pinned = await pinScriptClusters(thai, {fontFiles});
  assert.doesNotMatch(pinned, /<path/);
  const starts = textStarts(pinned);
  assert.equal(starts.length, pieces('สำนักงาน Q3 คำสั่ง').length);
  assert.equal(starts[0][0], 40);
  assert.ok(starts.every(([x], index) => index === 0 || x > starts[index - 1][0]));
  assert.match(pinned, /<text x="[\d.]+" y="100" text-anchor="start" xml:space="preserve"> Q3 <\/text>/, 'the Latin run is one pinned piece');
  const latinX = Number(/<text x="([\d.]+)" y="100" text-anchor="start" xml:space="preserve"> Q3 /.exec(pinned)[1]);
  assert.ok(Math.abs(latinX - 40 - measure('สำนักงาน', 40, 'Noto Sans Thai', 'th')) < 0.5);
  assert.doesNotMatch(pinned, /textLength|lengthAdjust/);
}

// text-anchor middle and end resolve into absolute starts; textLength scales the positions; nested and positioned tspans keep their place.
{
  const width = measure('भाषा कामा', 40, 'Noto Sans Devanagari', 'hi');
  for (const [anchor, offset] of [['start', 0], ['middle', width / 2], ['end', width]]) {
    const pinned = await pinScriptClusters(svgOf(`<text x="600" y="100" font-family="Noto Sans Devanagari" font-size="40" text-anchor="${anchor}" xml:space="preserve">भाषा कामा</text>`), {fontFiles});
    assert.ok(Math.abs(firstX(pinned) - (600 - offset)) < 0.5, `${anchor}: ${firstX(pinned)} vs ${600 - offset}`);
    assert.doesNotMatch(pinned, /text-anchor="(middle|end)"/);
  }
  const inherited = await pinScriptClusters(svgOf('<g text-anchor="end"><text x="600" y="100" font-family="Noto Sans Devanagari" font-size="40" xml:space="preserve">भाषा कामा</text></g>'), {fontFiles});
  assert.ok(Math.abs(firstX(inherited) - (600 - width)) < 0.5, 'an inherited anchor applies');
  const natural = await pinScriptClusters(svgOf('<text x="40" y="100" font-family="Noto Sans Devanagari" font-size="40" xml:space="preserve">भाषा कामा</text>'), {fontFiles});
  const stretched = await pinScriptClusters(svgOf(`<text x="40" y="100" font-family="Noto Sans Devanagari" font-size="40" textLength="${(width * 2).toFixed(3)}" lengthAdjust="spacingAndGlyphs" xml:space="preserve">भाषा कामा</text>`), {fontFiles});
  const a = pathStarts(natural), b = pathStarts(stretched);
  assert.equal(a.length, b.length);
  assert.ok(a.every(([x], index) => Math.abs((b[index][0] - 40) - 2 * (x - 40)) < 0.01), 'a doubled textLength doubles every advance');
  const nested = await pinScriptClusters(svgOf('<text x="58.6" y="172" fill="#FFFFFF" font-family="Intos, sans-serif" font-size="25" text-anchor="start" xml:space="preserve"><tspan font-family="Noto Sans Devanagari, sans-serif" lengthAdjust="spacingAndGlyphs" textLength="56.475" x="58.6">रिपोर्ट </tspan><tspan fill="#ff0000" lengthAdjust="spacingAndGlyphs" textLength="95.239" x="115.075">Q3 2026 </tspan><tspan font-family="Noto Sans Devanagari, sans-serif" textLength="42.3" x="210.314">और </tspan></text>'), {fontFiles});
  assert.match(nested, /<text x="115.075" y="172" fill="#ff0000" text-anchor="start" xml:space="preserve">Q3 2026 <\/text>/, 'a positioned Latin tspan keeps its x and its own attributes');
  assert.match(nested, /<\/text><path transform="translate\(210.314 172\)/, 'the next positioned run starts at its own x; its fill is the group\'s');
  assert.equal(pathStarts(nested)[0][0], 58.6);
  assert.doesNotMatch(nested, /textLength/);
  const hindiSpanEnd = pathStarts(nested).filter(([x]) => x < 115)[1][0];
  assert.ok(hindiSpanEnd > 58.6 && hindiSpanEnd < 115.075);
}

// Whitespace without xml:space="preserve" collapses as resvg collapses it; baseline-shift moves the pieces; a span's fill paints its outlines.
{
  const pinned = await pinScriptClusters(svgOf('<text x="40" y="100" font-family="Noto Sans Devanagari" font-size="40">  भाषा \n  कामा  </text>'), {fontFiles});
  assert.equal(firstX(pinned), 40, 'leading spaces are trimmed');
  assert.equal((pinned.match(/<text /g) ?? []).length, 1, 'one collapsed space between the words');
  assert.match(pinned, /<text x="[\d.]+" y="100" text-anchor="start" xml:space="preserve"> <\/text>/);
  const shifted = await pinScriptClusters(svgOf('<text x="40" y="100" font-family="Noto Sans Devanagari" font-size="40" xml:space="preserve">भाषा<tspan baseline-shift="-12" fill="#00ff00">कामा</tspan></text>'), {fontFiles});
  assert.ok(pathStarts(shifted).some(([, y]) => y === 112) && pathStarts(shifted).some(([, y]) => y === 100));
  assert.match(shifted, /<path fill="#00ff00" transform="translate\([\d.]+ 112\)/);
}

// What the rewrite leaves to resvg: right-to-left content, letter-spacing, per-character x lists, dx/dy, textPath, relative units.
for (const body of [
  '<text x="40" y="100" font-family="Noto Sans Devanagari" font-size="40" direction="rtl">भाषा</text>',
  '<text x="40" y="100" font-family="Noto Sans Devanagari" font-size="40">⁧עברית⁩ भाषा</text>',
  '<text x="40" y="100" font-family="Noto Sans Devanagari" font-size="40" letter-spacing="2">भाषा</text>',
  '<text x="40 80 120" y="100" font-family="Noto Sans Devanagari" font-size="40">भाषा</text>',
  '<text x="40" y="100" dx="5" font-family="Noto Sans Devanagari" font-size="40">भाषा</text>',
  '<text x="40" y="100" font-family="Noto Sans Devanagari" font-size="2em">भाषा</text>',
  '<text x="40" y="100" font-family="Noto Sans Devanagari" font-size="40"><textPath href="#p">भाषा</textPath></text>',
  '<text x="40" y="100" font-family="No Such Family" font-size="40">भाषा</text>',
]) {
  const svg = svgOf(body);
  assert.equal(await pinScriptClusters(svg, {fontFiles}), svg, body);
}

// Real renderer output: Hindi, Thai, Myanmar, Korean and a mixed line through svgToPng, each title's ink as wide as its measured advance
// (the SVG's textLength), with byte-identical repeated rasters; and the raster PDF.
async function inkWidth(png, box) {
  const {data, info} = await sharp(png).extract(box).greyscale().raw().toBuffer({resolveWithObject: true});
  let x0 = info.width, x1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (Math.abs(data[y * info.width + x] - data[0]) > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  return x1 < 0 ? 0 : x1 - x0 + 1;
}
const decks = [
  ['hi', 'हिन्दी भाषा में तिमाही समीक्षा', 'सिद्धि और वृद्धि: रिपोर्ट Q3 2026 और OPF'],
  ['th', 'สำนักงาน คำสั่ง น้ำใจ', 'รายงาน Q3 2026 ของ OPF'],
  ['my', 'မြန်မာဘာသာ မင်္ဂလာပါ', 'ပြည်ထောင်စု မြန်မာနိုင်ငံ'],
  ['ko', '분기별 검토: 매출이 전년 대비', '2026년 Q3 보고서 (OPF)'],
  ['km', 'ភាសាខ្មែរពិតជាស្រស់ស្អាត', 'ក្រុម ស្រី ខ្ញុំ'],
];
for (const [language, title, text] of decks) {
  const presentation = {$schema: 'https://openpresentation.org/schema/opf/v1', name: `Raster ${language}`, language, slides: [{title, text}]};
  const prepared = await prepareNodeFonts({pack: 'office', scripts: 'auto', presentation});
  const svg = renderSvg(presentation, {...prepared.options, trace: true});
  const png = await svgToPng(svg, prepared.options);
  assert.deepEqual(png, await svgToPng(svg, prepared.options), `${language}: deterministic raster`);
  for (const path of ['slides.0.title', 'slides.0.text']) {
    const group = new RegExp(`<g data-opf-box-height="([\\d.]+)" data-opf-box-width="([\\d.]+)" data-opf-box-x="([\\d.]+)" data-opf-box-y="([\\d.]+)" data-opf-path="${path.replace('.', '\\.')}"`).exec(svg);
    assert.ok(group, `${language}: ${path} box`);
    const [, height, width, x, y] = group.slice(0).map(Number);
    const line = new RegExp(`<text[^>]*data-opf-path="${path.replace('.', '\\.')}"[^>]*>([\\s\\S]*?)</text>`).exec(svg);
    const spans = [...line[0].matchAll(/<tspan[^>]*textLength="([\d.]+)"[^>]*x="([\d.]+)"/g)].map(found => ({length: Number(found[1]), x: Number(found[2])}));
    const own = /textLength="([\d.]+)"/.exec(line[0].slice(0, line[0].indexOf('>')));
    const measured = own ? Number(own[1]) : spans.at(-1).x + spans.at(-1).length - spans[0].x;
    const ink = await inkWidth(png, {left: Math.floor(x), top: Math.floor(y), width: Math.ceil(width), height: Math.ceil(height)});
    // Ink and advance differ by the side bearings of the first and last glyph (a few px at 25 px); the resvg limit lost 15 to 40 percent.
    assert.ok(Math.abs(ink - measured) / measured < 0.05, `${language} ${path}: ink ${ink} px against the measured advance ${measured} px`);
  }
  const pdf = await svgToPdf(svg, prepared.options);
  assert.ok(pdf.length > 1000 && Buffer.from(pdf.subarray(0, 5)).toString() === '%PDF-');
  assert.deepEqual(pdf, await svgToPdf(svg, prepared.options), `${language}: deterministic PDF`);
}

// A Latin deck's raster input is exactly the SVG resvg always drew.
{
  const presentation = {$schema: 'https://openpresentation.org/schema/opf/v1', name: 'Latin', language: 'en', slides: [{title: 'Quarterly review', text: 'Office affluent fi fl ffi ffl first flow'}]};
  const prepared = await prepareNodeFonts({pack: 'office', scripts: 'auto', presentation});
  const svg = renderSvg(presentation, prepared.options);
  assert.equal(await pinScriptClusters(svg, {fontFiles: prepared.options.fontFiles}), svg);
  assert.deepEqual(await svgToPng(svg, {...prepared.options, scale: 0.25}), await svgToPng(svg, {...prepared.options, scale: 0.25}));
}
console.log('Raster script clusters: segmentation, rewrite, five languages through renderSvg + svgToPng + svgToPdf, Latin untouched.');
