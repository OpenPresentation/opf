// #1404: in a right-to-left paragraph the export writes each Latin phrase and each number as its own en-US run (RR-05), so that
// PowerPoint orders it left to right, and it writes a right-to-left paragraph of only numbers ("+16%") as an en-US run in a
// paragraph marked rtl="0" (LH-118). Those runs are not the slide's language (withoutLatinPieces). Every deck below comes back
// from a round trip with exactly the languages it declared, in Hebrew, Arabic, Persian and Urdu, beside English slides and with
// pieces that outnumber the right-to-left runs; a language set in PowerPoint on the text of a run, not on a piece, is still
// imported as observed with its finding.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {fromPptx, toPptx} from '../dist/index.js';
import {observeLanguage} from '../src/script-fonts.js';

const catalogs = [gallery];
const scripts = {
  he: {one: 'תוצאות Q3', two: 'תוצאות Q3 ויעדי OKR', num: 'תוצאות Q3 לשנת 2026'},
  ar: {one: 'نتائج Q3', two: 'نتائج Q3 وأهداف OKR', num: 'نتائج Q3 لعام 2026'},
  fa: {one: 'نتایج Q3', two: 'نتایج Q3 و اهداف OKR', num: 'نتایج Q3 سال 2026'},
  ur: {one: 'نتائج Q3', two: 'نتائج Q3 اور اہداف OKR', num: 'نتائج Q3 برائے 2026'},
};
const exported = async presentation => new Uint8Array(await toPptx(presentation, {catalogs, date: '2026-01-01'}));
const read = async bytes => {
  const diagnostics = [];
  const document = await fromPptx(bytes, {catalogs, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {document, languages: [document.language, ...document.slides.map(slide => slide.language)],
    changed: diagnostics.filter(diagnostic => diagnostic.code === 'metadata-reference-changed').map(diagnostic => diagnostic.path),
    rtlMismatch: diagnostics.some(diagnostic => diagnostic.code === 'rtl-language-mismatch')};
};
const slideParts = (bytes, change) => { const zip = unzipSync(bytes); for (const name of Object.keys(zip)) if (/^ppt\/slides\/slide\d+\.xml$/.test(name)) zip[name] = strToU8(change(strFromU8(zip[name]))); return zipSync(zip); };

const decks = [];
for (const [language, texts] of Object.entries(scripts)) {
  for (const [kind, title] of Object.entries(texts)) {
    decks.push([`${language} ${kind}, beside a slide declared en-US`, {name: 'v', slides: [{title: 'Plan', language: 'en-US'}, {title}]}]);
    decks.push([`${language} ${kind}, the only slide`, {name: 'v', slides: [{title}]}]);
    decks.push([`${language} ${kind}, the deck declares ${language}`, {name: 'v', language, slides: [{title}]}]);
    decks.push([`${language} ${kind}, the slide declares ${language}`, {name: 'v', slides: [{title: 'Plan'}, {title, language}]}]);
  }
}
// Latin pieces outnumber the right-to-left runs across paragraphs: three Hebrew or Arabic runs against four en-US runs, one of
// them a paragraph of only a number (written left to right, LH-118).
for (const [language, slide] of [
  ['he', {title: 'תוצאות Q3', bullets: ['מדד KPI ויעד OKR'], text: '+16%'}],
  ['ar', {title: 'نتائج Q3', bullets: ['مؤشر KPI وهدف OKR'], text: '+16%'}],
]) {
  decks.push([`${language}: pieces outnumber the runs, the only slide`, {name: 'v', slides: [slide]}]);
  decks.push([`${language}: pieces outnumber the runs, beside a slide declared en-US`, {name: 'v', slides: [{title: 'Plan', language: 'en-US'}, slide]}]);
  decks.push([`${language}: pieces outnumber the runs, the deck declares ${language}`, {name: 'v', language, slides: [slide]}]);
}
decks.push(
  ['a Hebrew deck with one slide declared English', {name: 'v', language: 'he', slides: [{title: scripts.he.one}, {title: 'Plan', language: 'en-US'}]}],
  ['an Arabic deck with one slide declared English', {name: 'v', language: 'ar', slides: [{title: scripts.ar.num}, {title: 'Plan', language: 'en-US'}]}],
  ['a Latin slide beside a Hebrew one, both declared', {name: 'v', slides: [{title: 'Plan', language: 'en-US'}, {title: scripts.he.one, language: 'he'}]}],
  ['a Latin slide beside a Hebrew one, neither declared', {name: 'v', slides: [{title: 'Plan'}, {title: scripts.he.one}]}],
  ['a Latin slide beside an Arabic one, both declared', {name: 'v', slides: [{title: 'Plan', language: 'en-US'}, {title: scripts.ar.two, language: 'ar'}]}],
  ['a Latin slide beside an Arabic one, neither declared', {name: 'v', slides: [{title: 'Plan'}, {title: scripts.ar.two}]}],
  ['a slide with no text beside a Hebrew one', {name: 'v', slides: [{}, {title: scripts.he.one}]}],
  ['a slide with no text beside one declared en-US', {name: 'v', slides: [{title: 'Plan', language: 'en-US'}, {}]}],
  ['a slide with no text, the only slide', {name: 'v', slides: [{}]}],
  ['a slide with no text that declares he', {name: 'v', slides: [{title: 'Plan'}, {language: 'he'}]}],
  // LH-118 number-only paragraphs: one Hebrew run against one or two en-US runs in paragraphs marked rtl="0".
  ['a Hebrew title and a number paragraph, the only slide', {name: 'v', slides: [{title: 'תוצאות', text: '+16%'}]}],
  ['a Hebrew title and a number paragraph, beside a slide declared en-US', {name: 'v', slides: [{title: 'Plan', language: 'en-US'}, {title: 'תוצאות', text: '+16%'}]}],
  ['a Hebrew title and a number paragraph, the deck declares he', {name: 'v', language: 'he', slides: [{title: 'תוצאות', text: '+16%'}]}],
  ['a Hebrew title and two number bullets, the only slide', {name: 'v', slides: [{title: 'תוצאות', bullets: ['+16%', '-2.5%']}]}],
  ['a Hebrew title and two number bullets, the slide declares he', {name: 'v', slides: [{title: 'Plan'}, {title: 'תוצאות', bullets: ['+16%', '-2.5%'], language: 'he'}]}],
  ['an Arabic title and two number bullets, beside a slide declared en-US', {name: 'v', slides: [{title: 'Plan', language: 'en-US'}, {title: 'نتائج', bullets: ['+16%', '$42']}]}],
);

// An untouched file is its source: the languages declared, no others, and no finding about them.
for (const [name, source] of decks) {
  const back = await read(await exported(source));
  assert.deepEqual(back.languages, [source.language, ...source.slides.map(slide => slide.language)], `${name}: the declared languages come back, and only those`);
  assert.deepEqual(back.changed, [], `${name}: an untouched file reports no changed language`);
  assert.equal(back.rtlMismatch, false, `${name}: no right-to-left paragraph is reported under a left-to-right language`);
  assert.deepEqual(back.document, source, `${name}: the round trip is the source`);
}

// The pieces do not vote: the slide's language is that of its other runs.
{
  const xml = strFromU8(unzipSync(await exported({name: 'v', slides: [{title: scripts.he.one}]}))['ppt/slides/slide1.xml']);
  assert.match(xml, /<a:r><a:rPr\b[^>]*\slang="en-US"(?![^>]*altLang)[^>]*>(?:(?!<\/a:r>)[\s\S])*<a:t>Q3<\/a:t><\/a:r>/, 'the export writes "Q3" as its own en-US run');
  assert.match(xml, /<a:r><a:rPr\b[^>]*\slang="he-IL"[^>]*>(?:(?!<\/a:r>)[\s\S])*<a:t>תוצאות <\/a:t><\/a:r>/, 'and the Hebrew as a he-IL run');
  const observed = observeLanguage({slides: [xml]});
  assert.equal(observed.language, 'he-IL');
  // A number-only paragraph (rtl="0", LH-118) on that slide is a piece too, and outside such a slide it counts.
  const numbers = strFromU8(unzipSync(await exported({name: 'v', slides: [{title: 'תוצאות', bullets: ['+16%', '-2.5%']}]}))['ppt/slides/slide1.xml']);
  assert.match(numbers, /<a:pPr\b[^>]*\srtl="0"[^>]*>(?:(?!<\/a:p>)[\s\S])*lang="en-US"(?:(?!<\/a:p>)[\s\S])*<a:t>\+16%<\/a:t>/, 'the export writes "+16%" as an en-US run in a paragraph marked rtl="0"');
  assert.equal(observeLanguage({slides: [numbers]}).language, 'he-IL');
  assert.equal(observeLanguage({slides: ['<p:sld><a:p><a:pPr rtl="0"/><a:r><a:rPr lang="en-US"/><a:t>+16%</a:t></a:r></a:p><a:p><a:r><a:rPr lang="he-IL"/><a:t>תוצאות</a:t></a:r></a:p></p:sld>']}).language, 'en-US');
  // Hebrew text set to English is not a piece: it counts, so the slide reads as English.
  assert.equal(observeLanguage({slides: [xml.replaceAll('lang="he-IL"', 'lang="en-US"')]}).language, 'en-US');
  // A slide without right-to-left paragraphs is read from all its runs, as before.
  assert.equal(observeLanguage({slides: ['<p:sld><a:p><a:r><a:rPr lang="en-US"/><a:t>Q3</a:t></a:r></a:p></p:sld>']}).language, 'en-US');
}

// A language set in PowerPoint is imported as observed, with its finding: the runs of the right-to-left text set to another
// right-to-left language and to a left-to-right one.
for (const [name, source, from, edits] of [
  ['Hebrew beside a slide declared en-US', {name: 'v', slides: [{title: 'Plan', language: 'en-US'}, {title: scripts.he.one}]}, 'he-IL', [
    ['ar-SA', [undefined, 'en-US', 'ar-SA'], ['slides.1.language'], false],
    ['en-US', [undefined, 'en-US', 'en-US'], ['slides.1.language'], true],
  ]],
  ['Arabic beside a slide declared en-US', {name: 'v', slides: [{title: 'Plan', language: 'en-US'}, {title: scripts.ar.one}]}, 'ar-SA', [
    ['he-IL', [undefined, 'en-US', 'he-IL'], ['slides.1.language'], false],
    ['en-US', [undefined, 'en-US', 'en-US'], ['slides.1.language'], true],
  ]],
  ['a slide that declares he', {name: 'v', slides: [{title: 'Plan'}, {title: scripts.he.one, language: 'he'}]}, 'he-IL', [
    ['ar-SA', [undefined, undefined, 'ar-SA'], ['slides.1.language'], false],
    ['en-US', [undefined, undefined, 'en-US'], ['slides.1.language'], true],
  ]],
  ['a deck that declares he', {name: 'v', language: 'he', slides: [{title: scripts.he.one}]}, 'he-IL', [
    ['ar-SA', ['ar-SA', undefined], ['language'], false],
    ['en-US', ['en-US', undefined], ['language'], true],
  ]],
  // A deck that declares nothing has no stored language to report as changed; the observed language is imported.
  ['a Hebrew deck that declares nothing', {name: 'v', slides: [{title: scripts.he.one}]}, 'he-IL', [
    ['ar-SA', ['ar-SA', undefined], [], false],
    ['en-US', ['en-US', undefined], [], true],
  ]],
]) {
  for (const [to, languages, changed, rtlMismatch] of edits) {
    const back = await read(slideParts(await exported(source), xml => xml.replaceAll(`lang="${from}"`, `lang="${to}"`)));
    assert.deepEqual(back.languages, languages, `${name}, ${from} set to ${to}: imported as observed`);
    assert.deepEqual(back.changed, changed, `${name}, ${from} set to ${to}: the changed language is reported`);
    assert.equal(back.rtlMismatch, rtlMismatch, `${name}, ${from} set to ${to}: right-to-left paragraphs under a left-to-right language are reported`);
  }
}

console.log(JSON.stringify({test: 'language-rtl-pieces', passed: true, decks: decks.length}));
