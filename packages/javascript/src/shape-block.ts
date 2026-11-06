/**
 * Shape blocks (shapes SH-02): a block that draws a DrawingML preset (`shape: "chevron"`) or a custom outline (`path`), with a fill,
 * a stroke, a theme style and optional text inside its text rectangle. Core resolves everything both engines draw from: the frame,
 * the evaluated geometry (SH-01's `presetGeometry`, in slide coordinates), the effective fill and stroke (the author's, else the
 * style's), the text rectangle with its insets, and the effects to hand to SH-03. Engines resolve the ColorRefs and draw: the
 * preview the paths as SVG, the PPTX export a native `p:sp` with `a:prstGeom` (or `a:custGeom`), `a:ln` and `p:style`.
 *
 * The same stroke vocabulary is a picture's line (`stroke` on an image block, renamed from `border`), and the preset masks of
 * image blocks come from the same geometry (`presetMask`).
 */
import { adjustToDrawingML, customGeometry, isPresetShape, presetAdjustments, presetGeometry, type CustomPathInput, type ShapeGeometry, type ShapePath, type ShapePathFill } from './shape-geometry.js';

interface Box { x: number; y: number; width: number; height: number }
type Rec = Record<string, any>;
const record = (value: unknown): Rec => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Rec : {};
const finite = (value: unknown, min: number, max: number): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : undefined;
const round = (value: number) => Math.round(value * 1e6) / 1e6 || 0;

/** The theme shape styles (`style`), as PowerPoint's shape style gallery. */
export const SHAPE_STYLES = ['none', 'subtle', 'moderate', 'intense'] as const;
export type ShapeStyleName = typeof SHAPE_STYLES[number];
/** The style a shape takes when it names none: PowerPoint's default shape style, a solid accent fill with a darker line. */
export const DEFAULT_SHAPE_STYLE: ShapeStyleName = 'moderate';
/** The six effect keys (SH-03 draws them). */
export const SHAPE_EFFECT_KEYS = ['shadow', 'innerShadow', 'glow', 'softEdge', 'reflection', 'blur'] as const;
/** Keys only a shape block takes (an image block also takes `shape`, `adjust`, `stroke`, `opacity` and `aspectRatio`). */
export const SHAPE_BLOCK_KEYS = ['path', 'fill', 'style', 'rotate', 'flip', 'anchor', 'padding', 'textDirection', 'alt', 'decorative', 'hidden', 'link', ...SHAPE_EFFECT_KEYS] as const;
/** A line's default width on a shape: 1 point, PowerPoint's default line, in reference pixels. */
export const SHAPE_STROKE_WIDTH = 4 / 3;
/** A picture's line width when its stroke names none. */
export const PICTURE_STROKE_WIDTH = 2;
/** PowerPoint's default text insets (0.1 inch left and right, 0.05 inch top and bottom), in reference pixels. */
export const SHAPE_PADDING = { top: 4.8, right: 9.6, bottom: 4.8, left: 9.6 } as const;
/** The frame aspect of a preset when the block sets no `aspectRatio`: its natural proportions in PowerPoint's shape gallery. */
export const SHAPE_DEFAULT_ASPECT = 1.5;

const SQUARE = /^(ellipse|triangle|diamond|pentagon|hexagon|heptagon|octagon|decagon|dodecagon|star\d+|pie|pieWedge|blockArc|donut|noSmoking|heart|sun|smileyFace|irregularSeal[12]|gear[69]|plus|math\w+|chart(X|Star|Plus)|flowChart(Connector|SummingJunction|Or|Sort|Collate|Extract|Merge|OfflineStorage|Decision)|cube|frame|chord|arc|(left|leftRight)?[cC]ircularArrow|quadArrow|quadArrowCallout|leftRightUpArrow|cloud|teardrop|actionButton\w+|foldedCorner|bevel|corner|halfFrame|diagStripe|lightningBolt|funnel|(square|corner|plaque)Tabs|rtTriangle|bentUpArrow|leftUpArrow|uturnArrow|bentArrow|moon)$/;
const WIDE = /^(rightArrow|leftArrow|leftRightArrow|notchedRightArrow|stripedRightArrow|homePlate|chevron|ribbon2?|ellipseRibbon2?|leftRightRibbon|horizontalScroll|wave|doubleWave|flowChartTerminator|flowChartPunchedTape|line|lineInv|straightConnector1|bentConnector[2-5]|curvedConnector[2-5]|leftRightArrowCallout|swooshArrow|curved(Up|Down)Arrow|bracketPair|bracePair)$/;
const TALL = /^(upArrow|downArrow|upDownArrow|verticalScroll|leftBrace|rightBrace|leftBracket|rightBracket|curved(Right|Left)Arrow|upDownArrowCallout|can)$/;
/** The default frame aspect (width / height) of a preset: 1 for the round and regular shapes, 2 for horizontal arrows and bands, 0.5 for vertical ones, 1.5 otherwise. */
export function presetAspect(preset: string | undefined): number {
  if (!preset) return 1;
  return SQUARE.test(preset) ? 1 : WIDE.test(preset) ? 2 : TALL.test(preset) ? 0.5 : SHAPE_DEFAULT_ASPECT;
}

/** Whether a payload is a shape block: it names a preset with no `image`, or a custom `path`, and is no group. */
export function isShapeBlock(host: unknown): boolean {
  const value = record(host);
  if (Array.isArray(value.blocks) || value.image !== undefined) return false;
  return value.type === 'shape' || typeof value.shape === 'string' || value.path !== undefined;
}

/** SVG path data (absolute commands, as SH-01 writes them) moved by dx, dy. Arc radii and flags stay; only points move. */
export function translatePathData(d: string, dx: number, dy: number): string {
  if (!dx && !dy) return d;
  const tokens = d.match(/[MLHVCSQTAZmlhvcsqtaz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const out: string[] = [];
  let command = '', index = 0;
  const n = (value: number) => String(Math.round(value * 1000) / 1000);
  for (const token of tokens) {
    if (/^[A-Za-z]$/.test(token)) { command = token; index = 0; out.push(token); continue; }
    const value = Number(token);
    let moved = value;
    if (command === 'H') moved = value + dx;
    else if (command === 'V') moved = value + dy;
    else if (command === 'A') { const at = index % 7; moved = at === 5 ? value + dx : at === 6 ? value + dy : value; }
    else if ('MLCSQT'.includes(command)) moved = index % 2 === 0 ? value + dx : value + dy;
    out.push(n(moved));
    index++;
  }
  return out.join(' ');
}

/** A frame mask or a shape's outline as one SVG path in slide coordinates: the preset's paths that take the fill, joined. */
export interface ShapeOutline {
  /** The DrawingML preset (an image mask always names one). */
  preset: string;
  /** DrawingML avLst guide values (1/100000 and 60000ths), for `a:prstGeom/a:avLst`. */
  adjust: Record<string, number>;
  /** The filled outline in slide coordinates. */
  path: string;
}

/**
 * An image frame's mask (FA-22, SH-02): `preset` (default rect) with the block's `adjust` (OPF units) at `box`, the DrawingML values
 * for export and the outline the preview clips to, from SH-01's preset geometry. An unknown preset is a rectangle.
 */
export function presetMask(preset: unknown, box: Box, adjust?: Record<string, number>): ShapeOutline & { kind: string } {
  const name = isPresetShape(preset) ? preset : 'rect';
  const own = validAdjust(name, adjust, box.width, box.height);
  const geometry = presetGeometry(name, Math.max(box.width, 1e-6), Math.max(box.height, 1e-6), own);
  const filled = geometry.paths.filter(path => path.fill !== 'none');
  const path = (filled.length ? filled : geometry.paths).map(entry => translatePathData(entry.d, box.x, box.y)).join(' ');
  return { kind: name, preset: name, adjust: adjustToDrawingML(name, own), path };
}

/** The block's adjust values the preset has and that lie in range (out-of-range and unknown names are findings; the default is drawn). */
export function validAdjust(preset: string, adjust: unknown, width = 100, height = 100): Record<string, number> {
  const known = presetAdjustments(preset, Math.max(width, 1e-6), Math.max(height, 1e-6)), out: Record<string, number> = {};
  for (const [name, value] of Object.entries(record(adjust))) {
    const spec = known[name];
    if (!spec || typeof value !== 'number' || !Number.isFinite(value)) continue;
    if ((spec.min !== null && value < spec.min - 1e-9) || (spec.max !== null && value > spec.max + 1e-9)) continue;
    out[name] = value;
  }
  return out;
}

/** A validation issue of a shape or image block's `shape`/`adjust` (schema-check reports them). */
export interface ShapeIssue { path: string; code: 'shape-adjust-unknown' | 'shape-adjust-range' | 'shape-link-hidden'; message: string; params: Record<string, unknown> }
/**
 * The findings of one block's preset and adjust values, and of a link on a hidden shape: an adjust name the preset does not have, a
 * value outside the preset's range (checked at the default square size; a range that depends on the size is checked there too), and
 * `link` with `hidden: true`. `at` builds a JSON Pointer under the block.
 */
export function shapeIssues(host: unknown, at: (...keys: string[]) => string): ShapeIssue[] {
  const value = record(host), issues: ShapeIssue[] = [];
  const preset = typeof value.shape === 'string' ? value.shape : value.image !== undefined ? 'rect' : undefined;
  const adjust = record(value.adjust);
  if (Object.keys(adjust).length) {
    if (value.path !== undefined && value.shape === undefined) {
      for (const name of Object.keys(adjust)) issues.push({ path: at('adjust', name), code: 'shape-adjust-unknown', message: `adjust '${name}' has no effect on a custom path; adjust values belong to presets`, params: { name, shape: 'path', known: [] } });
    } else if (preset && isPresetShape(preset)) {
      const known = presetAdjustments(preset);
      for (const [name, number] of Object.entries(adjust)) {
        const spec = known[name];
        if (!spec) { issues.push({ path: at('adjust', name), code: 'shape-adjust-unknown', message: `${preset} has no adjust value '${name}'${Object.keys(known).length ? `; it has ${Object.keys(known).join(', ')}` : '; it has none'}`, params: { name, shape: preset, known: Object.keys(known) } }); continue; }
        if (typeof number !== 'number') continue;
        if ((spec.min !== null && number < spec.min - 1e-9) || (spec.max !== null && number > spec.max + 1e-9))
          issues.push({ path: at('adjust', name), code: 'shape-adjust-range', message: `${preset} adjust '${name}' is ${number}, outside ${spec.min ?? '-∞'} to ${spec.max ?? '∞'} (${spec.unit === 'degrees' ? 'degrees' : 'a fraction'}); the default ${spec.default} is drawn`, params: { name, shape: preset, value: number, min: spec.min, max: spec.max, default: spec.default, unit: spec.unit } });
      }
    }
  }
  if (value.hidden === true && typeof value.link === 'string') issues.push({ path: at('link'), code: 'shape-link-hidden', message: 'a hidden shape is not drawn, so its link cannot be clicked', params: {} });
  return issues;
}

// --- fill, stroke and style ------------------------------------------------------------------------------------------

export interface ComposedGradientStop { color: unknown; position: number }
export interface ComposedGradient { type: 'linear' | 'radial' | 'rectangle' | 'shape'; angle: number; stops: ComposedGradientStop[] }
/** A resolved fill; ColorRefs stay as authored (engines resolve them). `opacity` multiplies the colors' own alpha. */
export type ComposedFill =
  | { type: 'none' }
  | { type: 'solid'; color: unknown; opacity?: number }
  | { type: 'gradient'; gradient: ComposedGradient; opacity?: number }
  | { type: 'pattern'; preset: string; foreground?: unknown; background?: unknown; opacity?: number };
export interface ComposedArrowhead { type: 'triangle' | 'stealth' | 'diamond' | 'oval' | 'arrow'; width: 'small' | 'medium' | 'large'; length: 'small' | 'medium' | 'large' }
export interface ComposedStroke {
  /** ColorRef as authored; absent means the engine's neutral line color (a picture with no color). */
  color?: unknown;
  gradient?: ComposedGradient;
  /** Reference pixels, scaled to the canvas. */
  width: number;
  /** A DrawingML preset dash, or dash and gap lengths in stroke widths. */
  dash: string | number[];
  cap: 'flat' | 'round' | 'square';
  join: 'miter' | 'round' | 'bevel';
  miterLimit: number;
  compound: 'single' | 'double' | 'thickThin' | 'thinThick' | 'triple';
  align: 'center' | 'inside';
  start?: ComposedArrowhead;
  end?: ComposedArrowhead;
  sketch?: 'curved' | 'freehand' | 'scribble';
}

const DASHES = new Set(['solid', 'dot', 'dash', 'longDash', 'dashDot', 'longDashDot', 'longDashDotDot', 'sysDot', 'sysDash', 'sysDashDot', 'sysDashDotDot']);
const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed as readonly unknown[]).includes(value) ? value as T : fallback;

/** A gradient object (opf.schema.json Gradient), with its stops sorted; undefined when it has fewer than two valid stops. */
export function composeGradient(value: unknown): ComposedGradient | undefined {
  const gradient = record(value);
  const stops = (Array.isArray(gradient.stops) ? gradient.stops : []).map(record).filter(stop => stop.color !== undefined && finite(stop.position, 0, 1) !== undefined)
    .map(stop => ({ color: stop.color, position: stop.position as number })).sort((a, b) => a.position - b.position);
  if (stops.length < 2) return undefined;
  return { type: pick(gradient.type, ['linear', 'radial', 'rectangle', 'shape'] as const, 'linear'), angle: typeof gradient.angle === 'number' && Number.isFinite(gradient.angle) ? gradient.angle : 90, stops };
}

function arrowhead(value: unknown): ComposedArrowhead | undefined {
  if (value === undefined) return undefined;
  const head = record(value), type = head.type === undefined ? 'triangle' : head.type;
  if (type === 'none' || !['triangle', 'stealth', 'diamond', 'oval', 'arrow'].includes(type)) return undefined;
  const size = ['small', 'medium', 'large'] as const;
  return { type, width: pick(head.width, size, 'medium'), length: pick(head.length, size, 'medium') };
}

/**
 * A stroke (opf.schema.json Stroke) with its defaults, width scaled by `scale`; undefined for `"none"`, a width of 0, or nothing
 * (`value` undefined) when `defaults` gives no line. `defaults` is the style's line on a shape, or a picture's.
 */
export function composeStroke(value: unknown, scale: number, defaults: { color?: unknown; width: number; join: 'miter' | 'round' } | undefined): ComposedStroke | undefined {
  if (value === 'none') return undefined;
  if (value === undefined && !defaults) return undefined;
  const stroke = record(value);
  const width = finite(stroke.width, 0, 64) ?? defaults?.width ?? SHAPE_STROKE_WIDTH;
  if (!(width > 0)) return undefined;
  const gradient = composeGradient(stroke.gradient);
  const dash = Array.isArray(stroke.dash) && stroke.dash.length >= 2 && stroke.dash.every((entry: unknown) => finite(entry, 1e-9, 100) !== undefined) ? (stroke.dash as number[]).slice(0, 20)
    : DASHES.has(stroke.dash) ? stroke.dash as string : 'solid';
  const color = stroke.color ?? (gradient ? undefined : defaults?.color);
  const result: ComposedStroke = {
    ...(color !== undefined ? { color } : {}), ...(gradient ? { gradient } : {}), width: round(width * scale), dash,
    cap: pick(stroke.cap, ['flat', 'round', 'square'] as const, 'flat'), join: pick(stroke.join, ['miter', 'round', 'bevel'] as const, defaults?.join ?? 'round'),
    miterLimit: finite(stroke.miterLimit, 1, 100) ?? 8, compound: pick(stroke.compound, ['single', 'double', 'thickThin', 'thinThick', 'triple'] as const, 'single'),
    align: pick(stroke.align, ['center', 'inside'] as const, 'center'),
  };
  const start = arrowhead(stroke.start), end = arrowhead(stroke.end);
  if (start) result.start = start;
  if (end) result.end = end;
  if (['curved', 'freehand', 'scribble'].includes(stroke.sketch)) result.sketch = stroke.sketch;
  return result;
}

/** A fill (opf.schema.json ShapeFill) with the block's `opacity`; undefined when `value` is not one. */
export function composeFill(value: unknown, opacity?: number): ComposedFill | undefined {
  const alpha = opacity !== undefined && opacity < 1 ? { opacity } : {};
  if (value === 'none') return { type: 'none' };
  if (typeof value === 'string' || (record(value).color !== undefined && record(value).gradient === undefined && record(value).pattern === undefined)) return { type: 'solid', color: value, ...alpha };
  const fill = record(value);
  if (fill.gradient !== undefined) { const gradient = composeGradient(fill.gradient); return gradient ? { type: 'gradient', gradient, ...alpha } : undefined; }
  if (fill.pattern !== undefined) {
    const pattern = record(fill.pattern);
    if (typeof pattern.preset !== 'string' || !pattern.preset) return undefined;
    return { type: 'pattern', preset: pattern.preset, ...(pattern.foregroundColor !== undefined ? { foreground: pattern.foregroundColor } : {}), ...(pattern.backgroundColor !== undefined ? { background: pattern.backgroundColor } : {}), ...alpha };
  }
  return undefined;
}

/**
 * What a theme style draws, as PowerPoint's shape styles on the theme's accent1 (Format > Shape Styles):
 * - subtle: "Light 1 Fill, Colored Outline": accent1 at 80% lighter, a 1 pt accent1 line, dark text (p:style lnRef 2, fillRef 1).
 * - moderate (the default): "Colored Fill": accent1, a 1 pt accent1 line 50% darker, light text (lnRef 2 with shade, fillRef 1).
 * - intense: "Intense Effect": accent1 25% darker, no line, bold light text and the soft shadow (lnRef 0, fillRef 1, effectRef 2).
 * - none: nothing the author did not set; text in the slide's text color.
 * `ref` is the `p:style` an export writes (the idx of each reference and its color), so PowerPoint shows the style as applied.
 */
export interface ShapeStyleLook {
  fill: unknown;
  stroke?: { color: unknown; width: number };
  text: unknown;
  bold: boolean;
  shadow?: 'soft';
  ref?: { line: { idx: number; color: unknown }; fill: { idx: number; color: unknown }; effect: { idx: number; color: unknown }; font: { idx: 'minor'; color: unknown } };
}
export function shapeStyleLook(style: ShapeStyleName): ShapeStyleLook {
  switch (style) {
    case 'none': return { fill: 'none', text: 'text', bold: false };
    case 'subtle': return { fill: { color: 'accent1', lighten: 0.8 }, stroke: { color: 'accent1', width: SHAPE_STROKE_WIDTH }, text: 'dark1', bold: false,
      ref: { line: { idx: 2, color: 'accent1' }, fill: { idx: 1, color: { color: 'accent1', lighten: 0.8 } }, effect: { idx: 0, color: 'accent1' }, font: { idx: 'minor', color: 'dark1' } } };
    case 'intense': return { fill: { color: 'accent1', darken: 0.25 }, text: 'light1', bold: true, shadow: 'soft',
      ref: { line: { idx: 0, color: 'accent1' }, fill: { idx: 1, color: { color: 'accent1', darken: 0.25 } }, effect: { idx: 2, color: 'accent1' }, font: { idx: 'minor', color: 'light1' } } };
    default: return { fill: 'accent1', stroke: { color: { color: 'accent1', darken: 0.5 }, width: SHAPE_STROKE_WIDTH }, text: 'light1', bold: false,
      ref: { line: { idx: 2, color: { color: 'accent1', darken: 0.5 } }, fill: { idx: 1, color: 'accent1' }, effect: { idx: 0, color: 'accent1' }, font: { idx: 'minor', color: 'light1' } } };
  }
}

// --- the composed shape ------------------------------------------------------------------------------------------------

/** One evaluated path of a shape, in slide coordinates (before rotation and flip, which engines apply about the frame's center). */
export interface ComposedShapePath {
  d: string;
  fill: ShapePathFill;
  stroke: boolean;
  /** True when the path does not end with Z: arrowheads draw at its ends. */
  open: boolean;
  /** An open path's two ends in slide coordinates, each with the direction (degrees, clockwise from +x) a line leaves the path there. */
  ends?: { start: ShapeEnd; end: ShapeEnd };
}
/** One end of an open path: the point, and the outward direction of the line there in degrees (clockwise from the positive x axis). */
export interface ShapeEnd { x: number; y: number; angle: number }
/**
 * The drawing of a shape block (`ComposedItem.shape`, `field` shape). Paint order: the paths in order (each filled in its mode,
 * `lighten` and `darken` shading the fill, then stroked where `stroke` is set), then the effects (SH-03), then the text.
 */
export interface ComposedShape {
  /** Allocated region (the cell). */
  region: Box;
  /** The frame: the largest box of the shape's aspect centered in the region (or the region itself for an aspect of 0). */
  box: Box;
  /** The DrawingML preset, absent for a custom path. */
  preset?: string;
  /** The custom outline as authored (`path`), absent for a preset. */
  custom?: CustomPathInput;
  /** The adjust values drawn (valid OPF values), and the same in DrawingML units for `a:avLst`. */
  adjust: Record<string, number>;
  avLst: Record<string, number>;
  paths: ComposedShapePath[];
  /** The preset's text rectangle in slide coordinates. */
  textRect: Box;
  /** Insets inside it (scaled reference pixels). */
  padding: { top: number; right: number; bottom: number; left: number };
  /** The text rectangle less the insets: where the text is fitted (for vertical text, the box turned about its center). */
  textBox: Box;
  anchor: 'top' | 'middle' | 'bottom';
  /** Where the fitted text block is drawn: `textBox` narrowed to the text's height at the anchor (present when the shape has text). */
  textArea?: Box;
  textDirection: 'horizontal' | 'vertical' | 'vertical270' | 'stacked';
  style: ShapeStyleName;
  /** The style's PowerPoint references (absent for style none). */
  styleRef?: ShapeStyleLook['ref'];
  fill: ComposedFill;
  stroke?: ComposedStroke;
  /** The color the text prefers (the style's), before `shapeTextColor` checks its contrast with the fill. */
  textColor: unknown;
  /** The ColorRef the text sits on: the fill's color (a gradient's middle stop, a pattern's background), absent on a transparent shape. */
  textBackdrop?: unknown;
  textBold: boolean;
  rotate?: number;
  flipH?: boolean;
  flipV?: boolean;
  alt?: string;
  decorative?: true;
  hidden?: true;
  link?: string;
  /** The effects to draw (the author's, and the soft shadow of the intense style): SH-03's drawEffects reads them. */
  effects?: Partial<Record<typeof SHAPE_EFFECT_KEYS[number], unknown>>;
}

const paddingOf = (value: unknown, scale: number) => {
  const all = finite(value, 0, 200);
  if (all !== undefined) return { top: all * scale, right: all * scale, bottom: all * scale, left: all * scale };
  const sides = record(value), side = (key: 'top' | 'right' | 'bottom' | 'left') => (finite(sides[key], 0, 200) ?? SHAPE_PADDING[key]) * scale;
  return { top: side('top'), right: side('right'), bottom: side('bottom'), left: side('left') };
};

/**
 * The geometry and look of a shape block in its `region` (the cell): the frame (the block's `aspectRatio`, else the preset's
 * aspect, as the largest centered box; `fill: true` in `options` takes the whole region), the evaluated paths, the text rectangle
 * and insets, and the effective fill, stroke, text color and effects. Text is fitted by composition in `textBox`.
 */
export function composeShape(host: Rec, region: Box, options: { scale: number; aspect?: number; anchorY?: 'top' | 'middle' | 'bottom' }): ComposedShape {
  const { scale } = options;
  const preset = typeof host.shape === 'string' && isPresetShape(host.shape) ? host.shape : host.path !== undefined ? undefined : 'rect';
  const custom = preset === undefined ? host.path as CustomPathInput : undefined;
  const aspect = finite(host.aspectRatio, Number.MIN_VALUE, 10) ?? options.aspect ?? presetAspect(preset);
  let box: Box = { ...region };
  if (aspect > 0) {
    const width = Math.min(region.width, region.height * aspect), height = width / aspect;
    const offset = region.height - height, y = options.anchorY === 'top' ? 0 : options.anchorY === 'bottom' ? offset : offset / 2;
    box = { x: region.x + (region.width - width) / 2, y: region.y + y, width, height };
  }
  box = { x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) };
  const w = Math.max(box.width, 1e-6), h = Math.max(box.height, 1e-6);
  const adjust = preset ? validAdjust(preset, host.adjust, w, h) : {};
  let geometry: ShapeGeometry;
  try { geometry = preset ? presetGeometry(preset, w, h, adjust) : customGeometry(custom!, w, h); }
  catch { geometry = presetGeometry('rect', w, h); }
  const paths = geometry.paths.map(path => pathIn(path, box));
  const textRect = { x: round(box.x + geometry.textRect.x), y: round(box.y + geometry.textRect.y), width: round(geometry.textRect.width), height: round(geometry.textRect.height) };
  const padding = paddingOf(host.padding, scale);
  const inner = { x: textRect.x + padding.left, y: textRect.y + padding.top, width: Math.max(scale, textRect.width - padding.left - padding.right), height: Math.max(scale, textRect.height - padding.top - padding.bottom) };
  const textDirection = pick(host.textDirection, ['horizontal', 'vertical', 'vertical270', 'stacked'] as const, 'horizontal');
  const turned = textDirection === 'vertical' || textDirection === 'vertical270';
  const textBox = turned ? { x: round(inner.x + (inner.width - inner.height) / 2), y: round(inner.y + (inner.height - inner.width) / 2), width: round(inner.height), height: round(inner.width) } : { x: round(inner.x), y: round(inner.y), width: round(inner.width), height: round(inner.height) };
  const style = pick(host.style, SHAPE_STYLES, DEFAULT_SHAPE_STYLE);
  const look = shapeStyleLook(style);
  const opacity = finite(host.opacity, 0, 1);
  const fill = composeFill(host.fill ?? look.fill, opacity) ?? composeFill(look.fill, opacity) ?? { type: 'none' as const };
  const stroke = composeStroke(host.stroke, scale, look.stroke ? { ...look.stroke, join: 'miter' } : host.stroke !== undefined ? { color: style === 'none' ? 'text' : { color: 'accent1', darken: 0.5 }, width: SHAPE_STROKE_WIDTH, join: 'miter' } : undefined);
  const effects: NonNullable<ComposedShape['effects']> = {};
  if (look.shadow && host.shadow === undefined) effects.shadow = look.shadow;
  for (const key of SHAPE_EFFECT_KEYS) if (host[key] !== undefined) effects[key] = host[key];
  const rotate = typeof host.rotate === 'number' && Number.isFinite(host.rotate) && host.rotate % 360 !== 0 ? round(((host.rotate % 360) + 360) % 360) : undefined;
  const flip = host.flip;
  const result: ComposedShape = {
    region: { ...region }, box, ...(preset ? { preset } : { custom }), adjust, avLst: preset ? adjustToDrawingML(preset, adjust) : {}, paths, textRect, padding, textBox,
    anchor: pick(host.anchor, ['top', 'middle', 'bottom'] as const, 'middle'), textDirection, style, ...(look.ref ? { styleRef: look.ref } : {}),
    fill, ...(stroke ? { stroke } : {}), textColor: look.text, ...(shapeBackdrop(fill) !== undefined ? { textBackdrop: shapeBackdrop(fill) } : {}), textBold: look.bold,
    ...(rotate !== undefined ? { rotate } : {}), ...(flip === 'horizontal' || flip === 'both' ? { flipH: true } : {}), ...(flip === 'vertical' || flip === 'both' ? { flipV: true } : {}),
    ...(typeof host.alt === 'string' ? { alt: host.alt } : {}), ...(host.decorative === true ? { decorative: true as const } : {}), ...(host.hidden === true ? { hidden: true as const } : {}),
    ...(typeof host.link === 'string' && /^(https?:\/\/|mailto:|tel:)\S+$/.test(host.link) ? { link: host.link } : {}),
    ...(Object.keys(effects).length ? { effects } : {}),
  };
  return result;
}

function pathIn(path: ShapePath, box: Box): ComposedShapePath {
  const last = path.commands[path.commands.length - 1];
  const open = !last || last[0] !== 'Z';
  const ends = open ? pathEnds(path.commands, box.x, box.y) : undefined;
  return { d: translatePathData(path.d, box.x, box.y), fill: path.fill, stroke: path.stroke, open, ...(ends ? { ends } : {}) };
}

/** The two ends of an open path and the outward direction at each (from the nearest distinct control point), moved by dx, dy. */
function pathEnds(commands: ShapePath['commands'], dx: number, dy: number): { start: ShapeEnd; end: ShapeEnd } | undefined {
  const points: [number, number][] = [];
  for (const command of commands) {
    if (command[0] === 'Z') return undefined;
    const values = command.slice(1) as number[];
    for (let index = 0; index + 1 < values.length; index += 2) points.push([values[index]!, values[index + 1]!]);
  }
  if (points.length < 2) return undefined;
  const same = (a: [number, number], b: [number, number]) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  const first = points[0]!, next = points.find(point => !same(point, first)), lastPoint = points[points.length - 1]!, before = [...points].reverse().find(point => !same(point, lastPoint));
  if (!next || !before) return undefined;
  const angle = (from: [number, number], to: [number, number]) => round(Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI);
  return { start: { x: round(first[0] + dx), y: round(first[1] + dy), angle: angle(next, first) }, end: { x: round(lastPoint[0] + dx), y: round(lastPoint[1] + dy), angle: angle(before, lastPoint) } };
}

/** The ColorRef under a shape's text: a solid fill's color, a gradient's middle stop, a pattern's background; undefined without a fill. */
export function shapeBackdrop(fill: ComposedFill): unknown {
  if (fill.type === 'solid') return fill.color;
  if (fill.type === 'gradient') { const stops = fill.gradient.stops; return stops[Math.floor((stops.length - 1) / 2)]!.color; }
  if (fill.type === 'pattern') return fill.background ?? 'background';
  return undefined;
}

/** LH-151 for shapes: the text color an engine draws, given the backdrop and preferred colors it resolved (#RRGGBB): the preferred one when it reads at 4.5:1, else black or white. */
export { textColorForFill as shapeTextColor } from './color.js';

/** The text to fit for `stacked` text: each character on its own line, as PowerPoint's stacked (wordArtVert) text draws it. */
export function stackedText(value: unknown): unknown {
  const stack = (text: string) => [...text].filter(char => char !== '\n').join('\n');
  if (typeof value === 'string') return stack(value);
  if (Array.isArray(value)) return value.map((run, index) => {
    const text = typeof run === 'string' ? run : record(run).text;
    if (typeof text !== 'string') return run;
    const stacked = (index > 0 ? '\n' : '') + stack(text);
    return typeof run === 'string' ? stacked : { ...run, text: stacked };
  });
  return value;
}
