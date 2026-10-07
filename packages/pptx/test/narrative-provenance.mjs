import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
import {validate} from '@openpresentation/opf';

// FA-02: the deck holds a pointer, `narrative` (a catalog id, URL or pkg: reference), and `slides[].beat` links a slide
// to a beat of the plan. A custom narrative is a record in catalogs.narratives.records. Export stores the string and
// the beat links, and import restores them, in both provenance modes.
const dec = new TextDecoder();
const tagValue = xml => JSON.parse(Buffer.from(xml.match(/\bval="([^"]+)"/)[1], 'hex').toString('utf8'));
const record = {
  $schema: 'https://openpresentation.org/schema/opf-narrative/v1', id: 'proof-arc', name: 'Proof Arc', duration: {min: 8, max: 20},
  beats: [{id: 'contract', name: 'Contract', type: 'text', layout: 'title-subtitle'}, {id: 'evidence', name: 'Evidence', type: 'chart'}, {id: 'ask', name: 'Ask', type: 'list'}]
};
const unrelated = {...structuredClone(record), id: 'unused-arc', name: 'Unused'};
const deck = narrative => ({
  name: 'Narrative deck', narrative, duration: 12,
  catalogs: {narratives: {records: [record, unrelated]}},
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
  // The custom record travels with the deck that references it, and only that record.
  const records = imported.catalogs?.narratives?.records ?? [];
  assert.deepEqual(records.map(entry => entry.id), id === 'proof-arc' ? ['proof-arc'] : [], 'only a referenced inline record is stored');
  if (id === 'proof-arc') assert.deepEqual(records[0], record);
}

// references-only keeps the pointer, the beat links and the inline record the pointer needs, and nothing personal.
{
  const bytes = await toPptx(deck('proof-arc'), {provenance: 'references-only'});
  const entries = unzipSync(bytes);
  const stored = tagValue(dec.decode(entries['ppt/tags/opfDocument.xml']));
  assert.equal(stored.metadata.narrative, 'proof-arc');
  assert.deepEqual(stored.catalogs.narratives.records.map(entry => entry.id), ['proof-arc']);
  assert.deepEqual(tagValue(dec.decode(entries['ppt/tags/opfSlide1.xml'])).beat, 'contract');
  const {imported} = await read(bytes);
  assert.equal(imported.narrative, 'proof-arc');
  assert.deepEqual(imported.slides.map(slide => slide.beat), ['contract', ['evidence', 'ask'], undefined]);
}

// A URL or pkg: reference is stored in full mode (any string) and not in references-only (it is no catalog id).
for (const pointer of ['https://example.com/arcs/proof.json', 'pkg:@acme/arcs/proof']) {
  const full = await read(await toPptx({name: 'Pointer', narrative: pointer, slides: [{title: 'One', beat: 'hook'}]}));
  assert.equal(full.imported.narrative, pointer);
  assert.equal(full.imported.slides[0].beat, 'hook');
  const refs = await read(await toPptx({name: 'Pointer', narrative: pointer, slides: [{title: 'One', beat: 'hook'}]}, {provenance: 'references-only'}));
  assert.equal(refs.imported.narrative, undefined);
  assert.equal(refs.imported.slides[0].beat, 'hook');
}
