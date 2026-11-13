// RR-105 (#1290, ribbon audit gap 6): charts, tables, organization logos and quote photos get a generated text alternative when
// the author wrote none, so PowerPoint's Accessibility Checker finds no "Missing alternative text" on them. An authored `alt` wins,
// the empty string included (the decorative marker). Import never turns a generated description into an authored `alt`: the
// round trip returns the same document, with or without provenance, while a description edited in PowerPoint imports as `alt`.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';
import {authoredAlt, authoredChartAlt, authoredTableAlt, chartAlt, chartNoun, generatedChartAlts, nameList, tableAlt} from '../dist/default-alt.js';

const image = `data:image/png;base64,${readFileSync(new URL('./fixtures/images/wide.png', import.meta.url)).toString('base64')}`;
const cNvPrs = (bytes, pattern = /^ppt\/(?:slides\/slide|slideMasters\/slideMaster|slideLayouts\/slideLayout)\d+\.xml$/) => {
  const parts = unzipSync(bytes), found = new Map();
  for (const name of Object.keys(parts).filter(name => pattern.test(name)))
    for (const [tag] of strFromU8(parts[name]).matchAll(/<p:cNvPr\b[^>]*>/g)) {
      const objectName = /\bname="([^"]*)"/.exec(tag)?.[1];
      if (!found.has(objectName)) found.set(objectName, {descr: /\bdescr="([^"]*)"/.exec(tag)?.[1], tag});
    }
  return found;
};
const stable = async (deck, options = {}) => {
  const imported = await fromPptx(await toPptx(structuredClone(deck), options));
  const again = await fromPptx(await toPptx(structuredClone(imported), options));
  assert.deepEqual(again, imported, 'the round trip is stable');
  return imported;
};
// Without provenance a slide's object returns as a block.
const payload = (slide, kind) => slide[kind] ?? slide.blocks?.find(block => block.type === kind)?.[kind];
let checks = 0;

// 1. The generator: type, series and categories; columns and rows; plain English around the document's own names.
assert.equal(chartNoun('column'), 'Column chart');
assert.equal(chartNoun('100pct-stacked-bar'), '100% stacked bar chart');
assert.equal(chartNoun('world'), 'Map chart');
assert.equal(nameList(['A', 'B', 'C', 'D', 'E']), 'A, B, C and 2 more');
assert.equal(chartAlt({type: 'column', data: {columns: ['Quarter', 'Sales', 'Cost'], rows: [['Q1', 1, 2], ['Q2', 3, 4], ['Q3', 5, 6]]}}), 'Column chart: Sales and Cost by Quarter, 3 categories');
assert.equal(chartAlt({type: 'pie', data: {columns: ['Region', 'Share'], rows: [['North', 1]]}}), 'Pie chart: Share by Region, 1 category');
assert.equal(chartAlt({type: 'histogram', data: {columns: ['Value'], rows: [[1], [2]]}}), 'Histogram chart: Value, 2 values');
assert.equal(chartAlt({type: 'scatter', data: {columns: ['Person', 'Height', 'Weight'], rows: [['Ada', 1, 2]]}}), 'Scatter chart: Weight against Height, 1 point');
assert.equal(chartAlt({type: 'scatter', data: {columns: ['Point', 'Y'], rows: [['a', 1], ['b', 2]]}}), 'Scatter chart: Y by Point, 2 points');
assert.equal(chartAlt({type: 'line', data: {dataset: 'sales'}}, {datasets: {sales: {columns: ['Month', 'Units'], rows: [['Jan', 3], ['Feb', 4]]}}}), 'Line chart: Units by Month, 2 categories');
assert.equal(tableAlt({columns: ['Team', 'People', 'Open roles'], rows: [['Design', 8, 2]]}), 'Table: Team, People and Open roles; 1 row');
// Import: a description is generated when it is the one written for the chart read, for its row-number form, or for the same data
// under another type noun (an extended chart read through its classic fallback); any other text is authored.
const regions = {type: 'column', data: {columns: ['Region', 'Value'], rows: [['North', 1], ['South', 2]]}};
assert.equal(authoredAlt('Column chart: Value by Region, 2 categories', generatedChartAlts(regions)), undefined);
assert.equal(authoredAlt('Treemap chart: Value by Region, 2 categories', generatedChartAlts(regions)), undefined);
assert.equal(authoredAlt('Waterfall chart: Value, 2 values', generatedChartAlts({type: 'waterfall', data: {columns: ['Row', 'Value'], rows: [['1', 3], ['2', 4]]}})), undefined);
assert.equal(authoredAlt('Two regions, South leads', generatedChartAlts(regions)), 'Two regions, South leads');
assert.equal(authoredAlt('Column chart: Value by Region, 3 categories', generatedChartAlts(regions)), 'Column chart: Value by Region, 3 categories', 'other data is authored text');
checks++;

// 2. Export: generated descriptions on chart and table frames, the chartex picture fallback included; authored alt wins.
const deck = {name: 'Alt text', slides: [
  {title: 'Sales', chart: {type: 'column', data: {columns: ['Quarter', 'Sales', 'Cost'], rows: [['Q1', 12, 8], ['Q2', 15, 9]]}}},
  {title: 'Spread', chart: {type: 'histogram', data: {columns: ['Value'], rows: [[1], [2], [5]]}}},
  {title: 'People', table: {columns: ['Team', 'People'], rows: [['Design', 8], ['Sales', 12]]}},
  {title: 'Authored', chart: {type: 'pie', alt: 'Our three regions', data: {columns: ['Region', 'Share'], rows: [['North', 40], ['South', 60]]}}},
  {title: 'Decorative', table: {alt: '', columns: ['A'], rows: [['1']]}}
]};
{
  const bytes = await toPptx(structuredClone(deck), {});
  const names = cNvPrs(bytes);
  assert.equal(names.get('OPF chart 1').descr, 'Column chart: Sales and Cost by Quarter, 2 categories');
  assert.equal(names.get('OPF chart 2').descr, 'Histogram chart: Value, 3 values');
  assert.equal(names.get('OPF table 1').descr, 'Table: Team and People; 2 rows');
  assert.equal(names.get('OPF chart 3').descr, 'Our three regions', 'an authored alt wins');
  assert.equal(names.get('OPF table 2').descr, undefined, 'an empty alt stays decorative');
  assert.match(strFromU8(unzipSync(bytes)['ppt/slides/slide5.xml']), /adec:decorative/);
  // The chartex frame's picture fallback carries the same description.
  const spread = strFromU8(unzipSync(bytes)['ppt/slides/slide2.xml']);
  assert.match(spread, /<mc:Fallback>[\s\S]*descr="Histogram chart: Value, 3 values"/);
  checks++;
}

// 3. Import: the generated text is not an alt, with and without provenance; the authored ones return.
for (const provenance of [undefined, false]) {
  const options = provenance === undefined ? {} : {provenance};
  const imported = await stable(deck, options);
  assert.equal(payload(imported.slides[0], 'chart').alt, undefined, `${provenance}: no alt from the generated chart description`);
  assert.equal(payload(imported.slides[1], 'chart').alt, undefined, `${provenance}: no alt from the generated chartex description`);
  assert.equal(payload(imported.slides[2], 'table').alt, undefined, `${provenance}: no alt from the generated table description`);
  assert.equal(payload(imported.slides[3], 'chart').alt, 'Our three regions');
  assert.equal(payload(imported.slides[4], 'table').alt, '');
  checks++;
}
// With full provenance the document returns exactly.
{
  const {$schema: _schema, ...imported} = await fromPptx(await toPptx(structuredClone(deck), {}));
  assert.deepEqual(imported, deck, 'full provenance: the authored document returns');
}
checks++;

// 4. A description edited in PowerPoint is authored text and imports as alt.
{
  const parts = unzipSync(await toPptx(structuredClone(deck), {}));
  parts['ppt/slides/slide1.xml'] = strToU8(strFromU8(parts['ppt/slides/slide1.xml']).replace('descr="Column chart: Sales and Cost by Quarter, 2 categories"', 'descr="Sales grew faster than cost"'));
  assert.equal((await fromPptx(zipSync(parts))).slides[0].chart.alt, 'Sales grew faster than cost');
  checks++;
}

// 4b. (2026-11-13) A generated description that went stale is still not an alt. PowerPoint leaves the description alone when a series
// or a column is renamed, so the import must not keep "…: Sales and Cost by Quarter…" as authored text for a chart that now plots
// "Revenue". The reference series-name contract found this: the import of the renamed series gained an `alt`.
assert.equal(authoredChartAlt('Column chart: Value by Region, 3 categories', generatedChartAlts(regions)), undefined, 'a generated form with other data is stale, not authored');
assert.equal(authoredChartAlt('100% stacked bar chart: A, B, C and 2 more by Year, 1 category', []), undefined);
assert.equal(authoredChartAlt('Scatter chart: Weight against Height, 12 points', []), undefined);
assert.equal(authoredChartAlt('Histogram chart: Value, 24 values', []), undefined);
assert.equal(authoredChartAlt('Two regions, South leads', generatedChartAlts(regions)), 'Two regions, South leads');
assert.equal(authoredChartAlt('Column chart of sales by quarter', []), 'Column chart of sales by quarter', 'a sentence that is not the generated form stays authored');
assert.equal(authoredChartAlt('', []), '', 'decorative stays decorative');
assert.equal(authoredTableAlt('Table: Team and People; 2 rows', 'Table: Squad and People; 2 rows'), undefined);
assert.equal(authoredTableAlt('Table: 1 row', undefined), undefined);
assert.equal(authoredTableAlt('Table of teams and their sizes', 'Table: Team and People; 2 rows'), 'Table of teams and their sizes');
for (const provenance of [undefined, false]) {
  const parts = unzipSync(await toPptx(structuredClone(deck), provenance === undefined ? {} : {provenance}));
  // The first series' name, as PowerPoint writes it after Series.Name is set: a literal in place of the worksheet reference.
  const chartPart = Object.keys(parts).find(name => /^ppt\/charts\/chart\d+\.xml$/.test(name) && strFromU8(parts[name]).includes('<c:v>Sales</c:v>'));
  assert.ok(chartPart, 'the chart part of slide 1');
  const chartXml = strFromU8(parts[chartPart]), series = /<c:ser>[\s\S]*?<\/c:ser>/.exec(chartXml)[0], name = /<c:tx>[\s\S]*?<\/c:tx>/.exec(series)[0];
  parts[chartPart] = strToU8(chartXml.replace(name, '<c:tx><c:v>Revenue</c:v></c:tx>'));
  // A table header retyped on the slide.
  const tableXml = strFromU8(parts['ppt/slides/slide3.xml']);
  assert.ok(tableXml.includes('<a:t>Team</a:t>'));
  parts['ppt/slides/slide3.xml'] = strToU8(tableXml.replace('<a:t>Team</a:t>', '<a:t>Squad</a:t>'));
  const imported = await fromPptx(zipSync(parts));
  const chart = payload(imported.slides[0], 'chart'), table = payload(imported.slides[2], 'table');
  assert.ok(JSON.stringify(chart.data).includes('Revenue'), `${provenance}: the renamed series is imported`);
  assert.equal(chart.alt, undefined, `${provenance}: the stale generated chart description is not an alt`);
  assert.ok(JSON.stringify(table).includes('Squad'), `${provenance}: the renamed column is imported`);
  assert.equal(table.alt, undefined, `${provenance}: the stale generated table description is not an alt`);
  checks++;
}

// 5. Logos and quote photos: the organization's name and the attribution, unless the asset has its own alt; none imports as alt.
{
  const logos = {name: 'Logos', organization: {id: 'acme', name: 'Acme Corporation', logo: image}, design: {footer: {start: {image: 'var:organization.logo'}}},
    slides: [{layout: 'cover', title: 'Welcome'}, {quote: {text: 'Simplicity is prerequisite for reliability.', attribution: 'Edsger Dijkstra', photo: image}}]};
  const bytes = await toPptx(structuredClone(logos), {});
  const names = cNvPrs(bytes);
  assert.equal(names.get('OPF logo').descr, 'Acme Corporation logo');
  assert.equal(names.get('OPF furniture footer start image').descr, 'Acme Corporation logo');
  assert.equal(names.get('OPF quote photo 0').descr, 'Photo of Edsger Dijkstra');
  const imported = await stable(logos);
  assert.deepEqual(imported.slides[1].quote.photo, {src: image}, 'the generated photo description is not an alt');
  assert.deepEqual(imported.organization, logos.organization);
  // An asset alt wins over the generated text.
  const authored = structuredClone(logos);
  authored.slides[1].quote.photo = {src: image, alt: 'Dijkstra at a blackboard'};
  const named = cNvPrs(await toPptx(structuredClone(authored), {}));
  assert.equal(named.get('OPF quote photo 0').descr, 'Dijkstra at a blackboard');
  assert.equal((await fromPptx(await toPptx(structuredClone(authored), {}))).slides[1].quote.photo.alt, 'Dijkstra at a blackboard');
  checks++;
}
console.log(`default-alt: ${checks} checks`);
