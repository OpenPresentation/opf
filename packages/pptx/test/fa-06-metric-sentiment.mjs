import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {toSvg} from '@openpresentation/opf-render';
import {colorContrast, metricTrendColor} from '@openpresentation/opf/composition';
import {fromPptx, toPptx} from '../dist/index.js';
import {colorsInXml, themeColorsOf, clrMapOf} from './helpers/scheme-colors.mjs';

// FA-06: metric.sentiment says whether a change is good news. The export draws the native arrow in the trend's
// direction and colours the arrow, the trend word and the delta text by the sentiment, the same colour the preview
// draws, and import restores the sentiment (it is carried in the OPF_METRIC_V1 provenance tag with the metric source).
const decoder = new TextDecoder();
const decode = text => text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&amp;', '&');
// RR-96: the sentiment colours are literals (semantic green and red), the neutral is the scheme's muted text role (a:schemeClr tx2) and the
// value follows the deck accent; `colorOf` resolves a fragment's first colour through the exported theme and the clrMap (the master's, with the
// slide's override over it) to {hex, role}, `role` being the schemeClr name and undefined for a literal.
const slideParts = async (deck, options = {}) => {
  const entries = unzipSync(await toPptx(deck, {seed: 1, ...options}));
  const xml = decoder.decode(entries['ppt/slides/slide1.xml']);
  return {xml, theme: themeColorsOf(strFromU8(entries['ppt/theme/theme1.xml'])), map: {...clrMapOf(strFromU8(entries['ppt/slideMasters/slideMaster1.xml'])), ...clrMapOf(xml)}};
};
const slideXml = async (deck, options = {}) => (await slideParts(deck, options)).xml;
const colorOf = (fragment, {theme, map}) => fragment && colorsInXml(fragment, theme, map)[0];
const shapes = ({xml, theme, map}) => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => ({
  xml: shape,
  name: shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1] ?? '',
  descr: shape.match(/<p:cNvPr\b[^>]*\bdescr="([^"]*)"/)?.[1],
  geometry: shape.match(/<a:prstGeom prst="(\w+)"/)?.[1],
  fillColor: colorOf(shape.match(/<p:spPr>([\s\S]*?)(?:<a:ln\b|<\/p:spPr>)/)?.[1].match(/<a:solidFill>[\s\S]*?<\/a:solidFill>/)?.[0], {theme, map}),
  runs: [...shape.matchAll(/<a:r>[\s\S]*?<\/a:r>/g)].map(([run]) => [decode(run.match(/<a:t>([\s\S]*?)<\/a:t>/)?.[1] ?? ''), colorOf(run.match(/<a:rPr\b[^>]*>[\s\S]*?<a:solidFill>[\s\S]*?<\/a:solidFill>/)?.[0].match(/<a:solidFill>[\s\S]*?<\/a:solidFill>/)[0], {theme, map})]),
}));
const svgArrows = svg => [...svg.matchAll(/<g aria-label="([^"]*)" role="img"><polygon fill="#([0-9A-F]{6})" points="([^"]*)"\/><\/g>/g)];
const GEOMETRY = {up: 'upArrow', down: 'downArrow', flat: 'rightArrow'};
const DEFAULT = {up: 'positive', down: 'negative', flat: 'neutral'};
// The colours the export draws without a sentiment: up green, down red, flat the neutral. The neutral is the muted text role of the deck
// (RR-96: tx2, which opf-render passes to core's metricTrendColor as `neutral`), here dk2 of the default theme on the white deck and lt2 on the
// dark one; it was the fixed 475569 / CBD5E1 slate before.
const BEFORE = {up: {'#FFFFFF': '15803D', '#0F172A': '4ADE80'}, down: {'#FFFFFF': 'B91C1C', '#0F172A': 'F87171'}, flat: {'#FFFFFF': '011842', '#0F172A': 'F0F0F0'}};
const MUTED = BEFORE.flat;
const COLORS = {positive: BEFORE.up, negative: BEFORE.down, neutral: BEFORE.flat};
const designs = [{colorScheme: 'cool-horizon', background: '#FFFFFF'}, {background: '#0F172A', colorScheme: {light1: '#F8FAFC', dark1: '#0F172A', accent1: '#38BDF8'}}];
const deckOf = (metric, design = designs[0], align = 'left') => ({design: {fontScheme: 'roboto', contentAlignment: align, ...design}, slides: [{metric}]});
const fieldColor = (parts, role) => shapes(parts).find(item => new RegExp(`^OPF metric \\d+ ${role} line 1$`).test(item.name)).runs[0][1];

let checked = 0;
for (const trend of ['up', 'down', 'flat']) for (const align of ['left', 'center', 'right']) for (const design of designs) {
  const background = design.background, base = {value: 42, unit: 'ms', label: 'Latency', description: 'Median', delta: '-3%', trend};
  const absent = await slideParts(deckOf(base, design, align)), absentXml = absent.xml;
  const [absentArrow] = shapes(absent).filter(shape => / trend mark$/.test(shape.name));
  assert.equal(absentArrow.fillColor.hex, BEFORE[trend][background], `${trend}/${align}: the colour exported without a sentiment`);
  // An explicit sentiment equal to the trend's default is the absent one: the same slide XML.
  assert.equal(await slideXml(deckOf({...base, sentiment: DEFAULT[trend]}, design, align)), absentXml, `${trend}/${align}: the default sentiment changes nothing`);
  for (const sentiment of ['positive', 'negative', 'neutral']) {
    const deck = deckOf({...base, sentiment}, design, align), parts = await slideParts(deck), svg = toSvg(deck, 1, {trace: true});
    const native = shapes(parts).filter(shape => / trend mark$/.test(shape.name)), preview = svgArrows(svg);
    assert.equal(native.length, 1, `${trend}/${sentiment}: native arrow`);
    assert.equal(preview.length, 1, `${trend}/${sentiment}: preview arrow`);
    const [shape] = native, [, label, fill] = preview[0], id = `${trend}/${sentiment}/${align} on ${background}`;
    assert.equal(shape.geometry, GEOMETRY[trend], `${id}: the arrow keeps the direction of the trend`);
    assert.equal(shape.descr, `Trend: ${trend}`);
    assert.equal(label, `Trend: ${trend}`);
    const color = shape.fillColor.hex;
    assert.equal(color, COLORS[sentiment][background], id);
    // Core's colour for the sentiment; the neutral is the deck's muted text colour, which opf-render hands over as `neutral`.
    assert.equal(`#${color}`, metricTrendColor(trend, {background, sentiment, ...(sentiment === 'neutral' && {neutral: `#${MUTED[background]}`})}));
    // The semantic colours are literal; the neutral is the muted text role, a scheme colour.
    assert.equal(shape.fillColor.role, sentiment === 'neutral' ? 'tx2' : undefined, `${id}: ${sentiment === 'neutral' ? 'the neutral is the muted text role' : 'the semantic colour is a literal'}`);
    assert.equal(color, fill, `${id}: export and preview agree on the colour`);
    assert.ok(colorContrast(`#${color}`, background) >= 4.5, id);
    for (const role of ['trend', 'delta']) {
      assert.deepEqual(fieldColor(parts, role), shape.fillColor, `${id}: native ${role} text colour`);
      const text = svg.match(new RegExp(`<text\\b[^>]*data-opf-metric-role="${role}"[^>]*>`))[0];
      assert.equal(/\bfill="#([0-9A-F]{6})"/.exec(text)[1], color, `${id}: preview ${role} text colour`);
    }
    for (const role of ['value', 'label']) assert.deepEqual(fieldColor(parts, role), fieldColor(absent, role), `${id}: ${role} keeps its colour`);
    // Import restores the sentiment with the metric, and consumes the generated arrow.
    const imported = await fromPptx(await toPptx(deck, {seed: 1}));
    assert.deepEqual(imported.slides[0].metric, deck.slides[0].metric, `${id}: the sentiment survives export and import`);
    checked++;
  }
  const absentImport = await fromPptx(await toPptx(deckOf(base, design, align), {seed: 1}));
  assert.deepEqual(absentImport.slides[0].metric, base, `${trend}/${align}: absent sentiment stays absent after import`);
}

// Falling churn that is good news: a downward arrow in green.
{
  const metric = {value: 3.1, unit: '%', label: 'Churn', delta: '-0.6 pts', trend: 'down', sentiment: 'positive'};
  const [shape] = shapes(await slideParts(deckOf(metric))).filter(item => / trend mark$/.test(item.name));
  assert.equal(shape.geometry, 'downArrow');
  assert.deepEqual(shape.fillColor, {hex: '15803D', role: undefined});
  assert.deepEqual((await fromPptx(await toPptx(deckOf(metric), {seed: 1}))).slides[0].metric, metric);
}
// Without a trend sentiment draws nothing and colours nothing; it still survives the round trip.
{
  const plain = {value: 42, label: 'Latency', delta: '-3%'}, stated = {...plain, sentiment: 'positive'};
  assert.equal(await slideXml(deckOf(stated)), await slideXml(deckOf(plain)));
  assert.ok(!shapes(await slideParts(deckOf(stated))).some(shape => / trend mark$/.test(shape.name)));
  assert.deepEqual((await fromPptx(await toPptx(deckOf(stated), {seed: 1}))).slides[0].metric, stated);
}
console.log(`FA-06 metric sentiment: ${checked} trend/sentiment/alignment/background combinations exported with the trend's native arrow in the sentiment's colour, matching the preview, and restored on import.`);
