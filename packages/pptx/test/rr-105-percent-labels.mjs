// RR-105: a label block that shows the percentage and not the value names the `0%` code it is drawn with, in every language.
// PowerPoint draws such a label with its own `0%` whatever the code; Keynote applies the code and drew `General` as "50" without the
// percent sign. A block that also shows the value keeps `General` (the code formats the value), and import returns the same labels.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';
import {percentLabelFormats} from '../dist/numeral-shapes.js';

const block = flags => `<c:dLbls><c:numFmt formatCode="General" sourceLinked="0"/>${flags}</c:dLbls>`;
assert.equal(percentLabelFormats(block('<c:showVal val="0"/><c:showPercent val="1"/>')), block('<c:showVal val="0"/><c:showPercent val="1"/>').replace('General', '0%'));
assert.equal(percentLabelFormats(block('<c:showVal val="1"/><c:showPercent val="1"/>')), block('<c:showVal val="1"/><c:showPercent val="1"/>'), 'value and percent keep General');
assert.equal(percentLabelFormats(block('<c:showVal val="1"/><c:showPercent val="0"/>')), block('<c:showVal val="1"/><c:showPercent val="0"/>'), 'values keep General');
assert.equal(percentLabelFormats(block('<c:showPercent val="1"/>'), '[$-2000000]'), block('<c:showPercent val="1"/>').replace('General', '[$-2000000]0%'));

const data = {columns: ['Region', 'Share'], rows: [['East', 50], ['West', 33.3], ['North', 16.7]]};
const charts = [
  {type: 'pie', alt: 'Shares', data, dataLabels: {content: ['percent']}},
  {type: 'doughnut', alt: 'Shares', data, dataLabels: {content: ['percent']}},
  {type: 'pie', alt: 'Shares', data, dataLabels: {content: ['category', 'percent']}},
  {type: 'pie', alt: 'Shares', data, dataLabels: {content: ['value', 'percent']}},
];
const document = {language: 'en-US', slides: charts.map(chart => ({title: 'Share', chart}))};
const bytes = await toPptx(document);
const files = unzipSync(new Uint8Array(bytes));
const labelCodes = number => {
  const xml = strFromU8(files[`ppt/charts/chart${number}.xml`]);
  return [...new Set([...xml.matchAll(/<c:dLbls>[\s\S]*?<\/c:dLbls>/g)].flatMap(match => [...match[0].matchAll(/<c:numFmt formatCode="([^"]*)"/g)].map(code => code[1])))];
};
assert.deepEqual(labelCodes(1), ['0%'], 'pie percent labels');
assert.deepEqual(labelCodes(2), ['0%'], 'doughnut percent labels');
assert.deepEqual(labelCodes(3), ['0%'], 'category and percent labels');
assert.deepEqual(labelCodes(4), ['General'], 'value and percent labels keep General');

// Round trip: the same chart labels come back, with no note about the label format.
const back = await fromPptx(bytes);
back.slides.forEach((slide, index) => assert.deepEqual(slide.chart.dataLabels, charts[index].dataLabels, `slide ${index + 1} labels round trip`));
console.log('rr-105 percent labels: ok');
