// LH-141, LH-142, LH-143 in the preview: default value labels, the pie value list, the doughnut hole and a metric group their thousands by the
// deck language; a horizontal stacked bar chart whose every segment carries its value draws no value axis, tick labels or gridlines; a
// legend wider than its header row is drawn on top, on two rows. Composition decides them (core); this asserts what the preview draws.
import assert from 'node:assert/strict';
import { toSvg } from './catalog-harness.mjs';

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const tags = (svg, name) => [...svg.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'g'))].map(([, a]) => attributesOf(a));
const texts = (svg) => [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(([, a, body]) => ({ ...attributesOf(a), body: body.replace(/<[^>]*>/g, '') })).map((entry) => entry.body);
const deck = (slide, language = 'en') => ({ language, design: { fontScheme: 'roboto', colorScheme: 'cool-horizon', variant: 'light1' }, slides: [slide] });
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };

// 1. A column chart's default value labels group their thousands by the deck language; an author's format is kept.
{
  const slide = (columns) => ({ title: 'Orders passed 6,000 a month in April', chart: { type: 'column', data: { columns, rows: [['Jan', 4120], ['Feb', 4380], ['Mar', 5240], ['Apr', 6240]] } } });
  const english = texts(toSvg(deck(slide(['Month', 'Orders']), 'en'), 1));
  for (const value of ['4,120', '6,240']) check(english.includes(value), `English labels group (${value})`);
  check(!english.includes('6240'), 'no ungrouped label');
  const german = texts(toSvg(deck(slide(['Month', 'Orders']), 'de'), 1));
  for (const value of ['4.120', '6.240']) check(german.includes(value), `German labels group (${value})`);
  const written = texts(toSvg(deck(slide(['Month', { name: 'Orders', format: '0' }])), 1));
  check(written.includes('6240') && !written.includes('6,240'), 'a format the author wrote is kept');
}

// 1b. The value axis groups its ticks by the same rule: no format of its own, whole-number ticks of four digits, not a share axis.
{
  const slide = (columns, type = 'line') => ({ title: 'Orders grew', chart: { type, dataLabels: false, data: { columns, rows: [['Jan', 4120], ['Feb', 5240], ['Mar', 6240]] } } });
  const ticks = (svg) => texts(svg).filter((text) => /^[0-9][0-9,.]*$/.test(text) && Number(text.replace(/[,.]/g, '')) % 2000 === 0 && Number(text.replace(/[,.]/g, '')) >= 2000);
  const english = ticks(toSvg(deck(slide(['Month', 'Orders'])), 1));
  check(english.includes('2,000') && english.includes('6,000') && !english.includes('6000'), `English ticks group (${english})`);
  check(ticks(toSvg(deck(slide(['Month', 'Orders']), 'de'), 1)).includes('6.000'), 'German ticks group');
  const written = ticks(toSvg(deck(slide(['Month', { name: 'Orders', format: '0' }])), 1));
  check(written.includes('6000') && !written.includes('6,000'), 'an axis format the author wrote is kept');
  const share = texts(toSvg(deck(slide(['Month', 'Orders'], '100pct-stacked-column')), 1));
  check(share.includes('100%'), 'a share axis stays percent');
}

// 2. The doughnut's value list and hole, and a metric's value.
{
  const doughnut = (language) => toSvg(deck({ title: 'Two in three tickets are resolved on first contact', chart: { type: 'doughnut', data: { columns: ['Outcome', 'Tickets'],
    rows: [['Resolved on first contact', 6240], ['Resolved after follow-up', 2180], ['Escalated', 890], ['Unresolved', 310]] } } }, language), 1);
  const english = texts(doughnut('en'));
  check(english.filter((text) => text === '6,240').length >= 2, 'the list and the hole show 6,240');
  check(texts(doughnut('de')).filter((text) => text === '6.240').length >= 2, 'German: 6.240');
  const metric = (value, language) => texts(toSvg(deck({ title: 'Tickets resolved', metric: { value, label: 'Tickets' } }, language), 1));
  check(metric(6240, 'en').includes('6,240'), 'a numeric metric groups');
  check(metric(6240, 'de').includes('6.240'), 'in German');
  check(metric('6240', 'en').includes('6240'), 'a string metric is kept');
}

// 3. A horizontal stacked bar chart whose every segment is labeled draws no value axis.
{
  const chart = (rows, extra = {}) => ({ title: 'Self-service carries most requests', chart: { type: 'stacked-bar', ...extra, data: { columns: ['Region', 'Self-service', 'Chat', 'Phone'], rows } } });
  const all = [['North America', 5400, 2100, 900], ['Europe', 4600, 2300, 1300], ['Asia Pacific', 3900, 2800, 1100]];
  const ticks = (svg) => texts(svg).filter((text) => /^(0|2,?000|4,?000|6,?000|8,?000|10,?000)$/.test(text));
  const dropped = toSvg(deck(chart(all)), 1, { trace: true });
  check(ticks(dropped).length === 0, `no tick labels (${ticks(dropped)})`);
  check(texts(dropped).includes('5,400'), 'the segments hold their grouped values');
  const kept = toSvg(deck(chart([['North America', 5400, 2100, 90], ['Europe', 4600, 2300, 130]])), 1);
  check(ticks(kept).length > 0, 'a hairline segment keeps the axis');
  check(ticks(toSvg(deck(chart(all, { axisTitles: { value: 'Requests' } })), 1)).length > 0, 'a titled value axis stays');
  const gridlines = (svg) => tags(svg, 'line').filter((line) => line.x1 !== undefined && line.x1 === line.x2).length;
  check(gridlines(dropped) < gridlines(kept), 'the gridlines go with the axis');
}

// 4. A legend wider than the header row stands on top, on two rows, and the plot keeps the chart's width.
{
  // Beside a table, as r14 of the chart corpus: the chart is narrow, so its legend is too wide for one row.
  const slide = (columns) => ({ layout: 'comparison', title: 'Warranty claims by product line', blocks: [{ chart: { type: 'stacked-bar', data: { columns: ['Product line', ...columns], rows: [['Controllers', 4.9, 2.5], ['Pumps', 2.1, 1.2], ['Valves', 0.8, 0.5], ['Sensors', 0.4, 0.3]] } } },
    { table: { columns: ['Product line', 'Claims per 1,000', 'Average cost', 'Main cause'], rows: [['Controllers', 24, '$310', 'Firmware faults'], ['Pumps', 18, '$185', 'Seal wear'], ['Valves', 11, '$120', 'Corrosion'], ['Sensors', 7, '$95', 'Calibration drift']] } }] });
  const render = (columns) => toSvg(deck(slide(columns)), 1, { trace: true });
  const swatches = (svg) => tags(svg, 'rect').filter((rect) => /^slides\.0\.blocks\.0\.chart\.data\.columns\.\d$/.test(rect['data-opf-path'] ?? '') && Number(rect.width) < 20);
  const wide = render(['Parts ($K per 1,000 units)', 'Labor ($K per 1,000 units)']);
  const keys = swatches(wide);
  check(keys.length === 2, 'both legend keys are drawn');
  const bars = tags(wide, 'rect').filter((rect) => /^slides\.0\.blocks\.0\.chart\.data\.rows\.0\.\d$/.test(rect['data-opf-path'] ?? ''));
  check(keys.every((key) => Number(key.y) < Number(bars[0].y)), 'the legend stands above the bars');
  check(new Set(keys.map((key) => key.y)).size === 2, 'the two entries wrap onto two rows');
  const short = tags(render(['Parts', 'Labor']), 'rect').filter((rect) => /^slides\.0\.blocks\.0\.chart\.data\.rows\.0\.1$/.test(rect['data-opf-path'] ?? ''))[0];
  check(Math.abs(Number(bars[0].x) - Number(short.x)) < 1, 'the plot starts where it does with a short legend');
  check(bars.length === 2, 'the first bar has both segments');
}

console.log(`lh-141-chart-fixes: ${checks} checks passed`);
