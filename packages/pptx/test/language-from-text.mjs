// v0.35: a deck written in Arabic or Hebrew that declares no language exports as a deck that declares it: the theme's script
// fonts, right-to-left paragraphs, the language tag on the runs and mirrored layouts. The two files differ only in what records
// the declaration itself: dc:language in docProps/core.xml and the OPF document tag, so an import gives back a deck with no
// language. A declared language wins.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {fromPptx, toPptx} from '../dist/index.js';

const catalogs = [gallery];
const ARABIC = 'نراجع اليوم نتائج الربع الثالث وخطة العام المقبل', HEBREW = 'היום נסקור את תוצאות הרבעון השלישי';
const slide = text => ({id: 'a', title: text, text: `${text}. Acme Cloud 2.0`, bullets: [text, 'Acme']});
const deck = (text, language) => ({name: 'v0.35', ...(language ? {language} : {}), slides: [slide(text)]});
const exported = async presentation => new Uint8Array(await toPptx(presentation, {catalogs, date: '2026-01-01'}));
const parts = bytes => Object.fromEntries(Object.entries(unzipSync(bytes)).map(([name, value]) => [name, strFromU8(value)]));
const slideParts = xml => Object.keys(xml).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => a.length - b.length || a.localeCompare(b)).map(name => xml[name]);
const count = (text, pattern) => (text.match(pattern) ?? []).length;

for (const [tag, lang, text] of [['ar', 'ar-SA', ARABIC], ['he', 'he-IL', HEBREW]]) {
  const bytes = await exported(deck(text));
  const read = parts(bytes), named = parts(await exported(deck(text, tag))), english = parts(await exported(deck(text, 'en-US')));
  const differing = Object.keys(named).filter(name => read[name] !== named[name]).sort();
  assert.deepEqual(differing, ['docProps/core.xml', 'ppt/tags/opfDocument.xml'], `${tag}: only the record of the declaration differs`);
  assert.deepEqual(Object.keys(read).sort(), Object.keys(named).sort(), `${tag}: the same parts`);
  assert.doesNotMatch(read['docProps/core.xml'], /<dc:language>/, `${tag}: the file claims no language the deck did not declare`);
  const [body] = slideParts(read);
  assert.ok(count(body, /rtl="1"/g) >= 3, `${tag}: the paragraphs in the script are right to left (${count(body, /rtl="1"/g)})`);
  assert.ok(body.includes(`lang="${lang}"`), `${tag}: the runs carry ${lang}`);
  const [plain] = slideParts(english);
  assert.equal(count(plain, /rtl="1"/g), 0, `${tag}: declared as English, the same text stays left to right`);
  assert.notEqual(read['ppt/theme/theme1.xml'], english['ppt/theme/theme1.xml'], `${tag}: the theme names the script's fonts`);
  // Round trip: the import has no language, because the deck had none.
  const imported = await fromPptx(bytes, {catalogs});
  assert.equal(imported.language, undefined, `${tag}: no language is invented on import`);
}

// Each slide is read on its own.
{
  const mixed = {name: 'Mixed', slides: [{id: 'a', title: 'Quarterly review', text: 'Revenue grew twelve percent.'}, {...slide(ARABIC), id: 'b'}, {id: 'c', title: 'Launch plan', text: ['We call the launch ', {text: 'خطة النمو', bold: true}, ' in the Gulf markets.']}]};
  const slides = slideParts(parts(await exported(mixed)));
  assert.deepEqual(slides.map(xml => count(xml, /rtl="1"/g) > 0), [false, true, false]);
  assert.ok(slides[1].includes('lang="ar-SA"') && !slides[0].includes('lang="ar-SA"'));
}

console.log(JSON.stringify({test: 'language-from-text', passed: true}));
