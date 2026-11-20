// LH-153 and LH-154 in the preview: waterfall, funnel, treemap, histogram and pareto labels and value axes, a combo chart's two value axes and a
// scatter chart's two group their thousands by the deck language (core's rule: no format of its own, whole numbers, one of four digits; the data
// rule for the axes core does not compose); an author's format and a column of years are never grouped; a horizontal stacked bar chart's axis
// titles stand clear of its tick labels and row names.
import assert from 'node:assert/strict';
import { toSvg } from './catalog-harness.mjs';

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const entries = (svg) => [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(([, a, body]) => ({ ...attributesOf(a), body: body.replace(/<[^>]*>/g, '') }));
const texts = (svg) => entries(svg).map((entry) => entry.body);
const deck = (slide, language = 'en') => ({ language, design: { fontScheme: 'roboto', colorScheme: 'cool-horizon', variant: 'light1' }, slides: [slide] });
const draw = (chart, language) => toSvg(deck({ title: 'Chart', chart }, language), 1);
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };

// 1. A funnel, a treemap with value labels and a waterfall group their labels by the language; a format the author wrote is kept.
{
  const funnel = (columns) => ({ type: 'funnel', data: { columns, rows: [['Visitors', 48200], ['Signups', 12400], ['Trials', 5300], ['Paid', 1850]] } });
  const english = texts(draw(funnel(['Stage', 'People'])));
  for (const value of ['48,200', '12,400', '5,300', '1,850']) check(english.includes(value), `funnel value ${value}`);
  const german = texts(draw(funnel(['Stage', 'People']), 'de'));
  for (const value of ['48.200', '1.850']) check(german.includes(value), `German funnel value ${value}`);
  const written = texts(draw(funnel(['Stage', { name: 'People', format: '0' }])));
  check(written.includes('48200') && !written.includes('48,200'), 'a funnel format the author wrote is kept');

  const treemap = texts(draw({ type: 'treemap', dataLabels: { content: ['category', 'value'] }, data: { columns: ['Line', 'Revenue'], rows: [['Hardware', 8400], ['Software', 5200], ['Services', 3100]] } }));
  check(treemap.some((text) => text.includes('8,400')), `treemap value labels group (${treemap})`);

  const waterfall = texts(draw({ type: 'waterfall', data: { columns: ['Step', 'Revenue'], rows: [['2023', 12400], ['New', 3200], ['Churn', -1450], ['Upsell', 900], ['2024', 15050]] } }));
  for (const value of ['12,400', '+3,200', '−1,450', '+900', '15,050']) check(waterfall.includes(value), `waterfall label ${value} (${waterfall})`);
  check(!waterfall.includes('12400'), 'no ungrouped waterfall label');
  const fractions = texts(draw({ type: 'waterfall', data: { columns: ['Step', 'Profit'], rows: [['2023', 1240.5], ['New', 320.5], ['2024', 1561]] } }));
  check(fractions.includes('1240.5') && !fractions.some((text) => text.includes(',')), 'fractions keep the General form');
}

// 2. A histogram's counts and a pareto chart's bars group in their labels and value axis; the percent axis stays percent.
{
  const bins = { type: 'histogram', dataLabels: { content: ['value'] }, data: { columns: ['Bin', 'Orders'], rows: [['0-1k', 1200], ['1-2k', 3400], ['2-3k', 5200], ['3-4k', 4100]] } };
  const found = texts(draw(bins));
  check(found.includes('5,200') && found.includes('6,000'), `histogram labels and ticks group (${found})`);
  const pareto = texts(draw({ type: 'pareto', data: { columns: ['Cause', 'Defects'], rows: [['Scratches', 4200], ['Dents', 2900], ['Cracks', 800]] } }));
  check(pareto.includes('4,000') && pareto.includes('100%'), `pareto axis groups, the percent axis stays (${pareto})`);
  const small = texts(draw({ ...bins, data: { columns: ['Bin', 'Orders'], rows: [['a', 120], ['b', 340]] } }));
  check(small.every((text) => !text.includes(',')), 'three digits keep the General form');
}

// 3. A combo chart groups each value axis that has no format; a scatter chart groups its Y axis, and its X axis over a span of 1000 or more.
{
  const combo = texts(draw({ type: 'combo', line: ['Orders'], secondaryAxis: ['Orders'], data: { columns: ['Quarter', 'Revenue', 'Orders'], rows: [['Q1', 12400, 5200], ['Q2', 15800, 6100], ['Q3', 21500, 8400]] } }));
  check(combo.includes('20,000') && combo.includes('8,000'), `combo primary and secondary axes group (${combo})`);
  const scatter = texts(draw({ type: 'scatter', data: { columns: ['Region', 'Spend', 'Revenue'], rows: [['A', 5000, 12000], ['B', 18000, 26500], ['C', 41000, 62000]] } }));
  check(scatter.includes('40,000') && scatter.includes('60,000'), `scatter axes group (${scatter})`);
  const years = texts(draw({ type: 'scatter', data: { columns: ['Point', 'Year', 'Units'], rows: [['a', 1990, 120], ['b', 2000, 560], ['c', 2010, 1450], ['d', 2020, 2300]] } }));
  check(years.includes('1,000') || years.includes('2,000'), `the Y axis groups (${years})`);
  check(years.includes('1990') || years.includes('2010'), `a column of years keeps its digits on the X axis (${years})`);
  check(!years.includes('1,990') && !years.includes('2,010') && !years.includes('2,020'), 'no grouped year');
}

// 4. A horizontal stacked bar chart's value axis title stands under the tick labels, its category title clear of the row names.
{
  const data = { columns: ['Region', 'Self-service', 'Chat', 'Phone'], rows: [['North America', 5400, 2100, 900], ['Europe', 4600, 2300, 1300], ['Asia Pacific', 3900, 2800, 1100]] };
  const svg = draw({ type: 'stacked-bar', axisTitles: { value: 'Requests', category: 'Region' }, data });
  const found = entries(svg), title = found.find((entry) => entry.body === 'Requests'), tick = found.find((entry) => entry.body === '4,000');
  check(title && tick, 'the title and a tick label are drawn');
  const lineHeight = Number(tick['font-size']);
  check(Number(title.y) - Number(tick.y) >= lineHeight, `the value title is a text line under the tick labels (${title.y} vs ${tick.y})`);
  const row = found.find((entry) => entry.body === 'Asia Pacific'), side = found.find((entry) => entry.body === 'Region');
  check(side, 'the category title is drawn');
  const rotated = svg.match(/<g transform="rotate\(-90 ([\d.]+) [\d.]+\)">/)?.[1];
  check(rotated !== undefined && Number(rotated) < Number(row.x) - Number(row['font-size']) * 3, 'the category title stands left of the row names');
}

console.log(`lh-153-chart-follow-ups render: ${checks} checks`);
