// RR-89: the tints of chartSeriesPalette (series 7 to 12) must not pull series 1 to 6 together on dark panels.
// The first three cases are opf-render's RR-29 gate (test/chart-colors.mjs), proved here in core.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { CHART_SERIES_TIER_SIZE, ENGINE_DEFAULT_COLOR_SCHEME, chartPaletteForFill, chartSeriesPalette, colorContrast } from '../dist/composition.js';

const lightness = (hex) => {
	const c = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	const y = 0.2126729 * c[0] + 0.7151522 * c[1] + 0.072175 * c[2];
	return 116 * (y > 216 / 24389 ? Math.cbrt(y) : ((24389 / 27) * y + 16) / 116) - 16;
};
const palette = chartSeriesPalette(ENGINE_DEFAULT_COLOR_SCHEME);
const surfaces = ['#334155', '#1B1B1B', '#011842', '#0F172A', '#000000', '#F8FAFC', '#FFFFFF'];

describe('default scheme series on dark panels (the renderer RR-29 gate)', () => {
	for (const surface of ['#334155', '#1B1B1B', '#011842']) {
		test(`three distinct series colours at least 9 lightness points apart on ${surface}`, () => {
			const fills = chartPaletteForFill(surface, palette).slice(0, 3);
			assert.equal(new Set(fills).size, 3, `distinct series colours: ${fills}`);
			for (const [a, b] of [[0, 1], [1, 2]]) assert.ok(Math.abs(lightness(fills[a]) - lightness(fills[b])) >= 9, `${surface}: series ${a + 1} and ${b + 1} are ${fills[a]} and ${fills[b]}`);
			for (const color of fills) assert.ok(colorContrast(color, surface) >= 3, `${color} on ${surface}`);
		});
	}
});

describe('tiers', () => {
	test('the first six series are placed as if the tints were not there', () => {
		assert.equal(CHART_SERIES_TIER_SIZE, 6);
		for (const surface of surfaces) assert.deepEqual(chartPaletteForFill(surface, palette).slice(0, 6), chartPaletteForFill(surface, palette.slice(0, 6)), surface);
	});

	test('all twelve colours keep 3:1 against the panel and stay distinct', () => {
		for (const surface of surfaces) {
			const adjusted = chartPaletteForFill(surface, palette);
			assert.equal(adjusted.length, 12);
			assert.equal(new Set(adjusted).size, 12, surface);
			for (const color of adjusted) assert.ok(colorContrast(color, surface) >= 3, `${color} on ${surface}`);
		}
	});

	test('a palette of six colours or fewer is one tier and is unchanged by the tier rule', () => {
		const six = ['#2874A6', '#1B4F72', '#5499C7', '#7BDBB2', '#3AC67A', '#24A89E'];
		assert.deepEqual(chartPaletteForFill('#1B1B1B', six), ['#2874A6', '#89B4DC', '#5499C7', '#7BDBB2', '#3AC67A', '#24A89E']);
	});
});
