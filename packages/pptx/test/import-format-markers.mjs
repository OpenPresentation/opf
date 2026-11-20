import assert from 'node:assert/strict';
import {checkFormat, checkImportedFormat} from '../dist/format-check.js';
import {restoreTableData} from '../dist/data-provenance.js';

const nativeRun = text => ({text, color: '#FFFFFF', _opfScheme: 'light1'});
const native = {rows: [[{value: [nativeRun('13')]}, {value: [nativeRun('12')]}]]};
const candidate = {rows: [[native.rows[0][0], '12']]};
const payload = table => ({slides: [{title: 'Data', table}]});
const before = structuredClone(native);
assert.equal(checkFormat(payload(candidate)).valid, false);
assert.equal(checkImportedFormat(payload(candidate), native).valid, true);
assert.deepEqual(native, before, 'Validation does not remove the native color evidence');

const injected = {rows: [[native.rows[0][0], {value: [{text: 'stored', _opfInjected: 'untrusted'}]}]]};
const invalid = checkImportedFormat(payload(injected), native);
assert.equal(invalid.valid, false, 'A stored object gets no native-marker exception');
assert.ok(invalid.findings.some(issue => issue.path.endsWith('/_opfInjected')));
const lookalike = {rows: [[native.rows[0][0], {value: [structuredClone(native.rows[0][1].value[0])]}]]};
assert.equal(checkImportedFormat(payload(lookalike), native).valid, false, 'Even a known marker on a copied stored run gets no native-object trust');

const diagnostics = [];
const record = {authored: {rows: [[12, '12']]}, environment: 'same-theme', evidence: [['old-first', 'same-second']]};
const options = {environment: 'same-theme', evidence: [['edited-first', 'same-second']], report: issue => diagnostics.push(issue)};
const restored = restoreTableData(native, record, options);
assert.equal(restored.rows[0][1], '12', 'An unchanged sibling restores its exact scalar type');
assert.deepEqual(restored.rows[0][0], native.rows[0][0], 'The edited native cell and its pending color evidence stay authoritative');
assert.equal(diagnostics.length, 1);
assert.match(diagnostics[0].message, /^1 authored table cell was not restored/);

const badAuthored = structuredClone(record);
badAuthored.authored.rows[0][1] = {value: [{text: 'injected', _opfInjected: true}]};
assert.equal(restoreTableData(native, badAuthored, {...options, report: () => {}}), native, 'An invalid authored record is still refused before restoration');

const withHeader = {columns: [{value: [nativeRun('A')]}], rows: [[native.rows[0][0]]]};
const legacy = {headers: [[0, {name: 'A', _opfInjected: 'legacy'}, 'A']], cells: []};
const legacyDiagnostics = [];
assert.equal(restoreTableData(withHeader, legacy, {report: issue => legacyDiagnostics.push(issue)}), withHeader);
assert.equal(legacyDiagnostics[0].code, 'invalid-data-provenance', 'Legacy header metadata gets no native-marker exception');
assert.deepEqual(native, before);
console.log('Native marker validation preserves partial cells and refuses authored/legacy marker injection.');
