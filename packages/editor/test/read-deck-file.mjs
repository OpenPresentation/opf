import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { DECK_FILE_ACCEPT, DeckFileError, deckFileFormat, deckFileName, readDeckFile } from '../src/read-deck-file.js';

// RR-98: readDeckFile reads a deck file in any OPF source format. Fixtures are in test/fixtures/deck-files; each is read both as a
// File (what an <input type="file"> gives) and as { name, text }.
const directory = new URL('./fixtures/deck-files/', import.meta.url);
const text = (name) => readFile(new URL(name, directory), 'utf8');
const asFile = async (name, fileName = name) => new File([await text(name)], fileName);
const asText = async (name, fileName = name) => ({ name: fileName, text: await text(name) });
const expectDeck = {
  name: 'Quarterly review',
  slides: [{ title: 'Results', text: 'Revenue grew in every region.' }, { title: 'Next steps', text: 'Hire two engineers.' }],
};
const rejects = async (promise, code, pattern) => {
  const error = await promise.then(() => assert.fail('expected a DeckFileError'), (caught) => caught);
  assert.ok(error instanceof DeckFileError, `a DeckFileError, not ${error}`);
  assert.equal(error.name, 'DeckFileError');
  assert.equal(error.code, code, error.message);
  if (pattern) assert.match(error.message, pattern);
  return error;
};

// The accept list: the five extensions, no duplicates.
assert.equal(DECK_FILE_ACCEPT, '.json,.opf,.yaml,.yml,.md');
assert.equal(new Set(DECK_FILE_ACCEPT.split(',')).size, DECK_FILE_ACCEPT.split(',').length, 'no duplicate extension');

// Each format, by its extension, from a File and from { name, text }.
for (const make of [asFile, asText]) {
  const json = await readDeckFile(await make('quarterly.opf.json'));
  assert.deepEqual(json, { document: expectDeck, format: 'json', name: 'quarterly', findings: [] });
  const yaml = await readDeckFile(await make('quarterly.opf.yaml'));
  assert.deepEqual(yaml, { document: expectDeck, format: 'yaml', name: 'quarterly', findings: [] });
  const markdown = await readDeckFile(await make('quarterly.opf.md'));
  assert.deepEqual(markdown, { document: expectDeck, format: 'md', name: 'quarterly', findings: [] });
  const yml = await readDeckFile(await make('plain.yml'));
  assert.equal(yml.format, 'yaml');
  assert.equal(yml.name, 'plain');
  assert.deepEqual(yml.document.slides, [{ title: 'Only slide' }]);
}

// A snippet wrapper around a deck is unwrapped, as the paste path does.
const wrapped = await readDeckFile({ name: 'wrapped.json', text: JSON.stringify({ opfSnippet: expectDeck }) });
assert.deepEqual(wrapped.document, expectDeck);

// Names: the file name without .opf.json, .opf.yaml, .opf.md or its plain extension, without a directory.
const names = [
  ['deck.opf.json', 'deck'], ['deck.opf.yaml', 'deck'], ['deck.opf.yml', 'deck'], ['deck.opf.md', 'deck'], ['Deck.OPF.JSON', 'Deck'],
  ['deck.opf', 'deck'], ['deck.json', 'deck'], ['deck.yaml', 'deck'], ['deck.yml', 'deck'], ['deck.md', 'deck'], ['deck.txt', 'deck'], ['deck', 'deck'],
  ['Q3 review.v2.opf.json', 'Q3 review.v2'], ['my.deck.json', 'my.deck'], ['C:\\decks\\sales.opf.md', 'sales'], ['decks/sales.yaml', 'sales'], ['.json', 'deck'], ['', 'deck'],
];
for (const [fileName, expected] of names) assert.equal(deckFileName(fileName), expected, `name of ${JSON.stringify(fileName)}`);
assert.equal((await readDeckFile({ name: 'Q3 plan.opf.yaml', text: 'slides:\n  - title: x\n' })).name, 'Q3 plan');

// The extension decides the format first.
for (const [fileName, format] of [['a.yaml', 'yaml'], ['a.YML', 'yaml'], ['a.md', 'md'], ['a.markdown', 'md'], ['a.json', 'json'], ['a.opf', 'json'], ['a.txt', 'json'], ['a', 'json'], ['a.opf.yaml', 'yaml'], ['a.opf.md', 'md']]) {
  assert.equal(deckFileFormat(fileName), format, fileName);
}

// Fallbacks: text that is not JSON is tried as YAML, then, with front matter, as Markdown. `format` is the one that read it.
const yamlInJson = await readDeckFile(await asFile('yaml-named.json'));
assert.equal(yamlInJson.format, 'yaml', 'YAML in a .json file reads as YAML');
assert.deepEqual(yamlInJson.document, expectDeck);
assert.equal(yamlInJson.name, 'yaml-named');
const markdownInJson = await readDeckFile(await asText('markdown-named.json'));
assert.equal(markdownInJson.format, 'md', 'Markdown with front matter in a .json file reads as Markdown');
assert.deepEqual(markdownInJson.document, expectDeck);
const marker = await readDeckFile(await asText('yaml-document-marker.opf'));
assert.equal(marker.format, 'yaml', 'YAML that starts with --- is still YAML when it is one document');
assert.equal(marker.document.name, 'Marker deck');
assert.equal((await readDeckFile({ name: 'x.opf', text: '\uFEFF' + JSON.stringify(expectDeck) })).format, 'json', 'a byte order mark is ignored');
assert.equal((await readDeckFile({ name: 'crlf.md', text: (await text('quarterly.opf.md')).replace(/\n/g, '\r\n') })).document.slides.length, 2, 'CRLF Markdown reads');

// Findings: the conversion's findings, with a path where there is one. A deck with OPF errors is returned, with them.
const unknown = await readDeckFile(await asFile('unknown-key.yaml'));
assert.equal(unknown.format, 'yaml');
assert.deepEqual(unknown.document.slides, [{ title: 'Fine' }, { bogus: 1 }]);
assert.ok(unknown.findings.length >= 1);
const finding = unknown.findings.find((entry) => entry.path === '/slides/1/bogus') ?? unknown.findings[0];
assert.equal(finding.severity, 'error');
assert.match(finding.ruleId, /^opf\//);
assert.equal(typeof finding.message, 'string');
assert.equal(finding.path, '/slides/1/bogus', 'a finding carries the JSON Pointer of the field');
assert.ok(finding.location.line >= 1, 'and its line in the file');
const markdownFindings = await readDeckFile({ name: 'x.md', text: '---\nname: X\nbogus: true\n---\n\n# One\n' });
assert.ok(markdownFindings.findings.some((entry) => entry.severity === 'error' && /bogus/.test(entry.path + entry.message)), 'Markdown front matter findings are returned');

// Errors: typed, with a clear message, for every kind of unreadable file.
let error = await rejects(readDeckFile(await asFile('broken.yaml')), 'invalid-yaml', /^This is not valid YAML \(line \d+\)/);
assert.equal(error.format, 'yaml');
assert.ok(error.findings.length >= 1 && error.findings[0].ruleId.startsWith('yaml/'));
error = await rejects(readDeckFile(await asFile('broken.json')), 'invalid-json', /not valid JSON/);
assert.equal(error.format, 'json');
assert.equal(error.fileName, 'broken.json');
await rejects(readDeckFile(await asFile('notes.txt')), 'invalid-json', /not valid JSON/);
await rejects(readDeckFile(await asFile('single-slide.json')), 'not-a-deck', /"slides" list/);
await rejects(readDeckFile(await asFile('empty.json')), 'empty-file', /empty\.json is empty/);
await rejects(readDeckFile({ name: 'blank.yaml', text: '  \n' }), 'empty-file');
await rejects(readDeckFile(await asFile('fake.pptx')), 'unsupported-file', /PowerPoint or other binary/);
await rejects(readDeckFile({ name: 'big.json', size: 21 * 1024 * 1024, text: async () => '{}' }), 'file-too-large', /smaller than 20 MB/);
await rejects(readDeckFile({ name: 'big.json', text: ' '.repeat(21 * 1024 * 1024) + '{}' }), 'file-too-large');
await rejects(readDeckFile(undefined), 'unreadable');
await rejects(readDeckFile({ name: 'x.json' }), 'unreadable');
await rejects(readDeckFile({ name: 'x.json', text: async () => { throw new Error('disk gone'); } }), 'unreadable', /x\.json could not be read\. disk gone/);

// Every fixture is covered above.
const covered = new Set(['broken.json', 'broken.yaml', 'empty.json', 'fake.pptx', 'markdown-named.json', 'notes.txt', 'plain.yml', 'quarterly.opf.json', 'quarterly.opf.md', 'quarterly.opf.yaml', 'single-slide.json', 'unknown-key.yaml', 'yaml-document-marker.opf', 'yaml-named.json']);
assert.deepEqual((await readdir(directory)).sort(), [...covered].sort(), 'every fixture file is used');

// Package wiring.
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.deepEqual(pkg.exports['./read-deck-file'], { types: './dist/read-deck-file.d.ts', default: './dist/read-deck-file.js' });
assert.match(await readFile(new URL('../src/read-deck-file.d.ts', import.meta.url), 'utf8'), /export declare function readDeckFile/);
console.log('RR-98 readDeckFile ok');
