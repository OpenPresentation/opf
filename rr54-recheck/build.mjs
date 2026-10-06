// RR-54 re-check probe set (opf-pptx#171 format re-spelling fix, opf-pptx#172 workbook zero values).
// node build.mjs <c4-after> <c4-before> <c2-after> <c2-before>
//   c4-after  = opf-pptx codex/rr-54-chart-table-data b076bb6 (the canonical format hash), core opf#376 linked
//   c4-before = opf-pptx f0ea480 (#171 before the fix), core opf#376 linked
//   c2-after  = opf-pptx codex/rr-54-workbook-zero-values 4baa171 (on #165 pptxgenjs-plus), core 0.12.0 from npm
//   c2-before = opf-pptx main 7c93a1b (PptxGenJS 4.0.1), core 0.12.0 from npm
// Each checkout needs node_modules and a built dist/. Writes decks/*.pptx, decks/*.opf.json and manifest.json.
import {createHash} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {realpathSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

const dirs = Object.fromEntries(['c4-after', 'c4-before', 'c2-after', 'c2-before'].map((key, index) => [key, path.resolve(process.argv[2 + index])]));
const load = dir => import(pathToFileURL(path.join(dir, 'dist/index.js')).href);
const fflate = await import(pathToFileURL(path.join(dirs['c2-after'], 'node_modules/fflate/esm/index.mjs')).href);
const head = dir => execFileSync('git', ['-C', dir, 'rev-parse', '--short', 'HEAD']).toString().trim();
const coreVersion = dir => JSON.parse(execFileSync('node', ['-p', `JSON.stringify(require(${JSON.stringify(path.join(dir, 'node_modules/@openpresentation/opf/package.json'))}))`]).toString()).version;
// The core commit when core is linked from a checkout (link-ecosystem), else 'npm'.
const coreCommit = dir => { const core = realpathSync(path.join(dir, 'node_modules/@openpresentation/opf')); if (core.includes(`${path.sep}node_modules${path.sep}`)) return 'npm'; try { return execFileSync('git', ['-C', core, 'rev-parse', '--short=8', 'HEAD'], {stdio: ['ignore', 'pipe', 'ignore']}).toString().trim(); } catch { return 'npm'; } };
const OPTIONS = {seed: 1, timestamp: '2026-10-05T00:00:00Z', zipDate: '2026-10-05T00:00:00Z'};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

// C4: a plain PowerPoint save re-spells the format codes ($ -> \$, ' "unit"' -> '\ "unit"'); the re-import must restore
// every chart and table record. No zero values (the #171 branch is not on pptxgenjs-plus yet).
const formats = {
  name: 'RR-54 formats (re-check)',
  slides: [
    {title: 'Column: currency, percent, units', chart: {type: 'column', dataLabels: true, data: {columns: ['Quarter', {name: 'Revenue', format: '$#,##0.0'}, {name: 'Margin', format: '0%'}, {name: 'Units', format: '#,##0 units'}], rows: [['Q1', 12.4, 0.31, 1200], ['Q2', 18.1, 0.34, 1800], ['Q3', null, 0.29, 2400], ['Q4', 24.6, 0.4, 3100]]}}},
    {title: 'Line: two-decimal percent', chart: {type: 'line', dataLabels: true, data: {columns: ['Month', {name: 'Rate', format: '0.00%'}], rows: [['Jan', 0.0125], ['Feb', 0.0131], ['Mar', 0.0142], ['Apr', 0.0139]]}}},
    {title: 'Scatter: named points, kg and $', chart: {type: 'scatter', dataLabels: true, data: {columns: ['Point', {name: 'Weight', format: '0.0 kg'}, {name: 'Price', format: '$#,##0'}], rows: [['a', 1.5, 1200], ['b', 2.5, 1850], ['c', 3.5, 2400]]}}},
    {title: 'Pie: currency', chart: {type: 'pie', data: {columns: ['Region', {name: 'Sales', format: '$#,##0'}], rows: [['EMEA', 4200], ['APAC', 3100], ['AMER', 5600]]}}},
    {title: 'Treemap: one decimal', chart: {type: 'treemap', dataLabels: true, data: {columns: ['Area', {name: 'Size', format: '#,##0.0'}], rows: [['A', 5.3], ['B', 3.1], ['C', 2.2]]}}},
    {title: 'Bar: exploratory spellings (euro prefix, slash and hyphen units)', chart: {type: 'bar', dataLabels: true, data: {columns: ['Item', {name: 'Price', format: '€#,##0.00'}, {name: 'Speed', format: '0.0 m/s'}, {name: 'Delta', format: '+0.0 pts'}], rows: [['x', 12.5, 3.2, 1.5], ['y', 7.25, 4.8, 2.25]]}}},
  ],
};
const datasets = {
  name: 'RR-54 datasets (re-check)',
  datasets: {
    sales: {title: 'Sales by region', columns: ['Region', {name: 'Sales', format: '$#,##0'}, {name: 'Units', format: '#,##0 units'}, {name: 'Share', format: '0.0%'}], rows: [['EMEA', 4200, 120, 0.33], ['APAC', 3100, 80, 0.24], ['AMER', 5600, 150, 0.43]], source: {src: './sales.csv', retrieved: '2026-10-05'}},
    spare: {columns: ['a', 'b'], rows: [['x', 1]]},
  },
  slides: [
    {title: 'Dataset column (fields)', chart: {type: 'column', dataLabels: true, data: {dataset: 'sales', fields: ['Region', 'Sales']}}},
    {title: 'Line with mapping', chart: {type: 'line', mapping: {category: 'Region', series: ['Units', 'Sales']}, data: {dataset: 'sales'}}},
    {title: 'Dataset table', table: {dataset: 'sales', fields: ['Region', 'Sales', 'Share']}},
    {title: 'Doughnut from the dataset', chart: {type: 'doughnut', data: {dataset: 'sales', fields: ['Region', 'Units']}}},
    {title: 'Radar from the dataset', chart: {type: 'radar', data: {dataset: 'sales', fields: ['Region', 'Share']}}},
    {title: 'Box and whisker (chartex)', chart: {type: 'box-and-whisker', data: {columns: ['Group', {name: 'Score', format: '0.0 pts'}], rows: [['A', 4.5], ['A', 6.25], ['A', 5.5], ['B', 7.5], ['B', 8.25], ['B', 6.75]]}}},
  ],
};
// C2: zero values in the embedded workbook (Edit Data). 0 and -0 must read 0; gaps (null, '') must read empty.
const zeroRows = [['a', 5, 1], ['zero', 0, 0], ['negative zero', -0, -0], ['gap', null, 2], ['empty', '', 3], ['b', 3, 0]];
const zeros = {
  name: 'RR-54 zero values (Edit Data)',
  slides: [
    ...['column', 'bar', 'line', 'area', 'radar'].map(type => ({title: `${type}: 5, 0, -0, gap, empty, 3`, chart: {type, dataLabels: true, data: {columns: ['Case', 'V', 'W'], rows: zeroRows}}})),
    ...['pie', 'doughnut'].map(type => ({title: `${type}: a zero slice`, chart: {type, data: {columns: ['Case', 'V'], rows: [['a', 5], ['zero', 0], ['b', 3]]}}})),
    {title: 'scatter: X 0, X gap, Y 0 and -0', chart: {type: 'scatter', dataLabels: true, data: {columns: ['Point', 'X', 'Y'], rows: [['a', 1, 5], ['b', 0, 0], ['c', null, 2], ['d', 3, -0], ['e', 4, 0]]}}},
  ],
};

const DECKS = {
  'c4-formats': {check: 'C4', document: formats, builds: ['c4-after', 'c4-before']},
  'c4-datasets': {check: 'C4', document: datasets, builds: ['c4-after', 'c4-before']},
  'c2-zeros': {check: 'C2', document: zeros, builds: ['c2-after', 'c2-before']},
};

const cachePoints = body => {
  const count = Number(/<c:ptCount val="(\d+)"\/>/.exec(body)?.[1] ?? 0);
  const values = Array(count).fill(null);
  for (const [, index, value] of body.matchAll(/<c:pt idx="(\d+)"><c:v>([^<]*)<\/c:v><\/c:pt>/g)) values[Number(index)] = Number(value);
  return values;
};
// Expected Edit Data cells: the chart cache of every value column, by worksheet cell (category charts: B.., scatter: A..).
function workbookExpectation(parts) {
  const charts = [];
  for (const name of Object.keys(parts).filter(part => /^ppt\/slides\/slide\d+\.xml$/.test(part)).sort((a, b) => Number(/\d+/.exec(a)[0]) - Number(/\d+/.exec(b)[0]))) {
    const slide = Number(/slide(\d+)\.xml$/.exec(name)[1]);
    const rels = fflate.strFromU8(parts[name.replace('slides/', 'slides/_rels/') + '.rels']);
    const target = /Target="(?:\.\.\/charts\/|\/ppt\/charts\/)(chart\d+\.xml)"/.exec(rels)?.[1];
    if (!target) continue;
    const xml = fflate.strFromU8(parts[`ppt/charts/${target}`]);
    const scatter = xml.includes('<c:scatterChart>');
    const columns = scatter ? [...[...xml.matchAll(/<c:xVal>([\s\S]*?)<\/c:xVal>/g)].slice(0, 1), ...xml.matchAll(/<c:yVal>([\s\S]*?)<\/c:yVal>/g)] : [...xml.matchAll(/<c:val>([\s\S]*?)<\/c:val>/g)];
    const cells = {};
    columns.forEach(([, body], index) => cachePoints(body).forEach((value, row) => { cells[`${String.fromCharCode((scatter ? 65 : 66) + index)}${row + 2}`] = value; }));
    charts.push({slide, chart: target, scatter, cells});
  }
  return charts;
}

await mkdir('decks', {recursive: true});
const manifest = {
  item: 'RR-54 native re-check: format re-spelling on save (opf-pptx#171 b076bb6) and zero values in the chart workbook (opf-pptx#172)',
  builds: Object.fromEntries(Object.entries(dirs).map(([key, dir]) => [key, {commit: head(dir), core: coreVersion(dir), coreCommit: coreCommit(dir)}])),
  options: OPTIONS,
  decks: {},
};
for (const [id, deck] of Object.entries(DECKS)) {
  await writeFile(`decks/${id}.opf.json`, JSON.stringify(deck.document, null, 2) + '\n');
  const entry = manifest.decks[id] = {check: deck.check, document: `decks/${id}.opf.json`, files: {}};
  for (const build of deck.builds) {
    const {toPptx, fromPptx} = await load(dirs[build]);
    const bytes = await toPptx(structuredClone(deck.document), OPTIONS);
    const file = `${id}-${build.endsWith('after') ? 'after' : 'before'}.pptx`;
    await writeFile(`decks/${file}`, bytes);
    const record = entry.files[file] = {build, commit: head(dirs[build]), bytes: bytes.length, sha256: sha(bytes)};
    if (deck.check === 'C2') record.workbook = workbookExpectation(fflate.unzipSync(bytes));
    else {
      // The offline re-import of the unsaved deck: what the saved copy must re-import as (reimport.mjs).
      const diagnostics = [];
      const imported = await fromPptx(bytes, {onDiagnostic: item => diagnostics.push(item)});
      const payloads = imported.slides.map(slide => slide.chart ?? slide.table ?? null);
      record.reimport = {datasets: imported.datasets ?? null, payloadsSha256: sha(JSON.stringify(payloads)), dataDiagnostics: diagnostics.filter(item => /data-provenance|dataset-unavailable/.test(item.code)).map(item => item.code)};
    }
  }
}
await writeFile('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(Object.values(manifest.decks).flatMap(deck => Object.entries(deck.files).map(([file, record]) => `${file} ${record.sha256.slice(0, 12)} ${record.bytes} B`)).join('\n'));
