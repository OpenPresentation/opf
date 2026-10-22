import assert from 'node:assert/strict';
import { createEditorSession } from '../dist/index.js';
import { errorText, normalizeFinding, rejectionFindings } from '../dist/source-findings.js';
import { validate } from '@openpresentation/opf';

// RR-98: when the session refuses a draft, the source pane lists every issue of the rejection, each with its JSON pointer path.
const draft = { name: 'Strict', slides: [{ title: 42 }, { title: 'Agenda', items: 'One string, not an array' }, { title: 'Third', unknown: true }] };
const session = createEditorSession({ name: 'Strict', slides: [{ title: 'T' }] }, { rejectInvalid: true });
let refusal;
try { session.applyPatch([{ op: 'replace', path: '', value: draft }]); } catch (error) { refusal = error; }
assert.equal(refusal?.code, 'invalid-opf-edit', 'a strict session refuses the draft');
const found = rejectionFindings(refusal);
const errors = validate(draft, { only: ['format'] }).findings.filter((finding) => finding.severity === 'error');
assert.ok(errors.length >= 3, 'the draft has several validator errors');
assert.equal(found.length, errors.length, 'one finding per validator error, not only the first');
assert.equal(found.length, refusal.issues.length);
assert.deepEqual(found.map((finding) => finding.path), errors.map((finding) => finding.path), 'each finding has its JSON pointer');
assert.ok(found.every((finding) => finding.path.startsWith('/slides/') && finding.severity === 'error' && finding.kind === 'rejected' && finding.message));
assert.deepEqual(found.map((finding) => finding.path).slice(0, 2), ['/slides/0/title', '/slides/1/items']);
assert.equal(session.presentation.slides[0].title, 'T', 'the document is unchanged');

// Repeats of one path and message stay: the count is the validator's.
const twice = rejectionFindings({ message: 'refused', issues: [{ path: '/a', message: 'bad', severity: 'error' }, { path: '/a', message: 'bad', severity: 'error' }] });
assert.equal(twice.length, 2);
// No issues: the message is the one finding. Issues that carry no kind or severity are still errors of kind "rejected".
assert.deepEqual(rejectionFindings(new Error('boom')), [{ path: '', message: 'boom', severity: 'error', kind: 'rejected' }]);
assert.deepEqual(rejectionFindings({ message: 'x', issues: [] }), [{ path: '', message: 'x', severity: 'error', kind: 'rejected' }]);
assert.deepEqual(rejectionFindings({ issues: [{ path: '/n', message: 'm' }] }), [{ path: '/n', message: 'm', severity: 'error', kind: 'rejected' }]);
assert.equal(errorText({ issues: [{ message: 'first' }, { message: 'second' }] }), 'first');
assert.equal(normalizeFinding({ severity: 'warn', message: 'w', line: 3 }, 'format').severity, 'warning');
console.log('Source findings: every rejection issue becomes one finding with its path.');
