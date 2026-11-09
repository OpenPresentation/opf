import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createValidator, validate } from '../dist/index.js';
import { createValidator as browserValidator, validate as browserValidate } from '../dist/browser.js';

const textSlide = (id, text = 'Readable body with enough detail for a useful review.') => ({ id, title: `Topic ${id}`, subtitle: 'A separate subtitle', blocks: [{ text }, { text: 'A second body block.' }] });
const deck = () => ({ name: 'Incremental review', language: 'en-US', slides: [textSlide('first'), textSlide('second'), textSlide('third')] });
const clone = value => structuredClone(value);
const parity = (checker, value, options = {}) => {
	const actual = checker.validate(value, options);
	assert.deepEqual(actual, validate(value, options), 'every finding, fix, location, order, count and check equals cold validate');
	return actual;
};

test('cold and warm reports are exact; cached snapshots do not retain mutable prior payloads', () => {
	const checker = createValidator();
	const original = deck();
	parity(checker, original);
	assert.ok(checker.cache.entries > 0, 'real default-gallery composition is cached');
	const next = clone(original);
	original.slides[0].blocks[0].text = 'Mutated old input must not leak into detached cache';
	parity(checker, next);
	const cold = validate(next);
	cold.findings.splice(0);
	parity(checker, next);
	checker.clear();
	assert.equal(checker.cache.entries, 0);
	assert.equal(checker.cache.bytes, 0);
});

test('a shared dataset edit recomposes its two consumers while all checks remain fresh', () => {
	const checker = createValidator();
	const calls = [0, 0, 0, 0];
	const measurement = index => ({ measure: (text, size) => { calls[index]++; return text.length * size * 0.5; } });
	const options = { catalogs: [], only: ['opf/text-contrast'], fonts: { textMeasurement: measurement } };
	const document = { ...deck(), datasets: { sales: { columns: ['Quarter', 'Value'], rows: [['Q1', 33], ['Q2', 44]] } }, slides: [textSlide('plain'), { id: 'chart-a', title: 'Chart', chart: { type: 'line', data: { dataset: 'sales' } } }, textSlide('plain-b'), { id: 'chart-b', title: 'Chart again', chart: { type: 'column', data: { dataset: 'sales' } } }] };
	const first = checker.validate(document, options);
	assert.equal(first.schemaValid, true);
	assert.equal(checker.cache.entries, 4);
	const firstCalls = [...calls];
	calls.fill(0);
	checker.validate(clone(document), options);
	const freshRuleCalls = [...calls];
	assert.ok(calls.every((count, i) => count < firstCalls[i]), 'composition is reused while fresh contrast checks can still measure text');
	calls.fill(0);
	document.datasets.sales.rows[0][1] = 34;
	const warm = checker.validate(document, options);
	assert.equal(calls[0], freshRuleCalls[0]);
	assert.equal(calls[2], freshRuleCalls[2]);
	assert.ok(calls[1] > freshRuleCalls[1] && calls[3] > freshRuleCalls[3], 'both real consumers recomposed');
	assert.deepEqual(warm, validate(document, options));
});

test('local edits, prior-slide surfaces/sections, IDs/order/count, and undo match cold review', () => {
	const checker = createValidator();
	const document = deck();
	const original = clone(document);
	const changes = [
		d => { d.slides[1].blocks[0].text = 'TODO: replace this placeholder'; },
		d => { d.slides[0] = { id: 'first', title: 'The message', text: 'A short decisive message.' }; },
		d => { d.slides[1] = { id: 'second', title: 'Next message', text: 'A short decisive message.' }; },
		d => { d.slides[0].section = 'New section'; d.slides[2].title = '{{slide.section}}'; },
		d => { d.slides[2].id = 'changed-target'; },
		d => { d.slides.reverse(); },
		d => { d.slides.splice(1, 0, textSlide('inserted')); },
	];
	parity(checker, document);
	for (const change of changes) { change(document); assert.equal(parity(checker, document).schemaValid, true); parity(checker, clone(document)); }
	parity(checker, original);
	parity(checker, original);
});

test('shared metadata and data/reference diagnostics are never cached', () => {
	const checker = createValidator();
	const document = deck();
	document.datasets = { used: { columns: ['X', 'Y'], rows: [['a', 1]] }, unused: { columns: ['X', 'Y'], rows: [['a', 1]] } };
	document.slides[1] = { id: 'chart', title: 'Data', chart: { type: 'column', data: { dataset: 'used' } } };
	parity(checker, document);
	const changes = [
		d => { d.datasets.unused.rows[0][1] = 8; },
		d => { d.slides[1].chart.data.dataset = 'unused'; },
		d => { delete d.datasets.unused; },
		d => { d.datasets.unused = clone(d.datasets.used); },
		d => { d.design = { theme: 'minimal', background: { type: 'solid', color: '#112233' } }; },
		d => { d.design.footer = { right: { text: '{{slide.number}} / {{deck.slideCount}}' } }; },
		d => { d.language = 'ar'; d.slides[0].blocks[0].text = [{ text: 'نص عربي', bold: true }, { text: ' mixed', fontSize: 18 }]; },
	];
	for (const [i, change] of changes.entries()) { change(document); assert.equal(parity(checker, document).schemaValid, i !== 2); }
	parity(checker, document, { ignore: ['content'], severity: { layout: 'error' }, ignorePaths: [{ rule: '*', path: '/slides/0' }] });
});

test('catalog edits, callback identity and explicit resource invalidation preserve cold equivalence', () => {
	const checker = browserValidator();
	const catalog = { source: 'https://example.org/catalog', layouts: { custom: { name: 'Custom', direction: 'column', regions: [{ name: 'title' }, { name: 'body', accepts: ['text'], role: 'primary', flow: 'none' }] } } };
	const document = deck();
	document.slides[1].layout = 'custom';
	let scale = 0.5;
	const measurement = { measure: (text, size) => text.length * size * scale };
	const options = { catalogs: [catalog], fonts: { textMeasurement: measurement } };
	const equal = () => { const actual = checker.validate(document, options); assert.equal(actual.schemaValid, true); assert.deepEqual(actual, browserValidate(document, options)); };
	equal(); equal();
	catalog.layouts.custom.direction = 'row'; equal();
	scale = 1.5; checker.clear(); equal();
	options.fonts = { textMeasurement: { measure: (text, size) => text.length * size * 0.7 } }; equal();
});

test('source ranges, malformed input, policy and strict overflow are rebuilt on every call', () => {
	const checker = createValidator();
	const document = deck();
	document.slides[1].composition = { minFontSize: 32, maxFontSize: 32, overflow: 'error' };
	document.slides[1].blocks[0].text = 'Very long strict content '.repeat(150);
	const strict = parity(checker, document);
	assert.equal(strict.schemaValid, true);
	assert.ok(strict.findings.some(finding => finding.ruleId === 'opf/text-overflow'));
	parity(checker, document);
	parity(checker, JSON.stringify(document));
	parity(checker, JSON.stringify(document, null, 3));
	parity(checker, '{"name":"duplicate","name":"again","slides":[]}');
	parity(checker, '{');
	assert.equal(checker.cache.entries, 0);
	assert.throws(() => checker.validate(document, { madeUp: true }), /Unknown validate option/);
	parity(checker, deck(), { only: ['format'] });
	assert.equal(checker.cache.entries, 0, 'format-only preserves lazy geometry');
});

test('citation numbering, variables, host policies and nested dataset consumers stay exact', () => {
	const checker = createValidator();
	const document = deck();
	document.references = [{ id: 'a', text: 'First source' }, { id: 'b', text: 'Second source' }];
	document.variables = { client: { type: 'text', value: 'Acme' } };
	document.slides[2].blocks[1].text = 'var:client';
	document.slides[0].blocks[0].text = [{ text: 'Earlier citation', cite: 'a' }];
	document.slides[2].blocks[0].text = [{ text: 'Later citation', cite: 'b' }];
	assert.equal(parity(checker, document).schemaValid, true);
	document.slides[0].blocks[0].text = 'Removed earlier citation';
	assert.equal(parity(checker, document).schemaValid, true);
	document.variables.client.value = 'Globex';
	assert.equal(parity(checker, document).schemaValid, true);
	document.slides[1].layout = 'auto';
	const policy = parity(checker, document, { contracts: [{ path: '/slides/*/layout', allowedValues: ['statement'], message: 'Use the required layout.' }] });
	assert.ok(policy.findings.some(finding => finding.ruleId === 'opf/contract'));
	document.datasets = { values: { columns: ['X', 'Y'], rows: [['A', 9]] } };
	document.slides[1] = { id: 'nested', title: 'Nested', left: { blocks: [{ blocks: [{ chart: { type: 'column', data: { dataset: 'values' } } }] }] }, right: { table: { dataset: 'values' } } };
	assert.equal(parity(checker, document).schemaValid, true);
	document.datasets.values.rows[0][1] = 99;
	assert.equal(parity(checker, document).schemaValid, true);
});
test('retention is bounded for 300 slides, repeated edits, oversized data and clear', () => {
	const checker = createValidator();
	const document = { ...deck(), slides: Array.from({ length: 300 }, (_, i) => textSlide(`slide-${i}`)) };
	const options = { catalogs: [], only: ['opf/text-contrast'] };
	for (let i = 0; i < 4; i++) {
		document.slides[299].title = `Last edit ${i}`;
		assert.deepEqual(checker.validate(document, options), validate(document, options));
		assert.ok(checker.cache.entries <= 64);
		assert.ok(checker.cache.bytes <= checker.cache.maxBytes);
	}
	assert.ok(checker.cache.entries > 0);
	const huge = deck(); huge.name = 'x'.repeat(1100000);
	assert.deepEqual(checker.validate(huge, options), validate(huge, options));
	assert.equal(checker.cache.entries, 0, 'oversized shared keys decline caching');
	assert.equal(checker.cache.bytes, 0);
	checker.clear();
});

test('opaque non-JSON input declines caching without changing the complete report', () => {
	const checker = createValidator();
	const document = deck();
	Object.defineProperty(document, 'name', { value: 'Hidden own name', enumerable: false });
	parity(checker, document);
	assert.equal(checker.cache.entries, 0);
	const arrayProperty = deck();
	Object.defineProperty(arrayProperty.slides[0].blocks, 'outsideJson', { value: 'not a slot', enumerable: false });
	parity(checker, arrayProperty);
	assert.equal(checker.cache.entries, 0);
});

test('reentrant host validation cannot substitute another document composition', () => {
	const checker = createValidator();
	const document = deck(), other = deck();
	for (const slide of other.slides) slide.blocks[0].text = [{ text: 'Foreign pale content', color: '#FFFFFF' }];
	let nested = false;
	const options = { catalogs: [], only: ['opf/text-contrast'], fonts: { textMeasurement: { measure: (text, size) => {
		if (!nested) { nested = true; checker.validate(other, { catalogs: [], only: ['opf/text-contrast'] }); }
		return text.length * size * 0.5;
	} } } };
	assert.deepEqual(checker.validate(document, options), validate(document, options));
	assert.equal(nested, true, 'the real nested validator path ran');
	parity(checker, document);
});
