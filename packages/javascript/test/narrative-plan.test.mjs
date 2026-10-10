import assert from 'node:assert/strict';
import test from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { validateCatalogRecord } from '../dist/validator.js';
import { validate, validationRules, findValidationRule } from '../dist/index.js';
// The narrative checks: unknown beats are references findings, durations and unused beats content findings.
const checkAll = (input, options = {}) => validate(input, { only: ['format', 'references', 'content'], ...options });

// FA-02: the deck holds a pointer (narrative: a reference); the plan is a catalog record.
const narratives = Object.entries(gallery.narratives).map(([id, entry]) => ({ $schema: 'https://openpresentation.org/schema/opf-narrative/v1', id, ...entry }));
const host = (narratives) => ({ catalogs: [{ source: 'pkg:@host/narratives', narratives }] });
const record = (extra = {}) => ({
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
	catalogs: { custom: { narratives: { arc: record() } } },
	slides: [
		{ title: 'One', beat: 'hook' },
		{ title: 'Two', beat: ['proof', 'ask'] },
	],
	...extra,
});
const rule = (report, id) => report.findings.filter((issue) => issue.ruleId === id);

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

test('a consistent deck has no narrative findings in validate', () => {
	assert.deepEqual(checkAll(deck()).findings, []);
	assert.deepEqual(rule(validate(deck()), 'opf/unused-beat'), []);
});

test('validate warns about a slide beat the resolved narrative does not define', () => {
	const found = rule(checkAll(deck({ slides: [{ title: 'One', beat: 'hok' }, { title: 'Two', beat: ['proof', 'nope'] }] })), 'opf/unknown-beat');
	assert.deepEqual(found.map((issue) => [issue.severity, issue.path]), [['warning', '/slides/0/beat'], ['warning', '/slides/1/beat/1']]);
	assert.equal(found[0].suggestions[0].value, 'hook');
	assert.match(found[0].message, /"hok"/);
});

test('validate resolves a bundled narrative and records the host loaded', () => {
	const bundled = narratives.find((entry) => entry.id === 'qbr');
	const document = { narrative: 'qbr', duration: 60, slides: [{ title: 'x', beat: bundled.beats[0].id }, { title: 'y', beat: 'not-a-beat' }] };
	assert.deepEqual(rule(checkAll(document, { catalogs: [gallery] }), 'opf/unknown-beat').map((issue) => issue.path), ['/slides/1/beat']);
	const loaded = { narrative: 'remote-arc', slides: [{ title: 'x', beat: 'zzz' }] };
	assert.deepEqual(rule(checkAll(loaded, { catalogs: [] }), 'opf/unknown-beat'), []);
	assert.equal(rule(checkAll(loaded, host({ 'remote-arc': record() })), 'opf/unknown-beat').length, 1);
});

test('a narrative that resolves nowhere is not checked, and a URL or pkg: string is not a reference', () => {
	assert.deepEqual(rule(checkAll({ narrative: 'no-such-arc', duration: 1, slides: [{ title: 'x', beat: 'zzz' }] }), 'opf/unknown-beat'), []);
	for (const narrative of ['https://example.com/arc.json', 'pkg:@acme/arcs/arc'])
		assert.equal(checkAll({ narrative, slides: [{ title: 'x' }] }).valid, false, narrative);
});

test('validate warns when the root duration is outside the narrative range', () => {
	for (const duration of [5, 25]) {
		const found = rule(checkAll(deck({ duration })), 'opf/duration-outside-narrative');
		assert.equal(found.length, 1);
		assert.equal(found[0].path, '/duration');
		assert.equal(found[0].severity, 'warning');
		assert.match(found[0].message, /10-20 minutes/);
	}
	for (const duration of [10, 20]) assert.deepEqual(rule(checkAll(deck({ duration })), 'opf/duration-outside-narrative'), []);
	assert.deepEqual(rule(checkAll(deck({ duration: undefined })), 'opf/duration-outside-narrative'), []);
	const open = deck({ duration: 4, catalogs: { custom: { narratives: { arc: record({ duration: { min: 6 } }) } } } });
	assert.match(rule(checkAll(open), 'opf/duration-outside-narrative')[0].message, /at least 6 minutes/);
});

test('validate warns about an inline record whose duration range is inverted', () => {
	const inverted = deck({ catalogs: { custom: { narratives: { arc: record({ duration: { min: 30, max: 10 } }) } } } });
	const report = checkAll(inverted);
	assert.deepEqual(rule(report, 'opf/narrative-duration-range').map((issue) => issue.path), ['/catalogs/custom/narratives/arc/duration']);
	assert.deepEqual(rule(report, 'opf/duration-outside-narrative'), [], 'an inverted range is reported once, not applied');
});

test('validate reports a beat no slide references as info', () => {
	const report = validate(deck({ slides: [{ title: 'One', beat: 'hook' }, { title: 'Two', beat: 'proof' }] }));
	const found = rule(report, 'opf/unused-beat');
	assert.equal(found.length, 1);
	assert.equal(found[0].severity, 'info');
	assert.equal(found[0].category, 'content');
	assert.equal(found[0].path, '/narrative');
	assert.deepEqual(found[0].measured, { beat: 'ask', position: 3, beats: 3 });
	assert.equal(findValidationRule('unused-beat'), validationRules.find((info) => info.id === 'opf/unused-beat'));
});

test('validate skips a deck whose slides link no beats', () => {
	assert.deepEqual(rule(validate(deck({ slides: [{ title: 'One' }, { title: 'Two' }] })), 'opf/unused-beat'), []);
	assert.deepEqual(rule(validate(deck({ narrative: 'no-such-arc' })), 'opf/unused-beat'), []);
});

test('validate uses records the host loaded', () => {
	const document = { name: 'D', narrative: 'host-arc', slides: [{ title: 'One', beat: 'hook' }] };
	assert.equal(rule(validate(document, host({ 'host-arc': record() })), 'opf/unused-beat').length, 2);
});
