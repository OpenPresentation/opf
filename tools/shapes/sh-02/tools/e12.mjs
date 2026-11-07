const R = 'packages/render/src/svg.js';
const C = 'packages/javascript/src/composition.ts';
export default [
  [R, `    case "image":
      return renderImageBlock(item, bound, options);`, `    case "image":
      return renderImageBlock(item, bound, options);
    case "shape":
      return renderShapeBlock(item, shapeHelpers(item, bound, options));`],
  [R, `import { renderCaption, renderFootnotes } from "./annotations.js";`, `import { renderCaption, renderFootnotes } from "./annotations.js";
import { renderShapeBlock, strokeElements } from "./shapes.js";`],
  [R, `  if (image.border) {
    const paint = imagePaint(image.border.color, bound, bound.design.colors.border);
    children.push(tag("path", { ...HIDDEN, d: shape?.path ?? rectanglePath(image.box), fill: "none", stroke: paint.color, "stroke-opacity": paint.alpha < 1 ? preciseNumber(paint.alpha) : undefined, "stroke-width": stableNumber(image.border.width), "stroke-linejoin": "miter", "stroke-miterlimit": 8 }));
  }`, `  // SH-02: the picture's stroke (renamed from border) takes every stroke property, along the frame's preset outline.
  if (image.stroke) {
    const stroke = strokeElements(image.stroke, shape?.path ?? rectanglePath(image.box), \`\${id}-stroke\`, { box: image.box, closed: true, helpers: shapeHelpers(item, bound, options) });
    if (stroke.defs) children[0] = (children[0] ? children[0].replace(/<\\/defs>$/, "") : "<defs>") + stroke.defs + "</defs>";
    children.push(stroke.elements);
  }`],
  [R, `// One overlay (shared by image backgrounds and image blocks): its outline filled with the colour, the colour's alpha times the`,
    `// SH-02: what the shape drawing (src/shapes.js) needs from the renderer: its tag writer, the slide's colors and ColorRef resolution, and
// the text drawing of a composed item (a shape's text, fitted by core, drawn at the box it was fitted for).
function shapeHelpers(item, bound, options) {
  const colors = bound.design.colors;
  return {
    tag, idPrefix: \`opf-s\${bound.index + 1}\`, trace: traceAttrs(options, item.path),
    colors: { primary: colors.primary, background: bound.design.backgroundColor ?? colors.background, text: colors.text, border: colors.border },
    resolveColorRef: (value, fallback) => resolveColorRef(value, bound, fallback),
    report: diagnostic => reportDiagnostic({ ...diagnostic, path: item.path }, options),
    drawText: (shapeItem, area, fill) => {
      const value = shapeItem.shape.textDirection === "stacked" ? stackedText(shapeItem.payload.text) : shapeItem.payload.text;
      const config = { path: \`\${shapeItem.path.replace(/\\.(shape|path)$/, "")}.text\`, align: "center", fit: shapeItem.text, textStyle: shapeItem.textStyle, fill, fontSize: 25, fontFamily: bound.design.fonts.body, fontWeight: shapeItem.shape.textBold ? 700 : 400, diagnosticsHandled: true, options };
      return Array.isArray(value) ? renderRichTextBox(value, area, bound, config) : renderTextBox(flattenText(value), area, bound, config);
    },
  };
}

// One overlay (shared by image backgrounds and image blocks): its outline filled with the colour, the colour's alpha times the`],
  [R, `  resolveColorRef as resolveCoreColorRef, colorTransform, applyColorTransform, resolveScriptFonts,`, `  resolveColorRef as resolveCoreColorRef, colorTransform, applyColorTransform, stackedText, resolveScriptFonts,`],
  [C, `export {applyLuminance, applyColorTransform, colorTransform, `, `export {composeShape, isShapeBlock, presetAspect, presetMask, shapeIssues, stackedText, shapeStyleLook, translatePathData, DEFAULT_SHAPE_STYLE, PICTURE_STROKE_WIDTH, SHAPE_BLOCK_KEYS, SHAPE_EFFECT_KEYS, SHAPE_PADDING, SHAPE_STROKE_WIDTH, SHAPE_STYLES} from './shape-block.js';
export type {ComposedArrowhead, ComposedFill, ComposedGradient, ComposedShape, ComposedShapePath, ComposedStroke, ShapeEnd, ShapeStyleLook, ShapeStyleName} from './shape-block.js';
export {applyLuminance, applyColorTransform, colorTransform, `],
];
