// RR-105 review of the 0.34 schema and validation diff: a 0.33 anchored overlay size, language tags on slides and runs, a table cell's fill,
// image callout text, a did-you-mean sentence, and the anchored shapes of an omitted template group.
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveVariables, validate } from '../dist/index.js';

const anchored = (at) => ({ name: 'Anchors', slides: [{ title: 'A', blocks: [{ id: 'chart', text: 'hello world' }], shapes: [{ shape: 'rect', text: 'Badge', at: { block: 'chart', edge: 'end', ...at } }] }] });
const unit = (deck) => validate(deck).findings.filter((entry) => entry.ruleId === 'opf/shape-anchor-size-unit');

test('a 0.33 pixel size under at.width and at.height is a warning that renames the key and keeps the value', () => {
	const found = unit(anchored({ width: 160, height: 64 }));
	assert.deepEqual(found.map((entry) => [entry.severity, entry.path]), [['warning', '/slides/0/shapes/0/at/width'], ['warning', '/slides/0/shapes/0/at/height']]);
	assert.match(found[0].help, /Did you mean "widthPx"\?/);
	assert.deepEqual(found[0].fixes[0].patch, [{ op: 'move', from: '/slides/0/shapes/0/at/width', path: '/slides/0/shapes/0/at/widthPx' }]);
	assert.deepEqual(found[1].fixes[0].patch, [{ op: 'move', from: '/slides/0/shapes/0/at/height', path: '/slides/0/shapes/0/at/heightPx' }]);
	assert.equal(validate(anchored({ width: 160, height: 64 })).valid, true, 'a warning: the deck still validates');
});

test('a written-out fix leaves no finding, and a fraction or an explicit pixel size is never flagged', () => {
	assert.deepEqual(unit(anchored({ widthPx: 160, heightPx: 64 })), []);
	for (const at of [{ width: 1 }, { width: 1.08, height: 0.5 }, { width: 4, height: 4 }, { widthPx: 160, heightPx: 64 }, { width: 2000 }]) assert.deepEqual(unit(anchored(at)), [], JSON.stringify(at));
	assert.equal(unit(anchored({ width: 4.01 })).length, 1);
	assert.equal(unit(anchored({ width: 1280 })).length, 1);
});

const tags = (document) => validate(document).findings.filter((entry) => entry.path.endsWith('language') || entry.path.endsWith('/bcp47')).map((entry) => [entry.severity, entry.ruleId, entry.path]);

test('en-UK is the same schema error on the deck, a slide, an inline language and a run', () => {
	const slide = { title: 'A', text: 'x' };
	assert.deepEqual(tags({ name: 'N', language: 'en-UK', slides: [slide] }), [['error', 'opf/schema', '/language']]);
	assert.deepEqual(tags({ name: 'N', slides: [{ ...slide, language: 'en-UK' }] }), [['error', 'opf/schema', '/slides/0/language']]);
	assert.deepEqual(tags({ name: 'N', slides: [{ ...slide, language: { bcp47: 'en-uk' } }] }), [['error', 'opf/schema', '/slides/0/language/bcp47']]);
	assert.deepEqual(tags({ name: 'N', slides: [{ title: 'A', text: [{ text: 'colour', language: 'en-UK' }] }] }), [['error', 'opf/schema', '/slides/0/text/0/language']]);
	const [finding] = validate({ name: 'N', slides: [{ ...slide, language: 'en-UK' }] }).findings.filter((entry) => entry.ruleId === 'opf/schema');
	assert.match(finding.message, /en-GB/);
	// Another bad region stays the opf/language-tag warning.
	assert.deepEqual(tags({ name: 'N', slides: [{ ...slide, language: 'fr-UK' }] }), [['warning', 'opf/language-tag', '/slides/0/language']]);
});

test('a table cell style.fill written like a background is not called a shape fill', () => {
	const deck = { name: 'N', slides: [{ title: 'A', table: { columns: ['a'], rows: [[{ value: '1', style: { fill: { type: 'solid', color: 'accent1' } } }]] } }] };
	const found = validate(deck).findings.filter((entry) => entry.ruleId === 'opf/schema');
	assert.ok(found.length > 0);
	assert.ok(!found.some((entry) => /shape's/.test(entry.message) || /slide background takes/.test(entry.help)), found.map((entry) => entry.message).join(' | '));
	// A shape's own fill keeps the dedicated message and patch.
	const shape = { name: 'N', slides: [{ title: 'A', blocks: [{ shape: 'rect', fill: { type: 'solid', color: 'accent1' } }] }] };
	const [message] = validate(shape).findings.filter((entry) => entry.ruleId === 'opf/schema');
	assert.match(message.message, /A shape's solid fill is the color itself/);
	assert.deepEqual(message.fixes[0].patch, [{ op: 'replace', path: '/slides/0/blocks/0/fill', value: 'accent1' }]);
});

test('image callout text is read by the text rules', () => {
	const deck = { name: 'N', slides: [{ title: 'A', image: { src: 'https://example.com/a.png', alt: 'Chart', callouts: [{ x: 0.2, y: 0.3, width: 0.4, height: 0.2, text: 'Lorem ipsum dolor sit amet' }, { x: 0.5, y: 0.5, width: 0.4, height: 0.2, text: '' }] } }] };
	const report = validate(deck);
	const placeholder = report.findings.filter((entry) => entry.ruleId === 'opf/placeholder-text');
	assert.deepEqual(placeholder.map((entry) => entry.path), ['/slides/0/image/callouts/0/text']);
	assert.ok(!report.findings.some((entry) => entry.ruleId === 'opf/empty-text'), 'an empty callout is retained on purpose');
});

test('the did-you-mean help reads as a sentence', () => {
	const [finding] = validate({ name: 'N', slides: [{ title: 'A', text: [{ text: 'Bonjour', lang: 'fr-FR' }] }] }).findings.filter((entry) => entry.ruleId === 'opf/schema');
	assert.equal(finding.help, 'Write "language" instead; "lang" is not a field of this object.');
});

test('an omitted template group names the shapes attached to it', () => {
	const template = { name: 'T', template: true, variables: { q: { type: 'text', required: false }, n: { type: 'text', required: true, example: 'N' } }, slides: [{ title: '{{n}}', blocks: [{ id: 'grp', blocks: [{ text: '{{q}}' }, { text: 'static' }] }, { id: 'other', text: 'always' }], shapes: [{ shape: 'rect', at: { block: 'grp', edge: 'end' } }, { connector: { from: 'grp', to: 'other' } }] }] };
	const diagnostic = resolveVariables(template, { n: 'Name' }).diagnostics.find((entry) => entry.code === 'variable-group-omitted');
	assert.match(diagnostic.message, /overlay shape or connector attached to "grp"/);
	const plain = structuredClone(template);
	plain.slides[0].shapes = [];
	assert.doesNotMatch(resolveVariables(plain, { n: 'Name' }).diagnostics.find((entry) => entry.code === 'variable-group-omitted').message, /overlay shape/);
});
