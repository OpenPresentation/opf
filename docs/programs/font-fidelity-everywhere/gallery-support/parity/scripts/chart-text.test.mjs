import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CHART_TEXT_ROLES, chartPartTextSizes, chartTextSizeMismatches, previewTextRole, previewTextSizes} from './chart-text.mjs';
import {parseChartex} from './chartex.mjs';

const tx = (sz) => `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr${sz ? ` sz="${sz}"` : ''} b="0"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:defRPr></a:pPr></a:p></c:txPr>`;
// A classic column chart as the export wrote it before FF-62: 12 pt data labels, 9 pt axes, a legend with no size.
const CLASSIC = (axis, legend, labels = 1200) => `<c:chartSpace xmlns:c="c" xmlns:a="a"><c:chart><c:plotArea><c:barChart><c:ser><c:dLbls>${tx(labels)}</c:dLbls></c:ser><c:dLbls>${tx(labels)}</c:dLbls></c:barChart>` +
  `<c:catAx><c:axId val="1"/>${tx(axis)}</c:catAx><c:valAx><c:axId val="2"/>${tx(axis)}</c:valAx></c:plotArea><c:legend><c:legendPos val="r"/>${tx(legend)}</c:legend></c:chart></c:chartSpace>`;

test('a classic part names a size per role; a legend without sz has no explicit size', () => {
  const roles = chartPartTextSizes(CLASSIC(900, undefined), false);
  assert.deepEqual(roles.axis, {blocks: 2, sizes: [9]});
  assert.deepEqual(roles.dataLabels, {blocks: 2, sizes: [12]});
  assert.deepEqual(roles.legend, {blocks: 1, sizes: []});
  assert.deepEqual(roles.title, {blocks: 0, sizes: []});
  assert.deepEqual(Object.keys(roles), [...CHART_TEXT_ROLES]);
});

test('a title inside an axis is the title role, not the axis role', () => {
  const xml = `<c:chartSpace><c:chart><c:plotArea><c:valAx><c:title><c:tx><c:rich><a:p><a:pPr><a:defRPr sz="1400"/></a:pPr><a:r><a:rPr sz="1400"/><a:t>Units</a:t></a:r></a:p></c:rich></c:tx></c:title>${tx(1200)}</c:valAx></c:plotArea></c:chart></c:chartSpace>`;
  const roles = chartPartTextSizes(xml, false);
  assert.deepEqual(roles.title, {blocks: 1, sizes: [14]});
  assert.deepEqual(roles.axis, {blocks: 1, sizes: [12]});
});

test('a chartex part names a size per role: axes, data labels, legend; the chart-space txPr is no role', () => {
  const t = (sz) => `<cx:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}"/></a:pPr></a:p></cx:txPr>`;
  const xml = `<cx:chartSpace xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex" xmlns:a="a"><cx:chartData/><cx:chart><cx:plotArea><cx:plotAreaRegion><cx:series layoutId="funnel"><cx:dataLabels pos="ctr">${t(1200)}<cx:visibility value="1"/></cx:dataLabels></cx:series></cx:plotAreaRegion>` +
    `<cx:axis id="0"><cx:catScaling gapWidth="0.06"/><cx:tickLabels/>${t(900)}</cx:axis><cx:axis id="1" hidden="1"><cx:valScaling/><cx:tickLabels/>${t(900)}</cx:axis></cx:plotArea><cx:legend pos="r">${t(1000)}</cx:legend></cx:chart>${t(1400)}</cx:chartSpace>`;
  const roles = chartPartTextSizes(xml, true);
  assert.deepEqual(roles.axis, {blocks: 2, sizes: [9]});
  assert.deepEqual(roles.dataLabels, {blocks: 1, sizes: [12]});
  assert.deepEqual(roles.legend, {blocks: 1, sizes: [10]});
  assert.deepEqual(roles.title, {blocks: 0, sizes: []});
  assert.deepEqual(parseChartex(xml).roleSizes, roles, 'parseChartex carries the same roles');
});

test('a preview line takes its role from its trace path and the chart construct', () => {
  assert.equal(previewTextRole('slides.0.chart', 'barChart'), 'axis', 'a tick label');
  assert.equal(previewTextRole('slides.0.chart.data.columns.2', 'barChart'), 'legend', 'a series name');
  assert.equal(previewTextRole('slides.0.chart.data.rows.3.0', 'barChart'), 'axis', 'a category on the category axis');
  assert.equal(previewTextRole('slides.0.chart.data.rows.3.1', 'funnelChart'), 'dataLabels', 'a value on its bar');
  assert.equal(previewTextRole('slides.0.chart.data.rows.3.0', 'pieChart'), 'legend', 'a pie draws its categories as the legend');
  assert.equal(previewTextRole('slides.0.chart.data.rows.3.0', 'doughnutChart'), 'legend');
  assert.equal(previewTextRole('slides.0.chart.data.rows.3.0', 'treemapChart'), 'dataLabels', 'a treemap tile name');
  assert.equal(previewTextRole(undefined, 'barChart'), 'axis');
  const sizes = previewTextSizes([{path: 'slides.0.chart', sizes: [12]}, {path: 'slides.0.chart.data.columns.1', sizes: [12, 12]}, {path: 'slides.0.chart.data.rows.0.1', sizes: [14]}], 'funnelChart');
  assert.deepEqual(sizes, {axis: [12], dataLabels: [14], legend: [12], title: []});
});

test('the size check is per role: the legend at 12 pt no longer hides 9 pt axes', () => {
  const preview = {axis: [12], dataLabels: [], legend: [12], title: []};
  assert.deepEqual(chartTextSizeMismatches(preview, chartPartTextSizes(CLASSIC(1200, 1200), false), 0.005), [], 'every role at the preview size');
  assert.deepEqual(chartTextSizeMismatches(preview, chartPartTextSizes(CLASSIC(900, 1200), false), 0.005), ['chart axis text: preview [12] vs chart [9]'], 'axes at 9 pt, legend at 12 pt: the old any-size check passed this');
  assert.deepEqual(chartTextSizeMismatches(preview, chartPartTextSizes(CLASSIC(1200, undefined), false), 0.005), ['chart legend text: preview [12] vs chart [no explicit size]'], 'a legend that inherits the PowerPoint default');
});

test('only roles the preview draws and the part has are compared; the part names no extra size; the tolerance is exact', () => {
  const part = chartPartTextSizes(CLASSIC(1200, 1200), false);
  assert.deepEqual(chartTextSizeMismatches({axis: [], dataLabels: [], legend: [], title: []}, chartPartTextSizes(CLASSIC(900, undefined), false), 0.005), [], 'nothing drawn, nothing compared');
  assert.deepEqual(chartTextSizeMismatches({axis: [], dataLabels: [12], legend: [], title: [12]}, part, 0.005), [], 'a title the part has no element for is not a size question');
  const mixed = chartPartTextSizes(`<c:chartSpace><c:legend>${tx(1200)}</c:legend><c:legend>${tx(1800)}</c:legend></c:chartSpace>`, false);
  assert.deepEqual(chartTextSizeMismatches({axis: [], dataLabels: [], legend: [12], title: []}, mixed, 0.005), ['chart legend text: preview [12] vs chart [12,18]'], 'a size the preview does not draw');
  assert.deepEqual(chartTextSizeMismatches({axis: [12], dataLabels: [], legend: [], title: []}, chartPartTextSizes(CLASSIC(1201, 1200), false), 0.005), ['chart axis text: preview [12] vs chart [12.01]'], 'no loosening: 0.01 pt is a mismatch');
  assert.deepEqual(chartTextSizeMismatches({axis: [12.5], dataLabels: [], legend: [], title: []}, chartPartTextSizes(CLASSIC(1250, 1250), false), 0.005), [], 'a fractional size equal to the hundredth');
});

import {isComputedTickLabel} from './chart-text.mjs';
test('computed value-axis ticks are classified apart from authored chart strings (RR-44)', () => {
  assert.equal(isComputedTickLabel('0', 'slides.0.chart'), true);
  assert.equal(isComputedTickLabel('1,000', 'slides.0.chart'), true);
  assert.equal(isComputedTickLabel('20%', 'slides.0.chart'), true);
  assert.equal(isComputedTickLabel('Q1', 'slides.0.chart'), false);
  assert.equal(isComputedTickLabel('0', 'slides.0.chart.data.rows.0.0'), false);
  assert.equal(isComputedTickLabel('2024', 'slides.0.chart.data.rows.1.0'), false);
  assert.equal(isComputedTickLabel('Revenue', 'slides.0.chart.data.columns.1'), false);
  assert.equal(isComputedTickLabel('', 'slides.0.chart'), false);
});
