// RR-105: a metric whose number is drawn grouped (core groupNumber, LH-141: "1,500", "150 000" with U+202F, "150.000", "١٥٠٬٠٠٠")
// survives OPF -> PPTX -> OPF as the metric it was, in every locale. Its OPF_METRIC_V1 record's line ranges cover the grouped text, which
// the record names; the import accepts that text only when it spells the record's number. A record whose ranges or text do not match is
// refused (the visible text stays), a record without the text (as v0.33.0 wrote it) is read from the slide's own text, and a grouped
// number edited in PowerPoint imports as the new number.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {fromPptx, toPptx} from '../dist/index.js';
import {decodeTextTag, encodeTextTag} from '../dist/code-provenance.js';
import {numberSpelling} from '../dist/metric-provenance.js';

// The spelling check, independent of the runtime's locale data.
assert.deepEqual(numberSpelling('150 000', {expected: 150000}), {value: 150000, decimal: ''});
assert.deepEqual(numberSpelling('-2.500,75', {expected: -2500.75}), {value: -2500.75, decimal: ','});
assert.deepEqual(numberSpelling('؜-٢٬٥٠٠٫٧٥', {expected: -2500.75}), {value: -2500.75, decimal: '٫'});
assert.deepEqual(numberSpelling('1,50,000', {expected: 150000}), {value: 150000, decimal: ''});
for (const bad of ['150 000 €', '1,,500', ',500', '15O0', '1١5', '', 'x'.repeat(100)]) assert.equal(numberSpelling(bad, {expected: 1500}), undefined, bad);
assert.equal(numberSpelling('150,000', {expected: 160000}), undefined, 'another number is no spelling of this one');

const exported = async (language, metric, title = 'Metric') => {
  const deck = {language, slides: [{title, metric}]};
  const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: deck});
  try { return {deck, bytes: await toPptx(deck, {fonts})}; } finally { fonts.dispose?.(); }
};
const imported = async bytes => {
  const diagnostics = [];
  const document = await fromPptx(bytes, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {slide: document.slides[0], codes: diagnostics.map(diagnostic => diagnostic.code)};
};
const valueText = bytes => {
  const xml = strFromU8(unzipSync(new Uint8Array(bytes))['ppt/slides/slide1.xml']);
  return [...xml.matchAll(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?name="OPF metric 1 value line \d+"[\s\S]*?<\/p:sp>/g)].map(([shape]) => [...shape.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join('')).join('');
};
// The metric's tag part, its record, and the archive with the record rewritten.
function withRecord(bytes, change) {
  const zip = unzipSync(new Uint8Array(bytes));
  let hit = 0;
  for (const path of Object.keys(zip).filter(name => /^ppt\/tags\/[^/]+\.xml$/.test(name))) {
    zip[path] = strToU8(strFromU8(zip[path]).replace(/(<p:tag name="OPF_METRIC_V1" val=")([^"]*)"/g, (whole, start, value) => {
      const record = decodeTextTag(value);
      if (record.role !== 'anchor') return whole;
      hit++;
      change(record);
      return `${start}${encodeTextTag(record)}"`;
    }));
  }
  assert.equal(hit, 1, 'one anchor record');
  return zipSync(zip);
}

// Round trips: the imported block is the metric, equal to the source.
const ARABIC_TITLE = 'المؤشرات الرئيسية';
const spellings = {'en-US': ['999', '1,000', '150,000'], 'fr-FR': ['999', '1 000', '150 000'], 'de-DE': ['999', '1.000', '150.000'],
  // LH-106: every number is in the language's own digits, below 1,000 too; -u-nu-latn chooses Latin digits; Persian has its own.
  'ar-SA': ['٩٩٩', '١٬٠٠٠', '١٥٠٬٠٠٠'], 'ar-SA-u-nu-latn': ['999', '1,000', '150,000'], 'fa-IR': ['۹۹۹', '۱٬۰۰۰', '۱۵۰٬۰۰۰'], 'hi-IN': ['999', '1,000', '1,50,000']};
for (const [language, texts] of Object.entries(spellings)) {
  for (const [index, value] of [999, 1000, 150000].entries()) {
    const {bytes} = await exported(language, {value, label: 'People'}, /^(ar|fa)-/.test(language) ? ARABIC_TITLE : 'Metric');
    assert.equal(valueText(bytes), texts[index], `${language} ${value}: drawn as ${texts[index]}`);
    const {slide, codes} = await imported(bytes);
    assert.deepEqual(slide.metric, {value, label: 'People'}, `${language} ${value}: imports as the metric`);
    assert.equal(codes.includes('invalid-metric-provenance'), false, `${language} ${value}: the record is accepted`);
  }
}
// Percent and currency as written text, a negative fraction, a unit and a grouped numeric delta.
for (const [language, metric] of [
  ['en-US', {value: '45%', label: 'Share'}], ['fr-FR', {value: '1 200 €', label: 'Prix'}], ['de-DE', {value: -2500.75, label: 'Saldo'}],
  ['fr-FR', {value: 150000, unit: '€', label: 'Revenu', delta: -12500, trend: 'down'}], ['ar-SA', {value: 150000, unit: 'ر.س', label: 'الإيرادات', delta: 2500}],
]) {
  const {bytes} = await exported(language, metric, language === 'ar-SA' ? ARABIC_TITLE : 'Metric');
  const {slide, codes} = await imported(bytes);
  assert.deepEqual(slide.metric, metric, `${language} ${JSON.stringify(metric)}: imports as the metric`);
  assert.equal(codes.includes('invalid-metric-provenance'), false);
}

const {bytes} = await exported('fr-FR', {value: 150000, label: 'Personnes'});
// A record as v0.33.0 wrote it (no text): read from the slide's own text.
{
  const {slide, codes} = await imported(withRecord(bytes, record => { for (const part of record.parts) delete part.text; }));
  assert.deepEqual(slide.metric, {value: 150000, label: 'Personnes'}, 'a v0.33.0 record imports');
  assert.equal(codes.includes('invalid-metric-provenance'), false);
}
// Tampered records are refused and the visible text stays.
for (const [label, change] of [
  ['a text that spells another number', record => { record.parts[0].text = '160 000'; }],
  ['a text on a part that has none', record => { record.parts[1].text = 'Personnes'; }],
  ['a range past the text', record => { record.parts[0].lines[0].end += 1; record.parts[0].lines[0].nextStart += 1; }],
  ['a range short of the text', record => { record.parts[0].lines[0].end -= 1; record.parts[0].lines[0].nextStart -= 1; }],
  ['a v0.33.0 range that the slide text does not fill', record => { delete record.parts[0].text; record.parts[0].lines[0].end = 9; record.parts[0].lines[0].nextStart = 9; }],
]) {
  const {slide, codes} = await imported(withRecord(bytes, change));
  assert.equal(slide.metric, undefined, `${label}: no metric is restored`);
  assert.ok(codes.includes('invalid-metric-provenance'), `${label}: reported`);
  assert.ok(JSON.stringify(slide).includes('000'), `${label}: the visible text is kept`);
}
// The number edited in PowerPoint ("150 000" to "160 000", one run with its U+202F as v0.33.0 wrote it): the new number, read with the
// export's separators.
{
  const zip = unzipSync(new Uint8Array(bytes)), path = 'ppt/slides/slide1.xml', xml = strFromU8(zip[path]);
  assert.match(xml, /name="OPF metric 1 value line 1"[\s\S]*?<a:t>150 000<\/a:t>/, 'the number is one run with its separator');
  zip[path] = strToU8(xml.replace(/(name="OPF metric 1 value line 1"[\s\S]*?<a:t>)150( 000<\/a:t>)/, '$1160$2'));
  assert.notEqual(strFromU8(zip[path]), xml, 'the control edits the value');
  const {slide} = await imported(zipSync(zip));
  assert.deepEqual(slide.metric, {value: 160000, label: 'Personnes'}, 'the edited number imports as a number');
}
console.log('Metric numbers: grouped values in four locales, percent, currency, negative, unit and delta round trip; v0.33.0 records import; tampered records are refused; an edited number is read back.');
