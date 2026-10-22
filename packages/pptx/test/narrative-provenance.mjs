import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
import {validate} from '@openpresentation/opf';

// FA-02, OPF 0.15: the deck holds a reference, `narrative` (`id` or `name:id`), and `slides[].beat` links a slide to a beat
// of the plan. A custom narrative is a record in catalogs.custom.narratives. Export stores the reference and the beat links,
// and import restores them, in both provenance modes.
const dec = new TextDecoder();
const tagValue = xml => JSON.parse(Buffer.from(xml.match(/\bval="([^"]+)"/)[1], 'hex').toString('utf8'));
const record = {
  name: 'Proof Arc', duration: {min: 8, max: 20},
  beats: [{id: 'contract', name: 'Contract', type: 'text', layout: 'cover'}, {id: 'evidence', name: 'Evidence', type: 'chart'}, {id: 'ask', name: 'Ask', type: 'list'}]
};
const unrelated = {...structuredClone(record), name: 'Unused'};
const deck = narrative => ({
  name: 'Narrative deck', narrative, duration: 12,
  catalogs: {custom: {narratives: {'proof-arc': record, 'unused-arc': unrelated}}},
  slides: [
    {beat: 'contract', title: 'Contract', subtitle: 'What stays stable'},
    {beat: ['evidence', 'ask'], title: 'Proof', subtitle: 'And the ask'},
    {title: 'Appendix', subtitle: 'No beat'}
  ]
});
const read = async bytes => {
  const issues = [];
  const imported = await fromPptx(bytes, {onDiagnostic: issue => issues.push(issue)});
  { const report = validate(imported, {only: ['format']}); assert.equal(report.valid, true, JSON.stringify(report.findings)); }
  return {imported, issues};
};

for (const id of ['proof-arc', 'classic-story']) {
  const source = deck(id);
  { const report = validate(source, {only: ['format']}); assert.equal(report.valid, true, JSON.stringify(report.findings)); }
  const bytes = await toPptx(structuredClone(source));
  const stored = tagValue(dec.decode(unzipSync(bytes)['ppt/tags/opfDocument.xml']));
  assert.equal(stored.metadata.narrative, id, 'the narrative pointer is stored as the string');
  assert.equal(stored.metadata.duration, 12);
  assert.deepEqual(unzipSync(bytes)['ppt/tags/opfSlide2.xml'] && tagValue(dec.decode(unzipSync(bytes)['ppt/tags/opfSlide2.xml'])).beat, ['evidence', 'ask']);
  const {imported} = await read(bytes);
  assert.equal(imported.narrative, id);
  assert.equal(imported.duration, 12);
  assert.deepEqual(imported.slides.map(slide => slide.beat), ['contract', ['evidence', 'ask'], undefined]);
  // The custom record travels with the deck that references it, and only that record; a reference to a registered
  // catalog's record (classic-story) stores none.
  assert.deepEqual(imported.catalogs, id === 'proof-arc' ? {custom: {narratives: {'proof-arc': record}}} : undefined, 'only a referenced embedded record is stored');
}

// references-only keeps the pointer, the beat links and the inline record the pointer needs, and nothing personal.
{
  const bytes = await toPptx(deck('proof-arc'), {provenance: 'references-only'});
  const entries = unzipSync(bytes);
  const stored = tagValue(dec.decode(entries['ppt/tags/opfDocument.xml']));
  assert.equal(stored.metadata.narrative, 'proof-arc');
  assert.deepEqual(stored.catalogs, {custom: {narratives: {'proof-arc': record}}});
  assert.deepEqual(tagValue(dec.decode(entries['ppt/tags/opfSlide1.xml'])).beat, 'contract');
  const {imported} = await read(bytes);
  assert.equal(imported.narrative, 'proof-arc');
  assert.deepEqual(imported.slides.map(slide => slide.beat), ['contract', ['evidence', 'ask'], undefined]);
}

// A reference to a named group is stored in both modes, with the group declaration it needs (its source).
for (const provenance of ['full', 'references-only']) {
  const source = {name: 'Pointer', narrative: 'acme:proof', catalogs: {acme: {source: 'pkg:@acme/opf-catalog'}}, slides: [{title: 'One', beat: 'hook'}]};
  const {imported} = await read(await toPptx(source, {provenance}));
  assert.equal(imported.narrative, 'acme:proof', provenance);
  assert.deepEqual(imported.catalogs, {acme: {source: 'pkg:@acme/opf-catalog'}}, provenance);
  assert.equal(imported.slides[0].beat, 'hook');
}
