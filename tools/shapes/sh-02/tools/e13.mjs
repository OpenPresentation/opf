const P = 'packages/pptx/src/index.js';
const IP = 'packages/pptx/src/image-provenance.js';
export default [
  [P, `  context.slideSchemeColors = [];
  context.linkSentinels = linkSentinels(presentation);`, `  context.slideSchemeColors = [];
  // SH-02: the native parts of each shape block, by object name (src/shape-blocks.js), written into the finished slide parts.
  context.shapeBlocks = new Map();
  context.linkSentinels = linkSentinels(presentation);`],
  [P, `    } else if (item.field === "image" && item.image) {
      await drawImage(item, itemContext);`, `    } else if (item.field === "shape" && item.shape) {
      addShapeItem(slide, item, slideIndex, itemContext, context);
    } else if (item.field === "image" && item.image) {
      await drawImage(item, itemContext);`],
  [P, `// The native effects of an image treatment, resolved in the slide's colour context: core's mask (item.image.shape), the
// border line, opacity and recolor.
function imageEffects(image, context) {
  const paint = (entry, fallback) => {
    const raw = exportColor(entry, context, fallback).replace(/^#/, '');
    return { hex: normalizeHex(raw, fallback), alpha: /^[0-9a-f]{8}$/i.test(raw) ? parseInt(raw.slice(6), 16) / 255 : 1 };
  };
  return {
    shape: image.shape ?? null,
    border: image.border ? { ...paint(image.border.color, context.colors.border), width: image.border.width } : null,`, `// The native effects of an image treatment, resolved in the slide's colour context: core's mask (item.image.shape), the
// stroke (SH-02: every stroke property, src/shape-blocks.js lineXml), opacity and recolor.
function imageEffects(image, context) {
  const paint = (entry, fallback) => {
    const raw = exportColor(entry, context, fallback).replace(/^#/, '');
    return { hex: normalizeHex(raw, fallback), alpha: /^[0-9a-f]{8}$/i.test(raw) ? parseInt(raw.slice(6), 16) / 255 : 1 };
  };
  return {
    shape: image.shape ?? null,
    strokeXml: image.stroke ? lineXml(image.stroke, paint, shapePalette(context)) : null,`],
  [P, `  const treated = Boolean(effects.border || effects.opacity !== null`, `  const treated = Boolean(effects.strokeXml || effects.opacity !== null`],
  [P, `// An overlay (core ComposedOverlay) as one native shape directly above its picture: the frame's shape, or an edge band.`, `// SH-02: the colors a shape's drawing falls back to: the primary (a style's accent1), the slide background and the neutral line.
function shapePalette(context) {
  return { primary: normalizeHex(context.roles?.primary ?? context.colors.accent), background: normalizeHex(context.colors.background), border: normalizeHex(context.roles?.neutrals?.border?.hex ?? \`#\${context.colors.border}\`) };
}

// SH-02: a shape block (core ComposedItem.shape) as one native shape (src/shape-blocks.js): PptxGenJS writes the shape and its runs at
// core's fitted size, centered, with the text color that reads on the drawn fill; writeShapeBlocks then writes core's geometry, fill,
// line, style and text body. The style's derived colors (a darker accent line, a lighter fill) are written as theme colors with
// a:lumMod and a:lumOff, as the authored ones are.
function addShapeItem(slide, item, slideIndex, context, deck) {
  const shape = item.shape, name = \`OPF shape \${item.path}\`, palette = shapePalette(context);
  const paint = (entry, fallback) => {
    const raw = exportColor(entry, context, fallback).replace(/^#/, '');
    return { hex: normalizeHex(raw.slice(0, 6), fallback), alpha: /^[0-9a-f]{8}$/i.test(raw) ? parseInt(raw.slice(6), 16) / 255 : 1 };
  };
  const table = deck.slideSchemeColors?.[slideIndex]?.table;
  if (table) addTransformedColors(table, reference => exportColor(reference, context, '000000'), shape.fill, shape.stroke, shape.styleRef, shape.textColor, shape.textBackdrop);
  const backdrop = shape.textBackdrop === undefined ? \`#\${normalizeHex(context.colors.background)}\` : \`#\${paint(shape.textBackdrop, palette.background).hex}\`;
  const textHex = normalizeHex(textColorForFill(backdrop, \`#\${paint(shape.textColor, normalizeHex(context.colors.text)).hex}\`));
  const fit = item.text, size = fit ? fit.fontSize * .75 : 18;
  const lineHeight = fit ? (fit.richLines?.[0]?.height ?? fit.lineHeight ?? fit.fontSize * 1.22) * .75 : undefined;
  const value = item.payload?.text, runs = [];
  const style = item.textStyle ?? {fontFamily: context.fonts.body, fontWeight: 400};
  const base = {...nativeFontOptions(style), ...(shape.textBold ? {bold: true} : {}), fontSize: size, color: textHex};
  const push = (text, run = {}) => {
    const lines = String(text).split(/\\r\\n|\\r|\\n/);
    lines.forEach((line, index) => {
      const own = {...base, ...(run.bold !== undefined ? {bold: run.bold} : {}), ...(run.italic !== undefined ? {italic: run.italic} : {}), ...(run.underline ? {underline: {style: 'sng'}} : {}), ...(run.strikethrough ? {strike: 'sngStrike'} : {}),
        ...(run.color !== undefined && run.color !== '' ? {color: exportColor(run.color, context, textHex).slice(0, 6)} : {}), ...(typeof run.link === 'string' ? {hyperlink: {url: run.link}, color: linkColor(run, run.color !== undefined && run.color !== '' ? exportColor(run.color, context, textHex).slice(0, 6) : textHex, context)} : {}),
        ...(typeof run.fontFamily === 'string' ? {fontFace: run.fontFamily} : {}), ...(typeof run.fontSize === 'number' ? {fontSize: run.fontSize} : {}), ...(run.superscript ? {superscript: true} : {}), ...(run.subscript ? {subscript: true} : {}),
        ...(index < lines.length - 1 ? {breakLine: true} : {})};
      runs.push({text: line, options: own});
    });
  };
  if (typeof value === 'string') push(value);
  else if (Array.isArray(value)) for (const run of value) typeof run === 'string' ? push(run) : push(run?.text ?? '', run ?? {});
  if (runs.length) assertXmlText(runs.map(run => run.text).join(''), \`\${item.path}.text\`);
  const box = shape.box;
  slide.addText(runs.length ? runs : '', {x: box.x / 96, y: box.y / 96, w: box.width / 96, h: box.height / 96, objectName: name, ...base, align: 'center', valign: 'middle', margin: 0, paraSpaceAfter: 0, paraSpaceBefore: 0,
    ...(lineHeight ? {lineSpacing: Math.round(lineHeight * 100) / 100} : {}), fit: 'none', ...(shape.link ? {hyperlink: {url: shape.link}} : {})});
  deck.shapeBlocks.set(name, shapeBlockRecord(shape, paint, palette));
  return name;
}

// An overlay (core ComposedOverlay) as one native shape directly above its picture: the frame's shape, or an edge band.`],
  [P, `      // Native bullets otherwise inherit the first rich run's size, font and`, `      // SH-02: shape blocks take core's geometry, fill, line, style and text body (src/shape-blocks.js).
      xml=writeShapeBlocks(xml,context.shapeBlocks);
      // Native bullets otherwise inherit the first rich run's size, font and`],
  [P, `import {themeSlotColors, schemeColorTable, addTransformedColors,`, `import {lineXml, shapeBlockRecord, writeShapeBlocks} from './shape-blocks.js';
import {themeSlotColors, schemeColorTable, addTransformedColors,`],
  [IP, `const lineXml = border => border ? \`<a:ln w="\${Math.round(border.width / 96 * EMUS_PER_INCH)}" algn="ctr"><a:solidFill>\${colorXml(border)}</a:solidFill><a:miter lim="800000"/></a:ln>\` : '';\n`, ''],
  [IP, `presetXml(effects.shape) + lineXml(effects.border));`, `presetXml(effects.shape) + (effects.strokeXml ?? ''));`],
  [IP, `// values, the border an a:ln centered on the outline with a miter join, and the recolor and opacity a:grayscl or`, `// values, the stroke an a:ln with every stroke property (SH-02, src/shape-blocks.js lineXml), and the recolor and opacity a:grayscl or`],
  [IP, `export const IMAGE_TREATMENT_KEYS = Object.freeze(['fit', 'focus', 'shape', 'cornerRadius', 'border', 'opacity', 'recolor', 'overlay', 'aspectRatio', 'placement', 'portrait']);`,
    `export const IMAGE_TREATMENT_KEYS = Object.freeze(['fit', 'focus', 'shape', 'adjust', 'stroke', 'opacity', 'recolor', 'overlay', 'aspectRatio', 'placement', 'portrait']);`],
];
