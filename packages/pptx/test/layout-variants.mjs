// LH-01: a layout record's design.variant reaches the PPTX as the slide's clrMapOvr and a bg1 (or accent) background, as the preview draws
// it: section on accent1, statement and quote on the deck's secondary surface (light2, or dark2 on a dark deck), closing on the brand dark
// (dark2). A slide's own variant wins, the import drops the variant its layout already gives, and every layout of the sampler in a dark deck
// draws its title at 4.5:1 or more against the drawn background (both read from the exported XML through the theme and the colour map).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {strFromU8, unzipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {colorContrast} from '@openpresentation/opf/composition';
import {fromPptx, toPptx} from '../dist/index.js';
import {clrMapOf, colorsInXml, themeColorsOf} from './helpers/scheme-colors.mjs';

const deck = (design = {}, extra = {}) => ({
  name: 'Layout variants', language: 'en-US', ...extra, design: {theme: 'classic', ...design},
  slides: [
    {layout: 'section', title: 'Part two', subtitle: 'The evidence'},
    {layout: 'statement', title: 'Start small', text: 'Learn with two teams first.'},
    {layout: 'quote', title: 'In their words', quote: {text: 'We can see where help is needed.', source: 'Pilot lead'}},
    {layout: 'closing', title: 'Agree the start date', text: 'Name the pilot lead.'},
    {layout: 'section', title: 'Own variant', design: {variant: 'light1'}},
    {title: 'Content', text: 'A plain slide.', items: ['One', 'Two']},
  ],
});
const open = async (document) => {
  const bytes = await toPptx(document, {catalogs: [gallery]});
  const files = unzipSync(bytes);
  const text = name => strFromU8(files[name]);
  const slide = index => text(`ppt/slides/slide${index + 1}.xml`);
  const override = index => { const xml = slide(index); return /<a:overrideClrMapping/.test(xml) ? clrMapOf(xml.match(/<p:clrMapOvr>[\s\S]*?<\/p:clrMapOvr>/)[0]) : undefined; };
  const background = index => slide(index).match(/<p:bg>[\s\S]*?<\/p:bg>/)?.[0] ?? '';
  const masterXml = text('ppt/slideMasters/slideMaster1.xml'), master = clrMapOf(masterXml), theme = themeColorsOf(text('ppt/theme/theme1.xml'));
  // The drawn background and the title runs' colours of a slide, as RRGGBB through its colour map (its override, else the master's).
  const colors = index => {
    const map = override(index) ?? master;
    const bg = background(index) || masterXml.match(/<p:bg>[\s\S]*?<\/p:bg>/)?.[0] || '<a:schemeClr val="bg1"/>';
    const titles = [...slide(index).matchAll(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?name="OPF heading slides\.\d+\.title[^"]*"[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape);
    const runs = titles.flatMap(shape => [...shape.matchAll(/<a:rPr\b[^>]*>([\s\S]*?)<\/a:rPr>/g)].map(([, inner]) => colorsInXml(inner.match(/<a:solidFill>[\s\S]*?<\/a:solidFill>/)?.[0] ?? '<a:schemeClr val="tx1"/>', theme, map)[0]?.hex));
    return {background: colorsInXml(bg, theme, map)[0]?.hex, titles: runs};
  };
  return {bytes, override, background, master, colors};
};

for (const extra of [{}, {language: 'ar'}]) {
  const {bytes, override, background, master} = await open(deck({}, extra));
  // 1. Each layout writes its variant's map; the accent is the background and bg2, light1 the text on classic's dark accent1.
  assert.equal(override(0)?.bg1, 'accent1');
  assert.equal(override(0)?.bg2, 'accent1');
  assert.equal(override(0)?.tx1, 'lt1');
  assert.match(background(0), /<a:schemeClr val="accent1"\/>|<a:schemeClr val="bg1"\/>/);
  for (const index of [1, 2]) assert.equal(override(index)?.bg1, 'lt2', `slide ${index + 1}`);
  assert.equal(override(3)?.bg1, 'dk2');
  assert.equal(override(3)?.tx1, 'lt1');
  for (const index of [1, 2, 3]) assert.match(background(index), /<a:schemeClr val="bg1"\/>/, `slide ${index + 1} background follows its map`);
  // 2. The slide's own variant wins (here the master's map, which it states because PowerPoint's section layout carries the variant, LH-96); a slide without a layout variant keeps the master map.
  assert.deepEqual(override(4), master);
  assert.equal(override(5), undefined);
  // 3. The import reads each override back and drops it where the restored layout gives it.
  const back = await fromPptx(bytes, {catalogs: [gallery]});
  const slides = (back.presentation ?? back.document ?? back).slides;
  for (const index of [0, 1, 2, 3]) assert.equal(slides[index].design?.variant, undefined, `imported slide ${index + 1}`);
  assert.equal(slides[4].layout, 'section');
}

// 4. A dark deck keeps its tone: statement and quote on dark2 (the dark secondary surface), closing on dark2, the plain slide on the dark master.
{
  const {master, override} = await open(deck({variant: 'dark1'}));
  assert.equal(master.bg1, 'dk1');
  assert.equal(override(0)?.bg1, 'accent1');
  for (const index of [1, 2, 3]) assert.equal(override(index)?.bg1, 'dk2', `slide ${index + 1}`);
  assert.equal(override(5), undefined);
  assert.equal(override(4)?.bg1, 'lt1', "the slide's own light1 overrides the dark master");
}

// 5. Every layout of the sampler in a dark deck (with and without its own light1 background, and right to left) draws a readable title.
{
  const sampler = JSON.parse(readFileSync(new URL('../../../examples/technical/layout-sampler.opf.json', import.meta.url), 'utf8'));
  delete sampler.catalogs;
  for (const [design, language] of [[{variant: 'dark1'}, 'en'], [{variant: 'dark1', background: undefined}, 'en'], [{theme: 'minimal', background: undefined}, 'ar']]) {
    const {colors} = await open({...sampler, language, design: {...sampler.design, ...design}});
    let checked = 0;
    sampler.slides.forEach((slide, index) => {
      const {background, titles} = colors(index);
      for (const title of titles) {
        assert.ok(background && title && colorContrast(`#${title}`, `#${background}`) >= 4.5, `${JSON.stringify(design)} ${language}: ${slide.id} title ${title} on ${background}`);
        checked++;
      }
    });
    assert.ok(checked >= sampler.slides.filter(slide => slide.title).length, `${JSON.stringify(design)}: every titled slide is checked (${checked})`);
  }
}
console.log('layout variants: ok');
