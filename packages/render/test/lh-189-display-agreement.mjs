// LH-188, LH-189: the preview draws a one-message slide's statement, quote and figure at core's size, line pitch and tracking. A display
// text of one line is tracked (DISPLAY_TRACKING of its size) at the body pitch; one of two lines keeps the body pitch and no tracking unless
// the one em pitch (DISPLAY_LINE_PITCH) bought it a larger size, where it takes both; an attribution set in capitals takes the eyebrow's tracking.
import assert from 'node:assert/strict';
import { gallery } from '@openpresentation/gallery';
import { resolveSlideContext } from '@openpresentation/opf';
import { BODY_LINE_PITCH, composeSlide, DISPLAY_LINE_PITCH, DISPLAY_TRACKING, displayFrom, EYEBROW_TRACKING } from '@openpresentation/opf/composition';
import { toSvg } from '../dist/index.js';

const deck = {
  $schema: 'https://openpresentation.org/schema/opf/v1', name: 'LH-189',
  slides: [
    { text: 'Ship in March.' },
    { text: 'Teams that own their calendar ship twice as often.' },
    { text: 'Ship the new ledger in March.', composition: { padding: 0.2 } },
    { quote: { text: 'Less, but better.', attribution: 'DIETER RAMS' } },
    { title: 'Runway', metric: { value: '18 mo', label: 'Cash on hand' } },
  ],
};
const decode = (text) => text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const texts = (svg) => [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(([, attributes, content]) => ({
  size: Number(/font-size="([\d.]+)"/.exec(attributes)?.[1]), y: Number(/\by="([-\d.]+)"/.exec(attributes)?.[1]),
  spacing: Number(/letter-spacing="([-\d.]+)"/.exec(attributes)?.[1] ?? 0), text: decode(content),
})).filter((entry) => Number.isFinite(entry.size));
const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
const svgs = toSvg(deck, { trace: true, catalogs: [gallery] });
const largest = (index) => { const all = texts(svgs[index]); return all.filter((entry) => entry.size === Math.max(...all.map((text) => text.size))); };

// Each statement as core composed it: size, line pitch and tracking.
for (const [index, expected] of [[0, { lines: 1, pitch: BODY_LINE_PITCH, tracking: DISPLAY_TRACKING }], [1, { lines: 2, pitch: BODY_LINE_PITCH, tracking: undefined }], [2, { lines: 2, pitch: DISPLAY_LINE_PITCH, tracking: DISPLAY_TRACKING }]]) {
  const message = composeSlide(deck.slides[index], resolveSlideContext(deck, index, { catalogs: [gallery] }).options).items.find((item) => item.field === 'text');
  const lines = largest(index);
  assert.ok(lines[0].size >= displayFrom(1), `slide ${index}: display size (${lines[0].size})`);
  assert.equal(lines.length, expected.lines, `slide ${index}: lines`);
  near(message.text.fontSize, lines[0].size, 0.01, `slide ${index}: core composed the size the preview drew`);
  near(message.text.lineHeight, lines[0].size * expected.pitch, 0.01, `slide ${index}: core's pitch`);
  for (let line = 1; line < lines.length; line++) near(lines[line].y - lines[line - 1].y, lines[0].size * expected.pitch, 0.02, `slide ${index}: the preview's pitch`);
  assert.equal(message.textStyle.tracking, expected.tracking, `slide ${index}: core's tracking`);
  for (const line of lines) near(line.spacing, (expected.tracking ?? 0) * line.size, 0.01, `slide ${index}: the preview's letter spacing`);
}

// The quote: its one-line body at display size and tracked; the attribution in capitals with the eyebrow's tracking.
const quote = texts(svgs[3]), body = largest(3);
assert.ok(body[0].size >= displayFrom(1), `the quote body is display text (${body[0].size})`);
for (const line of body) near(line.spacing, DISPLAY_TRACKING * line.size, 0.01, 'the quote body is tracked');
const attribution = quote.find((entry) => entry.text.includes('DIETER'));
near(attribution.spacing, EYEBROW_TRACKING * attribution.size, 0.01, 'the attribution in capitals is tracked as an eyebrow');

// The figure: a one-message metric grows past today's 232 px cap toward 252 and is tracked.
const figure = texts(svgs[4]).find((entry) => entry.text.includes('18'));
assert.ok(figure.size > 232 && figure.size <= 252, `the figure's size (${figure.size})`);
near(figure.spacing, DISPLAY_TRACKING * figure.size, 0.01, 'the figure is tracked');
console.log('LH-188, LH-189: the preview draws display text at core\'s size, pitch and tracking.');
