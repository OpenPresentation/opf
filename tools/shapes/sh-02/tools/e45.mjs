const S = 'packages/javascript/src/shape-block.ts';
const R = 'packages/render/src/shapes.js';
const circle = ["bentArrow","bentUpArrow","blockArc","bracePair","chevron","circularArrow","cloudCallout","cornerTabs","curvedDownArrow","curvedLeftArrow","curvedRightArrow","curvedUpArrow","donut","doubleWave","downArrow","downArrowCallout","ellipseRibbon","ellipseRibbon2","flowChartDisplay","flowChartDocument","flowChartMagneticDisk","flowChartMultidocument","flowChartPunchedTape","funnel","horizontalScroll","leftArrow","leftArrowCallout","leftBrace","leftCircularArrow","leftRightArrow","leftRightArrowCallout","leftRightCircularArrow","leftRightRibbon","leftRightUpArrow","leftUpArrow","lightningBolt","mathDivide","mathNotEqual","moon","noSmoking","notchedRightArrow","plaqueTabs","quadArrow","quadArrowCallout","ribbon","ribbon2","rightArrow","rightArrowCallout","rightBrace","smileyFace","squareTabs","stripedRightArrow","sun","swooshArrow","upArrow","upArrowCallout","upDownArrow","upDownArrowCallout","uturnArrow","verticalScroll","wave","wedgeEllipseCallout","wedgeRectCallout","wedgeRoundRectCallout"];
const lines = [];
let line = '  ';
for (const name of circle) { const piece = `'${name}', `; if ((line + piece).length > 140) { lines.push(line.trimEnd()); line = '  '; } line += piece; }
lines.push(line.trimEnd().replace(/,$/, ','));
export default [
  [S, /const CIRCLE_SHAPE_GRADIENT_PRESETS: readonly string\[\] = .*\n/, `const CIRCLE_SHAPE_GRADIENT_PRESETS: readonly string[] = [\n${lines.join('\n')}\n];\n`],
  [S, `  ends?: { start: ShapeEnd; end: ShapeEnd };
}`, `  ends?: { start: ShapeEnd; end: ShapeEnd };
  /**
   * For a filled path of a shape whose \`shapeGradient\` is \`outline\`: the path flattened to polygons in slide coordinates. The gradient's
   * contours are these polygons scaled about the frame's center.
   */
  gradientOutline?: [number, number][][];
}`],
  [S, `   * (\`gradientOutline\` holds the outline's polygons), or \`circle\`, PowerPoint's circle gradient (some presets and every custom path).
   */
  shapeGradient?: 'outline' | 'circle';
  gradientOutline?: [number, number][][];`, `   * (each filled path's \`gradientOutline\`), or \`circle\`, PowerPoint's circle gradient (some presets and every custom path).
   */
  shapeGradient?: 'outline' | 'circle';`],
  [S, `  // A shape gradient's contours are the outline scaled about the frame's center: the engines fill a fan of triangles from the center to the
  // edges of the outline (the first filled path, flattened).`, `  // A shape gradient's contours are the outline scaled about the frame's center: the engines fill each filled path with a fan of triangles
  // from the center to the edges of that path (flattened), as PowerPoint shades each sub-path along its own outline.`],
  [S, `  const mainPath = geometry.paths.find(path => path.fill !== 'none') ?? geometry.paths[0];
`, ``],
  [S, `  const gradientOutline = outlineGradient === 'outline' && mainPath ? flatten(mainPath) : undefined;
  if (outlineGradient === 'outline' && process.env.OPF_PER_PATH === '1') geometry.paths.forEach((path, index) => { if (path.fill !== 'none') (paths[index] as ComposedShapePath & { gradientOutline?: unknown }).gradientOutline = flatten(path); });`,
  `  if (outlineGradient === 'outline') geometry.paths.forEach((path, index) => { if (path.fill !== 'none') paths[index]!.gradientOutline = flatten(path); });`],
  [S, `...(outlineGradient ? { shapeGradient: outlineGradient } : {}), ...(gradientOutline ? { gradientOutline } : {}), `, `...(outlineGradient ? { shapeGradient: outlineGradient } : {}), `],
  [R, `(path?.gradientOutline ?? shape.gradientOutline)`, `path?.gradientOutline`],
];
