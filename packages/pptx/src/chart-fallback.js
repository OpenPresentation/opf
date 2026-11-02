// LH-60: the PPTX side of core's chart fallbacks (`chartDrawPlan`) and LH-56's label colours inside chartex marks.
//
// Core decides how a chart whose data does not fit its type is drawn; the exporter writes that construct, so the preview and PowerPoint
// show the same chart. Only the nested rings need a rewrite here: PptxGenJS writes the first series of a doughnut alone (it plots one
// series per pie), so the other rings are added to the generated c:doughnutChart as further c:ser elements, each a copy of the first with
// its own index, name, workbook column and values. The embedded workbook already holds every series (PptxGenJS writes one column each).
import {chartDrawPlan, textColorForFill} from '@openpresentation/opf/composition';

export {chartDrawPlan};

const FALLBACK_MESSAGES = Object.freeze({
  'map-as-columns': 'its categories are not places a map can plot, so it is exported as a clustered column chart of every series',
  'box-per-series': 'it has one value per category, so its rows form one group and each series is one box of its values',
  'nested-rings': 'it has several series, so it is exported as a doughnut chart with one ring per series (the first innermost)',
  'scatter-by-position': 'its X column holds no numbers, so its series are plotted against the category position and that column is not exported',
});

/** LH-60: the `chart-data-adapted` entry that says how core's draw plan exports a chart other than as authored. */
export function chartFallbackAdaptation(plan, typeName) {
  return {adaptation: 'chart-fallback', fallback: plan.fallback, message: `The '${typeName}' chart is drawn as core's ${plan.fallback} fallback: ${FALLBACK_MESSAGES[plan.fallback] ?? 'its data does not fit the type'}, as the preview draws it.`};
}

const escapeXml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The spreadsheet column letters of a 1-based column number (1 is A, 27 is AA). */
function columnLetters(number) {
  let letters = '';
  for (let rest = number; rest > 0; rest = Math.floor((rest - 1) / 26)) letters = String.fromCharCode(65 + (rest - 1) % 26) + letters;
  return letters;
}

/**
 * Add rings 2 to n to a generated doughnut chart part. `series` is the exported series ({name, values}), the first already written by
 * PptxGenJS; PowerPoint draws the first series innermost, as the preview does. Each added c:ser repeats the first one's point fills and
 * labels (a ring is coloured by category, like the first) with its own c:idx, c:order, name (column N+1, row 1) and values (column N+1).
 */
export function applyDoughnutRings(xml, series) {
  if (!Array.isArray(series) || series.length < 2) return xml;
  const match = /<c:doughnutChart>[\s\S]*?(<c:ser>[\s\S]*?<\/c:ser>)/.exec(xml);
  if (!match) return xml;
  const first = match[1];
  const rows = series[0].values.length;
  const added = series.slice(1).map((entry, offset) => {
    const index = offset + 1, letter = columnLetters(index + 2);
    const points = entry.values.map((value, row) => value === null || value === undefined || !Number.isFinite(value) ? '' : `<c:pt idx="${row}"><c:v>${value}</c:v></c:pt>`).join('');
    // Function replacements: the workbook references ($C$1) must not be read as replacement patterns.
    return first
      .replace(/<c:idx val="0"\/>\s*<c:order val="0"\/>/, () => `<c:idx val="${index}"/><c:order val="${index}"/>`)
      .replace(/<c:tx>[\s\S]*?<\/c:tx>/, () => `<c:tx><c:strRef><c:f>Sheet1!$${letter}$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escapeXml(entry.name)}</c:v></c:pt></c:strCache></c:strRef></c:tx>`)
      .replace(/<c:val>[\s\S]*?<\/c:val>/, () => `<c:val><c:numRef><c:f>Sheet1!$${letter}$2:$${letter}$${rows + 1}</c:f><c:numCache><c:ptCount val="${rows}"/>${points}</c:numCache></c:numRef></c:val>`);
  });
  return xml.replace(first, () => `${first}${added.join('')}`);
}

/**
 * LH-56: the text colour of a label inside a chartex mark of colour `fill` (hex without #): core's `textColorForFill` from the full text
 * colour `labelColor` (black or white when that colour falls under 4.5:1 on the fill), as the preview draws treemap tiles and funnel bars.
 */
export function insideLabelColor(fill, labelColor) {
  return String(textColorForFill(`#${fill}`, `#${labelColor}`)).replace(/^#/, '').toUpperCase();
}
