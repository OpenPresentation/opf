import assert from 'node:assert/strict';
import {test} from 'node:test';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {unzipSync, zipSync, strFromU8, strToU8} from 'fflate';
import {composeSlide} from '@openpresentation/opf/composition';
import {chartDrawPlan, resolveChartData} from '@openpresentation/opf';
import {toPptx, fromPptx} from './helpers/default-catalog.mjs';
import {assertSignedParetoComboData} from '../../../scripts/native-acceptance/chart-data-contract.mjs';

const rows = [['North', 42], ['South', 31], ['East', -8], ['West', 19]];
const sorted = [['North', 42, 42 / 92], ['South', 31, 73 / 92], ['West', 19, 1], ['East', -8, 1]];
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '@', parseTagValue: false});
const contracts = {parser: new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: false, parseTagValue: false, trimValues: false}), fflate: {unzipSync, strFromU8}};
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const text = value => typeof value === 'string' ? value : value?.['#text'] ?? '';
const xml = (parts, path) => strFromU8(parts[path]);
const name = column => typeof column === 'string' ? column : column.name;
const chartOf = slide => slide.chart ?? slide.blocks?.find(block => block.chart)?.chart;
function workbook(parts) {
  const path = Object.keys(parts).find(path => /^ppt\/embeddings\/.*\.xlsx$/.test(path));
  const book = unzipSync(parts[path]);
  const strings = array(parser.parse(xml(book, 'xl/sharedStrings.xml')).sst.si).map(entry => text(entry.t));
  const sheet = xml(book, 'xl/worksheets/sheet1.xml');
  assert.doesNotMatch(sheet, /<f(?:\s|>)/, 'cumulative cells are explicit static values, not formulas');
  return array(parser.parse(sheet).worksheet.sheetData.row).map(row => array(row.c).map(cell => cell['@t'] === 's' ? strings[Number(cell.v)] : cell['@t'] === 'inlineStr' ? text(cell.is.t) : Number(cell.v)));
}
const variants = [
  {id: 'inline', chart: {type: 'pareto', data: {columns: ['Region', 'Value'], rows}}},
  {id: 'mapped', chart: {type: 'pareto', data: {columns: ['Value', 'Region', 'Unused'], rows: rows.map(([category, value]) => [value, category, 7])}, mapping: {category: 'Region', series: ['Value']}}},
  {id: 'formatted', chart: {type: 'pareto', data: {columns: ['Region', {name: 'Value', format: '0.0'}], rows}}},
  {id: 'dataset', datasets: {values: {columns: ['Region', 'Value'], rows}}, chart: {type: 'pareto', data: {dataset: 'values'}}},
];
for (const mode of [undefined, 'auto', 'native']) for (const provenance of ['full', 'references-only', false]) for (const variant of variants) {
  test(`signed Pareto ${variant.id}/${mode ?? 'default'}/${provenance}: actual combo caches/workbook/import`, async () => {
    const source = {name: 'Signed Pareto', ...(variant.datasets ? {datasets: variant.datasets} : {}), slides: [{title: 'Signed categories', chart: variant.chart},
      ...(variant.datasets ? [{title: 'Ordinary dataset control', chart: {type: 'column', data: {dataset: 'values'}}}] : [])]};
    const before = structuredClone(source), diagnostics = [];
    const bytes = await toPptx(source, {seed: 1, provenance, ...(mode ? {chartex: mode} : {}), onDiagnostic: issue => diagnostics.push(issue)});
    // Retain the first actual archive before any parser/model assertion when the coordinator assigns a fresh artifact directory.
    if (process.env.OPF_CHART_FIDELITY_ARTIFACTS && mode === undefined && provenance === 'full' && variant.id === 'inline') {
      assert.ok(path.isAbsolute(process.env.OPF_CHART_FIDELITY_ARTIFACTS));
      writeFileSync(path.join(process.env.OPF_CHART_FIDELITY_ARTIFACTS, 'first-signed-pareto-combo.pptx'), bytes, {flag: 'wx'});
    }
    assert.deepEqual(source, before);
    const parts = unzipSync(bytes), chart = xml(parts, 'ppt/charts/chart1.xml');
    assertSignedParetoComboData(parts, 1, {columns: ['Region', 'Value', 'Value — cumulative share'], rows: sorted}, contracts, 'focused signed combo');
    if (mode === undefined && provenance === 'full' && variant.id === 'inline') {
      const expected = {columns: ['Region', 'Value', 'Value — cumulative share'], rows: sorted};
      for (const [label, mutate] of [
        ['missing line', value => value.replace(/<c:lineChart>[\s\S]*?<\/c:lineChart>/, '')],
        ['wrong cache', value => value.replace('<c:v>42</c:v>', '<c:v>999</c:v>')],
        ['wrong percentage bound', value => value.replace('<c:max val="1"/>', '<c:max val="2"/>')],
        ['wrong line association', value => value.replace(/<c:lineChart>[\s\S]*?<\/c:lineChart>/, group => group.replace(/(<c:axId val=")[^"]+/, '$1foreign'))],
      ]) {
        const changed = mutate(chart); assert.notEqual(changed, chart, label + ': actual mutation');
        assert.throws(() => assertSignedParetoComboData({...parts, 'ppt/charts/chart1.xml': strToU8(changed)}, 1, expected, contracts, label));
      }
      const file = Object.keys(parts).find(file => /^ppt\/embeddings\/.*\.xlsx$/.test(file));
      const nested = unzipSync(parts[file]), sheet = xml(nested, 'xl/worksheets/sheet1.xml');
      const changed = sheet.replace('<v>42</v>', '<v>999</v>'); assert.notEqual(changed, sheet);
      nested['xl/worksheets/sheet1.xml'] = strToU8(changed);
      assert.throws(() => assertSignedParetoComboData({...parts, [file]: zipSync(nested)}, 1, expected, contracts, 'wrong workbook'));
    }
    assert.ok(!Object.keys(parts).some(path => /^ppt\/charts\/chartEx/.test(path)), 'no native aggregation hides the negative category');
    assert.match(chart, /<c:barChart>/);
    assert.match(chart, /<c:lineChart>/);
    assert.equal([...chart.matchAll(/<c:ser>/g)].length, 2);
    assert.match(chart, /<c:gapWidth val="6"\/>/);
    assert.match(chart, /<c:symbol val="none"\/>/);
    const values = [...chart.matchAll(/<c:val>[\s\S]*?<c:numCache>[\s\S]*?<c:ptCount[^>]*\/>(([\s\S]*?))<\/c:numCache>[\s\S]*?<\/c:val>/g)].map(match => [...match[1].matchAll(/<c:v>([^<]*)<\/c:v>/g)].map(point => Number(point[1])));
    assert.deepEqual(values, [[42, 31, 19, -8], [42 / 92, 73 / 92, 1, 1]], 'both native caches retain every signed/derived value');
    const axes = [...chart.matchAll(/<c:valAx>[\s\S]*?<\/c:valAx>/g)].map(match => match[0]);
    assert.equal(axes.length, 2);
    assert.ok(axes.some(axis => /<c:min val="0"\/>/.test(axis) && /<c:max val="1"\/>/.test(axis) && /formatCode="0%"/.test(axis)), 'explicit percentage secondary axis');
    assert.deepEqual(workbook(parts).slice(1), sorted);
    const notice = diagnostics.filter(issue => issue.adaptation === 'signed-pareto-combo');
    assert.equal(notice.length, 1);
    assert.match(notice[0].message, /negative.*descending.*static.*Import returns/s);
    assert.ok(!diagnostics.some(issue => issue.adaptation === 'series-dropped'));
    const imported = await fromPptx(bytes), actual = chartOf(imported.slides[0]);
    assert.equal(actual.type, 'combo');
    assert.deepEqual(actual.data.rows, sorted);
    assert.deepEqual(actual.data.columns.map(name), ['Region', 'Value', 'Value — cumulative share']);
    assert.equal(actual.data.columns[2].format, '0%');
    if (variant.id === 'formatted') assert.equal(actual.data.columns[1].format, '0.0');
    if (variant.datasets && provenance === 'full') {
      assert.deepEqual(imported.datasets.values, source.datasets.values, 'ordinary dataset metadata remains preserved');
      assert.deepEqual(chartOf(imported.slides[1]).data, {dataset: 'values'}, 'ordinary data provenance still restores its own reference');
    }
    assert.deepEqual(await toPptx(source, {seed: 1, provenance, ...(mode ? {chartex: mode} : {})}), bytes);
  });
}

test('explicit fallback retains its truthful column-only policy; supported positive and raw-sample Pareto remain native', async () => {
  for (const [data, native] of [
    [{columns: ['Region', 'Value'], rows}, false],
    [{columns: ['Region', 'Value'], rows: rows.map(([category, value]) => [category, Math.abs(value)])}, true],
    [{columns: ['Sample'], rows: [[-8], [-3], [0], [4], [19]]}, true],
  ]) {
    const diagnostics = [], mode = native ? 'native' : 'fallback';
    const bytes = await toPptx({slides: [{chart: {type: 'pareto', data}}]}, {chartex: mode, onDiagnostic: issue => diagnostics.push(issue)});
    const parts = unzipSync(bytes);
    assert.equal(Boolean(parts['ppt/charts/chartEx1.xml']), native);
    assert.equal(diagnostics.some(issue => issue.adaptation === 'signed-pareto-combo'), false);
    if (!native) {
      assert.doesNotMatch(xml(parts, 'ppt/charts/chart1.xml'), /<c:lineChart>/);
      assert.equal(chartOf((await fromPptx(bytes)).slides[0]).type, 'column');
      assert.ok(diagnostics.some(issue => issue.adaptation === 'chartex-fallback'));
    } else assert.match(xml(parts, 'ppt/charts/chartEx1.xml'), /layoutId="paretoLine"/);
  }
});

test('native cache edits keep the actual static combo data, without authored-data restoration', async () => {
  const source = {datasets: {values: {columns: ['Region', 'Value'], rows}}, slides: [{chart: {type: 'pareto', data: {dataset: 'values'}}}]};
  const parts = unzipSync(await toPptx(source));
  const original = xml(parts, 'ppt/charts/chart1.xml');
  const changed = original.replace('<c:v>42</c:v>', '<c:v>43</c:v>');
  assert.notEqual(changed, original);
  parts['ppt/charts/chart1.xml'] = strToU8(changed);
  const actual = chartOf((await fromPptx(zipSync(parts))).slides[0]);
  assert.equal(actual.type, 'combo');
  assert.deepEqual(actual.data.rows, [['North', 43, 42 / 92], ...sorted.slice(1)], 'editing a bar does not fabricate recalculation of static cumulative cells');
});

test('signed Pareto resolves numeric strings/gaps, refuses aggregate overflow and keeps derived headings distinct', async () => {
  const numeric = {type: 'pareto', data: {columns: ['Region', 'Value'], rows: [['North', '42'], ['South', '31'], ['East', '-8'], ['West', '19'], ['Gap', null], ['Invalid', '8 units']]}};
  const before = structuredClone(numeric), plan = chartDrawPlan(numeric, resolveChartData(numeric));
  assert.deepEqual(plan.rows.map(row => row[1]), [42, 31, -8, 19, null, null], 'strict numeric resolution precedes signed-domain detection');
  const issues = [];
  const resolved = chartOf((await fromPptx(await toPptx({slides: [{chart: numeric}]}, {onDiagnostic: issue => issues.push(issue)}))).slides[0]);
  assert.equal(resolved.type, 'combo');
  assert.deepEqual(resolved.data.rows, sorted, 'null/non-numeric gaps follow the renderer rather than becoming zero bars');
  assert.equal(issues.filter(issue => issue.adaptation === 'signed-pareto-combo').length, 1);
  assert.equal(issues.find(issue => issue.code === 'chart-value-not-numeric').count, 1);
  assert.deepEqual(numeric, before);
  await assert.rejects(toPptx({slides: [{chart: {type: 'pareto', data: {columns: ['Region', 'Value'], rows: [['A', 1e308], ['B', 1e308], ['C', -1]]}}}]}), /cumulative total.*finite/i);
  const data = {columns: ['Value — cumulative share', 'Value'], rows};
  const actual = chartOf((await fromPptx(await toPptx({slides: [{chart: {type: 'pareto', data}}]}))).slides[0]);
  assert.deepEqual(actual.data.columns.map(name), ['Value — cumulative share', 'Value', 'Value — cumulative share (2)']);
});

test('categorical histogram fallback uses broad bins and the composed histogram axis, ordinary columns keep their gaps', async () => {
  for (const [type, gap] of [['histogram', 6], ['column', 150], ['stacked-column', 50]]) {
    const chart = {type, data: {columns: ['Region', 'Value'], rows}};
    const source = {slides: [{title: 'Geometry', chart}]};
    const parts = unzipSync(await toPptx(source));
    const part = xml(parts, 'ppt/charts/chart1.xml');
    assert.match(part, new RegExp('<c:gapWidth val="' + gap + '"/>'));
    if (type === 'histogram') {
      const item = composeSlide(source.slides[0], {presentation: source, slideIndex: 0}).items.find(item => item.field === 'chart');
      const axis = item.chart.layer.histogram.valueAxis;
      for (const [key, value] of Object.entries({min: axis.min, max: axis.max, majorUnit: axis.majorUnit})) assert.match(part, new RegExp('<c:' + key + ' val="' + value + '"/>'));
      assert.equal(chartOf((await fromPptx(await toPptx(source))).slides[0]).type, 'column');
    }
  }
});

test('native funnel reports the physical label-color limitation without altering its editable chart', async () => {
  for (const [mode, labels, expected] of [['native', undefined, 1], ['auto', true, 1], ['native', false, 0], ['fallback', true, 0]]) {
    const diagnostics = [];
    const source = {slides: [{chart: {type: 'funnel', data: {columns: ['Stage', 'Value'], rows: [['A', 42], ['B', 31]]}, ...(labels === undefined ? {} : {dataLabels: labels})}}]};
    const bytes = await toPptx(source, {chartex: mode, onDiagnostic: issue => diagnostics.push(issue)});
    const notices = diagnostics.filter(issue => issue.code === 'export-lossy' && issue.feature === 'funnel-label-color');
    assert.equal(notices.length, expected);
    if (expected) assert.match(notices[0].message, /PowerPoint.*white.*black.*editable.*XML/s);
    const parts = unzipSync(bytes);
    assert.equal(Boolean(parts['ppt/charts/chartEx1.xml']), mode !== 'fallback');
    assert.equal(chartOf((await fromPptx(bytes)).slides[0]).type, mode === 'fallback' ? 'column' : 'funnel');
  }
});
