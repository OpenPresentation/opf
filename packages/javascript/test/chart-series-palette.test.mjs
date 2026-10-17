// RR-89: chart series colours come from the deck's colour scheme (chartSeriesPalette), not a fixed palette.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { ENGINE_DEFAULT_COLOR_SCHEME, chartPaletteForFill, chartSeriesPalette, colorContrast, resolveColorRoles } from '../dist/composition.js';
import * as root from '../dist/index.js';
import { validate } from '../dist/index.js';

const scheme = { accent1: '#7B241C', accent2: '#F5B041', accent3: '#27AE60', accent4: '#8E44AD', accent5: '#F39C12', accent6: '#16A085' };
const tint = (hex) => `#${[1, 3, 5].map((i) => Math.round(Number.parseInt(hex.slice(i, i + 2), 16) * 0.6 + 255 * 0.4).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

describe('chartSeriesPalette', () => {
	test('accent1 to accent6 of the scheme, then their tints in the same order', () => {
		const palette = chartSeriesPalette(scheme);
		assert.equal(palette.length, 12);
		assert.deepEqual(palette.slice(0, 6), Object.values(scheme));
		assert.deepEqual(palette.slice(6), Object.values(scheme).map(tint));
		for (const color of palette) assert.match(color, /^#[0-9A-F]{6}$/);
	});

	test('is a pure function of the scheme and lives on /composition, not the root', () => {
		assert.deepEqual(chartSeriesPalette(scheme), chartSeriesPalette({ ...scheme }));
		assert.equal(root.chartSeriesPalette, undefined);
	});

	test('literal forms are normalised, translucency is dropped, and missing slots take the engine default', () => {
		const palette = chartSeriesPalette({ accent1: '#abc', accent2: '#11223380', accent3: 'not a colour' });
		assert.equal(palette[0], '#AABBCC');
		assert.equal(palette[1], '#112233');
		for (const [index, slot] of ['accent3', 'accent4', 'accent5', 'accent6'].entries()) assert.equal(palette[index + 2], ENGINE_DEFAULT_COLOR_SCHEME[slot].toUpperCase());
		assert.deepEqual(chartSeriesPalette({}), chartSeriesPalette());
		assert.equal(chartSeriesPalette({}).length, 12);
	});

	test('role overrides do not change it: series 1 to 3 stay accent1 to accent3', () => {
		const withRoles = { ...scheme, primary: '#000000', secondary: '#111111', accent: '#222222' };
		assert.deepEqual(chartSeriesPalette(withRoles), chartSeriesPalette(scheme));
		assert.equal(resolveColorRoles(withRoles).primary, '#000000');
	});

	test('different schemes give different palettes, with the cool-horizon blues only for that scheme', () => {
		const other = chartSeriesPalette({ ...scheme, accent1: '#7A3E9D' });
		assert.notDeepEqual(other, chartSeriesPalette(scheme));
		assert.equal(other[0], '#7A3E9D');
		assert.ok(!chartSeriesPalette(scheme).includes('#2874A6'));
	});

	test('chartPaletteForFill keeps the series contrast against a dark panel and apart', () => {
		const adjusted = chartPaletteForFill('#1E293B', chartSeriesPalette(scheme));
		assert.equal(adjusted.length, 12);
		for (const color of adjusted) assert.ok(colorContrast(color, '#1E293B') >= 3, color);
		assert.equal(new Set(adjusted).size, 12);
	});
});

describe('the colour-blind rule follows the deck colour scheme', () => {
	const chart = (colorScheme, series = 2) => ({
		name: 'Palette',
		language: 'en-US',
		design: { background: { type: 'solid', color: '#FFFFFF' }, ...(colorScheme ? { colorScheme } : {}) },
		slides: [{ title: 'T', chart: { type: 'line', data: { columns: ['Quarter', ...Array.from({ length: series }, (_, i) => `S${i + 1}`)], rows: [['Q1', ...Array.from({ length: series }, (_, i) => i + 1)]] } } }],
	});
	const findings = (document, options = {}) => validate(document, { only: ['chart-color-only'], ...options }).findings;

	test('a scheme whose first two accents are near-identical is flagged, the default scheme is not', () => {
		assert.equal(findings(chart(undefined)).length, 0);
		assert.equal(findings(chart({ id: 'twins', ...scheme, accent2: '#7C251D' })).length, 1);
		assert.equal(findings(chart({ id: 'apart', ...scheme })).length, 0);
	});

	test('the inline scheme is judged on its own accents, so the fixed blues no longer decide', () => {
		const twins = { id: 'twins', ...scheme, accent1: '#2874A6', accent2: '#2975A7' };
		assert.equal(findings(chart(twins)).length, 1);
		assert.equal(findings(chart({ id: 'blues', ...scheme, accent1: '#2874A6', accent2: '#F5B041' })).length, 0);
	});

	test('ValidateOptions.chartPalette still replaces the deck palette', () => {
		assert.equal(findings(chart({ id: 'apart', ...scheme }), { chartPalette: ['#336699', '#346A9A'] }).length, 1);
		assert.equal(findings(chart({ id: 'twins', ...scheme, accent2: '#7C251D' }), { chartPalette: ['#000000', '#E8E8E8'] }).length, 0);
	});

	test('DEFAULT_CHART_PALETTE is gone', () => {
		assert.equal(root.DEFAULT_CHART_PALETTE, undefined);
	});
});
