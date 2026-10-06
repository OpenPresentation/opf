// FF-22b: the seven chartex chart types export as native Office 2016 chartex
// parts (cx:chartSpace) wrapped in mc:AlternateContent with the classic
// clustered column chart as fallback, agree with the core catalog, round-trip
// through fromPptx and stay deterministic.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {catalogs} from '@openpresentation/opf';
import {fromPptx, toPptx} from '../dist/index.js';
import {CHART_TYPES, CHARTEX_NAMESPACES, DEPRECATED_CHART_TYPES, chartTypeFromChartex, resolveChartType} from '../dist/chart-types.js';
import {CHARTEX_CONTENT_TYPES, CHARTEX_RELATIONSHIP_TYPES, chartexPointColors, columnLetters, scottBinCount} from '../dist/chartex.js';

const CX = 'http://schemas.microsoft.com/office/drawing/2014/chartex';
const categoryData = {columns: ['Region', 'Value'], rows: [['North', 42], ['South', 31], ['East', -8], ['West', 19]]};
const boxData = {columns: ['Team', 'Cycle', 'Review'], rows: [['Alpha', 5, 7], ['Alpha', 8, 4], ['Beta', 12, 9], ['Beta', 3, 2], ['Beta', 6, 8]]};
const singleData = {columns: ['Sample'], rows: [[3], [5], [8], [13], [5.5], [9]]};
const chartexIds = Object.keys(CHART_TYPES).filter((id) => CHART_TYPES[id].family === 'chartex');
assert.deepEqual(chartexIds, ['treemap', 'histogram', 'pareto', 'box-and-whisker', 'waterfall', 'funnel', 'world']);
const dataFor = (id) => (id === 'box-and-whisker' ? boxData : categoryData);

// Native chartex export is opt-in (`chartex: 'native'`) until the native PowerPoint check passes; the default keeps main's bytes (checked below).
async function exportDeck(slides, options = {}) {
  const diagnostics = [];
  const bytes = await toPptx({slides}, {chartex: 'native', ...options, onDiagnostic: (diagnostic) => diagnostics.push(diagnostic)});
  const parts = unzipSync(bytes);
  const part = (name) => strFromU8(parts[name]);
  const relationships = (name) => Object.fromEntries([...part(name.replace(/([^/]+)$/, '_rels/$1.rels')).matchAll(/<Relationship\b([^>]*)\/>/g)].map(([, attrs]) => {
    const attr = (key) => attrs.match(new RegExp(`\\b${key}="([^"]*)"`))?.[1];
    return [attr('Id'), {type: attr('Type'), target: attr('Target')}];
  }));
  return {bytes, parts, part, relationships, diagnostics};
}
const attribute = (xml, name) => xml.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const points = (block) => [...block.matchAll(/<cx:pt idx="(\d+)">([^<]*)<\/cx:pt>/g)].map(([, idx, value]) => [Number(idx), value]);
const chartChildren = (xml) => [...xml.matchAll(/<cx:(\w+)\b/g)].map(([, name]) => name);

let checks = 0;

// ---------------------------------------------------------------------------
// Each chartex id: parts, relationships, content types, the alternate-content frame and the cx:chartSpace structure.
const expectedLayout = {
  treemap: {layoutIds: ['treemap'], dimension: 'size', requires: 'cx1', layoutPr: /<cx:layoutPr><cx:parentLabelLayout val="none"\/><\/cx:layoutPr>/, axes: 0, dataLabels: /<cx:dataLabels pos="ctr"><cx:txPr>[\s\S]*?<\/cx:txPr><cx:visibility seriesName="0" categoryName="1" value="0"\/><\/cx:dataLabels>/},
  histogram: {layoutIds: ['clusteredColumn'], dimension: 'val', requires: 'cx1', layoutPr: /<cx:layoutPr><cx:aggregation\/><\/cx:layoutPr>/, axes: 2},
  pareto: {layoutIds: ['clusteredColumn', 'paretoLine'], dimension: 'val', requires: 'cx1', layoutPr: /<cx:layoutPr><cx:aggregation\/><\/cx:layoutPr>/, axes: 3},
  'box-and-whisker': {layoutIds: ['boxWhisker', 'boxWhisker'], dimension: 'val', requires: 'cx1', layoutPr: /<cx:layoutPr><cx:visibility meanLine="0" meanMarker="1" nonoutliers="0" outliers="1"\/><cx:statistics quartileMethod="exclusive"\/><\/cx:layoutPr>/, axes: 2},
  waterfall: {layoutIds: ['waterfall'], dimension: 'val', requires: 'cx1', layoutPr: /<cx:layoutPr><cx:visibility connectorLines="1"\/><\/cx:layoutPr>/, axes: 2},
  funnel: {layoutIds: ['funnel'], dimension: 'val', requires: 'cx2', layoutPr: null, axes: 2, dataLabels: /<cx:dataLabels pos="ctr"><cx:txPr>[\s\S]*?<\/cx:txPr><cx:visibility seriesName="0" categoryName="0" value="1"\/><\/cx:dataLabels>/},
  world: {layoutIds: ['regionMap'], dimension: 'colorVal', requires: 'cx4', layoutPr: /<cx:layoutPr><cx:geography cultureLanguage="en-US" cultureRegion="US" attribution="Powered by Bing"\/><\/cx:layoutPr>/, axes: 0},
};
assert.deepEqual(Object.keys(expectedLayout), chartexIds);

for (const id of chartexIds) {
  const want = expectedLayout[id];
  const data = dataFor(id);
  const {parts, part, relationships, diagnostics} = await exportDeck([{title: id, chart: {type: id, data}}]);
  const spec = CHART_TYPES[id];
  assert.equal(spec.requires, want.requires, `${id}: requires`);
  assert.equal(spec.dimension, want.dimension, `${id}: dimension`);

  // Parts and content types.
  for (const name of ['ppt/charts/chart1.xml', 'ppt/charts/chartEx1.xml', 'ppt/charts/style1.xml', 'ppt/charts/colors1.xml', 'ppt/charts/_rels/chartEx1.xml.rels', 'ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx']) {
    assert.ok(parts[name], `${id}: ${name} is written`);
  }
  assert.equal(Object.keys(parts).filter((name) => /^ppt\/charts\/chartEx\d+\.xml$/.test(name)).length, 1, `${id}: one chartEx part`);
  const contentTypes = part('[Content_Types].xml');
  assert.ok(contentTypes.includes(`<Override PartName="/ppt/charts/chartEx1.xml" ContentType="${CHARTEX_CONTENT_TYPES.chart}"/>`), `${id}: chartEx content type`);
  assert.ok(contentTypes.includes(`<Override PartName="/ppt/charts/style1.xml" ContentType="${CHARTEX_CONTENT_TYPES.style}"/>`), `${id}: style content type`);
  assert.ok(contentTypes.includes(`<Override PartName="/ppt/charts/colors1.xml" ContentType="${CHARTEX_CONTENT_TYPES.colors}"/>`), `${id}: colors content type`);
  for (const [, partName] of contentTypes.matchAll(/<Override\b[^>]*\bPartName="([^"]+)"/g)) assert.ok(parts[partName.slice(1)], `${id}: override ${partName} names a part`);

  // Relationships: the chartEx part shares the classic chart's workbook and owns its style parts.
  const chartRels = relationships('ppt/charts/chartEx1.xml');
  assert.deepEqual(chartRels, {
    rId1: {type: CHARTEX_RELATIONSHIP_TYPES.package, target: relationships('ppt/charts/chart1.xml').rId1.target},
    rId2: {type: CHARTEX_RELATIONSHIP_TYPES.style, target: 'style1.xml'},
    rId3: {type: CHARTEX_RELATIONSHIP_TYPES.colors, target: 'colors1.xml'},
  }, `${id}: chartEx relationships`);
  assert.equal(chartRels.rId1.target, '../embeddings/Microsoft_Excel_Worksheet1.xlsx');
  const slideRels = relationships('ppt/slides/slide1.xml');
  const chartExRel = Object.entries(slideRels).find(([, rel]) => rel.type === CHARTEX_RELATIONSHIP_TYPES.chart);
  assert.ok(chartExRel, `${id}: the slide relates to the chartEx part`);
  assert.equal(chartExRel[1].target, '../charts/chartEx1.xml');
  assert.equal(new Set(Object.keys(slideRels)).size, Object.keys(slideRels).length, `${id}: unique relationship ids`);

  // The frame: one mc:AlternateContent, choice requires the construct's namespace, fallback is the classic frame.
  const slide = part('ppt/slides/slide1.xml');
  assert.equal(XMLValidator.validate(slide), true, `${id}: slide XML is well formed`);
  const alternates = [...slide.matchAll(/<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>/g)];
  assert.equal(alternates.length, 1, `${id}: one alternate-content frame`);
  const alternate = alternates[0][0];
  const choice = alternate.match(/<mc:Choice\b([^>]*)>([\s\S]*?)<\/mc:Choice>/), fallback = alternate.match(/<mc:Fallback>([\s\S]*?)<\/mc:Fallback>/);
  assert.equal(attribute(choice[1], 'Requires'), want.requires, `${id}: Requires`);
  assert.equal(attribute(choice[1], `xmlns:${want.requires}`), CHARTEX_NAMESPACES[want.requires], `${id}: the namespace the choice requires`);
  assert.match(choice[2], new RegExp(`^<p:graphicFrame>[\\s\\S]*<a:graphicData uri="${CX}"><cx:chart xmlns:cx="${CX}" xmlns:r="[^"]+" r:id="${chartExRel[0]}"/></a:graphicData></a:graphic></p:graphicFrame>$`), `${id}: choice frame references the chartEx part`);
  assert.match(fallback[1], /^<p:graphicFrame>[\s\S]*<c:chart r:id="rId1"[^>]*\/>[\s\S]*<\/p:graphicFrame>$/, `${id}: fallback is the classic chart frame`);
  // pptxgenjs-plus writes the slide-to-chart relationship relative to the slide part (4.0.1 wrote /ppt/charts/chart1.xml).
  assert.equal(slideRels.rId1.target, '../charts/chart1.xml');
  const frameName = (frame) => frame.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)[1], frameXfrm = (frame) => frame.match(/<p:xfrm>[\s\S]*?<\/p:xfrm>/)[0];
  assert.equal(frameName(choice[2]), frameName(fallback[1]), `${id}: both frames carry the chart name`);
  assert.equal(frameXfrm(choice[2]), frameXfrm(fallback[1]), `${id}: both frames share the transform`);
  const ids = [...slide.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, `${id}: unique object ids across choice and fallback`);
  assert.equal([...slide.matchAll(/<p:graphicFrame>/g)].length, 2, `${id}: no third chart frame`);

  // The chartex part.
  const cx = part('ppt/charts/chartEx1.xml');
  assert.equal(XMLValidator.validate(cx), true, `${id}: chartEx XML is well formed`);
  assert.match(cx, /^<\?xml version="1.0" encoding="UTF-8" standalone="yes"\?><cx:chartSpace xmlns:a="http:\/\/schemas.openxmlformats.org\/drawingml\/2006\/main" xmlns:r="http:\/\/schemas.openxmlformats.org\/officeDocument\/2006\/relationships" xmlns:cx="http:\/\/schemas.microsoft.com\/office\/drawing\/2014\/chartex">/, `${id}: chartSpace root`);
  assert.deepEqual(chartChildren(cx.replace(/<cx:chartData>[\s\S]*?<\/cx:chartData>/, '<cx:chartData/>').replace(/<cx:chart>[\s\S]*?<\/cx:chart>/, '<cx:chart/>')), ['chartSpace', 'chartData', 'chart', 'spPr', 'txPr'], `${id}: CT_ChartSpace child order`);
  const chartData = cx.match(/<cx:chartData>([\s\S]*?)<\/cx:chartData>/)[1];
  assert.match(chartData, /^<cx:externalData r:id="rId1" cx:autoUpdate="0"\/>/, `${id}: external data is the workbook relationship`);
  const blocks = [...chartData.matchAll(/<cx:data id="(\d+)">([\s\S]*?)<\/cx:data>/g)];
  const seriesColumns = id === 'box-and-whisker' ? 2 : 1;
  assert.equal(blocks.length, seriesColumns, `${id}: one cx:data per plotted series`);
  const classic = part('ppt/charts/chart1.xml');
  blocks.forEach(([, dataId, block], index) => {
    assert.equal(Number(dataId), index);
    const letter = columnLetters(index + 2);
    assert.deepEqual(chartChildren(block), ['strDim', 'f', 'lvl', ...data.rows.map(() => 'pt'), 'numDim', 'f', 'lvl', ...data.rows.filter((row) => row[index + 1] !== null).map(() => 'pt')], `${id}: cx:data ${index} children (strDim then numDim, sparse points)`);
    const strDim = block.match(/<cx:strDim type="cat">([\s\S]*?)<\/cx:strDim>/)[1];
    assert.equal(strDim.match(/<cx:f>([^<]*)<\/cx:f>/)[1], `Sheet1!$A$2:$A$${data.rows.length + 1}`, `${id}: category formula`);
    assert.ok(classic.includes(`<c:f>Sheet1!$A$2:$A$${data.rows.length + 1}</c:f>`), `${id}: the classic part reads the same category range`);
    assert.equal(attribute(strDim, 'ptCount'), String(data.rows.length));
    assert.deepEqual(points(strDim), data.rows.map((row, i) => [i, row[0]]), `${id}: category cache`);
    const numDim = block.match(/<cx:numDim type="(\w+)">([\s\S]*?)<\/cx:numDim>/);
    assert.equal(numDim[1], want.dimension, `${id}: numeric dimension type`);
    assert.equal(numDim[2].match(/<cx:f>([^<]*)<\/cx:f>/)[1], `Sheet1!$${letter}$2:$${letter}$${data.rows.length + 1}`, `${id}: value formula`);
    assert.ok(classic.includes(`<c:f>Sheet1!$${letter}$2:$${letter}$${data.rows.length + 1}</c:f>`), `${id}: the classic part reads the same value range`);
    assert.match(numDim[2], new RegExp(`<cx:lvl ptCount="${data.rows.length}" formatCode="General">`));
    assert.deepEqual(points(numDim[2]), data.rows.flatMap((row, i) => row[index + 1] === null ? [] : [[i, String(row[index + 1])]]), `${id}: value cache (multi-column charts plot blank cells as 0, like the classic charts)`);
  });
  const region = cx.match(/<cx:plotAreaRegion>([\s\S]*?)<\/cx:plotAreaRegion>/)[1];
  const series = [...region.matchAll(/<cx:series\b([^>]*)>([\s\S]*?)<\/cx:series>/g)];
  assert.deepEqual(series.map(([, attrs]) => attribute(attrs, 'layoutId')), want.layoutIds, `${id}: series layoutIds`);
  for (const [, attrs, body] of series) {
    assert.match(attribute(attrs, 'uniqueId'), /^\{[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-8[0-9A-F]{3}-[0-9A-F]{12}\}$/, `${id}: uniqueId is a GUID`);
    // CT_Series child order: tx, spPr, dataPt*, dataLabels?, dataId?, layoutPr?, axisId*.
    const order = ['tx', 'spPr', 'dataPt', 'dataLabels', 'dataId', 'layoutPr', 'axisId'];
    const names = [...body.replace(/<cx:dataPt idx="\d+">[\s\S]*?<\/cx:dataPt>/g, '<cx:dataPt/>').matchAll(/<cx:(tx|spPr|dataPt|dataLabels|dataId|layoutPr|axisId)\b/g)].map((match) => match[1]);
    assert.deepEqual(names, [...names].sort((a, b) => order.indexOf(a) - order.indexOf(b)), `${id}: series children in schema order (${names})`);
  }
  assert.equal(new Set(series.map(([, attrs]) => attribute(attrs, 'uniqueId'))).size, series.length, `${id}: distinct uniqueIds`);
  const [owner] = series;
  assert.match(owner[2], /^<cx:tx><cx:txData><cx:f>Sheet1!\$B\$1<\/cx:f><cx:v>[^<]+<\/cx:v><\/cx:txData><\/cx:tx>/, `${id}: series name from the workbook heading`);
  assert.equal(owner[2].match(/<cx:v>([^<]*)<\/cx:v>/)[1], data.columns[1], `${id}: series name`);
  assert.match(owner[2], /<cx:dataId val="0"\/>/);
  if (want.layoutPr) assert.match(owner[2], want.layoutPr, `${id}: layout properties`);
  else assert.doesNotMatch(owner[2], /<cx:layoutPr/, `${id}: no layout properties`);
  if (want.dataLabels) assert.match(owner[2], want.dataLabels, `${id}: data labels`);
  else assert.doesNotMatch(owner[2], /<cx:dataLabels/, `${id}: no data labels`);
  const axes = [...cx.matchAll(/<cx:axis id="(\d+)"[^>]*>([\s\S]*?)<\/cx:axis>/g)];
  assert.equal(axes.length, want.axes, `${id}: axis count`);
  if (want.axes) {
    assert.deepEqual(axes.map(([, axisId]) => axisId), ['0', '1', '2'].slice(0, want.axes));
    // CT_Axis order: scaling, gridlines, tickLabels, then the axis's own txPr (PowerPoint does not inherit the chartSpace txPr for axis labels).
    assert.match(axes[0][2], /^<cx:catScaling gapWidth="[0-9.]+"\/><cx:tickLabels\/><cx:txPr>[\s\S]*<\/cx:txPr>$/, `${id}: category axis`);
    assert.match(axes[1][2], id === 'funnel' ? /^<cx:valScaling\/><cx:tickLabels\/><cx:txPr>[\s\S]*<\/cx:txPr>$/ : /^<cx:valScaling\/><cx:majorGridlines><cx:spPr>[\s\S]*<\/cx:spPr><\/cx:majorGridlines><cx:tickLabels\/><cx:txPr>[\s\S]*<\/cx:txPr>$/, `${id}: value axis`);
    for (const [, axisId, body] of axes) assert.equal([...body.matchAll(/<cx:txPr>/g)].length, 1, `${id}: axis ${axisId} carries one txPr`);
    if (id === 'funnel') assert.match(axes[1][0], /<cx:axis id="1" hidden="1">/, 'funnel value axis is hidden');
    assert.match(owner[2], /<cx:axisId val="0"\/><cx:axisId val="1"\/>$/, `${id}: the series names its axes`);
  } else {
    assert.doesNotMatch(owner[2], /<cx:axisId/, `${id}: no axes`);
  }
  if (id === 'pareto') {
    const [, attrs, body] = series[1];
    assert.equal(attribute(attrs, 'ownerIdx'), '0', 'the Pareto line is owned by the columns');
    assert.doesNotMatch(body, /<cx:dataId|<cx:tx>/, 'the owned line has no data of its own');
    assert.match(body, /<cx:spPr><a:ln w="19050"><a:solidFill><a:srgbClr val="[0-9A-F]{6}"\/><\/a:solidFill><\/a:ln><\/cx:spPr><cx:axisId val="0"\/><cx:axisId val="2"\/>$/, 'the line uses the percentage axis');
    assert.match(axes[2][2], /^<cx:valScaling max="1" min="0"\/><cx:units unit="percentage"\/><cx:tickLabels\/><cx:txPr>[\s\S]*<\/cx:txPr>$/, 'percentage axis');
  }
  // Colours and text follow the classic chart: series fill, per-point fills for treemap tiles and waterfall signs, label colour and font.
  const classicSeriesColor = classic.match(/<c:ser>[\s\S]*?<c:spPr><a:solidFill><a:srgbClr val="([0-9A-F]{6})"/)[1];
  const labelColor = classic.match(/<c:txPr>[\s\S]*?<a:solidFill><a:srgbClr val="([0-9A-F]{6})"/)[1];
  // Box whiskers, medians and mean markers are drawn with the series line, in the label colour; other constructs have no series line.
  const seriesLine = id === 'box-and-whisker' ? `<a:ln w="9525"><a:solidFill><a:srgbClr val="${labelColor}"/></a:solidFill></a:ln>` : '';
  assert.match(owner[2], new RegExp(`<cx:spPr><a:solidFill><a:srgbClr val="${classicSeriesColor}"/></a:solidFill>${seriesLine}</cx:spPr>`), `${id}: series colour is the classic first series colour`);
  const pointFills = [...owner[2].matchAll(/<cx:dataPt idx="(\d+)"><cx:spPr><a:solidFill><a:srgbClr val="([0-9A-F]{6})"\/><\/a:solidFill><\/cx:spPr><\/cx:dataPt>/g)].map(([, idx, color]) => [Number(idx), color]);
  if (id === 'treemap') {
    assert.equal(pointFills.length, data.rows.length, 'one tile colour per category');
    assert.equal(new Set(pointFills.map(([, color]) => color)).size, data.rows.length, 'distinct tile colours');
    assert.equal(pointFills[0][1], classicSeriesColor);
  } else if (id === 'waterfall') {
    assert.deepEqual(pointFills.map(([, color]) => color === classicSeriesColor ? 'up' : 'down'), data.rows.map((row) => row[1] < 0 ? 'down' : 'up'), 'increase and decrease colours by sign');
  } else {
    assert.deepEqual(pointFills, [], `${id}: series colour only`);
  }
  const face = classic.match(/<a:latin typeface="([^"]+)"/)[1];
  // Every text element (chart space, each axis, data labels, legend) carries the same explicit label colour, font and size (FF-62: the preview's 12 pt on the default slide).
  const textProperties = `<cx:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200"><a:solidFill><a:srgbClr val="${labelColor}"/></a:solidFill><a:latin typeface="${face}"/><a:ea typeface="${face}"/><a:cs typeface="${face}"/></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></cx:txPr>`;
  const textBlocks = [...cx.matchAll(/<cx:txPr>[\s\S]*?<\/cx:txPr>/g)].map((match) => match[0]);
  assert.ok(textBlocks.every((block) => block === textProperties), `${id}: every cx:txPr is the deck's label colour and font`);
  assert.equal(textBlocks.length, 1 + want.axes + (want.dataLabels ? 1 : 0) + (id === 'box-and-whisker' ? 1 : 0), `${id}: txPr on the chart space, each axis, data labels and legend`);
  assert.ok(cx.endsWith(`${textProperties}</cx:chartSpace>`), `${id}: chart space txPr`);
  const chartAreaFill = classic.match(/<\/c:chart><c:spPr><a:solidFill><a:srgbClr val="([0-9A-F]{6})"/)[1];
  assert.match(cx, new RegExp(`</cx:chart><cx:spPr><a:solidFill><a:srgbClr val="${chartAreaFill}"(?:/>|><a:alpha val="\\d+"/></a:srgbClr>)</a:solidFill><a:ln><a:noFill/></a:ln></cx:spPr>`), `${id}: chart area fill`);
  assert.equal(cx.includes('<cx:legend'), id === 'box-and-whisker', `${id}: legend only for the multi-series box chart`);

  // Style parts are well formed and complete.
  const style = part('ppt/charts/style1.xml');
  assert.equal(XMLValidator.validate(style), true);
  assert.match(style, /^<\?xml [^>]*\?><cs:chartStyle xmlns:cs="http:\/\/schemas.microsoft.com\/office\/drawing\/2012\/chartStyle" xmlns:a="[^"]+" id="201">/);
  const entries = [...style.matchAll(/<cs:(\w+)\b/g)].map((match) => match[1]).filter((name) => !['chartStyle', 'lnRef', 'fillRef', 'effectRef', 'fontRef', 'spPr', 'defRPr', 'styleClr'].includes(name));
  assert.deepEqual(entries, ['axisTitle', 'categoryAxis', 'chartArea', 'dataLabel', 'dataLabelCallout', 'dataPoint', 'dataPoint3D', 'dataPointLine', 'dataPointMarker', 'dataPointMarkerLayout', 'dataPointWireframe', 'dataTable', 'downBar', 'dropLine', 'errorBar', 'floor', 'gridlineMajor', 'gridlineMinor', 'hiLoLine', 'leaderLine', 'legend', 'plotArea', 'plotArea3D', 'seriesAxis', 'seriesLine', 'title', 'trendline', 'trendlineLabel', 'upBar', 'valueAxis', 'wall'], 'CT_ChartStyle entries in schema order');
  for (const [, name, body] of style.matchAll(/<cs:(\w+)(?: mods="[^"]*")?>(<cs:lnRef[\s\S]*?)<\/cs:\1>/g)) {
    // The style part's text references carry the deck's label colour (PowerPoint applies them to chartex labels), never the theme's tx1.
    assert.match(body, new RegExp(`^<cs:lnRef idx="\\d+"/><cs:fillRef idx="\\d+">(?:<cs:styleClr val="auto"/>)?</cs:fillRef><cs:effectRef idx="\\d+"/><cs:fontRef idx="minor"><a:srgbClr val="${labelColor}"/></cs:fontRef>`), `style entry ${name}`);
    if (body.includes('<cs:defRPr')) assert.match(body, new RegExp(`<cs:defRPr sz="\\d+" kern="1200"><a:solidFill><a:srgbClr val="${labelColor}"/></a:solidFill><a:latin typeface="${face}"/><a:ea typeface="${face}"/><a:cs typeface="${face}"/></cs:defRPr>`), `style text ${name}`);
  }
  assert.doesNotMatch(style, /schemeClr val="tx1"/, `${id}: no theme text colour in the style part`);
  const colors = part('ppt/charts/colors1.xml');
  assert.equal(XMLValidator.validate(colors), true);
  assert.match(colors, /<cs:colorStyle [^>]*meth="cycle" id="10">(<a:schemeClr val="accent[1-6]"\/>){6}(<cs:variation\/>|<cs:variation>[\s\S]*?<\/cs:variation>){9}<\/cs:colorStyle>$/);

  // Diagnostics: only the map reports its missing geography cache.
  assert.deepEqual(diagnostics.map((diagnostic) => diagnostic.code), id === 'world' ? ['chart-map-geodata'] : [], `${id}: diagnostics`);
  if (id === 'world') assert.match(diagnostics[0].message, /online map service.*draws nothing/);
  checks++;
}

// ---------------------------------------------------------------------------
// Catalog agreement: the layoutIds follow the core catalog's Open XML mapping (element, extension, Aspose ChartType), in the table and in the part.
const layoutByElement = {treemapChart: 'treemap', histogramChart: 'clusteredColumn', boxWhiskerChart: 'boxWhisker', waterfallChart: 'waterfall', funnelChart: 'funnel', mapChart: 'regionMap'};
const extensionRecords = catalogs.chartTypes.filter((record) => !record.deprecation && record.mappings?.openxml?.composition === 'extension');
assert.deepEqual(extensionRecords.map((record) => record.id).sort(), [...chartexIds].sort(), 'the chartex family is exactly the catalog extension records');
for (const record of extensionRecords) {
  const spec = CHART_TYPES[record.id];
  const openxml = record.mappings.openxml;
  assert.equal(spec.aspose, record.mappings.renderers['aspose-slides'].chartType, `${record.id}: Aspose.Slides ChartType`);
  const plotted = spec.owner ?? spec.layoutId;
  assert.equal(plotted, layoutByElement[openxml.element], `${record.id}: plotted layoutId follows ${openxml.element}`);
  if (openxml.extension) assert.equal(`cx:${spec.layoutId}`, openxml.extension, `${record.id}: the catalog extension is the owned series layout`);
  else assert.equal(spec.owner, undefined, `${record.id}: no owned series`);
  assert.equal(chartTypeFromChartex([plotted, ...(spec.owner ? [spec.layoutId] : [])]), record.id, `${record.id}: import mapping`);
  const {part} = await exportDeck([{title: record.id, chart: {type: record.id, data: dataFor(record.id)}}]);
  const layoutIds = [...part('ppt/charts/chartEx1.xml').matchAll(/<cx:series layoutId="(\w+)"/g)].map((match) => match[1]);
  assert.equal(layoutIds[0], plotted, `${record.id}: exported layoutId`);
  if (spec.owner) assert.deepEqual(layoutIds, [spec.owner, spec.layoutId], `${record.id}: exported owner and owned series`);
  checks++;
}
assert.equal(chartTypeFromChartex(['sunburst']), null, 'sunburst has no OPF record');
assert.equal(chartTypeFromChartex(['clusteredColumn']), 'histogram');
assert.equal(chartTypeFromChartex(['clusteredColumn', 'paretoLine']), 'pareto');

// ---------------------------------------------------------------------------
// Round trip: every chartex id and its data shapes come back as authored; deprecated aliases import as their replacement.
const importedChart = async (bytes) => {
  const slide = (await fromPptx(bytes)).slides[0];
  return slide.chart ?? slide.blocks?.find((block) => block.chart)?.chart;
};
for (const [type, data, expectedType = type] of [
  ...chartexIds.map((id) => [id, dataFor(id)]),
  ['histogram', singleData], ['pareto', singleData], ['box-and-whisker', categoryData], ['treemap-2x', categoryData, 'treemap'], ['australia', categoryData, 'world'], ['box-and-whisker-3x', boxData, 'box-and-whisker'],
]) {
  const {bytes} = await exportDeck([{title: type, chart: {type, data}}]);
  assert.deepEqual(await importedChart(bytes), {type: expectedType, data}, `${type}: round trip`);
  checks++;
}
// A single value column for the other constructs is plotted against row numbers, so it re-imports with a Row column (reported as row-numbers).
{
  const {bytes, diagnostics} = await exportDeck([{title: 'funnel', chart: {type: 'funnel', data: singleData}}]);
  assert.deepEqual(diagnostics.map((diagnostic) => diagnostic.adaptation), ['row-numbers']);
  assert.deepEqual(await importedChart(bytes), {type: 'funnel', data: {columns: ['Row', 'Sample'], rows: singleData.rows.map((row, index) => [String(index + 1), row[0]])}});
}
// Several charts in one deck: numbered parts, distinct uniqueIds, each frame wrapped, and the whole export deterministic.
{
  const slides = chartexIds.map((id) => ({title: id, chart: {type: id, data: dataFor(id)}}));
  const first = await exportDeck(slides), second = await exportDeck(slides);
  assert.deepEqual(first.bytes, second.bytes, 'byte-identical re-export');
  const cxParts = Object.keys(first.parts).filter((name) => /^ppt\/charts\/chartEx\d+\.xml$/.test(name)).sort();
  assert.deepEqual(cxParts, chartexIds.map((_, index) => `ppt/charts/chartEx${index + 1}.xml`));
  const uniqueIds = cxParts.flatMap((name) => [...first.part(name).matchAll(/uniqueId="([^"]+)"/g)].map((match) => match[1]));
  assert.equal(new Set(uniqueIds).size, uniqueIds.length, 'uniqueIds differ across charts');
  for (const [index] of chartexIds.entries()) {
    const slide = first.part(`ppt/slides/slide${index + 1}.xml`);
    assert.equal([...slide.matchAll(/<mc:AlternateContent\b/g)].length, 1);
    assert.equal(first.relationships(`ppt/slides/slide${index + 1}.xml`)[slide.match(/<cx:chart\b[^>]*r:id="([^"]+)"/)[1]].target, `../charts/chartEx${index + 1}.xml`);
  }
  const imported = await fromPptx(first.bytes);
  assert.deepEqual(imported.slides.map((slide) => (slide.chart ?? slide.blocks?.find((block) => block.chart)?.chart)?.type), chartexIds, 'every slide imports its own type');
  checks++;
}
// A classic chart and a chartex chart in one deck leave the classic slide untouched.
{
  const {part} = await exportDeck([{title: 'column', chart: {type: 'column', data: categoryData}}, {title: 'treemap', chart: {type: 'treemap', data: categoryData}}]);
  assert.doesNotMatch(part('ppt/slides/slide1.xml'), /AlternateContent|chartEx/);
  assert.match(part('ppt/slides/slide2.xml'), /chartEx1\.xml|<mc:AlternateContent/);
  assert.ok(part('ppt/slides/_rels/slide2.xml.rels').includes('../charts/chartEx1.xml'));
}

// ---------------------------------------------------------------------------
// Language and script fonts: a chartex part gets the slide's language and script slots like a classic chart part.
{
  const deck = [{title: 'ヒストグラム', chart: {type: 'funnel', data: {columns: ['地域', '値'], rows: [['東京', 4], ['大阪', 3]]}}}];
  const {part} = await exportDeck(deck, {language: 'ja-JP'});
  const cx = part('ppt/charts/chartEx1.xml'), classic = part('ppt/charts/chart1.xml');
  const slot = (xml, name) => xml.match(new RegExp(`<a:${name} typeface="([^"]*)"`))?.[1];
  assert.equal(slot(cx, 'latin'), slot(classic, 'latin'), 'same latin face as the classic part');
  assert.equal(slot(cx, 'ea'), slot(classic, 'ea'), 'same East Asian face as the classic part');
  assert.equal(cx.match(/<a:endParaRPr lang="([^"]+)"/)[1], classic.match(/<a:endParaRPr lang="([^"]+)"/)?.[1] ?? 'ja-JP', 'same language');
  assert.match(cx, /<cx:pt idx="0">東京<\/cx:pt>/, 'category text is preserved');
  checks++;
}

// ---------------------------------------------------------------------------
// Import of PowerPoint's own shape: a text-shape fallback, a layout without an OPF record, and damaged caches.
function repack(parts, edits) {
  const entries = {...parts};
  for (const [name, edit] of Object.entries(edits)) entries[name] = strToU8(edit(strFromU8(entries[name])));
  return zipSync(Object.fromEntries(Object.keys(entries).sort().map((name) => [name, [entries[name], {level: 6}]])));
}
{
  const {parts} = await exportDeck([{title: 'treemap', chart: {type: 'treemap', data: categoryData}}]);
  const textFallback = (slide) => slide.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/, '<mc:Fallback><p:sp><p:nvSpPr><p:cNvPr id="9" name="Chart 1"/><p:cNvSpPr><a:spLocks noTextEdit="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="548640" y="1404747"/><a:ext cx="11094720" cy="4904613"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>This chart isn\'t available in your version of PowerPoint.</a:t></a:r></a:p></p:txBody></p:sp></mc:Fallback>');
  const powerpointShape = repack(parts, {'ppt/slides/slide1.xml': textFallback});
  assert.deepEqual(await importedChart(powerpointShape), {type: 'treemap', data: categoryData}, 'the choice is read even with a text fallback');
  const sunburst = repack(parts, {'ppt/charts/chartEx1.xml': (xml) => xml.replace('layoutId="treemap"', 'layoutId="sunburst"')});
  assert.deepEqual(await importedChart(sunburst), {type: 'column', data: categoryData}, 'an unknown layout falls back to the classic chart frame');
  const sunburstText = repack(parts, {'ppt/charts/chartEx1.xml': (xml) => xml.replace('layoutId="treemap"', 'layoutId="sunburst"'), 'ppt/slides/slide1.xml': textFallback});
  const slide = (await fromPptx(sunburstText)).slides[0];
  const texts = JSON.stringify(slide);
  assert.ok(texts.includes('PowerPoint chart: OPF chart 1'), `an unknown layout with a text fallback keeps a chart placeholder: ${texts.slice(0, 300)}`);
  for (const [label, edit, code] of [
    ['duplicate point', (xml) => xml.replace('<cx:pt idx="1">31</cx:pt>', '<cx:pt idx="0">31</cx:pt>'), 'invalid-chart-cache'],
    ['point outside its count', (xml) => xml.replace('ptCount="4" formatCode', 'ptCount="2" formatCode'), 'invalid-chart-cache'],
    ['non-numeric value', (xml) => xml.replace('<cx:pt idx="1">31</cx:pt>', '<cx:pt idx="1">thirty</cx:pt>'), 'invalid-chart-cache'],
  ]) {
    await assert.rejects(fromPptx(repack(parts, {'ppt/charts/chartEx1.xml': edit})), (error) => error.code === code && /chartEx1\.xml#/.test(error.details?.path ?? error.path ?? ''), label);
  }
  checks++;
}

// ---------------------------------------------------------------------------
// Native single-column data: a histogram or Pareto chart bins its own values (explicit Scott bin count), every other
// construct plots them against row numbers and says so.
const chartexValues = (xml) => [...xml.matchAll(/<cx:numDim\b[^>]*>([\s\S]*?)<\/cx:numDim>/g)].map(([, body]) => [...body.matchAll(/<cx:pt idx="\d+">([^<]*)<\/cx:pt>/g)].map(([, value]) => value));
const binCount = (xml) => Number(xml.match(/<cx:binCount val="(\d+)"\/>/)?.[1]);
const classicNumbers = (xml, tag) => [...xml.matchAll(new RegExp(`<c:${tag}>([\\s\\S]*?)</c:${tag}>`, 'g'))].map(([, body]) => [...body.matchAll(/<c:v>([^<]*)<\/c:v>/g)].map(([, value]) => value));
{
  const values = [3, 5, 8, 13];
  const histogram = await exportDeck([{title: 'histogram', chart: {type: 'histogram', data: {columns: ['Value'], rows: values.map((value) => [value])}}}]);
  const cx = histogram.part('ppt/charts/chartEx1.xml'), classic = histogram.part('ppt/charts/chart1.xml');
  assert.deepEqual(histogram.diagnostics, [], 'a native histogram bins its own values: nothing is adapted');
  assert.doesNotMatch(cx, /<cx:strDim/, 'no category dimension for a lone value column');
  assert.deepEqual(chartexValues(cx), [['3', '5', '8', '13']]);
  assert.equal(binCount(cx), 2, 'Scott: 3.49 * sd(4.35) / 4^(1/3) = 9.56 wide over a range of 10');
  assert.deepEqual(classicNumbers(classic, 'cat'), [['1', '2', '3', '4']], 'the fallback plots the values against their row numbers');
  assert.deepEqual(classicNumbers(classic, 'val'), [['3', '5', '8', '13']]);
  assert.deepEqual(await importedChart(histogram.bytes), {type: 'histogram', data: {columns: ['Value'], rows: values.map((value) => [value])}}, 'raw values round-trip');
  const strings = await exportDeck([{title: 'h', chart: {type: 'histogram', data: {columns: ['Value'], rows: [['1'], ['2'], ['x'], [null], [3], ['4.5']]}}}]);
  assert.deepEqual(chartexValues(strings.part('ppt/charts/chartEx1.xml')), [['1', '2', '3', '4.5']], 'non-numeric cells are not plotted as zeros');
  assert.deepEqual(classicNumbers(strings.part('ppt/charts/chart1.xml'), 'cat'), [['1', '2', '5', '6']], 'the fallback keeps the row numbers');
  for (const [rows, count] of [[[[7], [7], [7]], 1], [[[7]], 1], [Array.from({length: 1000}, (_, index) => [index]), 10]]) {
    assert.equal(binCount((await exportDeck([{title: 'h', chart: {type: 'histogram', data: {columns: ['Value'], rows}}}])).part('ppt/charts/chartEx1.xml')), count, `${rows.length} values`);
  }
  // Extremes: finite arithmetic for any finite input, every value written once and a finite bin count.
  for (const rows of [[[-1e308], [1e308]], [[-1e308], [0], [1e308]], [[1.7976931348623157e308], [-1.7976931348623157e308], [5]], [[Number.MIN_VALUE], [Number.MAX_VALUE]], [[0], [Number.MIN_VALUE]]]) {
    const cxPart = (await exportDeck([{title: 'h', chart: {type: 'histogram', data: {columns: ['Value'], rows}}}])).part('ppt/charts/chartEx1.xml');
    assert.deepEqual(chartexValues(cxPart)[0].map(Number), rows.map(([value]) => value), `extremes ${JSON.stringify(rows)}: every value is written once`);
    assert.ok(Number.isInteger(binCount(cxPart)) && binCount(cxPart) >= 1, 'finite bin count');
    assert.doesNotMatch(cxPart, /NaN|Infinity/, 'finite markup');
  }
  // A category column bins by category; every chartex id with one column: binned (histogram, pareto) or row numbers.
  const byCategory = await exportDeck([{title: 'h', chart: {type: 'histogram', data: {columns: ['Category', 'Value'], rows: [['a', 3], ['b', 4]]}}}]);
  assert.match(byCategory.part('ppt/charts/chartEx1.xml'), /<cx:layoutPr><cx:aggregation\/><\/cx:layoutPr>/);
  assert.deepEqual(byCategory.diagnostics, []);
  for (const id of chartexIds) {
    const result = await exportDeck([{title: id, chart: {type: id, data: {columns: ['Value'], rows: [[3], [5], [8]]}}}]);
    const binned = Boolean(CHART_TYPES[id].binning);
    assert.deepEqual(result.diagnostics.filter((d) => d.code === 'chart-data-adapted').map((d) => d.adaptation), binned ? [] : ['row-numbers'], `${id}: adaptation`);
    const cxPart = result.part('ppt/charts/chartEx1.xml');
    if (binned) assert.doesNotMatch(cxPart, /<cx:strDim/, `${id}: binned, not categorised`);
    else assert.match(cxPart, /<cx:strDim type="cat">[\s\S]*<cx:pt idx="0">1<\/cx:pt>/, `${id}: row numbers as categories`);
  }
  checks++;
}

// ---------------------------------------------------------------------------
// Modes. `chartex: 'fallback'` keeps the export of every chartex id byte-identical to main's (SHA-256 fixture generated from
// main, see its `source`) with main's diagnostics and no chartex part. The default ('auto', owner decision after the
// 2026-09-30 native PowerPoint check) writes the chartex parts for the six confirmed constructs and keeps only the map
// on the fallback, reporting it; `chartex: 'native'` writes every construct, map included.
{
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/chartex-fallback-main.json', import.meta.url), 'utf8'));
  assert.equal(fixture.source.repository, 'OpenPresentation/opf-pptx');
  assert.equal(Object.keys(fixture.decks).length, 9);
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const run = async (deck, mode) => {
    const diagnostics = [];
    const bytes = await toPptx(structuredClone(deck), {...(mode ? {chartex: mode} : {}), onDiagnostic: (d) => diagnostics.push(`${d.code}${d.adaptation ? `/${d.adaptation}` : ''}`)});
    const parts = unzipSync(bytes);
    return {bytes, diagnostics, chartexParts: Object.keys(parts).filter((part) => /^ppt\/charts\/chartEx\d+\.xml$/.test(part)).length, slides: Object.keys(parts).filter((part) => /^ppt\/slides\/slide\d+\.xml$/.test(part)).map((part) => strFromU8(parts[part]))};
  };
  for (const [name, deck] of Object.entries(fixture.decks)) {
    const fallback = await run(deck, 'fallback');
    assert.equal(digest(fallback.bytes), fixture.entries[name].sha256, `${name} (fallback): bytes identical to main ${fixture.source.commit.slice(0, 7)}`);
    assert.deepEqual(fallback.diagnostics, fixture.entries[name].diagnostics, `${name} (fallback): main's diagnostics`);
    assert.equal(fallback.chartexParts, 0, `${name} (fallback): no chartex parts`);
    assert.ok(fallback.slides.every((slide) => !slide.includes('AlternateContent')), `${name} (fallback): no alternate content`);
    const maps = deck.slides.filter((slide) => ['world', 'australia'].includes(slide.chart.type)).length;
    const auto = await run(deck, undefined), explicit = await run(deck, 'auto'), native = await run(deck, 'native');
    assert.deepEqual(digest(auto.bytes), digest(explicit.bytes), `${name}: the default is 'auto'`);
    assert.equal(auto.chartexParts, deck.slides.length - maps, `${name} (auto): chartex parts for every confirmed construct`);
    assert.equal(native.chartexParts, deck.slides.length, `${name} (native): chartex parts for every construct`);
    if (maps === 0) assert.deepEqual(digest(auto.bytes), digest(native.bytes), `${name}: auto equals native without a map`);
    else {
      assert.notEqual(digest(auto.bytes), digest(native.bytes), `${name}: the map differs between auto and native`);
      assert.deepEqual(auto.diagnostics.filter((d) => d.endsWith('/chartex-fallback')).length, maps, `${name} (auto): the map reports its fallback`);
      assert.ok(!auto.diagnostics.includes('chart-map-geodata') && native.diagnostics.includes('chart-map-geodata'), `${name}: geodata notice only when the map is native`);
    }
    if (maps === deck.slides.length) assert.deepEqual(digest(auto.bytes), fixture.entries[name].sha256, `${name} (auto): a map-only deck keeps main's bytes`);
    else assert.ok(auto.diagnostics.every((d) => d !== 'chart-data-adapted/histogram-binned'), `${name} (auto): histograms bin natively`);
  }
  await assert.rejects(toPptx({slides: [{title: 't', chart: {type: 'treemap', data: categoryData}}]}, {chartex: 'maybe'}), (error) => error.code === 'invalid-chartex-mode' && error.details?.path === 'options.chartex');
  checks++;
}

// ---------------------------------------------------------------------------
// Theme-aware colours: the label colour, series line and style text follow the deck (dark text on the default light
// surface, light text on a dark theme), as the classic chart path does.
{
  const colorsOf = (cx, style) => ({
    text: [...new Set([...cx.matchAll(/<cx:txPr>[\s\S]*?<a:srgbClr val="([0-9A-F]{6})"/g)].map((m) => m[1]))],
    style: [...new Set([...style.matchAll(/<cs:fontRef idx="minor"><a:srgbClr val="([0-9A-F]{6})"/g)].map((m) => m[1]))],
    line: cx.match(/<cx:series[^>]*>[\s\S]*?<cx:spPr><a:solidFill>[\s\S]*?<\/a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="([0-9A-F]{6})"/)?.[1],
  });
  // The default scheme is a dark surface; an explicit scheme with dark text on a light surface is the other case (as test/chart-colors.mjs does).
  const dark = await exportDeck([{title: 'box', chart: {type: 'box-and-whisker', data: boxData}}]);
  const lightDeck = {design: {background: '#FFFFFF', colorScheme: {id: 'cool-horizon', dark1: '#1F2937', light1: '#1F2937', text: '#1F2937', dark2: '#F3F4F6', light2: '#F3F4F6'}}, slides: [{title: 'box', chart: {type: 'box-and-whisker', data: boxData}}]};
  const lightParts = unzipSync(await toPptx(lightDeck, {chartex: 'native'}));
  const darkColors = colorsOf(dark.part('ppt/charts/chartEx1.xml'), dark.part('ppt/charts/style1.xml'));
  const lightColors = colorsOf(strFromU8(lightParts['ppt/charts/chartEx1.xml']), strFromU8(lightParts['ppt/charts/style1.xml']));
  for (const [name, colors] of [['light', lightColors], ['dark', darkColors]]) {
    assert.equal(colors.text.length, 1, `${name}: one label colour`);
    assert.deepEqual(colors.style, colors.text, `${name}: the style text colour is the label colour`);
    assert.equal(colors.line, colors.text[0], `${name}: the box series line is the label colour`);
  }
  const luminance = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).reduce((sum, v, i) => sum + v * [0.299, 0.587, 0.114][i], 0);
  assert.ok(luminance(lightColors.text[0]) < 128, `light surface: dark labels (${lightColors.text[0]})`);
  assert.ok(luminance(darkColors.text[0]) > 128, `dark surface: light labels (${darkColors.text[0]})`);
  const classicLight = strFromU8(lightParts['ppt/charts/chart1.xml']).match(/<c:txPr>[\s\S]*?<a:srgbClr val="([0-9A-F]{6})"/)[1];
  assert.equal(lightColors.text[0], classicLight, 'the chartex label colour is the classic chart label colour');
  checks++;
}

// ---------------------------------------------------------------------------
// Helpers.
assert.deepEqual([1, 2, 26, 27, 52, 53, 702, 703].map(columnLetters), ['A', 'B', 'Z', 'AA', 'AZ', 'BA', 'ZZ', 'AAA']);
assert.equal(scottBinCount([3, 5, 8, 13]), 2, 'Scott: width 3.49 * 4.349 / 1.587 = 9.56 over a range of 10');
assert.equal(scottBinCount(Array.from({length: 1000}, (_, i) => i)), 10);
assert.equal(scottBinCount([7, 7, 7]), 1);
assert.equal(scottBinCount([7]), 1);
assert.equal(scottBinCount([]), 1);
assert.equal(scottBinCount([-1e308, 1e308]), 1, 'finite for extreme values');
assert.deepEqual(chartexPointColors('treemap', [1, null, 3], ['A', 'B', 'C']), ['A', null, 'C']);
assert.deepEqual(chartexPointColors('waterfall', [1, -2, 0, null], ['UP', 'DOWN']), ['UP', 'DOWN', 'UP', null]);
assert.deepEqual(chartexPointColors('funnel', [1, 2], ['A']), [null, null]);
assert.equal(resolveChartType('treemap-3x').id, 'treemap');
assert.equal(DEPRECATED_CHART_TYPES['united-states'], 'world');

console.log(`Chartex passed: ${checks} checks; ${chartexIds.length} chartex ids export native cx:chartSpace parts with style parts, content types, relationships and alternate-content frames, agree with core catalogs.chartTypes, round-trip and are deterministic; the default writes them for the six confirmed constructs and keeps the map on the fallback (chartex: 'fallback' stays byte-identical to main).`);
