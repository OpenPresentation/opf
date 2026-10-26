// WI-5 (data readability): the PPTX export writes what core composed and the preview draws. The chart value axis step (c:majorUnit) is
// core's (fewer, wider intervals on a short axis); series 1 and the metric value reach 4.5:1 on the default navy, as the preview draws
// them; the table grid lists the content-sized column widths and its default rules are horizontal.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {colorContrast, composeSlide} from '@openpresentation/opf/composition';
import {toPptx, toSvg} from './helpers/default-catalog.mjs';

const parts = async (deck) => unzipSync(await toPptx(structuredClone(deck)));
const text = (entries, name) => strFromU8(entries[name]);
const attrs = (source) => Object.fromEntries([...source.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const rects = (svg) => [...svg.matchAll(/<rect\b([^>]*)>/g)].map(([, a]) => attrs(a));
let checked = 0;

// --- Chart axis step follows the axis length, in the chart part as in core.
{
  const data = {columns: ['Quarter', 'Revenue'], rows: [['Q1', 120], ['Q2', 480], ['Q3', 760], ['Q4', 310]]};
  const chart = {type: 'column', data};
  const slides = [
    {title: 'Revenue', chart},
    {title: 'Revenue', bullets: ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'], chart, composition: {mode: 'column'}},
  ];
  const steps = [];
  for (const [index, slide] of slides.entries()) {
    const deck = {slides: [slide]};
    const composed = composeSlide(slide, {width: 1280, height: 720, presentation: deck, slideIndex: 0});
    const item = composed.items.find((entry) => entry.field === 'chart');
    const expected = item.chart.valueAxis;
    assert.ok(expected, 'core composes the axis');
    const xml = text(await parts(deck), 'ppt/charts/chart1.xml');
    const unit = Number(xml.match(/<c:valAx>[\s\S]*?<c:majorUnit val="([^"]+)"/)?.[1]);
    assert.equal(unit, expected.majorUnit, `slide ${index}: the exported major unit is core's`);
    assert.equal(Number(xml.match(/<c:valAx>[\s\S]*?<c:max val="([^"]+)"/)?.[1]), expected.max);
    assert.ok((expected.max - expected.min) / unit <= 8, 'at most eight intervals');
    steps.push({unit, height: item.box.height});
    checked++;
  }
  assert.ok(steps[1].height < steps[0].height && steps[1].unit > steps[0].unit, `a shorter axis has a wider step: ${JSON.stringify(steps)}`);
  assert.equal(steps[0].unit, 100);
}

// --- Series 1 on the default navy.
{
  const deck = {slides: [{title: 'Completion', chart: {type: 'column', data: {columns: ['Week', 'Task completion'], rows: [['1', 68], ['2', 72]]}}}]};
  const entries = await parts(deck);
  const xml = text(entries, 'ppt/charts/chart1.xml');
  const fill = xml.match(/<c:ser>[\s\S]*?<c:spPr>\s*<a:solidFill>\s*<a:srgbClr val="([0-9A-F]{6})"/)?.[1];
  assert.ok(fill, 'a lifted series colour is sRGB, not the theme colour');
  const previewSvg = toSvg(deck, 1, {trace: true});
  const bars = rects(previewSvg).filter((rect) => /^slides\.0\.chart\.data\.rows\.\d+\.1$/.test(rect['data-opf-path'] ?? ''));
  assert.ok(bars.length === 2 && bars.every((bar) => bar.fill.toUpperCase() === `#${fill}`), `native ${fill} is the preview's ${bars.map((bar) => bar.fill)}`);
  const panel = rects(previewSvg).find((rect) => rect['data-opf-path'] === 'slides.0.chart').fill;
  assert.ok(colorContrast(`#${fill}`, panel) >= 4.5, `${fill} on ${panel}`);
  assert.equal(rects(previewSvg).find((rect) => rect['data-opf-path'] === 'slides.0.chart').stroke, undefined, 'the preview panel has no frame');
  assert.doesNotMatch(xml, /<c:chartSpace[\s\S]*<\/c:chart>\s*<c:spPr>[\s\S]*?<a:ln w="[1-9]/, 'the native chart area has no frame either');
  // an authored colour is not lifted
  const explicit = text(await parts({slides: [{title: 'Completion', chart: {...deck.slides[0].chart, colors: ['#2874A6']}}]}), 'ppt/charts/chart1.xml');
  assert.match(explicit, /<c:ser>[\s\S]*?<a:srgbClr val="2874A6"/);
  checked += 3;
}

// --- Metric value on the default navy.
{
  const deck = {slides: [{title: 'Task completion', metric: {value: '84%', label: 'Task completion'}}]};
  const entries = await parts(deck);
  const slide = text(entries, 'ppt/slides/slide1.xml');
  const shape = [...slide.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map((match) => match[0]).find((xml) => /name="OPF metric \d+ value line 1"/.test(xml));
  assert.ok(shape, 'the metric value shape');
  const color = shape.match(/<a:rPr[\s\S]*?<a:srgbClr val="([0-9A-F]{6})"/)?.[1];
  const svg = toSvg(deck, 1, {trace: true});
  const previewValue = [...svg.matchAll(/<text\b([^>]*data-opf-metric-role="value"[^>]*)>/g)].map((match) => attrs(match[1]).fill)[0];
  assert.equal(`#${color}`, previewValue.toUpperCase(), 'the native value colour is the preview value colour');
  const background = rects(svg).find((rect) => rect.width === '1280' && rect.height === '720')?.fill ?? '#011842';
  assert.ok(colorContrast(`#${color}`, background) >= 4.5, `${color} on ${background}`);
  checked += 2;
}

// --- Table: content-sized columns and horizontal rules.
{
  const table = {columns: ['Measure', 'Baseline', 'Pilot'], rows: [['Task completion', '68%', '84%'], ['Participant satisfaction', '3.8 / 5', '4.6 / 5']]};
  const deck = {slides: [{title: 'Table', table}]};
  const entries = await parts(deck);
  const slide = text(entries, 'ppt/slides/slide1.xml');
  const widths = [...slide.matchAll(/<a:gridCol w="(\d+)"/g)].map((match) => Number(match[1]));
  assert.equal(widths.length, 3);
  assert.ok(new Set(widths).size > 1 && widths[0] > widths[1], `the grid is not three equal columns: ${widths}`);
  const frame = Number(slide.match(/<p:graphicFrame>[\s\S]*?<a:ext cx="(\d+)"/)?.[1]);
  assert.ok(Math.abs(widths.reduce((a, b) => a + b, 0) - frame) <= 3, 'the columns fill the frame');
  const svg = toSvg(deck, 1, {trace: true});
  for (const [index, width] of widths.entries()) {
    const preview = rects(svg).find((rect) => rect['data-opf-path'] === `slides.0.table.columns.${index}`);
    assert.ok(Math.abs(width / 9525 - Number(preview.width)) < 0.01, `column ${index}: ${width / 9525} against the preview's ${preview.width}`);
  }
  const cell = slide.match(/<a:tc>[\s\S]*?<\/a:tc>/)[0];
  assert.match(cell, /<a:lnL[^>]*><a:noFill\/>/);
  assert.match(cell, /<a:lnR[^>]*><a:noFill\/>/);
  assert.match(cell, /<a:lnT[^>]*><a:solidFill>/);
  assert.match(cell, /<a:lnB[^>]*><a:solidFill>/);
  checked += 3;
}
console.log(`Data readability export passed: ${checked} checks (axis step, series 1 and metric value at 4.5:1, content-sized table columns, horizontal rules).`);
