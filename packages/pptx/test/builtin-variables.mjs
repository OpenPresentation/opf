import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
import {validate} from '@openpresentation/opf';

// FA-04: built-in variables resolve before export, and the `speaker` furniture field exports as static text
// ("Name, Title") whose flag, speaker id, name and title return on import, as the organization field does.
const dec = new TextDecoder(), enc = new TextEncoder();
const slideXml = (entries, index = 1) => dec.decode(entries[`ppt/slides/slide${index}.xml`]);
const modify = (bytes, mutate) => { const entries = unzipSync(bytes); mutate(entries); return zipSync(entries); };
const read = async (bytes) => { const issues = []; const deck = await fromPptx(bytes, {onDiagnostic: issue => issues.push(issue)}); assert.equal(validate(deck, {only: ['format']}).valid, true, JSON.stringify(validate(deck, {only: ['format']}).findings)); return {deck, issues}; };

const source = {
  name: 'Q4 Review',
  speaker: [{id: 'ada', name: 'Ada Lovelace', title: 'CTO'}, {id: 'grace', name: 'Grace Hopper'}],
  organization: {id: 'acme', name: 'Acme Corp', tagline: 'Build the future'},
  design: {footer: {left: {organization: true, speaker: true}, right: {text: '{{organization.tagline}}'}}},
  slides: [{id: 'cover', title: '{{deck.name}}', subtitle: '{{speaker.name}}, {{speaker.title}} · {{organization.name}}'}, {id: 'next', title: 'By {{speakers}}', text: 'Body'}]
};
const before = structuredClone(source);
const bytes = await toPptx(source);
assert.deepEqual(source, before, 'Export leaves the source unchanged.');
assert.deepEqual(await toPptx(source), bytes, 'Export is deterministic.');
const entries = unzipSync(bytes), xml = slideXml(entries), second = slideXml(entries, 2);
for (const text of ['Q4 Review', 'Ada Lovelace, CTO · Acme Corp', 'Build the future', 'Acme Corp', 'Ada Lovelace, CTO']) assert.ok(xml.includes(`<a:t>${text}</a:t>`), text);
assert.ok(second.includes('<a:t>By Ada Lovelace, Grace Hopper</a:t>'), 'the speakers list joins');
assert.ok(!xml.includes('{{'), 'no unresolved token reaches the file');
// The speaker line is static text after the organization line in the same zone (never a field).
assert.ok(xml.indexOf('<a:t>Acme Corp</a:t>') < xml.indexOf('<a:t>Ada Lovelace, CTO</a:t>', xml.indexOf('<a:t>Acme Corp</a:t>')));

// Import restores the flag and the speaker's name and title; the stored deck wins where nothing changed.
const {deck} = await read(bytes);
assert.equal(deck.design.footer.left.speaker, true);
assert.equal(deck.design.footer.left.organization, true);
assert.deepEqual(deck.speaker, source.speaker, 'Stored speakers return with the unedited furniture line.');
assert.ok(!(await read(bytes)).issues.some(issue => issue.code === 'invalid-furniture-provenance'));

// Without document provenance the furniture line alone rebuilds the first speaker (name and title split at the recorded length).
const plain = await read(await toPptx(source, {provenance: false}));
assert.deepEqual(plain.deck.speaker, {id: 'ada', name: 'Ada Lovelace', title: 'CTO'});
assert.equal(plain.deck.design.footer.left.speaker, true);
// A speaker with no title is the name alone.
const noTitle = structuredClone(source);
noTitle.speaker = {id: 'solo', name: 'Solo, Jr.'};
assert.deepEqual((await read(await toPptx(noTitle, {provenance: false}))).deck.speaker, {id: 'solo', name: 'Solo, Jr.'});

// Current native words win: an edited line is the new name and title; a line without the separator is the whole name.
const retitled = await read(modify(bytes, entries => { for (const index of [1, 2]) entries[`ppt/slides/slide${index}.xml`] = enc.encode(slideXml(entries, index).replace('<a:t>Ada Lovelace, CTO</a:t>', '<a:t>Ada Lovelace, CEO</a:t>')); }));
assert.deepEqual(retitled.deck.speaker[0], {id: 'ada', name: 'Ada Lovelace', title: 'CEO'});
assert.deepEqual(retitled.deck.speaker[1], source.speaker[1], 'Other stored speakers are kept.');
const renamed = await read(modify(bytes, entries => { for (const index of [1, 2]) entries[`ppt/slides/slide${index}.xml`] = enc.encode(slideXml(entries, index).replace('<a:t>Ada Lovelace, CTO</a:t>', '<a:t>Augusta Ada</a:t>')); }));
assert.deepEqual(renamed.deck.speaker[0], {id: 'ada', name: 'Augusta Ada'});

// A missing source: the field is unresolved content, a built-in resolves to nothing and is reported.
const bare = structuredClone(source);
delete bare.speaker;
bare.slides = [{id: 'cover', title: 'By {{speaker.name}}'}];
const seen = [];
await toPptx(bare, {onDiagnostic: entry => seen.push(entry.code)});
assert.ok(seen.includes('variable-builtin-missing'));
console.log('PPTX built-in variables passed: resolution before export, speaker furniture text, provenance round trip, edits and missing sources.');
