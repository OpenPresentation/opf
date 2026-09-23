import assert from 'node:assert/strict';
import {renderSvg, resolvePresentation} from '../dist/svg.js';

// Core composition resolves one alignment per composed item. The preview must
// anchor text to it, because PPTX export reads the same value. This test runs
// against the coordinated core (CI links the pinned core source), so every
// composed item must carry item.alignment.
const anchors = {left: 'start', center: 'middle', right: 'end'};
const attribute = (attrs, name) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
const deck = {design: {fontScheme: 'roboto'}, slides: [
  {title: 'Centered cover', subtitle: 'Centered subtitle', design: {titleAlignment: 'center', contentAlignment: 'center'}},
  {title: 'Left title', text: 'Right aligned body', design: {titleAlignment: 'left', contentAlignment: 'right'}},
  {title: 'Default title', blocks: [{text: 'Centered copy'}, {text: 'Second copy'}], design: {contentAlignment: 'center'}},
  {title: 'Deck default', text: 'Deck body'},
]};
const deckDesign = {...deck, design: {...deck.design, titleAlignment: 'right', contentAlignment: 'center'}};
let checked = 0;
for (const input of [deck, deckDesign]) {
  const resolved = resolvePresentation(input);
  for (const bound of resolved.slides) {
    const svg = renderSvg(input, {slideIndex: bound.index, trace: true});
    const slide = input.slides[bound.index];
    for (const item of bound.geometry.items) {
      // Independent statement of the rule: the title follows titleAlignment only,
      // every other item follows contentAlignment; slide design wins over the deck.
      const design = {...input.design, ...slide.design};
      const rule = (item.field === 'title' ? design.titleAlignment : design.contentAlignment) ?? 'left';
      assert.equal(item.alignment, rule, `${item.path}: core item.alignment`);
      const text = [...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].find(([, attrs, body]) => body === item.value && attrs.includes(`data-opf-path="${item.path}"`));
      assert.ok(text, `${item.path}: traced preview text`);
      assert.equal(attribute(text[1], 'text-anchor'), anchors[item.alignment], `${item.path}: preview anchor`);
      checked++;
    }
  }
}
assert.equal(checked, 18);
assert.equal(resolvePresentation(deck).slides[2].geometry.items[0].alignment, 'left', 'Titles never inherit contentAlignment');

// Metric lines without tabs anchor at the accepted alignment edge, like the
// native PPTX metric paragraphs; left metrics and tabbed lines keep their origins.
let metricLines = 0, tabbedAligned = 0;
for (const align of ['left', 'center', 'right']) {
  const metricDeck = {design: {fontScheme: 'roboto', contentAlignment: align}, slides: [{title: 'KPI', blocks: [{metric: {value: '$48B', label: 'TAM'}}, {metric: {value: 42, label: 'Left\tRight'}}]}]};
  const bound = resolvePresentation(metricDeck).slides[0], svg = renderSvg(metricDeck, {trace: true});
  const factor = {left: 0, center: .5, right: 1}[align];
  for (const item of bound.geometry.items.filter(entry => entry.field === 'metric')) {
    assert.equal(item.alignment, align);
    assert.equal(item.metricLayout.alignment, item.alignment, `${item.path}: metric layout follows item.alignment`);
    for (const part of item.metricLayout.parts.filter(entry => entry.visible)) {
      const texts = [...svg.matchAll(/<text\b([^>]*)>/g)].map(match => match[1]).filter(attrs => attribute(attrs, 'data-opf-path') === part.path && attribute(attrs, 'data-opf-metric-role') === part.role);
      assert.equal(texts.length, part.fit.sourceLines.length, part.path);
      part.fit.sourceLines.forEach((line, index) => {
        const tabbed = line.segments.some(segment => segment.kind === 'tab'), edge = factor > 0 && !tabbed;
        assert.equal(attribute(texts[index], 'text-anchor'), edge ? anchors[align] : 'start', `${part.path} line ${index}`);
        assert.ok(Math.abs(Number(attribute(texts[index], 'x')) - (part.linePositions[index].x + (edge ? line.width * factor : 0))) < .002, `${part.path} line ${index} x`);
        metricLines++; if (tabbed && factor) tabbedAligned++;
      });
    }
  }
}
assert.ok(metricLines >= 12);
assert.ok(tabbedAligned >= 2, "tabbed centered/right lines keep their accepted origins");

// Content cards belong to their item: traced previews attribute the card to the item path.
const carded = renderSvg({design: {contentBox: true}, slides: [{title: 'Cards', blocks: [{text: 'One'}, {text: 'Two'}]}]}, {trace: true});
for (const path of ['slides.0.blocks.0.text', 'slides.0.blocks.1.text']) assert.match(carded, new RegExp(`<rect\\b[^>]*data-opf-path="${path.replace(/\./g, '\\.')}"[^>]*rx=`), `${path}: traced card`);
assert.ok(!renderSvg({design: {contentBox: true}, slides: [{text: 'Untraced'}]}).includes('data-opf-path'), 'Untraced output stays unchanged');

console.log(`Item alignment passed: ${checked} preview anchors follow core item.alignment; ${metricLines} metric lines anchor at their alignment edge; traced content cards carry their item path.`);
