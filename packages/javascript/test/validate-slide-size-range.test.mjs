import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { findValidationRule, validate } from '../dist/index.js';
import { defaultCatalog } from '../dist/catalog.js';

// opf#567: ECMA-376 / ISO/IEC 29500-1 section 19.2.1.39 limits each side of p:sldSz to 914400 to 51206400 EMU (1 to 56 inches).
// The schema accepts any positive custom size, so `validate` warns (format, never an error) for a size outside the range.
const RULE = 'opf/slide-size-out-of-range';
const deck = (design, extra = {}) => ({ name: 'Slide size', slides: [{ title: 'One' }], ...(design === undefined ? {} : { design }), ...extra });
const report = (document, options = {}) => validate(document, { only: ['format', 'references'], catalogs: [defaultCatalog], ...options });
const sizeFindings = (document, options) => report(document, options).findings.filter((finding) => finding.ruleId === RULE);

describe('opf/slide-size-out-of-range', () => {
	test('is a format warning in the rule registry', () => {
		const info = findValidationRule('slide-size-out-of-range');
		assert.equal(info.id, RULE);
		assert.equal(info.category, 'format');
		assert.equal(info.severity, 'warning');
		assert.match(info.standard, /29500-1/);
	});

	test('a size inside 1 to 56 inches has no finding', () => {
		for (const dimensions of [
			{ widthInches: 10, heightInches: 7.5 },
			{ widthInches: 13.333, heightInches: 7.5 },
			{ widthInches: 1, heightInches: 1 },
			{ widthInches: 56, heightInches: 56 },
			{ widthInches: 1, heightInches: 56 },
			{ widthInches: 20 },
			{ preset: 'a4', heightInches: 30 },
			// 0.9999999 in rounds to 914400 EMU, which is what the exporter writes.
			{ widthInches: 0.9999999999, heightInches: 7.5 },
		]) {
			const result = report(deck({ dimensions }));
			assert.equal(sizeFindings(deck({ dimensions })).length, 0, JSON.stringify(dimensions));
			assert.equal(result.valid, true, JSON.stringify(dimensions));
		}
	});

	test('a deck with no size, or a preset, has no finding', () => {
		assert.deepEqual(sizeFindings(deck()), []);
		for (const preset of ['widescreen', 'standard', '16:9', '4:3', '16:10', '1:1', '4:5', '9:16', 'letter', 'a4']) {
			assert.deepEqual(sizeFindings(deck({ dimensions: preset })), [], preset);
			assert.deepEqual(sizeFindings(deck({ dimensions: { preset } })), [], preset);
		}
	});

	test('a side below 1 inch warns at design.dimensions and keeps the deck valid', () => {
		const document = deck({ dimensions: { widthInches: 0.5, heightInches: 7.5 } });
		const findings = sizeFindings(document);
		assert.equal(findings.length, 1);
		const [finding] = findings;
		assert.equal(finding.severity, 'warning');
		assert.equal(finding.category, 'format');
		assert.equal(finding.path, '/design/dimensions');
		assert.match(finding.message, /width 0\.5 in \(457200 EMU\) is below 1 in/);
		assert.doesNotMatch(finding.message, /height/);
		assert.equal(report(document).valid, true);
		assert.equal(report(document).schemaValid, true);
	});

	test('a side above 56 inches warns, and both sides are named when both are out', () => {
		const tall = sizeFindings(deck({ dimensions: { widthInches: 13.333, heightInches: 56.01 } }));
		assert.equal(tall.length, 1);
		assert.match(tall[0].message, /height 56\.01 in \(\d+ EMU\) is above 56 in/);
		const both = sizeFindings(deck({ dimensions: { widthInches: 0.25, heightInches: 100 } }));
		assert.equal(both.length, 1);
		assert.match(both[0].message, /width 0\.25 in \(228600 EMU\) is below 1 in, height 100 in \(91440000 EMU\) is above 56 in/);
	});

	test('a custom side on top of a preset is checked, and a preset alone is not', () => {
		assert.equal(sizeFindings(deck({ dimensions: { preset: '16:9', widthInches: 120 } })).length, 1);
		assert.equal(sizeFindings(deck({ dimensions: { preset: '16:9', widthInches: 12 } })).length, 0);
	});

	test('a size that comes from the deck theme is checked at design.theme', () => {
		const catalogs = { custom: { themes: { tiny: { name: 'Tiny', dimensions: { widthInches: 0.5, heightInches: 0.5 } }, big: { name: 'Big', dimensions: { widthInches: 20, heightInches: 12 } } } } };
		const findings = sizeFindings(deck({ theme: 'tiny' }, { catalogs }));
		assert.equal(findings.length, 1);
		assert.equal(findings[0].path, '/design/theme');
		assert.match(findings[0].message, /comes from the deck's theme/);
		assert.deepEqual(sizeFindings(deck({ theme: 'big' }, { catalogs })), []);
		// The deck's own design.dimensions wins over the theme, in both directions.
		assert.deepEqual(sizeFindings(deck({ theme: 'tiny', dimensions: '4:3' }, { catalogs })), []);
		assert.equal(sizeFindings(deck({ theme: 'big', dimensions: { widthInches: 0.5, heightInches: 7.5 } }, { catalogs })).length, 1);
	});

	test('severity, ignore and only select the rule like any other', () => {
		const document = deck({ dimensions: { widthInches: 0.5, heightInches: 7.5 } });
		assert.equal(validate(document, { ignore: [RULE] }).findings.some((finding) => finding.ruleId === RULE), false);
		assert.equal(validate(document, { only: ['format'] }).findings.some((finding) => finding.ruleId === RULE), true);
		assert.equal(validate(document, { only: ['layout'] }).findings.some((finding) => finding.ruleId === RULE), false);
		const promoted = validate(document, { severity: { [RULE]: 'error' } });
		assert.equal(promoted.valid, false);
		assert.equal(promoted.findings.find((finding) => finding.ruleId === RULE).severity, 'error');
	});

	test('the finding carries the applicable help sentence', () => {
		const [finding] = sizeFindings(deck({ dimensions: { widthInches: 0.5, heightInches: 7.5 } }));
		assert.match(finding.help, /between 1 and 56/);
		assert.ok(finding.definition);
	});
});
