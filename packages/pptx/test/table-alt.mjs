// FA-27: Table.alt is the table frame's alternative text (p:nvGraphicFramePr/p:cNvPr/@descr), "" is PowerPoint's decorative marker
// (adec:decorative), and fromPptx reads both back into table.alt. The frame writer and reader are shared with Chart.alt (FA-09).
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {toPptx, fromPptx} from '../dist/index.js';

const decoder = new TextDecoder();
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', preserveOrder: false});
const columns = ['Region', 'Q4'];
const rows = [['North America', 18.1], ['EMEA', 11.5]];

async function roundTrip(document) {
  const bytes = await toPptx({design: {fontScheme: 'roboto'}, ...document});
  const slideXml = decoder.decode(unzipSync(bytes)['ppt/slides/slide1.xml']);
  const imported = (await fromPptx(bytes)).slides[0];
  const tables = [imported.table, ...(imported.blocks ?? []).map(block => block.table)].filter(Boolean);
  return {slideXml, tables, frames: [...slideXml.matchAll(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g)].map(match => match[0]).filter(frame => frame.includes('<a:tbl>'))};
}
const one = table => roundTrip({slides: [{title: 'Revenue', table}]});

const alt = 'North America leads EMEA, $18.1M against $11.5M in Q4 & "EMEA" is flat.';
const escaped = 'North America leads EMEA, $18.1M against $11.5M in Q4 &amp; &quot;EMEA&quot; is flat.';

// 1. descr on the table frame, read back; the table itself is unchanged by the alt.
{
  const {slideXml, tables, frames} = await one({columns, rows, alt});
  assert.equal(frames.length, 1);
  assert.ok(/<p:nvGraphicFramePr><p:cNvPr id="[0-9]+" name="OPF table 1" descr="/.test(frames[0]) && frames[0].includes(`descr="${escaped}"/>`));
  assert.doesNotThrow(() => parser.parse(slideXml));
  assert.equal(tables[0].alt, alt);
  const plain = (await one({columns, rows})).tables[0];
  assert.deepEqual({...tables[0], alt: undefined}, {...plain, alt: undefined});
}

// 2. No alt: no descr, no decorative marker, and import invents none.
{
  const {slideXml, tables} = await one({columns, rows});
  assert.doesNotMatch(slideXml, /<p:cNvPr[^>]*name="OPF table 1"[^>]*descr=/);
  assert.doesNotMatch(slideXml, /adec:decorative/);
  assert.equal('alt' in tables[0], false);
}

// 3. alt "" is PowerPoint's decorative marker, not an empty descr.
{
  const {slideXml, tables, frames} = await one({columns, rows, alt: ''});
  assert.doesNotMatch(slideXml, /descr=/);
  assert.match(frames[0], /<p:cNvPr id="\d+" name="OPF table 1"><a:extLst><a:ext uri="\{C183D7F6-B498-43B3-948B-1728B52AA6E4\}"><adec:decorative xmlns:adec="http:\/\/schemas\.microsoft\.com\/office\/drawing\/2017\/decorative" val="1"\/><\/a:ext><\/a:extLst><\/p:cNvPr>/);
  assert.doesNotThrow(() => parser.parse(slideXml));
  assert.equal(tables[0].alt, '');
}

// 4. A table with styled cells, a dataset-backed table and tables in blocks keep their own alt; a chart beside a table keeps its own.
{
  const styled = await one({columns, rows: [[{value: 'North America', style: {fill: '#FFEEDD', color: '#112233'}}, 18.1], ['EMEA', 11.5]], alt});
  assert.match(styled.frames[0], /descr="North America leads/);
  assert.equal(styled.tables[0].alt, alt);

  const dataset = await roundTrip({datasets: {revenue: {columns, rows}}, slides: [{title: 'Revenue', table: {dataset: 'revenue', alt: 'Q4 by region.'}}]});
  assert.match(dataset.frames[0], /descr="Q4 by region\."/);
  assert.equal(dataset.tables[0].alt, 'Q4 by region.');

  const blocks = await roundTrip({slides: [{title: 'Two', blocks: [{table: {columns, rows, alt: 'First.'}}, {table: {columns, rows}}, {chart: {type: 'column', alt: 'The chart.', data: {columns, rows}}}]}]});
  const descrs = blocks.slideXml.match(/descr="[^"]*"/g);
  assert.deepEqual(descrs, ['descr="First."', 'descr="The chart."']);
  const [first, second] = blocks.tables;
  assert.equal(first.alt, 'First.');
  assert.equal('alt' in second, false);
}

// 5. A PowerPoint table frame with an author's alt text imports it; one with an empty descr (no alt text) imports none.
{
  const bytes = await toPptx({design: {fontScheme: 'roboto'}, slides: [{title: 'Revenue', table: {columns, rows}}]});
  const {zipSync} = await import('fflate');
  const entries = unzipSync(bytes);
  const xml = decoder.decode(entries['ppt/slides/slide1.xml']);
  for (const [descr, expected] of [[' descr="Typed in PowerPoint"', 'Typed in PowerPoint'], [' descr=""', undefined]]) {
    const edited = {...entries, 'ppt/slides/slide1.xml': new TextEncoder().encode(xml.replace(/(<p:cNvPr id="\d+" name="OPF table 1")(\s*\/?>)/, `$1${descr}$2`))};
    const table = (await fromPptx(zipSync(edited))).slides[0].table;
    assert.equal(table.alt, expected);
  }
}

console.log('table alt: descr on the table frame, decorative marker, import');
