// LH-106: the PowerPoint export draws every number OPF generates as PowerPoint will draw it. Text OPF writes (metrics, tables) is in
// the language's digits; a native chart's number formats carry PowerPoint's numeral-shape prefix ([$-2000000] Arabic-Indic, [$-3000000]
// Persian), so PowerPoint draws the same digits; an auto-numbered list uses the language's digits only with PowerPoint's Hindi schemes;
// slide numbers stay Latin (PowerPoint's live field). `lang` drops the -u-nu- extension, the export never fails on generated digits, and
// import brings the numbers, the chart formats and the author's language tag back.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {fromPptx, toPptx} from '../dist/index.js';
import {shapeChartNumbers, stripNumeralShape} from '../dist/numeral-shapes.js';

const VALUES = [7, 999, 1000, 1234567.891];
const deck = (language, title = 'T') => ({
  language,
  design: {footer: {end: {text: '{{slide.number}} / {{deck.slideCount}}'}}},
  slides: [
    ...VALUES.map(value => ({title, metric: {value, label: 'L'}})),
    {title, table: {columns: ['A', {name: 'B', format: '#,##0.00'}], rows: VALUES.map(value => [value, value])}},
    {title, items: ['one', 'two', 'three'], numbering: 'arabic'},
    {title, items: ['one', 'two', 'three'], numbering: {style: 'arabic', suffix: 'paren-both'}},
    {title, chart: {type: 'column', alt: 'Values', data: {columns: ['C', {name: 'V', format: '#,##0.00'}], rows: [['a', 7], ['b', 4500]]}, dataLabels: true}},
    {title, chart: {type: 'pie', alt: 'Shares', data: {columns: ['C', 'V'], rows: [['a', 1], ['b', 3]]}, dataLabels: {content: ['percent']}}},
  ],
});
const exported = async document => {
  const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: document});
  try { return {fonts: fonts.registry.scriptSelection, bytes: await toPptx(document, {fonts})}; } finally { fonts.dispose?.(); }
};
const files = bytes => unzipSync(new Uint8Array(bytes));
const slideXml = (bytes, number) => strFromU8(files(bytes)[`ppt/slides/slide${number}.xml`]);
const texts = xml => [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]);
const langs = bytes => [...new Set(Object.entries(files(bytes)).filter(([path]) => /^ppt\/(?:slides\/slide|charts\/chart)\d+\.xml$/.test(path)).flatMap(([, data]) => [...strFromU8(data).matchAll(/ lang="([^"]+)"/g)].map(match => match[1])))];
const chartCodes = bytes => Object.entries(files(bytes)).filter(([path]) => /^ppt\/charts\/chart\d+\.xml$/.test(path)).flatMap(([, data]) => [...strFromU8(data).matchAll(/formatCode="([^"]*)"|<c:formatCode>([^<]*)<\/c:formatCode>/g)].map(match => match[1] ?? match[2]));

// The prefix is added once, and stripped on import; an LCID-only block stays.
assert.equal(shapeChartNumbers('<c:numFmt formatCode="#,##0" sourceLinked="0"/>', '[$-2000000]'), '<c:numFmt formatCode="[$-2000000]#,##0" sourceLinked="0"/>');
assert.equal(shapeChartNumbers('<c:numFmt formatCode="[$-3000000]0%" sourceLinked="0"/>', '[$-2000000]'), '<c:numFmt formatCode="[$-3000000]0%" sourceLinked="0"/>');
assert.equal(stripNumeralShape('[$-2000401]#,##0.00'), '#,##0.00');
assert.equal(stripNumeralShape('[$-409]#,##0'), '[$-409]#,##0');

// The reported crash: an ar-SA deck with no Arabic text and the metric 1000 threw OPFFontError missing-glyph.
{
  const {fonts, bytes} = await exported({language: 'ar-SA', slides: [{title: 'T', metric: 1000}]});
  assert.deepEqual(fonts.scripts, ['Arab'], 'the generated Arabic-Indic digits load an Arabic face');
  assert.ok(texts(slideXml(bytes, 1)).includes('١,٠٠٠'));
}

const expected = {
  'ar-SA': {metrics: ['٧', '٩٩٩', '١,٠٠٠', '١,٢٣٤,٥٦٧.٨٩١'], cells: ['٧', '٧.٠٠', '٩٩٩', '٩٩٩.٠٠', '١٠٠٠', '١,٠٠٠.٠٠', '١٢٣٤٥٦٧.٨٩١', '١,٢٣٤,٥٦٧.٨٩'], schemes: ['hindiNumPeriod', 'arabicParenBoth'], prefix: '[$-2000000]', lang: 'ar-SA'},
  'fa-IR': {metrics: ['۷', '۹۹۹', '۱٬۰۰۰', '۱٬۲۳۴٬۵۶۷٫۸۹۱'], cells: ['۷', '۷٫۰۰', '۹۹۹', '۹۹۹٫۰۰', '۱۰۰۰', '۱٬۰۰۰٫۰۰', '۱۲۳۴۵۶۷٫۸۹۱', '۱٬۲۳۴٬۵۶۷٫۸۹'], schemes: ['arabicPeriod', 'arabicParenBoth'], prefix: '[$-3000000]', lang: 'fa-IR'},
  'hi-IN': {metrics: ['7', '999', '1,000', '12,34,567.891'], cells: ['7', '7.00', '999', '999.00', '1000', '1,000.00', '1234567.891', '12,34,567.89'], schemes: ['arabicPeriod', 'arabicParenBoth'], prefix: '', lang: 'hi-IN'},
  'ar-SA-u-nu-latn': {metrics: ['7', '999', '1,000', '1,234,567.891'], cells: ['7', '7.00', '999', '999.00', '1000', '1,000.00', '1234567.891', '1,234,567.89'], schemes: ['arabicPeriod', 'arabicParenBoth'], prefix: '', lang: 'ar-SA'},
  'ar-AE-u-nu-arab': {metrics: ['٧', '٩٩٩', '١,٠٠٠', '١,٢٣٤,٥٦٧.٨٩١'], cells: ['٧', '٧.٠٠', '٩٩٩', '٩٩٩.٠٠', '١٠٠٠', '١,٠٠٠.٠٠', '١٢٣٤٥٦٧.٨٩١', '١,٢٣٤,٥٦٧.٨٩'], schemes: ['hindiNumPeriod', 'arabicParenBoth'], prefix: '[$-2000000]', lang: 'ar-AE'},
};
for (const [language, want] of Object.entries(expected)) {
  // An Arabic title on every slide, so a deck in Latin digits also needs its Arabic face (the Latin-text case is the crash above).
  const document = deck(language, language.startsWith('hi') ? 'संकेतक' : 'مؤشر');
  const {bytes} = await exported(document);
  VALUES.forEach((_, index) => assert.ok(texts(slideXml(bytes, index + 1)).includes(want.metrics[index]), `${language} metric ${want.metrics[index]}`));
  const table = texts(slideXml(bytes, 5));
  for (const cell of want.cells) assert.ok(table.includes(cell), `${language} table cell ${cell} in ${table.join(' | ')}`);
  for (const [index, scheme] of want.schemes.entries()) assert.deepEqual([...new Set([...slideXml(bytes, 6 + index).matchAll(/<a:buAutoNum type="([^"]+)"/g)].map(match => match[1]))], [scheme], `${language} list scheme`);
  // The slide number is PowerPoint's live field, which PowerPoint draws in Latin digits; the static count beside it is Latin too.
  assert.ok(texts(slideXml(bytes, 3)).join('').includes('3 / 9'), `${language} footer stays Latin: ${texts(slideXml(bytes, 3)).join('|')}`);
  const codes = chartCodes(bytes);
  assert.ok(codes.length > 0);
  assert.ok(codes.every(code => want.prefix ? code.startsWith(want.prefix) : !/^\[\$-[1-9A-Fa-f][0-9A-Fa-f]{6}\]/.test(code)), `${language} chart codes: ${codes.join(' ')}`);
  if (want.prefix) assert.ok(codes.includes(`${want.prefix}0%`), `${language} pie percent labels name their format: ${codes.join(' ')}`);
  assert.deepEqual(langs(bytes).filter(lang => lang !== 'en-US'), [want.lang], `${language}: lang is the plain tag`);

  // Round trip: the numbers come back as numbers, the list as a numbered list, the chart format without the prefix, the tag as written.
  const back = await fromPptx(bytes);
  assert.equal(back.language, language, `${language} language round trip`);
  assert.deepEqual(back.slides.slice(0, 4).map(slide => slide.metric?.value), VALUES, `${language} metric values`);
  assert.deepEqual(back.slides[4].table.rows.map(row => row.map(cell => typeof cell === 'object' && cell !== null ? cell.value : cell)), VALUES.map(value => [value, value]), `${language} table numbers`);
  assert.equal(back.slides[5].numbering, 'arabic', `${language} numbering`);
  assert.deepEqual(back.slides[7].chart.data, document.slides[7].chart.data, `${language} chart data and format`);
}
console.log('lh-106 numerals: ok');
