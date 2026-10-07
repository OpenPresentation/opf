import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { validate, validateCatalogRecord } from '../dist/index.js';

// The format, references and policy categories: syntax, schema, catalogs, assets and host contracts.
const checkAll = (input, options) => validate(input, { only: ['format', 'references', 'policy'], ...options });

const layout = (id, name = id) => ({
	id,
	name,
	placeholders: [{ type: 'title' }, { type: 'text' }],
});
const freeze = (value) => {
	if (value && typeof value === 'object') {
		Object.freeze(value);
		Object.values(value).forEach(freeze);
	}
	return value;
};

test('text input is read, never rewritten, and the report separates what was not checked', () => {
	const source =
		'\uFEFF{\r\n "name"  : "e\u0302  two spaces",\r "slides": [{"title":"Keep","layout":"text-1x"}]\n}';
	const before = Buffer.from(source),
		result = checkAll(source);
	assert.equal(result.valid, true);
	assert.equal(result.schemaValid, true);
	assert.deepEqual(result.findings, []);
	assert.equal(result.checks.syntax, 'checked');
	assert.equal(result.checks.layout, 'not-run');
	assert.equal(result.checks.accessibility, 'not-run');
	assert.equal(result.checks.backgroundPixels, 'not-read');
	assert.equal(result.checks.nativeExport, 'not-checked');
	assert.deepEqual(Buffer.from(source), before);
});
test('syntax errors include exact source ranges and never claim schema acceptance', () => {
	for (const source of [
		'',
		'  ',
		'{"slides":[}',
		'{"slides":[],}',
		'// comment\n{"slides":[]}',
	]) {
		const result = checkAll(source);
		assert.equal(result.valid, false);
		assert.equal(result.schemaValid, null);
		assert.equal(result.checks.schema, 'not-run');
		assert.ok(
			result.findings.every(
				(issue) =>
					issue.ruleId === 'opf/json-syntax' &&
					issue.location.offset >= 0 &&
					issue.location.line >= 1,
			),
		);
	}
});
test('duplicate escaped keys remain errors even when JSON.parse would hide them', () => {
	const source = '{"slides":[],"extensions":{"a\\u002fb":1,"a/b":2}}',
		result = checkAll(source);
	const issue = result.findings.find(
		(issue) => issue.ruleId === 'opf/duplicate-key',
	);
	assert.equal(result.valid, false);
	assert.equal(issue.path, '/extensions/a~1b');
	assert.equal(issue.location.offset, source.lastIndexOf('"a/b"'));
	assert.equal(issue.location.length, 5);
});
test('schema diagnostics retain complete constraints and array source locations', () => {
	const source = '{\r\n"name":"😀",\r"slides":[{"type":"tabel","table":{}}]\n}',
		result = checkAll(source);
	const issue = result.findings.find(
		(issue) =>
			issue.path === '/slides/0/type' && issue.validation?.keyword === 'enum',
	);
	assert.equal(result.valid, false);
	assert.ok(issue.suggestions.some((option) => option.value === 'table'));
	assert.equal(issue.location.offset, source.indexOf('"tabel"'));
	assert.equal(issue.location.line, 3);
	assert.ok(
		issue.definition.startsWith('https://openpresentation.org/schema/opf/v1#'),
	);
	assert.deepEqual(issue.lookup.slice(0, 3), ['opf', 'schema', 'presentation']);
});
test('reference diagnostics use supplied catalogs and exact definition files', () => {
	const document = freeze({
		slides: [{ title: 'Keep', layout: 'pratner' }],
		catalogs: {
			layouts: {
				source: 'https://example.invalid/layouts',
				records: [layout('partner', 'Document label')],
			},
		},
	});
	const options = freeze({
			catalogs: {
				layouts: [layout('partner', 'Loaded label'), layout('loaded')],
			},
		}),
		before = JSON.stringify({ document, options });
	const result = checkAll(document, options),
		issue = result.findings.find(
			(issue) => issue.ruleId === 'opf/catalog-reference',
		);
	assert.equal(result.valid, true);
	assert.equal(issue.path, '/slides/0/layout');
	assert.equal(issue.suggestions[0].value, 'partner');
	assert.equal(issue.suggestions[0].label, 'Document label');
	assert.equal(issue.suggestions[0].origin, 'document');
	assert.ok(
		result.findings.some((issue) => issue.ruleId === 'opf/catalog-source'),
	);
	assert.equal(JSON.stringify({ document, options }), before);
	assert.deepEqual(checkAll(document, options), result);
	for (const suggestion of checkAll({
		design: { fontScheme: 'robtoo' },
		slides: [],
	}).findings.flatMap((issue) => issue.suggestions ?? []))
		if (suggestion.origin === 'built-in')
			assert.equal(
				JSON.parse(
					readFileSync(
						new URL('../../../' + suggestion.definition, import.meta.url),
						'utf8',
					),
				).id,
				suggestion.value,
			);
	assert.equal(
		checkAll({ slides: [{ layout: 'loaded' }] }, options).findings
			.length,
		0,
	);
});
test('unknown engine layouts warn without forbidding custom names or free-form prose', () => {
	const result = checkAll({
		audience: 'Series B investors',
		purpose: 'winning',
		tone: { name: 'Warm' },
		slides: [{ layout: 'Custom_EngineLayout' }],
		extensions: {
			layout: 'fake',
			design: { theme: 'fake' },
			contracts: [{ path: '/slides/*/layout', allowedValues: [] }],
		},
	});
	const references = result.findings.filter(
		(issue) => issue.ruleId === 'opf/catalog-reference',
	);
	assert.deepEqual(
		references.map((issue) => issue.path),
		['/slides/0/layout'],
	);
	assert.equal(result.valid, true);
});
test('schema traversal finds nested chart and design references without scanning arbitrary data', () => {
	const result = checkAll({
		design: { theme: { id: 'missing-theme' }, fontScheme: 'missing-font' },
		slides: [
			{
				blocks: [
					{
						type: 'group',
						blocks: [{ chart: { type: 'missing-chart', data: [] } }],
					},
				],
			},
		],
	});
	const paths = result.findings
		.filter((issue) => issue.ruleId === 'opf/catalog-reference')
		.map((issue) => issue.path)
		.sort();
	assert.deepEqual(paths, [
		'/design/fontScheme',
		'/design/theme/id',
		'/slides/0/blocks/0/blocks/0/chart/type',
	]);
});
test('invalid and duplicate catalog definitions stay visible and cannot silently fall back', () => {
	const result = checkAll({
		slides: [{ layout: 'text-1x' }],
		catalogs: {
			layouts: {
				records: [
					layout('duplicate'),
					layout('duplicate'),
					{ id: 'text-1x', placeholders: 'invalid' },
				],
			},
		},
	});
	assert.equal(result.valid, false);
	assert.ok(
		result.findings.some(
			(issue) =>
				issue.ruleId === 'opf/catalog-record' &&
				issue.message.includes('Duplicate'),
		),
	);
	assert.ok(
		result.findings.some(
			(issue) =>
				issue.ruleId === 'opf/catalog-record' &&
				issue.path.startsWith('/catalogs/layouts/records/2'),
		),
	);
	const loaded = checkAll(
		{ slides: [{ title: 'Valid' }] },
		{ catalogs: { layouts: [{ id: 'bad', placeholders: 42 }] } },
	);
	assert.equal(loaded.valid, false);
	assert.ok(loaded.findings.every((issue) => issue.scope === 'context'));
});
test('explicit contracts provide policy fixes while metadata never supplies policy', () => {
	const document = freeze({
			slides: [{ layout: 'title-subtitle', title: 'Keep' }],
			extensions: { 'a/b~': 1 },
		}),
		options = freeze({
			contracts: [
				{
					path: '/slides/*/layout',
					allowedValues: ['text-1x'],
					message: 'Use {{allowed}} at {{path}}; see {{file}}.',
					documentation: 'brand.json#/layouts',
				},
				{ path: '/extensions/a~1b~0', allowedValues: [2], severity: 'warning' },
			],
		});
	const result = checkAll(document, options);
	assert.equal(result.valid, false);
	assert.equal(result.schemaValid, true);
	assert.equal(result.counts.error, 1);
	assert.equal(result.counts.warning, 1);
	// Findings are ordered by slide, so the finding about the extension (no slide) comes first.
	const layoutFinding = result.findings.find((entry) => entry.path === '/slides/0/layout');
	assert.match(
		layoutFinding.message,
		/text-1x.*\/slides\/0\/layout.*brand.json/,
	);
	assert.equal(layoutFinding.suggestions[0].origin, 'contract');
	assert.equal(layoutFinding.category, 'policy');
	assert.equal(layoutFinding.severity, 'error');
	assert.equal(result.findings.find((entry) => entry.path === '/extensions/a~1b~0').severity, 'warning');
	assert.equal(checkAll(document).valid, true);
});
test('invalid options fail clearly instead of ignoring misspelled policies', () => {
	for (const options of [
		null,
		{ rules: {} },
		{ catalogs: { unknown: [] } },
		{ catalogs: { layouts: true } },
		{ contracts: [{ path: 'not-pointer', allowedValues: [] }] },
		{ contracts: [{ path: '/slides', allowedValues: [{}] }] },
		{ contracts: [{ path: '/slides', allowedValues: [], severity: 'warn' }] },
	])
		assert.throws(() => validate({ slides: [] }, options), TypeError);
});
test('asset references diagnose missing registry entries and cycles without fetching sources', () => {
	const source =
		'{"assets":{"logo":"https://example.invalid/logo.png"},"slides":[{"image":"asset:lgog"}],"extensions":{"image":"asset:ignore"}}';
	const result = checkAll(source),
		issue = result.findings.find(
			(issue) => issue.ruleId === 'opf/asset-reference',
		);
	assert.equal(result.valid, false);
	assert.equal(issue.path, '/slides/0/image');
	assert.equal(issue.location.offset, source.indexOf('"asset:lgog"'));
	assert.equal(issue.suggestions[0].value, 'asset:logo');
	const valid = checkAll({
		assets: { logo: 'https://example.invalid/logo.png' },
		slides: [{ image: 'asset:logo' }],
	});
	assert.equal(valid.valid, true);
	assert.equal(valid.checks.references, 'checked');
	const cyclic = checkAll({
		assets: { a: 'asset:b', b: { src: 'asset:a', alt: 'Keep' } },
		slides: [{ image: 'asset:a' }],
	});
	assert.equal(
		cyclic.findings.filter((issue) => issue.ruleId === 'opf/asset-cycle')
			.length,
		1,
	);
	assert.equal(cyclic.valid, false);
	const nested = checkAll({
		assets: { alias: { src: 'asset:missing-registry' } },
		design: {
			logo: 'asset:missing-logo',
			watermark: { src: 'asset:missing-watermark', opacity: 0.1 },
			background: { type: 'image', image: { src: 'asset:missing-background' } },
			footer: {
				right: { image: { src: 'asset:missing-footer', alt: 'Keep' } },
			},
		},
		slides: [{ title: 'asset:literal-text', video: 'asset:missing-video' }],
	});
	assert.deepEqual(
		nested.findings
			.filter((issue) => issue.ruleId === 'opf/asset-reference')
			.map((issue) => issue.path)
			.sort(),
		[
			'/assets/alias/src',
			'/design/background/image/src',
			'/design/footer/right/image/src',
			'/design/logo',
			'/design/watermark/src',
			'/slides/0/video',
		],
	);
});

test('unknown bare-id audiences warn like narratives; gallery audience ids resolve', () => {
	const result = checkAll({
		audience: ['no-such-audience', 'Series B investors', 'executive'],
		slides: [{ title: 'Keep' }],
	});
	assert.equal(result.valid, true);
	assert.deepEqual(
		result.findings
			.filter((issue) => issue.ruleId === 'opf/catalog-reference')
			.map((issue) => [issue.path, issue.severity]),
		[['/audience/0', 'warning']],
	);
	assert.deepEqual(
		checkAll({ audience: 'general-public', narrative: 'pyramid-principle', slides: [{ title: 'Keep' }] })
			.findings,
		[],
	);
});

test('a custom narrative is an inline catalog record; the narrative field is a string', () => {
	const inline = (records) =>
		checkAll({
			narrative: 'custom-arc',
			catalogs: { narratives: { records } },
			slides: [{ title: 'Keep' }],
		});
	assert.deepEqual(inline([{ id: 'custom-arc', name: 'Custom', beats: [{ id: 'a', name: 'A' }] }]).findings, []);
	assert.ok(
		checkAll({
			narrative: 'custom-arc',
			slides: [{ title: 'Keep' }],
		}).findings.some((issue) => issue.ruleId === 'opf/catalog-reference'),
	);
	assert.equal(checkAll({ narrative: { id: 'custom-arc' }, slides: [{ title: 'Keep' }] }).valid, false);
});

test('catalog diagnostics locate referenced schema constraints without changing validator reports', () => {
	const record = {
		$schema: 'https://openpresentation.org/schema/opf-theme/v1',
		id: 'custom',
		name: 'Custom',
		background: 'light1',
	};
	const validation = validateCatalogRecord('themes', record);
	assert.equal(validation.valid, false);
	const source = JSON.stringify({
		catalogs: { themes: { records: [record] } },
		slides: [{ title: 'Keep' }],
	});
	const diagnostic = checkAll(source).findings.find(
		(issue) => issue.ruleId === 'opf/catalog-record',
	);
	assert.equal(diagnostic.path, '/catalogs/themes/records/0/background');
	assert.equal(
		diagnostic.definition,
		'https://openpresentation.org/schema/opf-theme/v1#/$defs/ThemeBackground/type',
	);
	assert.deepEqual(diagnostic.lookup, [
		'opf',
		'schema',
		'theme',
		'/$defs/ThemeBackground/type',
	]);
	assert.equal(diagnostic.location.offset, source.indexOf('"light1"'));
	const raw = validation.findings[0].validation;
	assert.equal(validation.findings[0].ruleId, 'opf/schema');
	assert.deepEqual(Object.keys(raw).sort(), [
		'keyword',
		'message',
		'params',
		'path',
		'schemaPath',
	]);
	assert.deepEqual(diagnostic.validation, raw);
});

test('language tags preserve regional, extended, private and grandfathered forms', () => {
	for (const language of [
		'en-US',
		'en-GB',
		'ja-JP',
		'fr',
		'sr-Latn-RS',
		'es-419',
		'zh-cmn-Hans-CN',
		'de-CH-1901',
		'en-US-u-ca-gregory',
		'x-private',
		'en-x-business',
		'i-klingon',
		'sgn-BE-FR',
		'en-GB-oed',
	]) {
		const source = JSON.stringify({ language, slides: [{ title: 'Keep' }] });
		const result = checkAll(source);
		assert.equal(result.valid, true, language);
		assert.deepEqual(result.findings, [], language);
	}
	assert.equal(
		checkAll({ language: 'en-UK', slides: [{ title: 'Keep' }] }).valid,
		false,
	);
	const explicitId = checkAll({
		language: { id: 'custom-language-id', bcp47: 'en-US' },
		slides: [{ title: 'Keep' }],
	});
	assert.ok(
		explicitId.findings.some(
			(issue) =>
				issue.path === '/language/id' &&
				issue.ruleId === 'opf/catalog-reference',
		),
	);
	const nested = checkAll({
		language: { bcp47: 'en-US', fontScheme: 'missing-font' },
		slides: [{ title: 'Keep' }],
	});
	assert.deepEqual(
		nested.findings.map((issue) => issue.path),
		['/language/fontScheme'],
	);
	assert.equal(
		nested.findings[0].definition,
		'https://openpresentation.org/schema/opf/v1#/$defs/Language/properties/fontScheme',
	);
});

test('deprecated catalog aliases are flagged with the canonical id as the suggestion', () => {
	const result = checkAll({
		name: 'Deprecated alias',
		design: { theme: 'legacy-look' },
		catalogs: {
			themes: {
				records: [
					{
						$schema: 'https://openpresentation.org/schema/opf-theme/v1',
						id: 'legacy-look',
						name: 'Legacy look',
						deprecation: { replacedBy: 'minimal' },
					},
				],
			},
		},
		slides: [{ title: 'Deck' }],
	});
	const issue = result.findings.find((entry) => entry.ruleId === 'opf/deprecated-catalog-id');
	assert.ok(issue, JSON.stringify(result.findings, null, 2));
	assert.equal(issue.severity, 'warning');
	assert.equal(issue.path, '/design/theme');
	assert.equal(issue.suggestions?.[0]?.value, 'minimal');
	assert.equal(result.findings.filter((entry) => entry.ruleId === 'opf/catalog-reference').length, 0);
	assert.equal(result.valid, true);
});
