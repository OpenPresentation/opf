import assert from 'node:assert/strict';
import test from 'node:test';
import { auditPresentation, auditRules, findAuditRule } from '../dist/audit.js';
import { lintPresentation } from '../dist/lint.js';
import { narratives } from '../dist/catalogs.js';
import { validateCatalogRecord } from '../dist/validator.js';

// FA-02: the deck holds a pointer (narrative: string); the plan is a catalog record.
const record = (extra = {}) => ({
	$schema: 'https://openpresentation.org/schema/opf-narrative/v1',
	id: 'arc',
	name: 'Arc',
	duration: { min: 10, max: 20 },
	beats: [
		{ id: 'hook', name: 'Hook', type: 'text', layout: 'title' },
		{ id: 'proof', name: 'Proof', type: 'chart' },
		{ id: 'ask', name: 'Ask', type: 'list' },
	],
	...extra,
});
const deck = (extra = {}) => ({
	name: 'D',
	narrative: 'arc',
	duration: 15,
	catalogs: { narratives: { records: [record()] } },
	slides: [
		{ title: 'One', beat: 'hook' },
		{ title: 'Two', beat: ['proof', 'ask'] },
	],
	...extra,
});
const rule = (report, id) => report.diagnostics.filter((issue) => issue.ruleId === id);

test('the bundled narrative records use the planning vocabulary', () => {
	assert.equal(narratives.length, 48);
	const types = new Set(['text', 'list', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline']);
	for (const entry of narratives) {
		assert.ok(entry.duration.min > 0 && entry.duration.max >= entry.duration.min, entry.id);
		assert.equal('durationRange' in entry, false);
		for (const beat of entry.beats) {
			for (const old of ['slideType', 'layoutHint', 'slideCount', 'shape']) assert.equal(old in beat, false, `${entry.id}/${beat.id} ${old}`);
			if (beat.type !== undefined) assert.ok(types.has(beat.type), `${entry.id}/${beat.id}`);
		}
		assert.equal(validateCatalogRecord('narratives', entry).valid, true, entry.id);
	}
});

test('a consistent deck has no narrative findings in lint or the audit', () => {
	assert.deepEqual(lintPresentation(deck()).diagnostics, []);
	assert.deepEqual(rule(auditPresentation(deck()), 'audit/unused-beat'), []);
});

test('lint warns about a slide beat the resolved narrative does not define', () => {
	const found = rule(lintPresentation(deck({ slides: [{ title: 'One', beat: 'hok' }, { title: 'Two', beat: ['proof', 'nope'] }] })), 'opf/unknown-beat');
	assert.deepEqual(found.map((issue) => [issue.severity, issue.path]), [['warning', '/slides/0/beat'], ['warning', '/slides/1/beat/1']]);
	assert.equal(found[0].suggestions[0].value, 'hook');
	assert.match(found[0].message, /"hok"/);
});

test('lint resolves a bundled narrative and records the host loaded', () => {
	const bundled = narratives.find((entry) => entry.id === 'qbr');
	const document = { narrative: 'qbr', duration: 60, slides: [{ title: 'x', beat: bundled.beats[0].id }, { title: 'y', beat: 'not-a-beat' }] };
	assert.deepEqual(rule(lintPresentation(document), 'opf/unknown-beat').map((issue) => issue.path), ['/slides/1/beat']);
	const loaded = { narrative: 'remote-arc', slides: [{ title: 'x', beat: 'zzz' }] };
	assert.deepEqual(rule(lintPresentation(loaded), 'opf/unknown-beat'), []);
	assert.equal(rule(lintPresentation(loaded, { catalogs: { narratives: [record({ id: 'remote-arc' })] } }), 'opf/unknown-beat').length, 1);
});

test('a URL, a pkg: reference or an unknown id is not resolved, so nothing is checked', () => {
	for (const narrative of ['https://example.com/arc.json', 'pkg:@acme/arcs/arc', 'no-such-arc'])
		assert.deepEqual(rule(lintPresentation({ narrative, duration: 1, slides: [{ title: 'x', beat: 'zzz' }] }), 'opf/unknown-beat'), []);
});

test('lint warns when the root duration is outside the narrative range', () => {
	for (const duration of [5, 25]) {
		const found = rule(lintPresentation(deck({ duration })), 'opf/duration-outside-narrative');
		assert.equal(found.length, 1);
		assert.equal(found[0].path, '/duration');
		assert.equal(found[0].severity, 'warning');
		assert.match(found[0].message, /10-20 minutes/);
	}
	for (const duration of [10, 20]) assert.deepEqual(rule(lintPresentation(deck({ duration })), 'opf/duration-outside-narrative'), []);
	assert.deepEqual(rule(lintPresentation(deck({ duration: undefined })), 'opf/duration-outside-narrative'), []);
	const open = deck({ duration: 4, catalogs: { narratives: { records: [record({ duration: { min: 6 } })] } } });
	assert.match(rule(lintPresentation(open), 'opf/duration-outside-narrative')[0].message, /at least 6 minutes/);
});

test('lint warns about an inline record whose duration range is inverted', () => {
	const inverted = deck({ catalogs: { narratives: { records: [record({ duration: { min: 30, max: 10 } })] } } });
	const report = lintPresentation(inverted);
	assert.deepEqual(rule(report, 'opf/narrative-duration-range').map((issue) => issue.path), ['/catalogs/narratives/records/0/duration']);
	assert.deepEqual(rule(report, 'opf/duration-outside-narrative'), [], 'an inverted range is reported once, not applied');
});

test('the audit reports a beat no slide references as info', () => {
	const report = auditPresentation(deck({ slides: [{ title: 'One', beat: 'hook' }, { title: 'Two', beat: 'proof' }] }));
	const found = rule(report, 'audit/unused-beat');
	assert.equal(found.length, 1);
	assert.equal(found[0].severity, 'info');
	assert.equal(found[0].category, 'content');
	assert.equal(found[0].path, '/narrative');
	assert.deepEqual(found[0].measured, { beat: 'ask', position: 3, beats: 3 });
	assert.equal(findAuditRule('unused-beat'), auditRules.find((info) => info.id === 'audit/unused-beat'));
});

test('the audit skips a deck whose slides link no beats', () => {
	assert.deepEqual(rule(auditPresentation(deck({ slides: [{ title: 'One' }, { title: 'Two' }] })), 'audit/unused-beat'), []);
	assert.deepEqual(rule(auditPresentation(deck({ narrative: 'https://example.com/arc.json' })), 'audit/unused-beat'), []);
});

test('the audit uses records the host loaded', () => {
	const document = { name: 'D', narrative: 'host-arc', slides: [{ title: 'One', beat: 'hook' }] };
	assert.equal(rule(auditPresentation(document, { catalogs: { narratives: [record({ id: 'host-arc' })] } }), 'audit/unused-beat').length, 2);
});
