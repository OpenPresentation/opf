// RR-54: chart and table data in the PPTX export and import (core docs/chart-table-data.md).
//
// Core resolves chart and table data for every engine: one strict number rule (`chartNumber`), the NumberFormat to
// Excel code conversion, top-level datasets and series mapping by column name. This module reads those functions from
// core and writes their result into the native chart: the series c:numCache/c:formatCode, the data-label and value-axis
// c:numFmt and the embedded workbook cell formats (src/chart-workbook.js). A chart without number formats is written
// exactly as before.
//
// Optional core exports are read from the namespace, so a published core before RR-54 still loads: its schema rejects
// the new fields, so the fallbacks only need the inline positional form, with the same strict number rule.
import * as opfCore from '@openpresentation/opf';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const STRICT_DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

/** Core `chartNumber` (strict decimal syntax; everything else is a gap). */
export const chartNumber = typeof opfCore.chartNumber === 'function' ? opfCore.chartNumber : value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!STRICT_DECIMAL.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && (!Number.isInteger(number) || Number.isSafeInteger(number)) ? number : null;
};
/** NumberFormat -> Excel format code ("General" when absent). */
export const excelNumberFormat = typeof opfCore.excelNumberFormat === 'function' ? opfCore.excelNumberFormat : () => 'General';
/** Excel format code -> NumberFormat, or undefined when it has no exact equivalent. */
export const numberFormatFromExcel = typeof opfCore.numberFormatFromExcel === 'function' ? opfCore.numberFormatFromExcel : () => undefined;
export const isDatasetRef = typeof opfCore.isDatasetRef === 'function' ? opfCore.isDatasetRef : value => object(value) && typeof value.dataset === 'string';
export const inlineChartData = typeof opfCore.inlineChartData === 'function' ? opfCore.inlineChartData : chart => chart;
export const inlineTableData = typeof opfCore.inlineTableData === 'function' ? opfCore.inlineTableData : table => table;
export const tableCellDisplayValue = typeof opfCore.tableCellDisplayValue === 'function' ? opfCore.tableCellDisplayValue : cell => cell;
export const resolveTableData = typeof opfCore.resolveTableData === 'function' ? opfCore.resolveTableData
  : table => ({...(Array.isArray(table?.columns) ? {columns: table.columns} : {}), rows: Array.isArray(table?.rows) ? table.rows : [], formats: [], diagnostics: []});

const columnName = column => typeof column === 'string' ? column : object(column) && typeof column.name === 'string' ? column.name : '';

// Before RR-54 core: inline positional data only (the schema of that core has no datasets or mapping).
function positionalChartData(chart) {
  const data = chart?.data;
  if (!object(data) || !Array.isArray(data.columns)) return {ok: false, reason: 'no-columns', message: 'The chart data has no columns.', diagnostics: []};
  if (!data.columns.length) return {ok: false, reason: 'no-columns', message: 'The chart data has no columns.', diagnostics: []};
  if (!Array.isArray(data.rows) || !data.rows.length) return {ok: false, reason: 'no-rows', message: 'The chart data has no rows.', diagnostics: []};
  const diagnostics = [];
  const rows = data.rows.map((row, rowIndex) => data.columns.map((_, index) => {
    const cell = Array.isArray(row) && index < row.length ? row[index] : null;
    if (index === 0) return cell === undefined ? null : cell;
    const number = chartNumber(cell);
    if (number === null && cell !== null && cell !== undefined && cell !== '') diagnostics.push({code: 'chart-value-not-numeric', severity: 'warning', path: `/data/rows/${rowIndex}/${index}`, message: `chart value ${JSON.stringify(cell)} is not a number; it is plotted as a gap.`});
    return number;
  }));
  return {ok: true, columns: data.columns.map(columnName), formats: data.columns.map(() => undefined), rows, diagnostics};
}

/** Core `resolveChartData`: the canonical positional table [category, (x,) ...series], or {ok: false, reason}. */
export const resolveChartData = typeof opfCore.resolveChartData === 'function' ? opfCore.resolveChartData : positionalChartData;

/**
 * True when a chart uses an RR-54 data field that the native cache alone cannot carry back, or is a combo chart whose `line` or
 * `secondaryAxis` exports its series in another order than the data's (FA-15: column series first, then lines), so the record
 * restores the authored column order.
 */
export function chartUsesDataFields(chart) {
  const data = chart?.data;
  return object(chart) && (chart.mapping !== undefined || isDatasetRef(data) || (object(data) && (data.source !== undefined || (Array.isArray(data.columns) && data.columns.some(object))))
    || (chart.type === 'combo' && (chart.line !== undefined || chart.secondaryAxis !== undefined)));
}

/** True when a table is dataset-backed or carries a DataColumn header or a number format. */
export function tableUsesDataFields(table) {
  if (!object(table)) return false;
  if (isDatasetRef(table)) return true;
  const formatted = cell => object(cell) && (typeof cell.format === 'string' || (typeof cell.name === 'string' && !Object.hasOwn(cell, 'value')));
  return (Array.isArray(table.columns) && table.columns.some(formatted)) || (Array.isArray(table.rows) && table.rows.some(row => Array.isArray(row) && row.some(formatted)));
}

// ---------------------------------------------------------------------------
// Export: number formats in the classic chart part

const escapeXml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** The Excel code of a NumberFormat, or undefined when it is absent or General (the exporter's default). */
export function excelCode(format) {
  if (format === undefined) return undefined;
  const code = excelNumberFormat(format);
  return code && code !== 'General' ? code : undefined;
}

/**
 * Write the number formats of a generated classic chart part (after its data labels are written). `formats`:
 *   series  the Excel code of each c:ser, in document order (undefined keeps General);
 *   x       the X column's code (scatter c:xVal and the horizontal value axis);
 *   axis    the value axis code (the first plotted series' format, as Excel does), or undefined to keep the axis;
 *   secondaryAxis  a combo chart's secondary value axis code (its first series' format, FA-15), or undefined to keep it;
 *   labels  false when the labels show percentages (the percent label keeps PowerPoint's own percent form);
 *   scatter true for an XY chart (two value axes: axPos b/t is X).
 * Every c:numCache of a series takes its code, every c:numFmt of a series' data labels too; the chart group's labels
 * take the first series' code.
 */
export function applyChartNumberFormats(xml, {series = [], x, axis, secondaryAxis, labels = true, scatter = false}) {
  // CT_NumData: formatCode is the cache's first child (PptxGenJS writes none on pie and doughnut series).
  const formatCode = (text, code) => code === undefined ? text : /<c:formatCode>/.test(text)
    ? text.replace(/<c:formatCode>[^<]*<\/c:formatCode>/g, `<c:formatCode>${escapeXml(code)}</c:formatCode>`)
    : text.replace(/<c:numCache>/g, `<c:numCache><c:formatCode>${escapeXml(code)}</c:formatCode>`);
  const labelFormats = (text, code) => code === undefined || !labels ? text : text.replace(/<c:dLbls>[\s\S]*?<\/c:dLbls>/g, block => block.replace(/<c:numFmt\b[^>]*\/>/g, `<c:numFmt formatCode="${escapeXml(code)}" sourceLinked="0"/>`));
  // Radar and scatter series carry no labels of their own (PptxGenJS writes the chart group's only), so every series would
  // show the first series' format. When shown labels differ by series, each series gets a copy of the group's labels,
  // in the CT_RadarSer / CT_ScatterSer position (before trendline, errBars, cat, val, xVal and yVal).
  const group = xml.split(/<c:ser>[\s\S]*?<\/c:ser>/).join('').match(/<c:dLbls>[\s\S]*?<\/c:dLbls>/)?.[0];
  const ownLabels = labels && group && /<c:showVal val="1"\/>/.test(group) && series.some(code => code !== series[0]);
  let index = 0;
  const out = (ownLabels ? xml.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, ser => /<c:dLbls>/.test(ser) ? ser : ser.replace(/<c:(?:trendline|errBars|cat|val|xVal|yVal)>/, at => `${group}${at}`)) : xml).replace(/<c:ser>[\s\S]*?<\/c:ser>/g, ser => {
    const code = series[index++];
    const result = ser.replace(/<c:(val|yVal|xVal)>[\s\S]*?<\/c:\1>/g, (role, name) => formatCode(role, name === 'xVal' ? x : code));
    return labelFormats(result, code);
  });
  // The chart group's own label block (outside every c:ser) follows the group's first series. Only a combo chart has more than
  // one group (FA-15: its line groups follow their own first series).
  let first = 0;
  const grouped = out.replace(/<c:(barChart|lineChart|areaChart|pieChart|doughnutChart|scatterChart|radarChart)>[\s\S]*?<\/c:\1>/g, group => {
    const code = series[first];
    first += group.match(/<c:ser>/g)?.length ?? 0;
    return group.split(/(<c:ser>[\s\S]*?<\/c:ser>)/).map((part, position) => position % 2 ? part : labelFormats(part, code)).join('');
  });
  // The first c:valAx is the value axis; a combo chart's second one is its secondary axis (a scatter chart's two are X and Y).
  let valueAxis = 0;
  return grouped.replace(/<c:valAx>[\s\S]*?<\/c:valAx>/g, valAx => {
    const code = scatter ? (/<c:axPos val="[bt]"\/>/.test(valAx) ? x : axis) : valueAxis++ === 0 ? axis : secondaryAxis;
    return code === undefined ? valAx : valAx.replace(/<c:numFmt\b[^>]*\/>/, `<c:numFmt formatCode="${escapeXml(code)}" sourceLinked="0"/>`);
  });
}

/** The workbook ranges and codes of a classic chart part's numeric series: [{formula, code}]. */
export function numericRanges(xml, {series = [], x}) {
  const ranges = [];
  let index = 0;
  for (const [ser] of xml.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)) {
    const code = series[index++];
    for (const [, role, body] of ser.matchAll(/<c:(val|yVal|xVal)>([\s\S]*?)<\/c:\1>/g)) {
      const formula = /<c:numRef>\s*<c:f>([^<]*)<\/c:f>/.exec(body)?.[1];
      const value = role === 'xVal' ? x : code;
      if (formula && value !== undefined && !ranges.some(range => range.formula === formula)) ranges.push({formula, code: value});
    }
  }
  return ranges;
}

// ---------------------------------------------------------------------------
// Import: series number formats

/**
 * The NumberFormat of a native cache's format code: {format} when core maps it back exactly, {unmapped: code} when it
 * is a code with no NumberFormat equivalent, {} for General or no code.
 */
export function formatFromCode(code) {
  if (typeof code !== 'string' || code.trim() === '' || /^general$/i.test(code.trim())) return {};
  const format = numberFormatFromExcel(code);
  return format === undefined ? {unmapped: code} : {format};
}

/** Columns with their number formats: a column whose code maps back becomes {name, format}; the others stay names. */
export function formattedColumns(names, codes, report) {
  const unmapped = [];
  const columns = names.map((name, index) => {
    const {format, unmapped: code} = formatFromCode(codes[index]);
    if (code !== undefined) unmapped.push(`'${name}' (${code})`);
    return format === undefined ? name : {name, format};
  });
  if (unmapped.length) report?.({code: 'chart-number-format-adapted', option: 'data', message: `The number ${unmapped.length === 1 ? 'format' : 'formats'} of ${unmapped.join(', ')} ${unmapped.length === 1 ? 'has' : 'have'} no OPF number format equivalent; ${unmapped.length === 1 ? 'that column imports' : 'those columns import'} without a format (the General form), so the values keep their numbers but not their native display.`});
  return columns;
}
