import { presetGeometrySource } from "./generated/preset-geometry.js";

/**
 * Preset shape geometry (shapes SH-01): the 187 DrawingML preset shapes of ECMA-376 Part 1 (`ST_ShapeType`), evaluated
 * to SVG path data for a size and a set of adjust values, plus OPF custom outlines (`path`, SVG path data).
 *
 * One definition drives both engines: the preview draws `presetGeometry(...)`; PPTX export writes the native
 * `a:prstGeom` with its `a:avLst` (see `adjustToDrawingML`), so PowerPoint draws the same outline from its own definition.
 *
 * Units. Geometry comes out in the units of the `width` and `height` you pass (OPF reference pixels, EMU, anything).
 * Adjust values are OPF units: a fraction for the values the standard writes in 1/100000 (DrawingML `val 25000` is
 * OPF `0.25`; what dimension it is a fraction of depends on the shape, most often the shorter side), and degrees for
 * the values the standard writes in 60000ths of a degree (the angle adjusts of arc, blockArc, chord, pie, the circular
 * arrows and mathNotEqual; DrawingML `val 16200000` is OPF `270`). Angles of connection sites are degrees, clockwise
 * from the positive x axis (y points down), as in DrawingML.
 *
 * Data: spec/reference/preset-geometry.json (generated from the standard's presetShapeDefinitions.xml; source and
 * license in docs/shapes.md). Edge-safe: no Node import.
 */

/** A DrawingML path fill mode: `norm` is the shape's fill; the others shade it; `none` is stroke only. */
export type ShapePathFill = "norm" | "none" | "lighten" | "lightenLess" | "darken" | "darkenLess";

/** An absolute path command: move, line, cubic Bézier, quadratic Bézier, close. Arcs are converted to cubic Béziers. */
export type ShapePathCommand =
  | readonly ["M", number, number]
  | readonly ["L", number, number]
  | readonly ["C", number, number, number, number, number, number]
  | readonly ["Q", number, number, number, number]
  | readonly ["Z"];

export interface ShapePath {
  /** SVG path data in the requested size (absolute commands; preset arcs stay exact elliptical arcs). */
  d: string;
  fill: ShapePathFill;
  stroke: boolean;
  /** The same outline as absolute commands, arcs as cubic Béziers: for bounds, hit tests and native custom geometry. */
  commands: readonly ShapePathCommand[];
}

export interface ShapeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShapeConnectionSite {
  x: number;
  y: number;
  /** The direction a connector leaves the site, in degrees clockwise from the positive x axis. */
  angle: number;
}

/** One axis of an adjust handle: the adjust value it moves and that value's range (OPF units; null is unbounded). */
export interface ShapeHandleAxis {
  adjust: string;
  min: number | null;
  max: number | null;
}

export interface ShapeHandle {
  /** `xy` moves along x and/or y; `polar` moves a radius and/or an angle around the shape's center of the guide. */
  kind: "xy" | "polar";
  /** Where the handle is drawn. */
  x: number;
  y: number;
  horizontal?: ShapeHandleAxis;
  vertical?: ShapeHandleAxis;
  radius?: ShapeHandleAxis;
  angle?: ShapeHandleAxis;
}

export interface ShapeGeometry {
  paths: ShapePath[];
  /** The text rectangle (the whole shape when the preset has none). */
  textRect: ShapeRect;
  connectionSites: ShapeConnectionSite[];
  handles: ShapeHandle[];
}

export interface ShapeAdjustment {
  default: number;
  /** The handle range at the size asked for (null when unbounded or when no handle moves the value). */
  min: number | null;
  max: number | null;
  unit: "fraction" | "degrees";
}

/** OPF adjust values: names as DrawingML's guides (`adj`, `adj1`, ...), values as OPF fractions or degrees. */
export type ShapeAdjustValues = Readonly<Record<string, number>>;

// --- the reference table ---------------------------------------------------------------------------------------------

type Guide = readonly [string, string];
interface RawHandle {
  type: "xy" | "polar";
  gdRefX?: string;
  minX?: string;
  maxX?: string;
  gdRefY?: string;
  minY?: string;
  maxY?: string;
  gdRefR?: string;
  minR?: string;
  maxR?: string;
  gdRefAng?: string;
  minAng?: string;
  maxAng?: string;
  pos: readonly [string, string];
}
type RawCommand = readonly [string, ...string[]];
interface RawPath {
  w?: number;
  h?: number;
  fill?: ShapePathFill;
  stroke?: boolean;
  extrusionOk?: boolean;
  commands: readonly RawCommand[];
}
interface RawShape {
  avLst?: readonly Guide[];
  gdLst?: readonly Guide[];
  ahLst?: readonly RawHandle[];
  cxnLst?: readonly (readonly [string, string, string])[];
  rect?: readonly [string, string, string, string];
  pathLst: readonly RawPath[];
}
interface PresetGeometryTable {
  shapes: Readonly<Record<string, RawShape>>;
}

const TABLE = presetGeometrySource as PresetGeometryTable;

/** The 187 DrawingML preset shape names (ECMA-376 `ST_ShapeType`), in the order of the standard's definitions file. */
export const PRESET_SHAPES: readonly string[] = Object.freeze(Object.keys(TABLE.shapes));

const PRESET_SET = new Set(PRESET_SHAPES);

/** True when `name` is one of the 187 preset shape names (case-sensitive, as DrawingML writes them). */
export function isPresetShape(name: unknown): name is string {
  return typeof name === "string" && PRESET_SET.has(name);
}

function rawShape(name: string): RawShape {
  const shape = PRESET_SET.has(name) ? TABLE.shapes[name] : undefined;
  if (!shape) throw new RangeError(`Unknown preset shape '${String(name)}'. Use one of the 187 DrawingML names in PRESET_SHAPES.`);
  return shape;
}

// --- units -----------------------------------------------------------------------------------------------------------

const FRACTION = 100000;
const DEGREE = 60000;
/** The standard writes an unbounded handle range as ±2147483647. */
const UNBOUNDED = 2147483647;

const angleAdjustsCache = new Map<string, ReadonlySet<string>>();
function angleAdjusts(name: string): ReadonlySet<string> {
  let set = angleAdjustsCache.get(name);
  if (!set) {
    set = new Set((rawShape(name).ahLst ?? []).flatMap((handle) => (handle.type === "polar" && handle.gdRefAng ? [handle.gdRefAng] : [])));
    angleAdjustsCache.set(name, set);
  }
  return set;
}

/** The unit of one adjust value of a preset: `degrees` for the angle adjusts, `fraction` for every other one. */
function adjustUnit(name: string, adjust: string): "fraction" | "degrees" {
  return angleAdjusts(name).has(adjust) ? "degrees" : "fraction";
}

const toOpf = (raw: number, unit: "fraction" | "degrees") => roundUnit(raw / (unit === "degrees" ? DEGREE : FRACTION));
const roundUnit = (value: number) => Math.round(value * 1e9) / 1e9;

/**
 * The DrawingML `a:avLst` values for OPF adjust values: integers, in 1/100000 for fractions and 60000ths of a degree for
 * angles (`{ adj1: 0.25 }` on `rightArrow` is `{ adj1: 25000 }`), in the preset's avLst order. When any value is
 * given, every avLst value is written, the others at their defaults, as PowerPoint writes them: PowerPoint refuses to open a
 * file whose avLst names a hexagon's or star's `adj` without its `hf`/`vf` factors. No value (or none the preset has)
 * gives `{}`, an empty avLst: the preset's defaults.
 */
export function adjustToDrawingML(name: string, adjust: ShapeAdjustValues | undefined): Record<string, number> {
  const shape = rawShape(name);
  const out: Record<string, number> = {};
  if (!adjust) return out;
  const defaults = builtInGuides(0, 0);
  let given = false;
  for (const [guide, formula] of shape.avLst ?? []) {
    const value = adjust[guide];
    if (typeof value === "number" && Number.isFinite(value)) {
      out[guide] = Math.round(value * (adjustUnit(name, guide) === "degrees" ? DEGREE : FRACTION));
      given = true;
    } else out[guide] = Math.round(evaluate(formula, defaults));
  }
  return given ? out : {};
}

/** OPF adjust values for DrawingML `a:avLst` values (the inverse of `adjustToDrawingML`). */
export function adjustFromDrawingML(name: string, avLst: Readonly<Record<string, number>>): Record<string, number> {
  const shape = rawShape(name);
  const out: Record<string, number> = {};
  for (const [guide] of shape.avLst ?? []) {
    const value = avLst[guide];
    if (typeof value === "number" && Number.isFinite(value)) out[guide] = toOpf(value, adjustUnit(name, guide));
  }
  return out;
}

// --- the guide formula language (ECMA-376 Part 1, 20.1.9.11) ------------------------------------------------------------

type Values = Map<string, number>;

const RADIANS_PER_UNIT = Math.PI / (180 * DEGREE);

/** The built-in guides of a w by h shape (ECMA-376 Part 1, 20.1.9.11). */
function builtInGuides(w: number, h: number): Values {
  const ss = Math.min(w, h);
  const ls = Math.max(w, h);
  const values: [string, number][] = [
    ["w", w], ["h", h], ["l", 0], ["t", 0], ["r", w], ["b", h], ["hc", w / 2], ["vc", h / 2], ["ss", ss], ["ls", ls],
    ["wd2", w / 2], ["wd3", w / 3], ["wd4", w / 4], ["wd5", w / 5], ["wd6", w / 6], ["wd8", w / 8], ["wd10", w / 10], ["wd12", w / 12], ["wd32", w / 32],
    ["hd2", h / 2], ["hd3", h / 3], ["hd4", h / 4], ["hd5", h / 5], ["hd6", h / 6], ["hd8", h / 8], ["hd10", h / 10],
    ["ssd2", ss / 2], ["ssd4", ss / 4], ["ssd6", ss / 6], ["ssd8", ss / 8], ["ssd16", ss / 16], ["ssd32", ss / 32],
    ["cd2", 10800000], ["cd4", 5400000], ["cd8", 2700000], ["3cd4", 16200000], ["3cd8", 8100000], ["5cd8", 13500000], ["7cd8", 18900000],
  ];
  return new Map(values);
}

function operand(values: Values, token: string): number {
  const value = values.get(token);
  if (value !== undefined) return value;
  const number = Number(token);
  if (token !== "" && Number.isFinite(number)) return number;
  throw new Error(`unknown guide '${token}'`);
}

/**
 * Evaluates one DrawingML guide formula (such as `+- r 0 dx1`) against the guides defined so far. Angles are 60000ths of a
 * degree, as the standard writes them. Exported for tests and for hosts that evaluate their own `a:custGeom` guides.
 */
export function evaluateGuideFormula(formula: string, guides: ReadonlyMap<string, number> | Readonly<Record<string, number>>): number {
  const values: Values = guides instanceof Map ? (guides as Values) : new Map(Object.entries(guides as Record<string, number>));
  return evaluate(formula, values);
}

/** A zero divisor (a shape of zero width or height) gives 0, so a degenerate shape still evaluates to finite points. */
const divide = (numerator: number, divisor: number) => (divisor === 0 ? 0 : numerator / divisor);

function evaluate(formula: string, values: Values): number {
  const [op, ...args] = formula.trim().split(/\s+/);
  const a = (index: number) => {
    const token = args[index];
    if (token === undefined) throw new Error(`'${formula}': missing argument ${index + 1}`);
    return operand(values, token);
  };
  switch (op) {
    case "val":
      return a(0);
    case "*/":
      return divide(a(0) * a(1), a(2));
    case "+-":
      return a(0) + a(1) - a(2);
    case "+/":
      return divide(a(0) + a(1), a(2));
    case "?:":
      return a(0) > 0 ? a(1) : a(2);
    case "abs":
      return Math.abs(a(0));
    case "at2":
      return Math.atan2(a(1), a(0)) / RADIANS_PER_UNIT;
    case "cat2":
      return a(0) * Math.cos(Math.atan2(a(2), a(1)));
    case "cos":
      return a(0) * Math.cos(a(1) * RADIANS_PER_UNIT);
    case "max":
      return Math.max(a(0), a(1));
    case "min":
      return Math.min(a(0), a(1));
    case "mod":
      return Math.sqrt(a(0) * a(0) + a(1) * a(1) + a(2) * a(2));
    case "pin": {
      const low = a(0);
      const value = a(1);
      const high = a(2);
      return value < low ? low : Math.min(value, high);
    }
    case "sat2":
      return a(0) * Math.sin(Math.atan2(a(2), a(1)));
    case "sin":
      return a(0) * Math.sin(a(1) * RADIANS_PER_UNIT);
    case "sqrt":
      return Math.sqrt(Math.max(0, a(0)));
    case "tan":
      return a(0) * Math.tan(a(1) * RADIANS_PER_UNIT);
    default:
      throw new Error(`'${formula}': unknown operator '${op}'`);
  }
}

/** All guides of a preset at a size: built-ins, then avLst (OPF adjust values override the defaults), then gdLst. */
function shapeGuides(name: string, shape: RawShape, w: number, h: number, adjust: ShapeAdjustValues | undefined): Values {
  const values = builtInGuides(w, h);
  const overrides = adjustToDrawingML(name, adjust);
  for (const [guide, formula] of shape.avLst ?? []) values.set(guide, overrides[guide] ?? evaluate(formula, values));
  for (const [guide, formula] of shape.gdLst ?? []) values.set(guide, evaluate(formula, values));
  return values;
}

// --- paths -------------------------------------------------------------------------------------------------------------

type Segment =
  | { type: "M" | "L"; x: number; y: number }
  | { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: "Q"; x1: number; y1: number; x: number; y: number }
  | { type: "A"; rx: number; ry: number; sweep: 0 | 1; x: number; y: number; points: readonly { x: number; y: number }[]; cubics: readonly (readonly number[])[] }
  | { type: "Z" };

const fmt = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
};

function pathData(segments: readonly Segment[]): string {
  const parts: string[] = [];
  for (const s of segments) {
    switch (s.type) {
      case "M":
      case "L":
        parts.push(`${s.type}${fmt(s.x)} ${fmt(s.y)}`);
        break;
      case "C":
        parts.push(`C${fmt(s.x1)} ${fmt(s.y1)} ${fmt(s.x2)} ${fmt(s.y2)} ${fmt(s.x)} ${fmt(s.y)}`);
        break;
      case "Q":
        parts.push(`Q${fmt(s.x1)} ${fmt(s.y1)} ${fmt(s.x)} ${fmt(s.y)}`);
        break;
      case "A":
        for (const p of s.points) parts.push(`A${fmt(s.rx)} ${fmt(s.ry)} 0 0 ${s.sweep} ${fmt(p.x)} ${fmt(p.y)}`);
        break;
      case "Z":
        parts.push("Z");
        break;
    }
  }
  return parts.join(" ");
}

function commandsOf(segments: readonly Segment[]): ShapePathCommand[] {
  const out: ShapePathCommand[] = [];
  for (const s of segments) {
    if (s.type === "M" || s.type === "L") out.push([s.type, s.x, s.y]);
    else if (s.type === "C") out.push(["C", s.x1, s.y1, s.x2, s.y2, s.x, s.y]);
    else if (s.type === "Q") out.push(["Q", s.x1, s.y1, s.x, s.y]);
    else if (s.type === "A") for (const c of s.cubics) out.push(["C", c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, c[3] ?? 0, c[4] ?? 0, c[5] ?? 0]);
    else out.push(["Z"]);
  }
  return out;
}

/** The parametric angle (radians) of the point at visual angle `theta` on an ellipse with radii rx, ry, unwrapped to stay within a quarter turn of `theta`. */
function parametric(theta: number, rx: number, ry: number): number {
  if (rx === ry) return theta;
  const t = Math.atan2(rx * Math.sin(theta), ry * Math.cos(theta));
  let delta = t - theta;
  delta -= 2 * Math.PI * Math.round(delta / (2 * Math.PI));
  return theta + delta;
}

/**
 * DrawingML `arcTo` (ECMA-376 Part 1, 20.1.9.3), as PowerPoint draws it: the current point lies on an ellipse with radii
 * wR, hR at the visual angle stAng (the angle of the ray from the ellipse's center, not the parametric angle); the arc
 * sweeps swAng (positive is clockwise on screen) to the point at visual angle stAng + swAng. Computed in the path's own
 * coordinates, then scaled by (sx, sy).
 */
function arcSegment(
  current: { x: number; y: number },
  wR: number,
  hR: number,
  stAng: number,
  swAng: number,
  sx: number,
  sy: number,
): { segment: Segment; end: { x: number; y: number } } | undefined {
  const rx = Math.abs(wR);
  const ry = Math.abs(hR);
  const start = stAng * RADIANS_PER_UNIT;
  const end = (stAng + swAng) * RADIANS_PER_UNIT;
  // parametric() is continuous and monotone in the visual angle, so the sweep keeps its direction and its turns.
  const t0 = parametric(start, rx, ry);
  const t1 = parametric(end, rx, ry);
  // The center, the current point and the end point are in path units; the segment is scaled.
  const cx = current.x - rx * Math.cos(t0);
  const cy = current.y - ry * Math.sin(t0);
  const point = (t: number) => ({ x: (cx + rx * Math.cos(t)) * sx, y: (cy + ry * Math.sin(t)) * sy });
  const endPoint = point(t1);
  const endInPath = { x: cx + rx * Math.cos(t1), y: cy + ry * Math.sin(t1) };
  const sweepTotal = t1 - t0;
  if (sweepTotal === 0 || !Number.isFinite(sweepTotal)) return undefined;
  // Split into pieces of at most 90° (exact SVG arcs; cubic Béziers for `commands`).
  const pieces = Math.max(1, Math.ceil(Math.abs(sweepTotal) / (Math.PI / 2) - 1e-9));
  const step = sweepTotal / pieces;
  const cubics: number[][] = [];
  const points: { x: number; y: number }[] = [];
  const k = (4 / 3) * Math.tan(step / 4);
  for (let index = 0; index < pieces; index++) {
    const a0 = t0 + step * index;
    const a1 = index === pieces - 1 ? t1 : a0 + step;
    const p0 = point(a0);
    const p1 = point(a1);
    cubics.push([
      p0.x - k * rx * Math.sin(a0) * sx,
      p0.y + k * ry * Math.cos(a0) * sy,
      p1.x + k * rx * Math.sin(a1) * sx,
      p1.y - k * ry * Math.cos(a1) * sy,
      p1.x,
      p1.y,
    ]);
    points.push(p1);
  }
  const sweep: 0 | 1 = sweepTotal * Math.sign(sx * sy) > 0 ? 1 : 0;
  return { segment: { type: "A", rx: rx * Math.abs(sx), ry: ry * Math.abs(sy), sweep, x: endPoint.x, y: endPoint.y, points, cubics }, end: endInPath };
}

function presetPath(path: RawPath, values: Values, w: number, h: number): ShapePath {
  // A path with its own w and h is drawn in that coordinate space and scaled to the shape (ECMA-376 Part 1, 20.1.9.15).
  const sx = path.w ? w / path.w : 1;
  const sy = path.h ? h / path.h : 1;
  const v = (token: string | undefined) => operand(values, token ?? "");
  const segments: Segment[] = [];
  // The current point, in path units.
  let current = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  const pt = (x: string | undefined, y: string | undefined) => ({ x: v(x), y: v(y) });
  for (const command of path.commands) {
    const [type, ...args] = command;
    switch (type) {
      case "moveTo":
        current = pt(args[0], args[1]);
        start = current;
        segments.push({ type: "M", x: current.x * sx, y: current.y * sy });
        break;
      case "lnTo":
        current = pt(args[0], args[1]);
        segments.push({ type: "L", x: current.x * sx, y: current.y * sy });
        break;
      case "arcTo": {
        const arc = arcSegment(current, v(args[0]), v(args[1]), v(args[2]), v(args[3]), sx, sy);
        if (arc) {
          segments.push(arc.segment);
          current = arc.end;
        }
        break;
      }
      case "quadBezTo": {
        const c1 = pt(args[0], args[1]);
        current = pt(args[2], args[3]);
        segments.push({ type: "Q", x1: c1.x * sx, y1: c1.y * sy, x: current.x * sx, y: current.y * sy });
        break;
      }
      case "cubicBezTo": {
        const c1 = pt(args[0], args[1]);
        const c2 = pt(args[2], args[3]);
        current = pt(args[4], args[5]);
        segments.push({ type: "C", x1: c1.x * sx, y1: c1.y * sy, x2: c2.x * sx, y2: c2.y * sy, x: current.x * sx, y: current.y * sy });
        break;
      }
      case "close":
        segments.push({ type: "Z" });
        current = start;
        break;
      default:
        throw new Error(`unknown path command '${type}'`);
    }
  }
  return { d: pathData(segments), fill: path.fill ?? "norm", stroke: path.stroke ?? true, commands: commandsOf(segments) };
}

// --- presets -----------------------------------------------------------------------------------------------------------

function checkSize(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0)
    throw new RangeError(`A shape size must be finite and not negative (got ${width} by ${height}).`);
}

function axis(values: Values, name: string, adjust: string | undefined, min: string | undefined, max: string | undefined): ShapeHandleAxis | undefined {
  if (!adjust) return undefined;
  const unit = adjustUnit(name, adjust);
  const bound = (token: string | undefined) => {
    if (token === undefined) return null;
    const raw = operand(values, token);
    return Math.abs(raw) >= UNBOUNDED ? null : toOpf(raw, unit);
  };
  return { adjust, min: bound(min), max: bound(max) };
}

function handlesOf(name: string, shape: RawShape, values: Values): ShapeHandle[] {
  return (shape.ahLst ?? []).map((handle) => {
    const out: ShapeHandle = { kind: handle.type, x: operand(values, handle.pos[0]), y: operand(values, handle.pos[1]) };
    if (handle.type === "xy") {
      const horizontal = axis(values, name, handle.gdRefX, handle.minX, handle.maxX);
      const vertical = axis(values, name, handle.gdRefY, handle.minY, handle.maxY);
      if (horizontal) out.horizontal = horizontal;
      if (vertical) out.vertical = vertical;
    } else {
      const radius = axis(values, name, handle.gdRefR, handle.minR, handle.maxR);
      const angle = axis(values, name, handle.gdRefAng, handle.minAng, handle.maxAng);
      if (radius) out.radius = radius;
      if (angle) out.angle = angle;
    }
    return out;
  });
}

/**
 * The adjust values of a preset: each one's default and, from the handle that moves it, its range at the size asked for
 * (handle ranges can depend on the size; the default size is a square). OPF units: fractions and degrees (see the module
 * comment). A preset with no adjust values gives `{}`.
 */
export function presetAdjustments(name: string, width = 100, height = 100): Record<string, ShapeAdjustment> {
  const shape = rawShape(name);
  checkSize(width, height);
  const values = shapeGuides(name, shape, width, height, undefined);
  const ranges = new Map<string, ShapeHandleAxis>();
  for (const handle of handlesOf(name, shape, values))
    for (const entry of [handle.horizontal, handle.vertical, handle.radius, handle.angle]) if (entry) ranges.set(entry.adjust, entry);
  const out: Record<string, ShapeAdjustment> = {};
  for (const [guide, formula] of shape.avLst ?? []) {
    const unit = adjustUnit(name, guide);
    const range = ranges.get(guide);
    out[guide] = { default: toOpf(evaluate(formula, values), unit), min: range?.min ?? null, max: range?.max ?? null, unit };
  }
  return out;
}

/**
 * Evaluates a preset at a size: its paths as SVG path data (each with its DrawingML fill mode and stroke flag), its text
 * rectangle, its connection sites and its adjust handles, all in the units of `width` and `height`. `adjust` takes OPF
 * adjust values (fractions and degrees); values outside a handle's range are pinned by the preset's own guides, exactly
 * as PowerPoint pins them.
 */
export function presetGeometry(name: string, width: number, height: number, adjust?: ShapeAdjustValues): ShapeGeometry {
  const shape = rawShape(name);
  checkSize(width, height);
  const values = shapeGuides(name, shape, width, height, adjust);
  const paths = shape.pathLst.map((path) => presetPath(path, values, width, height));
  const rect = shape.rect;
  const textRect = rect
    ? (() => {
        const [l, t, r, b] = rect.map((token) => operand(values, token)) as [number, number, number, number];
        return { x: l, y: t, width: r - l, height: b - t };
      })()
    : { x: 0, y: 0, width, height };
  const connectionSites = (shape.cxnLst ?? []).map(([angle, x, y]) => ({
    x: operand(values, x),
    y: operand(values, y),
    angle: roundUnit(operand(values, angle) / DEGREE),
  }));
  return { paths, textRect, connectionSites, handles: handlesOf(name, shape, values) };
}

// --- custom outlines ---------------------------------------------------------------------------------------------------

/** An OPF custom outline: SVG path data in a 0 to 1 box, or in its `viewBox` (`"minX minY width height"` or four numbers). */
export type CustomPathInput = string | { d: string; viewBox?: string | readonly [number, number, number, number] };

function viewBoxOf(input: CustomPathInput): [number, number, number, number] {
  if (typeof input === "string" || input.viewBox === undefined) return [0, 0, 1, 1];
  const parts = typeof input.viewBox === "string" ? input.viewBox.trim().split(/[\s,]+/).map(Number) : [...input.viewBox];
  const [x, y, w, h] = parts as [number, number, number, number];
  if (parts.length !== 4 || ![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0)
    throw new RangeError(`A viewBox is four numbers with a positive width and height (got '${String(input.viewBox)}').`);
  return [x, y, w, h];
}

const PATH_ARITY: Readonly<Record<string, number>> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

function tokenizePath(d: string): { command: string; args: number[] }[] {
  const out: { command: string; args: number[] }[] = [];
  const token = /([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)|([\s,]+)|(.)/g;
  let current: { command: string; args: number[] } | undefined;
  let flagMode = false;
  for (const match of d.matchAll(token)) {
    if (match[4] !== undefined) throw new SyntaxError(`Unexpected '${match[4]}' in path data at ${match.index}.`);
    if (match[3] !== undefined) continue;
    if (match[1] !== undefined) {
      current = { command: match[1], args: [] };
      out.push(current);
      continue;
    }
    if (!current) throw new SyntaxError("Path data must start with a command (M).");
    let text = match[2] ?? "";
    // Arc flags may be written without separators ("a1 1 0 011 1").
    flagMode = current.command.toUpperCase() === "A";
    if (flagMode) {
      const position = current.args.length % 7;
      if ((position === 3 || position === 4) && /^[01]./.test(text)) {
        current.args.push(Number(text[0]));
        text = text.slice(1);
        const again = current.args.length % 7;
        if (again === 4 && /^[01]/.test(text)) {
          current.args.push(Number(text[0]));
          text = text.slice(1);
        }
        if (text === "") continue;
      }
    }
    current.args.push(Number(text));
  }
  return out;
}

/** SVG elliptical arc (endpoint form) to cubic Béziers, in the path's own coordinates (SVG 1.1 implementation notes F.6). */
function svgArcToCubics(x0: number, y0: number, rxIn: number, ryIn: number, rotation: number, large: number, sweep: number, x: number, y: number): number[][] {
  if (x0 === x && y0 === y) return [];
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) return [[x0, y0, x, y, x, y]];
  const phi = (rotation * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x0 - x) / 2;
  const dy = (y0 - y) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let coef = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) coef = -coef;
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x0 + x) / 2;
  const cy = sin * cxp + cos * cyp + (y0 + y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const pieces = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const step = delta / pieces;
  const k = (4 / 3) * Math.tan(step / 4);
  const at = (t: number) => ({ x: cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, y: cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos });
  const tangent = (t: number) => ({ x: -rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, y: -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos });
  const out: number[][] = [];
  for (let index = 0; index < pieces; index++) {
    const a0 = theta1 + step * index;
    const a1 = a0 + step;
    const p0 = at(a0);
    const p1 = index === pieces - 1 ? { x, y } : at(a1);
    const d0 = tangent(a0);
    const d1 = tangent(a1);
    out.push([p0.x + k * d0.x, p0.y + k * d0.y, p1.x - k * d1.x, p1.y - k * d1.y, p1.x, p1.y]);
  }
  return out;
}

/** SVG path data to absolute M, L, C, Q and Z commands in the path's own coordinates. */
function normalizePath(d: string): ShapePathCommand[] {
  const out: ShapePathCommand[] = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let lastControl: { x: number; y: number; kind: "C" | "Q" } | undefined;
  for (const { command, args } of tokenizePath(d)) {
    const upper = command.toUpperCase();
    const relative = command !== upper;
    const arity = PATH_ARITY[upper] ?? 0;
    if (arity === 0) {
      if (args.length) throw new SyntaxError(`'${command}' takes no numbers.`);
      out.push(["Z"]);
      x = startX;
      y = startY;
      lastControl = undefined;
      continue;
    }
    if (args.length === 0 || args.length % arity !== 0 || args.some((value) => !Number.isFinite(value)))
      throw new SyntaxError(`'${command}' needs numbers in groups of ${arity}.`);
    for (let index = 0; index < args.length; index += arity) {
      const n = args.slice(index, index + arity) as number[];
      const ox = relative ? x : 0;
      const oy = relative ? y : 0;
      const at = (i: number) => n[i] ?? 0;
      let kind = upper;
      if (kind === "M" && index > 0) kind = "L";
      switch (kind) {
        case "M":
          x = at(0) + ox;
          y = at(1) + oy;
          startX = x;
          startY = y;
          out.push(["M", x, y]);
          lastControl = undefined;
          break;
        case "L":
        case "H":
        case "V":
          if (kind === "L") {
            x = at(0) + ox;
            y = at(1) + oy;
          } else if (kind === "H") x = at(0) + (relative ? x : 0);
          else y = at(0) + (relative ? y : 0);
          out.push(["L", x, y]);
          lastControl = undefined;
          break;
        case "C":
        case "S": {
          let x1: number;
          let y1: number;
          let rest: number[];
          if (kind === "C") {
            x1 = at(0) + ox;
            y1 = at(1) + oy;
            rest = n.slice(2);
          } else {
            x1 = lastControl?.kind === "C" ? 2 * x - lastControl.x : x;
            y1 = lastControl?.kind === "C" ? 2 * y - lastControl.y : y;
            rest = n;
          }
          const x2 = (rest[0] ?? 0) + ox;
          const y2 = (rest[1] ?? 0) + oy;
          x = (rest[2] ?? 0) + ox;
          y = (rest[3] ?? 0) + oy;
          out.push(["C", x1, y1, x2, y2, x, y]);
          lastControl = { x: x2, y: y2, kind: "C" };
          break;
        }
        case "Q":
        case "T": {
          let x1: number;
          let y1: number;
          if (kind === "Q") {
            x1 = at(0) + ox;
            y1 = at(1) + oy;
            x = at(2) + ox;
            y = at(3) + oy;
          } else {
            x1 = lastControl?.kind === "Q" ? 2 * x - lastControl.x : x;
            y1 = lastControl?.kind === "Q" ? 2 * y - lastControl.y : y;
            x = at(0) + ox;
            y = at(1) + oy;
          }
          out.push(["Q", x1, y1, x, y]);
          lastControl = { x: x1, y: y1, kind: "Q" };
          break;
        }
        case "A": {
          const ex = at(5) + ox;
          const ey = at(6) + oy;
          for (const c of svgArcToCubics(x, y, at(0), at(1), at(2), at(3), at(4), ex, ey))
            out.push(["C", c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, c[3] ?? 0, c[4] ?? 0, c[5] ?? 0]);
          x = ex;
          y = ey;
          lastControl = undefined;
          break;
        }
      }
    }
  }
  if (out.length && out[0]?.[0] !== "M") throw new SyntaxError("Path data must start with a move (M).");
  return out;
}

function commandData(commands: readonly ShapePathCommand[]): string {
  return commands
    .map((c) => (c[0] === "Z" ? "Z" : `${c[0]}${c.slice(1).map((value) => fmt(value as number)).join(" ")}`))
    .join(" ");
}

/**
 * Evaluates an OPF custom outline (`path`): SVG path data in a 0 to 1 box (or in its viewBox), scaled to width by height.
 * The result has the shape of `presetGeometry`'s: one filled and stroked path (arcs as cubic Béziers, so a non-uniform
 * scale stays exact), the whole box as the text rectangle, and the four edge midpoints as connection sites (top, left,
 * bottom, right, as DrawingML's rect).
 */
export function customGeometry(pathData: CustomPathInput, width: number, height: number): ShapeGeometry {
  checkSize(width, height);
  const d = typeof pathData === "string" ? pathData : pathData?.d;
  if (typeof d !== "string" || d.trim() === "") throw new SyntaxError("A custom outline needs SVG path data.");
  const [vx, vy, vw, vh] = viewBoxOf(pathData);
  const sx = width / vw;
  const sy = height / vh;
  const map = (px: number, py: number): [number, number] => [(px - vx) * sx, (py - vy) * sy];
  const commands: ShapePathCommand[] = normalizePath(d).map((c) => {
    switch (c[0]) {
      case "M":
      case "L":
        return [c[0], ...map(c[1], c[2])];
      case "C":
        return ["C", ...map(c[1], c[2]), ...map(c[3], c[4]), ...map(c[5], c[6])];
      case "Q":
        return ["Q", ...map(c[1], c[2]), ...map(c[3], c[4])];
      default:
        return ["Z"];
    }
  });
  return {
    paths: [{ d: commandData(commands), fill: "norm", stroke: true, commands }],
    textRect: { x: 0, y: 0, width, height },
    connectionSites: [
      { x: width / 2, y: 0, angle: 270 },
      { x: 0, y: height / 2, angle: 180 },
      { x: width / 2, y: height, angle: 90 },
      { x: width, y: height / 2, angle: 0 },
    ],
    handles: [],
  };
}

// --- helpers for engines and tests ------------------------------------------------------------------------------------

/** Flattens path commands to polylines (one per subpath), `segments` points per curve. */
export function flattenShapePath(commands: readonly ShapePathCommand[], segments = 16): { x: number; y: number }[][] {
  const lines: { x: number; y: number }[][] = [];
  let line: { x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  let start = { x: 0, y: 0 };
  for (const c of commands) {
    if (c[0] === "M") {
      if (line.length) lines.push(line);
      x = c[1];
      y = c[2];
      start = { x, y };
      line = [{ x, y }];
    } else if (c[0] === "L") {
      x = c[1];
      y = c[2];
      line.push({ x, y });
    } else if (c[0] === "C" || c[0] === "Q") {
      for (let index = 1; index <= segments; index++) {
        const t = index / segments;
        const u = 1 - t;
        if (c[0] === "C")
          line.push({
            x: u * u * u * x + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t * c[5],
            y: u * u * u * y + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6],
          });
        else line.push({ x: u * u * x + 2 * u * t * c[1] + t * t * c[3], y: u * u * y + 2 * u * t * c[2] + t * t * c[4] });
      }
      x = c[0] === "C" ? c[5] : c[3];
      y = c[0] === "C" ? c[6] : c[4];
    } else {
      line.push({ ...start });
      x = start.x;
      y = start.y;
      lines.push(line);
      line = [{ x, y }];
    }
  }
  if (line.length > 1) lines.push(line);
  return lines;
}
