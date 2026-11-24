// #1404: a deck that declares no language is read from its text (v0.35), and the importer drops a slide language the text alone
// gives (dropLanguagesReadFromText), so that the round trip invents no declaration. A slide's own `language` is not a reading:
// its stored record (OPF_SLIDE_V1, `full` provenance) states it, and it comes back even where the text gives the same language.
// The export is the one written before: nothing marks a language read from the text, and a package without the record
// (`references-only`, no provenance, another application's save) imports as it did.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {fromPptx, toPptx} from '../dist/index.js';

const catalogs = [gallery];
const ARABIC = 'نراجع اليوم نتائج الربع الثالث وخطة العام المقبل';
const english = (extra = {}) => ({id: 'a', title: 'Quarterly review', text: 'Revenue grew twelve percent.', ...extra});
const arabic = (extra = {}) => ({id: 'b', title: ARABIC, text: `${ARABIC}. Acme Cloud 2.0`, bullets: [ARABIC, 'Acme'], ...extra});
const deck = (slides, language) => ({name: '#1404', ...(language ? {language} : {}), slides});
const exported = async (presentation, options = {}) => new Uint8Array(await toPptx(presentation, {catalogs, date: '2026-01-01', ...options}));
const read = async bytes => {
  const diagnostics = [];
  const document = await fromPptx(bytes, {catalogs, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {document, languages: [document.language, ...document.slides.map(slide => slide.language)], changed: diagnostics.filter(diagnostic => diagnostic.code === 'metadata-reference-changed').map(diagnostic => diagnostic.path)};
};
const slideParts = (bytes, change) => { const zip = unzipSync(bytes); for (const name of Object.keys(zip)) if (/^ppt\/slides\/slide\d+\.xml$/.test(name)) zip[name] = strToU8(change(strFromU8(zip[name]))); return zipSync(zip); };
// The parts another application leaves: no OPF tag parts and nothing that names them.
const untagged = bytes => Object.fromEntries(Object.entries(unzipSync(bytes)).filter(([name]) => !/^ppt\/tags\//.test(name)).map(([name, data]) => [name,
  /\.xml$/.test(name) ? strToU8(strFromU8(data).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, '').replace(/<Override PartName="\/ppt\/tags\/[^>]*\/>/g, ''))
    : /\.rels$/.test(name) ? strToU8(strFromU8(data).replace(/<Relationship [^>]*relationships\/tags"[^>]*\/>/g, '')) : data]));
const sameParts = (left, right) => Object.keys(left).length === Object.keys(right).length && Object.entries(left).every(([name, data]) => right[name] !== undefined && Buffer.from(data).equals(Buffer.from(right[name])));
const slideRecords = bytes => Object.values(unzipSync(bytes)).map(data => /<p:tag name="OPF_SLIDE_V1" val="([0-9A-F]+)"/.exec(strFromU8(data))?.[1]).filter(Boolean).map(hex => JSON.parse(Buffer.from(hex, 'hex').toString('utf8')));

const declaredEnglish = deck([english({language: 'en-US'}), arabic()]), declaredArabic = deck([english(), arabic({language: 'ar'})]), undeclared = deck([english(), arabic()]);

// (a) The author's `en-US` on a slide whose text reads as the engine default, and (b) `ar` on a slide whose text reads as Arabic.
for (const [name, source, languages] of [
  ['(a) en-US', declaredEnglish, [undefined, 'en-US', undefined]],
  ['(a) en-US, the only slide', deck([english({language: 'en-US'})]), [undefined, 'en-US']],
  ['(b) ar', declaredArabic, [undefined, undefined, 'ar']],
  ['(b) ar, the only slide', deck([arabic({language: 'ar'})]), [undefined, 'ar']],
]) {
  const back = await read(await exported(source));
  assert.deepEqual(back.languages, languages, `${name}: the slide keeps the language its author declared, and nothing else gains one`);
  assert.deepEqual(back.changed, [], `${name}: an untouched file reports no changed language`);
  assert.deepEqual(back.document, source, `${name}: the round trip is the source`);
}

// (c) No declaration: none comes back, and the file records none (its slide records are the ones written before #1404).
{
  const bytes = await exported(undeclared), back = await read(bytes);
  assert.deepEqual(back.languages, [undefined, undefined, undefined], '(c) no language is invented');
  assert.deepEqual(back.document, undeclared, '(c) the round trip is the source');
  const records = slideRecords(bytes);
  assert.equal(records.length, 2, '(c) each slide has its record');
  assert.ok(records.every(record => record.metadata === undefined && record.supplement === undefined), '(c) no slide record names a language');
  assert.ok(slideRecords(await exported(declaredEnglish)).every(record => record.supplement?.metadata !== undefined), 'a deck with a slide language records each slide\'s own (or none)');
}

// (d) A deck that declares its language is unaffected.
for (const [source, languages] of [
  [deck([english(), arabic({language: 'ar'})], 'en-US'), ['en-US', undefined, 'ar']],
  [deck([english({language: 'en-US'}), arabic()], 'ar'), ['ar', 'en-US', undefined]],
  [deck([arabic()], 'ar'), ['ar', undefined]],
]) {
  const back = await read(await exported(source));
  assert.deepEqual(back.languages, languages, `(d) ${JSON.stringify(languages)}`);
  assert.deepEqual(back.document, source, '(d) the round trip is the source');
}

// (e) Without the slide record nothing tells a declaration from a reading. With provenance off or `references-only` the file of
// a declared slide is, byte for byte, the file of the undeclared deck, so its import cannot differ; a file whose tags another
// application removed imports as that file does. The observed languages are the runs': the deck's is that of most runs.
for (const provenance of [false, 'references-only']) {
  const plain = await exported(undeclared, {provenance});
  for (const source of [declaredEnglish, declaredArabic]) assert.ok(Buffer.from(await exported(source, {provenance})).equals(Buffer.from(plain)), `(e) provenance ${provenance}: the same bytes as the undeclared deck`);
  assert.deepEqual((await read(plain)).languages, ['ar-SA', 'en-US', undefined], `(e) provenance ${provenance}: the languages the runs carry`);
}
{
  const plain = untagged(await exported(undeclared));
  for (const source of [declaredEnglish, declaredArabic]) assert.ok(sameParts(untagged(await exported(source)), plain), '(e) tags removed: the same parts as the undeclared deck');
  assert.ok(Object.keys(plain).length > 10 && !Object.values(plain).some(data => /OPF_[A-Z_]+_V\d|relationships\/tags/.test(strFromU8(data))), '(e) tags removed: no OPF tag is left');
  assert.deepEqual((await read(zipSync(plain))).languages, ['ar-SA', 'en-US', undefined], '(e) tags removed: the languages the runs carry');
}

// A language set in PowerPoint after export is the slide's language; the stored declaration does not return.
{
  const hebrew = await read(slideParts(await exported(declaredArabic), xml => xml.replaceAll('lang="ar-SA"', 'lang="he-IL"')));
  assert.deepEqual(hebrew.languages, [undefined, undefined, 'he-IL']);
  assert.deepEqual(hebrew.changed, ['slides.1.language']);
  const french = await read(slideParts(await exported(declaredEnglish), xml => xml.replaceAll('lang="en-US"', 'lang="fr-FR"')));
  assert.deepEqual(french.languages, [undefined, 'fr-FR', undefined]);
  assert.deepEqual(french.changed, ['slides.0.language']);
  // An edit to what the text alone gives is an observed language like any other: it is dropped, as before.
  const reset = await read(slideParts(await exported(deck([english({language: 'fr'}), arabic()])), xml => xml.replaceAll('lang="fr-FR"', 'lang="en-US"')));
  assert.deepEqual(reset.languages, [undefined, undefined, undefined]);
  assert.deepEqual(reset.changed, ['slides.0.language']);
  // A slide that declared nothing is compared with the language read from its text, not with the engine default.
  const marked = await read(slideParts(await exported(declaredEnglish), xml => xml.replaceAll('lang="ar-SA"', 'lang="en-US"')));
  assert.deepEqual(marked.languages, [undefined, 'en-US', 'en-US']);
  assert.deepEqual(marked.changed, ['slides.1.language']);
}

// (f) Review of #1421: a right-to-left slide whose title holds one Latin word exports as two runs, he-IL "תוצאות " and en-US
// "Q3". The tie must not make the undeclared Hebrew slide English: Latin pieces beside the expected language are the export's
// own split (RR-05), as languageDiagnostics treats them.
for (const [name, source, languages] of [
  ['(f) Hebrew beside a declared slide', deck([{title: 'Plan', language: 'en-US'}, {title: 'תוצאות Q3'}]), [undefined, 'en-US', undefined]],
  ['(f) Arabic beside a declared slide', deck([{title: 'Plan', language: 'en-US'}, {title: 'نتائج Q3'}]), [undefined, 'en-US', undefined]],
  ['(f) Hebrew, declared', deck([{title: 'Plan'}, {title: 'תוצאות Q3', language: 'he'}]), [undefined, undefined, 'he']],
]) {
  const back = await read(await exported(source));
  assert.deepEqual(back.languages, languages, `${name}: no slide comes back in a language its author did not write`);
  assert.deepEqual(back.changed, [], `${name}: an untouched file reports no changed language`);
  assert.deepEqual(back.document, source, `${name}: the round trip is the source`);
}
// The rule is only for Latin pieces: a Hebrew slide whose runs were all retagged en-US in PowerPoint is English.
{
  const source = deck([{title: 'Plan', language: 'en-US'}, {title: 'תוצאות Q3'}]);
  const retagged = await read(slideParts(await exported(source), xml => xml.replaceAll('lang="he-IL"', 'lang="en-US"')));
  assert.deepEqual(retagged.languages, [undefined, 'en-US', 'en-US']);
  assert.deepEqual(retagged.changed, ['slides.1.language']);
}

console.log(JSON.stringify({test: 'slide-language-declared', passed: true}));
