// LH-188, LH-189: the preview draws a one-message slide's statement, quote and figure at core's size, line pitch and tracking: a display
// line is one em below the last (DISPLAY_LINE_PITCH), its letter spacing is DISPLAY_TRACKING of its size, and an attribution set in
// capitals takes the eyebrow's tracking.
import assert from 'node:assert/strict';
import { gallery } from '@openpresentation/gallery';
import { resolveSlideContext } from '@openpresentation/opf';
import { composeSlide, DISPLAY_LINE_PITCH, DISPLAY_TRACKING, displayFrom, EYEBROW_TRACKING } from '@openpresentation/opf/composition';
import { toSvg } from '../dist/index.js';

const deck = {
  $schema: 'https://openpresentation.org/schema/opf/v1', name: 'LH-189',
  slides: [
    { text: 'Teams that own their calendar ship twice as often.' },
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

// The statement: two lines or more, one em apart, tracked, at core's size.
const geometry = composeSlide(deck.slides[0], resolveSlideContext(deck, 0, { catalogs: [gallery] }).options);
const message = geometry.items.find((item) => item.field === 'text');
const statement = texts(svgs[0]).filter((entry) => entry.size === Math.max(...texts(svgs[0]).map((text) => text.size)));
assert.ok(statement[0].size >= displayFrom(1), `display size (${statement[0].size})`);
assert.ok(statement.length >= 2, 'the statement takes two lines');
for (let index = 1; index < statement.length; index++) near(statement[index].y - statement[index - 1].y, statement[0].size * DISPLAY_LINE_PITCH, 0.02, 'the line pitch is one em');
for (const line of statement) near(line.spacing, DISPLAY_TRACKING * line.size, 0.01, 'the letter spacing is the display tracking');
assert.equal(message.textStyle.tracking, DISPLAY_TRACKING, 'core composed the style the preview drew');
near(message.text.fontSize, statement[0].size, 0.01, 'core composed the size the preview drew');
near(message.text.lineHeight, statement[0].size * DISPLAY_LINE_PITCH, 0.01, 'core composed the pitch the preview drew');

// The quote: its body at display size and tracked; the attribution in capitals with the eyebrow's tracking.
const quote = texts(svgs[1]), body = quote.filter((entry) => entry.size === Math.max(...quote.map((text) => text.size)));
assert.ok(body[0].size >= displayFrom(1), `the quote body is display text (${body[0].size})`);
for (const line of body) near(line.spacing, DISPLAY_TRACKING * line.size, 0.01, 'the quote body is tracked');
const attribution = quote.find((entry) => entry.text.includes('DIETER'));
near(attribution.spacing, EYEBROW_TRACKING * attribution.size, 0.01, 'the attribution in capitals is tracked as an eyebrow');

// The figure: a one-message metric grows past today's 232 px cap toward 252 and is tracked.
const figure = texts(svgs[2]).find((entry) => entry.text.includes('18'));
assert.ok(figure.size > 232 && figure.size <= 252, `the figure's size (${figure.size})`);
near(figure.spacing, DISPLAY_TRACKING * figure.size, 0.01, 'the figure is tracked');
console.log('LH-188, LH-189: the preview draws display text at core\'s size, one em pitch and tracking.');
