import assert from 'node:assert/strict';
import path from 'node:path';
import {strFromU8, unzipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {readFile} from 'node:fs/promises';
import {examples} from '@openpresentation/opf/examples';
import {toPptx} from '../src/index.js';

// FF-05 (font-fidelity-everywhere). PowerPoint reads a package whose notes master shares the slide master's theme part
// as corrupt ("The file or directory is corrupted and unreadable", 0x80070570) once the notes master list is in schema
// order, and it ignores a misplaced notes master list and synthesises a default notes master in the default Office
// theme (Aptos). The exporter therefore gives the notes master its own theme part, a copy of the deck theme.
const REL_THEME = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme';
const THEME_TYPE = 'application/vnd.openxmlformats-officedocument.theme+xml';
const options = {seed: 1, date: '2026-10-02', timestamp: '2026-10-02T00:00:00Z', zipDate: '2026-10-02T00:00:00Z'};

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

function checkNotesTheme(entries, label) {
  const masters = names => Object.keys(entries).filter(name => names.test(name)).sort();
  const slideMasters = masters(/^ppt\/slideMasters\/slideMaster\d+\.xml$/), notesMasters = masters(/^ppt\/notesMasters\/notesMaster\d+\.xml$/);
  assert.ok(notesMasters.length > 0, `${label}: the export has a notes master`);
  const owners = new Map();
  for (const master of [...slideMasters, ...notesMasters]) {
    const themes = themeOf(entries, master);
    assert.equal(themes.length, 1, `${label}: ${master} has one theme relationship`);
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
  assert.match(app, /<vt:lpstr>Theme<\/vt:lpstr><\/vt:variant><vt:variant><vt:i4>2<\/vt:i4>/, `${label}: app.xml lists both theme parts`);
  assert.equal([...app.matchAll(/<vt:lpstr>(Office Theme)<\/vt:lpstr>/g)].length >= 2 || !/Office Theme/.test(app), true, `${label}: app.xml names each theme part`);
  checkPackage(entries, label);
}

const slide = {id: 'one', title: 'Notes', text: 'Body', notes: 'Speaker notes'};
const decks = [
  {name: 'Plain', slides: [slide]},
  {name: 'Georgia', language: 'english', design: {fontScheme: 'georgia'}, slides: [slide, {id: 'chart', title: 'Chart', chart: {type: 'column', data: {columns: ['Quarter', 'Sales'], rows: [['Q1', 12], ['Q2', 15]]}}}]},
  {name: 'Meiryo', language: 'ja', design: {fontScheme: 'meiryo'}, slides: [{id: 'a', title: '日本語', text: 'こんにちは、世界。', notes: 'ノート'}]},
];
for (const deck of decks) {
  const entries = unzipSync(await toPptx(structuredClone(deck), options));
  checkNotesTheme(entries, deck.name);
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
  checkNotesTheme(unzipSync(await toPptx(structuredClone(example), {...options, imageResolver: async () => image})), file);
  corpus += 1;
}
assert.ok(corpus >= 20, 'the example corpus is exercised');
console.log(JSON.stringify({test: 'notes-master-theme', passed: true, decks: decks.length, corpus}));
