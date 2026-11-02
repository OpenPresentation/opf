// LH-103: a fixed background the author set (a hex or var: color, a gradient, a pattern, a picture) beats a gallery layout's
// design.variant; a scheme-based one (none, a theme slot, a slot or role name, a variant) still takes the layout's variant on top.
// docs/design-resolution.md, Color variants; docs/programs/layout-harvest/README.md, Decisions.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { colorContrast, composeSlide, deckBackgroundIsFixed, isFixedBackground, layoutVariantApplies } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const scheme = { light1: '#FFFFFF', dark1: '#101820', light2: '#F2EFE9', dark2: '#2B3A4A', accent1: '#1F4E79', accent2: '#F4D35E', accent3: '#707070', accent4: '#8E44AD', accent5: '#F39C12', accent6: '#16A085', hyperlink: '#0563C1', followedHyperlink: '#954F72' };
// The default catalog's layout variants: section accent1, statement and quote surface, closing brand.
const LAYOUT_VARIANTS = { section: 'accent1', statement: 'surface', quote: 'surface', closing: 'brand' };
const layout = (variant) => ({ name: 'Layout', design: { ...(variant !== undefined ? { variant } : {}) }, direction: 'column', regions: [{ name: 'title' }] });
const picture = 'https://example.com/bg.jpg';

// Each fixed background type, with the luminance or tone that decides its text on a slide without a layout variant.
const FIXED = {
	'hex shorthand (dark)': '#0B1020',
	'hex shorthand (light)': '#FAF7F0',
	'solid hex': { type: 'solid', color: '#7A1F3D' },
	'solid var:': { type: 'solid', color: 'var:brand' },
	'gradient with a tone': { type: 'gradient', tone: 'dark', gradient: { angle: 90, stops: [{ color: '#0B1020', position: 0 }, { color: '#1F4E79', position: 1 }] } },
	'gradient without a tone': { type: 'gradient', gradient: { angle: 90, stops: [{ color: '#FFFFFF', position: 0 }, { color: '#F2EFE9', position: 1 }] } },
	pattern: { type: 'pattern', pattern: { preset: 'pct5', foregroundColor: '#2B3A4A', backgroundColor: '#FFFFFF' } },
	'picture shorthand': picture,
	'picture with a tone': { type: 'image', src: picture, tone: 'dark' },
};
// Scheme-based backgrounds: the layout variant still applies.
const SCHEME_BASED = {
	none: undefined,
	'theme slot shorthand': 'light2',
	'theme slot object': { type: 'theme', slot: 'dark1' },
	'solid slot name': { type: 'solid', color: 'accent2' },
	'solid role name': { type: 'solid', color: 'primary' },
};

const catalog = (themeBackground) => ({
	house: {
		source: 'https://example.com/house',
		layouts: Object.fromEntries(Object.entries(LAYOUT_VARIANTS).map(([id, variant]) => [id, layout(variant)]).concat([['plain', layout(undefined)]])),
		colorSchemes: { house: { name: 'House', ...scheme } },
		themes: { house: { name: 'House', colorScheme: 'house:house', ...(themeBackground !== undefined ? { background: themeBackground } : {}) } },
	},
});
/** One slide per default layout variant, then one on a layout without a variant (the reference: a deck without layout variants). */
const deck = ({ design = {}, themeBackground, slide = {} } = {}) => ({
	name: 'Fixed backgrounds',
	language: 'en-US',
	variables: { brand: '#5B2333' },
	design: { theme: 'house:house', colorScheme: 'house:house', ...design },
	catalogs: catalog(themeBackground),
	slides: [...Object.keys(LAYOUT_VARIANTS).map((id) => ({ layout: `house:${id}`, title: 'Part two', ...slide })), { layout: 'house:plain', title: 'Content', text: 'Body.' }],
});
const PLAIN = Object.keys(LAYOUT_VARIANTS).length;
const context = (document, index) => resolveSlideContext(document, index);
const strip = ({ roles }) => ({ variant: roles.variant, background: roles.background, text: roles.text, textSecondary: roles.textSecondary, dark: roles.dark });

describe('which backgrounds are fixed', () => {
	test('hex, var:, gradient, pattern and picture are fixed; none, theme slots and slot or role names are scheme-based', () => {
		for (const [name, background] of Object.entries(FIXED)) assert.equal(isFixedBackground(background), true, name);
		for (const [name, background] of Object.entries(SCHEME_BASED)) assert.equal(isFixedBackground(background), false, name);
		assert.equal(isFixedBackground({ type: 'solid', color: 'background' }), false, 'the background role is scheme-based');
		assert.equal(isFixedBackground(null), false);
		assert.equal(isFixedBackground(false), false);
	});

	test('the deck background is the drawn one: a deck variant hides the theme background, a deck background beside a variant stays', () => {
		assert.equal(deckBackgroundIsFixed({}, '#0B1020'), true, 'the theme fixed background');
		assert.equal(deckBackgroundIsFixed({ variant: 'dark1' }, '#0B1020'), false, 'a deck variant hides the theme background');
		assert.equal(deckBackgroundIsFixed({ variant: 'dark1', background: picture }, undefined), true, 'a deck variant beside its fixed background');
		assert.equal(deckBackgroundIsFixed({ background: 'light2' }, picture), false, 'the deck slot over the theme picture');
		assert.equal(layoutVariantApplies({}, layout('accent1'), { background: picture }), false);
		assert.equal(layoutVariantApplies({}, layout('accent1'), { background: 'light2' }), true);
		assert.equal(layoutVariantApplies({}, layout(undefined), {}), false, 'a layout without a variant has no opinion');
	});
});

describe('a fixed deck or theme background beats every default layout variant', () => {
	for (const [name, background] of Object.entries(FIXED)) {
		for (const [where, options] of [['deck', { design: { background } }], ['theme', { themeBackground: background }]]) {
			test(`${where} ${name}`, () => {
				const document = deck(options);
				const reference = context(document, PLAIN);
				for (const [index, id] of Object.keys(LAYOUT_VARIANTS).entries()) {
					const slide = context(document, index);
					assert.equal(slide.resolved.layoutVariant, undefined, `${id}: no layout variant`);
					assert.deepEqual(strip(slide.resolved), strip(reference.resolved), `${id}: the roles of a slide without a layout variant`);
					const composed = composeSlide(slide.slide, slide.options);
					assert.equal(Boolean(composed.backgroundImage), name.startsWith('picture'), `${id}: the deck picture is kept`);
					const color = typeof background === 'string' && background.startsWith('#') ? background : background?.type === 'solid' ? (background.color.startsWith('var:') ? '#5B2333' : background.color) : undefined;
					if (color) assert.ok(colorContrast(slide.resolved.roles.text, color) >= 4.5, `${id}: text reads on ${color}`);
				}
			});
		}
	}

	test('a deck that sets a fixed background and a variant: the variant maps the text, the background beats the layout', () => {
		const document = deck({ design: { background: picture, variant: 'dark1' } });
		for (const index of [0, 1, 2, 3]) {
			const slide = context(document, index);
			assert.equal(slide.resolved.layoutVariant, undefined);
			assert.deepEqual(slide.resolved.roles.variant, { background: 'dark1' });
			assert.ok(composeSlide(slide.slide, slide.options).backgroundImage);
		}
	});

	test('the slide own variant or background still wins over a fixed deck background', () => {
		const ownVariant = deck({ design: { background: '#0B1020' }, slide: { design: { variant: 'light1' } } });
		assert.deepEqual(context(ownVariant, 0).resolved.roles.variant, { background: 'light1' });
		const ownBackground = deck({ design: { background: picture }, slide: { design: { background: 'accent2' } } });
		const slide = context(ownBackground, 0);
		assert.equal(composeSlide(slide.slide, slide.options).backgroundImage, undefined);
		assert.equal(slide.resolved.roles.dark, false);
	});
});

describe('a scheme-based deck or theme background takes the layout variant on top (unchanged)', () => {
	for (const [name, background] of Object.entries(SCHEME_BASED)) {
		test(name, () => {
			for (const document of [deck({ design: background !== undefined ? { background } : {} }), deck({ themeBackground: background })]) {
				for (const [index, id] of Object.keys(LAYOUT_VARIANTS).entries()) {
					const slide = context(document, index);
					assert.ok(slide.resolved.layoutVariant, `${id}: the layout variant applies`);
					assert.deepEqual(slide.resolved.roles.variant.background, slide.resolved.layoutVariant.background);
					assert.ok(colorContrast(slide.resolved.roles.text, slide.resolved.roles.background) >= 4.5, `${id}: text contrast`);
				}
				assert.equal(context(document, 0).resolved.layoutVariant.background, 'accent1');
			}
		});
	}

	test('a deck variant hides a fixed theme background, so the layout variant applies', () => {
		const document = deck({ design: { variant: 'light1' }, themeBackground: picture });
		assert.deepEqual(context(document, 0).resolved.layoutVariant, { background: 'accent1' });
		assert.deepEqual(context(document, 1).resolved.layoutVariant, { background: 'light2' });
		assert.deepEqual(context(document, 3).resolved.layoutVariant, { background: 'dark2' });
	});
});
