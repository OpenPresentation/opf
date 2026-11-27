import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateCatalogRecord } from '../dist/validator.js';

// A published font scheme record carries its publisher's display metadata in `x-` keys; 0.37.0 refused them
// by mistake. The old `languageFamily` key and every other unknown key stay refused.
const base = JSON.parse(readFileSync(new URL('../../gallery/catalog/font-schemes/aptos.json', import.meta.url), 'utf8'));
const keyFinding = (report, key) => report.findings.find((finding) => JSON.stringify(finding).includes(key));

test('a base record validates, and an x-gallery block on it still validates', () => {
	assert.equal(validateCatalogRecord('fontSchemes', base).valid, true);
	const withBlock = { ...base, 'x-gallery': { page: 'https://example.com/font-schemes/aptos', heading: 'Aptos Display', body: 'Aptos' }, 'x-note': 'a string' };
	const report = validateCatalogRecord('fontSchemes', withBlock);
	assert.equal(report.valid, true, JSON.stringify(report.findings));
});

test('the old languageFamily key is still refused and named', () => {
	const report = validateCatalogRecord('fontSchemes', { ...base, languageFamily: 'latin' });
	assert.equal(report.valid, false);
	assert.ok(keyFinding(report, 'languageFamily'), JSON.stringify(report.findings));
});

test('another unknown key is refused, with or without an x- key beside it', () => {
	for (const record of [{ ...base, gallery: {} }, { ...base, 'x-gallery': {}, gallery: {} }]) {
		const report = validateCatalogRecord('fontSchemes', record);
		assert.equal(report.valid, false);
		assert.ok(keyFinding(report, 'gallery'), JSON.stringify(report.findings));
	}
});

test('a nested eastAsian block still refuses unknown keys, x- included', () => {
	const report = validateCatalogRecord('fontSchemes', { ...base, eastAsian: { major: 'MS Gothic', 'x-note': 1 } });
	assert.equal(report.valid, false);
});
