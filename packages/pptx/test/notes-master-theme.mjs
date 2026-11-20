import assert from 'node:assert/strict';
import path from 'node:path';
import {strFromU8, strToU8, unzipSync} from 'fflate';
import {XMLParser, XMLValidator} from 'fast-xml-parser';
import {readFile} from 'node:fs/promises';
import {examples} from '@openpresentation/opf/examples';
import {gallery as defaultCatalog} from '@openpresentation/gallery';
import {toPptx} from '../src/index.js';

// FF-05 (font-fidelity-everywhere). PowerPoint reads a package whose notes master shares the slide master's theme part
// as corrupt ("The file or directory is corrupted and unreadable", 0x80070570) once the notes master list is in schema
// order, and it ignores a misplaced notes master list and synthesises a default notes master in the default Office
// theme (Aptos). The exporter therefore gives the notes master its own theme part, a copy of the deck theme.
const REL_THEME = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme';
const THEME_TYPE = 'application/vnd.openxmlformats-officedocument.theme+xml';
// Independent fixture contracts: the notes copy plus one master per authored font/script profile.
const TWO_THEME = {count: 2, owners: {
  'ppt/slideMasters/slideMaster1.xml': 'ppt/theme/theme1.xml',
  'ppt/notesMasters/notesMaster1.xml': 'ppt/theme/theme2.xml',
}};
// multilingual-slides authors English, Arabic, Japanese and French; French reuses English's profile.
const FOUR_THEME = {count: 4, owners: {...TWO_THEME.owners,
  'ppt/slideMasters/slideMaster2.xml': 'ppt/theme/theme3.xml',
  'ppt/slideMasters/slideMaster3.xml': 'ppt/theme/theme4.xml',
}};
const xml = new XMLParser({ignoreAttributes: false, parseTagValue: false});
function checkAppThemes(entries, label, expected) {
  const app = xml.parse(strFromU8(entries['docProps/app.xml'])).Properties;
  const pairs = app.HeadingPairs['vt:vector'], variants = pairs['vt:variant'];
  const vector = app.TitlesOfParts['vt:vector'];
  const titles = Array.isArray(vector['vt:lpstr']) ? vector['vt:lpstr'] : [vector['vt:lpstr']];
  assert.equal(Number(pairs['@_size']), variants.length, label + ': HeadingPairs vector size');
  assert.equal(variants.length % 2, 0, label + ': every category has a count');
  assert.equal(Number(vector['@_size']), titles.length, label + ': TitlesOfParts vector size');
  const groups = new Map(); let offset = 0;
  for (let index = 0; index < variants.length; index += 2) {
    const name = variants[index]['vt:lpstr'], count = Number(variants[index + 1]['vt:i4']);
    assert.ok(typeof name === 'string' && !groups.has(name), label + ': unique metadata category');
    assert.ok(Number.isInteger(count) && count >= 0, label + ': nonnegative category count');
    groups.set(name, {count, titles: titles.slice(offset, offset + count)}); offset += count;
  }
  assert.equal(groups.get('Theme')?.count, expected.count, label + ': app.xml lists all expected theme parts');
  assert.equal(offset, titles.length, label + ': category counts cover all part titles');
  const expectedNames = Object.values(expected.owners).map(part => xml.parse(strFromU8(entries[part]))['a:theme']['@_name']);
  assert.ok(expectedNames.every(name => typeof name === 'string' && name.length), label + ': every expected theme is named');
  assert.deepEqual(groups.get('Theme').titles, expectedNames, label + ': app.xml theme titles match each referenced theme');
}
// OPF 0.15 (FA-23): the decks and the example corpus name gallery ids, which resolve from the registered default catalog.
const options = {seed: 1, date: '2026-10-02', timestamp: '2026-10-02T00:00:00Z', zipDate: '2026-10-02T00:00:00Z', catalogs: [defaultCatalog]};

const relationships = (entries, part) => {
  const rels = part.replace(/([^/]+)$/, '_rels/$1.rels');
  assert.ok(entries[rels], `${rels} exists`);
  const base = part.includes('/') ? part.slice(0, part.lastIndexOf('/') + 1) : '';
  return [...strFromU8(entries[rels]).matchAll(/<Relationship\b[^>]*>/g)].map(match => {
    const target = /Target="([^"]*)"/.exec(match[0])[1];
    return {type: /Type="([^"]*)"/.exec(match[0])[1], external: /TargetMode="External"/.test(match[0]), path: target.startsWith('/') ? target.slice(1) : path.posix.normalize(base + target)};
  });
};
const themeOf = (entries, part) => relationships(entries, part).filter(rel => rel.type === REL_THEME).map(rel => rel.path);

// Structural checks that PowerPoint's package reader enforces: well-formed XML, resolvable relationships, a content type per part.
function checkPackage(entries, label) {
  const names = Object.keys(entries);
  for (const name of names) if (/\.(xml|rels)$/.test(name)) assert.equal(XMLValidator.validate(strFromU8(entries[name])), true, `${label}: ${name} is well-formed`);
  const types = strFromU8(entries['[Content_Types].xml']);
  const defaults = new Set([...types.matchAll(/<Default Extension="([^"]+)"/g)].map(match => match[1].toLowerCase()));
  const overrides = new Set([...types.matchAll(/<Override PartName="\/([^"]+)"/g)].map(match => match[1]));
  for (const override of overrides) assert.ok(entries[override], `${label}: content type override names an existing part (${override})`);
  for (const name of names) if (name !== '[Content_Types].xml' && !name.endsWith('/')) assert.ok(overrides.has(name) || defaults.has(name.split('.').pop().toLowerCase()), `${label}: ${name} has a content type`);
  for (const name of names.filter(name => name.endsWith('.rels') && name !== '_rels/.rels')) {
    const owner = name.replace(/_rels\/([^/]+)\.rels$/, '$1');
    for (const rel of relationships(entries, owner)) if (!rel.external) assert.ok(entries[rel.path], `${label}: ${owner} -> ${rel.path} exists`);
  }
}

function checkNotesTheme(entries, label, expected = TWO_THEME) {
  const masters = names => Object.keys(entries).filter(name => names.test(name)).sort();
  const slideMasters = masters(/^ppt\/slideMasters\/slideMaster\d+\.xml$/), notesMasters = masters(/^ppt\/notesMasters\/notesMaster\d+\.xml$/);
  assert.deepEqual([...slideMasters, ...notesMasters].sort(), Object.keys(expected.owners).sort(), label + ': exact expected master owners');
  assert.deepEqual(masters(/^ppt\/theme\/theme\d+\.xml$/), Object.values(expected.owners).sort(), label + ': exact expected theme parts');
  assert.ok(notesMasters.length > 0, `${label}: the export has a notes master`);
  const owners = new Map();
  for (const master of [...slideMasters, ...notesMasters]) {
    const themes = themeOf(entries, master);
    assert.equal(themes.length, 1, `${label}: ${master} has one theme relationship`);
    assert.equal(themes[0], expected.owners[master], `${label}: ${master} references its expected theme part`);
    assert.ok(entries[themes[0]], `${label}: ${themes[0]} exists`);
    assert.ok(!owners.has(themes[0]), `${label}: ${master} does not share ${themes[0]} with ${owners.get(themes[0])}`);
    owners.set(themes[0], master);
    assert.ok(strFromU8(entries['[Content_Types].xml']).includes(`<Override PartName="/${themes[0]}" ContentType="${THEME_TYPE}"/>`), `${label}: ${themes[0]} has the theme content type`);
  }
  assert.equal(themeOf(entries, 'ppt/slideMasters/slideMaster1.xml')[0], 'ppt/theme/theme1.xml', `${label}: the slide master keeps theme1`);
  assert.equal(themeOf(entries, 'ppt/notesMasters/notesMaster1.xml')[0], 'ppt/theme/theme2.xml', `${label}: the notes master owns theme2`);
  // The copy mirrors the deck theme: the same fonts, colours and format scheme, so the notes text resolves to the deck's fonts.
  assert.equal(strFromU8(entries['ppt/theme/theme2.xml']), strFromU8(entries['ppt/theme/theme1.xml']), `${label}: the notes theme repeats the deck theme`);
  const app = strFromU8(entries['docProps/app.xml']);
  checkAppThemes(entries, label, expected);
  assert.equal([...app.matchAll(/<vt:lpstr>(Office Theme)<\/vt:lpstr>/g)].length >= 2 || !/Office Theme/.test(app), true, `${label}: app.xml names each theme part`);
  checkPackage(entries, label);
}

const slide = {id: 'one', title: 'Notes', text: 'Body', notes: 'Speaker notes'};
const decks = [
  {name: 'Plain', slides: [slide]},
  {name: 'Georgia', language: 'en', design: {fontScheme: 'georgia'}, slides: [slide, {id: 'chart', title: 'Chart', chart: {type: 'column', data: {columns: ['Quarter', 'Sales'], rows: [['Q1', 12], ['Q2', 15]]}}}]},
  {name: 'Meiryo', language: 'ja', design: {fontScheme: 'meiryo'}, slides: [{id: 'a', title: '日本語', text: 'こんにちは、世界。', notes: 'ノート'}]},
];
const positive = new Map();
for (const deck of decks) {
  const entries = unzipSync(await toPptx(structuredClone(deck), options));
  checkNotesTheme(entries, deck.name);
  positive.set(deck.name, entries);
}
// The deck's own fonts reach the notes theme: no Office default is introduced.
const georgia = unzipSync(await toPptx(structuredClone(decks[1]), options));
const notesTheme = strFromU8(georgia['ppt/theme/theme2.xml']);
assert.match(notesTheme, /<a:minorFont><a:latin typeface="Georgia"/, 'the notes theme names the deck body font');
assert.doesNotMatch(strFromU8(georgia['ppt/theme/theme2.xml']), /Aptos/, 'the notes theme names no default font');

// Every example deck (the exporter's corpus) has the same structure.
const image = new Uint8Array(await readFile(new URL('./fixtures/images/wide.png', import.meta.url)));
let corpus = 0;
for (const {file, deck: example} of examples) {
  const entries = unzipSync(await toPptx(structuredClone(example), {...options, imageResolver: async () => image}));
  const multilingual = /(?:^|\/)multilingual-slides\.opf\.json$/.test(file);
  checkNotesTheme(entries, file, multilingual ? FOUR_THEME : TWO_THEME);
  if (multilingual) {assert.ok(!positive.has('Multilingual'), 'the four-theme fixture is unique'); positive.set('Multilingual', entries);}
  corpus += 1;
}
assert.ok(corpus >= 20, 'the example corpus is exercised');
assert.ok(positive.has('Multilingual'), 'the authored four-theme fixture is exercised');
const rewriteApp = (entries, change) => ({...entries, 'docProps/app.xml': strToU8(change(strFromU8(entries['docProps/app.xml'])))});
const wrongCount = (entries, count) => rewriteApp(entries, app => app.replace(/(<vt:lpstr>Theme<\/vt:lpstr><\/vt:variant><vt:variant><vt:i4>)\d+(<\/vt:i4>)/, (_match, start, end) => start + count + end));
let negativeControls = 0;
for (const [name, expected, count] of [['Plain', TWO_THEME, 4], ['Multilingual', FOUR_THEME, 2]]) {
  assert.throws(() => checkNotesTheme(wrongCount(positive.get(name), count), name, expected), /app.xml lists all expected theme parts/); negativeControls++;
}
const plain = positive.get('Plain'), multilingual = positive.get('Multilingual');
const missing = {...multilingual}; delete missing['ppt/theme/theme3.xml'];
assert.throws(() => checkNotesTheme(missing, 'missing theme', FOUR_THEME), /exact expected theme parts/); negativeControls++;
const orphan = {...plain, 'ppt/theme/theme5.xml': plain['ppt/theme/theme1.xml']};
assert.throws(() => checkNotesTheme(orphan, 'orphan theme'), /exact expected theme parts/); negativeControls++;
const shared = {...multilingual, 'ppt/slideMasters/_rels/slideMaster2.xml.rels': strToU8(strFromU8(multilingual['ppt/slideMasters/_rels/slideMaster2.xml.rels']).replace('../theme/theme3.xml', '../theme/theme1.xml'))};
assert.throws(() => checkNotesTheme(shared, 'shared theme', FOUR_THEME), /references its expected theme part|does not share/); negativeControls++;
const wrongTitle = rewriteApp(multilingual, app => app.replace('<vt:lpstr>Minimal</vt:lpstr>', '<vt:lpstr>Wrong theme</vt:lpstr>'));
assert.throws(() => checkNotesTheme(wrongTitle, 'wrong title', FOUR_THEME), /app.xml theme titles/); negativeControls++;
console.log(JSON.stringify({test: 'notes-master-theme', passed: true, decks: decks.length, corpus, expectedThemeCounts: [2, 4], negativeControls}));
