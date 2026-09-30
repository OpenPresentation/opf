// Native Office 2016 chartex export and import (FF-22b).
//
// PptxGenJS cannot write a `cx:chartSpace` part, so a chartex chart (treemap,
// histogram, pareto, box & whisker, waterfall, funnel, map) is exported in two
// steps. PptxGenJS first writes the classic clustered column chart of the same
// data, with its embedded workbook. The package is then post-processed here:
// a `ppt/charts/chartExN.xml` part is added with `cx:chartData` (the workbook
// ranges and their cached values) and one `cx:series` per plotted column,
// together with its chart style and colour style parts, and the slide's chart
// frame is wrapped in `mc:AlternateContent`: the `mc:Choice` (which requires
// the chartex namespace of the construct) references the chartex part and the
// `mc:Fallback` keeps the classic chart, so a reader without chartex support
// still shows the data. Both parts share the workbook.
//
// Import reads the chartex part back: the `cx:series` layoutIds name the OPF
// chart type (an owned `paretoLine` marks the Office Pareto chart), and the
// cached dimensions restore the category-major data.
import {CHARTEX_NAMESPACES, chartTypeFromChartex} from './chart-types.js';

const NS = Object.freeze({
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  mc: 'http://schemas.openxmlformats.org/markup-compatibility/2006',
  cs: 'http://schemas.microsoft.com/office/drawing/2012/chartStyle',
  cx: CHARTEX_NAMESPACES.cx,
});

export const CHARTEX_CONTENT_TYPES = Object.freeze({
  chart: 'application/vnd.ms-office.chartex+xml',
  style: 'application/vnd.ms-office.chartstyle+xml',
  colors: 'application/vnd.ms-office.chartcolorstyle+xml',
});

export const CHARTEX_RELATIONSHIP_TYPES = Object.freeze({
  chart: 'http://schemas.microsoft.com/office/2014/relationships/chartEx',
  style: 'http://schemas.microsoft.com/office/2011/relationships/chartStyle',
  colors: 'http://schemas.microsoft.com/office/2011/relationships/chartColorStyle',
  package: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/package',
});

export const CHARTEX_GRAPHIC_DATA_URI = NS.cx;

const decoder = new TextDecoder(), encoder = new TextEncoder();
const text = bytes => decoder.decode(bytes);
const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[char]));

/** Excel column letters for a 1-based column index (1 = A, 27 = AA). */
export function columnLetters(index) {
  let name = '';
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

/**
 * Office's automatic histogram bins: Scott's normal reference rule gives the bin
 * width 3.49 * sd * n^(-1/3) (sample standard deviation), and the bins cover
 * [min, max] from the minimum. Returns the bin count PowerPoint is told to use
 * (`cx:binCount`), so the preview and the native chart agree on the bins.
 */
export function scottBinCount(values) {
  const n = values.length;
  if (n === 0) return 1;
  let min = Infinity, max = -Infinity, mean = 0;
  for (const value of values) { if (value < min) min = value; if (value > max) max = value; mean += value / n; }
  if (!(max > min) || n < 2) return 1;
  let variance = 0;
  for (const value of values) variance += (value - mean) * (value - mean) / (n - 1);
  const width = 3.49 * Math.sqrt(variance) * Math.cbrt(n) ** -1;
  if (!(width > 0) || !Number.isFinite(width)) return 1;
  const count = Math.ceil((max - min) / width - 1e-9);
  return Number.isFinite(count) && count >= 1 ? count : 1;
}

// A deterministic GUID for cx:series uniqueId, from the chart number and
// series index (FNV-1a over the key, repeated for each hex group).
function seriesUniqueId(chart, index) {
  const hex = (seed, length) => {
    let hash = 0x811c9dc5 ^ seed;
    const key = `chartEx${chart}:${index}:${seed}`;
    for (let i = 0; i < key.length; i++) { hash ^= key.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; }
    return hash.toString(16).toUpperCase().padStart(8, '0').repeat(2).slice(0, length);
  };
  return `{${hex(1, 8)}-${hex(2, 4)}-4${hex(3, 3)}-8${hex(4, 3)}-${hex(5, 12)}}`;
}

function solidFill(hex, alpha) {
  return `<a:solidFill>${alpha === undefined ? `<a:srgbClr val="${hex}"/>` : `<a:srgbClr val="${hex}"><a:alpha val="${alpha}"/></a:srgbClr>`}</a:solidFill>`;
}

function numberText(value) {
  return String(value);
}

// The layout properties of the plotted series (CT_SeriesLayoutProperties order:
// parentLabelLayout, regionLabelLayout, visibility, aggregation, binning,
// geography, statistics, subtotals).
function layoutProperties(spec, series, hasCategories) {
  switch (spec.layoutId) {
    case 'treemap':
      return '<cx:layoutPr><cx:parentLabelLayout val="none"/></cx:layoutPr>';
    case 'clusteredColumn':
    case 'paretoLine':
      // A category column bins by category (Office "By category"); a lone value column is binned automatically (Scott's rule, made explicit).
      if (hasCategories) return '<cx:layoutPr><cx:aggregation/></cx:layoutPr>';
      return `<cx:layoutPr><cx:binning intervalClosed="r" underflow="auto" overflow="auto"><cx:binCount val="${scottBinCount(series.values.filter(value => value !== null && Number.isFinite(value)))}"/></cx:binning></cx:layoutPr>`;
    case 'boxWhisker':
      return '<cx:layoutPr><cx:visibility meanLine="0" meanMarker="1" nonoutliers="0" outliers="1"/><cx:statistics quartileMethod="exclusive"/></cx:layoutPr>';
    case 'waterfall':
      return '<cx:layoutPr><cx:visibility connectorLines="1"/></cx:layoutPr>';
    case 'regionMap':
      // No cx:geoCache: PowerPoint fetches the region shapes from Bing Maps when the deck is opened online (see chart-map-geodata).
      return '<cx:layoutPr><cx:geography cultureLanguage="en-US" cultureRegion="US" attribution="Powered by Bing"/></cx:layoutPr>';
    default:
      return '';
  }
}

function dataLabels(spec) {
  if (spec.layoutId === 'treemap') return '<cx:dataLabels pos="inEnd"><cx:visibility seriesName="0" categoryName="1" value="0"/></cx:dataLabels>';
  if (spec.layoutId === 'funnel') return '<cx:dataLabels pos="ctr"><cx:visibility seriesName="0" categoryName="0" value="1"/></cx:dataLabels>';
  return '';
}

// Per-point fills where the construct colours points, not series: a treemap
// tile per category, a waterfall bar by sign. The preview paints the same.
export function chartexPointColors(layoutId, values, palette) {
  if (layoutId === 'treemap') return values.map((value, index) => value === null ? null : palette[index % palette.length]);
  if (layoutId === 'waterfall') return values.map(value => value === null ? null : palette[value < 0 ? 1 : 0]);
  return values.map(() => null);
}

function axes(spec, gridColor) {
  if (!spec.axes) return '';
  const gridlines = `<cx:majorGridlines><cx:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="${gridColor}"><a:alpha val="70000"/></a:srgbClr></a:solidFill></a:ln></cx:spPr></cx:majorGridlines>`;
  const gapWidth = {clusteredColumn: '0.06', paretoLine: '0.06', boxWhisker: '1', waterfall: '0.5', funnel: '0.06'}[spec.layoutId] ?? '1';
  const category = `<cx:axis id="0"><cx:catScaling gapWidth="${gapWidth}"/><cx:tickLabels/></cx:axis>`;
  if (spec.layoutId === 'funnel') return `${category}<cx:axis id="1" hidden="1"><cx:valScaling/><cx:tickLabels/></cx:axis>`;
  const value = `<cx:axis id="1"><cx:valScaling/>${gridlines}<cx:tickLabels/></cx:axis>`;
  const percentage = spec.layoutId === 'paretoLine' ? '<cx:axis id="2"><cx:valScaling max="1" min="0"/><cx:units unit="percentage"/><cx:tickLabels/></cx:axis>' : '';
  return `${category}${value}${percentage}`;
}

/**
 * The cx:chartSpace part for one chart. `series` is the exporter's plotted
 * series ({name, labels, values}); `hasCategories` says whether the first data
 * column held category labels (a lone value column has none). The workbook
 * layout is PptxGenJS's: Sheet1, headings in row 1, categories in column A and
 * one series per following column.
 */
export function chartexPartXml({spec, series, hasCategories, number, workbookRelId, fill, labelColor, gridColor, font, palette}) {
  const rows = series[0].labels.length;
  const range = (letter) => `Sheet1!$${letter}$2:$${letter}$${rows + 1}`;
  const categories = hasCategories
    ? `<cx:strDim type="cat"><cx:f>${range('A')}</cx:f><cx:lvl ptCount="${rows}">${series[0].labels.map((label, index) => `<cx:pt idx="${index}">${escapeXml(label)}</cx:pt>`).join('')}</cx:lvl></cx:strDim>`
    : '';
  const data = series.map((entry, index) => {
    const points = entry.values.map((value, row) => value === null || !Number.isFinite(value) ? '' : `<cx:pt idx="${row}">${numberText(value)}</cx:pt>`).join('');
    return `<cx:data id="${index}">${categories}<cx:numDim type="${spec.dimension}"><cx:f>${range(columnLetters(index + 2))}</cx:f><cx:lvl ptCount="${rows}" formatCode="General">${points}</cx:lvl></cx:numDim></cx:data>`;
  }).join('');
  const plotted = series.map((entry, index) => {
    const color = palette[index % palette.length];
    const letter = columnLetters(index + 2);
    const pointFills = chartexPointColors(spec.layoutId, entry.values, palette)
      .map((pointColor, row) => pointColor ? `<cx:dataPt idx="${row}"><cx:spPr>${solidFill(pointColor)}</cx:spPr></cx:dataPt>` : '').join('');
    return `<cx:series layoutId="${spec.owner ?? spec.layoutId}" uniqueId="${seriesUniqueId(number, index)}">` +
      `<cx:tx><cx:txData><cx:f>Sheet1!$${letter}$1</cx:f><cx:v>${escapeXml(entry.name)}</cx:v></cx:txData></cx:tx>` +
      `<cx:spPr>${solidFill(color)}</cx:spPr>${pointFills}${dataLabels(spec)}<cx:dataId val="${index}"/>${layoutProperties(spec, entry, hasCategories)}` +
      (spec.axes ? '<cx:axisId val="0"/><cx:axisId val="1"/>' : '') + '</cx:series>';
  });
  if (spec.owner) {
    // The Office Pareto chart: the cumulative-percentage line owned by the binned columns, on the percentage axis.
    plotted.push(`<cx:series layoutId="${spec.layoutId}" ownerIdx="0" uniqueId="${seriesUniqueId(number, series.length)}"><cx:spPr><a:ln w="19050"><a:solidFill><a:srgbClr val="${palette[1 % palette.length]}"/></a:solidFill></a:ln></cx:spPr><cx:axisId val="0"/><cx:axisId val="2"/></cx:series>`);
  }
  const legend = spec.layoutId === 'boxWhisker' && series.length > 1 ? '<cx:legend pos="r" align="ctr" overlay="0"/>' : '';
  const alpha = fill.transparency > 0 ? Math.round((100 - fill.transparency) * 1000) : undefined;
  const face = escapeXml(font);
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<cx:chartSpace xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:cx="${NS.cx}">` +
    `<cx:chartData><cx:externalData r:id="${workbookRelId}" cx:autoUpdate="0"/>${data}</cx:chartData>` +
    `<cx:chart><cx:plotArea><cx:plotAreaRegion>${plotted.join('')}</cx:plotAreaRegion>${axes(spec, gridColor)}</cx:plotArea>${legend}</cx:chart>` +
    `<cx:spPr>${solidFill(fill.color, alpha)}<a:ln><a:noFill/></a:ln></cx:spPr>` +
    `<cx:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900">${solidFill(labelColor)}<a:latin typeface="${face}"/><a:ea typeface="${face}"/><a:cs typeface="${face}"/></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></cx:txPr>` +
    '</cx:chartSpace>';
}

export function chartexRelationshipsXml({workbookTarget, number}) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="${CHARTEX_RELATIONSHIP_TYPES.package}" Target="${escapeXml(workbookTarget)}"/>` +
    `<Relationship Id="rId2" Type="${CHARTEX_RELATIONSHIP_TYPES.style}" Target="style${number}.xml"/>` +
    `<Relationship Id="rId3" Type="${CHARTEX_RELATIONSHIP_TYPES.colors}" Target="colors${number}.xml"/>` +
    '</Relationships>';
}

// Chart style part (cs:chartStyle, style 201): every CT_StyleEntry the schema
// requires, in schema order, with the Office 2013+ default references. Series
// and point fills in the chartex part are explicit, so the style only governs
// text and chrome PowerPoint draws itself.
const STYLE_ENTRIES = [
  'axisTitle', 'categoryAxis', 'chartArea', 'dataLabel', 'dataLabelCallout', 'dataPoint', 'dataPoint3D', 'dataPointLine', 'dataPointMarker',
  'dataPointMarkerLayout', 'dataPointWireframe', 'dataTable', 'downBar', 'dropLine', 'errorBar', 'floor', 'gridlineMajor', 'gridlineMinor', 'hiLoLine',
  'leaderLine', 'legend', 'plotArea', 'plotArea3D', 'seriesAxis', 'seriesLine', 'title', 'trendline', 'trendlineLabel', 'upBar', 'valueAxis', 'wall',
];
export function chartStyleXml() {
  const textColor = '<a:schemeClr val="tx1"><a:lumMod val="65000"/><a:lumOff val="35000"/></a:schemeClr>';
  const faintLine = '<a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="tx1"><a:lumMod val="15000"/><a:lumOff val="85000"/></a:schemeClr></a:solidFill><a:round/></a:ln>';
  const entry = (name, {fillIdx = '0', fillColor = '', fontColor = '<a:schemeClr val="tx1"/>', spPr = '', size = '', mods = ''} = {}) =>
    `<cs:${name}${mods ? ` mods="${mods}"` : ''}><cs:lnRef idx="0"/><cs:fillRef idx="${fillIdx}">${fillColor}</cs:fillRef><cs:effectRef idx="0"/><cs:fontRef idx="minor">${fontColor}</cs:fontRef>${spPr ? `<cs:spPr>${spPr}</cs:spPr>` : ''}${size ? `<cs:defRPr sz="${size}" kern="1200"/>` : ''}</cs:${name}>`;
  const entries = STYLE_ENTRIES.map(name => {
    switch (name) {
      case 'dataPointMarkerLayout': return '<cs:dataPointMarkerLayout symbol="circle" size="5"/>';
      case 'axisTitle': return entry(name, {fontColor: textColor, size: '1000'});
      case 'categoryAxis': case 'valueAxis': case 'seriesAxis': return entry(name, {fontColor: textColor, spPr: faintLine, size: '900'});
      case 'chartArea': return entry(name, {mods: 'allowNoFillOverride allowNoLineOverride', spPr: `<a:solidFill><a:schemeClr val="bg1"/></a:solidFill>${faintLine}`, size: '1000'});
      case 'dataLabel': case 'dataLabelCallout': case 'dataTable': case 'legend': case 'trendlineLabel': return entry(name, {fontColor: textColor, size: '900'});
      case 'dataPoint': case 'dataPoint3D': case 'dataPointWireframe': case 'upBar': case 'floor': case 'wall':
        return entry(name, {fillIdx: '1', fillColor: '<cs:styleClr val="auto"/>', spPr: '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'});
      case 'dataPointLine': case 'dataPointMarker': case 'trendline': case 'seriesLine': case 'hiLoLine': case 'dropLine': case 'leaderLine': case 'errorBar':
        return entry(name, {fillColor: '<cs:styleClr val="auto"/>', spPr: '<a:ln w="28575" cap="rnd"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:round/></a:ln>'});
      case 'downBar': return entry(name, {fillIdx: '1', spPr: '<a:solidFill><a:schemeClr val="dk1"><a:lumMod val="65000"/><a:lumOff val="35000"/></a:schemeClr></a:solidFill>'});
      case 'gridlineMajor': case 'gridlineMinor': return entry(name, {spPr: faintLine});
      case 'title': return entry(name, {fontColor: textColor, size: '1400'});
      default: return entry(name);
    }
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cs:chartStyle xmlns:cs="${NS.cs}" xmlns:a="${NS.a}" id="201">${entries}</cs:chartStyle>`;
}

// Colour style part (cs:colorStyle, colourful palette 10): the six theme
// accents with the standard Office variations.
export function chartColorStyleXml() {
  const variations = ['', '<a:lumMod val="60000"/>', '<a:lumMod val="80000"/><a:lumOff val="20000"/>', '<a:lumMod val="80000"/>', '<a:lumMod val="60000"/><a:lumOff val="40000"/>',
    '<a:lumMod val="50000"/>', '<a:lumMod val="70000"/><a:lumOff val="30000"/>', '<a:lumMod val="70000"/>', '<a:lumMod val="50000"/><a:lumOff val="50000"/>'];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cs:colorStyle xmlns:cs="${NS.cs}" xmlns:a="${NS.a}" meth="cycle" id="10">` +
    [1, 2, 3, 4, 5, 6].map(n => `<a:schemeClr val="accent${n}"/>`).join('') + variations.map(v => `<cs:variation>${v}</cs:variation>`).join('') + '</cs:colorStyle>';
}

/**
 * Wrap the PptxGenJS chart frame: the mc:Choice references the chartex part,
 * the mc:Fallback keeps the classic chart frame. The choice frame copies the
 * name, id, description and transform of the original.
 */
export function wrapChartexFrame(frame, relId, requires) {
  const namespace = CHARTEX_NAMESPACES[requires];
  if (!namespace) throw new Error(`Unknown chartex namespace ${requires}.`);
  const head = frame.match(/^<p:graphicFrame>[\s\S]*?<\/p:xfrm>/)?.[0];
  if (!head) throw new Error('Generated chart frame has no transform.');
  const choice = `${head}<a:graphic xmlns:a="${NS.a}"><a:graphicData uri="${NS.cx}"><cx:chart xmlns:cx="${NS.cx}" xmlns:r="${NS.r}" r:id="${relId}"/></a:graphicData></a:graphic></p:graphicFrame>`;
  return `<mc:AlternateContent xmlns:mc="${NS.mc}"><mc:Choice xmlns:${requires}="${namespace}" Requires="${requires}">${choice}</mc:Choice><mc:Fallback>${frame}</mc:Fallback></mc:AlternateContent>`;
}

/**
 * Add the chartex parts for every chart the exporter registered in
 * `context.chartex` (by frame name), in slide order. Runs on the unzipped
 * package after the classic chart parts have their fonts and headings.
 */
export function attachChartexParts(entries, chartex, parseRelationships) {
  if (!chartex.size) return;
  const slides = Object.keys(entries).filter(part => /^ppt\/slides\/slide\d+\.xml$/.test(part)).sort((a, b) => Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]));
  const overrides = [];
  let number = 0;
  for (const part of slides) {
    const relationships = parseRelationships(entries, part);
    const relsPart = part.replace(/([^/]+)$/, '_rels/$1.rels');
    let rels = text(entries[relsPart]);
    let nextId = Math.max(0, ...[...rels.matchAll(/\bId="rId(\d+)"/g)].map(match => Number(match[1]))) + 1;
    let xml = text(entries[part]);
    let changed = false;
    xml = xml.replace(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g, frame => {
      const name = frame.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1];
      const chart = chartex.get(name);
      if (!chart) return frame;
      const chartPart = relationships.get(frame.match(/<c:chart\b[^>]*\br:id="([^"]+)"/)?.[1])?.path;
      if (!chartPart) throw new Error('Generated chart relationship is missing.');
      const workbook = [...parseRelationships(entries, chartPart).values()].find(relationship => relationship.type === CHARTEX_RELATIONSHIP_TYPES.package);
      if (!workbook) throw new Error('Generated chart has no embedded workbook.');
      number += 1;
      const base = `ppt/charts/chartEx${number}.xml`;
      entries[base] = encoder.encode(chartexPartXml({...chart, number, workbookRelId: 'rId1'}));
      entries[`ppt/charts/_rels/chartEx${number}.xml.rels`] = encoder.encode(chartexRelationshipsXml({workbookTarget: workbook.target, number}));
      entries[`ppt/charts/style${number}.xml`] = encoder.encode(chartStyleXml());
      entries[`ppt/charts/colors${number}.xml`] = encoder.encode(chartColorStyleXml());
      overrides.push(`<Override PartName="/${base}" ContentType="${CHARTEX_CONTENT_TYPES.chart}"/>`,
        `<Override PartName="/ppt/charts/style${number}.xml" ContentType="${CHARTEX_CONTENT_TYPES.style}"/>`,
        `<Override PartName="/ppt/charts/colors${number}.xml" ContentType="${CHARTEX_CONTENT_TYPES.colors}"/>`);
      const relId = `rId${nextId++}`;
      rels = rels.replace('</Relationships>', `<Relationship Id="${relId}" Type="${CHARTEX_RELATIONSHIP_TYPES.chart}" Target="../charts/chartEx${number}.xml"/></Relationships>`);
      changed = true;
      return wrapChartexFrame(frame, relId, chart.spec.requires);
    });
    if (!changed) continue;
    entries[part] = encoder.encode(xml);
    entries[relsPart] = encoder.encode(rels);
  }
  if (overrides.length) entries['[Content_Types].xml'] = encoder.encode(text(entries['[Content_Types].xml']).replace('</Types>', `${overrides.join('')}</Types>`));
}

// ---------------------------------------------------------------------------
// Import

const asArray = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const scalar = value => typeof value === 'string' ? value : value && typeof value === 'object' ? String(value['#text'] ?? '') : value === undefined ? '' : String(value);

/**
 * Read a parsed cx:chartSpace (fast-xml-parser, prefixes kept, attributes as
 * plain keys) back to an OPF chart. Returns null when no cx:series names a
 * kept OPF chart type (sunburst has no OPF record). `heading` is the category
 * heading recovered from the workbook, `limits` the cache bounds
 * ({points, cells}) and `invalid(message, path)` throws the import error.
 */
export function chartFromChartex(doc, {heading, limits, invalid, path}) {
  const space = doc?.['cx:chartSpace'];
  const region = space?.['cx:chart']?.['cx:plotArea']?.['cx:plotAreaRegion'];
  const allSeries = asArray(region?.['cx:series']);
  const type = chartTypeFromChartex(allSeries.map(series => series?.layoutId));
  if (!type) return null;
  const dataById = new Map(asArray(space?.['cx:chartData']?.['cx:data']).map(data => [String(data?.id ?? ''), data]));
  const plotted = allSeries.filter(series => series?.ownerIdx === undefined && series?.['cx:dataId']?.val !== undefined);
  if (!plotted.length) return null;
  const integer = (raw, limit, location) => {
    if (typeof raw !== 'string' || !/^[+-]?\d+$/.test(raw.trim())) invalid('expected an unsigned integer', location);
    const value = Number(raw.trim());
    if (!Number.isSafeInteger(value) || value < 0 || value > limit) invalid(`integer exceeds the supported range 0–${limit}`, location);
    return value;
  };
  let cells = 0;
  const level = (dimension, location, numeric) => {
    const lvl = asArray(dimension?.['cx:lvl'])[0];
    if (!lvl) return [];
    const count = lvl.ptCount === undefined ? undefined : integer(lvl.ptCount, limits.points, `${location}/cx:lvl@ptCount`);
    const points = asArray(lvl['cx:pt']);
    if (points.length > limits.points) invalid('too many points', location);
    let extent = count ?? 0;
    const indexed = new Map();
    for (const [position, point] of points.entries()) {
      const at = `${location}/cx:lvl/cx:pt[${position}]@idx`;
      const index = integer(point?.idx, limits.points - 1, at);
      if (count !== undefined && index >= count) invalid('point index is outside its declared count', at);
      if (indexed.has(index)) invalid('duplicate point index', at);
      const value = scalar(point);
      if (numeric) {
        const parsed = value.trim() === '' ? null : Number(value);
        if (parsed !== null && !Number.isFinite(parsed)) invalid('numeric point is not a finite number', at);
        indexed.set(index, parsed);
      } else indexed.set(index, value);
      extent = Math.max(extent, index + 1);
    }
    cells += extent;
    if (cells > limits.cells) invalid('combined caches exceed the 1,000,000-cell import limit', location);
    const result = new Array(extent).fill(null);
    for (const [index, value] of indexed) result[index] = value;
    return result;
  };
  let labels = null;
  const names = [], values = [];
  plotted.forEach((series, index) => {
    const data = dataById.get(String(series['cx:dataId'].val));
    if (!data) invalid('series data is missing', `${path}#cx:series[${index}]/cx:dataId`);
    const location = `${path}#cx:data[@id="${series['cx:dataId'].val}"]`;
    const categories = asArray(data['cx:strDim']).find(dimension => dimension?.type === 'cat');
    if (categories && !labels) labels = level(categories, `${location}/cx:strDim`, false);
    const numeric = asArray(data['cx:numDim'])[0];
    values.push(numeric ? level(numeric, `${location}/cx:numDim`, true) : []);
    const name = series['cx:tx']?.['cx:txData']?.['cx:v'];
    names.push(name === undefined ? `Series ${index + 1}` : scalar(name));
  });
  const rowCount = values.reduce((count, row) => Math.max(count, row.length), labels?.length ?? 0);
  if (rowCount === 0) return null;
  if (rowCount * (values.length + (labels ? 1 : 0)) > limits.cells) invalid('chart cache exceeds the 1,000,000-cell import limit', path);
  // A histogram or Pareto chart binned from one value column has no category dimension: the column comes back as authored.
  if (!labels) return {type, data: {columns: [names[0]], rows: values[0].slice(0, rowCount).map((value, index) => [values[0][index] ?? null])}};
  const rows = [];
  for (let index = 0; index < rowCount; index += 1) rows.push([labels[index] ?? null, ...values.map(row => row[index] ?? null)]);
  return {type, data: {columns: [heading ?? 'Category', ...names], rows}};
}
