import assert from 'node:assert/strict';
import { resolvePresentation, toSvg } from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)
import {colorContrast, metricTrendColor} from '@openpresentation/opf/composition';

// FA-06: metric.sentiment says whether a change is good news. The preview draws the arrow in the trend's
// direction and colours the arrow, the trend word and the delta text by the sentiment (core metricTrendMark).
const metricDeck = (metric, design = {}) => ({design: {fontScheme: 'roboto', ...design}, slides: [{metric}]});
const arrows = svg => [...svg.matchAll(/<g aria-label="([^"]*)" role="img"><polygon fill="(#[0-9A-F]{6})" points="([^"]*)"\/><\/g>/g)]
  .map(([, label, fill, points]) => ({label, fill, points}));
const textFill = (svg, role) => /\bfill="([^"]*)"/.exec(svg.match(new RegExp(`<text\\b[^>]*data-opf-metric-role="${role}"[^>]*>`))[0])[1];
// LH-137: a delta pill is the backdrop of the delta and its arrow, which are colored against its fill.
const backdropOf = (svg, background) => /fill="(#[0-9A-Fa-f]{6})"/.exec(/<rect\b[^>]*data-opf-metric-role="pill"[^>]*>/.exec(svg)?.[0] ?? '')?.[1] ?? background;
const DEFAULT = {up: 'positive', down: 'negative', flat: 'neutral'};
// The colours the preview drew before sentiment existed: up green, down red, flat neutral. RR-96: the neutral is the deck's scheme-derived
// trend neutral (tx2 of the slide's variant, core roles.neutrals.trendNeutral), so the fixed flat colours below are only the pre-RR-96 record.
const BEFORE = {up: {'#FFFFFF': '#15803D', '#0F172A': '#4ADE80'}, down: {'#FFFFFF': '#B91C1C', '#0F172A': '#F87171'}, flat: {'#FFFFFF': '#475569', '#0F172A': '#CBD5E1'}};
const designs = [{colorScheme: 'cool-horizon', background: '#FFFFFF'}, {background: '#0F172A', colorScheme: {light1: '#F8FAFC', dark1: '#0F172A', accent1: '#38BDF8'}}];

let checked = 0;
for (const trend of ['up', 'down', 'flat']) for (const design of designs) {
  const background = design.background;
  const neutral = resolvePresentation(metricDeck({value: 1, label: 'x', trend: 'flat'}, design)).slides[0].design.roles.neutrals.trendNeutral.hex.toUpperCase();
  const COLORS = {positive: BEFORE.up, negative: BEFORE.down, neutral: {[background]: neutral}};
  const absent = toSvg(metricDeck({value: 3.1, label: 'Churn', delta: '-0.6 pts', trend}, design), 1, {trace: true});
  const base = arrows(absent);
  assert.equal(base.length, 1, `${trend}: one arrow`);
  const backdrop = backdropOf(absent, background);
  assert.equal(base[0].fill, backdrop !== background ? metricTrendColor(trend, {background: backdrop, neutral}) : trend === 'flat' ? neutral : BEFORE[trend][background], `${trend} on ${background}: the color drawn before sentiment existed`);
  // An explicit sentiment equal to the trend's default is the absent one, byte for byte.
  assert.equal(toSvg(metricDeck({value: 3.1, label: 'Churn', delta: '-0.6 pts', trend, sentiment: DEFAULT[trend]}, design), 1, {trace: true}), absent, `${trend}: the default sentiment changes nothing`);
  for (const sentiment of ['positive', 'negative', 'neutral']) {
    const svg = toSvg(metricDeck({value: 3.1, label: 'Churn', delta: '-0.6 pts', trend, sentiment}, design), 1, {trace: true});
    const found = arrows(svg);
    assert.equal(found.length, 1, `${trend}/${sentiment}: one arrow`);
    assert.equal(found[0].label, `Trend: ${trend}`);
    assert.equal(found[0].points, base[0].points, `${trend}/${sentiment}: the arrow keeps the direction of the trend`);
    if (backdrop === background) assert.equal(found[0].fill, COLORS[sentiment][background], `${trend}/${sentiment} on ${background}`);
    assert.equal(found[0].fill, metricTrendColor(trend, {background: backdrop, sentiment, neutral}));
    assert.ok(colorContrast(found[0].fill, backdrop) >= 4.5, `${trend}/${sentiment} ${found[0].fill} on ${background}`);
    assert.equal(textFill(svg, 'delta'), found[0].fill, `${trend}/${sentiment} delta text color`);
    // LH-53: the trend word is not drawn; the arrow, whose text alternative it is, carries the direction.
    assert.ok(!svg.includes(`>${trend}</tspan>`) && !svg.includes('data-opf-metric-role="trend"'), 'the trend word is not drawn');
    // The other fields keep their colours.
    for (const role of ['value', 'label']) assert.equal(textFill(svg, role), textFill(absent, role), `${trend}/${sentiment} ${role} colour`);
    checked++;
  }
}
// Falling churn that is good news: a downward arrow in green.
{
  const svg = toSvg(metricDeck({value: 3.1, unit: '%', label: 'Churn', delta: '-0.6 pts', trend: 'down', sentiment: 'positive'}, designs[0]), 1, {trace: true});
  // LH-137: green kept at 4.5:1 on the delta's pill, a step darker than on white.
  assert.equal(arrows(svg)[0].fill, metricTrendColor('down', {background: backdropOf(svg, '#FFFFFF'), sentiment: 'positive'}));
  assert.equal(arrows(svg)[0].points, arrows(toSvg(metricDeck({value: 3.1, unit: '%', label: 'Churn', delta: '-0.6 pts', trend: 'down'}, designs[0]), 1, {trace: true}))[0].points);
}
// Without a trend sentiment draws nothing and colours nothing.
{
  const plain = toSvg(metricDeck({value: 42, label: 'Latency', delta: '-3%'}), 1, {trace: true});
  assert.equal(toSvg(metricDeck({value: 42, label: 'Latency', delta: '-3%', sentiment: 'positive'}), 1, {trace: true}), plain);
  assert.equal(arrows(plain).length, 0);
}
console.log(`FA-06 metric sentiment: ${checked} trend/sentiment/background combinations drawn with the trend's arrow and the sentiment's colour; default sentiment and absent sentiment are byte-identical.`);
