import assert from 'node:assert/strict';
import {resolvePresentation, renderSlideSvg} from '../dist/svg.js';

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
    const svg = renderSlideSvg(input, bound.index, {trace: true});
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

// A cover has no content region: its tag, title and subtitle are one heading group, so a deck that
// aligns title and content differently draws all three at the title's alignment (the "Compliance
// Readiness Review" cover drew a left title over a centered tag and subtitle). Only the slide's own
// contentAlignment keeps them apart, and slides with body content keep the title/content split.
const coverText = {tag: 'Compliance', title: 'Compliance Readiness Review', subtitle: 'Tandem BioSystems Compliance'};
const coverDeck = {design: {fontScheme: 'roboto', titleAlignment: 'left', contentAlignment: 'center'}, slides: [
  {layout: 'title-subtitle', ...coverText},
  {layout: 'title-subtitle', ...coverText, design: {contentAlignment: 'right'}},
  {...coverText, text: 'Body copy'},
]};
const coverAnchors = index => {
  const svg = renderSlideSvg(coverDeck, index, {trace: true});
  return ['tag', 'title', 'subtitle'].map(field => {
    const text = [...svg.matchAll(/<text\b([^>]*)>/g)].map(match => match[1]).find(attrs => attrs.includes(`data-opf-path="slides.${index}.${field}"`));
    assert.ok(text, `slide ${index}: ${field} drawn`);
    return attribute(text, 'text-anchor') ?? 'start';
  });
};
const coverSlides = resolvePresentation(coverDeck).slides;
assert.deepEqual(coverSlides[0].geometry.items.map(item => item.alignment), ['left', 'left', 'left']);
assert.deepEqual(coverAnchors(0), ['start', 'start', 'start'], 'cover heading group shares the title alignment in the preview');
assert.deepEqual(coverSlides[1].geometry.items.map(item => item.alignment), ['right', 'left', 'right']);
assert.deepEqual(coverAnchors(1), ['end', 'start', 'end'], 'slide contentAlignment keeps an explicit split');
assert.deepEqual(coverSlides[2].geometry.items.slice(0, 3).map(item => item.alignment), ['center', 'left', 'center']);
assert.deepEqual(coverAnchors(2), ['middle', 'start', 'middle'], 'slides with body content keep contentAlignment for tag and subtitle');

// Metric lines without tabs anchor at the accepted alignment edge, like the
// native PPTX metric paragraphs; left metrics and tabbed lines keep their origins.
let metricLines = 0, tabbedAligned = 0;
for (const align of ['left', 'center', 'right']) {
  const metricDeck = {design: {fontScheme: 'roboto', contentAlignment: align}, slides: [{title: 'KPI', blocks: [{metric: {value: '$48B', label: 'TAM'}}, {metric: {value: 42, label: 'Left\tRight'}}]}]};
  const bound = resolvePresentation(metricDeck).slides[0], svg = renderSlideSvg(metricDeck, 0, {trace: true});
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
const carded = renderSlideSvg({design: {contentBox: true}, slides: [{title: 'Cards', blocks: [{text: 'One'}, {text: 'Two'}]}]}, 0, {trace: true});
for (const path of ['slides.0.blocks.0.text', 'slides.0.blocks.1.text']) assert.match(carded, new RegExp(`<rect\\b[^>]*data-opf-path="${path.replace(/\./g, '\\.')}"[^>]*rx=`), `${path}: traced card`);
assert.ok(!renderSlideSvg({design: {contentBox: true}, slides: [{text: 'Untraced'}]}, 0).includes('data-opf-path'), 'Untraced output stays unchanged');

console.log(`Item alignment passed: ${checked} preview anchors follow core item.alignment; ${metricLines} metric lines anchor at their alignment edge; traced content cards carry their item path.`);
