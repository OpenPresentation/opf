// LH-54, LH-55 and LH-79: the surfaces of a dark deck. A card on a dark slide whose scheme surface is the background itself is a filled
// surface, chart series from the scheme reach 4.5:1 on a dark plot with series 2 a lightness step from series 1, and the code panel takes
// the brand dark on a light deck and a step below the slide on a dark one.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
	CARD_BORDER_MIX, CARD_SURFACE_MIN_CONTRAST, CHART_DARK_SERIES_MIN_CONTRAST, CHART_LEAD_LIGHTNESS_STEP, CODE_PANEL_DARK_SHADE,
	ENGINE_DEFAULT_COLOR_SCHEME, chartPaletteForFill, chartSchemeSeries, chartSeriesPalette, codeSyntaxPaletteForRoles, colorContrast, resolveColorRoles,
} from '../dist/composition.js';
import { validate } from '../dist/index.js';

const SCHEME = ENGINE_DEFAULT_COLOR_SCHEME; // dark1 #000000, dark2 #011842 (the default background), light1 #FFFFFF
const NAVY = SCHEME.dark2;
const lightness = (hex) => {
	const linear = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	const y = 0.2126729 * linear[0] + 0.7151522 * linear[1] + 0.072175 * linear[2];
	return 116 * (y > 216 / 24389 ? Math.cbrt(y) : ((24389 / 27) * y + 16) / 116) - 16;
};
const mix = (from, to, amount) => `#${[1, 3, 5].map((at) => Math.round(Number.parseInt(from.slice(at, at + 2), 16) * (1 - amount) + Number.parseInt(to.slice(at, at + 2), 16) * amount).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

describe('LH-54 cards on a dark slide', () => {
	test('the dark2 variant, whose surface is the background, gets a filled card about 1.25:1 off the slide', () => {
		const roles = resolveColorRoles(SCHEME, { variant: 'dark2' });
		assert.equal(roles.surface, NAVY, 'the scheme surface is the background itself');
		const { card, cardBorder } = roles.neutrals;
		const contrast = colorContrast(card.hex, NAVY);
		assert.ok(contrast >= CARD_SURFACE_MIN_CONTRAST && contrast < 1.3, `${card.hex} ${contrast}`);
		assert.ok(lightness(card.hex) > lightness(NAVY), 'lighter than the slide, towards light1');
		assert.equal(card.lumMod, undefined, 'a mixed card is a literal colour');
		assert.equal(cardBorder.hex, mix(card.hex, SCHEME.light1, CARD_BORDER_MIX), 'the stroke is the card 12% towards light1');
		assert.ok(colorContrast(roles.text, card.hex) >= 4.5, 'text keeps 4.5:1 on the card');
	});

	test('a surface that stands off the slide, an authored surface and a light slide keep the surface and the border', () => {
		const dark1 = resolveColorRoles(SCHEME, { variant: 'dark1' });
		assert.equal(dark1.neutrals.card.hex, dark1.surface, 'dark2 on black already reads as a card');
		assert.equal(dark1.neutrals.cardBorder.hex, dark1.border);
		const authored = resolveColorRoles({ ...SCHEME, surface: NAVY }, { variant: 'dark2' });
		assert.equal(authored.neutrals.card.hex, NAVY, 'the author chose the surface');
		const light = resolveColorRoles(SCHEME, { variant: 'light1' });
		assert.equal(light.neutrals.card.hex, light.surface);
		assert.deepEqual(light.neutrals.cardBorder, light.neutrals.border);
	});

	test('the preview and the validator read the card: a run colour that passes on the slide but not on the card is reported', () => {
		const color = '#5F7396';
		assert.ok(colorContrast(color, NAVY) >= 3, 'readable on the bare slide');
		const deck = { design: { contentBox: true }, slides: [{ title: 'Cards', blocks: [{ text: [{ text: 'Muted note', color }] }, { text: 'Plain' }] }] };
		const findings = validate(deck, { only: ['text-contrast'] }).findings;
		const card = resolveColorRoles(SCHEME, { variant: 'dark2' }).neutrals.card.hex;
		assert.ok(findings.some((f) => f.ruleId === 'opf/text-contrast' && f.path === '/slides/0/blocks/0/text/0/color' && f.message.includes(card)), JSON.stringify(findings));
	});
});

describe('LH-55 chart series on a dark plot', () => {
	const palette = chartSeriesPalette(SCHEME);
	const legible = chartSchemeSeries(undefined, SCHEME);

	test('every scheme series reaches 4.5:1 and series 2 is at least 20 L* from series 1', () => {
		const adjusted = chartPaletteForFill(NAVY, palette, { legible });
		for (const [index, color] of adjusted.entries()) assert.ok(colorContrast(color, NAVY) >= CHART_DARK_SERIES_MIN_CONTRAST, `series ${index + 1} ${color} ${colorContrast(color, NAVY)}`);
		assert.ok(Math.abs(lightness(adjusted[0]) - lightness(adjusted[1])) >= CHART_LEAD_LIGHTNESS_STEP, `${adjusted[0]} ${adjusted[1]}`);
		assert.equal(new Set(adjusted.slice(0, 6)).size, 6);
	});

	test('the step holds on other dark plots, and a light plot and an authored colour keep the 3:1 floor', () => {
		for (const fill of ['#000000', '#1E293B', '#111827']) {
			const adjusted = chartPaletteForFill(fill, palette, { legible });
			assert.ok(adjusted.every((color) => colorContrast(color, fill) >= CHART_DARK_SERIES_MIN_CONTRAST), `${fill}: ${adjusted}`);
			assert.ok(Math.abs(lightness(adjusted[0]) - lightness(adjusted[1])) >= CHART_LEAD_LIGHTNESS_STEP, `${fill}: ${adjusted.slice(0, 2)}`);
		}
		// LH-94 moves only a series that stands under 11 L* from the one before it (series 6 and 11 of this scheme); the others are unchanged.
		const light = chartPaletteForFill('#FFFFFF', palette, { legible }), plain = chartPaletteForFill('#FFFFFF', palette);
		assert.deepEqual(light.slice(0, 5), plain.slice(0, 5), 'a light plot keeps the colors that already stand clear of their neighbors');
		assert.ok(light.every((color) => colorContrast(color, '#FFFFFF') >= 3), 'a light plot keeps 3:1');
		const authored = chartSeriesPalette(SCHEME, [undefined, '#3F6B88']);
		const adjusted = chartPaletteForFill(NAVY, authored, { legible: chartSchemeSeries([undefined, '#3F6B88'], SCHEME) });
		assert.equal(adjusted[1], '#3F6B88', 'an authored series that has 3:1 keeps its colour');
	});
});

describe('LH-79 code panels', () => {
	test('a light deck with a near-black dark1 draws the code panel in dark2', () => {
		const roles = resolveColorRoles(SCHEME, { variant: 'light1' });
		assert.deepEqual(roles.neutrals.codePanel, { slot: 'tx2', hex: NAVY });
		const office = resolveColorRoles({ ...SCHEME, dark2: '#7DD3FC' }, { variant: 'light1' });
		assert.equal(office.neutrals.codePanel.slot, 'tx1', 'a dark2 too light for the code text keeps dark1');
		const brown = resolveColorRoles({ ...SCHEME, dark1: '#3B2F2F' }, { variant: 'light1' });
		assert.equal(brown.neutrals.codePanel.slot, 'tx1', 'a dark1 that is not near-black keeps its own panel');
	});

	test('a dark deck draws the panel a step below the slide, as a luminance transform of bg1', () => {
		const roles = resolveColorRoles(SCHEME, { variant: 'dark2' });
		const panel = roles.neutrals.codePanel;
		assert.equal(panel.slot, 'bg1');
		assert.equal(panel.lumMod, Math.round(CODE_PANEL_DARK_SHADE * 100000));
		assert.ok(lightness(panel.hex) < lightness(NAVY));
		assert.ok(colorContrast(panel.hex, NAVY) >= 1.05);
		// A near-black slide cannot go darker: bg2 when it stands off, else bg1 lifted.
		assert.deepEqual(resolveColorRoles(SCHEME, { variant: 'dark1' }).neutrals.codePanel, { slot: 'bg2', hex: NAVY });
		const flat = resolveColorRoles({ ...SCHEME, dark2: '#000000' }, { variant: 'dark1' }).neutrals.codePanel;
		assert.ok(flat.lumOff > 0 && lightness(flat.hex) > 0, JSON.stringify(flat));
		// Over a literal background a bg1 transform would be wrong in PowerPoint: the panel stays literal.
		const literal = resolveColorRoles(SCHEME, { variant: 'dark2', background: '#14532D' }).neutrals.codePanel;
		assert.equal(literal.lumMod, undefined);
	});

	test('every syntax colour keeps 4.5:1 on the new panels', () => {
		for (const variant of ['light1', 'dark1', 'dark2']) {
			const roles = resolveColorRoles(SCHEME, { variant });
			const palette = codeSyntaxPaletteForRoles(roles);
			for (const [kind, color] of Object.entries(palette)) assert.ok(colorContrast(color, roles.neutrals.codePanel.hex) >= 4.5, `${variant} ${kind} ${color}`);
		}
	});
});
