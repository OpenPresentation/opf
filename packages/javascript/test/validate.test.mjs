import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import ts from 'typescript';
import * as root from '../dist/index.js';
import { examples } from '../dist/examples.js';
import { findValidationRule, validate, validationRules } from '../dist/index.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020.js').default;
const addFormats = require('ajv-formats').default;

const deck = (slides, extra = {}) => ({ name: 'Validate fixture', language: 'en-US', ...extra, slides });
const ids = (report) => report.findings.map((entry) => entry.ruleId);
const freeze = (value) => {
	if (value && typeof value === 'object') {
		Object.freeze(value);
		for (const child of Object.values(value)) freeze(child);
	}
	return value;
};

// A measurement that counts how often composition asks for a text width, so a test can prove whether a layout was built.
const countingMeasurement = () => {
	const counter = { calls: 0 };
	return { counter, measurement: { measure: (text, size) => (counter.calls++, text.length * size * 0.5) } };
};
const tight = deck([{ title: 'T', composition: { minFontSize: 16 }, blocks: [{ text: 'word '.repeat(300) }, { text: 'b' }] }]);

describe('validate is lazy: only what the rules you ask for need is built', () => {
	test("only: ['format'] builds no layout", () => {
		const { counter, measurement } = countingMeasurement();
		const report = validate(tight, { only: ['format'], fonts: { textMeasurement: measurement } });
		assert.equal(counter.calls, 0);
		assert.equal(report.checks.layout, 'not-run');
		assert.equal(report.checks.accessibility, 'not-run');
		assert.equal(report.checks.references, 'not-run');
	});

	test("only: ['format', 'references'] builds no layout either", () => {
		const { counter, measurement } = countingMeasurement();
		validate(tight, { only: ['format', 'references'], fonts: { textMeasurement: measurement } });
		assert.equal(counter.calls, 0);
	});

	test('a text measurement function of the slide index is never called when no layout rule runs', () => {
		const seen = [];
		validate(tight, { only: ['format', 'references', 'content'], fonts: { textMeasurement: (index) => (seen.push(index), undefined) } });
		assert.deepEqual(seen, []);
	});

	test('accessibility rules that read the document alone build no layout; the ones that need geometry do', () => {
		const { counter, measurement } = countingMeasurement();
		const structure = validate(tight, { only: ['opf/missing-alt-text', 'opf/missing-slide-title', 'opf/placeholder-text'], fonts: { textMeasurement: measurement } });
		assert.equal(counter.calls, 0);
		assert.equal(structure.checks.layout, 'not-run');
		assert.equal(structure.checks.accessibility, 'checked');
		validate(tight, { only: ['opf/text-contrast'], fonts: { textMeasurement: measurement } });
		assert.ok(counter.calls > 0, 'text-contrast composes the slides');
	});

	test('ignore: [layout] skips the layout rules but keeps the rest', () => {
		const { counter, measurement } = countingMeasurement();
		const report = validate(deck([{ text: 'No title' }]), { ignore: ['layout', 'opf/text-contrast', 'opf/text-on-image', 'opf/reading-order'], fonts: { textMeasurement: measurement } });
		assert.equal(counter.calls, 0);
		assert.ok(ids(report).includes('opf/missing-slide-title'));
		assert.equal(report.checks.layout, 'not-run');
	});

	test('the default runs everything, and says the layout was measured with the host fonts or estimated', () => {
		const { counter, measurement } = countingMeasurement();
		const measured = validate(tight, { fonts: { textMeasurement: measurement } });
		assert.ok(counter.calls > 0);
		assert.equal(measured.checks.layout, 'measured');
		assert.equal(validate(tight).checks.layout, 'estimated');
		for (const category of ['accessibility', 'content']) assert.equal(validate(tight).checks[category], 'checked');
	});

	test("only: ['format'] costs about what the schema check costs: a fraction of the full run", () => {
		const sample = examples.find((entry) => entry.slug === 'broadband-public-hearing-deck')?.deck ?? examples[0].deck;
		const time = (options, runs) => {
			for (let i = 0; i < 5; i++) validate(sample, options);
			const start = performance.now();
			for (let i = 0; i < runs; i++) validate(sample, options);
			return (performance.now() - start) / runs;
		};
		const format = time({ only: ['format'] }, 40);
		const full = time({}, 6);
		assert.ok(format * 5 < full, `format ${format.toFixed(2)} ms against full ${full.toFixed(2)} ms`);
	});
});

describe('text input is strict JSON', () => {
	test('syntax errors carry line and column, and YAML or Markdown text is not sniffed, only hinted about', () => {
		const yaml = validate('name: Deck\nslides:\n  - title: One\n');
		assert.equal(yaml.valid, false);
		assert.equal(yaml.schemaValid, null);
		assert.ok(yaml.findings.every((entry) => entry.ruleId === 'opf/json-syntax' && entry.category === 'format'));
		assert.match(yaml.findings[0].help, /fromYaml/);
		assert.equal(yaml.findings[0].location.line, 1);
		const markdown = validate('# Title\n\nBody\n');
		assert.match(markdown.findings[0].help, /fromMarkdown/);
		assert.doesNotMatch(validate('{"slides": [}').findings[0].help, /fromYaml|fromMarkdown/);
		assert.equal(validate('').valid, false);
		assert.equal(validate('   ').schemaValid, null);
	});

	test('a syntax failure is reported whatever only says, unless the rule is switched off', () => {
		assert.deepEqual(ids(validate('{', { only: ['layout'] })).every((id) => id === 'opf/json-syntax'), true);
		assert.deepEqual(validate('{', { ignore: ['opf/json-syntax'] }).findings, []);
		assert.equal(validate('{', { severity: { 'opf/json-syntax': 'warning' } }).valid, true);
	});

	test('findings about the document are located in the source, and a missing field at the object that lacks it', () => {
		const source = `{\n  "name": "x",\n  "language": "en-US",\n  "slides": [\n    {"title": "T", "image": "https://example.com/a.png"}\n  ]\n}\n`;
		const report = validate(source, { only: ['opf/missing-alt-text'] });
		assert.equal(report.findings.length, 1);
		const { location } = report.findings[0];
		assert.equal(location.line, 5);
		assert.equal(source.slice(location.offset, location.offset + location.length), '"https://example.com/a.png"');
		const missing = validate('{"name":"x","language":"en","slides":[{"text":"no title"}]}', { only: ['opf/missing-slide-title'] });
		assert.equal(missing.findings[0].location.line, 1);
		assert.ok(missing.findings[0].location.length > 5);
		// a BOM does not shift the ranges
		assert.ok(validate('﻿' + source, { only: ['opf/missing-alt-text'] }).findings.every((entry) => entry.location.line === 5));
	});

	test('text and the parsed document give the same findings', () => {
		const document = deck([{ title: 'Same', image: 'asset:missing' }, { text: 'no title' }]);
		const fromObject = validate(document);
		const fromText = validate(JSON.stringify(document, null, 2));
		const strip = (report) => report.findings.map(({ location, ...rest }) => rest);
		assert.deepEqual(strip(fromText), strip(fromObject));
		assert.ok(fromText.findings.every((entry) => entry.location));
		assert.equal(fromText.checks.syntax, 'checked');
		assert.equal(fromObject.checks.syntax, 'not-applicable');
	});

	test('duplicate keys are errors even when JSON.parse would hide them', () => {
		const report = validate('{"slides":[],"extensions":{"a\\u002fb":1,"a/b":2}}');
		const found = report.findings.find((entry) => entry.ruleId === 'opf/duplicate-key');
		assert.equal(found.path, '/extensions/a~1b');
		assert.equal(report.valid, false);
	});
});

describe('the report', () => {
	test('valid means no error finding, and a low-contrast, overflowing or untitled deck is still valid', () => {
		const faint = deck([{ text: [{ text: 'faint', color: '#DDDDDD' }] }], { design: { background: { type: 'solid', color: '#FFFFFF' } } });
		const report = validate(faint);
		assert.equal(report.valid, true);
		assert.ok(ids(report).includes('opf/text-contrast') && ids(report).includes('opf/missing-slide-title'));
		assert.equal(report.counts.error, 0);
		assert.equal(report.counts.warning + report.counts.info, report.findings.length);
		assert.equal(validate(faint, { severity: { 'opf/text-contrast': 'error' } }).valid, false);
	});

	test('a missing asset reference makes a deck invalid, as does a circular one (the one change to what valid means)', () => {
		const missing = validate({ slides: [{ title: 'x', image: 'asset:nope' }] }, { only: ['format', 'references'] });
		assert.equal(missing.valid, false);
		assert.equal(missing.schemaValid, true);
		assert.deepEqual(ids(missing), ['opf/asset-reference']);
		assert.equal(validate({ slides: [{ title: 'x', image: 'asset:nope' }] }, { only: ['format'] }).valid, true);
	});

	test('findings are ordered by slide, then category, then rule, and know their slide', () => {
		const report = validate(deck([{ id: 'one', title: 'One' }, { id: 'two', text: 'untitled', image: 'asset:gone' }], { language: undefined }));
		const slides = report.findings.map((entry) => entry.slide ?? -1);
		assert.deepEqual(slides, [...slides].sort((a, b) => a - b));
		const missing = report.findings.find((entry) => entry.ruleId === 'opf/asset-reference');
		assert.equal(missing.slide, 1);
		assert.equal(missing.slideId, 'two');
		assert.equal(report.findings.find((entry) => entry.ruleId === 'opf/missing-language').slide, undefined);
		const order = report.findings.filter((entry) => entry.slide === 1).map((entry) => entry.category);
		const rank = ['format', 'references', 'policy', 'accessibility', 'layout', 'content'];
		assert.deepEqual(order, [...order].sort((a, b) => rank.indexOf(a) - rank.indexOf(b)));
	});

	test('validate never mutates its input and is deterministic', () => {
		const input = freeze(deck([{ text: [{ text: 'faint', color: '#CCCCCC' }], image: 'asset:nope' }], { language: undefined, design: { background: { type: 'solid', color: '#FFFFFF' } } }));
		const options = freeze({ contracts: [{ path: '/slides/*/title', allowedValues: ['x'] }], catalogs: { layouts: [{ id: 'mine', name: 'Mine', placeholders: [{ type: 'title' }] }] } });
		assert.deepEqual(validate(input, options), validate(input, options));
	});

	test('a document the schema rejects reports its format errors and runs nothing else', () => {
		const report = validate({ slides: [{ title: 5 }] });
		assert.equal(report.valid, false);
		assert.ok(report.findings.every((entry) => entry.category === 'format'));
		assert.equal(report.checks.layout, 'not-run');
	});

	test('the finding category and rule id agree with the registry for every finding', () => {
		const sample = deck([{ text: 'x', image: 'asset:gone' }, { title: 'Hello {{who}}' }], { catalogs: { layouts: { source: 'https://example.invalid/l' } } });
		for (const entry of validate(sample).findings) {
			const info = findValidationRule(entry.ruleId);
			assert.ok(info, entry.ruleId);
			assert.equal(entry.category, info.category, entry.ruleId);
		}
	});
});

describe('every finding validates against the published finding schema', () => {
	const schema = JSON.parse(readFileSync(path.join(repoRoot, 'spec/schemas/finding.schema.json'), 'utf8'));
	const ajv = new Ajv2020({ allErrors: true, strict: false });
	addFormats(ajv);
	const validateReport = ajv.compile(schema);

	test('a report of every kind of finding validates, and unknown fields in a finding do not', () => {
		const documents = [
			deck([{ title: 'Revenue grew', text: 'ok' }]),
			deck([{ text: [{ text: 'faint', color: '#CCCCCC' }], image: 'asset:nope' }, { id: 's', title: 'Hello {{who}}', text: 'Lorem ipsum' }], { language: undefined, design: { background: { type: 'solid', color: '#FFFFFF' } } }),
			{ slides: [{ title: 5 }] },
			deck([{ title: 'T', chart: { type: 'column', data: { columns: ['Q', 'R'], rows: [['Q1', '12%'], ['Q2', '8%']] } } }]),
			deck([{ title: 'T' }], { variables: { who: { type: 'text', label: 'Who' } } }),
		];
		for (const document of documents) {
			for (const input of [document, JSON.stringify(document)]) {
				const report = validate(input, { contracts: [{ path: '/slides/*/title', allowedValues: ['x'] }] });
				assert.equal(validateReport(report), true, JSON.stringify(validateReport.errors));
			}
		}
		const report = validate(deck([{ title: 'x', image: 'asset:nope' }]));
		assert.ok(report.findings.length > 0);
		assert.equal(validateReport({ ...report, findings: [{ ...report.findings[0], unknownField: 1 }] }), false);
		assert.equal(validateReport({ ...report, findings: [{ ...report.findings[0], severity: 'fatal' }] }), false);
		assert.equal(validateReport({ ...report, findings: [{ ...report.findings[0], ruleId: 'no-prefix' }] }), false);
		// another producer's finding: its own prefix, its own category, JSON Patch fixes
		assert.equal(validateReport({ valid: true, counts: { error: 0, warning: 1, info: 0 }, findings: [{ ruleId: 'pptx.dev/narrative-gap', source: 'pptx.dev/review', severity: 'warning', category: 'narrative', path: '/slides/4/title', message: 'The deck never says what it asks for.', fixes: [{ title: 'Add an ask', patch: [{ op: 'add', path: '/slides/4/subtitle', value: 'Approve the budget' }] }] }] }), true);
	});

	test('the bundled examples and docs fixtures give findings of registered rules only, and the report validates', () => {
		const files = [];
		const walk = (dir) => {
			for (const name of readdirSync(dir)) {
				const file = path.join(dir, name);
				if (statSync(file).isDirectory()) walk(file);
				else if (name.endsWith('.opf.json')) files.push(file);
			}
		};
		walk(path.join(repoRoot, 'examples'));
		walk(path.join(repoRoot, 'docs/fixtures'));
		assert.ok(files.length > 100);
		const seen = new Set();
		for (const file of files) {
			const report = validate(readFileSync(file, 'utf8'));
			assert.equal(validateReport(report), true, `${path.relative(repoRoot, file)}: ${JSON.stringify(validateReport.errors)}`);
			for (const entry of report.findings) {
				assert.ok(findValidationRule(entry.ruleId), `${path.relative(repoRoot, file)}: ${entry.ruleId}`);
				seen.add(entry.ruleId);
			}
		}
		assert.ok(seen.size > 5);
	});
});

describe('the public surface', () => {
	test('the old checker names are gone from the root, and the new ones are there', () => {
		for (const gone of ['validatePresentation', 'assertValidPresentation', 'lintSource', 'lintPresentation', 'auditSource', 'auditPresentation', 'auditRules', 'findAuditRule', 'DEFAULT_AUDIT_THRESHOLDS'])
			assert.equal(root[gone], undefined, gone);
		for (const name of ['validate', 'assertValid', 'validateCatalogRecord', 'assertValidCatalogRecord', 'OPFValidationError', 'validationRules', 'findValidationRule', 'DEFAULT_VALIDATION_THRESHOLDS', 'DEFAULT_CHART_PALETTE', 'validationCategories'])
			assert.notEqual(root[name], undefined, name);
		assert.equal(typeof root.validate, 'function');
		// the generic schema validator is internal: validate(value, kind) is not a second signature
		assert.throws(() => root.validate({ slides: [{ title: 'x' }] }, 'theme'), TypeError);
		assert.throws(() => root.validate({ slides: [{ title: 'x' }] }, 'presentation'), TypeError);
	});

	test('the schema list publishes the finding schema', () => {
		assert.ok(root.schemaNames.includes('finding'));
		assert.equal(root.schemas.finding.$id, 'https://openpresentation.org/schema/opf-finding/v1');
		assert.ok(root.schemaEntries.some((entry) => entry.name === 'finding' && entry.file === 'schemas/finding.schema.json'));
		assert.equal(root.catalogKinds.includes('finding'), false);
	});

	test('the types agree: validate returns a ValidationReport of Findings, assertValid narrows, removed names do not compile', () => {
		const fixture = fileURLToPath(new URL('./validate-consumer-fixture.ts', import.meta.url));
		const source = `import { validate, assertValid, validateCatalogRecord, validationRules, type Finding, type FindingReport, type FindingFix, type FindingLocation, type FindingSeverity, type FindingCategory, type ValidateOptions, type ValidationReport, type Contract, type Presentation } from '../dist/index.js';
import { validate as fromValidator } from '../dist/validator.js';
declare const input: unknown;
const report: ValidationReport = validate(input, { only: ['format'], fonts: { textMeasurement: undefined }, severity: { 'opf/text-contrast': 'error' } });
const asReport: FindingReport = report;
const first: Finding | undefined = report.findings[0];
const severity: FindingSeverity | undefined = first?.severity;
const category: FindingCategory | undefined = first?.category;
const fixes: FindingFix[] | undefined = first?.fixes;
const where: FindingLocation | undefined = first?.location;
const layout: 'not-run' | 'estimated' | 'measured' = report.checks.layout;
const schemaValid: boolean | null = report.schemaValid;
const text: ValidationReport = validate('{"slides":[]}');
const record: ValidationReport = validateCatalogRecord('themes', {});
const same: ValidationReport = fromValidator(input);
const options: ValidateOptions = { contracts: [{ path: '/slides/*/layout', allowedValues: ['text-1x'] } satisfies Contract] };
const costs: string[] = validationRules.map((rule) => rule.cost);
assertValid(input);
const narrowed: Presentation = input;
// @ts-expect-error The second argument is options, not a schema or catalog kind.
validate(input, 'presentation');
// @ts-expect-error Findings have no errors/warnings arrays: filter by severity.
report.errors;
// @ts-expect-error The report array is findings.
report.diagnostics;
// @ts-expect-error validatePresentation was removed.
import { validatePresentation } from '../dist/index.js';
void [asReport, severity, category, fixes, where, layout, schemaValid, text, record, same, options, costs, narrowed, validatePresentation];`;
		const options = { strict: true, noEmit: true, skipLibCheck: false, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, types: [] };
		const host = ts.createCompilerHost(options);
		const read = host.readFile.bind(host);
		const exists = host.fileExists.bind(host);
		host.readFile = (file) => (path.resolve(file) === fixture ? source : read(file));
		host.fileExists = (file) => path.resolve(file) === fixture || exists(file);
		const program = ts.createProgram([fixture], options, host);
		const errors = ts.getPreEmitDiagnostics(program);
		assert.equal(errors.length, 0, ts.formatDiagnosticsWithColorAndContext(errors, { getCurrentDirectory: () => process.cwd(), getCanonicalFileName: (file) => file, getNewLine: () => '\n' }));
	});
});
