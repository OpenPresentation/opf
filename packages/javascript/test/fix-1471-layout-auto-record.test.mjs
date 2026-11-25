// opf#1471: remove-layout-auto also removes the embedded layout record "auto" when no slide names it after the fix and it fails the layout
// schema. A valid record, and a record a slide still names (qualified), stay. Only this one record: there is no general "unused invalid record" fix.
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fix, validate } from '../dist/index.js';

const catalogs = [gallery];
const invalid = { name: 'Auto', regions: 'not regions' };
const errors = (result) => result.findings.filter((finding) => finding.severity === 'error').map((finding) => `${finding.ruleId} ${finding.path}`);

describe('fix: the embedded layout record "auto"', () => {
  test('the invalid record goes with the last slide that names it, and the fixed deck is valid', () => {
    const input = { catalogs: { custom: { layouts: { auto: invalid } } }, slides: [{ layout: 'auto', title: 'T' }] };
    const result = fix(input, { catalogs });
    assert.deepEqual(errors(result), []);
    assert.equal(result.stopped, 'stable');
    assert.deepEqual(result.document.slides, [{ title: 'T' }]);
    assert.equal(result.document.catalogs?.custom?.layouts?.auto, undefined);
    assert.match(result.applied[0].title, /embedded layout record "auto"/);
    assert.equal(validate(result.document, { catalogs }).findings.some((finding) => finding.severity === 'error'), false);
  });

  test('two slides name it: the record goes once both are fixed', () => {
    const input = { catalogs: { custom: { layouts: { auto: invalid } } }, slides: [{ layout: 'auto', title: 'A' }, { layout: 'auto', title: 'B' }] };
    const result = fix(input, { catalogs });
    assert.deepEqual(errors(result), []);
    assert.deepEqual(result.document.slides, [{ title: 'A' }, { title: 'B' }]);
    assert.equal(JSON.stringify(result.document).includes('"auto"'), false);
  });

  test('the report\'s deck with two cell keys ends valid', () => {
    const input = { catalogs: { custom: { layouts: { auto: invalid } } }, slides: [{ layout: 'auto', 'top:start': { text: 'First' }, 'bottom:end': { text: 'Last' } }] };
    const result = fix(input, { catalogs });
    assert.deepEqual(errors(result), []);
    assert.deepEqual(result.document.slides[0].blocks, [{ region: 'top:start', text: 'First' }, { region: 'bottom:end', text: 'Last' }]);
    assert.equal(result.document.catalogs?.custom?.layouts?.auto, undefined);
  });

  test('a valid embedded record "auto" stays, and a slide that names it keeps its layout', () => {
    const valid = { ...gallery.layouts.text, name: 'Auto' };
    const input = { catalogs: { custom: { layouts: { auto: valid } } }, slides: [{ layout: 'auto', title: 'T' }] };
    const result = fix(input, { catalogs });
    assert.deepEqual(result.document, input);
  });

  test('a record that a slide still names by its qualified id stays, and so does an invalid record of another id', () => {
    const input = { catalogs: { custom: { layouts: { auto: invalid, other: invalid } } }, slides: [{ layout: 'auto', title: 'A' }, { layout: 'custom:auto', title: 'B' }] };
    const result = fix(input, { catalogs });
    assert.deepEqual(result.document.catalogs.custom.layouts, { auto: invalid, other: invalid });
    assert.deepEqual(result.document.slides[0], { title: 'A' });
    assert.equal(result.document.slides[1].layout, 'custom:auto');
  });
});
