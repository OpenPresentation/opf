// The "needs a value" hint of the JSON syntax analyzer ends with editor advice (the chord that opens the list of choices) only when the
// text is shown in the source editor (`editor: true`); the CLI, scripts and servers get the hint without it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../dist/index.js';
import { analyzeJsonSyntax } from '../dist/source.js';

const text = '{"name": "T", "slides": [ {"title": } ]}';
const hintOf = (problems) => problems.find((problem) => problem.code === 'missing-value').next;

test('the default hint has no key chord', () => {
	const next = hintOf(analyzeJsonSyntax(text));
	assert.match(next, /^a string such as/);
	assert.doesNotMatch(next, /Ctrl\+Space|Press/);
});

test('the editor hint keeps the chord after the same sentence', () => {
	const plain = hintOf(analyzeJsonSyntax(text));
	assert.equal(hintOf(analyzeJsonSyntax(text, { editor: true })), `${plain} Press Ctrl+Space after the colon for options.`);
	assert.equal(hintOf(analyzeJsonSyntax(text, { editor: false })), plain);
});

test('validate(text) reports the terminal hint', () => {
	const finding = validate(text).findings.find((item) => item.ruleId === 'opf/json-syntax');
	assert.doesNotMatch(JSON.stringify(finding), /Ctrl\+Space/);
});
