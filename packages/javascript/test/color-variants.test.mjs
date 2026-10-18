// RR-96: color scheme variants (a map over the one twelve-slot scheme), roles from the map, and neutrals derived from the scheme.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { ENGINE_DEFAULT_COLOR_SCHEME, applyLuminance, clrMapAttributes, codeHighlightColors, codeSyntaxPaletteForRoles, colorContrast, colorMapFor, isColorVariant, readableSchemeColor, resolveColorRoles, chartSeriesPalette } from '../dist/composition.js';
import { resolveSlideContext, validate } from '../dist/index.js';

const scheme = { light1: '#FFFFFF', dark1: '#101820', light2: '#F2EFE9', dark2: '#2B3A4A', accent1: '#C0392B', accent2: '#2874A6', accent3: '#27AE60', accent4: '#8E44AD', accent5: '#F39C12', accent6: '#16A085', hyperlink: '#0563C1', followedHyperlink: '#954F72' };

describe('maps', () => {
	test('each background slot maps the four roles over the same slots', () => {
		const slots = (variant) => { const { bg1, tx1, bg2, tx2 } = colorMapFor(variant); return [bg1, tx1, bg2, tx2]; };
		assert.deepEqual(slots(undefined), ['light1', 'dark1', 'light2', 'dark2']);
		assert.deepEqual(slots({ background: 'light1' }), ['light1', 'dark1', 'light2', 'dark2']);
		assert.deepEqual(slots({ background: 'dark1' }), ['dark1', 'light1', 'dark2', 'light2']);
		assert.deepEqual(slots({ background: 'light2' }), ['light2', 'dark1', 'light2', 'dark2']);
		assert.deepEqual(slots({ background: 'dark2' }), ['dark2', 'light1', 'dark2', 'light2']);
		assert.deepEqual(colorMapFor().accents, ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6']);
	});

	test('accents are a permutation of the six accent slots', () => {
		const accents = ['accent2', 'accent1', 'accent3', 'accent4', 'accent5', 'accent6'];
		assert.deepEqual(colorMapFor({ background: 'dark1', accents }).accents, accents);
		assert.ok(isColorVariant({ background: 'dark1', accents }));
		assert.ok(isColorVariant({ background: 'light1' }));
		for (const bad of [undefined, null, 'dark1', {}, { background: 'accent1' }, { background: 'dark1', accents: ['accent1'] }, { background: 'dark1', accents: ['accent1', 'accent1', 'accent3', 'accent4', 'accent5', 'accent6'] }, { background: 'dark1', accents: ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'dark1'] }])
			assert.equal(isColorVariant(bad), false, JSON.stringify(bad));
		assert.deepEqual(colorMapFor({ background: 'dark1', accents: ['accent1'] }).accents, colorMapFor().accents, 'a malformed accent list is ignored');
	});

	test('clrMapAttributes is PowerPoint\'s clrMap', () => {
		assert.deepEqual(clrMapAttributes(colorMapFor()), { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2', accent1: 'accent1', accent2: 'accent2', accent3: 'accent3', accent4: 'accent4', accent5: 'accent5', accent6: 'accent6', hlink: 'hlink', folHlink: 'folHlink' });
		const dark = clrMapAttributes(colorMapFor({ background: 'dark1', accents: ['accent3', 'accent2', 'accent1', 'accent4', 'accent5', 'accent6'] }));
		assert.deepEqual([dark.bg1, dark.tx1, dark.bg2, dark.tx2, dark.accent1, dark.accent3], ['dk1', 'lt1', 'dk2', 'lt2', 'accent3', 'accent1']);
	});
});

describe('roles from the map', () => {
	test('no variant keeps the luminance rule: light1 on a light fill, dark1 on a dark one', () => {
		const light = resolveColorRoles(scheme), dark = resolveColorRoles(scheme, { background: '#0B1220' });
		assert.deepEqual([light.variant, light.dark, light.text, light.surface, light.textSecondary], [{ background: 'light1' }, false, '#101820', '#F2EFE9', '#2B3A4A']);
		assert.deepEqual([dark.variant, dark.dark, dark.text, dark.surface, dark.textSecondary, dark.background], [{ background: 'dark1' }, true, '#FFFFFF', '#2B3A4A', '#F2EFE9', '#0B1220']);
	});

	test('a variant sets background, text, secondary text and surface through bg1, tx1, tx2 and bg2', () => {
		const expected = {
			light1: ['#FFFFFF', '#101820', '#2B3A4A', '#F2EFE9'],
			light2: ['#F2EFE9', '#101820', '#2B3A4A', '#F2EFE9'],
			dark1: ['#101820', '#FFFFFF', '#F2EFE9', '#2B3A4A'],
			dark2: ['#2B3A4A', '#FFFFFF', '#F2EFE9', '#2B3A4A'],
		};
		for (const [background, [bg, text, textSecondary, surface]] of Object.entries(expected)) {
			const roles = resolveColorRoles(scheme, { variant: { background } });
			assert.deepEqual([roles.background, roles.text, roles.textSecondary, roles.surface], [bg, text, textSecondary, surface], background);
			assert.equal(roles.dark, background.startsWith('dark'));
			assert.ok(colorContrast(roles.text, roles.background) >= 4.5, `${background}: text reads on the background`);
		}
	});

	test('a variant overrides the background luminance; an explicit fill color still paints the fill', () => {
		const roles = resolveColorRoles(scheme, { variant: { background: 'dark1' }, background: '#FFFFFF' });
		assert.equal(roles.dark, true);
		assert.equal(roles.background, '#FFFFFF');
		assert.equal(roles.text, '#FFFFFF');
	});

	test('a tone chooses dark1 or light1 without a variant; a variant wins over it', () => {
		assert.equal(resolveColorRoles(scheme, { tone: 'dark' }).dark, true);
		assert.deepEqual(resolveColorRoles(scheme, { tone: 'dark' }).variant, { background: 'dark1' });
		assert.equal(resolveColorRoles(scheme, { tone: 'light', background: '#000000' }).dark, false);
		assert.equal(resolveColorRoles(scheme, { tone: 'dark', variant: { background: 'light1' } }).dark, false);
	});

	test('the accent order moves primary, secondary and accent and lists the six accents', () => {
		const accents = ['accent4', 'accent1', 'accent2', 'accent3', 'accent5', 'accent6'];
		const roles = resolveColorRoles(scheme, { variant: { background: 'light1', accents } });
		assert.deepEqual([roles.primary, roles.secondary, roles.accent], ['#8E44AD', '#C0392B', '#2874A6']);
		assert.deepEqual(roles.accents, accents.map((slot) => scheme[slot]));
		assert.equal(resolveColorRoles(scheme, { variant: { background: 'light1', accents }, }).map.accents[0], 'accent4');
		assert.equal(resolveColorRoles({ ...scheme, primary: '#123456' }, { variant: { background: 'light1', accents } }).primary, '#123456', 'a role override still wins');
	});

	test('the series palette follows the accent order', () => {
		assert.equal(chartSeriesPalette(scheme)[0], '#C0392B');
		assert.deepEqual(chartSeriesPalette(scheme, undefined, { accents: ['accent4', 'accent1', 'accent2', 'accent3', 'accent5', 'accent6'] }).slice(0, 3), ['#8E44AD', '#C0392B', '#2874A6']);
	});

	test('role overrides on the scheme still apply on top of the map', () => {
		const roles = resolveColorRoles({ ...scheme, surface: '#EFEFEF', textSecondary: '#445566', text: '#111111' }, { variant: { background: 'light1' } });
		assert.deepEqual([roles.surface, roles.textSecondary, roles.text], ['#EFEFEF', '#445566', '#111111']);
		assert.equal(resolveColorRoles({ ...scheme, text: '#111111' }, { variant: { background: 'dark1' } }).text, '#FFFFFF', 'a dark slide ignores the text override');
	});
});

describe('neutrals', () => {
	test('gridlines are PowerPoint\'s tx1 lumMod 15000, lumOff 85000 on a light map', () => {
		const roles = resolveColorRoles({ ...scheme, dark1: '#000000' }, { variant: { background: 'light1' } });
		assert.deepEqual(roles.neutrals.gridline, { slot: 'tx1', hex: '#D9D9D9', lumMod: 15000, lumOff: 85000 });
		assert.deepEqual(roles.neutrals.axisLine, { slot: 'tx1', hex: '#BFBFBF', lumMod: 25000, lumOff: 75000 });
		assert.equal(roles.neutrals.chartText.hex, '#595959');
		assert.equal(roles.border, roles.neutrals.border.hex);
	});

	test('every mix is its slot color with the luminance transform applied', () => {
		for (const background of ['light1', 'light2', 'dark1', 'dark2']) {
			const roles = resolveColorRoles(scheme, { variant: { background } });
			const slotHex = { tx1: roles.text, bg1: roles.background, tx2: roles.textSecondary, bg2: roles.surface };
			for (const [name, neutral] of Object.entries(roles.neutrals)) {
				if (!['tx1', 'bg1', 'tx2', 'bg2'].includes(neutral.slot)) assert.fail(`${name}: ${neutral.slot}`);
				const base = { tx1: roles.neutrals.codeText.slot === 'tx1' && name.startsWith('code') ? slotHex.tx1 : slotHex.tx1, bg1: slotHex.bg1, tx2: slotHex.tx2, bg2: slotHex.bg2 }[neutral.slot];
				assert.equal(applyLuminance(base, neutral.lumMod ?? 100000, neutral.lumOff ?? 0), neutral.hex, `${background} ${name}`);
			}
		}
	});

	test('lines are quieter than the text and visible on the background, on both kinds of map', () => {
		for (const background of ['light1', 'light2', 'dark1', 'dark2']) {
			const roles = resolveColorRoles(scheme, { variant: { background } });
			const against = (neutral) => colorContrast(neutral.hex, roles.background);
			assert.ok(against(roles.neutrals.border) > 1.1, `${background} border`);
			assert.ok(against(roles.neutrals.gridline) < against(roles.neutrals.border), `${background} gridline is quieter than border`);
			assert.ok(against(roles.neutrals.axisLine) > against(roles.neutrals.border), `${background} axis`);
			assert.ok(against(roles.neutrals.chartText) >= 4.5, `${background} chart text reads: ${against(roles.neutrals.chartText)}`);
			assert.ok(against(roles.neutrals.chartText) < colorContrast(roles.text, roles.background), `${background} chart text is quieter than text`);
			assert.equal(roles.neutrals.outline.hex, roles.background);
			assert.equal(roles.neutrals.trendNeutral.hex, roles.textSecondary);
		}
	});

	test('the code panel is a dark card on either map and its text and comments read on it', () => {
		for (const background of ['light1', 'light2', 'dark1', 'dark2']) {
			const roles = resolveColorRoles(scheme, { variant: { background } });
			const { codePanel, codeText, codeComment } = roles.neutrals;
			assert.ok(colorContrast(codePanel.hex, '#FFFFFF') > 4, `${background}: dark panel`);
			assert.ok(colorContrast(codeText.hex, codePanel.hex) >= 7, `${background}: text`);
			assert.ok(colorContrast(codeComment.hex, codePanel.hex) >= 3, `${background}: comment`);
			const palette = codeSyntaxPaletteForRoles(roles);
			for (const [kind, color] of Object.entries(palette)) assert.ok(colorContrast(color, codePanel.hex) >= 4.5, `${background} ${kind} ${color}`);
			const colors = codeHighlightColors(scheme, palette, codePanel.hex);
			assert.ok(colorContrast(colors.lit.keyword, colors.band) >= 4.5);
		}
	});

	test('readableSchemeColor picks bg1 or tx1, whichever reads on the fill', () => {
		const roles = resolveColorRoles(scheme, { variant: { background: 'light1' } });
		assert.deepEqual(readableSchemeColor('#102030', roles), { slot: 'bg1', hex: '#FFFFFF' });
		assert.deepEqual(readableSchemeColor('#F2EFE9', roles), { slot: 'tx1', hex: '#101820' });
		const dark = resolveColorRoles(scheme, { variant: { background: 'dark1' } });
		assert.equal(readableSchemeColor('#FFFFFF', dark).slot, 'bg1');
	});

	test('luminance transforms keep hue and saturation of the slot', () => {
		assert.equal(applyLuminance('#000000', 15000, 85000), '#D9D9D9');
		assert.equal(applyLuminance('#FFFFFF', 50000, 0), '#808080');
		assert.equal(applyLuminance('#2874A6'), '#2874A6');
		assert.equal(applyLuminance('nope', 1, 1), 'nope');
	});
});

describe('slide resolution', () => {
	const chart = { type: 'column', data: { columns: ['Quarter', 'A'], rows: [['Q1', 1]] } };
	const deck = (design, slideDesign) => ({ name: 'Variants', language: 'en-US', design: { colorScheme: { id: 'variants', ...scheme }, ...design }, slides: [{ title: 'T', ...(slideDesign ? { design: slideDesign } : {}), chart }] });
	const roles = (document) => resolveSlideContext(document, 0).resolved.roles;

	test('a deck variant applies to the slide, and a slide variant replaces it', () => {
		assert.equal(roles(deck({ variant: { background: 'dark1' } })).dark, true);
		assert.equal(roles(deck({ variant: { background: 'dark1' } }, { variant: { background: 'light2' } })).background, '#F2EFE9');
		assert.equal(resolveSlideContext(deck({ variant: { background: 'dark1' } }), 0).options.darkBackground, true);
		// With no design color at all the engine default theme's background applies (a theme-slot background: its variant).
		assert.deepEqual(roles(deck({})).variant, { background: 'dark2' });
		assert.equal(roles(deck({ variant: { background: 'light1' } })).dark, false);
	});

	test('a theme-slot background is the variant of that slot (the shorthand implies it)', () => {
		for (const background of ['dark1', { type: 'theme', slot: 'dark1' }]) {
			const found = roles(deck({ background }));
			assert.deepEqual(found.variant, { background: 'dark1' });
			assert.equal(found.surface, '#2B3A4A');
		}
		assert.equal(roles(deck({ background: 'light2' })).surface, '#F2EFE9');
		assert.equal(roles(deck({ background: 'dark1' }, { background: 'light1' })).dark, false, 'the slide\'s own background wins');
	});

	test('a variant wins over the shorthand at the same level; the deck variant covers a slide with no background of its own', () => {
		assert.equal(roles(deck({ variant: { background: 'light1' }, background: 'dark1' })).dark, false);
		assert.equal(roles(deck({ variant: { background: 'dark1' } }, { background: 'light1' })).dark, false);
	});

	test('a solid color decides by luminance; a picture or gradient takes its tone, else the deck variant, else light', () => {
		assert.equal(roles(deck({ background: '#101820' })).dark, true);
		assert.equal(roles(deck({ background: { type: 'solid', color: '#FFFFFF' } })).dark, false);
		const gradient = (tone) => ({ type: 'gradient', gradient: { stops: [{ color: '#101820', position: 0 }, { color: '#000000', position: 1 }] }, ...(tone ? { tone } : {}) });
		assert.equal(roles(deck({ background: gradient('dark') })).dark, true);
		assert.equal(roles(deck({ background: gradient('light') })).dark, false);
		assert.equal(roles(deck({ background: gradient() })).dark, false, 'no tone, no variant: light, as before');
		assert.equal(roles(deck({ variant: { background: 'dark1' } }, { background: gradient() })).dark, true, 'no tone: the deck variant applies');
		const image = (tone) => ({ type: 'image', src: 'asset:cover', ...(tone ? { tone } : {}) });
		assert.equal(roles(deck({ background: image('dark') })).dark, true);
		assert.equal(roles(deck({ background: image() })).dark, false);
	});

	test('the validator resolves the same roles: a dark variant has readable text, and the contrast rules still run', () => {
		const report = validate(deck({ variant: { background: 'dark1' } }), { only: ['accessibility'] });
		assert.deepEqual(report.findings.filter((entry) => entry.severity === 'error'), []);
		assert.ok(!report.findings.some((entry) => /contrast/.test(entry.ruleId) && entry.severity !== 'info'), JSON.stringify(report.findings.map((entry) => entry.ruleId)));
	});
});

describe('schema', () => {
	const doc = (design, slideDesign) => ({ name: 'Schema', language: 'en-US', design, slides: [{ title: 'T', ...(slideDesign ? { design: slideDesign } : {}) }] });
	const errors = (document) => validate(document, { only: ['format'] }).findings.filter((entry) => entry.severity === 'error');

	test('design.variant and slides[n].design.variant accept a background slot and an accent permutation', () => {
		assert.deepEqual(errors(doc({ variant: { background: 'dark2' } })), []);
		assert.deepEqual(errors(doc({}, { variant: { background: 'light2', accents: ['accent2', 'accent1', 'accent3', 'accent4', 'accent5', 'accent6'] } })), []);
		assert.deepEqual(errors(doc({ background: 'dark1', variant: { background: 'dark1' } })), []);
	});

	test('a malformed variant is a schema error', () => {
		for (const variant of [{}, { background: 'accent1' }, { background: 'dark1', extra: 1 }, { background: 'dark1', accents: ['accent1', 'accent1', 'accent3', 'accent4', 'accent5', 'accent6'] }, { background: 'dark1', accents: ['accent1'] }, 'dark1'])
			assert.ok(errors(doc({ variant })).length > 0, JSON.stringify(variant));
	});

	test('tone is dark or light on a picture or gradient background', () => {
		const gradient = { type: 'gradient', gradient: { stops: [{ color: '#000000', position: 0 }, { color: '#111111', position: 1 }] } };
		assert.deepEqual(errors(doc({ background: { ...gradient, tone: 'dark' } })), []);
		assert.deepEqual(errors(doc({ background: { type: 'image', src: 'asset:x', tone: 'light' } })), []);
		assert.ok(errors(doc({ background: { ...gradient, tone: 'grey' } })).length > 0);
		assert.ok(errors(doc({ background: { type: 'image', src: 'asset:x', tone: 'grey' } })).length > 0);
	});
});

test('the default scheme resolves without a variant exactly as the earlier roles did', () => {
	const roles = resolveColorRoles(ENGINE_DEFAULT_COLOR_SCHEME);
	assert.deepEqual([roles.background, roles.text, roles.surface, roles.textSecondary, roles.dark], ['#FFFFFF', '#000000', '#F0F0F0', '#011842', false]);
});
