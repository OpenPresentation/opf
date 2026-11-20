// LH-60: the PPTX side of core's chart fallbacks (`chartDrawPlan`) and LH-56's label colours inside chartex marks.
//
// Core decides how a chart whose data does not fit its type is drawn; the exporter writes that construct, so the preview and PowerPoint
// show the same chart. Only the nested rings need a rewrite here: PptxGenJS writes the first series of a doughnut alone (it plots one
// series per pie), so the other rings are added to the generated c:doughnutChart as further c:ser elements, each a copy of the first with
// its own index, name, workbook column and values. The embedded workbook already holds every series (PptxGenJS writes one column each).
import {chartDrawPlan, markLabelColor, textColorForFill} from '@openpresentation/opf/composition';

export {chartDrawPlan};

const FALLBACK_MESSAGES = Object.freeze({
  'map-as-columns': 'its categories are not places a map can plot, so it is exported as a clustered column chart of every series',
  'pareto-as-columns': 'a Pareto chart sorts one series, so its several series are exported as a clustered column chart of every series in data order',
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
 * LH-92: name each ring of a doughnut of nested rings on the slice core chose (`layer.rings`: series, name, row, rotation), after the data labels
 * are written. With data labels, that slice's c:dLbl also shows the series name (PowerPoint puts it first, before the label's own parts,
 * with the labels' separator), as the preview draws it. Without, the series' c:dLbls is one c:dLbl that shows the series name alone and
 * shows nothing else. The name takes the colour that contrasts with the slice (core `textColorForFill` of the full text colour), as the
 * preview draws a label inside a ring, and runs along the ring (core's rotation, the label's custom text angle). `fills(series)` gives
 * the slice fills of a series (hex, by row), `size` the text size in hundredths of a point.
 */
export function applyRingLabels(xml, rings, {labels, fills, labelColor, size, font}) {
  if (!Array.isArray(rings) || rings.length < 2) return xml;
  const named = new Map(rings.map(ring => [ring.series, ring]));
  const face = escapeXml(font);
  return xml.replace(/<c:doughnutChart>[\s\S]*?<\/c:doughnutChart>/, group => group.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, ser => {
    const ring = named.get(Number(/<c:idx val="(\d+)"\/>/.exec(ser)?.[1]));
    if (!ring) return ser;
    // The label runs along the ring: a custom text angle (a:bodyPr rot, 60000ths of a degree) about the label's centre.
    const body = ring.rotation ? `<a:bodyPr rot="${Math.round(ring.rotation * 60000)}" vert="horz"/>` : '<a:bodyPr/>';
    if (labels) {
      return ser.replace(new RegExp(`<c:dLbl><c:idx val="${ring.row}"/>[\\s\\S]*?</c:dLbl>`), point => point.replace('<c:showSerName val="0"/>', '<c:showSerName val="1"/>').replace(/<a:bodyPr\/>/, () => body));
    }
    const fill = fills(ring.series)?.[ring.row] ?? '000000';
    const color = String(textColorForFill(`#${fill}`, `#${labelColor}`)).replace(/^#/, '').toUpperCase();
    const text = `<c:txPr>${body}<a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="0" i="0" u="none" strike="noStrike"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill>` +
      `<a:latin typeface="${face}"/><a:ea typeface="${face}"/><a:cs typeface="${face}"/></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`;
    const hidden = '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/>';
    const block = `<c:dLbls><c:dLbl><c:idx val="${ring.row}"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${text}` +
      `<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="1"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbl>${hidden}<c:showLeaderLines val="0"/></c:dLbls>`;
    // In CT_PieSer order the labels come after the point fills and before the categories.
    return /<c:dLbls>[\s\S]*?<\/c:dLbls>/.test(ser) ? ser.replace(/<c:dLbls>[\s\S]*?<\/c:dLbls>/, () => block) : ser.replace(/(<c:cat>|<c:val>)/, (head) => `${block}${head}`);
  }));
}

/**
 * LH-56: the text colour of a label inside a chartex mark of colour `fill` (hex without #): core's `markLabelColor` of the full text colour
 * `labelColor` and the slide `background` (the text colour at 4.5:1, else the background, else black or white), as the preview draws
 * treemap tiles and funnel bars. The text and background are role colours, which the finished part writes as theme colours.
 */
export function insideLabelColor(fill, labelColor, background) {
  return String(markLabelColor(`#${fill}`, `#${labelColor}`, background ? `#${background}` : undefined)).replace(/^#/, '').toUpperCase();
}
