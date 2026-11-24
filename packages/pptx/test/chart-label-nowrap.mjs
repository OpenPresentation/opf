// opf#1415: data labels are written on one line (a:bodyPr wrap="none"), as the preview draws them; PowerPoint wrapped an end label
// such as "31 Self-serve" in a small chart. Asserts every text body inside a c:dLbls carries wrap="none" (value labels, end labels,
// slice names, a reference label with its own text), that axis titles and the legend keep their bodies, and that the labels import
// as before.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {toPptx, fromPptx} from '../dist/index.js';
import {noWrapDataLabels} from '../dist/chart-options.js';

const decoder = new TextDecoder();
const quarters = [['Q1', 42, 30, 18], ['Q2', 46, 33, 22], ['Q3', 51, 31, 27], ['Q4', 55, 36, 31]];
const deck = {design: {fontScheme: 'roboto'}, slides: [
  // End labels: the series names at the line ends ("31 Self-serve"), two charts side by side as on the coverage slide.
  {title: 'Cumulative bookings', blocks: [
    {chart: {type: 'stacked-line', data: {columns: ['Quarter', 'Enterprise', 'Mid-market', 'Self-serve'], rows: quarters}}},
    {chart: {type: 'stacked-line-with-markers', data: {columns: ['Quarter', 'Enterprise', 'Mid-market', 'Self-serve'], rows: quarters}}}]},
  // Value labels, axis titles, a legend and a native reference line with its label.
  {title: 'Values', chart: {type: 'column', data: {columns: ['Terminal', 'Wait', 'Queue'], rows: [['North', 42, 12], ['South', 28, 9]]}, legend: 'bottom',
    dataLabels: {content: ['category', 'value'], separator: ': ', position: 'inside-end'}, axisTitles: {category: 'Terminal', value: 'Minutes'},
    referenceLines: [{value: 30, label: 'Target 30 min'}]}},
  // Slice names on a pie (no legend).
  {title: 'Share', chart: {type: 'pie', data: {columns: ['Region', 'Share'], rows: [['EMEA', 40], ['APAC', 35], ['AMER', 25]]}}},
]};

const entries = unzipSync(await toPptx(deck));
const parts = Object.keys(entries).filter(name => /^ppt\/charts\/chart\d+\.xml$/.test(name)).sort();
assert.equal(parts.length, 4);
let labelBodies = 0;
for (const part of parts) {
  const xml = decoder.decode(entries[part]);
  assert.equal(XMLValidator.validate(xml), true, part);
  for (const [block] of xml.matchAll(/<c:dLbls>[\s\S]*?<\/c:dLbls>/g)) {
    for (const [body] of block.matchAll(/<a:bodyPr\b[^>]*>/g)) {
      assert.match(body, /\bwrap="none"/, `${part}: ${body}`);
      labelBodies++;
    }
  }
  // Outside the label sets (axis titles, tick labels, the legend) the bodies are as before.
  const outside = xml.replace(/<c:dLbls>[\s\S]*?<\/c:dLbls>/g, '');
  assert.ok(!/<a:bodyPr\b[^>]*wrap="none"/.test(outside), `${part}: only data labels change`);
}
assert.ok(labelBodies >= 20, `every label set was found (${labelBodies})`);
// The end label of the coverage slide: its own text and its text properties, both on one line.
const line = decoder.decode(entries[parts[0]]);
const end = /<c:dLbl>(?:(?!<\/c:dLbl>)[\s\S])*?31 Self-serve[\s\S]*?<\/c:dLbl>/.exec(line)?.[0];
assert.ok(end, 'the end label is written');
assert.equal((end.match(/<a:bodyPr wrap="none"\/>/g) ?? []).length, 2);
// A body that already names its wrap keeps it; the function is idempotent.
assert.equal(noWrapDataLabels('<c:dLbls><c:txPr><a:bodyPr wrap="square" rot="0"/></c:txPr></c:dLbls>'), '<c:dLbls><c:txPr><a:bodyPr wrap="square" rot="0"/></c:txPr></c:dLbls>');
assert.equal(noWrapDataLabels('<c:dLbls><c:txPr><a:bodyPr rot="0"></a:bodyPr></c:txPr></c:dLbls>'), '<c:dLbls><c:txPr><a:bodyPr rot="0" wrap="none"></a:bodyPr></c:txPr></c:dLbls>');
assert.equal(noWrapDataLabels(line), line);

// Import reads the labels as before: the options come back, the end labels stay the default.
const imported = await fromPptx(await toPptx(deck));
const chartAt = (slide, index = 0) => imported.slides[slide].chart ?? imported.slides[slide].blocks?.filter(block => block.chart)[index]?.chart;
assert.equal(chartAt(0, 0).dataLabels, undefined, 'end labels are the default');
assert.equal(chartAt(0, 0).legend, undefined);
assert.deepEqual(chartAt(1).dataLabels, deck.slides[1].chart.dataLabels);
assert.equal(chartAt(1).referenceLines?.[0]?.label, 'Target 30 min');
console.log(`Chart label wrap passed: ${labelBodies} data label bodies on one line, other chart text unchanged, labels import as before.`);
