// RR-59 (AUTO-18 / EVAL-24): a full-provenance round trip restores the absence of document-level defaults. Export bakes
// engine defaults into the package (the canonical $schema, the package title, the runs' language, the generated theme's
// colour scheme, fonts and slide size); OPF_DOCUMENT_V1.absent lists the ones the document did not state, and import leaves
// them absent while the native value is still the default export wrote. A value edited in PowerPoint is imported as observed.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {gallery as defaultCatalog} from '@openpresentation/gallery';
import {fromPptx, toPptx} from '../dist/index.js';

const SCHEMA = 'https://openpresentation.org/schema/opf/v1';
const edit = (bytes, transform) => {
  const parts = unzipSync(bytes);
  for (const name of Object.keys(parts)) if (/\.(xml|rels)$/.test(name)) parts[name] = strToU8(transform(name, strFromU8(parts[name])));
  return zipSync(parts);
};
const tagOf = (bytes, part = 'ppt/tags/opfDocument.xml') => {
  const xml = unzipSync(bytes)[part];
  return xml && JSON.parse(Buffer.from(strFromU8(xml).match(/\bval="([^"]+)"/)[1], 'hex').toString('utf8'));
};
const retag = (bytes, mutate) => edit(bytes, (name, xml) => name !== 'ppt/tags/opfDocument.xml' ? xml : xml.replace(/\bval="([^"]+)"/, (_match, hex) => {
  const value = JSON.parse(Buffer.from(hex, 'hex').toString('utf8'));
  mutate(value);
  return `val="${Buffer.from(JSON.stringify(value), 'utf8').toString('hex').toUpperCase()}"`;
}));
const read = async (bytes, options = {}) => {
  const diagnostics = [];
  const deck = await fromPptx(bytes, {...options, onDiagnostic: issue => diagnostics.push(issue)});
  return {deck, diagnostics, provenance: diagnostics.filter(issue => /provenance|reference-changed/.test(issue.code))};
};
let checks = 0;

// 1. Untouched round trips are deep-equal to the source, with and without the defaulted keys.
const decks = {
  minimal: {slides: [{title: 'Hello'}]},
  content: {slides: [{title: 'Hello', text: 'Body'}, {title: 'Two', text: 'More'}]},
  filename: {filename: 'deck.pptx', slides: [{title: 'Named by its file'}]},
  'theme only': {name: 'Theme', design: {theme: 'minimal'}, slides: [{title: 'Hello', text: 'x'}]},
  'font scheme only': {name: 'Fonts', design: {fontScheme: 'arial'}, slides: [{title: 'Hello'}]},
  'every default stated': {$schema: SCHEMA, name: 'Stated', language: 'en-US', design: {colorScheme: 'ocean', dimensions: {widthInches: 10, heightInches: 7.5}}, slides: [{title: 'Hello'}]},
  'another language': {language: 'fr-FR', slides: [{title: 'Bonjour', text: 'Texte'}]},
  'author and description': {name: 'Meta', author: 'Ann Lee', description: 'About the deck', slides: [{title: 'Hello'}]},
};
for (const [label, deck] of Object.entries(decks)) {
  for (const catalogs of [undefined, [defaultCatalog]]) {
    const options = catalogs ? {catalogs} : {};
    const bytes = await toPptx(structuredClone(deck), options);
    const {deck: imported, provenance} = await read(bytes, options);
    assert.deepEqual(imported, deck, `${label}${catalogs ? ' (default catalog registered)' : ''}: untouched round trip`);
    assert.deepEqual(provenance, [], `${label}: no provenance diagnostics`);
    checks++;
  }
}

// 2. The record: 'full' lists exactly the unstated defaults; 'references-only' and false record no absence.
{
  assert.deepEqual(tagOf(await toPptx(decks.minimal)).absent, ['$schema', 'name', 'language', 'design.theme', 'design.colorScheme', 'design.fontScheme', 'design.dimensions']);
  assert.equal(tagOf(await toPptx(decks['every default stated'])).absent.join(','), 'design.theme,design.fontScheme');
  assert.equal(tagOf(await toPptx(decks.minimal, {provenance: 'references-only'})), undefined, "'references-only': a document that states nothing gets no tags");
  assert.equal(tagOf(await toPptx(decks['theme only'], {provenance: 'references-only'})).absent, undefined, "'references-only' records no absence");
  assert.equal(tagOf(await toPptx(decks.minimal, {provenance: false})), undefined);
  // Without provenance the observed defaults return, as before.
  const plain = (await read(await toPptx(decks.minimal, {provenance: false}))).deck;
  assert.equal(plain.$schema, SCHEMA);
  assert.equal(plain.name, 'OPF Presentation');
  assert.equal(plain.language, 'en-US');
  assert.equal(typeof plain.design.colorScheme, 'object');
  assert.ok(plain.design.dimensions);
  checks++;
}

// 3. Export does not depend on whether the keys exist: the package differs only in its provenance tags.
{
  const strip = bytes => Object.fromEntries(Object.entries(unzipSync(bytes)).filter(([name]) => !/^ppt\/tags\/opf/.test(name)).map(([name, data]) => [name, /\.(xml|rels)$/.test(name)
    ? strFromU8(data).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, '').replace(/<Relationship Id="rIdOpf[^"]*"[^>]*\/>/g, '').replace(/<Override PartName="\/ppt\/tags\/[^"]*"[^>]*\/>/g, '')
    : Buffer.from(data).toString('base64')]));
  const options = {seed: 1, timestamp: '2026-01-01T00:00:00Z'};
  assert.deepEqual(strip(await toPptx(decks.minimal, options)), strip(await toPptx(decks.minimal, {...options, provenance: false})));
  checks++;
}

// 4. Native edits win: a value changed in PowerPoint imports as observed, with no diagnostic (nothing stated was lost).
{
  const deck = decks.content, bytes = await toPptx(deck);
  const accent = await read(edit(bytes, (name, xml) => name === 'ppt/theme/theme1.xml' ? xml.replace(/(<a:accent1><a:srgbClr val=")[^"]+/, '$100FF00') : xml));
  assert.equal(accent.deck.design.colorScheme.accent1, '#00FF00', 'a changed theme colour imports the observed colour scheme');
  assert.equal(accent.deck.design.dimensions, undefined, 'the unchanged slide size stays absent');
  assert.equal(accent.deck.$schema, undefined);
  const size = await read(edit(bytes, (name, xml) => name === 'ppt/presentation.xml' ? xml.replace(/<p:sldSz cx="\d+" cy="\d+"/, '<p:sldSz cx="9144000" cy="6858000"') : xml));
  assert.deepEqual(size.deck.design, {dimensions: {widthInches: 10, heightInches: 7.5}}, 'a changed slide size imports');
  const title = await read(edit(bytes, (name, xml) => name === 'docProps/core.xml' ? xml.replace(/<dc:title>[^<]*<\/dc:title>/, '<dc:title>Renamed</dc:title>') : xml));
  assert.equal(title.deck.name, 'Renamed', 'a title set in PowerPoint imports as the name');
  const language = await read(edit(bytes, (name, xml) => /^ppt\/slides\/slide\d+\.xml$/.test(name) ? xml.replaceAll('lang="en-US"', 'lang="fr-FR"') : xml));
  assert.equal(language.deck.language, 'fr-FR', 'a language set in PowerPoint imports');
  const author = await read(edit(bytes, (name, xml) => name === 'docProps/core.xml' ? xml.replace(/<dc:creator>[^<]*<\/dc:creator>/, '<dc:creator>Bo Chan</dc:creator>') : xml));
  assert.equal(author.deck.author, 'Bo Chan', 'an author set in PowerPoint imports');
  const background = await read(edit(bytes, (name, xml) => name === 'ppt/slides/slide1.xml' ? xml.replace(/<p:bg>[\s\S]*?<\/p:bg>/, '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>') : xml));
  assert.deepEqual(background.deck.slides[0].design, {background: {type: 'solid', color: '#FF0000'}}, 'a changed slide background imports');
  assert.equal(background.deck.slides[1].design, undefined, 'an unchanged slide keeps inheriting');
  for (const result of [accent, size, title, language, author, background]) {
    assert.deepEqual(result.provenance, []);
    const {slides: _slides, ...rest} = result.deck;
    assert.ok(!Object.keys(rest).some(key => !['$schema', 'name', 'language', 'author', 'design'].includes(key)));
  }
  // A stated theme whose colours were edited: the theme is reported and both observed values stay.
  const themed = await read(edit(await toPptx(decks['theme only'], {catalogs: [defaultCatalog]}), (name, xml) => name === 'ppt/theme/theme1.xml' ? xml.replace(/(<a:accent1><a:srgbClr val=")[^"]+/, '$100FF00') : xml), {catalogs: [defaultCatalog]});
  assert.equal(themed.deck.design.colorScheme.accent1, '#00FF00');
  assert.deepEqual(themed.provenance.map(issue => [issue.code, issue.path]), [['design-reference-changed', 'design.theme']]);
  checks++;
}

// 5. An importer `schema` option still names the $schema; a tag without `absent` (an older exporter) imports as before.
{
  const bytes = await toPptx(decks.minimal);
  assert.equal((await read(bytes, {schema: SCHEMA})).deck.$schema, SCHEMA);
  const older = (await read(retag(bytes, value => { delete value.absent; }))).deck;
  assert.equal(older.$schema, SCHEMA);
  assert.equal(older.name, 'OPF Presentation');
  assert.equal(older.language, 'en-US');
  assert.ok(older.design.colorScheme && older.design.dimensions);
  assert.equal(older.author, undefined, 'the default author is still dropped whenever the document tag exists');
  checks++;
}

// 6. Untrusted records: unknown paths are ignored, a malformed list rejects the tag.
{
  const bytes = await toPptx(decks.minimal);
  const unknown = await read(retag(bytes, value => { value.absent = ['$schema', 'design.watermark', 'slides', '__proto__']; }));
  assert.equal(unknown.deck.$schema, undefined);
  assert.equal(unknown.deck.name, 'OPF Presentation', 'only listed paths stay absent');
  assert.deepEqual(unknown.provenance, []);
  for (const absent of ['$schema', [1], Array.from({length: 65}, () => 'name')]) {
    const invalid = await read(retag(bytes, value => { value.absent = absent; }));
    assert.deepEqual(invalid.provenance.map(issue => [issue.code, issue.path]), [['invalid-document-provenance', '']]);
    assert.equal(invalid.deck.$schema, SCHEMA, 'a rejected tag keeps the observed values');
  }
  checks++;
}

console.log(`RR-59 absent defaults passed: ${checks} checks (untouched round trips with and without the defaulted keys, the absent record per mode, tag-only package difference, native edits win, older tags and the schema option, untrusted records).`);
