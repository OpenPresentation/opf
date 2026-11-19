import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyPatch, validate } from '../dist/index.js';
import { layoutTemplate } from '../dist/composition.js';

// OPF 0.35 removed the layout region key `listColumns`: a long list flows into columns by default. A record that still sets it fails the
// layout schema; validate says what replaced it and offers the safe fix that deletes the key, and an engine handed the record ignores it.
const record = { name: 'Notes', direction: 'column', regions: [{ name: 'title' }, { direction: 'row', regions: [{ name: 'body', accepts: ['list'], listColumns: 'auto' }, { name: 'aside', accepts: ['text'], listColumns: 1 }] }] };
const deck = () => ({ catalogs: { custom: { layouts: { notes: structuredClone(record) } } }, slides: [{ layout: 'notes', title: 'Notes', blocks: [{ items: ['One', 'Two'] }] }] });

test('a region listColumns is an opf/catalog-record finding with what replaced it and the safe fix', () => {
  const document = deck(), report = validate(document);
  const findings = report.findings.filter((finding) => finding.path.endsWith('/listColumns'));
  assert.deepEqual(findings.map((finding) => finding.path), ['/catalogs/custom/layouts/notes/regions/1/regions/0/listColumns', '/catalogs/custom/layouts/notes/regions/1/regions/1/listColumns']);
  for (const finding of findings) {
    assert.equal(finding.ruleId, 'opf/catalog-record');
    assert.match(finding.help, /OPF 0\.35 removed the region key listColumns/);
    const fix = finding.fixes?.find((entry) => entry.id === 'remove:listColumns');
    assert.ok(fix, 'the safe fix deletes the key');
    assert.equal(fix.safe, true);
  }
  let fixed = document;
  for (const finding of validate(fixed).findings.filter((entry) => entry.path.endsWith('/listColumns')).reverse()) fixed = applyPatch(fixed, finding.fixes.find((entry) => entry.id === 'remove:listColumns').patch);
  assert.equal(JSON.stringify(fixed).includes('listColumns'), false);
  assert.equal(validate(fixed).findings.some((finding) => finding.ruleId === 'opf/catalog-record'), false);
});

test('an engine handed the record ignores the key', () => {
  assert.equal('listColumns' in layoutTemplate(record).regions[0], false);
});
