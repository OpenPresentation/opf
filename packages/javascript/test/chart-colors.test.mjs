// RR-89: chart.colors, per-series colours by position, over the deck palette (chartSeriesPalette).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { chartPaletteForFill, chartSeriesPalette, colorContrast, resolveChartColors } from '../dist/composition.js';
import { validate } from '../dist/index.js';

const scheme = { accent1: '#7B241C', accent2: '#F5B041', accent3: '#1B4F72', accent4: '#8E44AD', accent5: '#27AE60', accent6: '#16A085' };
const base = chartSeriesPalette(scheme);

describe('resolveChartColors', () => {
	test('hex, scheme slots and roles, and variables resolve; anything else is undefined', () => {
		const roles = { primary: '#112233' };
		const resolved = resolveChartColors(['#abc', 'accent2', 'primary', 'var:brand', 'var:missing', 'not-a-colour', 7, '#44556688'], scheme, { roles, variables: { brand: { type: 'color', value: '#ABCDEF' } } });
		assert.deepEqual(resolved, ['#AABBCC', '#F5B041', '#112233', '#ABCDEF', undefined, undefined, undefined, '#445566']);
		assert.deepEqual(resolveChartColors(undefined, scheme), []);
		assert.deepEqual(resolveChartColors('accent1', scheme), []);
	});
});

describe('chartSeriesPalette with chart.colors', () => {
	test('entry i replaces palette colour i and the rest keep the deck palette', () => {
		const palette = chartSeriesPalette(scheme, ['accent3', '#ff0000']);
		assert.equal(palette[0], '#1B4F72');
		assert.equal(palette[1], '#FF0000');
		assert.deepEqual(palette.slice(2), base.slice(2));
		assert.equal(palette.length, 12);
	});

	test('an unresolved entry keeps the scheme colour of its position', () => {
		const palette = chartSeriesPalette(scheme, ['var:nope', '#00FF00']);
		assert.equal(palette[0], base[0]);
		assert.equal(palette[1], '#00FF00');
	});

	test('a scheme name follows the scheme, a hex colour does not', () => {
		const other = { ...scheme, accent3: '#5D6D7E' };
		assert.equal(chartSeriesPalette(scheme, ['accent3'])[0], '#1B4F72');
		assert.equal(chartSeriesPalette(other, ['accent3'])[0], '#5D6D7E');
		assert.equal(chartSeriesPalette(other, ['#1B4F72'])[0], '#1B4F72');
	});

	test('entries past the twelfth extend the list', () => {
		const colors = Array.from({ length: 14 }, (_, i) => `#0000${(i + 16).toString(16)}0`.slice(0, 7));
		const palette = chartSeriesPalette(scheme, colors);
		assert.equal(palette.length, 14);
		assert.deepEqual(palette.slice(0, 14), resolveChartColors(colors, scheme));
	});

	test('roles and variables reach the entries through the context', () => {
		assert.equal(chartSeriesPalette(scheme, ['secondary'], { roles: { secondary: '#ABCDEF' } })[0], '#ABCDEF');
	});

	test('without colours the palette is unchanged, and the contrast adjustment applies to authored colours too', () => {
		assert.deepEqual(chartSeriesPalette(scheme, undefined), base);
		const adjusted = chartPaletteForFill('#1E293B', chartSeriesPalette(scheme, ['#1E2A3A']));
		assert.ok(colorContrast(adjusted[0], '#1E293B') >= 3);
	});
});

describe('schema', () => {
	const deck = (colors) => ({ name: 'Colors', language: 'en-US', slides: [{ title: 'T', chart: { type: 'column', data: { columns: ['Q', 'A', 'B'], rows: [['Q1', 1, 2]] }, colors } }] });
	const errors = (colors) => validate(deck(colors), { only: ['format'] }).findings.filter((entry) => entry.severity === 'error');

	test('accepts ColorRefs and rejects the rest', () => {
		assert.deepEqual(errors(['accent1', '#7B241C', 'primary', 'var:brand']), []);
		assert.ok(errors([]).length > 0);
		assert.ok(errors(['red']).length > 0);
		assert.ok(errors('accent1').length > 0);
		assert.ok(errors(Array(25).fill('#000000')).length > 0);
		assert.deepEqual(errors(Array(24).fill('#000000')), []);
	});
});

describe('the accessibility rules read chart.colors', () => {
	const white = { type: 'solid', color: '#FFFFFF' };
	const deck = (colors, extra = {}) => ({
		name: 'Colors',
		language: 'en-US',
		...extra,
		design: { background: white, colorScheme: { id: 'test', ...scheme }, ...(extra.design ?? {}) },
		slides: [{ title: 'T', chart: { type: 'line', data: { columns: ['Q', 'A', 'B'], rows: [['Q1', 1, 2]] }, ...(colors ? { colors } : {}) } }],
	});
	const found = (document, rule) => validate(document, { only: [rule] }).findings;

	test('chart-color-only judges the authored colours', () => {
		assert.equal(found(deck(), 'chart-color-only').length, 0);
		assert.equal(found(deck(['#2874A6', '#2975A7']), 'chart-color-only').length, 1);
		assert.equal(found(deck(['#2874A6', '#F5B041']), 'chart-color-only').length, 0);
	});

	test('chart-colors-adjusted reports an unresolved colour and one under 3:1 on the panel', () => {
		assert.equal(found(deck(), 'chart-colors-adjusted').length, 0);
		assert.equal(found(deck(['accent1', 'accent3']), 'chart-colors-adjusted').length, 0);
		assert.equal(found(deck(['accent2']), 'chart-colors-adjusted').length, 1);
		const low = found(deck(['#7B241C', '#F4F4F4']), 'chart-colors-adjusted');
		assert.equal(low.length, 1);
		assert.equal(low[0].path, '/slides/0/chart/colors/1');
		assert.match(low[0].message, /contrast/);
		const unresolved = found(deck(['var:missing', '#7B241C']), 'chart-colors-adjusted');
		assert.equal(unresolved.length, 1);
		assert.equal(unresolved[0].path, '/slides/0/chart/colors/0');
		assert.match(unresolved[0].message, /cannot be resolved/);
	});

	test('a colour variable the deck defines resolves', () => {
		const document = deck(['var:brand', '#2874A6'], { variables: { brand: { type: 'color', value: '#7B241C' } } });
		assert.equal(found(document, 'chart-colors-adjusted').length, 0);
	});
});
