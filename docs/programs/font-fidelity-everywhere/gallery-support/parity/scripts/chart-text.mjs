// Chart text sizes per text role, for the parity harness (FF-62). Pure: no I/O.
//
// A chart carries text in four roles: the axes (tick labels), the data labels, the legend and the title. The preview draws all of its chart
// text at one size, the readability floor (renderer charts.js: max(14, minFontSize ?? 16) px, 12 pt on a 13.33 x 7.5 in slide). The exported
// part names a size per role (classic `c:txPr`, chartex `cx:txPr`). Comparing "any size in the part" lets a role at the wrong size hide behind
// another role at the right one (the 12 pt legend hid the 9 pt axis labels, FF-62), so each role is compared with the same role.

export const CHART_TEXT_ROLES = Object.freeze(['axis', 'dataLabels', 'legend', 'title']);

const SIZE_ATTRIBUTE = /<a:(?:defRPr|rPr)\b[^>]*\bsz="(\d+)"/g;
const uniq = (values) => [...new Set(values)];

// The element that holds each role's text properties. Titles come out first: a title inside an axis is the title role, not the axis role.
const CLASSIC_BLOCKS = [
  ['title', /<c:title\b[\s\S]*?<\/c:title>/g],
  ['axis', /<c:(catAx|valAx|dateAx|serAx)\b[\s\S]*?<\/c:\1>/g],
  ['legend', /<c:legend\b[\s\S]*?<\/c:legend>/g],
  ['dataLabels', /<c:dLbls\b[\s\S]*?<\/c:dLbls>/g],
];
const CHARTEX_BLOCKS = [
  ['title', /<cx:title\b[\s\S]*?<\/cx:title>/g],
  ['axis', /<cx:axis\b[^>]*>[\s\S]*?<\/cx:axis>/g],
  ['legend', /<cx:legend\b[^>]*>[\s\S]*?<\/cx:legend>/g],
  ['dataLabels', /<cx:dataLabels\b[^>]*>[\s\S]*?<\/cx:dataLabels>/g],
];

/**
 * The text sizes (points) a chart part names per role. `blocks` is how many elements of the role the part has; `sizes` the distinct explicit
 * sizes in them. A role with blocks and no sizes inherits PowerPoint's default (18 pt for a classic chart), which is not a size the export wrote.
 * @param {string} xml the c:chartSpace or cx:chartSpace part
 * @param {boolean} chartex
 * @returns {Record<'axis'|'dataLabels'|'legend'|'title', {blocks: number, sizes: number[]}>}
 */
export function chartPartTextSizes(xml, chartex) {
  let rest = String(xml);
  const out = Object.fromEntries(CHART_TEXT_ROLES.map((role) => [role, {blocks: 0, sizes: []}]));
  for (const [role, pattern] of chartex ? CHARTEX_BLOCKS : CLASSIC_BLOCKS) {
    const found = [];
    rest = rest.replace(pattern, (block) => { found.push(block); return ''; });
    out[role].blocks = found.length;
    out[role].sizes = uniq(found.flatMap((block) => [...block.matchAll(SIZE_ATTRIBUTE)].map((match) => Number(match[1]) / 100))).sort((a, b) => a - b);
  }
  return out;
}

// The text rows the chart draws below `.data.rows.<row>.<column>`: what each is depends on the construct (catalog `mappings.openxml.element`).
// A pie or doughnut draws its categories as the legend; a treemap draws its tile names as data labels. Every other construct puts the category
// (column 0) on the category axis and a value (column 1 and up) on the bar or tile it labels.
const ROW_TEXT_ROLE = Object.freeze({pieChart: () => 'legend', doughnutChart: () => 'legend', treemapChart: () => 'dataLabels'});

/**
 * The role of one preview text line, from the trace path the renderer stamps on it (series names are `data.columns.N`, a category or a value
 * is `data.rows.R.C`, an axis tick is the chart's own path) and the chart's catalog element.
 */
export function previewTextRole(path, element) {
  const match = /\.data\.(columns|rows)\.(\d+)(?:\.(\d+))?$/.exec(String(path ?? ''));
  if (!match) return 'axis';
  if (match[1] === 'columns') return 'legend';
  return (ROW_TEXT_ROLE[element] ?? ((column) => (column === 0 ? 'axis' : 'dataLabels')))(Number(match[3] ?? 0));
}

/** Preview text sizes (points) per role: `lines` are `{path, sizes: number[]}` (the sizes of the line's runs). */
export function previewTextSizes(lines, element) {
  const out = Object.fromEntries(CHART_TEXT_ROLES.map((role) => [role, []]));
  for (const line of lines) out[previewTextRole(line.path, element)].push(...line.sizes);
  for (const role of CHART_TEXT_ROLES) out[role] = uniq(out[role]).sort((a, b) => a - b);
  return out;
}

/**
 * The per-role size mismatches between what the preview draws and what the part names. Only roles the preview draws are compared, and only
 * against the same role in the part: a role the part has no element for is not a size question (the mark checks own presence). Every size the
 * preview draws in a role must be one the part names for it, and the part names no other size for it. `tolerance` is in points.
 * @returns {string[]} one message per mismatching role
 */
export function chartTextSizeMismatches(preview, part, tolerance) {
  const close = (a, b) => Math.abs(a - b) <= tolerance;
  const messages = [];
  for (const role of CHART_TEXT_ROLES) {
    const drawn = preview[role], named = part[role];
    if (!drawn?.length || !named?.blocks) continue;
    if (!named.sizes.length) messages.push(`chart ${role} text: preview [${drawn}] vs chart [no explicit size]`);
    else if (!drawn.every((size) => named.sizes.some((value) => close(value, size))) || !named.sizes.every((value) => drawn.some((size) => close(value, size)))) {
      messages.push(`chart ${role} text: preview [${drawn}] vs chart [${named.sizes}]`);
    }
  }
  return messages;
}
