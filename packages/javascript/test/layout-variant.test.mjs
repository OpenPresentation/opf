// LH-01: a layout record names a background variant in design.variant. It outranks the deck's and the theme's variant or background and
// loses to the slide's own (docs/programs/layout-harvest/README.md, Decisions); an accent variant takes the text family that reads on it.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { colorContrast, colorMapFor, composeSlide, isColorVariant, layoutColorVariant, normalizeColorVariant, resolveColorRoles } from '../dist/composition.js';
import { resolveSlideContext, validate } from '../dist/index.js';

// Accent1 dark (light text), accent2 light (dark text), light2 too weak for secondary text on accent3.
const scheme = { light1: '#FFFFFF', dark1: '#101820', light2: '#F2EFE9', dark2: '#2B3A4A', accent1: '#1F4E79', accent2: '#F4D35E', accent3: '#707070', accent4: '#8E44AD', accent5: '#F39C12', accent6: '#16A085', hyperlink: '#0563C1', followedHyperlink: '#954F72' };
const layout = (variant) => ({ name: 'Divider', design: { titleAlignment: 'center', ...(variant !== undefined ? { variant } : {}) }, direction: 'column', regions: [{ name: 'title' }] });
const ACCENTS = ['accent2', 'accent1', 'accent3', 'accent4', 'accent5', 'accent6'];
const deck = (variant, { design = {}, slide = {}, direction } = {}) => ({
	name: 'Layout variants',
	language: direction === 'rtl' ? 'ar' : 'en-US',
	design: { colorScheme: 'house:house', background: 'light1', ...design },
	catalogs: { house: { source: 'https://example.com/house', layouts: { divider: layout(variant) }, colorSchemes: { house: { name: 'House', ...scheme } } } },
	slides: [{ layout: 'house:divider', title: 'Part two', subtitle: 'The evidence', ...slide }, { title: 'Content', text: 'Body.' }],
});
const roles = (document, index = 0) => resolveSlideContext(document, index).resolved.roles;

describe('accent variants', () => {
	test('an accent slot is a variant background, alone or with an accent order', () => {
		for (const slot of ['accent1', 'accent6']) {
			assert.ok(isColorVariant(slot));
			assert.deepEqual(normalizeColorVariant(slot), { background: slot });
		}
		assert.deepEqual(normalizeColorVariant({ background: 'accent2', accents: ACCENTS }), { background: 'accent2', accents: ACCENTS });
		assert.equal(isColorVariant('hyperlink'), false);
	});

	test('the accent is bg1 and bg2; the text family is the one whose tx1 reads better, and tx2 falls back to tx1 under 4.5:1', () => {
		const map = (slot) => { const { bg1, tx1, bg2, tx2 } = colorMapFor(slot, scheme); return [bg1, tx1, bg2, tx2]; };
		assert.deepEqual(map('accent1'), ['accent1', 'light1', 'accent1', 'light2'], 'dark accent: light text');
		assert.deepEqual(map('accent2'), ['accent2', 'dark1', 'accent2', 'dark2'], 'light accent: dark text');
		assert.ok(colorContrast(scheme.light2, scheme.accent3) < 4.5);
		assert.deepEqual(map('accent3'), ['accent3', 'light1', 'accent3', 'light1'], 'light2 too weak on accent3: tx2 is light1');
		for (const slot of ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6']) {
			const r = resolveColorRoles(scheme, { variant: slot });
			assert.equal(r.background, scheme[slot]);
			assert.ok(colorContrast(r.text, r.background) >= 4.5, `${slot} text`);
			assert.ok(colorContrast(r.textSecondary, r.background) >= 4.5, `${slot} secondary text`);
			assert.equal(r.dark, r.map.tx1 === 'light1');
		}
	});
});

describe('precedence (README decision: slide, then layout, then deck, then theme)', () => {
	test('a layout variant draws its slide on that variant; other slides keep the deck', () => {
		const document = deck('accent1');
		assert.deepEqual(roles(document).variant, { background: 'accent1' });
		assert.equal(roles(document).background, scheme.accent1);
		assert.equal(roles(document).dark, true);
		assert.deepEqual(resolveSlideContext(document, 0).resolved.layoutVariant, { background: 'accent1' });
		assert.deepEqual(roles(document, 1).variant, { background: 'light1' });
		assert.equal(resolveSlideContext(document, 1).resolved.layoutVariant, undefined);
		assert.deepEqual(roles(deck(undefined)).variant, { background: 'light1' }, 'a layout without a variant has no opinion');
	});

	test('the layout outranks the deck variant and the deck background', () => {
		assert.deepEqual(roles(deck('light2', { design: { variant: 'dark1' } })).variant, { background: 'light2' });
		assert.deepEqual(roles(deck('light2', { design: { background: 'dark2' } })).variant, { background: 'light2' });
		assert.deepEqual(roles(deck('dark1', { design: { variant: 'dark1' } }), 1).variant, { background: 'dark1' }, 'the dark deck stays dark elsewhere');
	});

	test('surface and brand resolve against the deck tone: a dark deck stays dark, and neither repeats the deck background', () => {
		const on = (value, design) => roles(deck(value, { design })).variant.background;
		// [deck design, surface, brand]
		for (const [design, surface, brand] of [
			[{}, 'light2', 'dark2'],
			[{ background: 'light2' }, 'light1', 'dark2'],
			[{ variant: 'dark1' }, 'dark2', 'dark2'],
			[{ background: 'dark2' }, 'dark1', 'dark1'],
			[{ variant: { background: 'dark1', accents: ACCENTS } }, 'dark2', 'dark2'],
		]) {
			assert.equal(on('surface', design), surface, `surface on ${JSON.stringify(design)}`);
			assert.equal(on('brand', design), brand, `brand on ${JSON.stringify(design)}`);
			const r = roles(deck('brand', { design }));
			assert.equal(r.map.tx1, 'light1', 'brand takes light text');
			assert.ok(colorContrast(r.text, r.background) >= 4.5);
		}
		assert.deepEqual(roles(deck('surface', { design: { variant: { background: 'dark1', accents: ACCENTS } } })).variant, { background: 'dark2', accents: ACCENTS });
		assert.deepEqual(layoutColorVariant(layout('brand')), { background: 'dark2' });
		assert.deepEqual(layoutColorVariant(layout('surface'), { background: 'dark2', dark: true }), { background: 'dark1' });
		assert.equal(roles(deck('surface', { slide: { design: { variant: 'light1' } } })).variant.background, 'light1', 'the slide still wins');
	});

	test('the slide own variant or background wins', () => {
		const ownVariant = deck('accent1', { slide: { design: { variant: 'light1' } } });
		assert.deepEqual(roles(ownVariant).variant, { background: 'light1' });
		assert.equal(resolveSlideContext(ownVariant, 0).resolved.layoutVariant, undefined);
		assert.deepEqual(roles(deck('accent1', { slide: { design: { background: 'dark2' } } })).variant, { background: 'dark2' });
		assert.equal(roles(deck('accent1', { slide: { design: { background: '#FFFFFF' } } })).dark, false);
	});

	test('without an accent order of its own the layout keeps the deck one; its own order wins', () => {
		assert.deepEqual(roles(deck('dark1', { design: { variant: { background: 'light1', accents: ACCENTS } } })).variant, { background: 'dark1', accents: ACCENTS });
		const own = ['accent3', 'accent2', 'accent1', 'accent4', 'accent5', 'accent6'];
		assert.deepEqual(roles(deck({ background: 'dark1', accents: own }, { design: { variant: { background: 'light1', accents: ACCENTS } } })).variant, { background: 'dark1', accents: own });
	});

	test('a deck picture background beats the layout variant (LH-103); a slide picture stays', () => {
		const picture = { type: 'image', src: 'https://example.com/bg.jpg', tone: 'dark' };
		const document = deck('light2', { design: { background: picture } });
		const context = resolveSlideContext(document, 0);
		assert.ok(composeSlide(context.slide, context.options).backgroundImage, 'the layout slide keeps the deck picture');
		assert.equal(context.resolved.layoutVariant, undefined);
		assert.deepEqual(context.resolved.roles.variant, { background: 'dark1' }, 'the picture tone decides');
		const other = resolveSlideContext(document, 1);
		assert.ok(composeSlide(other.slide, other.options).backgroundImage, 'a slide without the layout keeps the deck picture');
		const own = resolveSlideContext(deck('light2', { slide: { design: { background: picture } } }), 0);
		assert.ok(composeSlide(own.slide, own.options).backgroundImage);
		assert.deepEqual(own.resolved.roles.variant, { background: 'dark1' }, 'the slide picture tone decides');
	});

	test('a right-to-left deck resolves the same variant', () => {
		const document = deck('accent2', { direction: 'rtl' });
		assert.deepEqual(roles(document).variant, { background: 'accent2' });
		assert.equal(roles(document).dark, false);
		const context = resolveSlideContext(document, 0);
		assert.equal(composeSlide(context.slide, context.options).direction, 'rtl');
	});

	test('the validator reads the same variant, and the layout record validates', async () => {
		assert.deepEqual(layoutColorVariant(layout('accent1')), { background: 'accent1' });
		// A subtitle run in light1 reads on the accent1 slide and not on a light one: the contrast check sees the layout's variant.
		const white = { slide: { subtitle: [{ text: 'The evidence', color: 'light1' }] } };
		const contrast = (document) => validate(document).findings.filter((finding) => /contrast/.test(finding.ruleId) && finding.path?.startsWith('/slides/0'));
		assert.deepEqual(contrast(deck('accent1', white)), []);
		assert.ok(contrast(deck(undefined, white)).length > 0, 'the same run fails on the light deck');
		const schema = validate(deck({ background: 'accent9' }));
		assert.ok(schema.findings.some((finding) => finding.ruleId === 'opf/catalog-record' && finding.path.includes('/layouts/divider/design/variant')), 'an unknown slot is not a variant');
	});
});
