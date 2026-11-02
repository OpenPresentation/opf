import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { resolveSlideContext } from '../dist/index.js';
import { composeSlide } from '../dist/composition.js';
import { scenarioSpecs, embeddedDeckFor, loadCatalogs } from '../../../scripts/generate-example-suite.mjs';

const catalogs = await loadCatalogs();
test('generated Evidence Packs keep vertical charts readable beside intact notes', () => {
  let vertical = 0, horizontal = 0;
  for (const [index, spec] of scenarioSpecs.entries()) {
    const { deck } = embeddedDeckFor(spec, index, catalogs);
    const slideIndex = deck.slides.findIndex(slide => slide.title === 'Evidence Pack');
    if (slideIndex < 0) continue;
    const slide = deck.slides[slideIndex];
    assert.deepEqual(slide.blocks.map(block => Object.keys(block)[0]), ['chart', 'quote', 'metric']);
    const context = resolveSlideContext(deck, slideIndex, { catalogs: [gallery] });
    const geometry = composeSlide(slide, context.options);
    if (deck.design.contentDirection === 'horizontal') {
      horizontal++;
      assert.equal(slide.layout, 'dashboard', 'horizontal overview remains unchanged');
      continue;
    }
    vertical++;
    assert.equal(slide.layout, 'chart-beside');
    const chart = geometry.items.find(item => item.type === 'chart');
    const quote = geometry.items.find(item => item.type === 'quote');
    const metric = geometry.items.find(item => item.type === 'metric');
    assert.ok(chart && quote && metric, 'all authored content is composed');
    assert.equal(chart.region, 'chart');
    assert.equal(quote.region, 'notes');
    assert.equal(metric.region, 'notes');
    assert.ok(chart.box.height >= geometry.height * 0.5, 'chart occupies at least half the slide height');
    assert.ok(chart.box.width / chart.box.height < 2, 'chart is not a shallow strip');
    assert.ok(quote.box.x >= chart.box.x + chart.box.width, 'quote sits beside the chart');
    assert.ok(metric.box.y >= quote.box.y + quote.box.height, 'metric follows quote in the notes column');
    for (const item of [chart, quote, metric]) {
      assert.ok(item.box.x >= 0 && item.box.y >= 0 && item.box.x + item.box.width <= geometry.width + .01 && item.box.y + item.box.height <= geometry.height + .01, 'content stays in slide bounds');
    }
  }
  assert.equal(vertical, 20, 'all vertical Evidence Packs are covered');
  assert.equal(horizontal, 20, 'all horizontal Evidence Packs retain dashboard');
});
