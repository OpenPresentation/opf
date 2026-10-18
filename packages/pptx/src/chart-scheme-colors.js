// RR-89: chart series colours as theme colours.
//
// Core's chartSeriesPalette gives series i the deck scheme's accent (i + 1) for the first six series, or the chart's own
// `chart.colors` entry. When the chart panel keeps that colour exactly (chartPaletteForFill only adjusts a colour that falls short of 3:1
// contrast), the series is written as `<a:schemeClr val="accentN"/>` so re-theming the deck in PowerPoint recolours the chart, as
// chart-highlight.js does for the highlight accent. A hex entry, a tint (series 7 to 12) and an adjusted colour stay `srgbClr`.
const hex6 = value => String(value).replace(/^#/, '').toUpperCase();

/**
 * The scheme value (`accent1`, `tx2`, ...) of each palette colour that may be written as a theme colour, or undefined.
 * `colors` is the chart's authored `colors`, `preferred` and `adjusted` the palette before and after the panel adjustment, `schemeFor`
 * maps a colour reference and its resolved hex to a scheme value when the deck theme holds that colour (theme-colors.js). A colour the
 * panel adjusted, a hex or variable entry and a tint (series 7 to 12) have none.
 */
export function chartPaletteSchemes(colors, preferred, adjusted, schemeFor) {
  const authored = Array.isArray(colors) ? colors : [];
  return preferred.map((color, index) => {
    if (hex6(color) !== hex6(adjusted[index])) return undefined;
    const entry = typeof authored[index] === 'string' ? authored[index].trim() : undefined;
    if (entry !== undefined) return /^[A-Za-z]/.test(entry) ? schemeFor(entry, hex6(color)) : undefined;
    return index < 6 ? schemeFor(`accent${index + 1}`, hex6(color)) : undefined;
  });
}

const srgbIn = (block, hex, scheme) => block.replace(new RegExp(`<a:srgbClr val="${hex}"\\s*/>`, 'gi'), `<a:schemeClr val="${scheme}"/>`);

/**
 * Rewrite the series fills of a generated classic chart part to scheme colours. Series are matched to the palette by position (the
 * generated part has one c:ser per plotted series in palette order; pie, doughnut and similar charts colour category i, one c:dPt each).
 * Only series and point shape properties (c:spPr, and the marker's) are touched, never text properties.
 */
export function applyChartSchemeColors(xml, palette, schemes, {circular = false} = {}) {
  if (!schemes?.some(Boolean)) return xml;
  let seriesIndex = 0;
  return xml.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, ser => {
    const index = seriesIndex++;
    const rewrite = (block, colorIndex) => {
      const scheme = schemes[colorIndex], hex = palette[colorIndex];
      return scheme && hex ? block.replace(/<c:spPr>[\s\S]*?<\/c:spPr>/g, properties => srgbIn(properties, hex6(hex), scheme)) : block;
    };
    if (circular) {
      return ser.replace(/<c:dPt>[\s\S]*?<\/c:dPt>/g, point => rewrite(point, Number(/<c:idx val="(\d+)"\/>/.exec(point)?.[1])));
    }
    // The series' own shape properties and markers, then its points (a bar series with several colours carries c:dPt).
    return rewrite(ser, index);
  });
}
