// LH-20: `as: 'images'` writes each slide as one full-bleed PNG picture drawn by opf-render, with the speaker notes, the hidden
// flag and section kept, and the slide's text as the picture's alternative text (descr). No text box, font or source record of
// the deck reaches the file.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import sharp from 'sharp';
import {toPptx} from './helpers/default-catalog.mjs';
import {slideText} from '../dist/picture-slides.js';

let checks = 0;
const deck = {
  name: 'Pictures',
  slides: [
    {title: 'Quarterly results', subtitle: 'Fiscal 2026', notes: 'Open with the headline number.', section: 'Intro'},
    {title: 'Highlights', items: ['Revenue up 12 %', {text: 'Margin', description: 'four points higher'}], hidden: true},
    {title: 'By region', table: {columns: ['Region', 'Revenue'], rows: [['North', 120], [{value: 'South'}, 95]]}, notes: 'Pause for questions.'},
    {},
  ],
};

// The alternative text: headings, list entries with their descriptions, table rows, in reading order.
{
  assert.equal(slideText(deck.slides[1]), 'Highlights\nRevenue up 12 %\nMargin: four points higher');
  assert.equal(slideText(deck.slides[2]), 'By region\nRegion, Revenue\nNorth, 120\nSouth, 95');
  assert.equal(slideText({blocks: [{type: 'group', blocks: [{text: [{text: 'Rich '}, {text: 'text', bold: true}]}, {metric: {value: '42', label: 'NPS'}}]}, {chart: {type: 'bar', alt: 'Revenue rose', data: {rows: []}}}]}), 'Rich text\n42 NPS\nRevenue rose');
  checks++;
}

{
  const diagnostics = [];
  const bytes = await toPptx(deck, {as: 'images', onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  const entries = unzipSync(bytes);
  const slides = Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort();
  assert.equal(slides.length, 4);
  for (const [index, part] of slides.entries()) {
    const xml = strFromU8(entries[`ppt/slides/slide${index + 1}.xml`]);
    // One picture, full bleed, and nothing else on the slide.
    assert.equal((xml.match(/<p:pic>/g) ?? []).length, 1, `${part}: one picture`);
    assert.ok(!/<p:sp>|<p:graphicFrame>|<a:t>/.test(xml), `${part}: no text box, table or chart`);
    assert.match(xml, /<a:off x="0" y="0"\/><a:ext cx="12192000" cy="6858000"\/>/, `${part}: the picture fills the 16:9 slide`);
  }
  const descr = n => strFromU8(entries[`ppt/slides/slide${n}.xml`]).match(/<p:cNvPr id="\d+" name="[^"]*" descr="([^"]*)"/)?.[1];
  assert.equal(descr(1), 'Quarterly results&#10;Fiscal 2026');
  assert.equal(descr(3), 'By region&#10;Region, Revenue&#10;North, 120&#10;South, 95');
  assert.equal(descr(4), 'Slide 4', 'a slide without text is still described, never decorative');
  assert.match(strFromU8(entries['ppt/slides/slide2.xml']), /<p:sld\b[^>]*\bshow="0"/, 'a hidden slide stays hidden');
  const notes = Object.keys(entries).filter(path => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(path)).map(path => strFromU8(entries[path])).join('\n');
  assert.match(notes, /Open with the headline number\./);
  assert.match(notes, /Pause for questions\./);
  assert.match(strFromU8(entries['ppt/presentation.xml']), /<p14:section name="Intro"/, 'the section list is kept');
  // The pictures are the preview at scale 2: 2560 x 1440 PNG.
  const media = Object.keys(entries).filter(path => path.startsWith('ppt/media/'));
  assert.equal(media.length, 4);
  const {width, height, format} = await sharp(entries[media[0]]).metadata();
  assert.deepEqual([format, width, height], ['png', 2560, 1440]);
  // Nothing is recorded to import the source deck back: the pictures are not its content.
  assert.ok(!Object.entries(entries).some(([path, bytes]) => /\.xml$/.test(path) && /OPF_(?:DOCUMENT|SLIDE)_V1/.test(strFromU8(bytes))), 'no provenance tags');
  assert.deepEqual(diagnostics, []);
  checks++;
}

// A host rasterizer draws the slides (core's convert passes its own); its scale is the option.
{
  const seen = [];
  const png = background => sharp({create: {width: 4, height: 2, channels: 3, background}}).png().toBuffer();
  const pngs = [await png('#336699'), await png('#993366')];
  const bytes = await toPptx({slides: [{title: 'A'}, {title: 'B'}]}, {as: 'images', scale: 0.5, slideRasterizer: (presentation, slide, size) => { seen.push([slide, size.scale]); return new Uint8Array(pngs[slide - 1]); }});
  assert.deepEqual(seen, [[1, 0.5], [2, 0.5]]);
  assert.equal(Object.keys(unzipSync(bytes)).filter(path => path.startsWith('ppt/media/')).length, 2);
  await assert.rejects(toPptx({slides: [{}]}, {as: 'images', slideRasterizer: () => new Uint8Array([1, 2, 3])}), error => error.code === 'slide-render-failed');
  await assert.rejects(toPptx({slides: [{}]}, {as: 'pictures'}), error => error.code === 'invalid-as-option');
  await assert.rejects(toPptx({slides: [{}]}, {scale: 2}), error => error.code === 'invalid-scale-option', 'scale is for pictures only');
  checks++;
}

console.log(`Picture slide checks passed (${checks}): one full-bleed PNG per slide with notes, hidden flag, section and alt text.`);
