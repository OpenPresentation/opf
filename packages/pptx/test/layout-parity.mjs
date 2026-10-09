import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toSvg} from '@openpresentation/opf-render';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {composeSlide} from '@openpresentation/opf/composition';
import {toPptx} from '../dist/index.js';

// Layout designs set title/content alignment. The native text must use the
// same alignment the preview draws, with and without host text measurement.
const decoder = new TextDecoder();
const slideXml = async (deck, options = {}) => {
  const entries = unzipSync(await toPptx(deck, {seed: 1, ...options}));
  return deck.slides.map((_, index) => decoder.decode(entries[`ppt/slides/slide${index + 1}.xml`]));
};
const shapes = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => ({
  name: shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1] ?? '',
  text: [...shape.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join(''),
  align: [...shape.matchAll(/<a:pPr\b[^>]*\balgn="(\w+)"/g)].map(match => match[1]),
  fill: shape.match(/<p:spPr>[\s\S]*?<a:solidFill><a:srgbClr val="([0-9A-F]{6})"/)?.[1],
  geometry: shape.match(/<a:prstGeom prst="(\w+)"/)?.[1],
  rotation: shape.match(/<a:xfrm\b[^>]*\brot="(\d+)"/)?.[1],
}));
const alignmentOf = (xml, text) => {
  const found = shapes(xml).filter(shape => shape.text === text);
  assert.ok(found.length, `Native text is missing: ${text}`);
  return [...new Set(found.flatMap(shape => shape.align))];
};
const previewAnchor = (svg, text) => {
  const escaped = text.replace(/&/g, '&amp;');
  const match = [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].find(([, , body]) => body.replace(/<[^>]+>/g, '') === escaped);
  assert.ok(match, `Preview text is missing: ${text}`);
  return match[1].match(/text-anchor="(\w+)"/)?.[1] ?? 'start';
};
const nativeAlign = {start: 'l', middle: 'ctr', end: 'r'};

const deck = {design: {fontScheme: 'roboto'}, slides: [
  {title: 'Centered cover', subtitle: 'Centered subtitle', design: {titleAlignment: 'center', contentAlignment: 'center'}},
  {title: 'Left title', text: 'Right aligned body', design: {titleAlignment: 'left', contentAlignment: 'right'}},
  // Content alignment never applies to the title.
  {title: 'Default title', blocks: [{text: 'Centered supporting copy'}, {text: 'Second centered block'}], design: {contentAlignment: 'center'}},
]};
const expected = [
  [['Centered cover', 'ctr'], ['Centered subtitle', 'ctr']],
  [['Left title', 'l'], ['Right aligned body', 'r']],
  [['Default title', 'l'], ['Centered supporting copy', 'ctr'], ['Second centered block', 'ctr']],
];
let checked = 0;
const fonts = await loadFonts({pack: 'office', fallbackFamily: 'Roboto', strictGlyphs: false});
for (const options of [{}, {fonts}]) {
  const native = await slideXml(deck, options), preview = toSvg(deck, options);
  for (const [index, pairs] of expected.entries()) for (const [text, align] of pairs) {
    assert.deepEqual(alignmentOf(native[index], text), [align], `${text}: native alignment`);
    // Estimated previews anchor at the alignment edge; measured previews anchor
    // each accepted line the same way, so the anchor names the alignment.
    assert.equal(nativeAlign[previewAnchor(preview[index], text)], align, `${text}: preview alignment`);
    checked++;
  }
}

// Every native paragraph follows core's per-item alignment (the coordinated core
// resolves item.alignment; CI links the pinned core source).
for (const [index, slide] of deck.slides.entries()) {
  const items = composeSlide(slide, {presentation: deck, slideIndex: index}).items;
  assert.ok(items.length && items.every(item => ['left', 'center', 'right'].includes(item.alignment)), 'core resolves item.alignment');
  for (const [text, align] of expected[index]) assert.equal({left: 'l', center: 'ctr', right: 'r'}[items.find(item => item.value === text).alignment], align, `${text}: core item.alignment`);
}

// Metric lines: native paragraphs and preview anchors both follow the metric's
// resolved alignment (gallery number-* layouts center their metrics).
let metricLines = 0;
for (const align of ['left', 'center', 'right']) {
  const metricDeck = {design: {fontScheme: 'roboto', contentAlignment: align}, slides: [{title: 'KPI', blocks: [{metric: {value: '$48B', label: 'TAM'}}, {metric: {value: '$6B', label: 'SAM', description: 'Serviceable market'}}]}]};
  for (const options of [{}, {fonts}]) {
    const [xml] = await slideXml(metricDeck, options), [svg] = toSvg(metricDeck, options);
    for (const text of ['$48B', 'TAM', '$6B', 'SAM', 'Serviceable market']) {
      assert.deepEqual(alignmentOf(xml, text), [{left: 'l', center: 'ctr', right: 'r'}[align]], `${text}: native metric alignment (${align})`);
      assert.equal(previewAnchor(svg, text), {left: 'start', center: 'middle', right: 'end'}[align], `${text}: preview metric anchor (${align})`);
      metricLines++;
    }
  }
}
assert.equal(metricLines, 30);

// A cover has no content region: tag, title and subtitle are one heading group, so a deck that aligns
// title and content differently writes the same `algn` for all three (the "Compliance Readiness
// Review" cover wrote a left title over a centered tag and subtitle). Only the slide's own
// contentAlignment keeps them apart, and slides with body content keep the title/content split.
const coverText = {tag: 'Compliance', title: 'Compliance Readiness Review', subtitle: 'Tandem BioSystems Compliance'};
const coverDeck = {design: {fontScheme: 'roboto', titleAlignment: 'left', contentAlignment: 'center'}, slides: [
  {layout: 'title-subtitle', ...coverText},
  {layout: 'title-subtitle', ...coverText, design: {contentAlignment: 'right'}},
  {...coverText, text: 'Body copy'},
]};
const coverExpected = [['l', 'l', 'l'], ['r', 'l', 'r'], ['ctr', 'l', 'ctr']];
let coverChecks = 0;
for (const options of [{}, {fonts}]) {
  const native = await slideXml(coverDeck, options), preview = toSvg(coverDeck, options);
  for (const [index, aligns] of coverExpected.entries()) for (const [position, field] of ['tag', 'title', 'subtitle'].entries()) {
    const text = coverText[field];
    assert.deepEqual(alignmentOf(native[index], text), [aligns[position]], `slide ${index} ${field}: native alignment`);
    assert.equal(nativeAlign[previewAnchor(preview[index], text)], aligns[position], `slide ${index} ${field}: preview alignment`);
    coverChecks++;
  }
}
assert.equal(coverChecks, 18);

// Media placeholders draw the same surface, play badge and caption as the preview.
const media = {design: {fontScheme: 'roboto'}, slides: [{title: 'Media', video: {src: 'https://example.com/video.mp4', description: 'Walkthrough'}}]};
const [mediaXml] = await slideXml(media), [mediaSvg] = toSvg(media);
const mediaShapes = shapes(mediaXml);
const frame = mediaShapes.find(shape => shape.name === 'OPF media slides.0.video frame');
const badge = mediaShapes.find(shape => shape.name === 'OPF media slides.0.video badge');
const play = mediaShapes.find(shape => shape.name === 'OPF media slides.0.video play');
assert.ok(frame && badge && play, 'Media placeholder shapes');
assert.equal(badge.geometry, 'ellipse');
assert.equal(play.geometry, 'triangle');
assert.equal(play.rotation, String(90 * 60000));
assert.equal(play.fill, 'FFFFFF');
for (const shape of [frame, badge]) assert.ok(mediaSvg.includes(`fill="#${shape.fill}"`), `Preview uses media fill ${shape.fill}`);
assert.deepEqual(alignmentOf(mediaXml, 'https://example.com/video.mp4'), ['ctr']);
assert.ok(!mediaXml.includes('&quot;src&quot;'), 'Media export must not print the payload as JSON');

console.log(`Layout parity passed: ${checked} heading/body alignments, ${coverChecks} cover heading alignments and ${metricLines} metric lines match the preview with estimated and measured text; media placeholders match the preview surface, badge and caption.`);
