// FA-30: the preview exposes slide content to assistive technology. The slide root is a labelled container (not an image, which
// would make every text node inside presentational), the slide's text stays reachable in painted order, purely decorative drawing is
// aria-hidden, real pictures and charts keep role="img" with their alt, and the deck element's wrapper strips the root's
// labelling so a slide is announced once. Attribute-level here; test/preview-a11y-browser.mjs reads the browser's accessibility tree.
// Tables are checked for reachable cell text only: the table's own name is FA-27 (opf-render#166).
import assert from 'node:assert/strict';
import { toSvg } from './catalog-harness.mjs';
import { parseXml, isElement, textContent } from '../dist/pdf-xml.js';
import { prepareSlideSvg } from '../dist/deck-runtime.js';
import { previewA11yDeck } from './preview-a11y-fixture.mjs';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const deck = (slide, design = {}) => ({ design: { fontScheme: 'roboto', ...design }, slides: [slide] });

// A node is reachable when no ancestor is aria-hidden or role="img" (an image makes its subtree presentational).
const elements = (node, out = []) => { if (isElement(node)) { out.push(node); for (const child of node.children) elements(child, out); } return out; };
const ancestry = (node) => { const chain = []; for (let up = node.parent; up; up = up.parent) chain.push(up); return chain; };
const hiddenOrImage = (node) => node.attrs['aria-hidden'] === 'true' || node.attrs.role === 'img';
const reachable = (node) => !hiddenOrImage(node) && !ancestry(node).some(hiddenOrImage);
const textsOf = (svg) => elements(parseXml(svg)).filter((node) => node.name === 'text');

const svg = toSvg(previewA11yDeck(), 1);
const root = parseXml(svg);
const all = elements(root);

// 1. The root is one labelled container named by the slide title.
assert.equal(root.attrs.role, 'group');
assert.equal(root.attrs['aria-roledescription'], 'slide');
assert.equal(root.attrs['aria-label'], 'Quarterly review');
assert.equal(all.filter((node) => node.attrs['aria-roledescription']).length, 1, 'exactly one slide container');
// A title with runs names the slide by its plain text.
assert.equal(parseXml(toSvg(deck({ title: ['Bold ', { text: 'title', bold: true }] }), 1)).attrs['aria-label'], 'Bold title');

// 2. Text is reachable: no role="img" or aria-hidden ancestor above any of the slide's words.
const texts = textsOf(svg);
for (const word of ['Draft', 'Quarterly review', 'Sales Q2', 'Body paragraph', 'First point', 'Second point', 'memorable', 'Ada', '42%', 'Growth', 'Col A', 'Col B', 'cell x', 'cell y', 'An inline note', 'Header text', 'Footer text']) {
  const found = texts.filter((node) => textContent(node).includes(word));
  assert.ok(found.length, `${word} is drawn`);
  assert.ok(found.some(reachable), `${word} is reachable, not under role=img or aria-hidden`);
}
// The only drawn text a reader skips is a list marker (aria-hidden) and the chart's own marks (inside its role=img group).
const skipped = texts.filter((node) => !reachable(node));
for (const node of skipped) assert.ok(node.attrs['aria-hidden'] === 'true' || ancestry(node).some((up) => up.attrs.role === 'img' && up.attrs['aria-label'] === 'North leads'), `unexpected unreachable text ${textContent(node)}`);
assert.ok(skipped.some((node) => textContent(node) === '•'), 'the bullet marker is hidden');
// Painted order is reading order: tag, title, subtitle, body, list, quote, metric, then footnotes, header and footer.
const order = ['Draft', 'Quarterly review', 'Sales Q2', 'Body paragraph', 'First point', 'memorable', '42%', 'An inline note', 'Header text', 'Footer text'];
const at = order.map((word) => texts.findIndex((node) => textContent(node).includes(word)));
assert.deepEqual([...at].sort((a, b) => a - b), at, `painted order is reading order (${at})`);

// 3. Decorative drawing is hidden: the background, table cell fills and borders, the footnote rule, and an alt="" picture.
const background = root.children.find(isElement);
assert.equal(background.name, 'rect');
assert.equal(background.attrs['aria-hidden'], 'true', 'the slide background is hidden');
const shapes = all.filter((node) => ['rect', 'line', 'path', 'polygon'].includes(node.name) && node.attrs.role !== 'img');
const outside = shapes.filter((node) => !ancestry(node).some((up) => up.attrs.role === 'img'));
assert.ok(outside.length >= 6, 'the background, cell fills and the footnote rule are drawn');
for (const node of outside) assert.ok(node.attrs['aria-hidden'] === 'true' || ancestry(node).some((up) => up.attrs['aria-hidden'] === 'true'), `a ${node.name} outside any image is hidden`);

// 4. Pictures: alt names the picture; alt="" hides it with no role and no empty label.
const images = all.filter((node) => node.name === 'image');
assert.equal(images.length, 2);
assert.deepEqual([images[0].attrs.role, images[0].attrs['aria-label'], images[0].attrs['aria-hidden']], ['img', 'A harbour', undefined]);
assert.deepEqual([images[1].attrs.role, images[1].attrs['aria-label'], images[1].attrs['aria-hidden']], [undefined, undefined, 'true']);

// 5. A chart with alt is a labelled image group (FA-09); the trend arrow keeps its core label.
const labelled = all.filter((node) => node.attrs.role === 'img' && node.name !== 'image');
assert.deepEqual(labelled.map((node) => node.attrs['aria-label']).sort(), ['North leads', 'Trend: up']);
// Every role="img" element has a non-empty name.
for (const node of all.filter((node) => node.attrs.role === 'img')) assert.ok(node.attrs['aria-label'], `${node.name} role=img is named`);

// 6. Background images: with alt the picture is a labelled image over a hidden canvas; without alt, or with alt "", all hidden.
const backgrounds = [
  [{ type: 'image', src: png, alt: 'Harbour at dusk', overlay: { color: '#000000', opacity: 0.4 } }, 'Harbour at dusk'],
  [{ type: 'image', src: png, overlay: { color: '#000000', opacity: 0.4 } }, undefined],
  [{ type: 'image', src: png, alt: '' }, undefined]
];
for (const [background, label] of backgrounds) {
  const tree = elements(parseXml(toSvg(deck({ title: 'Over the photo', text: 'Copy', design: { background } }), 1)));
  const picture = tree.find((node) => node.name === 'image');
  assert.equal(picture.attrs.role, label ? 'img' : undefined);
  assert.equal(picture.attrs['aria-label'], label);
  assert.equal(picture.attrs['aria-hidden'], label ? undefined : 'true');
  const canvas = tree.filter((node) => node.name === 'rect' || node.name === 'path');
  assert.ok(canvas.length >= 1);
  for (const node of canvas) assert.equal(node.attrs['aria-hidden'], 'true', `the background ${node.name} is hidden`);
  const copy = tree.filter((node) => node.name === 'text' && textContent(node).includes('Copy'));
  assert.ok(copy.length && copy.every(reachable), 'text over a background image is reachable');
}

// 7. Furniture pictures (a header or footer logo repeated on every slide) are hidden unless the author gave them alt.
for (const [image, hidden] of [[{ src: png }, true], [{ src: png, alt: 'Acme logo' }, false]]) {
  const picture = elements(parseXml(toSvg(deck({ title: 'T' }, { header: { right: { image } } }), 1))).find((node) => node.name === 'image');
  assert.equal(picture.attrs['aria-hidden'], hidden ? 'true' : undefined, JSON.stringify(image));
  assert.equal(picture.attrs.role, hidden ? undefined : 'img');
}

// 8. A watermark is decorative.
const watermark = elements(parseXml(toSvg(deck({ title: 'T' }, { watermark: { text: 'DRAFT', opacity: 0.1 } }), 1))).find((node) => node.name === 'text' && textContent(node) === 'DRAFT');
assert.ok(watermark && !reachable(watermark), 'the watermark text is hidden');

// A picture watermark is hidden too (its group keeps only the opacity: opf-pptx's watermark parity test reads that).
const watermarkPicture = elements(parseXml(toSvg(deck({ title: 'T' }, { watermark: { src: png, opacity: 0.1 } }), 1))).find((node) => node.name === 'image');
assert.deepEqual([watermarkPicture.attrs['aria-hidden'], watermarkPicture.attrs.role, watermarkPicture.parent.attrs['aria-hidden']], ['true', undefined, undefined]);

// 9. The wrapper (the deck element, the player, toHtml) removes the root's labelling, so the slide section or figure around
// it is the one slide container; hidden parts stay hidden.
const preparedRoot = parseXml(prepareSlideSvg(svg));
assert.deepEqual(['role', 'aria-roledescription', 'aria-label', 'width', 'height'].map((name) => preparedRoot.attrs[name]), [undefined, undefined, undefined, undefined, undefined]);
assert.equal(elements(preparedRoot).filter((node) => node.attrs['aria-hidden'] === 'true').length, all.filter((node) => node.attrs['aria-hidden'] === 'true').length);

console.log('preview-a11y: slide container, reachable text, hidden decoration, pictures and charts, wrapper checks passed.');
