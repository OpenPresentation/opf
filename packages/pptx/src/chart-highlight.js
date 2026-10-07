// FA-14: chart emphasis (`chart.highlight`) in the PPTX export.
//
// Core owns what is highlighted (`resolveChartOptions(...).highlight`, `chartHighlightMarks`) and the two colours
// (`chartHighlightColors`); the preview (opf-render) calls the same functions, so both engines colour the same marks the same way.
// This module writes them natively into the generated classic chart part:
//
//   column, bar, area, scatter, radar   the series colour (c:ser/c:spPr, and c:marker/c:spPr) of every series, accent when the
//                                       series is named, muted otherwise; clustered and stacked alike;
//   column and bar, category highlight  one c:dPt (idx, invertIfNegative, bubble3D, spPr) per point whose colour differs from its
//                                       series' colour;
//   line                                the series line and marker colour, and for a category highlight one c:dPt with a circular
//                                       c:marker per highlighted point (a line without markers shows markers only there);
//   pie, doughnut                       the fill of the c:dPt of every slice, accent for a highlighted category, muted otherwise.
//
// The highlight colour is the deck primary: `a:schemeClr val="accent1"` when the deck theme holds exactly that colour (so a theme
// edit in PowerPoint recolours it), the literal sRGB otherwise (a primary that needed a contrast adjustment against the chart panel).
// The muted colour is a mix of the panel and the text colour, which no single scheme colour with lumMod/lumOff reproduces, so it is
// an sRGB literal. A chart without a highlight never reaches this module, so its parts are unchanged.
import {chartHighlightColors, chartHighlightMarks} from '@openpresentation/opf/composition';

const srgb = hex => `<a:srgbClr val="${String(hex).replace(/^#/, '').toUpperCase()}"/>`;

/**
 * The highlight of an exported chart: `{kind, marks, accent, muted, seriesFills, pointFills}` or undefined.
 * `options` is core's `resolveChartOptions` result, `data` the resolved chart data (`columns`, `hasX`, `rows`), `kind` the chart's option
 * kind, `panelFill` and `labelColor` the chart panel and text colours (as the preview uses them), `primary` the deck primary and
 * `scheme` its scheme value when the theme holds it exactly (core's colour for the accent is compared with it here).
 *
 * Colours are `{hex, xml}`: `hex` (RRGGBB) feeds the data label contrast, `xml` is the DrawingML colour element.
 */
export function chartHighlightPlan({options, data, kind, panelFill, labelColor, primary, schemeFor}) {
  if (!options?.highlight || !data) return undefined;
  const marks = chartHighlightMarks(options.highlight, data);
  if (!marks) return undefined;
  const colors = chartHighlightColors(panelFill, primary, `#${labelColor}`);
  const accentHex = colors.accent.replace(/^#/, '').toUpperCase();
  const scheme = schemeFor?.(colors.accent);
  const accent = {hex: accentHex, xml: scheme ? `<a:schemeClr val="${scheme}"/>` : srgb(accentHex)};
  const muted = {hex: colors.muted.replace(/^#/, '').toUpperCase(), xml: srgb(colors.muted)};
  const seriesColor = index => marks.series[index] ? accent : muted;
  const markColor = (series, row) => marks.series[series] || marks.categories[row] ? accent : muted;
  const circular = kind === 'pie' || kind === 'doughnut';
  return {
    kind, marks, accent, muted, seriesColor, markColor, circular,
    // The series colours (data label contrast of a series-level label) and, where marks differ within a series, the point colours.
    seriesFills: Array.from({length: marks.series.length}, (_, index) => seriesColor(index).hex),
    pointFills: series => circular ? marks.categories.map(row => (row ? accent : muted).hex)
      : kind === 'bar' && marks.categories.some(Boolean) ? marks.categories.map((_, row) => markColor(series, row).hex) : undefined,
  };
}

const fill = color => `<a:solidFill>${color.xml}</a:solidFill>`;
const recolor = (block, color) => block.replace(/<a:solidFill>[\s\S]*?<\/a:solidFill>/g, fill(color));

// The series' own c:spPr: the first one, which precedes c:marker, c:dPt, c:dLbls and the data references in CT_*Ser.
function seriesProperties(ser) {
  const at = ser.indexOf('<c:spPr>');
  const limit = ['<c:marker>', '<c:dPt>', '<c:dLbls>', '<c:cat>', '<c:xVal>', '<c:val>'].map(tag => ser.indexOf(tag)).filter(index => index >= 0);
  if (at < 0 || limit.some(index => index < at)) throw new Error('A generated chart series carries no series properties.');
  return at;
}

function recolorSeries(ser, color) {
  const at = seriesProperties(ser);
  const end = ser.indexOf('</c:spPr>', at) + '</c:spPr>'.length;
  let out = ser.slice(0, at) + recolor(ser.slice(at, end), color) + ser.slice(end);
  out = out.replace(/<c:marker>[\s\S]*?<\/c:marker>/, marker => recolor(marker, color));
  return out;
}

const barPoint = (row, color) => `<c:dPt><c:idx val="${row}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/><c:spPr>${fill(color)}<a:effectLst/></c:spPr></c:dPt>`;
const linePoint = (row, color) => `<c:dPt><c:idx val="${row}"/><c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr>${fill(color)}<a:ln w="9525" cap="flat">${fill(color)}<a:prstDash val="solid"/><a:round/></a:ln><a:effectLst/></c:spPr></c:marker><c:bubble3D val="0"/></c:dPt>`;

/**
 * Rewrite the series of a generated classic chart for the highlight plan (see the module comment). `xml` is the chart part text.
 * Series are matched to the plan by position, which is how core orders them (the columns after the category, and after the X
 * column of a scatter chart): the generated part has one c:ser per plotted series, in that order.
 */
export function applyChartHighlight(xml, plan) {
  const {kind, marks, accent, muted} = plan;
  let seriesIndex = 0;
  return xml.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, ser => {
    const index = seriesIndex++;
    if (plan.circular) {
      return ser.replace(/<c:dPt>([\s\S]*?)<\/c:dPt>/g, (point, inner) => {
        const row = Number(/<c:idx val="(\d+)"\/>/.exec(inner)?.[1]);
        return marks.categories[row] === undefined ? point : recolor(point, marks.categories[row] ? accent : muted);
      });
    }
    if (index >= marks.series.length) return ser;
    let out = recolorSeries(ser, plan.seriesColor(index));
    if (kind === 'bar' && marks.categories.some(Boolean)) {
      const points = marks.categories.flatMap((_, row) => plan.markColor(index, row) === plan.seriesColor(index) ? [] : [barPoint(row, plan.markColor(index, row))]).join('');
      if (points) out = out.replace(/<c:dLbls>|<c:cat>/, anchor => `${points}${anchor}`);
    } else if (kind === 'line' && marks.categories.some(Boolean)) {
      // A line shows a marker at every highlighted category: on a line with markers only where the series colour is not already the
      // accent, on a line without markers (symbol none) at every highlighted point.
      const hasMarkers = !/<c:marker>\s*<c:symbol val="none"\/>/.test(out);
      const points = marks.categories.flatMap((highlighted, row) => highlighted && (!hasMarkers || plan.markColor(index, row) !== plan.seriesColor(index)) ? [linePoint(row, plan.markColor(index, row))] : []).join('');
      if (points) {
        // CT_LineSer: marker, dPt, dLbls, trendline, errBars, cat. The generator writes c:dLbls before c:marker; it moves behind the points.
        const labels = /<c:dLbls>[\s\S]*?<\/c:dLbls>/.exec(out);
        const markerEnd = out.indexOf('</c:marker>') + '</c:marker>'.length;
        if (labels && labels.index < markerEnd) {
          out = out.slice(0, labels.index) + out.slice(labels.index + labels[0].length);
          const end = out.indexOf('</c:marker>') + '</c:marker>'.length;
          out = `${out.slice(0, end)}${points}${labels[0]}${out.slice(end)}`;
        } else out = `${out.slice(0, markerEnd)}${points}${out.slice(markerEnd)}`;
      }
    }
    return out;
  });
}
