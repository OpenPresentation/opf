import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chartSeriesColors} from './chart-colors.mjs';

const fill = (hex) => `<c:spPr><a:solidFill><a:srgbClr val="${hex}"/></a:solidFill><a:effectLst/></c:spPr>`;
const point = (idx, spPr) => `<c:dPt><c:idx val="${idx}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/>${spPr}</c:dPt>`;
// The data labels carry their own c:spPr (a label box); it is not a series colour.
const labels = `<c:dLbls><c:spPr><a:solidFill><a:srgbClr val="ABCDEF"/></a:solidFill></c:spPr><c:showVal val="1"/></c:dLbls>`;
const cache = `<c:cat><c:strRef><c:f>Sheet1!$A$2:$A$5</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>Sheet1!$B$2:$B$5</c:f></c:numRef></c:val>`;
const series = (idx, body) => `<c:ser><c:idx val="${idx}"/><c:order val="${idx}"/><c:tx><c:strRef><c:f>Sheet1!$B$1</c:f></c:strRef></c:tx>${body}${cache}</c:ser>`;
const part = (element, sers, extra = '') => `<c:chartSpace><c:chart><c:plotArea><c:${element}>${extra}<c:varyColors val="0"/>${sers}</c:${element}></c:plotArea></c:chart>${fill('011842')}</c:chartSpace>`;

// The series of rr35-03 slide 1 as opf-pptx main 1ab1630 exported it (PptxGenJS single-series c:dPt), trimmed of its caches.
const PER_POINT = ['2874A6', '3F6B88', '5499C7', '7BDBB2'];
const singleWithPoints = part('barChart', series(0, `${fill('2874A6')}<c:invertIfNegative val="0"/>${labels}${PER_POINT.map((hex, i) => point(i, fill(hex))).join('')}`), '<c:barDir val="col"/><c:grouping val="clustered"/>');
const singleOneColour = part('barChart', series(0, `${fill('2874A6')}<c:invertIfNegative val="0"/>${labels}`), '<c:barDir val="col"/><c:grouping val="clustered"/>');

test('a single-series bar chart with c:dPt overrides reports every point colour, not only the series fill (RR-36)', () => {
  assert.deepEqual(chartSeriesColors(singleWithPoints), {colors: PER_POINT, strokeSeries: false});
  // The harness fails a chart whose native colours are not all painted by the preview: a preview that draws one colour now fails.
  const preview = ['2874A6', '011842', 'FFFFFF'];
  assert.deepEqual(chartSeriesColors(singleWithPoints).colors.filter((c) => !preview.includes(c)), ['3F6B88', '5499C7', '7BDBB2']);
});

test('without overrides a bar series is its c:spPr fill, as before; label boxes and the chart area are not series colours', () => {
  assert.deepEqual(chartSeriesColors(singleOneColour), {colors: ['2874A6'], strokeSeries: false});
  const two = part('barChart', series(0, `${fill('2874A6')}${labels}`) + series(1, `${fill('3F6B88')}${labels}`));
  assert.deepEqual(chartSeriesColors(two).colors, ['2874A6', '3F6B88']);
  // PowerPoint saves a scatter series with an a:ln noFill c:spPr; its colour is the marker fill that follows (read as before).
  const scatter = part('scatterChart', series(0, `<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr><c:marker><c:symbol val="circle"/>${fill('2874A6')}</c:marker>${labels}`));
  assert.deepEqual(chartSeriesColors(scatter), {colors: ['2874A6'], strokeSeries: false});
});

test('a point override that only outlines the point (a:ln) is not a fill', () => {
  const outline = `<c:spPr><a:ln><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:ln></c:spPr>`;
  const xml = part('barChart', series(0, `${fill('2874A6')}${point(0, outline)}${point(1, outline)}`));
  assert.deepEqual(chartSeriesColors(xml).colors, ['2874A6']);
});

test('pie and doughnut keep one colour per slice and ignore the F9F9F9 slice border; line series stay strokes', () => {
  const border = '<a:ln w="9525"><a:solidFill><a:srgbClr val="F9F9F9"/></a:solidFill></a:ln>';
  const pie = part('pieChart', series(0, `<c:spPr>${border}</c:spPr>${['2874A6', '3F6B88'].map((hex, i) => point(i, fill(hex))).join('')}`), '');
  assert.deepEqual(chartSeriesColors(pie), {colors: ['2874A6', '3F6B88'], strokeSeries: false});
  const line = part('lineChart', series(0, `<c:spPr><a:ln w="25400"><a:solidFill><a:srgbClr val="2874A6"/></a:solidFill></a:ln></c:spPr><c:marker><c:symbol val="circle"/>${fill('2874A6')}</c:marker>`));
  assert.deepEqual(chartSeriesColors(line), {colors: ['2874A6'], strokeSeries: true});
});
