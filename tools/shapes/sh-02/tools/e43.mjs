const S = 'packages/javascript/src/shape-block.ts';
export default [
  [S, `  const paths = geometry.paths.map(path => pathIn(path, box));`, `  const paths = geometry.paths.map(path => pathIn(path, box));
  // A shape gradient's contours are the outline scaled about the frame's center: the engines fill a fan of triangles from the center to the
  // edges of the outline (the first filled path, flattened). PowerPoint draws some presets' and every custom path's shape gradient as its
  // circle gradient instead (CIRCLE_SHAPE_GRADIENTS, measured on PowerPoint 365); the engines draw what PowerPoint draws.
  const fillSpec = record(host.fill ?? {}).gradient;
  const outlineGradient = record(fillSpec).type === 'shape' && engine ? (!preset || CIRCLE_SHAPE_GRADIENTS.has(preset) ? 'circle' as const : 'outline' as const) : undefined;
  const mainPath = geometry.paths.find(path => path.fill !== 'none') ?? geometry.paths[0];
  const gradientOutline = outlineGradient === 'outline' && mainPath ? engine!.flattenShapePath(mainPath.commands, 16).map(ring => ring.map(point => [round(box.x + point.x), round(box.y + point.y)] as [number, number])) : undefined;`],
  [S, `avLst: preset && engine ? engine.adjustToDrawingML(preset, adjust) : {}, ...(engine ? {} : { loading: true as const }), paths,`, `avLst: preset && engine ? engine.adjustToDrawingML(preset, adjust) : {}, ...(engine ? {} : { loading: true as const }), paths,
    ...(outlineGradient ? { shapeGradient: outlineGradient } : {}), ...(gradientOutline ? { gradientOutline } : {}),`],
  [S, `  /** In a browser or edge runtime before \`ensureShapes\`: the preset geometry is still loading, so \`paths\` is empty (engines draw no outline). */
  loading?: true;`, `  /** In a browser or edge runtime before \`ensureShapes\`: the preset geometry is still loading, so \`paths\` is empty (engines draw no outline). */
  loading?: true;
  /**
   * How a \`shape\` gradient fill is drawn, as PowerPoint draws it: \`outline\`, contours that are the outline scaled about the frame's center
   * (\`gradientOutline\` holds the outline's polygons), or \`circle\`, PowerPoint's circle gradient (some presets and every custom path).
   */
  shapeGradient?: 'outline' | 'circle';
  gradientOutline?: [number, number][][];`],
  [S, `/** The default frame aspect (width / height) of a preset:`, `/**
 * The presets whose \`shape\` path gradient PowerPoint 365 draws as its \`circle\` gradient, not along the outline (measured: a deck of all
 * 187 presets with a shape gradient exported by PowerPoint and compared with both drawings; scripts in the SH-02 evidence). A custom path's
 * shape gradient is a circle too.
 */
export const CIRCLE_SHAPE_GRADIENTS: ReadonlySet<string> = new Set<string>(CIRCLE_SHAPE_GRADIENT_PRESETS);
/** The default frame aspect (width / height) of a preset:`],
  [S, `const SQUARE = `, `const CIRCLE_SHAPE_GRADIENT_PRESETS: readonly string[] = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.OPF_SHAPE_GRADIENT_CLASSIFY === 'outline' ? [] : (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.OPF_SHAPE_GRADIENT_CLASSIFY === 'circle' ? PRESET_NAMES : ['chevron', 'rightArrow', 'leftArrow', 'upArrow', 'downArrow'];
const SQUARE = `],
];
