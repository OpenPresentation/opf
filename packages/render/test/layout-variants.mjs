import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {colorContrast} from '@openpresentation/opf/composition';
import {defaultCatalog, toSvg} from './catalog-harness.mjs';

// LH-01: the preview draws a slide on its layout's variant, resolved against the deck tone (section on accent1, statement and quote on the
// deck's secondary surface, closing on the brand dark) with text that reads on it; the slide's own variant wins; and a theme-slot background
// beside a variant at the same level is the variant's bg1 (core colorChoice), so a dark deck that also names `background: "light1"` paints
// dark1 under its light text, as the PPTX does. Every layout of the sampler in a dark deck draws its title at 4.5:1 or more.
const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const backgroundOf = (svg) => [...svg.matchAll(/<rect\b([^>]*?)\/?>/g)].map(([, a]) => attrs(a)).find((rect) => (rect['data-opf-path'] ?? '').endsWith('.design.background') || rect.width === '1280' && rect.height === '720').fill.toUpperCase();
const titleFills = (svg) => [...svg.matchAll(/<text\b([^>]*data-opf-path="slides\.\d+\.title"[^>]*)>/g)].map(([, a]) => attrs(a).fill.toUpperCase());
const titleFill = (svg) => titleFills(svg)[0];
const scheme = defaultCatalog.colorSchemes['cool-horizon'];
const slides = [
  {layout: 'section', title: 'Part two', subtitle: 'The evidence'},
  {layout: 'statement', title: 'Start small', text: 'Learn with two teams first.'},
  {layout: 'quote', title: 'In their words', quote: {text: 'We can see where help is needed.', source: 'Pilot lead'}},
  {layout: 'closing', title: 'Agree the start date', text: 'Name the pilot lead.'},
  {layout: 'section', title: 'Own variant', design: {variant: 'light1'}},
  {title: 'Content', text: 'A plain slide.', items: ['One', 'Two']},
];
// [deck design, the slots slides 1 to 6 draw on]
const cases = [
  [{theme: 'classic'}, ['accent1', 'light2', 'light2', 'dark2', 'light1', 'light1']],
  [{theme: 'classic', background: 'light1'}, ['accent1', 'light2', 'light2', 'dark2', 'light1', 'light1']],
  [{theme: 'classic', variant: 'dark1'}, ['accent1', 'dark2', 'dark2', 'dark2', 'light1', 'dark1']],
  [{theme: 'classic', variant: 'dark1', background: 'light1'}, ['accent1', 'dark2', 'dark2', 'dark2', 'light1', 'dark1']],
  [{theme: 'minimal'}, ['accent1', 'dark1', 'dark1', 'dark1', 'light1', 'dark2']],
];
for (const [design, slots] of cases) {
  for (const language of ['en-US', 'ar']) {
    const svgs = toSvg({name: 'Layout variants', language, design, slides}, {trace: true, catalogs: [defaultCatalog]});
    const label = `${JSON.stringify(design)} ${language}`;
    slots.forEach((slot, index) => assert.equal(backgroundOf(svgs[index]), scheme[slot].toUpperCase(), `${label}: slide ${index + 1} on ${slot}`));
    svgs.forEach((svg, index) => assert.ok(colorContrast(titleFill(svg), backgroundOf(svg)) >= 4.5, `${label}: slide ${index + 1} title ${titleFill(svg)} on ${backgroundOf(svg)}`));
  }
}

// Every layout and dynamic composition of the sampler, in a dark deck (with and without the sampler's own light1 background) and right to left.
{
  const sampler = JSON.parse(readFileSync(new URL('../../../examples/technical/layout-sampler.opf.json', import.meta.url), 'utf8'));
  delete sampler.catalogs;
  for (const [design, language] of [[{variant: 'dark1'}, 'en'], [{variant: 'dark1', background: undefined}, 'en'], [{theme: 'minimal', background: undefined}, 'ar'], [{variant: 'dark1'}, 'ar']]) {
    const deck = {...sampler, language, design: {...sampler.design, ...design}};
    const svgs = toSvg(deck, {trace: true, catalogs: [defaultCatalog]});
    assert.equal(svgs.filter((svg) => titleFills(svg).length).length, deck.slides.filter((slide) => slide.title).length, 'every titled slide is checked');
    svgs.forEach((svg, index) => {
      const background = backgroundOf(svg);
      for (const fill of titleFills(svg)) assert.ok(colorContrast(fill, background) >= 4.5, `${JSON.stringify(design)} ${language}: ${deck.slides[index].id} title ${fill} on ${background}`);
    });
  }
}
console.log('layout variants: ok');
