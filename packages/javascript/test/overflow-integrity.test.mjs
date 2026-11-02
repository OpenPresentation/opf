import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide, layoutCode, layoutMetric, layoutQuote, OPFCompositionError } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

// LH-40 and LH-45 (layout harvest): overflow is measured and visible. A code, metric or quote part that finds no room is drawn at the
// readability floor with its finding instead of failing the export; strict composition still fails; nothing draws past its cell silently.
const compose = (slide, strict = false, recompose = true) => {
  const deck = { slides: [strict ? { ...slide, composition: { overflow: 'error' } } : slide] };
  const { slide: resolved, options } = resolveSlideContext(deck, 0, { catalogs: [gallery] });
  return composeSlide(resolved, recompose ? options : { ...options, recompose: false });
};
const lines = (count, name) => Array.from({ length: count }, (_, index) => `${name}(${index});`).join('\n');
const without = (layout) => JSON.parse(JSON.stringify(layout));

test('a code body with no room is laid out at the floor only when asked, with the same findings and bounds', () => {
  const value = { source: 'export const valid = result.errors.length === 0;', language: 'ts', filename: 'validator.ts' };
  const box = { x: 0, y: 0, width: 600, height: 90 };
  const plain = layoutCode(value, box), fallback = layoutCode(value, box, { floorFallback: true });
  assert.equal(plain.parts.find((part) => part.role === 'body').fit, undefined);
  assert.deepEqual(fallback.diagnostics, plain.diagnostics);
  assert.deepEqual(fallback.bounds, plain.bounds);
  assert.ok(plain.diagnostics.some((entry) => entry.reason === 'invalid-part-box' && entry.path === 'code.source'));
  const body = fallback.parts.find((part) => part.role === 'body');
  assert.equal(body.fit.fontSize, 16, 'the readability floor');
  assert.equal(body.fit.overflow, true);
  assert.equal(body.fit.lines.join(''), value.source, 'every character is laid out');
  assert.ok(body.box.y >= box.y && body.box.y <= box.y + box.height, 'drawn from inside its cell');
  assert.throws(() => layoutCode(value, box, { floorFallback: true, overflow: 'error' }), OPFCompositionError);
});

test('a quote and a metric with no room are laid out at the floor', () => {
  const quote = layoutQuote({ text: 'It just works.', attribution: 'Person' }, { x: 0, y: 0, width: 400, height: 50 }, { floorFallback: true });
  assert.ok(quote.diagnostics.some((entry) => entry.reason === 'invalid-part-box'));
  for (const part of quote.parts) assert.ok(part.fit, `${part.role} fit`);
  assert.equal(quote.parts.find((part) => part.role === 'body').fit.fontSize, 16);
  const value = { value: '42%', label: 'Review cycle reduction', description: 'Median reduction across customer review workflows.' };
  const box = { x: 0, y: 0, width: 300, height: 40 };
  const plain = layoutMetric(value, box), metric = layoutMetric(value, box, { floorFallback: true });
  assert.equal(plain.parts.find((part) => part.role === 'value').fit, undefined);
  assert.deepEqual(without(metric.diagnostics), without(plain.diagnostics));
  const primary = metric.parts.find((part) => part.role === 'value');
  assert.equal(primary.fit.fontSize, 16);
  assert.equal(primary.linePositions.length, primary.fit.sourceLines.length, 'engines get a position for every line');
});

// The code layout with five blocks of the LH-27 corpus (batch-13 s29): the middle panel's filename and language leave its body no room.
const fiveBlocks = {
  layout: 'code',
  title: 'Signal Trend',
  blocks: [
    { code: { source: lines(6, 'routeToSponsor'), language: 'ts', filename: 'video-demo-sales-narrative-rule.ts' } },
    { text: 'Prairie Ridge High School should focus the next cycle on secure funding for hands-on robotics and chemistry labs while making the operating tradeoffs clear to k-12 education stakeholders.' },
    { code: { source: 'export const valid = result.errors.length === 0;', language: 'ts', filename: 'validator.ts' } },
    { text: 'Keep the recommendation and its evidence together.' },
    { code: { source: lines(6, 'keepInWeeklyReview'), language: 'ts', filename: 'revenue-forecast-inspection-rule.ts' } },
  ],
};

test('the code layout with five blocks composes with its finding, and strict composition still fails', () => {
  // Wave 2: by default the slide is recomposed as the automatic grid (LH-83), three panels in a row above the two texts, with no
  // finding; the layout's own composition still draws the overfull middle panel with its finding.
  const recomposed = compose(fiveBlocks);
  assert.ok(recomposed.recomposed);
  assert.deepEqual(recomposed.diagnostics.filter((entry) => entry.code === 'text-overflow'), []);
  const result = compose(fiveBlocks, false, false);
  const finding = result.diagnostics.find((entry) => entry.path === 'slides.0.blocks.2.code.source');
  assert.ok(finding, 'the middle code body carries a finding');
  assert.equal(finding.code, 'text-overflow');
  for (const item of result.items.filter((entry) => entry.codeLayout)) {
    for (const part of item.codeLayout.parts) assert.ok(part.fit, `${part.path}: engines draw it`);
  }
  assert.throws(() => compose(fiveBlocks, true), (error) => error instanceof OPFCompositionError && error.diagnostics.some((entry) => entry.path === 'slides.0.blocks.2.code.source'));
});

// A scorecard of nine metrics (batch-11 s27): a metric that takes its whole card is laid out at its row's shared height, taller than
// its own card, and its trend reached past the card with no finding.
test('a metric that reaches past its card is reported', () => {
  const metric = (value, description, trend) => ({ metric: { value, label: 'Primary signal', description, trend } });
  const result = compose({
    layout: 'scorecard',
    title: 'Digital Services Modernization: next steps',
    blocks: [
      { metric: { value: '42%', label: 'Review cycle reduction', description: 'Median reduction across customer review workflows.', delta: '+11 pts', trend: 'up' } },
      metric('11 days', 'Prepare council to vote on mixed-income zoning changes', 'up'),
      metric('91%', 'Balance platform reliability work with customer-facing commitments', 'flat'),
      metric('11 days', 'Launch an integrated campaign around the new benchmark report', 'down'),
      metric('$820K', 'Approve controls for customer-facing predictive models', 'down'),
      metric('11 days', 'Show regional patterns with maps, charts, and concise interpretation', 'down'),
      metric('2.4x', 'Compare bus rapid transit options for the east corridor', 'flat'),
      metric('18%', 'Teach managers a repeatable coaching conversation model', 'flat'),
      metric('2.4x', 'Prepare a self-running lobby deck with concise navigation cues', 'up'),
    ],
  });
  for (const item of result.items.filter((entry) => entry.metricLayout)) {
    const cell = item.frameBox ?? item.box;
    for (const part of item.metricLayout.parts.filter((entry) => entry.visible)) {
      const outside = part.box.y + part.box.height > cell.y + cell.height + 0.01;
      if (outside) assert.ok(result.diagnostics.some((entry) => entry.code === 'text-overflow' && entry.path.startsWith(item.path)), `${part.path} is reported`);
    }
  }
  assert.ok(result.diagnostics.some((entry) => /extends outside its cell; give the block more space/.test(entry.message)), 'the scorecard carries the new finding');
});
