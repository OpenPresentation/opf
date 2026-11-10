// FA-11: TimelineEvent.status in the SVG preview. Absent status is byte-identical to the plain marker; done, current
// and planned are drawn from the deck's colors and agree with core's timelineMarkerShapes / timelineTextColor.
import assert from 'node:assert/strict';
import { colorContrast, LANGUAGES, timelineMarkerShapes, timelineStatusWordsFor, timelineTextColor } from '@openpresentation/opf/composition';
import { resolvePresentation, toSvg } from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)
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

// No status: unchanged markers and no status attributes.
const plain = toSvg(deckOf([]), 1, options);
assert.ok(!plain.includes('status'));
assert.equal(circles(plain).length, 3);
for (const circle of circles(plain)) assert.deepEqual(Object.keys(circle).sort(), ['aria-hidden', 'cx', 'cy', 'data-opf-path', 'fill', 'r']); // FA-30: the marker is decorative
// LH-121: localized words can change marker placement. Preserve the exact
// marker/drawing control only in a valid explicit language with no vocabulary.
const unsupportedLanguage = 'af';
assert.ok(LANGUAGES.some(language => language.tag === unsupportedLanguage), 'control is a supported language');
assert.equal(timelineStatusWordsFor(unsupportedLanguage), undefined, 'control must have no generated status words');
const withoutVocabulary = deck => ({ ...deck, language: unsupportedLanguage }), lines = svg => svg.replace(/<line\b[^>]*\/>\n?/g, '');
const done = toSvg(withoutVocabulary(deckOf(['done', 'done', 'done'])), 1, options);
assert.ok(!done.includes('data-opf-timeline-role="status"'));
assert.deepEqual(circles(done).map(({ 'data-opf-timeline-status': s, 'data-opf-timeline-shape': h, ...rest }) => rest), circles(toSvg(withoutVocabulary(deckOf([])), 1, options)));
assert.equal(lines(toSvg(withoutVocabulary(deckOf(['done', 'done', 'done'])), 1, { fonts: { textMeasurement: fonts.textMeasurement } })), lines(toSvg(withoutVocabulary(deckOf([])), 1, { fonts: { textMeasurement: fonts.textMeasurement } })));
const visibleText = svg => [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(match => match[1].replace(/<[^>]*>/g, ''));
const germanWords = ['Abgeschlossen', 'Aktuell', 'Geplant'];
assert.deepEqual(timelineStatusWordsFor('de-DE'), Object.fromEntries(['done', 'current', 'planned'].map((status, index) => [status, germanWords[index]])));

// All three states.
for (const language of ['en-US', 'de-DE']) for (const design of [{}, { theme: 'classic', variant: 'dark1' }]) {
  const deck = { ...deckOf(['done', 'current', 'planned'], design), language }, svg = toSvg(deck, 1, options);
  const bound = resolvePresentation(deck, options).slides[0];
  const layout = bound.geometry.items.find(item => item.field === 'timeline').timelineLayout;
  const colors = { background: bound.design.backgroundColor ?? bound.design.colors.background, primary: bound.design.colors.primary, text: bound.design.colors.text, mutedText: bound.design.colors.mutedText };
  if (language === 'de-DE') {
    assert.deepEqual(layout.statusLabels.map(label => label.text), germanWords);
    const visible = visibleText(svg).join(' ');
    for (const word of germanWords) assert.ok(visible.includes(word), 'visible German status ' + word);
    for (const word of ['Done', 'Current', 'Planned']) assert.ok(!visible.includes(word), 'no visible English status ' + word);
    for (const label of layout.statusLabels) {
      const drawn = textFill(svg, label.path.replace(/\.status$/, ''));
      assert.equal(drawn.fill, timelineTextColor(label, colors), label.path + ' localized status color');
    }
  }
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
  // Ordinary event labels compose at 600; the current label composes at 700.
  assert.deepEqual([d.weight, c.weight, p.weight].map(Number), [600, 700, 600]);
  assert.equal(textFill(svg, 'slides.0.timeline.2.when').fill, p.fill);
}
console.log('Timeline status passed: the no-vocabulary control remains byte-identical; English/German words, colors and all marker geometry match their own light/dark layouts.');
