// LH-59: the PPTX export draws charts the way the preview does. A horizontal bar chart lists its categories top to bottom in data order
// (c:catAx orientation maxMin, with the value axis crossing at the last category so its labels stay at the bottom); a waterfall's last
// value that equals the running sum before it is a total (cx:subtotals) in the third colour; the value axis core composes ends within
// 1.25 x the data maximum.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {toPptx} from './helpers/default-catalog.mjs';

const quarters = {columns: ['Quarter', 'Current', 'Baseline'], rows: [['Q1', 12, 9], ['Q2', 16, 11], ['Q3', 19, 13], ['Q4', 23, 15]]};
async function chartParts(slides, options = {}) {
  const parts = unzipSync(await toPptx({slides}, options));
  return Object.entries(parts).filter(([name]) => /^ppt\/charts\/chart(Ex)?\d+\.xml$/.test(name)).sort(([a], [b]) => a.localeCompare(b, 'en', {numeric: true})).map(([name, bytes]) => ({name, xml: strFromU8(bytes)}));
}
const block = (xml, tag) => xml.match(new RegExp(`<c:${tag}>[\\s\\S]*?</c:${tag}>`))?.[0] ?? '';
const value = (xml, tag) => xml.match(new RegExp(`<c:${tag} val="([^"]*)"`))?.[1];
let checks = 0;

// 1. Horizontal bars: categories reversed (first at the top), the value axis crossing at the maximum category; columns are unchanged.
{
  const [bar, stacked, percent, column] = await chartParts(['bar', 'stacked-bar', '100pct-stacked-bar', 'column'].map((type) => ({title: type, chart: {type, data: quarters}})));
  for (const {xml} of [bar, stacked, percent]) {
    assert.equal(value(block(xml, 'catAx'), 'orientation'), 'maxMin', 'the category axis runs from the top');
    assert.equal(value(block(xml, 'valAx'), 'crosses'), 'max', 'the value axis crosses at the last category, at the bottom');
    assert.equal(value(block(xml, 'catAx'), 'crosses'), 'autoZero', 'the category axis still crosses the value axis at zero');
    // The data keeps its order: the category cache lists Q1 first.
    assert.deepEqual([...block(xml, 'cat').matchAll(/<c:v>([^<]*)<\/c:v>/g)].map(([, v]) => v), ['Q1', 'Q2', 'Q3', 'Q4']);
    checks++;
  }
  assert.equal(value(block(column.xml, 'catAx'), 'orientation'), 'minMax', 'a column chart keeps its category order');
  assert.equal(value(block(column.xml, 'valAx'), 'crosses'), 'autoZero');
  checks++;
}

// 2. The value axis core composes ends near the data: bars peaking at 23 end at 25, not 30, in a full and in a small box.
{
  const parts = await chartParts([
    {title: 'Full', chart: {type: 'bar', data: quarters}},
    {title: 'Dashboard', layout: 'dashboard', blocks: [{chart: {type: 'column', data: quarters}}, {metric: {value: '42', label: 'Signal'}}, {chart: {type: 'pie', data: quarters}}, {metric: {value: '91%', label: 'Signal'}}, {chart: {type: 'pie', data: quarters}}]},
  ]);
  for (const {name, xml} of parts.filter(({xml}) => xml.includes('<c:valAx>'))) {
    const max = Number(value(block(xml, 'valAx'), 'max'));
    assert.ok(max >= 23 && max <= 23 * 1.25, `${name}: c:max ${max} within 1.25 x the data maximum`);
    checks++;
  }
}

// 3. Waterfall (native chartex): Start 100, +24, -8, End 116. The end is a subtotal and takes the third colour.
{
  const total = {columns: ['Step', 'Value'], rows: [['Start', 100], ['Expansion', 24], ['Churn', -8], ['End', 116]]};
  const steps = {columns: ['Quarter', 'Value'], rows: [['Q1', 23], ['Q2', 27], ['Q3', 30], ['Q4', 34]]};
  const parts = await chartParts([{title: 'Total', chart: {type: 'waterfall', data: total}}, {title: 'Steps', chart: {type: 'waterfall', data: steps}}], {chartex: 'native'});
  const [withTotal, withoutTotal] = parts.filter(({name}) => name.includes('chartEx'));
  assert.match(withTotal.xml, /<cx:layoutPr><cx:visibility connectorLines="1"\/><cx:subtotals><cx:idx val="3"\/><\/cx:subtotals><\/cx:layoutPr>/);
  const fills = [...withTotal.xml.matchAll(/<cx:dataPt idx="(\d)"><cx:spPr><a:solidFill>(<a:[^>]*?\/?>)/g)].map(([, idx, fill]) => [Number(idx), fill]);
  assert.equal(fills.length, 4);
  assert.equal(fills[0][1], fills[1][1], 'increases share the first colour');
  assert.notEqual(fills[2][1], fills[0][1], 'a decrease takes the second colour');
  assert.ok(fills[3][1] !== fills[0][1] && fills[3][1] !== fills[2][1], 'the total takes its own (third) colour');
  assert.match(withoutTotal.xml, /<cx:layoutPr><cx:visibility connectorLines="1"\/><\/cx:layoutPr>/, 'a last value that is not the running sum is a step');
  checks++;
}

console.log(`Chart correctness (PPTX) passed: ${checks} checks; bar categories top to bottom, axis max within 1.25 x the data, waterfall total as a subtotal.`);
