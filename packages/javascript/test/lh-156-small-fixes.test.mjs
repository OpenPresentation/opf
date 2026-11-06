// LH-157 (a row of metrics shares one value size, an inline unit included), LH-38 (header and footer sit half a content margin from the slide
// edge) and LH-74 (a picture alone on a card fills the card, clipped to its radius, with no inset and no stroke).
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CARD_RADIUS, composeSlide, layoutFurniture } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const metricSizes = (result, role) => result.items.filter((item) => item.metricLayout).map((item) => item.metricLayout.parts.find((part) => part.role === role && part.visible)?.fit.fontSize).filter((size) => size !== undefined);

describe('LH-157: metrics with an inline unit share the value size of their row', () => {
  // The corpus slide batch-09 s12: metrics (two with an inline unit) among paragraphs, in the gallery's metrics layout.
  const slide = {
    layout: 'metrics',
    title: 'Execution Timeline',
    blocks: [
      { metric: { value: 31, unit: '%', delta: '+6 pts', trend: 'up', label: 'Illustrative result' } },
      { text: 'Lumina Foods should focus the next cycle on prepare supplier data collection for annual climate reporting while making the operating tradeoffs clear to sustainability stakeholders.' },
      { metric: { value: 52, label: 'Trial participants', description: 'Target: 50 participants' } },
      { text: 'Mosaic Strategy should focus the next cycle on guide leaders from issue framing to committed next steps while making the operating tradeoffs clear to workshop stakeholders.' },
      { metric: { value: '31%', label: 'Primary signal', description: 'Frame tradeoffs for a pending legislative decision', trend: 'up' } },
      { text: 'Run a six-week pilot with two teams before expanding. The pilot gives us a baseline, weekly feedback and one clear decision at the end.' },
      { metric: { value: '6.2', unit: 'min', label: 'Median task time', description: 'Down from 9.4 min' } },
      { text: 'Document-local catalog records can be referenced by id from the same OPF document.' },
      { metric: { value: '91%', label: 'Primary signal', description: 'Coordinate evacuation roles before fire season', trend: 'down' } },
    ],
  };
  const compose = (own = slide) => {
    const deck = { slides: [own] }, context = resolveSlideContext(deck, 0, { catalogs: [gallery] });
    return composeSlide(context.slide, context.options);
  };
  test('every value, label and description of the row is at one size', () => {
    const result = compose();
    const arrangements = result.items.filter((item) => item.metricLayout).map((item) => item.metricLayout.arrangement);
    assert.ok(arrangements.includes('inline-unit') && arrangements.includes('stacked'), `a metric keeps its unit beside its value: ${arrangements}`);
    for (const role of ['value', 'label', 'description']) assert.equal(new Set(metricSizes(result, role).map((size) => Math.round(size * 100))).size, 1, `one ${role} size: ${metricSizes(result, role)}`);
    assert.equal(result.diagnostics.filter((entry) => entry.code === 'text-overflow').length, 0);
  });
  test('the shared size is the smallest any sibling fitted: no sibling is above it', () => {
    const [value] = new Set(metricSizes(compose(), 'value'));
    // The metric with an inline unit alone fits larger, so the row's size is the stacked metrics' (no sibling is shrunk below it).
    const alone = compose({ ...slide, blocks: slide.blocks.filter((block) => block.metric?.unit === 'min') });
    assert.ok(metricSizes(alone, 'value')[0] >= value - 1e-9);
  });
});

describe('LH-38: header and footer sit half a content margin from the slide edge', () => {
  const presentation = { design: { header: { left: { text: 'Quarterly review' } }, footer: { left: { text: 'Confidential' }, right: { text: '{{slide.number}}' } } } };
  const edges = (width, height, composition) => {
    const layout = layoutFurniture({ composition }, { width, height, presentation });
    const header = layout.parts.filter((part) => part.kind === 'header'), footer = layout.parts.filter((part) => part.kind === 'footer');
    return { top: Math.min(...header.map((part) => part.box.y)), bottom: height - Math.max(...footer.map((part) => part.box.y + part.box.height)), layout };
  };
  test('at the default padding the header and the footer are 28.8 px from the top and the bottom of a 1280 x 720 slide', () => {
    const { top, bottom } = edges(1280, 720);
    assert.ok(Math.abs(top - 28.8) < 1e-6, `top ${top}`);
    assert.ok(Math.abs(bottom - 28.8) < 1e-6, `bottom ${bottom}`);
  });
  test('the distance is half the content margin whatever the padding and the canvas', () => {
    for (const [width, height, padding] of [[1280, 720, .05], [1280, 720, .12], [720, 1280, .08], [2560, 1440, .08]]) {
      const { top, bottom } = edges(width, height, { padding }), half = padding * Math.min(width, height) / 2;
      assert.ok(Math.abs(top - half) < 1e-6 && Math.abs(bottom - half) < 1e-6, `${width}x${height} at ${padding}: ${top}, ${bottom} against ${half}`);
    }
  });
  test('the zones stay on the content inset sideways, and the body still clears the header', () => {
    const { layout } = edges(1280, 720);
    assert.equal(Math.min(...layout.parts.map((part) => part.box.x)), 57.6);
    const result = composeSlide({ title: 'A title', text: 'Body' }, { width: 1280, height: 720, presentation });
    assert.ok(result.items.every((item) => item.box.y >= result.furniture.headerBottom - 1e-6));
    assert.deepEqual(result.diagnostics.filter((entry) => entry.code === 'text-overflow'), []);
  });
});

describe('LH-74: a picture alone on a card fills the card', () => {
  const picture = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#789"/></svg>');
  const gallerySlide = (extra = {}) => ({ title: 'Signal Trend', blocks: [1, 2, 3, 4, 5].map(() => ({ image: picture, alt: 'Placeholder', ...extra })) });
  // The gallery's team layout draws its blocks on cards on a dark slide.
  const compose = (slide) => {
    const deck = { design: { background: 'dark2' }, slides: [{ layout: 'team', ...slide }] }, context = resolveSlideContext(deck, 0, { catalogs: [gallery] });
    return composeSlide(context.slide, context.options);
  };
  test('the picture is the card: its box is the card, rounded to the card radius, with no card and no line', () => {
    const result = compose(gallerySlide());
    const images = result.items.filter((item) => item.field === 'image');
    assert.equal(images.length, 5);
    for (const item of images) {
      assert.equal(item.image.fit, 'cover');
      assert.equal(item.frameBox, undefined, 'no card is drawn under the picture');
      assert.deepEqual(item.image.box, item.image.region);
      assert.equal(item.image.shape.kind, 'rounded');
      const side = Math.min(item.box.width, item.box.height), radius = side * item.image.shape.adjust.adj / 100000;
      assert.ok(Math.abs(radius - CARD_RADIUS) < .01, `radius ${radius}`);
      assert.equal(item.image.stroke, undefined);
    }
  });
  test('a picture with a frame of its own, or shown whole, keeps the card and its inset', () => {
    for (const extra of [{ shape: 'ellipse' }, { adjust: { adj: .1 } }, { aspectRatio: 1 }, { stroke: { color: 'primary', width: 2 } }, { fit: 'contain' }]) {
      const items = compose(gallerySlide(extra)).items.filter((item) => item.field === 'image');
      for (const item of items) assert.ok(item.frameBox !== undefined && item.box.width < item.frameBox.width - 1, `${JSON.stringify(extra)} keeps its card inset`);
    }
  });
});
