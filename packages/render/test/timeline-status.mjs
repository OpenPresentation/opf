// FA-11: TimelineEvent.status in the SVG preview. Absent status is byte-identical to the plain marker; done, current
// and planned are drawn from the deck's colors and agree with core's timelineMarkerShapes / timelineTextColor.
import assert from 'node:assert/strict';
import { colorContrast, timelineMarkerShapes, timelineTextColor } from '@openpresentation/opf/composition';
import { resolvePresentation, renderSlideSvg } from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)
import { loadFonts } from '../dist/fonts-node.js';

const fonts = await loadFonts({ pack: 'base' });
const options = { trace: true, fonts: { textMeasurement: fonts.textMeasurement } };
const events = [{ when: 'Q1', what: 'Discovery' }, { when: 'Q2', what: 'Pilot' }, { when: 'Q3', what: 'Rollout' }];
const deckOf = (statuses, design = {}) => ({ design: { fontScheme: 'roboto', ...design }, slides: [{ title: 'Roadmap', timeline: events.map((event, i) => (statuses[i] ? { ...event, status: statuses[i] } : event)) }] });
const circles = svg => [...svg.matchAll(/<circle\b([^>]*)\/>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]])));
const textFill = (svg, path) => {
  const match = svg.match(/<text\b[^>]*>/g).find(tag => tag.includes('data-opf-path="' + path + '"'));
  assert.ok(match, path);
  return { fill: /fill="([^"]+)"/.exec(match)?.[1], weight: /font-weight="([^"]+)"/.exec(match)?.[1] };
};

// No status: unchanged markers, no status attributes, same bytes as an explicit "done" except the marker status trace.
const plain = renderSlideSvg(deckOf([]), 0, options);
assert.ok(!plain.includes('status'));
assert.equal(circles(plain).length, 3);
for (const circle of circles(plain)) assert.deepEqual(Object.keys(circle).sort(), ['cx', 'cy', 'data-opf-path', 'fill', 'r']);
const done = renderSlideSvg(deckOf(['done', 'done', 'done']), 0, options);
assert.deepEqual(circles(done).map(({ 'data-opf-timeline-status': s, 'data-opf-timeline-shape': h, ...rest }) => rest), circles(plain));
assert.equal(renderSlideSvg(deckOf(['done', 'done', 'done']), 0, { fonts: { textMeasurement: fonts.textMeasurement } }), renderSlideSvg(deckOf([]), 0, { fonts: { textMeasurement: fonts.textMeasurement } }));

// All three states.
for (const design of [{}, { theme: 'dark' }]) {
  const deck = deckOf(['done', 'current', 'planned'], design), svg = renderSlideSvg(deck, 0, options);
  const bound = resolvePresentation(deck, options).slides[0];
  const layout = bound.geometry.items.find(item => item.field === 'timeline').timelineLayout;
  const colors = { background: bound.design.backgroundColor ?? bound.design.colors.background, primary: bound.design.colors.primary, text: bound.design.colors.text, mutedText: bound.design.colors.mutedText };
  const drawn = circles(svg);
  const expected = layout.markers.flatMap(marker => timelineMarkerShapes(marker, colors));
  assert.equal(drawn.length, expected.length);
  assert.equal(drawn.length, 4, 'done, ring + current dot, planned');
  drawn.forEach((circle, index) => {
    const shape = expected[index];
    assert.equal(Number(circle.cx), shape.cx); assert.equal(Number(circle.cy), shape.cy); assert.equal(Number(circle.r), shape.radius);
    assert.equal(circle.fill, shape.fill ?? 'none');
    assert.equal(circle.stroke, shape.stroke?.color); assert.equal(circle['stroke-width'], shape.stroke ? String(shape.stroke.width) : undefined);
  });
  assert.deepEqual(drawn.map(circle => circle['data-opf-timeline-shape']), ['marker', 'ring', 'marker', 'marker']);
  assert.deepEqual(drawn.map(circle => circle['data-opf-timeline-status']), ['done', 'current', 'current', 'planned']);
  // Done: filled; current: filled dot inside a ring; planned: outline over the background, no solid primary fill.
  assert.equal(drawn[0].fill, colors.primary); assert.equal(drawn[0].stroke, undefined);
  assert.ok(Number(drawn[1].r) > Number(drawn[2].r)); assert.equal(drawn[2].fill, colors.primary);
  assert.equal(drawn[3].fill, colors.background); assert.ok(drawn[3].stroke);
  // Text: normal for done and current, muted (>= 4.5:1) for planned; the current label is bold.
  const [d, c, p] = [0, 1, 2].map(i => textFill(svg, `slides.0.timeline.${i}.what`));
  assert.equal(d.fill, colors.text); assert.equal(c.fill, colors.text);
  assert.equal(p.fill, timelineTextColor({ status: 'planned' }, colors));
  assert.ok(colorContrast(p.fill, colors.background) >= 4.5);
  assert.ok(Number(c.weight) >= 600 && Number(d.weight) < 600, `weights ${d.weight} ${c.weight}`);
  assert.equal(textFill(svg, 'slides.0.timeline.2.when').fill, p.fill);
}
console.log('Timeline status passed: plain markers are byte-identical, and done, current and planned match core in light and dark themes.');
