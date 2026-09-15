import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { lintPresentation, lintSource } from '../dist/lint.js';

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

test('lint preserves valid source bytes and separates unchecked fidelity gates', () => {
	const source =
		'\uFEFF{\r\n "name"  : "e\u0302  two spaces",\r "slides": [{"title":"Keep","layout":"text-1x"}]\n}';
	const before = Buffer.from(source),
		result = lintSource(source);
	assert.equal(result.valid, true);
	assert.equal(result.schemaValid, true);
	assert.deepEqual(result.diagnostics, []);
	assert.equal(result.checks.layout, 'not-checked');
	assert.equal(result.checks.fonts, 'not-checked');
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
		const result = lintSource(source);
		assert.equal(result.valid, false);
		assert.equal(result.schemaValid, null);
		assert.equal(result.checks.schema, 'not-run');
		assert.ok(
			result.diagnostics.every(
				(issue) =>
					issue.ruleId === 'json/syntax' &&
					issue.location.offset >= 0 &&
					issue.location.line >= 1,
			),
		);
	}
});
test('duplicate escaped keys remain errors even when JSON.parse would hide them', () => {
	const source = '{"slides":[],"extensions":{"a\\u002fb":1,"a/b":2}}',
		result = lintSource(source);
	const issue = result.diagnostics.find(
		(issue) => issue.ruleId === 'json/duplicate-key',
	);
	assert.equal(result.valid, false);
	assert.equal(issue.path, '/extensions/a~1b');
	assert.equal(issue.location.offset, source.lastIndexOf('"a/b"'));
	assert.equal(issue.location.length, 5);
});
test('schema diagnostics retain complete constraints and array source locations', () => {
	const source = '{\r\n"name":"😀",\r"slides":[{"type":"tabel","table":{}}]\n}',
		result = lintSource(source);
	const issue = result.diagnostics.find(
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
	const result = lintPresentation(document, options),
		issue = result.diagnostics.find(
			(issue) => issue.ruleId === 'opf/catalog-reference',
		);
	assert.equal(result.valid, true);
	assert.equal(issue.path, '/slides/0/layout');
	assert.equal(issue.suggestions[0].value, 'partner');
	assert.equal(issue.suggestions[0].label, 'Document label');
	assert.equal(issue.suggestions[0].origin, 'document');
	assert.ok(
		result.diagnostics.some((issue) => issue.ruleId === 'opf/catalog-source'),
	);
	assert.equal(JSON.stringify({ document, options }), before);
	assert.deepEqual(lintPresentation(document, options), result);
	for (const suggestion of lintPresentation({
		design: { fontScheme: 'robtoo' },
		slides: [],
	}).diagnostics.flatMap((issue) => issue.suggestions ?? []))
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
		lintPresentation({ slides: [{ layout: 'loaded' }] }, options).diagnostics
			.length,
		0,
	);
});
test('unknown engine layouts warn without forbidding custom names or free-form prose', () => {
	const result = lintPresentation({
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
	const references = result.diagnostics.filter(
		(issue) => issue.ruleId === 'opf/catalog-reference',
	);
	assert.deepEqual(
		references.map((issue) => issue.path),
		['/slides/0/layout'],
	);
	assert.equal(result.valid, true);
});
test('schema traversal finds nested chart and design references without scanning arbitrary data', () => {
	const result = lintPresentation({
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
	const paths = result.diagnostics
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
	const result = lintPresentation({
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
		result.diagnostics.some(
			(issue) =>
				issue.ruleId === 'opf/catalog-record' &&
				issue.message.includes('Duplicate'),
		),
	);
	assert.ok(
		result.diagnostics.some(
			(issue) =>
				issue.ruleId === 'opf/catalog-record' &&
				issue.path.startsWith('/catalogs/layouts/records/2'),
		),
	);
	const loaded = lintPresentation(
		{ slides: [{ title: 'Valid' }] },
		{ catalogs: { layouts: [{ id: 'bad', placeholders: 42 }] } },
	);
	assert.equal(loaded.valid, false);
	assert.ok(loaded.diagnostics.every((issue) => issue.scope === 'context'));
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
	const result = lintPresentation(document, options);
	assert.equal(result.valid, false);
	assert.equal(result.schemaValid, true);
	assert.equal(result.counts.error, 1);
	assert.equal(result.counts.warning, 1);
	assert.match(
		result.diagnostics[0].message,
		/text-1x.*\/slides\/0\/layout.*brand.json/,
	);
	assert.equal(result.diagnostics[0].suggestions[0].origin, 'contract');
	assert.equal(lintPresentation(document).valid, true);
});
test('invalid lint options fail clearly instead of ignoring misspelled policies', () => {
	for (const options of [
		null,
		{ rules: {} },
		{ catalogs: { unknown: [] } },
		{ catalogs: { layouts: true } },
		{ contracts: [{ path: 'not-pointer', allowedValues: [] }] },
		{ contracts: [{ path: '/slides', allowedValues: [{}] }] },
		{ contracts: [{ path: '/slides', allowedValues: [], severity: 'warn' }] },
	])
		assert.throws(() => lintPresentation({ slides: [] }, options), TypeError);
});
test('asset references diagnose missing registry entries and cycles without fetching sources', () => {
	const source =
		'{"assets":{"logo":"https://example.invalid/logo.png"},"slides":[{"image":"asset:lgog"}],"extensions":{"image":"asset:ignore"}}';
	const result = lintSource(source),
		issue = result.diagnostics.find(
			(issue) => issue.ruleId === 'opf/asset-reference',
		);
	assert.equal(result.valid, false);
	assert.equal(issue.path, '/slides/0/image');
	assert.equal(issue.location.offset, source.indexOf('"asset:lgog"'));
	assert.equal(issue.suggestions[0].value, 'asset:logo');
	const valid = lintPresentation({
		assets: { logo: 'https://example.invalid/logo.png' },
		slides: [{ image: 'asset:logo' }],
	});
	assert.equal(valid.valid, true);
	assert.equal(valid.checks.assetReferences, 'registry-only');
	const cyclic = lintPresentation({
		assets: { a: 'asset:b', b: { src: 'asset:a', alt: 'Keep' } },
		slides: [{ image: 'asset:a' }],
	});
	assert.equal(
		cyclic.diagnostics.filter((issue) => issue.ruleId === 'opf/asset-cycle')
			.length,
		1,
	);
	assert.equal(cyclic.valid, false);
	const nested = lintPresentation({
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
		nested.diagnostics
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
