// LH-188, LH-189: the PPTX export writes a one-message slide's statement, quote and figure at core's size, line pitch and tracking: each
// display line is a native text box at core's line position (one em apart where core took the display pitch, 1.22 em otherwise), a tracked
// run carries `spc` (DISPLAY_TRACKING of its size, in hundredths of a point), an attribution set in capitals the eyebrow's; and the document
// comes back the same from PowerPoint's file.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {resolveSlideContext} from '@openpresentation/opf';
import {composeSlide, displayFrom, DISPLAY_TRACKING, EYEBROW_TRACKING} from '@openpresentation/opf/composition';
import {fromPptx, toPptx} from '../dist/index.js';

const deck = {
  $schema: 'https://openpresentation.org/schema/opf/v1', name: 'LH-189',
  slides: [
    {text: 'Ship in March.'},
    {text: 'Teams that own their calendar ship twice as often.'},
    {text: 'Ship the new ledger in March.', composition: {padding: 0.2}},
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

// Each statement: core's lines at core's pitch, with core's tracking.
for (const index of [0, 1, 2]) {
  const message = composeSlide(deck.slides[index], resolveSlideContext(deck, index, {catalogs: [gallery]}).options).items.find(item => item.field === 'text');
  const lines = boxes(slideXml(index), `OPF text slides.${index}.text line`);
  assert.equal(lines.length, message.text.lines.length, `slide ${index}: one native box per measured line`);
  assert.ok(message.text.fontSize >= displayFrom(1));
  for (const [line, box] of lines.entries()) {
    near(box.size, message.text.fontSize, 0.01, `slide ${index}: the run size is core's`);
    assert.equal(box.spc, message.textStyle.tracking ? spcOf(message.textStyle.tracking, message.text.fontSize) : 0, `slide ${index}: spc is core's tracking`);
    if (line) near(box.y - lines[line - 1].y, message.text.lineHeight, 0.01, `slide ${index}: the line pitch is core's`);
  }
}

// The quote: its body tracked at display size, the attribution in capitals at the eyebrow's tracking.
const quote = boxes(slideXml(3), 'OPF quote');
const body = quote.filter(line => line.size >= displayFrom(1)), footer = quote.find(line => line.text.includes('DIETER'));
assert.ok(body.length >= 1, 'the quote body is display text');
for (const line of body) assert.equal(line.spc, spcOf(DISPLAY_TRACKING, line.size));
assert.equal(footer.spc, spcOf(EYEBROW_TRACKING, footer.size));

// The figure: past today's 232 px cap, tracked.
const figure = boxes(slideXml(4), 'OPF metric 1 value line');
assert.equal(figure.length, 1);
assert.ok(figure[0].size > 232 && figure[0].size <= 252, `the figure's size (${figure[0].size})`);
assert.equal(figure[0].spc, spcOf(DISPLAY_TRACKING, figure[0].size));

// The round trip returns the same document: pitch and tracking are drawing, not content.
const back = await fromPptx(bytes);
assert.deepEqual(back.slides.map(slide => ({title: slide.title, text: slide.text ?? slide.blocks?.[0]?.text, quote: slide.quote ?? slide.blocks?.[0]?.quote, metric: slide.metric ?? slide.blocks?.[0]?.metric})),
  deck.slides.map(slide => ({title: slide.title, text: slide.text, quote: slide.quote, metric: slide.metric})));
// A title keeps core's display tracking in every title tier (RR-105): one line (its measured line, bound), soft wrap (one natively wrapped
// box, bound; an untracked two-line title) and, for a two-line display title one em apart (LH-189's tight pitch), its measured lines as
// separate boxes: single spacing is 1.2 em in PowerPoint and a fixed line cannot take a negative space before, so that title is not the Title
// placeholder today (a decision pending with the supervisor). Both body-text modes; every title imports back.
const titles = {
  $schema: 'https://openpresentation.org/schema/opf/v1', name: 'LH-189 titles', design: {dimensions: {preset: '4:3'}},
  slides: [
    {title: 'Ship in March'},
    {title: 'Ledger migration plan for the next fiscal year'},
    {title: 'Ledger migration plan for next year', composition: {padding: 0.2}},
  ],
};
const tiers = [{lines: 1, shapes: 1, bound: true, tracked: true}, {lines: 2, shapes: 1, bound: true, tracked: false}, {lines: 2, shapes: 2, bound: false, tracked: true}];
for (const bodyText of ['measured', 'native']) {
  const titleBytes = await toPptx(titles, {catalogs: [gallery], bodyText}), titleEntries = unzipSync(new Uint8Array(titleBytes));
  for (const [index, tier] of tiers.entries()) {
    const title = composeSlide(titles.slides[index], resolveSlideContext(titles, index, {catalogs: [gallery]}).options).items.find(item => item.field === 'title');
    assert.equal(title.text.lines.length, tier.lines, `title ${index}: lines`);
    assert.equal(title.textStyle.tracking, tier.tracked ? DISPLAY_TRACKING : undefined, `title ${index}: core's tracking`);
    const xml = strFromU8(titleEntries[`ppt/slides/slide${index + 1}.xml`]);
    const shapes = [...xml.matchAll(/<p:sp>((?:(?!<\/p:sp>)[\s\S])*?)<\/p:sp>/g)].map(([, shape]) => shape).filter(shape => /name="OPF heading slides\.\d+\.title/.test(shape));
    assert.equal(shapes.length, tier.shapes, `${bodyText} title ${index}: its tier`);
    assert.equal(/<p:ph type="title"/.test(shapes[0]), tier.bound, `${bodyText} title ${index}: the Title placeholder`);
    for (const shape of shapes) {
      const runs = [...shape.matchAll(/<a:r><a:rPr([^>]*)>/g)].map(([, attributes]) => Number(/\bspc="(-?\d+)"/.exec(attributes)?.[1] ?? 0));
      assert.ok(runs.length > 0);
      for (const spc of runs) assert.equal(spc, tier.tracked ? spcOf(DISPLAY_TRACKING, title.text.fontSize) : 0, `${bodyText} title ${index}: spc`);
    }
  }
  assert.deepEqual((await fromPptx(titleBytes)).slides.map(slide => slide.title), titles.slides.map(slide => slide.title), `${bodyText}: the titles import back`);
}
console.log('LH-188, LH-189: the export writes display text at core\'s size, pitch and spc, keeps a title\'s tracking in every tier, and imports back unchanged.');
