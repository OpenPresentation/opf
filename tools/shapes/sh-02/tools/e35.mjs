const P = 'packages/pptx/src/index.js';
const B = 'packages/pptx/src/shape-blocks.js';
const paintOld = `  const paint = (entry, fallback) => {
    const raw = exportColor(entry, context, fallback).replace(/^#/, '');
    return { hex: normalizeHex(raw.slice(0, 6), fallback), alpha: /^[0-9a-f]{8}$/i.test(raw) ? parseInt(raw.slice(6), 16) / 255 : 1 };
  };
  // The slide's table`;
export default [
  [P, paintOld, `  const paint = shapePaint(context);
  // The slide's table`],
  [P, `    strokeXml: image.stroke ? lineXml(image.stroke, paint, shapePalette(context)) : null,`, `    strokeXml: image.stroke ? lineXml(image.stroke, shapePaint(context), shapePalette(context)) : null,`],
  [P, `// SH-02: the colors a shape's drawing falls back to:`, `// SH-02: a ColorRef as a shape's or picture line's DrawingML color: its RRGGBB and alpha, and the slide's scheme value where the reference
// names a slot or role the deck theme holds exactly (schemeColorValue), so it is written as a theme color.
function shapePaint(context) {
  return (entry, fallback) => {
    const raw = exportColor(entry, context, fallback).replace(/^#/, ''), hex = normalizeHex(raw.slice(0, 6), fallback);
    const alpha = /^[0-9a-f]{8}$/i.test(raw) ? parseInt(raw.slice(6), 16) / 255 : 1;
    const scheme = typeof entry === 'string' ? schemeColorValue(entry, \`#\${hex}\`, context) : undefined;
    return { hex, alpha, ...(scheme ? {scheme} : {}) };
  };
}

// SH-02: the colors a shape's drawing falls back to:`],
  [P, "  const textHex = normalizeHex(shapeTextColor(backdrop, `#${paint(shape.textColor, normalizeHex(context.colors.text)).hex}`, `#${normalizeHex(context.colors.text)}`, `#${normalizeHex(context.colors.background)}`));", "  const preferred = `#${paint(shape.textColor, normalizeHex(context.colors.text)).hex}`, slideText = `#${normalizeHex(context.colors.text)}`, slideBackground = `#${normalizeHex(context.colors.background)}`;\n  const drawn = shapeTextColor(backdrop, preferred, slideText, slideBackground);\n  // The color as a theme color where the reference names one (the style's, else the slide's text or background role).\n  const textHex = nativeColor(drawn === preferred ? shape.textColor : drawn === slideText ? 'text' : 'background', drawn, context);"],
  [B, `export function colorXml(ref, paint, fallback, alpha = 1) {
  const { hex, alpha: own } = paint(ref, fallback);
  const value = Math.round(own * alpha * 100000);
  return \`<a:srgbClr val="\${hex}">\${value < 100000 ? \`<a:alpha val="\${value}"/>\` : ''}</a:srgbClr>\`;
}`, `export function colorXml(ref, paint, fallback, alpha = 1) {
  const { hex, alpha: own, scheme } = paint(ref, fallback);
  const value = Math.round(own * alpha * 100000), transparency = value < 100000 ? \`<a:alpha val="\${value}"/>\` : '';
  return scheme ? \`<a:schemeClr val="\${scheme}">\${transparency}</a:schemeClr>\` : \`<a:srgbClr val="\${hex}">\${transparency}</a:srgbClr>\`;
}`],
  [B, ` * A DrawingML color element for a ColorRef: \`paint(ref, fallback)\` gives \`{hex, alpha}\` (RRGGBB and 0..1) from the exporter's
 * resolution; \`alpha\` multiplies in (a fill's opacity). A literal; RR-96 rewrites the scheme colors.`, ` * A DrawingML color element for a ColorRef: \`paint(ref, fallback)\` gives \`{hex, alpha, scheme}\` (RRGGBB, 0..1 and the slide's scheme
 * value where the reference names one) from the exporter's resolution; \`alpha\` multiplies in (a fill's opacity). Otherwise a literal,
 * which RR-96 rewrites where it is a scheme color.`],
];
