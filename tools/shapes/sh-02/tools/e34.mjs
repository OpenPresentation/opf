export default [
  ['packages/javascript/src/shape-block.ts', `/** LH-151 for shapes: the text color an engine draws, given the backdrop and preferred colors it resolved (#RRGGBB): the preferred one when it reads at 4.5:1, else black or white. */
export { textColorForFill as shapeTextColor } from './color.js';`, `/**
 * LH-151 for shapes: the text color an engine draws on \`backdrop\` (the resolved fill under the text, #RRGGBB): the style's \`preferred\`
 * color when it reads at 4.5:1 (or the contrast cannot be measured), else whichever of the slide's text and background colors (tx1 and
 * bg1, so the export writes a theme color) reads better.
 */
export function shapeTextColor(backdrop: string, preferred: string, text: string, background: string): string {
  const own = colorContrast(preferred, backdrop);
  if (own === undefined || own >= 4.5) return preferred;
  return (colorContrast(text, backdrop) ?? 0) >= (colorContrast(background, backdrop) ?? 0) ? text : background;
}`],
  ['packages/javascript/src/shape-block.ts', `import { adjustToDrawingML,`, `import { colorContrast } from './color.js';
import { adjustToDrawingML,`],
  ['packages/javascript/src/composition.ts', `export {composeShape, isShapeBlock, presetAspect, presetMask, shapeIssues, stackedText,`, `export {composeShape, isShapeBlock, presetAspect, presetMask, shapeIssues, shapeTextColor, stackedText,`],
  ['packages/render/src/shapes.js', `import { patternRuns, textColorForFill } from "@openpresentation/opf/composition";`, `import { patternRuns, shapeTextColor } from "@openpresentation/opf/composition";`],
  ['packages/render/src/shapes.js', `/** The text color of a shape: the style's preferred color where it reads at 4.5:1 on the backdrop (core shapeTextColor), else black or white. */
export function shapeTextFill(shape, helpers) {
  const preferred = paintOf(shape.textColor, helpers, helpers.colors.text).color;
  if (shape.textBackdrop === undefined) return textColorForFill(helpers.colors.background, preferred);
  return textColorForFill(paintOf(shape.textBackdrop, helpers, helpers.colors.background).color, preferred);
}`, `/** The text color of a shape: the style's preferred color where it reads at 4.5:1 on the backdrop, else the slide's text or background color (core shapeTextColor). */
export function shapeTextFill(shape, helpers) {
  const preferred = paintOf(shape.textColor, helpers, helpers.colors.text).color;
  const backdrop = shape.textBackdrop === undefined ? paintOf(helpers.colors.background, helpers, "#FFFFFF").color : paintOf(shape.textBackdrop, helpers, helpers.colors.background).color;
  return shapeTextColor(backdrop, preferred, paintOf(helpers.colors.text, helpers, "#000000").color, paintOf(helpers.colors.background, helpers, "#FFFFFF").color);
}`],
  ['packages/pptx/src/index.js', "  const textHex = normalizeHex(textColorForFill(backdrop, `#${paint(shape.textColor, normalizeHex(context.colors.text)).hex}`));", "  const textHex = normalizeHex(shapeTextColor(backdrop, `#${paint(shape.textColor, normalizeHex(context.colors.text)).hex}`, `#${normalizeHex(context.colors.text)}`, `#${normalizeHex(context.colors.background)}`));"],
  ['packages/pptx/src/index.js', `resolveTextStyle, textColorForFill, textWidthMeasurer,`, `resolveTextStyle, shapeTextColor, textColorForFill, textWidthMeasurer,`],
];
