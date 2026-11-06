// LH-160 and LH-161 in the preview: a histogram of many bins draws the bin count core decided (so every bin label stands beside its
// neighbors, edges rounded to the bin width) and drops data labels that would overlap; a pie's last slice is moved off the first.
import assert from 'node:assert/strict';
import { composeSlide, histogramBins, scottBinCount } from '@openpresentation/opf/composition';
import { toSvg } from './catalog-harness.mjs';

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const entries = (svg) => [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(([, a, body]) => ({ ...attributesOf(a), body: body.replace(/<[^>]*>/g, '') }));
const deck = (slide) => ({ language: 'en', design: { fontScheme: 'roboto', colorScheme: 'cool-horizon', variant: 'light1' }, slides: [slide] });
const draw = (chart) => toSvg(deck({ title: 'Chart', chart }), 1);
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };

let seed = 5;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const rows = Array.from({ length: 30000 }, () => [Math.round(20000 + 60000 * (rand() + rand() + rand() - 1.5))]);
const histogram = (extra = {}) => ({ type: 'histogram', data: { columns: ['Salary'], rows }, ...extra });
const binLabels = (svg) => entries(svg).map((entry) => entry.body).filter((text) => /^[\[(].*\]$/.test(text));

// 1. The preview draws core's bin count, not Scott's, when Scott's would not leave room for the labels; every bin keeps its label.
{
  const scott = scottBinCount(rows.map((row) => row[0]));
  const layer = composeSlide({ title: 'Chart', chart: histogram() }, { width: 1280, height: 720 }).items.find((item) => item.field === 'chart').chart.layer.histogram;
  check(layer.bins < scott, `core caps the bins (${layer.bins} of ${scott})`);
  const labels = binLabels(draw(histogram()));
  check(labels.length === layer.bins, `every one of the ${layer.bins} bins keeps its label (${labels.length})`);
  const expected = histogramBins(rows.map((row) => row[0]), { count: layer.bins, decimals: layer.decimals }).map((bin) => bin.label);
  check(JSON.stringify(labels.slice().sort()) === JSON.stringify(expected.slice().sort()), 'the labels are the edges rounded to core decimals');
  check(labels.every((label) => !/\.\d{3,}/.test(label)), `no label carries a long fraction (${labels[0]})`);
}

// 2. Data labels that do not fit beside each other are dropped, and kept where they fit.
{
  const labeled = binLabels(draw(histogram({ dataLabels: { content: ['value'] } })));
  const many = entries(draw(histogram({ dataLabels: { content: ['value'] } }))).filter((entry) => /^[\d,]+$/.test(entry.body) && Number(entry['font-size']) > 0);
  const ticks = entries(draw(histogram())).filter((entry) => /^[\d,]+$/.test(entry.body));
  check(labeled.length > 0, 'the bin labels stay');
  check(many.length === ticks.length, `no per-bar value label past what fits (${many.length} numbers, ${ticks.length} ticks)`);
  const few = Array.from({ length: 60 }, (_, index) => [20 + (index % 30)]);
  const kept = entries(draw({ type: 'histogram', dataLabels: { content: ['value'] }, data: { columns: ['Minutes'], rows: few } })).filter((entry) => /^\d+$/.test(entry.body));
  check(kept.length > 5, `a few wide bars keep their counts (${kept.length})`);
}

// 3. A pie's last slice is moved off the first (its color is the slice palette's, not the series color) on a scheme where they read alike.
{
  const fills = (count) => {
    const data = { columns: ['Segment', 'Revenue'], rows: Array.from({ length: count }, (_, index) => [`S${index + 1}`, 50 - index * 4]) };
    const svg = toSvg({ language: 'en', design: { colorScheme: 'forest-green', variant: 'light1' }, slides: [{ title: 'Pie', chart: { type: 'pie', data } }] }, 1);
    return [...svg.matchAll(/<path\b[^>]*\bfill="(#[0-9A-Fa-f]{6})"/g)].map((match, index) => [index, match[1]]);
  };
  const four = fills(4), five = fills(5);
  check(four.length === 4 && five.length === 5, `a path per slice (${four.length}, ${five.length})`);
  check(four.slice(0, 3).every(([index, fill], at) => fill === five[at][1] && index === at), 'every slice but the last keeps the palette color');
  check(four[3][1] !== five[3][1], `the fourth slice differs as the last of four (${four[3][1]}) and as a middle slice of five (${five[3][1]})`);
}

console.log(`lh-160-chart-labels render: ${checks} checks`);
