// LH-106: the PowerPoint export draws every number OPF generates in the numbering system of the slide's language, as the preview does,
// writes PowerPoint's `lang` without the `-u-nu-` extension, writes a native Arabic-Indic auto-number where PowerPoint has one, never fails
// on digits the deck's own text does not use, and brings the numbers and the author's language tag back on import.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {fromPptx, toPptx} from '../dist/index.js';

const VALUES = [7, 999, 1000, 1234567.891];
const deck = (language, title = 'T') => ({
  language,
  slides: [
    ...VALUES.map(value => ({title, metric: {value, label: 'L'}})),
    {title, table: {columns: ['A', {name: 'B', format: '#,##0.00'}], rows: VALUES.map(value => [value, value])}},
    {title, items: ['one', 'two', 'three'], numbering: 'arabic'},
  ],
});
const exported = async document => {
  const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: document});
  try { return {fonts: fonts.registry.scriptSelection, bytes: await toPptx(document, {fonts})}; } finally { fonts.dispose?.(); }
};
const slideXml = (bytes, number) => strFromU8(unzipSync(new Uint8Array(bytes))[`ppt/slides/slide${number}.xml`]);
const texts = xml => [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]);
const langs = bytes => [...new Set(Object.entries(unzipSync(new Uint8Array(bytes))).filter(([path]) => /^ppt\/(?:slides\/slide|charts\/chart)\d+\.xml$/.test(path)).flatMap(([, data]) => [...strFromU8(data).matchAll(/ lang="([^"]+)"/g)].map(match => match[1])))];

// The reported crash: an ar-SA deck with no Arabic text and the metric 1000 threw OPFFontError missing-glyph.
{
  const {fonts, bytes} = await exported({language: 'ar-SA', slides: [{title: 'T', metric: 1000}]});
  assert.deepEqual(fonts.scripts, ['Arab'], 'the generated Arabic-Indic digits load an Arabic face');
  assert.ok(texts(slideXml(bytes, 1)).includes('١٬٠٠٠'));
}

const expected = {
  'ar-SA': {metrics: ['٧', '٩٩٩', '١٬٠٠٠', '١٬٢٣٤٬٥٦٧٫٨٩١'], cells: ['٧', '٧٫٠٠', '٩٩٩', '٩٩٩٫٠٠', '١٠٠٠', '١٬٠٠٠٫٠٠', '١٢٣٤٥٦٧٫٨٩١', '١٬٢٣٤٬٥٦٧٫٨٩'], scheme: 'hindiNumPeriod', lang: 'ar-SA'},
  'fa-IR': {metrics: ['۷', '۹۹۹', '۱٬۰۰۰', '۱٬۲۳۴٬۵۶۷٫۸۹۱'], cells: ['۷', '۷٫۰۰', '۹۹۹', '۹۹۹٫۰۰', '۱۰۰۰', '۱٬۰۰۰٫۰۰', '۱۲۳۴۵۶۷٫۸۹۱', '۱٬۲۳۴٬۵۶۷٫۸۹'], scheme: 'arabicPeriod', lang: 'fa-IR'},
  'hi-IN': {metrics: ['7', '999', '1,000', '12,34,567.891'], cells: ['7', '7.00', '999', '999.00', '1000', '1,000.00', '1234567.891', '12,34,567.89'], scheme: 'arabicPeriod', lang: 'hi-IN'},
  'ar-SA-u-nu-latn': {metrics: ['7', '999', '1,000', '1,234,567.891'], cells: ['7', '7.00', '999', '999.00', '1000', '1,000.00', '1234567.891', '1,234,567.89'], scheme: 'arabicPeriod', lang: 'ar-SA'},
  'ar-AE-u-nu-arab': {metrics: ['٧', '٩٩٩', '١٬٠٠٠', '١٬٢٣٤٬٥٦٧٫٨٩١'], cells: ['٧', '٧٫٠٠', '٩٩٩', '٩٩٩٫٠٠', '١٠٠٠', '١٬٠٠٠٫٠٠', '١٢٣٤٥٦٧٫٨٩١', '١٬٢٣٤٬٥٦٧٫٨٩'], scheme: 'hindiNumPeriod', lang: 'ar-AE'},
};
for (const [language, want] of Object.entries(expected)) {
  // An Arabic title on every slide, so a deck in Latin digits also needs its Arabic face (the Latin-text case is the crash above).
  const document = deck(language, language.startsWith('hi') ? 'संकेतक' : 'مؤشر');
  const {bytes} = await exported(document);
  VALUES.forEach((_, index) => assert.ok(texts(slideXml(bytes, index + 1)).includes(want.metrics[index]), `${language} metric ${want.metrics[index]}`));
  const table = texts(slideXml(bytes, 5));
  for (const cell of want.cells) assert.ok(table.includes(cell), `${language} table cell ${cell} in ${table.join(' | ')}`);
  assert.deepEqual([...new Set([...slideXml(bytes, 6).matchAll(/<a:buAutoNum type="([^"]+)"/g)].map(match => match[1]))], [want.scheme], `${language} list scheme`);
  assert.deepEqual(langs(bytes).filter(lang => lang !== 'en-US'), [want.lang], `${language}: lang is the plain tag`);

  // Round trip: the numbers come back as numbers, the list as a numbered list, the tag as the author wrote it.
  const back = await fromPptx(bytes);
  assert.equal(back.language, language, `${language} language round trip`);
  assert.deepEqual(back.slides.slice(0, 4).map(slide => slide.metric?.value), VALUES, `${language} metric values`);
  assert.deepEqual(back.slides[4].table.rows.map(row => row.map(cell => typeof cell === 'object' && cell !== null ? cell.value : cell)), VALUES.map(value => [value, value]), `${language} table numbers`);
  assert.equal(back.slides[5].numbering, 'arabic', `${language} numbering`);
}
console.log('lh-106 numerals: ok');
