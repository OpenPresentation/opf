// RR-54 (opf-pptx#172, native check opf#385): the embedded chart workbook holds every value the chart cache holds, zero
// included, so PowerPoint's Edit Data shows 0 where the chart shows 0 and a refresh from the workbook keeps it.
//
// PptxGenJS 4.0.1 wrote category and bubble values as `values[idx] || ''`, so 0 (and -0) became an empty cell; pptxgenjs-plus
// 4.3.4 (vendored) keeps them (upstream issue #1430). A gap (null, '' or a string that is no number) is a blank cell, never
// `<v></v>` and never `<v>null</v>`: the engine writes a scatter X value as `<v>${val}</v>`, and opf-pptx blanks the `null`
// it gives for an X gap (normalizeNestedZip).
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import PptxGenJS from '../vendor/pptxgenjs/pptxgen.es.js';
import {toPptx} from '../dist/index.js';

const sheetCells = sheet => new Map([...sheet.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)]
  .map(([, column, row, attributes, body]) => [`${column}${row}`, {shared: /\bt="s"/.test(attributes), value: body === undefined ? undefined : /<v>([^<]*)<\/v>/.exec(body)?.[1]}]));
const workbookSheet = parts => {
  const name = Object.keys(parts).find(path => /^ppt\/embeddings\/.*\.xlsx$/.test(path));
  return strFromU8(unzipSync(parts[name])['xl/worksheets/sheet1.xml']);
};
// The cached points of each series reference in the chart part, in order: role -> [[value or undefined per point]].
const caches = (xml, role) => [...xml.matchAll(new RegExp(`<c:${role}>([\\s\\S]*?)</c:${role}>`, 'g'))].map(([, body]) => {
  const count = Number(/<c:ptCount val="(\d+)"\/>/.exec(body)?.[1] ?? 0);
  const values = Array(count).fill(undefined);
  for (const [, index, value] of body.matchAll(/<c:pt idx="(\d+)"><c:v>([^<]*)<\/c:v><\/c:pt>/g)) values[Number(index)] = value;
  return values;
});
const column = index => String.fromCharCode(65 + index);
let checks = 0;

// Rows: a value, 0, -0, a gap (null), an empty string (a gap), a string that is no number (a gap), a value.
const rows = [['a', 5, 1, 2], ['zero', 0, 0, 0], ['negative zero', -0, -0, -0], ['null', null, 2, 3], ['empty', '', 3, 4], ['text', 'n/a', 4, 5], ['b', 3, -0, 0]];
const zeroRows = [1, 2];
const gapRows = [3, 4, 5];

// 1. Every OPF chart type with a classic workbook: the workbook value column equals the cache, 0 included; gaps are blank.
for (const type of ['column', 'bar', 'line', 'area', 'pie', 'doughnut', 'radar', 'scatter']) {
  const bytes = await toPptx({name: 'zeros', slides: [{title: type, chart: {type, data: {columns: ['Case', 'V', 'W', 'Z'], rows}}}]}, {});
  const parts = unzipSync(bytes);
  const chart = strFromU8(parts['ppt/charts/chart1.xml']), sheet = workbookSheet(parts), cells = sheetCells(sheet);
  // Scatter: the X column is column A and the Y series follow; the others: column A holds the categories.
  const series = type === 'scatter' ? [...caches(chart, 'xVal').slice(0, 1), ...caches(chart, 'yVal')] : caches(chart, 'val');
  const first = type === 'scatter' ? 0 : 1;
  assert.ok(series.length >= 1, `${type}: the chart has cached series`);
  series.forEach((values, seriesIndex) => {
    assert.equal(values.length, rows.length, `${type}: series ${seriesIndex} caches one point per row`);
    values.forEach((cached, rowIndex) => {
      const ref = `${column(first + seriesIndex)}${rowIndex + 2}`, cell = cells.get(ref);
      assert.ok(cell && !cell.shared, `${type}: ${ref} is a value cell`);
      if (cached === undefined) assert.equal(cell.value, undefined, `${type}: ${ref} is a gap in the cache and a blank cell in the workbook`);
      else assert.equal(cell.value, cached, `${type}: ${ref} holds the cached value ${cached}`);
    });
    for (const rowIndex of zeroRows) assert.equal(values[rowIndex], '0', `${type}: series ${seriesIndex} caches 0 for row ${rowIndex} (-0 is written as 0)`);
    if (seriesIndex === 0) for (const rowIndex of gapRows) assert.equal(values[rowIndex], undefined, `${type}: row ${rowIndex} of the first column is a gap`);
  });
  assert.doesNotMatch(sheet, /<v>(?:null|undefined|NaN|-0)?<\/v>/, `${type}: no empty, null, NaN or -0 value cell`);
  checks += 1;
}

// 2. The vendored engine alone (bubble has no OPF chart type): zero values and sizes are kept in every family it writes.
{
  const engine = async (type, data) => {
    const pptx = new PptxGenJS();
    pptx.addSlide().addChart(type, data, {x: 1, y: 1, w: 4, h: 3});
    return cellsOf(unzipSync(new Uint8Array(await pptx.write({outputType: 'uint8array'}))));
  };
  const cellsOf = parts => sheetCells(workbookSheet(parts));
  const category = await engine('bar', [{name: 'V', labels: ['a', 'b', 'c', 'd'], values: [5, 0, -0, null]}]);
  assert.deepEqual(['B2', 'B3', 'B4'].map(ref => category.get(ref).value), ['5', '0', '0'], 'category: 0 and -0 are kept');
  assert.ok(['', undefined].includes(category.get('B5').value), 'category: a null value is no number');
  const scatter = await engine('scatter', [{name: 'X', values: [1, 0, -0, 4]}, {name: 'Y', values: [0, 5, -0, null]}]);
  assert.deepEqual(['A2', 'A3', 'A4', 'B2', 'B3', 'B4'].map(ref => scatter.get(ref).value), ['1', '0', '0', '0', '5', '0'], 'scatter: X and Y zeros are kept');
  const bubble = await engine('bubble', [{name: 'X', values: [1, 0, 3]}, {name: 'Y', values: [0, -0, 2], sizes: [0, 4, -0]}]);
  assert.deepEqual(['A2', 'A3', 'B2', 'B3', 'B4', 'C2', 'C4'].map(ref => bubble.get(ref).value), ['1', '0', '0', '0', '2', '0', '0'], 'bubble: X, Y and size zeros are kept');
  checks += 1;
}

console.log(`Chart workbook values: ${checks} checks passed (8 OPF chart types and the engine's category, scatter and bubble workbooks keep 0; gaps are blank cells).`);
