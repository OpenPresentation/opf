const S = 'packages/javascript/src/shape-block.ts';
const C = 'packages/javascript/src/composition.ts';
export default [
  [S, `import { adjustToDrawingML, customGeometry, isPresetShape, presetAdjustments, presetGeometry, type CustomPathInput, type ShapeGeometry, type ShapePath, type ShapePathFill } from './shape-geometry.js';`,
    `import type { CustomPathInput, ShapeAdjustment, ShapeGeometry, ShapePath, ShapePathFill } from './shape-geometry.js';
import { loadShapeGeometry, shapeGeometry } from '#shape-engine';
import { PRESET_NAMES } from './generated/preset-names.js';

/** The 187 DrawingML preset names (ECMA-376 ST_ShapeType), without loading their geometry. */
export const SHAPE_PRESETS: readonly string[] = PRESET_NAMES;
const PRESET_SET: ReadonlySet<string> = new Set(PRESET_NAMES);
/** Whether \`name\` is one of the 187 preset names. */
export const isPresetShape = (name: unknown): name is string => typeof name === 'string' && PRESET_SET.has(name);

/**
 * The four picture masks core draws without SH-01's preset geometry (FA-22's masks, the ECMA-376 formulas of rect, roundRect, ellipse
 * and hexagon), so a deck whose pictures use only these never loads the geometry in a browser. Every other preset, and every shape
 * block, needs the geometry: \`ensureShapes\` loads it where it is lazy.
 */
export const BUILT_IN_MASKS: readonly string[] = Object.freeze(['rect', 'roundRect', 'ellipse', 'hexagon']);
const BUILT_IN = new Set(BUILT_IN_MASKS);
const builtInAdjustments = (preset: string, width: number, height: number): Record<string, ShapeAdjustment> => {
  const ss = Math.min(width, height);
  if (preset === 'roundRect') return { adj: { default: 0.16667, min: 0, max: 0.5, unit: 'fraction' } };
  if (preset === 'hexagon') return { adj: { default: 0.25, min: 0, max: Math.round(0.5 * width / Math.max(ss, 1e-9) * 1e5) / 1e5, unit: 'fraction' }, vf: { default: 1.1547, min: null, max: null, unit: 'fraction' } };
  return {};
};
/** The adjust values of a preset (built-in masks without the geometry); undefined while the geometry is still loading. */
function adjustmentsOf(preset: string, width = 100, height = 100): Record<string, ShapeAdjustment> | undefined {
  if (BUILT_IN.has(preset)) return builtInAdjustments(preset, width, height);
  return shapeGeometry()?.presetAdjustments(preset, width, height);
}

/**
 * SH-02: what a deck needs loaded before it composes in a browser or an edge runtime: \`['shapes']\` when it has a shape block or a
 * picture masked by a preset beyond the four built-in masks and the preset geometry is not loaded, else nothing. Node, Bun and Deno
 * load the geometry with core, so this is always empty there.
 */
export function shapesPending(input: unknown): string[] {
  if (shapeGeometry()) return [];
  const needs = (value: unknown, depth: number): boolean => {
    if (depth > 64 || value === null || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some((item) => needs(item, depth + 1));
    const node = value as Rec;
    if (node.image === undefined && !Array.isArray(node.blocks) && (typeof node.shape === 'string' || node.path !== undefined || node.type === 'shape')) return true;
    if (node.image !== undefined && typeof node.shape === 'string' && !BUILT_IN.has(node.shape)) return true;
    return Object.entries(node).some(([key, item]) => key !== 'extensions' && needs(item, depth + 1));
  };
  return needs(record(input).slides, 0) ? ['shapes'] : [];
}

/** SH-02: load the preset geometry when the deck needs it (shapesPending); returns what it loaded. Await it before composing in a browser. */
export async function ensureShapes(input: unknown): Promise<string[]> {
  const pending = shapesPending(input);
  if (pending.length) await loadShapeGeometry();
  return pending;
}`],
  [S, `export function presetMask(preset: unknown, box: Box, adjust?: Record<string, number>): ShapeOutline & { kind: string } {
  const name = isPresetShape(preset) ? preset : 'rect';
  const own = validAdjust(name, adjust, box.width, box.height);
  const geometry = presetGeometry(name, Math.max(box.width, 1e-6), Math.max(box.height, 1e-6), own);`,
  `export function presetMask(preset: unknown, box: Box, adjust?: Record<string, number>): ShapeOutline & { kind: string } {
  const requested = isPresetShape(preset) ? preset : 'rect';
  const engine = shapeGeometry();
  // A mask beyond the built-in four is drawn as a rectangle until the geometry has loaded (ensureShapes).
  const name = BUILT_IN.has(requested) || engine ? requested : 'rect';
  const own = validAdjust(name, adjust, box.width, box.height);
  if (BUILT_IN.has(name)) return builtInMask(name, box, own);
  const geometry = engine!.presetGeometry(name, Math.max(box.width, 1e-6), Math.max(box.height, 1e-6), own);`],
  [S, `  return { kind: name, preset: name, adjust: adjustToDrawingML(name, own), path };
}`, `  return { kind: name, preset: name, adjust: engine!.adjustToDrawingML(name, own), path };
}

const pathNumber = (value: number) => String(Math.round(value * 1e3) / 1e3 || 0);
/**
 * The four built-in masks (FA-22): the ECMA-376 formulas of rect, roundRect (circular corners of adj times the shorter side), ellipse and
 * hexagon (adj and vf), with their DrawingML guide values: roundRect and hexagon write every guide, as PowerPoint and 0.14 do.
 */
function builtInMask(preset: string, box: Box, adjust: Record<string, number>): ShapeOutline & { kind: string } {
  const { x, y, width: w, height: h } = box, r = x + w, b = y + h, ss = Math.min(w, h), n = pathNumber;
  const rect = \`M\${n(x)} \${n(y)}H\${n(r)}V\${n(b)}H\${n(x)}Z\`;
  if (preset === 'roundRect') {
    const adj = Math.round(Math.min(0.5, Math.max(0, adjust.adj ?? 1 / 6)) * 100000), radius = ss * adj / 100000;
    const path = radius <= 0 ? rect : \`M\${n(x)} \${n(y + radius)}A\${n(radius)} \${n(radius)} 0 0 1 \${n(x + radius)} \${n(y)}H\${n(r - radius)}A\${n(radius)} \${n(radius)} 0 0 1 \${n(r)} \${n(y + radius)}V\${n(b - radius)}A\${n(radius)} \${n(radius)} 0 0 1 \${n(r - radius)} \${n(b)}H\${n(x + radius)}A\${n(radius)} \${n(radius)} 0 0 1 \${n(x)} \${n(b - radius)}Z\`;
    return { kind: preset, preset, adjust: { adj }, path };
  }
  if (preset === 'ellipse') {
    const cy = y + h / 2;
    return { kind: preset, preset, adjust: {}, path: \`M\${n(x)} \${n(cy)}A\${n(w / 2)} \${n(h / 2)} 0 1 1 \${n(r)} \${n(cy)}A\${n(w / 2)} \${n(h / 2)} 0 1 1 \${n(x)} \${n(cy)}Z\` };
  }
  if (preset === 'hexagon') {
    const adj = Math.round((adjust.adj ?? 0.25) * 100000), vf = Math.round((adjust.vf ?? 1.1547) * 100000), a = Math.min(Math.max(adj, 0), 50000 * w / Math.max(ss, 1e-9));
    const x1 = ss * a / 100000, x2 = r - x1, vc = y + h / 2, dy1 = h / 2 * vf / 100000 * Math.sin(Math.PI / 3);
    return { kind: preset, preset, adjust: { adj, vf }, path: \`M\${n(x)} \${n(vc)}L\${n(x + x1)} \${n(vc - dy1)}L\${n(x2)} \${n(vc - dy1)}L\${n(r)} \${n(vc)}L\${n(x2)} \${n(vc + dy1)}L\${n(x + x1)} \${n(vc + dy1)}Z\` };
  }
  return { kind: 'rect', preset: 'rect', adjust: {}, path: rect };
}`],
  [S, `  const known = presetAdjustments(preset, Math.max(width, 1e-6), Math.max(height, 1e-6)), out: Record<string, number> = {};`, `  const known = adjustmentsOf(preset, Math.max(width, 1e-6), Math.max(height, 1e-6)) ?? {}, out: Record<string, number> = {};`],
  [S, `    } else if (preset && isPresetShape(preset)) {
      const known = presetAdjustments(preset);
      for (const [name, number] of Object.entries(adjust)) {`, `    } else if (preset && isPresetShape(preset) && adjustmentsOf(preset)) {
      // While the geometry is loading (a browser before ensureShapes), a preset's adjust values are not checked: no finding either way.
      const known = adjustmentsOf(preset)!;
      for (const [name, number] of Object.entries(adjust)) {`],
  [S, `  try { geometry = preset ? presetGeometry(preset, w, h, adjust) : customGeometry(custom!, w, h); }
  catch { geometry = presetGeometry('rect', w, h); }`, `  const engine = shapeGeometry();
  // In a browser before ensureShapes the geometry is loading: the shape keeps its frame and text, with no outline yet (\`loading\`).
  if (!engine) geometry = { paths: [], textRect: { x: 0, y: 0, width: w, height: h }, connectionSites: [], handles: [] };
  else {
    try { geometry = preset ? engine.presetGeometry(preset, w, h, adjust) : engine.customGeometry(custom!, w, h); }
    catch { geometry = engine.presetGeometry('rect', w, h); }
  }`],
  [S, `avLst: preset ? adjustToDrawingML(preset, adjust) : {}, paths,`, `avLst: preset && engine ? engine.adjustToDrawingML(preset, adjust) : {}, ...(engine ? {} : { loading: true as const }), paths,`],
  [S, `  /** The DrawingML preset, absent for a custom path. */
  preset?: string;`, `  /** The DrawingML preset, absent for a custom path. */
  preset?: string;
  /** In a browser or edge runtime before \`ensureShapes\`: the preset geometry is still loading, so \`paths\` is empty (engines draw no outline). */
  loading?: true;`],
  [C, `import {isPresetShape} from './shape-geometry.js';\n`, ''],
  [C, `import {composeShape,composeStroke,isShapeBlock,presetAspect,presetMask,`, `import {composeShape,composeStroke,isPresetShape,isShapeBlock,presetAspect,presetMask,`],
  [C, `export {composeShape, isShapeBlock, presetAspect, presetMask, shapeIssues, shapeTextColor, stackedText,`, `export {BUILT_IN_MASKS, composeShape, ensureShapes, isPresetShape, isShapeBlock, presetAspect, presetMask, shapeIssues, shapesPending, shapeTextColor, stackedText, SHAPE_PRESETS,`],
];
