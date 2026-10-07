// RR-35: chart options (axis titles, legend position, data labels) in the PPTX export and import.
//
// Asserts the native parts a chart with options gets (classic c:title / c:legendPos / c:dLbls and the chartex cx:title /
// cx:legend / cx:dataLabels), that those parts are well-formed and in schema order, that fromPptx reads every option back, that a
// chart without options is unchanged, and (parity) that the preview (opf-render) and the exported chart agree on the legend
// side, the axis titles and the data label content for the same deck.
import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {chartOptionSupport, chartOptionTarget} from '@openpresentation/opf';
import {renderSvg} from '@openpresentation/opf-render';
import {toPptx, fromPptx} from '../dist/index.js';

const decoder = new TextDecoder();
const data = {columns: ['Quarter', 'North', 'South'], rows: [['Q1', 10, 5], ['Q2', 20, 8], ['Q3', 15, 12], ['Q4', 22, 9]]};
const scatterData = {columns: ['Point', 'Spend', 'Revenue'], rows: [['a', 1, 10], ['b', 2, 14], ['c', 4, 19]]};
const single = {columns: ['Quarter', 'Revenue'], rows: [['Q1', 10], ['Q2', 20], ['Q3', 15]]};
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', preserveOrder: false});

async function exportDeck(chart, options = {}) {
  const diagnostics = [];
  const bytes = await toPptx({design: {fontScheme: 'roboto'}, slides: [{title: 'Chart', chart}]}, {onDiagnostic: d => diagnostics.push(d), ...options});
  const entries = unzipSync(bytes);
  const parts = Object.fromEntries(Object.entries(entries).filter(([name]) => /^ppt\/charts\/(chart|chartEx)\d+\.xml$/.test(name)).map(([name, bytes]) => [name, decoder.decode(bytes)]));
  const imported = (await fromPptx(bytes, {onDiagnostic: d => diagnostics.push({...d, phase: 'import'})})).slides[0];
  return {bytes, entries, parts, classic: parts['ppt/charts/chart1.xml'], chartex: parts['ppt/charts/chartEx1.xml'], diagnostics, imported: imported.chart ?? imported.blocks?.find(block => block.chart)?.chart};
}

// Every part parses as XML.
async function assertWellFormed(parts, label) {
  for (const [name, xml] of Object.entries(parts)) assert.doesNotThrow(() => parser.parse(xml), `${label}: ${name} is well-formed XML`);
}

// CT_DLbls child order after the point entries: numFmt, spPr, txPr, dLblPos, showLegendKey, showVal, showCatName, showSerName,
// showPercent, showBubbleSize, separator, showLeaderLines.
const DLBLS_ORDER = ['c:numFmt', 'c:spPr', 'c:txPr', 'c:dLblPos', 'c:showLegendKey', 'c:showVal', 'c:showCatName', 'c:showSerName', 'c:showPercent', 'c:showBubbleSize', 'c:separator', 'c:showLeaderLines'];
function assertDLblsOrder(xml, label) {
  for (const [, block] of xml.matchAll(/<c:dLbls>([\s\S]*?)<\/c:dLbls>/g)) {
    const rest = block.replace(/<c:dLbl>[\s\S]*?<\/c:dLbl>/g, '');
    const names = [...rest.replace(/<c:txPr>[\s\S]*?<\/c:txPr>/g, '<c:txPr/>').replace(/<c:spPr>[\s\S]*?<\/c:spPr>/g, '<c:spPr/>').matchAll(/<(c:\w+)\b/g)].map(match => match[1]);
    const indexes = names.map(name => DLBLS_ORDER.indexOf(name));
    assert.ok(indexes.every(index => index >= 0), `${label}: only CT_DLbls children (${names.join(', ')})`);
    assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b), `${label}: CT_DLbls order (${names.join(', ')})`);
  }
  for (const [, point] of xml.matchAll(/<c:dLbl>([\s\S]*?)<\/c:dLbl>/g)) {
    const names = [...point.replace(/<c:txPr>[\s\S]*?<\/c:txPr>/g, '<c:txPr/>').replace(/<c:spPr>[\s\S]*?<\/c:spPr>/g, '<c:spPr/>').matchAll(/<(c:\w+)\b/g)].map(match => match[1]);
    const order = ['c:idx', ...DLBLS_ORDER.slice(0, 10), 'c:separator'];
    const indexes = names.map(name => order.indexOf(name));
    assert.ok(indexes.every(index => index >= 0) && indexes.every((index, i) => i === 0 || index > indexes[i - 1]), `${label}: CT_DLbl order (${names.join(', ')})`);
  }
}

const flags = block => ({
  value: /<c:showVal val="1"\/>/.test(block), category: /<c:showCatName val="1"\/>/.test(block), percent: /<c:showPercent val="1"\/>/.test(block),
  position: block.match(/<c:dLblPos val="(\w+)"\/>/)?.[1], separator: block.match(/<c:separator>([^<]*)<\/c:separator>/)?.[1],
});
const seriesBlocks = xml => [...xml.matchAll(/<c:ser>([\s\S]*?)<\/c:ser>/g)].map(match => match[1].match(/<c:dLbls>([\s\S]*?)<\/c:dLbls>/)?.[0]);

// 1. A chart without options writes the same chart parts as before: no axis titles, the default legend, labels hidden.
for (const type of ['column', 'bar', 'line', 'area', 'pie', 'doughnut', 'scatter', 'radar', 'stacked-column']) {
  const result = await exportDeck({type, data: type === 'scatter' ? scatterData : data});
  assert.doesNotMatch(result.classic, /<c:title>/, `${type}: no axis title by default`);
  assert.deepEqual([...result.classic.matchAll(/<c:showVal val="(\d)"\/>/g)].map(match => match[1]).filter(value => value === '1'), [], `${type}: no label is shown by default`);
  assert.equal(result.classic.match(/<c:legendPos val="(\w)"\/>/)?.[1], type === 'scatter' ? undefined : 'r', `${type}: default legend`);
  assert.deepEqual(result.imported.axisTitles, undefined);
  assert.equal(result.imported.legend, undefined, `${type}: the default legend imports as no option`);
  assert.equal(result.imported.dataLabels, undefined, `${type}: hidden labels import as no option`);
  assert.deepEqual(result.diagnostics.filter(d => d.code === 'chart-option-adapted'), []);
}
{
  // Inert option values change nothing, byte for byte.
  const plain = await exportDeck({type: 'column', data}), inert = await exportDeck({type: 'column', data, dataLabels: false, axisTitles: {}});
  assert.equal(inert.classic, plain.classic);
  assert.deepEqual(Object.keys(inert.entries).sort(), Object.keys(plain.entries).sort());
}

// 2. Axis titles: native c:title on the right axes, XML-escaped, read back.
{
  const result = await exportDeck({type: 'column', data, axisTitles: {category: 'Quarter & year', value: 'Revenue <$M>'}});
  await assertWellFormed(result.parts, 'column titles');
  const cat = result.classic.match(/<c:catAx>[\s\S]*?<\/c:catAx>/)[0], val = result.classic.match(/<c:valAx>[\s\S]*?<\/c:valAx>/)[0];
  assert.match(cat, /<c:title>[\s\S]*<a:t>Quarter &amp; year<\/a:t>[\s\S]*<c:overlay val="0"\/>/);
  assert.match(val, /<c:title>[\s\S]*<a:t>Revenue &lt;\$M&gt;<\/a:t>/);
  assert.deepEqual(result.imported.axisTitles, {category: 'Quarter & year', value: 'Revenue <$M>'});
  // A bar chart's category axis is c:catAx too (vertical): the OPF category title stays the category axis.
  const bar = await exportDeck({type: 'bar', data, axisTitles: {category: 'Region', value: 'Sales'}});
  assert.match(bar.classic.match(/<c:catAx>[\s\S]*?<\/c:catAx>/)[0], /<a:t>Region<\/a:t>/);
  assert.deepEqual(bar.imported.axisTitles, {category: 'Region', value: 'Sales'});
  // Scatter: both axes are c:valAx, X first.
  const scatter = await exportDeck({type: 'scatter', data: scatterData, axisTitles: {category: 'Spend', value: 'Revenue'}});
  const axes = [...scatter.classic.matchAll(/<c:valAx>[\s\S]*?<\/c:valAx>/g)].map(match => match[0]);
  assert.equal(axes.length, 2);
  assert.match(axes[0], /<a:t>Spend<\/a:t>/);
  assert.match(axes[1], /<a:t>Revenue<\/a:t>/);
  assert.deepEqual(scatter.imported.axisTitles, {category: 'Spend', value: 'Revenue'});
  // A type with no axes adapts and says so.
  const pie = await exportDeck({type: 'pie', data, axisTitles: {category: 'x'}});
  assert.doesNotMatch(pie.classic, /<c:title>/);
  assert.deepEqual(pie.diagnostics.filter(d => d.code === 'chart-option-adapted').map(d => [d.option, d.path]), [['axisTitles.category', 'slides.0.chart.axisTitles.category']]);
}

// 3. Legend position.
for (const position of ['top', 'bottom', 'left', 'right']) {
  const result = await exportDeck({type: 'column', data, legend: position});
  assert.equal(result.classic.match(/<c:legendPos val="(\w)"\/>/)[1], {top: 't', bottom: 'b', left: 'l', right: 'r'}[position]);
  assert.equal(result.imported.legend, position === 'right' ? undefined : position, `${position}: round trip (right is the multi-series default)`);
}
{
  const none = await exportDeck({type: 'column', data, legend: 'none'});
  assert.doesNotMatch(none.classic, /<c:legend>/);
  assert.equal(none.imported.legend, 'none');
  const oneSeries = await exportDeck({type: 'column', data: single, legend: 'bottom'});
  assert.equal(oneSeries.classic.match(/<c:legendPos val="(\w)"\/>/)[1], 'b', 'a named position shows a single-series legend');
  assert.equal(oneSeries.imported.legend, 'bottom');
  const plainOne = await exportDeck({type: 'column', data: single});
  assert.doesNotMatch(plainOne.classic, /<c:legend>/);
  assert.equal(plainOne.imported.legend, undefined);
  const pieNone = await exportDeck({type: 'pie', data, legend: 'none'});
  assert.doesNotMatch(pieNone.classic, /<c:legend>/);
  assert.equal(pieNone.imported.legend, 'none', 'a pie legend is the default, so none is recorded');
  const pieRight = await exportDeck({type: 'pie', data, legend: 'right'});
  assert.equal(pieRight.imported.legend, undefined);
}

// 4. Data labels: content, position, separator, number format, text colour; round trip.
{
  const column = await exportDeck({type: 'column', data, dataLabels: true});
  await assertWellFormed(column.parts, 'column labels');
  assertDLblsOrder(column.classic, 'column labels');
  for (const block of [...seriesBlocks(column.classic), column.classic.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, '').match(/<c:dLbls>[\s\S]*?<\/c:dLbls>/)[0]]) {
    assert.deepEqual(flags(block), {value: true, category: false, percent: false, position: 'outEnd', separator: ', '});
    assert.match(block, /<c:numFmt formatCode="General" sourceLinked="0"\/>/, 'General number format');
  }
  assert.equal(column.imported.dataLabels, true);

  const cases = [
    ['column', {content: ['category', 'value'], position: 'inside-end', separator: ' | '}, {value: true, category: true, percent: false, position: 'inEnd', separator: ' | '}],
    ['column', {position: 'center'}, {value: true, category: false, percent: false, position: 'ctr', separator: ', '}],
    ['bar', {position: 'inside-base'}, {value: true, category: false, percent: false, position: 'inBase', separator: ', '}],
    ['stacked-column', true, {value: true, category: false, percent: false, position: 'ctr', separator: ', '}],
    ['line', {position: 'below'}, {value: true, category: false, percent: false, position: 'b', separator: ', '}],
    ['line', true, {value: true, category: false, percent: false, position: 't', separator: ', '}],
    ['line-with-markers', {position: 'right', content: ['category']}, {value: false, category: true, percent: false, position: 'r', separator: ', '}],
    ['area', true, {value: true, category: false, percent: false, position: undefined, separator: ', '}],
    ['radar', true, {value: true, category: false, percent: false, position: undefined, separator: ', '}],
    ['scatter', {position: 'above', content: ['category', 'value']}, {value: true, category: true, percent: false, position: 't', separator: ', '}],
    ['pie', {content: ['category', 'percent']}, {value: false, category: true, percent: true, position: 'outEnd', separator: ', '}],
    ['pie', {content: ['value', 'percent'], position: 'center'}, {value: true, category: false, percent: true, position: 'ctr', separator: ', '}],
    ['doughnut', {content: ['percent']}, {value: false, category: false, percent: true, position: undefined, separator: ', '}],
  ];
  for (const [type, dataLabels, expected] of cases) {
    const result = await exportDeck({type, data: type === 'scatter' ? scatterData : data, dataLabels});
    const label = `${type} ${JSON.stringify(dataLabels)}`;
    await assertWellFormed(result.parts, label);
    assertDLblsOrder(result.classic, label);
    const blocks = [...seriesBlocks(result.classic).filter(Boolean), result.classic.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, '').match(/<c:dLbls>[\s\S]*?<\/c:dLbls>/)?.[0]].filter(Boolean);
    assert.ok(blocks.length, `${label}: has a dLbls block`);
    for (const block of blocks) {
      const own = flags(block.replace(/<c:dLbl>[\s\S]*?<\/c:dLbl>/g, ''));
      assert.deepEqual(own, expected, `${label}: flags`);
    }
    assert.deepEqual(result.diagnostics.filter(d => d.code === 'chart-option-adapted' && d.phase !== 'import'), [], `${label}: nothing adapted`);
    const back = result.imported.dataLabels;
    const wanted = dataLabels === true ? true : (() => {
      const out = {...dataLabels};
      // the importer drops what equals the default
      if (out.position === chartOptionSupport(chartOptionTarget(type)).dataLabels.defaultPosition) delete out.position;
      if (out.separator === ', ') delete out.separator;
      return Object.keys(out).length ? out : true;
    })();
    assert.deepEqual(back, wanted, `${label}: round trip`);
  }
  // Pie labels hide per point in PptxGenJS output; the options write a visible label for every point.
  const pie = await exportDeck({type: 'pie', data, dataLabels: {position: 'inside-end', content: ['value']}});
  const points = [...pie.classic.matchAll(/<c:dLbl>([\s\S]*?)<\/c:dLbl>/g)].map(match => match[1]);
  assert.equal(points.length, data.rows.length, 'one c:dLbl per slice');
  assert.ok(points.every(point => /<c:showVal val="1"\/>/.test(point) && /<c:dLblPos val="inEnd"\/>/.test(point)));
  // Inside labels take the contrasting colour per series; outside labels keep the chart text colour.
  const insideColour = xml => [...xml.matchAll(/<c:ser>[\s\S]*?<c:dLbls>[\s\S]*?<a:solidFill><a:srgbClr val="(\w+)"\/>/g)].map(match => match[1]);
  const inside = await exportDeck({type: 'column', data, dataLabels: {position: 'center'}}), outside = await exportDeck({type: 'column', data, dataLabels: {position: 'outside-end'}});
  assert.equal(new Set(insideColour(outside.classic)).size, 1, 'outside labels share the chart text colour');
  assert.ok(insideColour(inside.classic).every(colour => /^[0-9A-F]{6}$/.test(colour)));
  // Unsupported combinations adapt with a diagnostic.
  const stacked = await exportDeck({type: 'stacked-column', data, dataLabels: {position: 'outside-end', content: ['percent', 'value']}});
  assert.deepEqual(stacked.diagnostics.filter(d => d.code === 'chart-option-adapted' && d.phase !== 'import').map(d => d.option).sort(), ['dataLabels.content', 'dataLabels.position']);
  assert.equal(flags(seriesBlocks(stacked.classic)[0]).position, 'ctr');
}

// 5. Chartex constructs.
{
  const waterfall = await exportDeck({type: 'waterfall', data: single, axisTitles: {category: 'Step', value: 'Delta'}, dataLabels: {position: 'inside-end'}});
  await assertWellFormed(waterfall.parts, 'waterfall');
  assert.ok(waterfall.chartex, 'a chartex part is written');
  const axes = [...waterfall.chartex.matchAll(/<cx:axis id="(\d)">([\s\S]*?)<\/cx:axis>/g)];
  // Native check 2026-10-01: PowerPoint empties cx:txData/cx:v text without a cx:f formula, so titles are rich text.
  assert.match(axes.find(axis => axis[1] === '0')[2], /^<cx:catScaling[^>]*\/><cx:title><cx:tx><cx:rich>[\s\S]*<a:t>Step<\/a:t>[\s\S]*<\/cx:rich><\/cx:tx><\/cx:title><cx:tickLabels\/>/);
  assert.match(axes.find(axis => axis[1] === '1')[2], /^<cx:valScaling\/><cx:title><cx:tx><cx:rich>[\s\S]*<a:t>Delta<\/a:t>/);
  assert.doesNotMatch(waterfall.chartex, /<cx:txData><cx:v>(Step|Delta)/, 'no title is written as cached formula text');
  // The importer reads both forms: this exporter's rich text, and txData/cx:v as an earlier build (or Excel) wrote it.
  {
    const oldForm = unzipSync(waterfall.bytes);
    const part = Object.keys(oldForm).find(name => /chartEx1\.xml$/.test(name));
    const swapped = decoder.decode(oldForm[part]).replace(/<cx:tx><cx:rich>[\s\S]*?<a:t>([^<]*)<\/a:t>[\s\S]*?<\/cx:rich><\/cx:tx>/g, '<cx:tx><cx:txData><cx:v>$1</cx:v></cx:txData></cx:tx>');
    assert.match(swapped, /<cx:txData><cx:v>Step<\/cx:v>/);
    oldForm[part] = new TextEncoder().encode(swapped);
    const back = (await fromPptx(zipSync(oldForm))).slides[0];
    assert.deepEqual((back.chart ?? back.blocks?.find(block => block.chart)?.chart).axisTitles, {category: 'Step', value: 'Delta'}, 'txData titles import too');
  }
  assert.match(waterfall.chartex, /<cx:dataLabels pos="inEnd">[\s\S]*<cx:visibility seriesName="0" categoryName="0" value="1"\/><cx:separator>, <\/cx:separator><\/cx:dataLabels>/);
  assert.equal(waterfall.chartex.indexOf('<cx:dataLabels') < waterfall.chartex.indexOf('<cx:dataId'), true, 'dataLabels precede dataId in the series');
  assert.deepEqual(waterfall.imported.axisTitles, {category: 'Step', value: 'Delta'});
  assert.deepEqual(waterfall.imported.dataLabels, {position: 'inside-end'});
  assert.equal(waterfall.imported.type, 'waterfall');

  const plain = await exportDeck({type: 'waterfall', data: single});
  assert.doesNotMatch(plain.chartex, /<cx:title>|<cx:dataLabels/, 'no options, no new chartex elements');
  assert.equal(plain.imported.dataLabels, undefined);

  // The treemap and funnel label their marks by default; dataLabels picks the content, false removes the labels.
  for (const [type, defaults] of [['treemap', 'categoryName="1" value="0"'], ['funnel', 'categoryName="0" value="1"']]) {
    const base = await exportDeck({type, data: single});
    assert.match(base.chartex, new RegExp(`<cx:visibility seriesName="0" ${defaults}/>`), `${type}: default labels`);
    assert.equal(base.imported.dataLabels, undefined, `${type}: default labels import as no option`);
    const off = await exportDeck({type, data: single, dataLabels: false});
    assert.doesNotMatch(off.chartex, /<cx:dataLabels/, `${type}: dataLabels false removes the default labels`);
    assert.equal(off.imported.dataLabels, false, `${type}: and imports as false`);
    const both = await exportDeck({type, data: single, dataLabels: {content: ['category', 'value'], separator: ': '}});
    assert.match(both.chartex, /<cx:visibility seriesName="0" categoryName="1" value="1"\/><cx:separator>: <\/cx:separator>/);
    assert.deepEqual(both.imported.dataLabels, {content: ['category', 'value'], separator: ': '});
  }
  // Box and whisker: the only chartex construct with a legend option.
  const box = await exportDeck({type: 'box-and-whisker', data, legend: 'bottom', axisTitles: {value: 'Spread'}});
  await assertWellFormed(box.parts, 'box');
  assert.match(box.chartex, /<cx:legend pos="b" align="ctr" overlay="0">/);
  assert.equal(box.imported.legend, 'bottom');
  assert.deepEqual(box.imported.axisTitles, {value: 'Spread'});
  const boxDefault = await exportDeck({type: 'box-and-whisker', data});
  assert.match(boxDefault.chartex, /<cx:legend pos="r"/);
  assert.equal(boxDefault.imported.legend, undefined);
  const boxNone = await exportDeck({type: 'box-and-whisker', data, legend: 'none'});
  assert.doesNotMatch(boxNone.chartex, /<cx:legend/);
  assert.equal(boxNone.imported.legend, 'none');
  const funnelLegend = await exportDeck({type: 'funnel', data: single, legend: 'top'});
  assert.doesNotMatch(funnelLegend.chartex, /<cx:legend/);
  assert.deepEqual(funnelLegend.diagnostics.filter(d => d.code === 'chart-option-adapted').map(d => d.option), ['legend']);
}

// 6. Parity: the preview and the exported chart agree on the options for the same deck.
{
  const attributesOf = text => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
  const textGroups = svg => [...svg.matchAll(/<g\b([^>]*data-opf-source-text="true"[^>]*)>([\s\S]*?)<\/g>/g)].map(([, attrs, body]) => {
    const element = /<text\b([^>]*)>/.exec(body);
    const position = element ? attributesOf(element[1]) : {};
    return {path: attributesOf(attrs)['data-opf-path'], text: [...body.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(([, value]) => value).join(''), x: Number(position.x), y: Number(position.y)};
  });
  const plotExtent = svg => {
    const lines = [...svg.matchAll(/<line\b([^>]*)\/>/g)].map(([, a]) => attributesOf(a)).filter(l => l['stroke-opacity'] === '0.7');
    return {left: Math.min(...lines.map(l => Number(l.x1))), right: Math.max(...lines.map(l => Number(l.x2))), top: Math.min(...lines.map(l => Number(l.y1))), bottom: Math.max(...lines.map(l => Number(l.y2)))};
  };
  for (const legend of ['top', 'bottom', 'left', 'right', 'none']) {
    for (const type of ['column', 'bar', 'line']) {
      const chart = {type, data, legend, axisTitles: {category: 'Quarter', value: 'Revenue'}, dataLabels: {content: ['category', 'value'], position: type === 'line' ? 'below' : 'inside-end', separator: ' / '}};
      const svg = renderSvg({design: {fontScheme: 'roboto'}, slides: [{title: 'Chart', chart}]}, {trace: true});
      const groups = textGroups(svg).filter(group => group.path?.startsWith('slides.0.chart'));
      const extent = plotExtent(svg);
      const exported = await exportDeck(chart);
      // Legend: the side of the plot the preview draws it on is the exported c:legendPos.
      const legendEntries = groups.filter(group => /^slides\.0\.chart\.data\.columns\.\d$/.test(group.path));
      const side = !legendEntries.length ? 'none' : legendEntries.every(entry => entry.x < extent.left) ? 'left' : legendEntries.every(entry => entry.x > extent.right - 20) ? 'right'
        : legendEntries.every(entry => entry.y < extent.top) ? 'top' : legendEntries.every(entry => entry.y > extent.bottom) ? 'bottom' : 'inside';
      const nativeSide = exported.classic.match(/<c:legendPos val="(\w)"\/>/)?.[1];
      assert.equal(side, legend, `${type}/${legend}: the preview draws the legend where asked`);
      assert.equal(nativeSide === undefined ? 'none' : {t: 'top', b: 'bottom', l: 'left', r: 'right'}[nativeSide], side, `${type}/${legend}: the export writes the same side`);
      // Axis titles: the same texts.
      assert.equal(groups.find(group => group.path === 'slides.0.chart.axisTitles.category')?.text, 'Quarter');
      assert.equal(groups.find(group => group.path === 'slides.0.chart.axisTitles.value')?.text, 'Revenue');
      assert.match(exported.classic.match(/<c:catAx>[\s\S]*?<\/c:catAx>/)[0], /<a:t>Quarter<\/a:t>/);
      assert.match(exported.classic.match(/<c:valAx>[\s\S]*?<\/c:valAx>/)[0], /<a:t>Revenue<\/a:t>/);
      // Data labels: the preview prints "category / value" for every point; the export shows the same two parts, separated the same way.
      const labels = groups.filter(group => /^slides\.0\.chart\.data\.rows\.\d\.[1-9]$/.test(group.path));
      assert.equal(labels.length, data.rows.length * 2, `${type}/${legend}: one label per point`);
      assert.ok(labels.every(label => / \/ /.test(label.text) && /^Q\d \/ \d+$/.test(label.text)), `${type}/${legend}: category and value`);
      const block = seriesBlocks(exported.classic)[0];
      assert.deepEqual(flags(block), {value: true, category: true, percent: false, position: type === 'line' ? 'b' : 'inEnd', separator: ' / '});
      assert.deepEqual(exported.imported.dataLabels, {content: ['category', 'value'], position: type === 'line' ? 'below' : 'inside-end', separator: ' / '}, `${type}/${legend}: round trip`);
    }
  }
  // Pie percent labels: the preview's integer percent is the number PowerPoint's 0% shows.
  const pie = {type: 'pie', data, dataLabels: {content: ['category', 'percent']}};
  const svg = renderSvg({design: {fontScheme: 'roboto'}, slides: [{title: 'Chart', chart: pie}]}, {trace: true});
  const previewLabels = textGroups(svg).filter(group => /^slides\.0\.chart\.data\.rows\.\d\.1$/.test(group.path)).map(group => group.text);
  const total = data.rows.reduce((sum, row) => sum + row[1], 0);
  assert.deepEqual(previewLabels, data.rows.map(row => `${row[0]}, ${Math.round(row[1] / total * 100)}%`));
  const exported = await exportDeck(pie);
  assert.deepEqual(flags(seriesBlocks(exported.classic)[0]), {value: false, category: true, percent: true, position: 'outEnd', separator: ', '});
}

console.log('Chart options: native c:title, c:legendPos and c:dLbls (and the chartex equivalents) in schema order, read back by fromPptx, unchanged without the fields, and in agreement with the preview.');
