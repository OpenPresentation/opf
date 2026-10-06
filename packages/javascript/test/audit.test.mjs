import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEFAULT_AUDIT_THRESHOLDS, auditPresentation, auditRules, auditSource, findAuditRule } from '../dist/audit.js';
import { lintSource } from '../dist/lint.js';
import { renderRuleReference } from '../../../scripts/build-audit-docs.mjs';

const deck = (slides, extra = {}) => ({ name: 'Audit fixture', language: 'en-US', ...extra, slides });
const ids = (report) => report.diagnostics.map((d) => d.ruleId);
const only = (document, rule, options = {}) => auditPresentation(document, { ...options, only: [rule] }).diagnostics;
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

test('every rule has a stable id, a rationale and an entry in docs/audit.md', () => {
	const doc = readFileSync(new URL('../../../docs/audit.md', import.meta.url), 'utf8');
	assert.ok(auditRules.length >= 25);
	const seen = new Set();
	for (const info of auditRules) {
		assert.match(info.id, /^audit\/[a-z][a-z0-9-]*$/);
		assert.equal(info.id, `audit/${info.name}`);
		assert.ok(!seen.has(info.id), `duplicate ${info.id}`);
		seen.add(info.id);
		assert.ok(info.summary.length > 10 && info.rationale.length > 20, info.id);
		assert.ok(['error', 'warning', 'info'].includes(info.severity));
		assert.ok(['accessibility', 'design', 'content'].includes(info.category));
		assert.ok(doc.includes(`### \`${info.id}\``), `docs/audit.md lacks ${info.id}`);
		assert.equal(findAuditRule(info.name), info);
	}
});

test('docs/audit.md carries the current generated rule reference', () => {
	const doc = readFileSync(new URL('../../../docs/audit.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
	assert.ok(doc.includes(renderRuleReference(auditRules, DEFAULT_AUDIT_THRESHOLDS)), 'run: node scripts/build-audit-docs.mjs');
});

test('a clean deck has no findings and the report states what was and was not measured', () => {
	const report = auditPresentation(
		deck([
			{ title: 'Revenue grew', subtitle: 'Three quarters in a row', text: 'Revenue grew in every quarter of the year.' },
			{ title: 'Next steps', items: ['Hire two engineers', 'Ship the beta'] },
		]),
	);
	assert.deepEqual(report.diagnostics, []);
	assert.equal(report.valid, true);
	assert.equal(report.documentValid, true);
	assert.equal(report.slideCount, 2);
	assert.equal(report.checks.textMeasurement, 'estimated');
	assert.equal(report.checks.backgroundPixels, 'not-read');
	assert.equal(report.checks.imageBytes, 'embedded-only');
	assert.equal(report.checks.nativeExport, 'not-checked');
	assert.deepEqual(report.thresholds, DEFAULT_AUDIT_THRESHOLDS);
	assert.ok(report.rulesRun.includes('audit/text-contrast'));
});

test('findings have lint\'s shape, are deterministic and never mutate the input', () => {
	const input = freeze(deck([{ text: [{ text: 'faint', color: '#CCCCCC' }] }], { language: undefined, design: white }));
	const a = auditPresentation(input),
		b = auditPresentation(input);
	assert.deepEqual(a, b);
	assert.ok(a.diagnostics.length >= 2);
	for (const d of a.diagnostics) {
		assert.match(d.ruleId, /^audit\//);
		assert.ok(['error', 'warning', 'info'].includes(d.severity));
		assert.equal(d.scope, 'document');
		assert.equal(typeof d.path, 'string');
		assert.ok(d.message && d.help);
		assert.match(d.definition, /docs\/audit\.md#audit/);
	}
	assert.equal(a.counts.warning + a.counts.info + a.counts.error, a.diagnostics.length);
});

test('audit/invalid-document: a document that fails the schema is reported, not audited', () => {
	const report = auditPresentation({ name: 'bad', slides: [{ title: 5 }] });
	assert.equal(report.documentValid, false);
	assert.equal(report.valid, false);
	assert.deepEqual([...new Set(ids(report))], ['audit/invalid-document']);
	assert.deepEqual(report.rulesRun, []);
	assert.equal(auditPresentation(undefined).documentValid, false);
});

// ------------------------------------------------------------ text-contrast

test('audit/text-contrast: explicit light text on a white background', () => {
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

test('audit/text-contrast: large text needs 3:1, normal text 4.5:1', () => {
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

test('audit/text-contrast: a dark gradient behind default text, and a gradient that is fine', () => {
	const gradient = (a, b) => ({ background: { type: 'gradient', gradient: { angle: 0, stops: [{ color: a, position: 0 }, { color: b, position: 1 }] } } });
	const bad = only(deck([{ title: 'Gradient', text: 'Body' }], { design: gradient('#000000', '#10103A') }), 'text-contrast');
	assert.equal(bad.length, 1);
	assert.match(bad[0].message, /more text element/);
	assert.equal(bad[0].measured.alsoAffected, 1);
	assert.ok(!has(deck([{ title: 'Gradient', text: 'Body' }], { design: gradient('#FFFFFF', '#F0F0FF') }), 'text-contrast'));
});

test('audit/text-contrast: only the part of a gradient under the text counts', () => {
	// light on the left, black on the right: the left-aligned title never reaches the dark half
	const design = { background: { type: 'gradient', gradient: { angle: 0, stops: [{ color: '#FFFFFF', position: 0 }, { color: '#FFFFFF', position: 0.5 }, { color: '#000000', position: 1 }] } } };
	const found = only(deck([{ title: 'Short', layout: 'title' }], { design }), 'text-contrast');
	assert.equal(found.length, 0);
	// ...but text that spans the dark half does fail
	assert.ok(has(deck([{ title: 'A title long enough to cross the middle of the slide and keep going to the right edge', layout: 'title' }], { design }), 'text-contrast'));
});

test('audit/text-contrast: pattern backgrounds are measured against both colours; table cell colours are measured against the cell', () => {
	const pattern = { background: { type: 'pattern', pattern: { preset: 'ltDnDiag', foregroundColor: '#222222', backgroundColor: '#FFFFFF' } } };
	assert.ok(has(deck([{ title: 'Pattern', text: [{ text: 'dark', color: '#2A2A2A' }] }], { design: pattern }), 'text-contrast'));
	const table = (color, fill) => deck([{ title: 'T', table: { columns: ['A'], rows: [[{ value: 'x', style: { color, fill } }]] } }], { design: white });
	const bad = only(table('#DDDDDD', '#FFFFFF'), 'text-contrast');
	assert.equal(bad.length, 1);
	assert.equal(bad[0].path, '/slides/0/table/rows/0/0/style/color');
	assert.deepEqual(bad[0].fixes[0].patch[0].path, '/slides/0/table/rows/0/0/style/color');
	assert.ok(!has(table('#000000', '#FFFFFF'), 'text-contrast'));
});

test('audit/text-contrast: ignores charts, images and code, and honours severity, ignore and ignorePaths', () => {
	const slides = [{ title: 'T', text: [{ text: 'faint', color: '#DDDDDD' }] }];
	const d = deck(slides, { design: white });
	assert.equal(auditPresentation(d, { rules: { 'text-contrast': 'error' } }).diagnostics.find((x) => x.ruleId === 'audit/text-contrast').severity, 'error');
	assert.ok(!ids(auditPresentation(d, { ignore: ['text-contrast'] })).includes('audit/text-contrast'));
	assert.ok(!ids(auditPresentation(d, { rules: { 'audit/text-contrast': 'off' } })).includes('audit/text-contrast'));
	assert.ok(!ids(auditPresentation(d, { ignorePaths: [{ rule: 'audit/text-contrast', path: '/slides/0' }] })).includes('audit/text-contrast'));
	assert.ok(ids(auditPresentation(d, { ignorePaths: [{ rule: 'audit/text-contrast', path: '/slides/1' }] })).includes('audit/text-contrast'));
});

// ------------------------------------------------------------ text-on-image

test('audit/text-on-image: a picture background cannot be measured; a strong full-frame overlay can', () => {
	const slide = (overlay) => ({ title: 'On a picture', design: { slideImage: { src: 'https://example.com/hero.jpg', alt: '', position: 'background', ...(overlay ? { overlay } : {}) } } });
	const bare = only(deck([slide()], { design: white }), 'text-on-image');
	assert.equal(bare.length, 1);
	assert.equal(bare[0].severity, 'info');
	assert.ok(!has(deck([slide({ color: '#FFFFFF', opacity: 1 })], { design: white }), 'text-on-image'));
	// default text is dark1 on a light deck; an overlay that cannot lighten every pixel enough still fails the ramp
	assert.ok(has(deck([slide({ color: '#FFFFFF', opacity: 0.3 })], { design: white }), 'text-on-image'));
	// a background image on the deck
	assert.ok(has(deck([{ title: 'T', text: 'x' }], { design: { background: { type: 'image', image: { src: 'https://example.com/a.png' } } } }), 'text-on-image'));
});

// ------------------------------------------------------------ alt text

test('audit/missing-alt-text: images, video, logos, header images; "" is the decorative opt-out', () => {
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

test('audit/missing-alt-text: asset registry alt text and the slide image count', () => {
	const registry = { assets: { hero: { src: 'https://example.com/hero.jpg', alt: 'Team at the offsite' }, bare: 'https://example.com/bare.jpg' } };
	assert.ok(!has(deck([{ title: 'A', image: 'asset:hero' }], registry), 'missing-alt-text'));
	assert.ok(has(deck([{ title: 'A', image: 'asset:bare' }], registry), 'missing-alt-text'));
	assert.ok(has(deck([{ title: 'A', text: 'x', design: { slideImage: { src: 'https://example.com/s.jpg', position: 'left' } } }]), 'missing-alt-text'));
	assert.ok(!has(deck([{ title: 'A', text: 'x', design: { slideImage: { src: 'https://example.com/s.jpg', position: 'left', alt: 'Sunrise' } } }]), 'missing-alt-text'));
});

test('audit/poor-alt-text: file names, generic words, URLs, "image of" and very long text', () => {
	const alt = (text) => deck([{ title: 'A', image: { src: 'https://example.com/a.png', alt: text } }]);
	for (const bad of ['IMG_2041.png', 'image', 'Photo', 'https://example.com/a.png', 'Image of a chart', 'x'.repeat(300)]) assert.ok(has(alt(bad), 'poor-alt-text'), bad);
	for (const good of ['Quarterly revenue by region, EMEA leading', '', 'A team photo of five people at a whiteboard']) assert.ok(!has(alt(good), 'poor-alt-text'), good);
});

// ------------------------------------------------------------ titles

test('audit/missing-slide-title and audit/duplicate-slide-title', () => {
	const missing = only(deck([{ title: 'Has one', text: 'x' }, { text: 'No title' }, { title: '   ', text: 'blank' }]), 'missing-slide-title');
	assert.deepEqual(missing.map((d) => d.path), ['/slides/1', '/slides/2']);
	assert.equal(missing[0].fixes[0].focus.field, 'title');
	const dup = only(deck([{ title: 'Results', text: 'a' }, { title: 'Other', text: 'b' }, { title: ' results ', text: 'c' }]), 'duplicate-slide-title');
	assert.equal(dup.length, 1);
	assert.equal(dup[0].path, '/slides/2/title');
	assert.ok(!has(deck([{ title: 'One', text: 'a' }, { title: 'Two', text: 'b' }]), 'duplicate-slide-title'));
});

// ------------------------------------------------------------ reading order

test('audit/reading-order: promoted regions are composed in visual order, blocks in order', () => {
	// composeSlide used to compose region keys alphabetically (center, left, right); it now follows the layout (RR-29)
	assert.ok(!has(deck([{ title: 'T', left: { text: 'L' }, center: { text: 'C' }, right: { text: 'R' } }]), 'reading-order'));
	assert.ok(!has(deck([{ title: 'T', top: { text: 'T' }, middle: { text: 'M' }, bottom: { text: 'B' } }]), 'reading-order'));
	assert.ok(!has(deck([{ title: 'T', 'top:left': { text: 'A' }, 'top:center+right': { text: 'B' }, 'middle+bottom:left': { text: 'C' }, 'middle+bottom:center+right': { text: 'D' } }]), 'reading-order'));
	assert.ok(!has(deck([{ title: 'T', composition: { mode: 'row' }, blocks: [{ text: 'L' }, { text: 'C' }, { text: 'R' }] }]), 'reading-order'));
	assert.ok(!has(deck([{ title: 'T', blocks: [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' }] }]), 'reading-order'));
	assert.ok(!has(deck([{ title: 'T', left: { text: 'L' }, right: { text: 'R' } }]), 'reading-order'));
});

// ------------------------------------------------------------ resolved color roles

test('audit/text-contrast: default text uses the same resolved colors as the preview (the text role applies on light slides only)', () => {
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

test('audit/link-text: generic, blank and raw-URL link text', () => {
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

test('audit/chart-color-only: many series repeat colours; two distinct series are fine; one series is skipped', () => {
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

test('audit/chart-text-alternative: a chart needs words beside it', () => {
	const data = { type: 'column', data: { columns: ['Q', 'V'], rows: [['Q1', 1]] } };
	assert.ok(has(deck([{ title: 'Revenue', chart: data }]), 'chart-text-alternative'));
	assert.ok(!has(deck([{ title: 'Revenue', subtitle: 'Up 12% on last year', chart: data }]), 'chart-text-alternative'));
	assert.ok(!has(deck([{ title: 'Revenue', blocks: [{ chart: data }, { text: 'Revenue rose 12%.' }] }]), 'chart-text-alternative'));
	assert.ok(!has(deck([{ title: 'Revenue', text: 'x' }]), 'chart-text-alternative'));
});

test('audit/missing-language: only the presentation-level language is checked', () => {
	const found = only({ name: 'x', slides: [{ title: 'T', text: 'x' }] }, 'missing-language');
	assert.equal(found.length, 1);
	assert.equal(found[0].path, '');
	assert.equal(found[0].fixes[0].focus.field, 'language');
	assert.ok(!has(deck([{ title: 'T', text: 'x' }]), 'missing-language'));
});

// ------------------------------------------------------------ layout

test('audit/text-overflow, audit/small-cell and strict composition', () => {
	const long = 'word '.repeat(600);
	const tight = (extra = {}) => deck([{ title: 'T', composition: { minFontSize: 16, ...extra }, blocks: [{ text: long }, { text: 'b' }] }]);
	const found = only(tight(), 'text-overflow');
	assert.ok(found.length >= 1);
	assert.equal(found[0].severity, 'warning');
	// overflow: "error" is the author's own severity
	const strict = only(tight({ overflow: 'error' }), 'text-overflow');
	assert.ok(strict.length >= 1);
	assert.equal(strict[0].severity, 'error');
	assert.equal(auditPresentation(tight({ overflow: 'error' })).valid, false);
	assert.ok(!has(deck([{ title: 'T', text: 'short' }]), 'text-overflow'));
	const many = deck([{ title: 'T', composition: { mode: 'row' }, blocks: Array.from({ length: 12 }, (_, i) => ({ text: `Item ${i}` })) }]);
	assert.ok(has(many, 'small-cell'));
	assert.ok(!has(deck([{ title: 'T', blocks: [{ text: 'a' }, { text: 'b' }] }]), 'small-cell'));
});

test('audit/text-overflow: a host text measurement replaces the estimate', () => {
	const slide = { title: 'T', blocks: [{ text: 'A reasonably short sentence that fits at the default size.' }, { text: 'b' }] };
	assert.ok(!has(deck([slide]), 'text-overflow'));
	const widths = [];
	const measurement = { measure: (text, size) => (widths.push(text), text.length * size * 3) };
	const report = auditPresentation(deck([slide]), { textMeasurement: measurement });
	assert.equal(report.checks.textMeasurement, 'provided');
	assert.ok(widths.length > 0, 'the supplied measurement was used');
});

test('audit/layout-failed: a composition error is a finding, and the rest of the audit still runs', () => {
	const catalogs = { layouts: [{ id: 'broken', name: 'Broken', placeholders: [{ type: 'title' }], composition: { padding: 5 } }] };
	const found = only(deck([{ title: 'T', layout: 'broken', text: 'x' }, { title: 'U', text: 'y' }]), 'layout-failed', { catalogs });
	assert.equal(found.length, 1);
	assert.equal(found[0].path, '/slides/0');
	assert.match(found[0].message, /Invalid composition\.padding/);
	assert.ok(!has(deck([{ title: 'T', text: 'x' }]), 'layout-failed'));
	const all = auditPresentation(deck([{ title: 'T', layout: 'broken', text: [{ text: 'x', fontSize: 6 }] }]), { catalogs });
	assert.ok(all.diagnostics.some((d) => d.ruleId === 'audit/min-font-size'));
});

test('textMeasurement may be a function of the slide index', () => {
	const seen = [];
	const measurement = { measure: (text, size) => text.length * size * 0.5 };
	const report = auditPresentation(deck([{ title: 'One', text: 'a' }, { title: 'Two', text: 'b' }]), {
		textMeasurement: (index) => (seen.push(index), measurement),
	});
	assert.equal(report.checks.textMeasurement, 'provided');
	assert.deepEqual([...new Set(seen)], [0, 1]);
});

test('the root entry point re-exports the audit API', async () => {
	const root = await import('../dist/index.js');
	assert.equal(root.auditPresentation, auditPresentation);
	assert.equal(root.auditSource, auditSource);
	assert.equal(root.auditRules, auditRules);
});

test('audit/unresolved-content: composeSlide diagnostics are surfaced', () => {
	assert.ok(has(deck([{ title: 'T', items: ['a', 'b'] }], { design: { listBullet: 'image' } }), 'unresolved-content'));
	assert.ok(!has(deck([{ title: 'T', items: ['a', 'b'] }]), 'unresolved-content'));
});

test('audit/min-font-size: explicit small runs and a lowered composition floor', () => {
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

test('audit/font-outside-scheme and audit/font-family-count', () => {
	const run = (family) => deck([{ title: 'T', text: [{ text: 'x', fontFamily: family }] }], { design: { fontScheme: 'aptos' } });
	assert.ok(has(run('Comic Sans MS'), 'font-outside-scheme'));
	const found = only(run('Comic Sans MS'), 'font-outside-scheme');
	assert.equal(found[0].path, '/slides/0/text/0/fontFamily');
	assert.deepEqual(found[0].fixes[0].patch, [{ op: 'remove', path: '/slides/0/text/0/fontFamily' }]);
	assert.ok(!has(run('Aptos'), 'font-outside-scheme'));
	assert.ok(!has(run('aptos display'), 'font-outside-scheme'));
	const many = deck([{ title: 'T', text: [{ text: 'a', fontFamily: 'Georgia' }, { text: 'b', fontFamily: 'Impact' }, { text: 'c', fontFamily: 'Verdana' }] }]);
	assert.ok(has(many, 'font-family-count'));
	assert.ok(!has(many, 'font-family-count', { thresholds: { maxFontFamilies: 6 } }));
	assert.ok(!has(deck([{ title: 'T', text: 'x' }]), 'font-family-count'));
});

// ------------------------------------------------------------ consistency

test('audit/title-position: same-layout slides that move the title; covers and different layouts are skipped', () => {
	const slide = (padding, layout = 'text-1x') => ({ title: `Slide ${padding}`, layout, composition: { padding }, text: 'Body' });
	const found = only(deck([slide(0.08), slide(0.08), slide(0.2)]), 'title-position');
	assert.equal(found.length, 1);
	assert.equal(found[0].path, '/slides/2/title');
	assert.ok(!has(deck([slide(0.08), slide(0.08), slide(0.08)]), 'title-position'));
	assert.ok(!has(deck([slide(0.08, 'text-1x'), slide(0.2, 'text-2x')]), 'title-position'));
	assert.ok(!has(deck([{ title: 'Cover A', layout: 'title' }, { title: 'Cover B', layout: 'title', subtitle: 'with a subtitle' }]), 'title-position'));
	assert.ok(!has(deck([slide(0.08), slide(0.2)]), 'title-position', { thresholds: { titlePositionTolerance: 0.5 } }));
});

test('audit/slide-word-count: counts words, and CJK text by word', () => {
	const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
	assert.ok(has(deck([{ title: 'T', text: words(150) }]), 'slide-word-count'));
	assert.ok(!has(deck([{ title: 'T', text: words(60) }]), 'slide-word-count'));
	assert.ok(has(deck([{ title: 'T', text: words(60) }]), 'slide-word-count', { thresholds: { maxWordsPerSlide: 50 } }));
	// title, list entries, tables and quotes count; code does not
	const spread = { title: 'T', blocks: [{ items: [words(40)] }, { quote: { text: words(40) } }, { table: { columns: ['A'], rows: [[words(40)]] } }, { code: { source: words(500) } }] };
	const found = only(deck([spread]), 'slide-word-count');
	assert.equal(found.length, 1);
	assert.equal(found[0].measured.words, 122);
});

// ------------------------------------------------------------ images

test('audit/image-resolution: embedded images measured at their displayed size; URLs and SVG are not read', () => {
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
	assert.ok(has(deck([{ title: 'T', text: 'x', design: { slideImage: { src: small, alt: 'x', position: 'left' } } }]), 'image-resolution'));
	assert.ok(has(deck([{ title: 'T', text: 'x' }], { design: { background: { type: 'image', image: { src: small } } } }), 'image-resolution'));
	assert.ok(!has(image(small), 'image-resolution', { thresholds: { minImagePpi: 5 } }));
});

// ------------------------------------------------------------ content

test('audit/placeholder-text, audit/empty-text and audit/empty-slide', () => {
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
	assert.ok(!has(deck([{ design: { slideImage: { src: 'https://e.com/a.jpg', alt: '', position: 'background' } } }]), 'empty-slide'));
});

test('audit/unfilled-variable: tokens, undeclared colour variables and unset declarations', () => {
	assert.ok(has(deck([{ title: 'Hello {{name}}', text: 'x' }]), 'unfilled-variable'));
	assert.ok(has(deck([{ title: 'T', text: 'Total: {{ total | #,##0 }}' }]), 'unfilled-variable'));
	assert.ok(!has(deck([{ title: 'T', text: 'Escaped \\{{name}} stays' }]), 'unfilled-variable'));
	assert.ok(!has(deck([{ title: 'T', text: 'Braces { } are fine, and {{Upper}} is not a token' }]), 'unfilled-variable'));
	const colour = deck([{ title: 'T', text: [{ text: 'x', color: 'var:brand' }] }]);
	assert.ok(has(colour, 'unfilled-variable'));
	assert.ok(!has({ ...colour, variables: { brand: '#0F4C81' } }, 'unfilled-variable'));
	// Content-variable declarations (RR-32) are only audited once the schema of this checkout accepts them.
	const declared = auditPresentation({ ...deck([{ title: 'T', text: 'x' }]), variables: { who: { type: 'text', label: 'Who' } } }, { only: ['unfilled-variable'] });
	if (declared.documentValid) assert.deepEqual(declared.diagnostics.map((d) => d.path), ['/variables/who']);
});

// ------------------------------------------------------------ options and source

test('options: unknown rules, thresholds and options are rejected; only/ignore select rules', () => {
	const d = deck([{ title: 'T', text: 'x' }]);
	assert.throws(() => auditPresentation(d, { rules: { 'text-contrats': 'off' } }), /Unknown audit rule/);
	assert.throws(() => auditPresentation(d, { ignore: ['nope'] }), /Unknown audit rule/);
	assert.throws(() => auditPresentation(d, { only: ['audit/nope'] }), /Unknown audit rule/);
	assert.throws(() => auditPresentation(d, { rules: { 'text-contrast': 'fatal' } }), /severity/);
	assert.throws(() => auditPresentation(d, { thresholds: { contrastNormal: -1 } }), /positive number/);
	assert.throws(() => auditPresentation(d, { thresholds: { nope: 1 } }), /Unknown audit threshold/);
	assert.throws(() => auditPresentation(d, { nope: 1 }), /Unknown audit option/);
	assert.throws(() => auditPresentation(d, { ignorePaths: [{ rule: 'text-contrast', path: 'slides' }] }), /JSON Pointer/);
	assert.throws(() => auditPresentation(d, { chartPalette: ['red'] }), /chartPalette/);
	const report = auditPresentation(deck([{ text: 'No title' }], { language: undefined }), { only: ['missing-slide-title'] });
	assert.deepEqual(report.rulesRun, ['audit/missing-slide-title']);
	assert.deepEqual(ids(report), ['audit/missing-slide-title']);
	const without = auditPresentation(deck([{ text: 'No title' }], { language: undefined }), { ignore: ['missing-slide-title', 'missing-language'] });
	assert.ok(!ids(without).includes('audit/missing-slide-title'));
	assert.ok(!without.rulesRun.includes('audit/missing-slide-title'));
});

test('auditSource: findings carry source ranges; syntax and schema errors stop the audit', () => {
	const source = `{\n  "name": "x",\n  "language": "en-US",\n  "slides": [\n    {"title": "T", "image": "https://example.com/a.png"}\n  ]\n}\n`;
	const report = auditSource(source, { only: ['missing-alt-text'] });
	assert.equal(report.diagnostics.length, 1);
	const { location } = report.diagnostics[0];
	assert.equal(location.line, 5);
	assert.equal(source.slice(location.offset, location.offset + location.length), '"https://example.com/a.png"');
	// a finding about a missing field is located at the object that lacks it
	const missing = auditSource(`{"name":"x","language":"en","slides":[{"text":"no title"}]}`, { only: ['missing-slide-title'] });
	assert.equal(missing.diagnostics[0].location.line, 1);
	assert.ok(missing.diagnostics[0].location.length > 5);
	const broken = auditSource('{"slides": [}');
	assert.equal(broken.documentValid, false);
	assert.equal(broken.valid, false);
	assert.equal(broken.diagnostics[0].ruleId, 'audit/invalid-document');
	assert.ok(broken.diagnostics[0].location);
	const invalid = auditSource('{"name":"x","slides":[{"title":3}]}');
	assert.equal(invalid.documentValid, false);
	assert.equal(lintSource('{"name":"x","slides":[{"title":3}]}').valid, false);
	assert.ok(auditSource('﻿' + source).diagnostics.every((d) => d.location));
});

test('the bundled examples audit without throwing and keep their rule ids stable', () => {
	const sample = JSON.parse(readFileSync(new URL('../../../examples/technical/full-feature-tour.opf.json', import.meta.url), 'utf8'));
	const report = auditPresentation(sample);
	assert.equal(report.documentValid, true);
	for (const d of report.diagnostics) assert.ok(findAuditRule(d.ruleId) || d.ruleId === 'audit/invalid-document', d.ruleId);
});
