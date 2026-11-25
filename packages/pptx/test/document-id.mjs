import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
import {validate} from '@openpresentation/opf';

// CR 7: the document id. An opaque non-empty string in OPF_DOCUMENT_V1 (under `supplement.metadata`, so published importers that
// reject an unknown metadata key still read the tag), restored on import, kept in 'full' and 'references-only' provenance and
// dropped, with a report, when provenance is off. It is a claim: import restores the stored string as written.
const dec = new TextDecoder(), enc = new TextEncoder();
const tagValue = xml => JSON.parse(Buffer.from(xml.match(/\bval="([^"]+)"/)[1], 'hex').toString('utf8'));
const UUID = '0192f4c8-6b1e-7c3a-9d42-5e8f1a7b3c90';
const deck = (extra = {}) => ({name: 'Q3 business review', slides: [{id: 'summary', title: 'Summary'}], ...extra});
const roundTrip = async (document, options = {}) => {
  const diagnostics = [];
  const bytes = await toPptx(structuredClone(document), {...options, onDiagnostic: issue => diagnostics.push(issue)});
  const reportedAtImport = [];
  const imported = await fromPptx(bytes, {onDiagnostic: issue => reportedAtImport.push(issue)});
  return {bytes, diagnostics, imported, reportedAtImport};
};

// Full provenance: the id is stored in the supplement and restored exactly.
{
  const {bytes, diagnostics, imported} = await roundTrip(deck({id: UUID}));
  const tag = tagValue(dec.decode(unzipSync(bytes)['ppt/tags/opfDocument.xml']));
  assert.equal(tag.supplement.metadata.id, UUID);
  assert.equal(tag.metadata?.id, undefined, 'a published importer never sees an unknown legacy metadata key');
  assert.equal(imported.id, UUID);
  assert.equal(validate(imported, {only: ['format']}).valid, true);
  assert.deepEqual(diagnostics.filter(issue => issue.code === 'document-provenance-omitted'), []);
}

// Opaque strings are stored as written: a host's prefixed id, and strings that look like asset or media references.
for (const id of ['dk_5e8f1a7b3c909d426b1e7c3a', 'asset:logo', 'data:image/png;base64,AAAA', ' padded ', '12345', 'ünïcode ✓']) {
  const {imported, reportedAtImport} = await roundTrip(deck({id}));
  assert.equal(imported.id, id, JSON.stringify(id));
  assert.deepEqual(reportedAtImport.filter(issue => issue.code === 'unresolved-asset-reference'), [], JSON.stringify(id));
}

// references-only keeps the id (identity, not content).
{
  const {bytes, imported} = await roundTrip(deck({id: UUID}), {provenance: 'references-only'});
  assert.equal(tagValue(dec.decode(unzipSync(bytes)['ppt/tags/opfDocument.xml'])).supplement.metadata.id, UUID);
  assert.equal(imported.id, UUID);
}

// Provenance off: no tag, the id is dropped and the report says so; a deck without an id reports nothing.
{
  const {bytes, diagnostics, imported} = await roundTrip(deck({id: UUID}), {provenance: false});
  assert.equal(Object.keys(unzipSync(bytes)).some(path => /opfDocument/.test(path)), false);
  assert.equal(imported.id, undefined);
  const omitted = diagnostics.filter(issue => issue.code === 'document-provenance-omitted');
  assert.deepEqual(omitted.map(issue => issue.path), ['id']);
  const none = await roundTrip(deck(), {provenance: false});
  assert.deepEqual(none.diagnostics.filter(issue => issue.code === 'document-provenance-omitted'), []);
}

// A deck without an id exports and imports without one, and its package is unchanged by this feature.
{
  const {imported} = await roundTrip(deck());
  assert.equal(Object.hasOwn(imported, 'id'), false);
  const a = await toPptx(deck()), b = await toPptx(deck());
  assert.deepEqual(a, b);
}

// An empty or non-string stored id rejects the tag (invalid-document-provenance) and keeps the observed values.
for (const bad of ['""', '7']) {
  const bytes = await toPptx(deck({id: UUID}));
  const entries = unzipSync(bytes);
  const tag = tagValue(dec.decode(entries['ppt/tags/opfDocument.xml']));
  tag.supplement.metadata.id = JSON.parse(bad);
  const hex = Buffer.from(JSON.stringify(tag), 'utf8').toString('hex').toUpperCase();
  entries['ppt/tags/opfDocument.xml'] = enc.encode(dec.decode(entries['ppt/tags/opfDocument.xml']).replace(/\bval="[^"]+"/, `val="${hex}"`));
  const issues = [];
  const imported = await fromPptx(zipSync(entries), {onDiagnostic: issue => issues.push(issue)});
  assert.equal(imported.id, undefined, bad);
  assert.ok(issues.some(issue => issue.code === 'invalid-document-provenance'), bad);
}

// Editing the deck in PowerPoint does not change the id: a changed title and slide still import with the stored id.
{
  const bytes = await toPptx(deck({id: UUID, slides: [{id: 'summary', title: 'Summary'}, {id: 'next', title: 'Next'}]}));
  const entries = unzipSync(bytes);
  entries['ppt/slides/slide1.xml'] = enc.encode(dec.decode(entries['ppt/slides/slide1.xml']).replace('Summary', 'Edited in PowerPoint'));
  const imported = await fromPptx(zipSync(entries));
  assert.equal(imported.id, UUID);
}
