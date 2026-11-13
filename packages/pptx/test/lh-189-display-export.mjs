// LH-188, LH-189: the PPTX export writes a one-message slide's statement, quote and figure at core's size, line pitch and tracking: each
// display line is a native text box one em below the last, every run carries `spc` (DISPLAY_TRACKING of its size, in hundredths of a
// point), an attribution set in capitals the eyebrow's; and the document comes back the same from PowerPoint's file.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {resolveSlideContext} from '@openpresentation/opf';
import {composeSlide, DISPLAY_LINE_PITCH, DISPLAY_TRACKING, displayFrom, EYEBROW_TRACKING} from '@openpresentation/opf/composition';
import {fromPptx, toPptx} from '../dist/index.js';

const deck = {
  $schema: 'https://openpresentation.org/schema/opf/v1', name: 'LH-189',
  slides: [
    {text: 'Teams that own their calendar ship twice as often.'},
    {quote: {text: 'Less, but better.', attribution: 'DIETER RAMS'}},
    {title: 'Runway', metric: {value: '18 mo', label: 'Cash on hand'}},
  ],
};
const bytes = await toPptx(deck, {catalogs: [gallery]});
const entries = unzipSync(new Uint8Array(bytes));
const slideXml = index => strFromU8(entries[`ppt/slides/slide${index + 1}.xml`]);
const EMU = 9525;
// The native text boxes whose name starts with `prefix`: their top (px), run size (px) and spacing (hundredths of a point).
const boxes = (xml, prefix) => [...xml.matchAll(/<p:sp>((?:(?!<\/p:sp>)[\s\S])*?)<\/p:sp>/g)].map(([, shape]) => shape)
  .filter(shape => new RegExp(`name="${prefix}`).test(shape))
  .map(shape => ({y: Number(/<a:off x="-?\d+" y="(-?\d+)"/.exec(shape)[1]) / EMU, size: Number(/<a:rPr[^>]*\bsz="(\d+)"/.exec(shape)[1]) / 75, spc: Number(/<a:rPr[^>]*\bspc="(-?\d+)"/.exec(shape)?.[1] ?? 0), text: [...shape.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join('')}));
const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
const spcOf = (tracking, size) => Math.round(tracking * size * .75 * 100);

// The statement: core's lines, one em apart, each with the display tracking.
const message = composeSlide(deck.slides[0], resolveSlideContext(deck, 0, {catalogs: [gallery]}).options).items.find(item => item.field === 'text');
const statement = boxes(slideXml(0), 'OPF text slides.0.text line');
assert.equal(statement.length, message.text.lines.length, 'one native box per measured line');
assert.ok(message.text.fontSize >= displayFrom(1));
for (const [index, line] of statement.entries()) {
  near(line.size, message.text.fontSize, 0.01, 'the run size is core\'s');
  assert.equal(line.spc, spcOf(DISPLAY_TRACKING, message.text.fontSize), 'spc is the display tracking');
  if (index) near(line.y - statement[index - 1].y, message.text.fontSize * DISPLAY_LINE_PITCH, 0.01, 'the line pitch is one em');
}

// The quote: its body tracked at display size, the attribution in capitals at the eyebrow's tracking.
const quote = boxes(slideXml(1), 'OPF quote');
const body = quote.filter(line => line.size >= displayFrom(1)), footer = quote.find(line => line.text.includes('DIETER'));
assert.ok(body.length >= 1, 'the quote body is display text');
for (const line of body) assert.equal(line.spc, spcOf(DISPLAY_TRACKING, line.size));
assert.equal(footer.spc, spcOf(EYEBROW_TRACKING, footer.size));

// The figure: past today's 232 px cap, tracked.
const figure = boxes(slideXml(2), 'OPF metric 1 value line');
assert.equal(figure.length, 1);
assert.ok(figure[0].size > 232 && figure[0].size <= 252, `the figure's size (${figure[0].size})`);
assert.equal(figure[0].spc, spcOf(DISPLAY_TRACKING, figure[0].size));

// The round trip returns the same document: the tracking is drawing, not content.
const back = await fromPptx(bytes);
assert.deepEqual(back.slides.map(slide => ({title: slide.title, text: slide.text ?? slide.blocks?.[0]?.text, quote: slide.quote ?? slide.blocks?.[0]?.quote, metric: slide.metric ?? slide.blocks?.[0]?.metric})),
  deck.slides.map(slide => ({title: slide.title, text: slide.text, quote: slide.quote, metric: slide.metric})));
console.log('LH-188, LH-189: the export writes display text at core\'s size, one em pitch and spc, and imports back unchanged.');
