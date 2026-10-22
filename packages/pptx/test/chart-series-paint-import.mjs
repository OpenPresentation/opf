import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';

const encoder = new TextEncoder(), decoder = new TextDecoder();
const source = {design: {fontScheme: 'roboto'}, slides: [
  {title: 'Current chart', chart: {type: 'line', data: {columns: ['Month', 'Demand', 'Supply'], rows: [['Jan', 10, 7], ['Feb', 20, 9], ['Mar', 15, 8]]}, highlight: {series: ['Demand']}}},
  {title: 'Untouched control', text: 'Keep current words.', table: {columns: ['Name', 'Value'], rows: [['Kept', '42']]}}
]};
const entries = unzipSync(await toPptx(source)), chartPath = 'ppt/charts/chart1.xml';
const originalXml = decoder.decode(entries[chartPath]);
// This project-authored archive has one own c:spPr before each line series' marker. Only that current paint is changed.
function archive(paints, xml = originalXml) {
  let index = 0;
  const changed = xml.replace(/<c:ser>([\s\S]*?)<\/c:ser>/g, (_, body) => {
    const properties = /<c:spPr>[\s\S]*?<\/c:spPr>/.exec(body);
    assert.ok(properties && properties.index < body.indexOf('<c:marker>'), 'Generated own series properties precede marker properties');
    const paint = paints[index++];
    return `<c:ser>${body.replace(properties[0], paint === undefined ? '' : `<c:spPr><a:ln>${paint}</a:ln></c:spPr>`)}</c:ser>`;
  });
  assert.equal(index, 2);
  const copy = {...entries, [chartPath]: encoder.encode(changed)};
  for (const name of Object.keys(entries)) if (name !== chartPath) assert.deepEqual(copy[name], entries[name], name);
  return zipSync(copy);
}
const read = async bytes => {
  const diagnostics = [], document = await fromPptx(bytes, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {document, paint: diagnostics.filter(diagnostic => diagnostic.code === 'chart-option-adapted' && /^series\.\d+\.line\.color$/.test(diagnostic.option))};
};
const baseline = await read(archive([]));
assert.deepEqual(baseline.paint, [], 'No explicit current paint has no series-color warning');
const chart = baseline.document.slides[0].chart ?? baseline.document.slides[0].blocks.find(block => block.chart)?.chart;
assert.deepEqual(chart.highlight, source.slides[0].chart.highlight, 'Full-provenance semantic highlight remains meaningful in the control');
for (const [label, paints, indices] of [
  ['current first-series scheme', ['<a:solidFill><a:schemeClr val="accent4"/></a:solidFill>'], [0]],
  ['current second-series direct', [undefined, '<a:solidFill><a:srgbClr val="7BDBB2"/></a:solidFill>'], [1]],
  ['both current series', ['<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>', '<a:solidFill><a:srgbClr val="2874A6"/></a:solidFill>'], [0, 1]],
  ['empty line', [''], []],
  ['no fill', ['<a:noFill/>'], []],
  ['empty solid fill', ['<a:solidFill/>'], []],
  ['gradient outside bounded solid diagnostic', ['<a:gradFill><a:gsLst/></a:gradFill>'], []]
]) {
  const result = await read(archive(paints));
  assert.deepEqual(result.paint.map(({option, path}) => ({option, path})), indices.map(index => ({option: `series.${index}.line.color`, path: `slides.0.charts.0.series.${index}.line.color`})), label);
  assert.deepEqual(result.document, baseline.document, `${label}: current data/design/highlight/provenance and unrelated objects unchanged`);
  for (const diagnostic of result.paint) {
    assert.ok(diagnostic.message.includes(diagnostic.option.includes('.0.') ? "'Demand'" : "'Supply'"), label);
    assert.match(diagnostic.message, /not retained as per-series formatting/);
  }
}
// Same current explicit paint is diagnosed independently of source metadata or prior paint identity.
const bareEntries = unzipSync(await toPptx(source, {provenance: false}));
const bare = await fromPptx(zipSync(bareEntries));
assert.equal((bare.slides[0].chart ?? bare.slides[0].blocks.find(block => block.chart)?.chart).highlight, undefined);
const bareDiagnostics = [];
await fromPptx(zipSync(bareEntries), {onDiagnostic: diagnostic => bareDiagnostics.push(diagnostic)});
assert.equal(bareDiagnostics.filter(diagnostic => /^series\.\d+\.line\.color$/.test(diagnostic.option ?? '')).length, 2, 'Current line paint is diagnosed without source provenance');
// Mixed charts retain their series order: only the line series' paint gets this bounded warning.
const comboSource = {design: source.design, slides: [{title: 'Mixed current chart', chart: {...source.slides[0].chart, type: 'combo', line: ['Supply'], highlight: undefined}}]};
const comboDiagnostics = [];
await fromPptx(await toPptx(comboSource), {onDiagnostic: diagnostic => comboDiagnostics.push(diagnostic)});
assert.deepEqual(comboDiagnostics.filter(diagnostic => /^series\.\d+\.line\.color$/.test(diagnostic.option ?? '')).map(diagnostic => [diagnostic.option, diagnostic.path]), [['series.1.line.color', 'slides.0.charts.0.series.1.line.color']], 'Column-series paint is outside the line-only diagnostic');
console.log('Chart-series solid paint import: current scheme/direct first/second series paths, no/empty/non-solid controls, unchanged data/design/highlight/provenance and unrelated slide. No native or pixel claim.');
