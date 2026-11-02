import assert from 'node:assert/strict';
import {colorContrast} from '@openpresentation/opf/composition';
import {defaultCatalog, toSvg} from './catalog-harness.mjs';

// LH-01: the preview draws a slide on its layout's variant (section on accent1, statement and quote on light2, closing on dark1) with
// text that reads on it, the slide's own variant wins, and a theme-slot background beside a variant at the same level is the variant's
// bg1 (core colorChoice), so a dark deck that also names `background: "light1"` paints dark1 under its light text, as the PPTX does.
const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const backgroundOf = (svg) => [...svg.matchAll(/<rect\b([^>]*?)\/?>/g)].map(([, a]) => attrs(a)).find((rect) => (rect['data-opf-path'] ?? '').endsWith('.design.background') || rect.width === '1280' && rect.height === '720').fill.toUpperCase();
const titleFill = (svg) => attrs(/<text\b([^>]*data-opf-path="slides\.\d+\.title"[^>]*)>/.exec(svg)[1]).fill.toUpperCase();
const scheme = defaultCatalog.colorSchemes['cool-horizon'];
const slides = [
  {layout: 'section', title: 'Part two', subtitle: 'The evidence'},
  {layout: 'statement', title: 'Start small', text: 'Learn with two teams first.'},
  {layout: 'quote', title: 'In their words', quote: {text: 'We can see where help is needed.', source: 'Pilot lead'}},
  {layout: 'closing', title: 'Agree the start date', text: 'Name the pilot lead.'},
  {layout: 'section', title: 'Own variant', design: {variant: 'light1'}},
  {title: 'Content', text: 'A plain slide.'},
];
const expected = [scheme.accent1, scheme.light2, scheme.light2, scheme.dark1, scheme.light1];

for (const design of [{theme: 'classic'}, {theme: 'classic', background: 'light1'}, {theme: 'minimal', variant: 'dark1'}, {theme: 'classic', variant: 'dark1', background: 'light1'}]) {
  for (const language of ['en-US', 'ar']) {
    const svgs = toSvg({name: 'Layout variants', language, design, slides}, {trace: true, catalogs: [defaultCatalog]});
    const label = `${JSON.stringify(design)} ${language}`;
    expected.forEach((color, index) => assert.equal(backgroundOf(svgs[index]), color.toUpperCase(), `${label}: slide ${index + 1}`));
    svgs.forEach((svg, index) => assert.ok(colorContrast(titleFill(svg), backgroundOf(svg)) >= 4.5, `${label}: slide ${index + 1} title ${titleFill(svg)} on ${backgroundOf(svg)}`));
    if (design.variant === 'dark1') assert.equal(backgroundOf(svgs[5]), scheme.dark1.toUpperCase(), `${label}: the dark deck's plain slide is dark1`);
  }
}
console.log('layout variants: ok');
