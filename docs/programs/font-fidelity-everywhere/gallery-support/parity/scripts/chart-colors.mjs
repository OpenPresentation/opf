// Series colours of a native classic chart part, as PowerPoint paints them, for the parity harness. Pure: no I/O.
//
// Each construct paints its series differently (FF-38, 2026-09-30):
//  - a line-kind series (c:lineChart, and c:radarChart except radarStyle filled) is a stroke: its colour is the series a:ln fill;
//  - a pie or doughnut series has one colour per slice (its c:dPt fills); the 0.75 pt F9F9F9 a:ln that PptxGenJS writes on the
//    series is the slice border, not a series colour;
//  - every other series is a fill: the first srgbClr of its c:spPr, PLUS the fill of every data point override (c:dPt) (RR-36).
//    A c:dPt fill overrides the series fill for that point whatever c:varyColors says, so a single-series column chart whose points
//    carry their own colours draws one colour per column in PowerPoint. Reading only the series c:spPr hid that (opf-pptx#149: the
//    gallery column and bar exports drew 8 colours while the preview drew one, and the harness reported the fills as passing).
//    A data point's outline (a:ln inside its c:spPr) is not a fill and is not read.

const uniq = (values) => [...new Set(values)];
const srgb = (xml) => xml?.match(/<a:srgbClr val="([0-9A-Fa-f]{6})"/)?.[1]?.toUpperCase() ?? null;
const spPr = (xml) => xml.match(/<c:spPr>([\s\S]*?)<\/c:spPr>/)?.[1] ?? '';
const withoutOutline = (xml) => xml.replace(/<a:ln\b[\s\S]*?<\/a:ln>/g, '');
const dataPoints = (ser) => [...ser.matchAll(/<c:dPt>([\s\S]*?)<\/c:dPt>/g)].map((m) => m[1]);
// The series' own colour, read as FF-38 read it: the first srgbClr from its first c:spPr on, now outside the data points and data
// labels. A PowerPoint-saved scatter series has an `a:ln noFill` c:spPr and takes its colour from the marker that follows.
const seriesFill = (ser) => {
  const own = ser.replace(/<c:(dPt|dLbls)>[\s\S]*?<\/c:\1>/g, '');
  const at = own.indexOf('<c:spPr>');
  return at < 0 ? null : srgb(own.slice(at));
};

/** `{colors, strokeSeries}`: the distinct upper-case hex colours the series of a classic chart part paint, and whether they are strokes. */
export function chartSeriesColors(cx) {
  const kind = cx.match(/<c:(lineChart|radarChart|pieChart|doughnutChart)>/)?.[1] ?? null;
  const strokeSeries = kind === 'lineChart' || (kind === 'radarChart' && !/<c:radarStyle val="filled"\/>/.test(cx));
  const sers = [...cx.matchAll(/<c:ser>([\s\S]*?)<\/c:ser>/g)].map((m) => m[1]);
  let colors;
  if (strokeSeries) colors = sers.map((ser) => srgb(spPr(ser).match(/<a:ln\b[^>]*>([\s\S]*?)<\/a:ln>/)?.[1]) ?? srgb(spPr(ser)));
  else if (kind === 'pieChart' || kind === 'doughnutChart') {
    colors = sers.flatMap((ser) => {
      const slices = dataPoints(ser).map((point) => srgb(spPr(point)));
      return slices.length ? slices : [srgb(withoutOutline(spPr(ser)))];
    });
  } else colors = sers.flatMap((ser) => [seriesFill(ser), ...dataPoints(ser).map((point) => srgb(withoutOutline(spPr(point))))]);
  return {colors: uniq(colors.filter(Boolean)), strokeSeries};
}
