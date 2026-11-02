// LH-105: direct labels instead of legends in the PPTX export and import.
//
// Composition decides them (core chart-direct-labels.ts, `ComposedChart.layer.endLabels` and `.slices`); the preview (opf-render charts.js)
// draws them and this module writes them natively into the generated classic chart, after the data labels:
//
//   end labels (line)    each named series gets one c:dLbl on its last point that shows its value and name as text ("61 Enterprise NPS",
//                        c:tx c:rich, bold when the title names the series; c:showSerName marks it as the end label), right of
//                        the point (c:dLblPos r; l right to left), in the series colour core made legible, moved up or down by core's
//                        offset (c:layout c:manualLayout c:y, a fraction of the chart height from the default place). The chart has no
//                        legend, and its plot area keeps core's inner layout with the gutter for the names (chart-layer.js).
//   slice labels (pie)   each slice gets a c:dLbl that shows its category name (c:showCatName), inside its end or outside it (c:dLblPos
//                        inEnd or outEnd; a doughnut has no position and labels in its ring), in the colour that contrasts with the slice
//                        inside and the chart text colour outside, with leader lines on. The chart has no legend.
//
// Import reads them as the default they are: a line chart whose only labels are series names on the last points, and a pie or doughnut
// whose only labels are category names, without a legend, import with no `legend` and no `dataLabels` (`directLabelDefaults`).
import {textColorForFill} from '@openpresentation/opf/composition';

const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[char]));
const fraction = value => Number(value.toFixed(4));
const NO_LINE = '<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>';
const HIDDEN = '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/>';

function textProperties(color, size, font) {
  const face = escapeXml(font);
  return `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="0" i="0" u="none" strike="noStrike"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill>` +
    `<a:latin typeface="${face}"/><a:ea typeface="${face}"/><a:cs typeface="${face}"/></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`;
}

/** Put a series' c:dLbls in place of its own, or (none written) before the parts CT_LineSer and CT_PieSer put after it. */
function withLabels(ser, block) {
  return /<c:dLbls>[\s\S]*?<\/c:dLbls>/.test(ser) ? ser.replace(/<c:dLbls>[\s\S]*?<\/c:dLbls>/, () => block) : ser.replace(/(<c:trendline>|<c:errBars>|<c:cat>|<c:val>)/, head => `${block}${head}`);
}

/**
 * Write the names at the line ends (`info`: {entries, colors, region (inches), size, font, rtl}) into the c:lineChart of a generated chart
 * part: entry `i` names series `entries[i].series` on its point `row`, moved from the point's middle to its box's middle.
 */
export function applyEndLabels(xml, info) {
  const entries = info?.entries;
  if (!Array.isArray(entries) || !entries.length) return xml;
  const named = new Map(entries.map((entry, index) => [entry.series, {entry, color: info.colors[index]}]));
  const height = info.region.h * 96;
  return xml.replace(/<c:lineChart>[\s\S]*?<\/c:lineChart>/, group => group.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, ser => {
    const found = named.get(Number(/<c:idx val="(\d+)"\/>/.exec(ser)?.[1]));
    if (!found) return ser;
    const {entry, color} = found;
    const dy = fraction((entry.box.y + entry.box.height / 2 - entry.point.y) / height);
    const layout = dy ? `<c:layout><c:manualLayout><c:x val="0"/><c:y val="${dy}"/></c:manualLayout></c:layout>` : '';
    // The label's text is written as it is drawn ("61 Enterprise NPS", the value before the name, which PowerPoint's own field order
    // would reverse), bold for a series the title names.
    const face = escapeXml(info.font), run = `sz="${info.size}" b="${entry.bold ? 1 : 0}" i="0" u="none" strike="noStrike"`;
    const paint = `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${face}"/><a:ea typeface="${face}"/><a:cs typeface="${face}"/>`;
    const text = `<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr ${run}>${paint}</a:defRPr></a:pPr><a:r><a:rPr lang="en-US" ${run}>${paint}</a:rPr><a:t>${escapeXml(entry.text ?? entry.name)}</a:t></a:r></a:p></c:rich></c:tx>`;
    const label = `<c:dLbl><c:idx val="${entry.row}"/>${layout}${text}${NO_LINE}${textProperties(color, info.size, info.font)}<c:dLblPos val="${info.rtl ? 'l' : 'r'}"/>` +
      '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="1"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbl>';
    return withLabels(ser, `<c:dLbls>${label}${HIDDEN}</c:dLbls>`);
  }));
}

/**
 * Write the category names on the slices (`info`: {labels: [{row, position}], fills (hex by row), labelColor (the chart text colour on
 * the backdrop), size, font}) into the one series of a generated pie or doughnut part.
 */
export function applySliceLabels(xml, info) {
  const labels = info?.labels;
  if (!Array.isArray(labels) || !labels.length) return xml;
  const doughnut = /<c:doughnutChart>/.test(xml);
  return xml.replace(/<c:(pieChart|doughnutChart)>[\s\S]*?<\/c:\1>/, group => group.replace(/<c:ser>[\s\S]*?<\/c:ser>/, ser => {
    const points = labels.map(({row, position}) => {
      const inside = position !== 'outside';
      const color = inside ? String(textColorForFill(`#${info.fills[row] ?? '000000'}`, `#${info.labelColor}`)).replace(/^#/, '').toUpperCase() : info.labelColor;
      return `<c:dLbl><c:idx val="${row}"/>${NO_LINE}${textProperties(color, info.size, info.font)}${doughnut ? '' : `<c:dLblPos val="${inside ? 'inEnd' : 'outEnd'}"/>`}` +
        '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="1"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbl>';
    }).join('');
    return withLabels(ser, `<c:dLbls>${points}${NO_LINE}${textProperties(info.labelColor, info.size, info.font)}${HIDDEN}<c:showLeaderLines val="1"/></c:dLbls>`);
  }));
}

const asArray = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const on = node => node !== undefined && node?.val !== '0' && node?.val !== 'false' && node?.val !== 0;

/**
 * Import: true when the labels of a parsed classic chart group (`group`, fast-xml-parser, prefixes kept) are the LH-105 direct labels an
 * export writes by default: on a line chart, every labelled point shows the series name only and sits on the series' last point; on a
 * pie or doughnut of one series, every labelled point shows the category name only. The caller then reads no `legend` and no `dataLabels`.
 */
export function directLabelDefaults(group, kind) {
  const series = asArray(group?.['c:ser']);
  if (!series.length) return false;
  const points = series.map(ser => asArray(ser?.['c:dLbls']?.['c:dLbl']).filter(point => point?.['c:delete'] === undefined));
  const levelOff = series.every(ser => !['c:showVal', 'c:showCatName', 'c:showSerName', 'c:showPercent'].some(flag => on(ser?.['c:dLbls']?.[flag])));
  const only = (point, flag) => on(point?.[flag]) && ['c:showVal', 'c:showCatName', 'c:showSerName', 'c:showPercent'].every(other => other === flag || !on(point?.[other]));
  if (kind === 'line') {
    if (series.length < 2 || !levelOff || !points.some(list => list.length)) return false;
    return series.every((ser, index) => {
      const count = Number(ser?.['c:val']?.['c:numRef']?.['c:numCache']?.['c:ptCount']?.val ?? NaN);
      return points[index].every(point => only(point, 'c:showSerName') && Number(point?.['c:idx']?.val) === count - 1);
    });
  }
  if (kind === 'pie' || kind === 'doughnut') return series.length === 1 && levelOff && points[0].length > 0 && points[0].every(point => only(point, 'c:showCatName'));
  return false;
}
