import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEFAULT_VALIDATION_THRESHOLDS, assertValid, findValidationRule, validate, validationRules } from '../dist/index.js';
import { renderRuleReference } from '../../../scripts/build-validate-docs.mjs';

const deck = (slides, extra = {}) => ({ name: 'Rules fixture', language: 'en-US', ...extra, slides });
const ids = (report) => report.findings.map((d) => d.ruleId);
const only = (document, rule, options = {}) => validate(document, { ...options, only: [rule] }).findings;
const has = (document, rule, options) => only(document, rule, options).length > 0;
const white = { background: { type: 'solid', color: '#FFFFFF' } };
const freeze = (value) => {
	if (value && typeof value === 'object') {
		Object.freeze(value);
		for (const child of Object.values(value)) freeze(child);
	}
	return value;
};
// A PNG signature and IHDR are all intrinsicImageSize reads; this is not a decodable image.
const png = (width, height) => {
	const bytes = Buffer.alloc(33);
	Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
	bytes.writeUInt32BE(13, 8);
	bytes.write('IHDR', 12, 'ascii');
	bytes.writeUInt32BE(width, 16);
	bytes.writeUInt32BE(height, 20);
	return `data:image/png;base64,${bytes.toString('base64')}`;
};

test('every rule has a stable id, a category, a cost, a rationale and an entry in docs/validate.md', () => {
	const doc = readFileSync(new URL('../../../docs/validate.md', import.meta.url), 'utf8');
	assert.equal(validationRules.length, 67);
	const seen = new Set();
	for (const info of validationRules) {
		assert.match(info.id, /^opf\/[a-z][a-z0-9-]*$/);
		assert.equal(info.id, `opf/${info.name}`);
		assert.ok(!seen.has(info.id), `duplicate ${info.id}`);
		seen.add(info.id);
		assert.ok(info.summary.length > 10 && info.rationale.length > 20, info.id);
		assert.ok(['error', 'warning', 'info'].includes(info.severity));
		assert.ok(['format', 'references', 'policy', 'accessibility', 'layout', 'content'].includes(info.category), info.id);
		assert.ok(['syntax', 'structure', 'composition'].includes(info.cost), info.id);
		assert.ok(doc.includes(`### \`${info.id}\``), `docs/validate.md lacks ${info.id}`);
		assert.equal(findValidationRule(info.name), info);
		assert.equal(findValidationRule(info.id), info);
	}
	// The objective rules are the 21 that remain (20 here, plus opf/variable-unfilled, which is a format rule) and FA-02's
	// opf/unused-beat and FA-29's opf/language-tag; the four taste rules are gone. The rest of these categories are the engine's data, highlight, variable
	// and narrative warnings.
	const engineWarnings = ['opf/chart-option-adapted', 'opf/chart-value-not-numeric', 'opf/chart-mapping-adapted', 'opf/chart-highlight-adapted', 'opf/code-highlight-out-of-range', 'opf/code-highlight-range-reversed', 'opf/variable-builtin-missing', 'opf/duration-outside-narrative', 'opf/narrative-duration-range'];
	assert.equal(validationRules.filter((info) => ['accessibility', 'layout', 'content'].includes(info.category) && !engineWarnings.includes(info.id)).length, 22);
	assert.equal(findValidationRule('variable-unfilled').category, 'format');
	for (const gone of ['font-family-count', 'slide-word-count', 'title-position', 'small-cell', 'unfilled-variable', 'invalid-document', 'catalog-reference', 'deprecated-catalog-id', 'catalog-source'])
		assert.equal(findValidationRule(gone), undefined, gone);
	// Only the composition-cost rules build layouts.
	assert.deepEqual(validationRules.filter((info) => info.cost === 'composition').map((info) => info.name).sort(), ['image-resolution', 'layout-failed', 'min-font-size', 'reading-order', 'text-contrast', 'text-on-image', 'text-overflow', 'unresolved-content']);
});

test('docs/validate.md carries the current generated rule reference', () => {
	const doc = readFileSync(new URL('../../../docs/validate.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
	assert.ok(doc.includes(renderRuleReference(validationRules, DEFAULT_VALIDATION_THRESHOLDS)), 'run: node scripts/build-validate-docs.mjs');
});

test('a clean deck has no findings and the report states what was and was not measured', () => {
	const report = validate(
		deck([
			{ title: 'Revenue grew', subtitle: 'Three quarters in a row', text: 'Revenue grew in every quarter of the year.' },
			{ title: 'Next steps', items: ['Hire two engineers', 'Ship the beta'] },
		]),
	);
	assert.deepEqual(report.findings, []);
	assert.equal(report.valid, true);
	assert.equal(report.schemaValid, true);
	assert.equal(report.checks.layout, 'estimated');
	assert.equal(report.checks.accessibility, 'checked');
	assert.equal(report.checks.content, 'checked');
	assert.equal(report.checks.backgroundPixels, 'not-read');
	assert.equal(report.checks.imageBytes, 'embedded-only');
	assert.equal(report.checks.nativeExport, 'not-checked');
});

test('findings have the shared Finding shape, are deterministic and never mutate the input', () => {
	const input = freeze(deck([{ text: [{ text: 'faint', color: '#CCCCCC' }] }], { language: undefined, design: white }));
	const a = validate(input),
		b = validate(input);
	assert.deepEqual(a, b);
	assert.ok(a.findings.length >= 2);
	for (const d of a.findings) {
		assert.match(d.ruleId, /^opf\//);
		assert.ok(['format', 'references', 'policy', 'accessibility', 'layout', 'content'].includes(d.category));
		assert.ok(['error', 'warning', 'info'].includes(d.severity));
		assert.equal(d.scope, 'document');
		assert.equal(typeof d.path, 'string');
		assert.ok(d.message && d.help);
		assert.match(d.definition, /docs\/validate\.md#opf/);
	}
	assert.equal(a.counts.warning + a.counts.info + a.counts.error, a.findings.length);
});

test('a document that fails the schema reports why, and its accessibility, layout and content rules do not run', () => {
	const report = validate({ name: 'bad', slides: [{ title: 5 }] });
	assert.equal(report.schemaValid, false);
	assert.equal(report.valid, false);
	assert.deepEqual([...new Set(ids(report))], ['opf/schema']);
	assert.equal(report.checks.accessibility, 'not-run');
	assert.equal(report.checks.layout, 'not-run');
	// Asking only for accessibility still says why nothing ran: the format errors are reported unless switched off.
	assert.deepEqual([...new Set(ids(validate({ name: 'bad', slides: [{ title: 5 }] }, { only: ['accessibility'] })))], ['opf/schema']);
	assert.deepEqual(validate({ name: 'bad', slides: [{ title: 5 }] }, { only: ['accessibility'], ignore: ['format'] }).findings, []);
	assert.equal(validate(undefined).schemaValid, false);
});

// ------------------------------------------------------------ text-contrast

test('opf/text-contrast: explicit light text on a white background', () => {
	const slides = [{ title: 'T', text: ['Readable and ', { text: 'faint', color: '#CCCCCC' }] }];
	const found = only(deck(slides, { design: white }), 'text-contrast');
	assert.equal(found.length, 1);
	assert.equal(found[0].path, '/slides/0/text/1/color');
	assert.equal(found[0].severity, 'warning');
	// default body text is 18.75 pt, which WCAG counts as large text
	assert.ok(found[0].measured.ratio < 2 && found[0].measured.needed === 3 && found[0].measured.large === true);
	assert.equal(found[0].slide, 0);
	// quick fix: switch to the text colour, which is readable on white
	const fix = found[0].fixes.find((f) => f.id === 'use-readable-color');
	assert.equal(fix.safe, true);
	assert.deepEqual(fix.patch, [{ op: 'replace', path: '/slides/0/text/1/color', value: 'text' }]);
	assert.ok(!has(deck([{ title: 'T', text: ['Readable and ', { text: 'dark', color: '#222222' }] }], { design: white }), 'text-contrast'));
});

test('opf/text-contrast: large text needs 3:1, normal text 4.5:1', () => {
	// #949494 on white is about 3.03:1
	const grey = '#949494';
	const run = (extra) => deck([{ title: 'T', text: [{ text: 'Some text', color: grey, ...extra }] }], { design: white });
	// default body text is 18.75 pt: large
	assert.equal(only(run({}), 'text-contrast').length, 0);
	const small = only(run({ fontSize: 14 }), 'text-contrast');
	assert.equal(small.length, 1);
	assert.equal(small[0].measured.large, false);
	assert.equal(small[0].measured.needed, 4.5);
	// 14 pt bold is large too
	assert.equal(only(run({ fontSize: 14, bold: true }), 'text-contrast').length, 0);
	assert.equal(only(run({}), 'text-contrast', { thresholds: { contrastLarge: 4 } }).length, 1);
	assert.equal(only(run({ fontSize: 14 }), 'text-contrast', { thresholds: { contrastNormal: 3 } }).length, 0);
});

test('opf/text-contrast: a dark gradient behind default text, and a gradient that is fine', () => {
	const gradient = (a, b) => ({ background: { type: 'gradient', gradient: { angle: 0, stops: [{ color: a, position: 0 }, { color: b, position: 1 }] } } });
	const bad = only(deck([{ title: 'Gradient', text: 'Body' }], { design: gradient('#000000', '#10103A') }), 'text-contrast');
	assert.equal(bad.length, 1);
	assert.match(bad[0].message, /more text element/);
	assert.equal(bad[0].measured.alsoAffected, 1);
	assert.ok(!has(deck([{ title: 'Gradient', text: 'Body' }], { design: gradient('#FFFFFF', '#F0F0FF') }), 'text-contrast'));
});

test('opf/text-contrast: only the part of a gradient under the text counts', () => {
	// light on the left, black on the right: the left-aligned title never reaches the dark half
	const design = { background: { type: 'gradient', gradient: { angle: 0, stops: [{ color: '#FFFFFF', position: 0 }, { color: '#FFFFFF', position: 0.5 }, { color: '#000000', position: 1 }] } } };
	const found = only(deck([{ title: 'Short', layout: 'title' }], { design }), 'text-contrast');
	assert.equal(found.length, 0);
	// ...but text that spans the dark half does fail
	assert.ok(has(deck([{ title: 'A title long enough to cross the middle of the slide and keep going to the right edge', layout: 'title' }], { design }), 'text-contrast'));
});

test('opf/text-contrast: pattern backgrounds are measured against both colours; table cell colours are measured against the cell', () => {
	const pattern = { background: { type: 'pattern', pattern: { preset: 'ltDnDiag', foregroundColor: '#222222', backgroundColor: '#FFFFFF' } } };
	assert.ok(has(deck([{ title: 'Pattern', text: [{ text: 'dark', color: '#2A2A2A' }] }], { design: pattern }), 'text-contrast'));
	const table = (color, fill) => deck([{ title: 'T', table: { columns: ['A'], rows: [[{ value: 'x', style: { color, fill } }]] } }], { design: white });
	const bad = only(table('#DDDDDD', '#FFFFFF'), 'text-contrast');
	assert.equal(bad.length, 1);
	assert.equal(bad[0].path, '/slides/0/table/rows/0/0/style/color');
	assert.deepEqual(bad[0].fixes[0].patch[0].path, '/slides/0/table/rows/0/0/style/color');
	assert.ok(!has(table('#000000', '#FFFFFF'), 'text-contrast'));
});

test('opf/text-contrast: ignores charts, images and code, and honours severity, ignore and ignorePaths', () => {
	const slides = [{ title: 'T', text: [{ text: 'faint', color: '#DDDDDD' }] }];
	const d = deck(slides, { design: white });
	assert.equal(validate(d, { severity: { 'text-contrast': 'error' } }).findings.find((x) => x.ruleId === 'opf/text-contrast').severity, 'error');
	assert.ok(!ids(validate(d, { ignore: ['text-contrast'] })).includes('opf/text-contrast'));
	assert.ok(!ids(validate(d, { severity: { 'opf/text-contrast': 'off' } })).includes('opf/text-contrast'));
	assert.ok(!ids(validate(d, { ignorePaths: [{ rule: 'opf/text-contrast', path: '/slides/0' }] })).includes('opf/text-contrast'));
	assert.ok(ids(validate(d, { ignorePaths: [{ rule: 'opf/text-contrast', path: '/slides/1' }] })).includes('opf/text-contrast'));
});

// ------------------------------------------------------------ text-on-image

test('opf/text-on-image: a picture background cannot be measured; a strong full-frame overlay can', () => {
	const slide = (overlay) => ({ title: 'On a picture', design: { background: { type: 'image', src: 'https://example.com/hero.jpg', ...(overlay ? { overlay } : {}) } } });
	const bare = only(deck([slide()], { design: white }), 'text-on-image');
	assert.equal(bare.length, 1);
	assert.equal(bare[0].severity, 'info');
	assert.ok(!has(deck([slide({ color: '#FFFFFF', opacity: 1 })], { design: white }), 'text-on-image'));
	// default text is dark1 on a light deck; an overlay that cannot lighten every pixel enough still fails the ramp
	assert.ok(has(deck([slide({ color: '#FFFFFF', opacity: 0.3 })], { design: white }), 'text-on-image'));
	// a background image on the deck
	assert.ok(has(deck([{ title: 'T', text: 'x' }], { design: { background: { type: 'image', src: 'https://example.com/a.png' } } }), 'text-on-image'));
	// the shorthand is a cover picture too, and an edge band does not certify the whole slide
	assert.ok(has(deck([{ title: 'T', text: 'x' }], { design: { background: 'https://example.com/a.png' } }), 'text-on-image'));
	assert.ok(has(deck([slide({ color: '#FFFFFF', opacity: 1, edge: 'bottom' })], { design: white }), 'text-on-image'));
});

// ------------------------------------------------------------ alt text

test('opf/missing-alt-text: images, video, logos, header images; "" is the decorative opt-out', () => {
	const found = only(
		deck(
			[
				{ title: 'A', image: 'https://example.com/a.png' },
				{ title: 'B', image: { src: 'https://example.com/b.png', alt: 'A bar chart of sales' } },
				{ title: 'C', image: { src: 'https://example.com/c.png', alt: '' } },
				{ title: 'D', blocks: [{ image: { src: 'https://example.com/d.png' } }, { video: { src: 'https://example.com/v.mp4' } }] },
				{ title: 'E', video: { src: 'https://example.com/w.mp4', title: 'Product walkthrough' } },
			],
			{ design: { logo: { src: 'https://example.com/logo.svg' } }, organization: { id: 'acme', name: 'Acme', logo: { src: 'https://example.com/acme.svg', alt: 'Acme' } } },
		),
		'missing-alt-text',
	);
	const paths = new Set(found.map((d) => d.path));
	for (const expected of ['/slides/0/image', '/slides/3/blocks/0/image', '/slides/3/blocks/1/video', '/design/logo']) assert.ok(paths.has(expected), expected);
	for (const unexpected of ['/slides/1/image', '/slides/2/image', '/slides/4/video', '/organization/logo']) assert.ok(!paths.has(unexpected), unexpected);
	const stringImage = found.find((d) => d.path === '/slides/0/image');
	assert.equal(stringImage.fixes[0].kind, 'focus');
	assert.deepEqual(stringImage.fixes[0].focus, { path: '/slides/0/image', field: 'alt', value: 'https://example.com/a.png' });
	assert.deepEqual(stringImage.fixes[1].patch, [{ op: 'replace', path: '/slides/0/image', value: { src: 'https://example.com/a.png', alt: '' } }]);
	assert.equal(stringImage.fixes[1].safe, false);
	const objectImage = found.find((d) => d.path === '/slides/3/blocks/0/image');
	assert.deepEqual(objectImage.fixes[1].patch, [{ op: 'add', path: '/slides/3/blocks/0/image/alt', value: '' }]);
});

test('opf/missing-alt-text: asset registry alt text and placed image blocks count; a background is decorative without alt', () => {
	const registry = { assets: { hero: { src: 'https://example.com/hero.jpg', alt: 'Team at the offsite' }, bare: 'https://example.com/bare.jpg' } };
	assert.ok(!has(deck([{ title: 'A', image: 'asset:hero' }], registry), 'missing-alt-text'));
	assert.ok(has(deck([{ title: 'A', image: 'asset:bare' }], registry), 'missing-alt-text'));
	assert.ok(has(deck([{ title: 'A', blocks: [{ image: 'https://example.com/s.jpg', placement: { edge: 'left' } }, { text: 'x' }] }]), 'missing-alt-text'));
	assert.ok(!has(deck([{ title: 'A', blocks: [{ image: { src: 'https://example.com/s.jpg', alt: 'Sunrise' }, placement: { edge: 'left' } }, { text: 'x' }] }]), 'missing-alt-text'));
	assert.ok(!has(deck([{ title: 'A', text: 'x', design: { background: 'https://example.com/s.jpg' } }]), 'missing-alt-text'));
});

test('opf/poor-alt-text: file names, generic words, URLs, "image of" and very long text', () => {
	const alt = (text) => deck([{ title: 'A', image: { src: 'https://example.com/a.png', alt: text } }]);
	for (const bad of ['IMG_2041.png', 'image', 'Photo', 'https://example.com/a.png', 'Image of a chart', 'x'.repeat(300)]) assert.ok(has(alt(bad), 'poor-alt-text'), bad);
	for (const good of ['Quarterly revenue by region, EMEA leading', '', 'A team photo of five people at a whiteboard']) assert.ok(!has(alt(good), 'poor-alt-text'), good);
});

// ------------------------------------------------------------ titles

test('opf/missing-slide-title and opf/duplicate-slide-title', () => {
	const missing = only(deck([{ title: 'Has one', text: 'x' }, { text: 'No title' }, { title: '   ', text: 'blank' }]), 'missing-slide-title');
	assert.deepEqual(missing.map((d) => d.path), ['/slides/1', '/slides/2']);
	assert.equal(missing[0].fixes[0].focus.field, 'title');
	const dup = only(deck([{ title: 'Results', text: 'a' }, { title: 'Other', text: 'b' }, { title: ' results ', text: 'c' }]), 'duplicate-slide-title');
	assert.equal(dup.length, 1);
	assert.equal(dup[0].path, '/slides/2/title');
	assert.ok(!has(deck([{ title: 'One', text: 'a' }, { title: 'Two', text: 'b' }]), 'duplicate-slide-title'));
});

// ------------------------------------------------------------ reading order

test('opf/reading-order: promoted regions are composed in visual order, blocks in order', () => {
	// composeSlide used to compose region keys alphabetically (center, left, right); it now follows the layout (RR-29)
	assert.ok(!has(deck([{ title: 'T', left: { text: 'L' }, center: { text: 'C' }, right: { text: 'R' } }]), 'reading-order'));
	assert.ok(!has(deck([{ title: 'T', top: { text: 'T' }, middle: { text: 'M' }, bottom: { text: 'B' } }]), 'reading-order'));
	assert.ok(!has(deck([{ title: 'T', 'top:left': { text: 'A' }, 'top:center+right': { text: 'B' }, 'middle+bottom:left': { text: 'C' }, 'middle+bottom:center+right': { text: 'D' } }]), 'reading-order'));
	assert.ok(!has(deck([{ title: 'T', composition: { mode: 'row' }, blocks: [{ text: 'L' }, { text: 'C' }, { text: 'R' }] }]), 'reading-order'));
	assert.ok(!has(deck([{ title: 'T', blocks: [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' }] }]), 'reading-order'));
	assert.ok(!has(deck([{ title: 'T', left: { text: 'L' }, right: { text: 'R' } }]), 'reading-order'));
});

// ------------------------------------------------------------ resolved color roles

test('opf/text-contrast: default text uses the same resolved colors as the preview (the text role applies on light slides only)', () => {
	const scheme = { id: 'cool-horizon', text: '#DDDDDD' };
	const slides = [{ title: 'T', text: ['Body'] }];
	assert.ok(has(deck(slides, { design: { ...white, colorScheme: scheme } }), 'text-contrast'), 'a light text override on a white slide is measured');
	// On a dark slide a text override does not apply: the preview draws light1.
	assert.ok(!has(deck(slides, { design: { background: { type: 'solid', color: '#000000' }, colorScheme: scheme } }), 'text-contrast'));
	// A background ColorRef resolves like the preview: var: references decide the dark slide too.
	const variable = { variables: { night: '#000000' }, design: { background: { type: 'solid', color: 'var:night' } } };
	assert.ok(!has(deck(slides, variable), 'text-contrast'), 'a dark variable background gets light text');
});

// ------------------------------------------------------------ links

test('opf/link-text: generic, blank and raw-URL link text', () => {
	const link = (text, href = 'https://example.com/report') => deck([{ title: 'T', text: ['See ', { text, link: href }] }]);
	for (const bad of ['click here', 'Here', 'Read more', 'https://example.com/a/very/long/path/that/goes/on/and/on/forever']) assert.ok(has(link(bad), 'link-text'), bad);
	assert.ok(has(link('  '), 'link-text'));
	for (const good of ['the 2026 annual report (PDF)', 'Q3 results']) assert.ok(!has(link(good), 'link-text'), good);
	// two adjacent runs of one link read as one phrase
	assert.ok(!has(deck([{ title: 'T', text: [{ text: 'click ', link: 'https://e.com/x' }, { text: 'for the 2026 plan', link: 'https://e.com/x' }] }]), 'link-text'));
	const found = only(link('click here'), 'link-text');
	assert.equal(found[0].path, '/slides/0/text/1');
});

// ------------------------------------------------------------ charts

test('opf/chart-color-only: many series repeat colours; two distinct series are fine; one series is skipped', () => {
	const chart = (type, series) => deck([{ title: 'T', chart: { type, data: { columns: ['Quarter', ...Array.from({ length: series }, (_, i) => `S${i + 1}`)], rows: [['Q1', ...Array.from({ length: series }, (_, i) => i + 1)]] } } }], { design: white });
	assert.ok(has(chart('line', 14), 'chart-color-only'));
	const crowded = only(chart('line', 14), 'chart-color-only');
	assert.match(crowded[0].message, /repeat/);
	assert.ok(!has(chart('line', 1), 'chart-color-only'));
	assert.ok(!has(chart('histogram', 6), 'chart-color-only'));
	// a custom, well separated palette passes; a near-identical palette fails
	assert.ok(!has(chart('line', 2), 'chart-color-only', { chartPalette: ['#000000', '#8A8A8A'] }));
	// orange and sky blue (Okabe-Ito) differ for colour-blind viewers but not in greyscale
	assert.ok(has(chart('line', 3), 'chart-color-only', { chartPalette: ['#000000', '#E69F00', '#56B4E9'] }));
	assert.ok(has(chart('line', 2), 'chart-color-only', { chartPalette: ['#336699', '#346A9A'] }));
	assert.ok(has(chart('line', 2), 'chart-color-only', { chartPalette: ['#000000', '#8A8A8A'], thresholds: { minSeriesColorDifference: 1000 } }));
	const pie = deck([{ title: 'T', chart: { type: 'pie', data: { columns: ['Region', 'Share'], rows: [['A', 1], ['B', 2], ['C', 3]] } } }], { design: white });
	assert.ok(has(pie, 'chart-color-only', { chartPalette: ['#336699', '#336699', '#000000'] }));
});

test('opf/chart-text-alternative: a chart needs words beside it', () => {
	const data = { type: 'column', data: { columns: ['Q', 'V'], rows: [['Q1', 1]] } };
	assert.ok(has(deck([{ title: 'Revenue', chart: data }]), 'chart-text-alternative'));
	assert.ok(!has(deck([{ title: 'Revenue', subtitle: 'Up 12% on last year', chart: data }]), 'chart-text-alternative'));
	assert.ok(!has(deck([{ title: 'Revenue', blocks: [{ chart: data }, { text: 'Revenue rose 12%.' }] }]), 'chart-text-alternative'));
	assert.ok(!has(deck([{ title: 'Revenue', text: 'x' }]), 'chart-text-alternative'));
});

test('opf/chart-text-alternative: chart.alt is the text alternative (FA-09)', () => {
	const data = { type: 'column', data: { columns: ['Q', 'V'], rows: [['Q1', 1]] } };
	const withAlt = (alt) => ({ ...data, alt });
	// alt text alone satisfies the rule
	assert.ok(!has(deck([{ title: 'Revenue', chart: withAlt('Revenue rose 12% to $18M in Q2.') }]), 'chart-text-alternative'));
	// no alt and nothing beside: the finding points at the chart and offers to write alt first
	const [missing] = only(deck([{ title: 'Revenue', chart: data }]), 'chart-text-alternative');
	assert.equal(missing.path, '/slides/0/chart');
	assert.deepEqual(missing.fixes.map((f) => [f.id, f.focus.field, f.focus.path]), [['focus-alt', 'alt', '/slides/0/chart'], ['focus-subtitle', 'text', '/slides/0/subtitle']]);
	// whitespace-only alt counts as missing
	assert.ok(has(deck([{ title: 'Revenue', chart: withAlt('   ') }]), 'chart-text-alternative'));
	// text beside still serves when alt is absent
	assert.ok(!has(deck([{ title: 'Revenue', text: 'x', chart: data }]), 'chart-text-alternative'));
	// empty alt is a reviewed decorative choice, still reported as info, even with text beside
	const [decorative] = only(deck([{ title: 'Revenue', text: 'x', chart: withAlt('') }]), 'chart-text-alternative');
	assert.equal(decorative.severity, 'info');
	assert.equal(decorative.path, '/slides/0/chart/alt');
	assert.match(decorative.message, /decorative/);
	// two charts: the one with alt is clean, the other is reported by number
	const two = only(deck([{ title: 'T', blocks: [{ chart: withAlt('Q1 revenue by region.') }, { chart: data }] }]), 'chart-text-alternative');
	assert.equal(two.length, 1);
	assert.match(two[0].message, /chart 2/);
});

test('opf/poor-alt-text: chart.alt is checked for generic words (FA-09)', () => {
	const chart = (alt) => deck([{ title: 'Revenue', chart: { type: 'column', alt, data: { columns: ['Q', 'V'], rows: [['Q1', 1]] } } }]);
	for (const alt of ['Chart', 'bar chart', 'A line graph', 'Chart of revenue by quarter', 'x'.repeat(300)]) {
		const [finding] = only(chart(alt), 'poor-alt-text');
		assert.ok(finding, alt);
		assert.equal(finding.path, '/slides/0/chart/alt');
	}
	assert.ok(!has(chart('Revenue rose 12% to $18M in Q2.'), 'poor-alt-text'));
	assert.ok(!has(chart(''), 'poor-alt-text'));
});

test('opf/missing-language: only the presentation-level language is checked', () => {
	const found = only({ name: 'x', slides: [{ title: 'T', text: 'x' }] }, 'missing-language');
	assert.equal(found.length, 1);
	assert.equal(found[0].path, '');
	assert.equal(found[0].fixes[0].focus.field, 'language');
	assert.ok(!has(deck([{ title: 'T', text: 'x' }]), 'missing-language'));
});

// ------------------------------------------------------------ layout

test('opf/text-overflow and strict composition', () => {
	const long = 'word '.repeat(600);
	const tight = (extra = {}) => deck([{ title: 'T', composition: { minFontSize: 16, ...extra }, blocks: [{ text: long }, { text: 'b' }] }]);
	const found = only(tight(), 'text-overflow');
	assert.ok(found.length >= 1);
	assert.equal(found[0].severity, 'warning');
	// overflow: "error" fails composition, but valid never depends on font metrics: the finding stays a warning
	const strict = only(tight({ overflow: 'error' }), 'text-overflow');
	assert.ok(strict.length >= 1);
	assert.equal(strict[0].severity, 'warning');
	assert.equal(validate(tight({ overflow: 'error' })).valid, true);
	// a host that wants it to fail promotes the rule
	assert.equal(validate(tight({ overflow: 'error' }), { severity: { 'opf/text-overflow': 'error' } }).valid, false);
	assert.ok(!has(deck([{ title: 'T', text: 'short' }]), 'text-overflow'));
	// a cell below composition's comfort threshold is a taste judgment, so there is no rule for it
	const many = deck([{ title: 'T', composition: { mode: 'row' }, blocks: Array.from({ length: 12 }, (_, i) => ({ text: `Item ${i}` })) }]);
	assert.ok(!validate(many).findings.some((d) => d.ruleId === 'opf/unresolved-content' && /cell/i.test(d.message)));
});

test('opf/text-overflow: a host text measurement replaces the estimate', () => {
	const slide = { title: 'T', blocks: [{ text: 'A reasonably short sentence that fits at the default size.' }, { text: 'b' }] };
	assert.ok(!has(deck([slide]), 'text-overflow'));
	const widths = [];
	const measurement = { measure: (text, size) => (widths.push(text), text.length * size * 3) };
	const report = validate(deck([slide]), { fonts: { textMeasurement: measurement } });
	assert.equal(report.checks.layout, 'measured');
	assert.ok(widths.length > 0, 'the supplied measurement was used');
});

test('opf/layout-failed: a composition error is a finding, and the rest of the rules still run', () => {
	const catalogs = [{ source: 'pkg:@host/layouts', layouts: { broken: { name: 'Broken', placeholders: [{ type: 'title' }], composition: { padding: 5 } } } }];
	const found = only(deck([{ title: 'T', layout: 'broken', text: 'x' }, { title: 'U', text: 'y' }]), 'layout-failed', { catalogs });
	assert.equal(found.length, 1);
	assert.equal(found[0].path, '/slides/0');
	assert.match(found[0].message, /Invalid composition\.padding/);
	assert.ok(!has(deck([{ title: 'T', text: 'x' }]), 'layout-failed'));
	const all = validate(deck([{ title: 'T', layout: 'broken', text: [{ text: 'x', fontSize: 6 }] }]), { catalogs });
	assert.ok(all.findings.some((d) => d.ruleId === 'opf/min-font-size'));
});

test('fonts.textMeasurement may be a function of the slide index', () => {
	const seen = [];
	const measurement = { measure: (text, size) => text.length * size * 0.5 };
	const report = validate(deck([{ title: 'One', text: 'a' }, { title: 'Two', text: 'b' }]), {
		fonts: { textMeasurement: (index) => (seen.push(index), measurement) },
	});
	assert.equal(report.checks.layout, 'measured');
	assert.deepEqual([...new Set(seen)], [0, 1]);
});

test('the root entry point exports the checker, and the old subpaths are gone', async () => {
	const root = await import('../dist/index.js');
	assert.equal(root.validate, validate);
	assert.equal(root.validationRules, validationRules);
	assert.equal(root.findValidationRule, findValidationRule);
	assert.equal(root.DEFAULT_VALIDATION_THRESHOLDS, DEFAULT_VALIDATION_THRESHOLDS);
	const validator = await import('../dist/validator.js');
	assert.equal(validator.validate, validate);
	const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
	assert.equal(manifest.exports['./lint'], undefined);
	assert.equal(manifest.exports['./audit'], undefined);
	assert.ok(manifest.exports['./validator']);
});

test('opf/unresolved-content: composeSlide diagnostics are surfaced', () => {
	assert.ok(has(deck([{ title: 'T', items: ['a', 'b'] }], { design: { listBullet: 'image' } }), 'unresolved-content'));
	assert.ok(!has(deck([{ title: 'T', items: ['a', 'b'] }]), 'unresolved-content'));
});

test('opf/min-font-size: explicit small runs and a lowered composition floor', () => {
	const small = only(deck([{ title: 'T', text: [{ text: 'tiny', fontSize: 8 }, ' ok'] }]), 'min-font-size');
	assert.equal(small.length, 1);
	assert.equal(small[0].path, '/slides/0/text/0/fontSize');
	assert.equal(small[0].fixes[0].focus.field, 'fontSize');
	assert.ok(!has(deck([{ title: 'T', text: [{ text: 'fine', fontSize: 14 }] }]), 'min-font-size'));
	assert.ok(has(deck([{ title: 'T', text: [{ text: 'tiny', fontSize: 11.5 }] }]), 'min-font-size', { thresholds: { minFontSizePt: 14 } }));
	const shrunk = deck([{ title: 'T', composition: { minFontSize: 8 }, blocks: [{ text: 'word '.repeat(500) }, { text: 'b' }] }]);
	assert.ok(has(shrunk, 'min-font-size'));
});

// ------------------------------------------------------------ fonts

test('opf/font-outside-scheme', () => {
	const run = (family) => deck([{ title: 'T', text: [{ text: 'x', fontFamily: family }] }], { design: { fontScheme: 'aptos' } });
	assert.ok(has(run('Comic Sans MS'), 'font-outside-scheme'));
	const found = only(run('Comic Sans MS'), 'font-outside-scheme');
	assert.equal(found[0].path, '/slides/0/text/0/fontFamily');
	assert.deepEqual(found[0].fixes[0].patch, [{ op: 'remove', path: '/slides/0/text/0/fontFamily' }]);
	assert.ok(!has(run('Aptos'), 'font-outside-scheme'));
	assert.ok(!has(run('aptos display'), 'font-outside-scheme'));
});

// ------------------------------------------------------------ images

test('opf/image-resolution: embedded images measured at their displayed size; URLs and SVG are not read', () => {
	const small = png(100, 100),
		big = png(4000, 3000);
	const image = (src, extra = {}) => deck([{ title: 'T', image: { src, alt: 'x' }, ...extra }]);
	const found = only(image(small), 'image-resolution');
	assert.equal(found.length, 1);
	assert.equal(found[0].path, '/slides/0/image');
	assert.ok(found[0].measured.ppi < 96 && found[0].measured.widthPx === 100);
	assert.ok(!has(image(big), 'image-resolution'));
	assert.ok(!has(image('https://example.com/huge.png'), 'image-resolution'));
	assert.ok(!has(image('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'), 'image-resolution'));
	assert.ok(has(deck([{ title: 'T', image: 'asset:s' }], { assets: { s: { src: small, alt: 'x' } } }), 'image-resolution'));
	assert.ok(has(deck([{ title: 'T', blocks: [{ image: { src: small, alt: 'x' }, placement: { edge: 'left' } }, { text: 'x' }] }]), 'image-resolution'));
	assert.ok(has(deck([{ title: 'T', text: 'x' }], { design: { background: { type: 'image', src: small } } }), 'image-resolution'));
	assert.ok(has(deck([{ title: 'T', text: 'x' }], { design: { background: small } }), 'image-resolution'));
	assert.ok(!has(image(small), 'image-resolution', { thresholds: { minImagePpi: 5 } }));
});

// ------------------------------------------------------------ content

test('opf/placeholder-text, opf/empty-text and opf/empty-slide', () => {
	for (const text of ['Lorem ipsum dolor sit amet', 'Click to add title', 'Your title here', '[Insert company name]', 'TBD', 'See TODO list', 'Title', 'Untitled presentation'])
		assert.ok(has(deck([{ title: 'T', text }]), 'placeholder-text'), text);
	for (const text of ['A normal sentence about the title of the book.', 'The todo app ships Monday', 'Subtitle quality improved'])
		assert.ok(!has(deck([{ title: 'T', text }]), 'placeholder-text'), text);
	assert.ok(has(deck([{ title: 'T', items: ['ok', ''] }]), 'empty-text'));
	assert.ok(has(deck([{ title: 'T', subtitle: '  ', text: 'x' }]), 'empty-text'));
	assert.ok(!has(deck([{ title: 'T', text: 'x' }]), 'empty-text'));
	assert.ok(!has(deck([{ title: 'T', table: { columns: ['A', 'B'], rows: [['x', '']] } }]), 'empty-text'));
	assert.equal(only(deck([{ title: 'T', text: 'x' }, { id: 'blank-one' }]), 'empty-slide')[0].path, '/slides/1');
	assert.equal(only(deck([{ title: 'T', text: 'x' }, { id: 'blank-one' }]), 'empty-slide')[0].slideId, 'blank-one');
	assert.ok(!has(deck([{ layout: 'blank' }]), 'empty-slide'));
	assert.ok(!has(deck([{ title: 'Only a title' }]), 'empty-slide'));
	assert.ok(!has(deck([{ design: { background: { type: 'image', src: 'https://e.com/a.jpg' } } }]), 'empty-slide'));
	assert.ok(!has(deck([{ design: { background: 'https://e.com/a.jpg' } }]), 'empty-slide'));
	assert.ok(has(deck([{ title: 'T', text: 'x' }, { design: { background: 'dark1' } }]), 'empty-slide'));
});

test('opf/variable-unfilled: a normal deck errors, a template warns, tokens left in a plain deck warn', () => {
	// A deck that declares no content variables: a token left in the text, or a colour variable nobody declared.
	assert.ok(has(deck([{ title: 'Hello {{name}}', text: 'x' }]), 'variable-unfilled'));
	assert.ok(has(deck([{ title: 'T', text: 'Total: {{ total | #,##0 }}' }]), 'variable-unfilled'));
	assert.equal(only(deck([{ title: 'Hello {{name}}', text: 'x' }]), 'variable-unfilled')[0].severity, 'warning');
	assert.ok(!has(deck([{ title: 'T', text: 'Escaped \\{{name}} stays' }]), 'variable-unfilled'));
	assert.ok(!has(deck([{ title: 'T', text: 'Braces { } are fine, and {{Upper}} is not a token' }]), 'variable-unfilled'));
	const colour = deck([{ title: 'T', text: [{ text: 'x', color: 'var:brand' }] }]);
	assert.ok(has(colour, 'variable-reference-unknown'));
	assert.ok(!has({ ...colour, variables: { brand: '#0F4C81' } }, 'variable-reference-unknown'));
	// A declared required variable with no value: an error in a normal deck, a warning in a template.
	const declared = { ...deck([{ title: 'T', text: 'Hello {{who}}' }]), variables: { who: { type: 'text', label: 'Who' } } };
	const asDeck = validate(declared, { only: ['variable-unfilled'] });
	assert.deepEqual(asDeck.findings.map((d) => [d.path, d.severity, d.category]), [['/variables/who', 'error', 'format']]);
	assert.equal(asDeck.valid, false);
	assert.equal(asDeck.schemaValid, true);
	const asTemplate = validate({ ...declared, template: true }, { only: ['variable-unfilled'] });
	assert.deepEqual(asTemplate.findings.map((d) => [d.path, d.severity]), [['/variables/who', 'warning']]);
	assert.equal(asTemplate.valid, true);
	assert.deepEqual(asTemplate.unfilledVariables, ['who']);
	// Values fill the deck before it is checked.
	assert.deepEqual(validate(declared, { only: ['variable-unfilled'], values: { who: 'Ada' } }).findings, []);
	// It is a format rule: the format check alone, which every write command and hot path runs, rejects an unfilled deck and builds no layout.
	const formatOnly = validate(declared, { only: ['format'] });
	assert.equal(formatOnly.valid, false);
	assert.deepEqual(formatOnly.findings.map((d) => d.ruleId), ['opf/variable-unfilled']);
	assert.equal(formatOnly.checks.layout, 'not-run');
	assert.equal(validate({ ...declared, template: true }, { only: ['format'] }).valid, true);
	assert.equal(validate(declared, { only: ['format'], values: { who: 'Ada' } }).valid, true);
	// assertValid is the format check, so it rejects the unfilled deck as well.
	assert.throws(() => assertValid(declared), /has no value/);
	assert.doesNotThrow(() => assertValid({ ...declared, template: true }));
});

// ------------------------------------------------------------ options and source

test('options: unknown rules, thresholds and options are rejected; only/ignore select rules and categories', () => {
	const d = deck([{ title: 'T', text: 'x' }]);
	assert.throws(() => validate(d, { severity: { 'text-contrats': 'off' } }), /Unknown validation rule or category/);
	assert.throws(() => validate(d, { ignore: ['nope'] }), /Unknown validation rule or category/);
	assert.throws(() => validate(d, { only: ['opf/nope'] }), /Unknown validation rule or category/);
	assert.throws(() => validate(d, { only: 'format' }), /array/);
	assert.throws(() => validate(d, { severity: { 'text-contrast': 'fatal' } }), /severity/);
	assert.throws(() => validate(d, { thresholds: { contrastNormal: -1 } }), /positive number/);
	assert.throws(() => validate(d, { thresholds: { nope: 1 } }), /Unknown validate threshold/);
	assert.throws(() => validate(d, { thresholds: { maxWordsPerSlide: 50 } }), /Unknown validate threshold/);
	assert.throws(() => validate(d, { nope: 1 }), /Unknown validate option/);
	assert.throws(() => validate(d, { rules: {} }), /Unknown validate option/);
	assert.throws(() => validate(d, { textMeasurement: {} }), /Unknown validate option/);
	assert.throws(() => validate(d, { ignorePaths: [{ rule: 'text-contrast', path: 'slides' }] }), /JSON Pointer/);
	assert.throws(() => validate(d, { chartPalette: ['red'] }), /chartPalette/);
	assert.throws(() => validate(d, { fonts: 'roboto' }), /fonts/);
	const report = validate(deck([{ text: 'No title' }], { language: undefined }), { only: ['missing-slide-title'] });
	assert.deepEqual(ids(report), ['opf/missing-slide-title']);
	assert.equal(report.checks.accessibility, 'checked');
	assert.equal(report.checks.layout, 'not-run');
	assert.equal(report.checks.content, 'not-run');
	const without = validate(deck([{ text: 'No title' }], { language: undefined }), { ignore: ['missing-slide-title', 'missing-language'] });
	assert.ok(!ids(without).includes('opf/missing-slide-title'));
	assert.ok(!ids(without).includes('opf/missing-language'));
	// a category name selects all of its rules
	const accessibility = validate(deck([{ text: 'No title' }], { language: undefined }), { only: ['accessibility'] });
	assert.ok(accessibility.findings.length >= 2 && accessibility.findings.every((d) => d.category === 'accessibility'));
	assert.deepEqual(ids(validate(deck([{ text: 'No title' }], { language: undefined }), { ignore: ['accessibility'] })).filter((id) => id === 'opf/missing-slide-title'), []);
});

test('severity overrides promote or demote a rule or a whole category; off silences it', () => {
	const d = deck([{ text: 'No title' }], { language: undefined });
	assert.equal(validate(d, { only: ['missing-slide-title'] }).valid, true, 'an accessibility finding never makes a deck invalid by default');
	const promoted = validate(d, { severity: { 'opf/missing-slide-title': 'error' } });
	assert.equal(promoted.valid, false);
	assert.equal(promoted.findings.find((x) => x.ruleId === 'opf/missing-slide-title').severity, 'error');
	assert.equal(promoted.counts.error, 1);
	const category = validate(d, { severity: { accessibility: 'warning', 'missing-language': 'info' } });
	assert.ok(category.findings.filter((x) => x.category === 'accessibility').every((x) => ['warning', 'info'].includes(x.severity)));
	assert.equal(category.findings.find((x) => x.ruleId === 'opf/missing-language').severity, 'info', 'a rule beats its category');
	assert.ok(!ids(validate(d, { severity: { 'text-contrast': 'off', 'missing-slide-title': 'off' } })).includes('opf/missing-slide-title'));
});

test('ignorePaths suppresses a rule, a category or everything below a pointer, by whole segments', () => {
	const d = deck([{ title: 'One', image: 'https://example.com/a.png' }, { title: 'Two', image: 'https://example.com/b.png' }]);
	assert.deepEqual(only(d, 'missing-alt-text').map((x) => x.path), ['/slides/0/image', '/slides/1/image']);
	assert.deepEqual(only(d, 'missing-alt-text', { ignorePaths: [{ rule: 'opf/missing-alt-text', path: '/slides/0' }] }).map((x) => x.path), ['/slides/1/image']);
	assert.deepEqual(only(d, 'missing-alt-text', { ignorePaths: [{ rule: 'accessibility', path: '/slides/1' }] }).map((x) => x.path), ['/slides/0/image']);
	assert.deepEqual(only(d, 'missing-alt-text', { ignorePaths: [{ rule: '*', path: '' }] }), []);
	assert.equal(only(d, 'missing-alt-text', { ignorePaths: [{ rule: '*', path: '/slides/1' }] }).length, 1);
	// '/slides/1' does not cover '/slides/10'
	const twelve = deck(Array.from({ length: 11 }, (_, i) => ({ title: `S${i}`, image: 'https://example.com/x.png' })));
	assert.ok(only(twelve, 'missing-alt-text', { ignorePaths: [{ rule: '*', path: '/slides/1' }] }).some((x) => x.path === '/slides/10/image'));
});

test('the bundled examples validate without throwing and keep their rule ids stable', () => {
	const sample = JSON.parse(readFileSync(new URL('../../../examples/technical/full-feature-tour.opf.json', import.meta.url), 'utf8'));
	const report = validate(sample);
	assert.equal(report.schemaValid, true);
	for (const d of report.findings) assert.ok(findValidationRule(d.ruleId) || false, d.ruleId);
});
