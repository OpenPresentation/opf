// The inline ColorScheme declares `name`: the PPTX export writes it as the theme's color scheme name (a:clrScheme name).
// The object is closed, so before `name` was declared an inline name was a schema error.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { check, errorsOf } from './support/validation.mjs';

const deck = (colorScheme) => ({ name: 'Palette', design: { colorScheme }, slides: [{ title: 'Palette' }] });

test('an inline color scheme may carry a name, alone or beside an id and slot overrides', () => {
	for (const colorScheme of [{ name: 'Harbour' }, { id: 'boost', name: 'Harbour' }, { name: 'Acme 2026', accent1: '#1F5AA6', dark1: '#101820' }])
		assert.deepEqual(errorsOf(check(deck(colorScheme))), [], JSON.stringify(colorScheme));
});

test('the name is a nonempty string, and the object stays closed to other keys', () => {
	for (const name of ['', 12, null, ['Harbour']]) {
		const found = errorsOf(check(deck({ name, accent1: '#1F5AA6' })));
		assert.ok(found.some((finding) => finding.ruleId === 'opf/schema' && finding.path === '/design/colorScheme/name'), JSON.stringify({ name, found }));
	}
	const unknown = errorsOf(check(deck({ name: 'Harbour', title: 'Harbour' })));
	assert.ok(unknown.some((finding) => finding.path.startsWith('/design/colorScheme')), JSON.stringify(unknown));
});
