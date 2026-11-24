// opf#1437 with opf#1415: a horizontal bar chart below a heading, beside a table of the same keys (LH-115, the plot on the table's rows),
// with a value-axis title and with a category-axis title as well. Its plot area is the inner box chart-layer.js writes for the rows (with
// the rotated category title's band, opf#1437); the preview-plot pass of index.js (lowLabelPlot, whole) leaves a plot that already has its
// own target alone. Pins that box against the preview's SVG on all four sides, so neither change can move it away from the preview.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toSvg} from '@openpresentation/opf-render';
import {toPptx} from '../dist/index.js';

const EMU = 9525, decoder = new TextDecoder();
const short = {columns: ['Prototype', 'Minutes'], rows: [['Prototype A', 5.8], ['Prototype B', 6.7]]};
// A category that is one long word: the preview gives a word that does not break up to 40% of the chart for its gutter (charts.js LH-120),
// and core's rows (chart-rows.ts alignBarRows) now do too, so the export's plot starts where the preview's does.
const long = {columns: ['Workstream', 'Weeks'], rows: [['Internationalization', 7], ['Search', 3], ['Export', 4]]};
for (const [data, axisTitles] of [[short, {value: 'Minutes'}], [short, {value: 'Minutes', category: 'Prototype'}], [long, {value: 'Weeks'}], [long, {value: 'Weeks', category: 'Workstream'}]]) {
  const deck = {slides: [{title: 'Compare', chart: {type: 'bar', data, axisTitles}, table: data}]};
  const entries = unzipSync(await toPptx(deck));
  const xml = decoder.decode(entries['ppt/charts/chart1.xml']);
  const layout = /<c:plotArea><c:layout><c:manualLayout>([\s\S]*?)<\/c:manualLayout>/.exec(xml)?.[1];
  assert.match(layout ?? '', /<c:layoutTarget val="inner"\/>/, 'the plot itself');
  const at = key => Number(new RegExp(`<c:${key} val="([^"]+)"/>`).exec(layout)[1]);
  const [fx, fy, fw, fh] = /<p:graphicFrame>[\s\S]*?<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(decoder.decode(entries['ppt/slides/slide1.xml'])).slice(1).map(value => Number(value) / EMU);
  const plot = {left: fx + at('x') * fw, top: fy + at('y') * fh, right: fx + (at('x') + at('w')) * fw, bottom: fy + (at('y') + at('h')) * fh};
  // The preview's gridlines and axis lines inside the chart's frame span its plot.
  const lines = [...toSvg(deck, 1).matchAll(/<line\b[^>]*>/g)].map(([tag]) => Object.fromEntries([...tag.matchAll(/\b(x1|x2|y1|y2)="([\d.]+)"/g)].map(([, key, value]) => [key, Number(value)])))
    .filter(line => Math.min(line.x1, line.x2) >= fx - 1 && Math.max(line.x1, line.x2) <= fx + fw + 1 && Math.min(line.y1, line.y2) >= fy - 1 && Math.max(line.y1, line.y2) <= fy + fh + 1);
  assert.ok(lines.length >= 3, 'the preview draws the plot\'s lines');
  const preview = {left: Math.min(...lines.map(line => Math.min(line.x1, line.x2))), right: Math.max(...lines.map(line => Math.max(line.x1, line.x2))),
    top: Math.min(...lines.map(line => Math.min(line.y1, line.y2))), bottom: Math.max(...lines.map(line => Math.max(line.y1, line.y2)))};
  for (const side of ['left', 'top', 'right', 'bottom']) assert.ok(Math.abs(plot[side] - preview[side]) < 0.5, `${JSON.stringify(axisTitles)}: plot ${side} ${plot[side].toFixed(2)} in PowerPoint, ${preview[side].toFixed(2)} in the preview`);
}
console.log('Chart rows title plot passed: a bar chart on a table\'s rows keeps the preview\'s plot with and without a category-axis title.');
