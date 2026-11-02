// WI-5 (P18, decision D3): a metric value and chart series 1, drawn from the scheme on a dark surface, reach 4.5:1. The palette itself is
// unchanged, light surfaces and explicit colours are untouched.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { CHART_DARK_SERIES_MIN_CONTRAST, METRIC_VALUE_MIN_CONTRAST, chartSchemeSeries, chartPaletteForFill, chartSeriesPalette, colorContrast, metricValueColor } from '../dist/composition.js';

const NAVY = '#011842'; // the default dark background
const BLUE = '#2874A6'; // accent1 of the default scheme

describe('metric value colour', () => {
	test('the default blue on the default navy was 3.42:1 and is now at least 4.5:1', () => {
		assert.ok(Math.abs(colorContrast(BLUE, NAVY) - 3.42) < 0.01, String(colorContrast(BLUE, NAVY)));
		const lifted = metricValueColor(BLUE, NAVY);
		assert.notEqual(lifted, BLUE);
		assert.ok(colorContrast(lifted, NAVY) >= METRIC_VALUE_MIN_CONTRAST, `${lifted} ${colorContrast(lifted, NAVY)}`);
		assert.equal(METRIC_VALUE_MIN_CONTRAST, 4.5);
	});

	test('the lifted colour keeps the hue of the palette colour', () => {
		const hue = (hex) => {
			const [r, g, b] = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
			const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
			return max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
		};
		assert.ok(Math.abs(hue(metricValueColor(BLUE, NAVY)) - hue(BLUE)) < 3);
	});

	test('a colour that already reaches 4.5:1, a light surface and an unreadable input are returned unchanged', () => {
		assert.equal(metricValueColor('#7FB8E6', NAVY), '#7FB8E6');
		assert.equal(metricValueColor(BLUE, '#FFFFFF'), BLUE, 'only a dark surface lifts');
		assert.equal(metricValueColor('var:brand', NAVY), 'var:brand');
		assert.equal(metricValueColor(BLUE, 'not a colour'), BLUE);
	});

	test('it is deterministic', () => {
		assert.equal(metricValueColor(BLUE, NAVY), metricValueColor(BLUE, NAVY));
	});
});

describe('chart series 1', () => {
	const scheme = { accent1: BLUE, accent2: '#C0392B', accent3: '#27AE60', accent4: '#F39C12', accent5: '#8E44AD', accent6: '#16A085' };
	const palette = chartSeriesPalette(scheme);

	test('without the option the palette is the one the engine always drew', () => {
		assert.equal(chartPaletteForFill(NAVY, palette)[0], BLUE);
	});

	test('series 1 reaches 4.5:1 on a dark surface when it comes from the scheme', () => {
		const adjusted = chartPaletteForFill(NAVY, palette, { legible: chartSchemeSeries(undefined, scheme) });
		assert.ok(colorContrast(adjusted[0], NAVY) >= CHART_DARK_SERIES_MIN_CONTRAST, `${adjusted[0]} ${colorContrast(adjusted[0], NAVY)}`);
		assert.equal(adjusted[0], metricValueColor(BLUE, NAVY), 'the same lift as a metric value');
		assert.equal(adjusted.length, palette.length);
	});

	test('the other series keep their separation from series 1', () => {
		const adjusted = chartPaletteForFill(NAVY, palette, { legible: chartSchemeSeries(undefined, scheme) });
		assert.equal(new Set(adjusted).size, adjusted.length);
		for (const color of adjusted) assert.ok(colorContrast(color, NAVY) >= 3, color);
	});

	test('a light surface keeps series 1', () => {
		assert.equal(chartPaletteForFill('#FFFFFF', palette, { legible: chartSchemeSeries(undefined, scheme) })[0], chartPaletteForFill('#FFFFFF', palette)[0]);
	});

	test('an authored chart.colors[0] is explicit and is not lifted', () => {
		assert.equal(chartSchemeSeries(undefined, scheme)[0], true);
		assert.equal(chartSchemeSeries([], scheme)[0], true);
		assert.equal(chartSchemeSeries(['#2874A6'], scheme)[0], false);
		assert.equal(chartSchemeSeries(['accent3'], scheme)[0], false);
		assert.deepEqual(chartSchemeSeries([undefined, '#112233'], scheme).slice(0, 3), [true, false, true], 'entry i is series i + 1');
		const explicit = chartSeriesPalette(scheme, ['#2874A6']);
		assert.equal(chartPaletteForFill(NAVY, explicit, { legible: chartSchemeSeries(['#2874A6'], scheme) })[0], BLUE);
	});
});
