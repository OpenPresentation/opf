// A deck that declares no language is read from its text (v0.35): each slide is written in the language its own text gives, and
// the importer keeps the deck's language absent while the file is as it was written. It used to decide that by comparing the
// most common run tag of the whole file with the reading of the whole deck's text. One counts runs and the other letters, so a
// deck whose slide in the engine default has more runs than its right-to-left slide came back with an invented deck language
// (`en-US`) and an invented slide language (`ar-SA`). The file is as written when every slide still carries the language read
// from that slide's text; a language set in PowerPoint, and a file without the stored record, import as before.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {fromPptx, toPptx} from '../dist/index.js';

const catalogs = [gallery];
const ARABIC = 'نراجع اليوم نتائج الربع الثالث وخطة العام المقبل وما تحقق من أهداف الفريق خلال هذه الفترة';
const HEBREW = 'היום נסקור את תוצאות הרבעון השלישי ואת התוכנית לשנה הבאה ואת מה שהושג';
// More runs than the right-to-left slide has (a title and five bullets against one title), fewer letters.
const english = (extra = {}) => ({id: 'a', title: 'Quarterly review', bullets: ['Revenue grew', 'Costs fell', 'Margin up', 'Hiring on plan', 'Churn down'], ...extra});
const rtl = text => ({id: 'b', title: text});
const deck = slides => ({name: 'undeclared, mixed scripts', slides});
const exported = async (presentation, options = {}) => new Uint8Array(await toPptx(presentation, {catalogs, date: '2026-01-01', ...options}));
const read = async bytes => {
  const diagnostics = [];
  const document = await fromPptx(bytes, {catalogs, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {document, languages: [document.language, ...document.slides.map(slide => slide.language)], changed: diagnostics.filter(diagnostic => diagnostic.code === 'metadata-reference-changed').map(diagnostic => diagnostic.path)};
};
const slideParts = (bytes, change) => { const zip = unzipSync(bytes); for (const name of Object.keys(zip)) if (/^ppt\/slides\/slide\d+\.xml$/.test(name)) zip[name] = strToU8(change(strFromU8(zip[name]))); return zipSync(zip); };
// The parts another application leaves: no OPF tag parts and nothing that names them.
const untagged = bytes => zipSync(Object.fromEntries(Object.entries(unzipSync(bytes)).filter(([name]) => !/^ppt\/tags\//.test(name)).map(([name, data]) => [name,
  /\.xml$/.test(name) ? strToU8(strFromU8(data).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, '').replace(/<Override PartName="\/ppt\/tags\/[^>]*\/>/g, ''))
    : /\.rels$/.test(name) ? strToU8(strFromU8(data).replace(/<Relationship [^>]*relationships\/tags"[^>]*\/>/g, '')) : data])));

const mixed = deck([english(), rtl(ARABIC)]);

// An untouched file: no language comes back, whichever slide has more runs and wherever it stands.
for (const [name, source] of [
  ['the English slide has more runs than the Arabic one', mixed],
  ['the same with a Hebrew slide', deck([english(), rtl(HEBREW)])],
  ['two English slides and an Arabic one', deck([english(), {id: 'c', title: 'Plan', bullets: ['One', 'Two', 'Three']}, rtl(ARABIC)])],
  ['the Arabic slide first', deck([rtl(ARABIC), english()])],
  ['English only', deck([english(), {id: 'c', title: 'Plan'}])],
]) {
  const back = await read(await exported(source));
  assert.deepEqual(back.languages, source.slides.map(() => undefined).concat(undefined), `${name}: no language is invented`);
  assert.deepEqual(back.changed, [], `${name}: an untouched file reports no changed language`);
  assert.deepEqual(back.document, source, `${name}: the round trip is the source`);
}

// A language set in PowerPoint is imported as observed, as before.
for (const [name, change, languages] of [
  ['the Arabic slide set to Hebrew', xml => xml.replaceAll('lang="ar-SA"', 'lang="he-IL"'), ['en-US', undefined, 'he-IL']],
  ['the English slide set to French', xml => xml.replaceAll('lang="en-US"', 'lang="fr-FR"'), ['fr-FR', undefined, 'ar-SA']],
  ['the Arabic slide set to English', xml => xml.replaceAll('lang="ar-SA"', 'lang="en-US"'), ['en-US', undefined, undefined]],
  ['every run set to German', xml => xml.replace(/lang="[^"]+"/g, 'lang="de-DE"'), ['de-DE', undefined, undefined]],
]) assert.deepEqual((await read(slideParts(await exported(mixed), change))).languages, languages, name);
assert.deepEqual((await read(slideParts(await exported(deck([english(), {id: 'c', title: 'Plan'}])), xml => xml.replace(/lang="[^"]+"/g, 'lang="fr-FR"')))).languages, ['fr-FR', undefined, undefined], 'an English deck set to French');

// Without the stored record nothing says the deck declared no language, so the runs' languages are imported, as before.
assert.deepEqual((await read(untagged(await exported(mixed)))).languages, ['en-US', undefined, 'ar-SA'], 'tags removed');
for (const provenance of [false, 'references-only']) assert.deepEqual((await read(await exported(mixed, {provenance}))).languages, ['en-US', undefined, 'ar-SA'], `provenance ${provenance}`);

console.log(JSON.stringify({test: 'language-undeclared-mixed', passed: true}));
