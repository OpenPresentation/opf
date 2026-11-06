/**
 * Overlay shapes and connectors (shapes SH-04): a slide's `shapes` array, drawn over the composed slide in array order (later entries on
 * top), above the content and the furniture. Nothing here moves content: the overlay is placed against the slide's final composition.
 *
 * - An overlay shape has the shape block vocabulary of SH-02 and one placement: `x`, `y`, `width`, `height` (fractions of the slide; `x`
 *   from the right edge in a right-to-left deck) or `at` (outside an edge of a composed block, or on its center). It composes through
 *   SH-02's `composeShape`, and its text is fitted by composition as a shape block's is, so engines draw it with the shape block's code.
 * - A connector joins two ends (blocks or overlay shapes) at connection sites: a preset's own (SH-01's `connectionSites`, turned and flipped
 *   with the shape) or a rectangle's four edge midpoints. Core routes it once as PowerPoint's connector presets (`straightConnector1`,
 *   `bentConnector2`/`bentConnector3`, `curvedConnector2`/`curvedConnector3`) with their `a:xfrm` (box, rotation, flips) and `a:avLst`, and
 *   evaluates the preset's own path through that transform, so the preview draws exactly the line PowerPoint draws from the export.
 *
 * The text fitter comes from composition (`composeOverlayShapes`' `item` callback), so this module imports composition's types only.
 */
import type { ComposedItem, LayoutBox, SlideComposition } from './composition.js';
import { composeShape, composeStroke, isPresetShape, pathEnds, presetAspect, sketchStroke, type ComposedShape, type ComposedShapePath, type ComposedStroke, type ShapeEnd } from './shape-block.js';
import type { ShapePathCommand } from './shape-geometry.js';
import { shapeGeometry } from '#shape-engine';

type Rec = Record<string, any>;
interface Point { x: number; y: number }
const record = (value: unknown): Rec => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Rec : {};
const finite = (value: unknown, min: number, max: number): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : undefined;
const round = (value: number) => Math.round(value * 1e6) / 1e6 || 0;
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** The routes of a connector (`connector.route`). */
export const CONNECTOR_ROUTES = ['straight', 'elbow', 'curved'] as const;
export type ConnectorRoute = typeof CONNECTOR_ROUTES[number];
/** The DrawingML connector presets core routes with: one segment, an elbow of two or three segments, a curve of one or two cubics. */
export type ConnectorPreset = 'straightConnector1' | 'bentConnector2' | 'bentConnector3' | 'curvedConnector2' | 'curvedConnector3';
/** A connector's default line width, in reference pixels (1.5 pt). */
export const CONNECTOR_STROKE_WIDTH = 2;
/** A connector's default line color: the slide's text color, which reads on the slide's background. */
export const CONNECTOR_STROKE_COLOR = 'text';
/**
 * How far an elbow or curved connector runs past a shape before it turns back, in reference pixels, when both ends face the same way (a U
 * route) or a site faces away from the other end.
 */
export const CONNECTOR_STANDOFF = 24;
/** An `at` shape's default shorter side: this share of the block's shorter side. */
export const OVERLAY_ANCHOR_SHARE = 0.15;
/** The edges of `at`. */
export const OVERLAY_EDGES = ['top', 'bottom', 'start', 'end', 'center'] as const;
export type OverlayEdge = typeof OVERLAY_EDGES[number];

/** Whether a `shapes` entry is a connector (it has `connector`); every other entry is an overlay shape. */
export const isOverlayConnector = (entry: unknown): boolean => record(entry).connector !== undefined;
/**
 * The preset whose adjust values a connector's `adjust` names: `bentConnector3` for an elbow, `curvedConnector3` for a curve (their
 * `adj1`; the two-segment presets between perpendicular sites have none), `straightConnector1` (none) for a straight line.
 */
export function connectorAdjustPreset(entry: unknown): 'straightConnector1' | 'bentConnector3' | 'curvedConnector3' {
  const route = record(record(entry).connector).route;
  return route === 'elbow' ? 'bentConnector3' : route === 'curved' ? 'curvedConnector3' : 'straightConnector1';
}
/** Whether a slide has overlay shapes or connectors to compose. */
export const hasOverlayShapes = (slide: unknown): boolean => Array.isArray(record(slide).shapes) && (record(slide).shapes as unknown[]).some(entry => entry !== null && typeof entry === 'object');

// --- connection sites -------------------------------------------------------------------------------------------------

/** A connection site in slide coordinates: the point and the direction (degrees clockwise from +x, y down) a connector leaves it. */
export interface ConnectionSite { x: number; y: number; angle: number }

const normalize = (angle: number) => round(((angle % 360) + 360) % 360);
/** The four sites of a rectangle (DrawingML's rect: 0 top, 1 left, 2 bottom, 3 right), for a block that is not a shape. */
export function rectSites(box: LayoutBox): ConnectionSite[] {
  const cx = round(box.x + box.width / 2), cy = round(box.y + box.height / 2);
  return [{ x: cx, y: round(box.y), angle: 270 }, { x: round(box.x), y: cy, angle: 180 }, { x: cx, y: round(box.y + box.height), angle: 90 }, { x: round(box.x + box.width), y: cy, angle: 0 }];
}

/** Sites given in a frame's own coordinates (0,0 its top-left corner), placed at `box`, flipped and then rotated about its center as DrawingML draws a shape. */
function placeSites(sites: readonly ConnectionSite[], box: LayoutBox, rotate = 0, flipH = false, flipV = false): ConnectionSite[] {
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2, radians = rotate * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  return sites.map(site => {
    let u = site.x - box.width / 2, v = site.y - box.height / 2, angle = site.angle;
    if (flipH) { u = -u; angle = 180 - angle; }
    if (flipV) { v = -v; angle = -angle; }
    return { x: round(cx + u * cos - v * sin), y: round(cy + u * sin + v * cos), angle: normalize(angle + rotate) };
  });
}

/**
 * The connection sites of a composed shape (a shape block's `ComposedItem.shape` or an overlay shape's) in slide coordinates: the preset's
 * own (SH-01 `presetGeometry(...).connectionSites` at the frame's size with its adjust values) or a custom path's four edge midpoints, turned
 * and flipped with the shape. Undefined while the preset geometry is loading (a browser before `ensureShapes`).
 */
export function shapeSites(shape: ComposedShape): ConnectionSite[] | undefined {
  const engine = shapeGeometry();
  if (!engine) return undefined;
  const width = Math.max(shape.box.width, 1e-6), height = Math.max(shape.box.height, 1e-6);
  let sites: readonly ConnectionSite[];
  try { sites = shape.preset ? engine.presetGeometry(shape.preset, width, height, shape.adjust).connectionSites : engine.customGeometry(shape.custom!, width, height).connectionSites; }
  catch { sites = engine.presetGeometry('rect', width, height).connectionSites; }
  return placeSites(sites, shape.box, shape.rotate ?? 0, shape.flipH === true, shape.flipV === true);
}

/** The sites of a picture masked by a preset (its frame's geometry, which PowerPoint glues a connector to), else undefined. */
function maskSites(preset: string, avLst: Record<string, number>, box: LayoutBox): ConnectionSite[] | undefined {
  const engine = shapeGeometry();
  if (!engine || !isPresetShape(preset) || preset === 'rect') return undefined;
  const width = Math.max(box.width, 1e-6), height = Math.max(box.height, 1e-6);
  try { return placeSites(engine.presetGeometry(preset, width, height, engine.adjustFromDrawingML(preset, avLst)).connectionSites, box); }
  catch { return undefined; }
}

// --- routes ---------------------------------------------------------------------------------------------------------

/**
 * A connector's frame as DrawingML writes it (`a:xfrm`): the unrotated `box` (`a:off`, `a:ext`), the rotation and the flips. The preset's
 * path is evaluated in a box of the frame's size and mapped through `frameToSlide`, flipped first and then rotated about the box's center.
 */
export interface ConnectorFrame { box: LayoutBox; rotate: 0 | 90 | 270; flipH: boolean; flipV: boolean }

/** A point of a frame's own coordinates (0,0 the frame's top-left corner before the flips and the rotation) in slide coordinates. */
export function frameToSlide(frame: ConnectorFrame, x: number, y: number): Point {
  const { box } = frame, radians = frame.rotate * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  let u = x - box.width / 2, v = y - box.height / 2;
  if (frame.flipH) u = -u;
  if (frame.flipV) v = -v;
  return { x: box.x + box.width / 2 + u * cos - v * sin, y: box.y + box.height / 2 + u * sin + v * cos };
}
/** The inverse of `frameToSlide`. */
function slideToFrame(frame: ConnectorFrame, point: Point): Point {
  const { box } = frame, radians = -frame.rotate * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  const dx = point.x - box.x - box.width / 2, dy = point.y - box.y - box.height / 2;
  let u = dx * cos - dy * sin, v = dx * sin + dy * cos;
  if (frame.flipH) u = -u;
  if (frame.flipV) v = -v;
  return { x: u + box.width / 2, y: v + box.height / 2 };
}
const close = (a: Point, b: Point) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
/**
 * The frame whose preset path runs from `start` (its local 0,0) to `end` (its local width,height), its first segment along the x axis
 * (horizontal) or, turned 90 or 270 degrees, along the y axis (vertical), as PowerPoint writes its connectors: flips for a route that runs
 * left or up, a quarter turn for one that leaves its start vertically.
 */
function connectorFrame(start: Point, end: Point, vertical: boolean): ConnectorFrame {
  if (!vertical) return { box: { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) }, rotate: 0, flipH: start.x > end.x, flipV: start.y > end.y };
  const width = Math.abs(end.y - start.y), height = Math.abs(end.x - start.x), cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2;
  const box = { x: cx - width / 2, y: cy - height / 2, width, height };
  for (const rotate of [90, 270] as const) for (const [flipH, flipV] of [[false, false], [true, false], [false, true], [true, true]] as const) {
    const frame: ConnectorFrame = { box, rotate, flipH, flipV };
    if (close(frameToSlide(frame, 0, 0), start) && close(frameToSlide(frame, width, height), end)) return frame;
  }
  return { box, rotate: 90, flipH: false, flipV: false };
}

/** A routed connector: its preset, frame, adjust values (OPF fractions and DrawingML integers) and its path in slide coordinates. */
export interface ConnectorRouteGeometry {
  preset: ConnectorPreset;
  frame: ConnectorFrame;
  /** OPF units (fractions of the frame's width), as `a:avLst` divides them: `{ adj1: 0.5 }`. */
  adjust: Record<string, number>;
  /** The same in DrawingML's integers (100000ths). */
  avLst: Record<string, number>;
  /** The route as SVG path data in slide coordinates (absolute M, L and C commands). */
  d: string;
  /** The route's two ends, each with the direction (degrees) a line leaves the path there, for arrowheads. */
  ends?: { start: ShapeEnd; end: ShapeEnd };
  /** The route's length along its segments (curves along their elbow), and whether it leaves each site outward and enters the far one from outside. */
  length: number;
  proper: boolean;
  /** The bounds of the route (a U route reaches past its frame). */
  bounds: LayoutBox;
}

const axisOf = (angle: number): Point => {
  const quarter = ((Math.round(angle / 90) % 4) + 4) % 4;
  return [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }][quarter]!;
};
const unit = (angle: number): Point => ({ x: Math.cos(angle * Math.PI / 180), y: Math.sin(angle * Math.PI / 180) });
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const number = (value: number) => String(Math.round(value * 1000) / 1000 || 0);
/** Whether a site's direction is a multiple of 90 degrees (an elbow or curve can leave it along an axis). */
const onAxis = (angle: number) => Math.abs(angle / 90 - Math.round(angle / 90)) < 1 / 90;

/**
 * The route of a connector from site `from` to site `to` (slide coordinates), as PowerPoint's preset for `route`. `scale` is canvas pixels
 * per reference pixel (min(width, height) / 720). Undefined while the preset geometry is loading.
 *
 * - straight: `straightConnector1` from one site to the other.
 * - elbow: between sites along the same axis `bentConnector3`, its middle segment halfway between the sites (`adj1` 0.5 of the frame) or,
 *   when both face the same way, CONNECTOR_STANDOFF past the farther one (adj1 beyond 0 to 1, a U); between perpendicular sites
 *   `bentConnector2`, an L through the corner. The sites' directions are taken to the nearest axis.
 * - curved: the same as `curvedConnector3` and `curvedConnector2`: the curve through the elbow's middle line, tangent to the sites' axes.
 *
 * `own` is the connector's authored `adjust` (OPF units): its `adj1` replaces the automatic middle of a three-segment route.
 */
export function connectorRoute(route: ConnectorRoute, from: ConnectionSite, to: ConnectionSite, scale = 1, own?: Record<string, number>): ConnectorRouteGeometry | undefined {
  const engine = shapeGeometry();
  if (!engine) return undefined;
  const start: Point = { x: from.x, y: from.y };
  let end: Point = { x: to.x, y: to.y };
  let preset: ConnectorPreset, frame: ConnectorFrame, middle: Point | undefined, proper: boolean, length: number;
  if (route === 'straight') {
    preset = 'straightConnector1';
    frame = connectorFrame(start, end, false);
    const toward = sub(end, start);
    proper = dot(unit(from.angle), toward) > 1e-9 && dot(unit(to.angle), toward) < -1e-9;
    length = distance(start, end);
  } else {
    const d0 = axisOf(from.angle), d1 = axisOf(to.angle), horizontal = d0.x !== 0, standoff = CONNECTOR_STANDOFF * scale;
    if ((d1.x !== 0) === horizontal) {
      preset = route === 'elbow' ? 'bentConnector3' : 'curvedConnector3';
      const along = (point: Point) => horizontal ? point.x : point.y, sign = horizontal ? d0.x : d0.y;
      // A frame with no length along the start axis has no adj1 to place the middle by: the far end moves a hundredth of a pixel.
      if (Math.abs(along(end) - along(start)) < 0.01 * scale) end = horizontal ? { x: start.x + sign * 0.01 * scale, y: end.y } : { x: end.x, y: start.y + sign * 0.01 * scale };
      const ahead = (along(end) - along(start)) * sign, opposite = dot(d0, d1) < 0;
      const at = opposite ? along(start) + sign * (ahead > 0 ? ahead / 2 : standoff) : sign > 0 ? Math.max(along(start), along(end)) + standoff : Math.min(along(start), along(end)) - standoff;
      proper = !opposite || ahead > 0;
      middle = horizontal ? { x: at, y: start.y } : { x: start.x, y: at };
      frame = connectorFrame(start, end, !horizontal);
      const far = horizontal ? { x: at, y: end.y } : { x: end.x, y: at };
      length = distance(start, middle) + distance(middle, far) + distance(far, end);
    } else {
      preset = route === 'elbow' ? 'bentConnector2' : 'curvedConnector2';
      const corner = horizontal ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
      proper = dot(d0, sub(corner, start)) > 1e-9 && dot(d1, sub(corner, end)) > 1e-9;
      frame = connectorFrame(start, end, !horizontal);
      length = distance(start, corner) + distance(corner, end);
    }
  }
  const width = frame.box.width, height = frame.box.height;
  const adjust: Record<string, number> = {}, avLst: Record<string, number> = {};
  if (middle) {
    // The author's adj1 (a route kept from PowerPoint) replaces the automatic middle.
    const authored = own && typeof own.adj1 === 'number' && Number.isFinite(own.adj1) ? own.adj1 : undefined;
    avLst.adj1 = Math.round((authored ?? slideToFrame(frame, middle).x / Math.max(width, 1e-9)) * 100000);
    adjust.adj1 = avLst.adj1 / 100000;
  }
  // The preset's own path (SH-01) at the frame's size with the rounded value the export writes, mapped through the frame: one geometry.
  const geometry = engine.presetGeometry(preset, Math.max(width, 1e-9), Math.max(height, 1e-9), adjust);
  const commands: ShapePathCommand[] = (geometry.paths[0]?.commands ?? []).map(command => {
    if (command[0] === 'Z') return command;
    const values = command.slice(1) as number[], mapped: number[] = [];
    for (let index = 0; index + 1 < values.length; index += 2) { const point = frameToSlide(frame, values[index]!, values[index + 1]!); mapped.push(round(point.x), round(point.y)); }
    return [command[0], ...mapped] as unknown as ShapePathCommand;
  });
  const d = commands.map(command => [command[0], ...(command.slice(1) as number[]).map(number)].join(' ')).join(' ');
  const ends = pathEnds(commands, 0, 0);
  const points = commands.flatMap(command => { const values = command.slice(1) as number[], out: Point[] = []; for (let index = 0; index + 1 < values.length; index += 2) out.push({ x: values[index]!, y: values[index + 1]! }); return out; });
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  const bounds = points.length ? { x: round(Math.min(...xs)), y: round(Math.min(...ys)), width: round(Math.max(...xs) - Math.min(...xs)), height: round(Math.max(...ys) - Math.min(...ys)) } : { x: start.x, y: start.y, width: 0, height: 0 };
  return {
    preset, frame: { ...frame, box: { x: round(frame.box.x), y: round(frame.box.y), width: round(width), height: round(height) } }, adjust, avLst, d,
    ...(ends ? { ends } : {}), length: round(length), proper, bounds,
  };
}

/**
 * The sites a connector joins: `fromSite` and `toSite` where given and in range, else the pair whose route is best: sites that face each
 * other (opposite directions) with a proper route (leaving each site outward), then any proper route, then any; the shortest of those.
 * An elbow or curve considers only sites along an axis when the shape has some. `same` is true when both ends are one shape (no site joins itself).
 */
export function chooseConnectorSites(route: ConnectorRoute, fromSites: readonly ConnectionSite[], toSites: readonly ConnectionSite[], options: { fromSite?: number; toSite?: number; scale?: number; same?: boolean } = {}): { from: number; to: number; geometry: ConnectorRouteGeometry } | undefined {
  const usable = (sites: readonly ConnectionSite[], fixed: number | undefined): number[] => {
    if (fixed !== undefined && Number.isInteger(fixed) && fixed >= 0 && fixed < sites.length) return [fixed];
    const all = sites.map((_, index) => index);
    if (route === 'straight') return all;
    const axis = all.filter(index => onAxis(sites[index]!.angle));
    return axis.length ? axis : all;
  };
  let best: { from: number; to: number; geometry: ConnectorRouteGeometry; rank: number } | undefined;
  for (const i of usable(fromSites, options.fromSite)) for (const j of usable(toSites, options.toSite)) {
    if (options.same && i === j) continue;
    const a = fromSites[i]!, b = toSites[j]!, geometry = connectorRoute(route, a, b, options.scale ?? 1);
    if (!geometry) return undefined;
    const turn = Math.abs((((a.angle - b.angle) % 360) + 360) % 360 - 180), facing = route === 'straight' ? turn < 1 : (() => { const d0 = axisOf(a.angle), d1 = axisOf(b.angle); return d0.x === -d1.x && d0.y === -d1.y; })();
    const rank = geometry.proper ? (facing ? 0 : 1) : 2;
    if (!best || rank < best.rank || (rank === best.rank && geometry.length < best.geometry.length - 1e-6)) best = { from: i, to: j, geometry, rank };
  }
  return best && { from: best.from, to: best.to, geometry: best.geometry };
}

// --- the composed overlay -------------------------------------------------------------------------------------------

/**
 * An overlay shape (`SlideComposition.overlayShapes`, `kind` shape): a shape block item (`field` shape) whose `shape` is SH-02's
 * ComposedShape, so engines draw it with the shape block's drawing; `path` is `slides.N.shapes.I`.
 */
export interface ComposedOverlayShape extends ComposedItem {
  kind: 'shape';
  field: 'shape';
  shape: ComposedShape;
  /** The entry's index in the slide's `shapes`. */
  index: number;
  id?: string;
  /** For a shape placed by `at`: the block it follows (its id, the composed path of what it attaches to) and the physical edge. */
  attachedTo?: { id: string; ref: string; edge: 'top' | 'bottom' | 'left' | 'right' | 'center' };
  /** `front` (the default): over the slide, after its content and furniture; `back`: behind it, after the background and watermark, before the content. */
  layer: OverlayLayer;
}
/** The layers of overlay shapes (`layer`). Connectors are always in front. */
export const OVERLAY_LAYERS = ['front', 'back'] as const;
export type OverlayLayer = typeof OVERLAY_LAYERS[number];

/** One end of a connector. */
export interface ConnectorEnd {
  /** The id the connector names. */
  id: string;
  /**
   * What the end attaches to: the composed item path of a block (`slides.0.blocks.1.shape`, the item the PPTX export writes as one native
   * shape), a group's path (`slides.0.blocks.2`), or an overlay shape's path (`slides.0.shapes.3`).
   */
  ref: string;
  /** `block` (a composed item), `group` (a group's box) or `shape` (an overlay shape). */
  target: 'block' | 'group' | 'shape';
  /** The connection site index (DrawingML's cxn idx) and the site. */
  site: number;
  point: Point;
  angle: number;
}

/**
 * A connector (`SlideComposition.overlayShapes`, `kind` connector): its route as PowerPoint's connector preset in its `a:xfrm` frame,
 * and the same route evaluated in slide coordinates (`paths[0]`, an open path with its ends), which engines stroke with SH-02's stroke
 * drawing (dash, compound, sketch and arrowheads).
 */
export interface ComposedConnector {
  kind: 'connector';
  /** `slides.N.shapes.I`. */
  path: string;
  index: number;
  id?: string;
  route: ConnectorRoute;
  preset: ConnectorPreset;
  /** The unrotated frame (`a:off`, `a:ext`); `rotate`, `flipH` and `flipV` place the preset's path in it, as DrawingML does. */
  box: LayoutBox;
  rotate?: 90 | 270;
  flipH?: true;
  flipV?: true;
  /** OPF adjust values (fractions of the frame's width) and the same as DrawingML's `a:avLst` integers. */
  adjust: Record<string, number>;
  avLst: Record<string, number>;
  /** The route in slide coordinates: one open path (fill none) with its ends, as a shape's paths. Empty while the geometry loads. */
  paths: ComposedShapePath[];
  /** The bounds of the route. */
  bounds: LayoutBox;
  from: ConnectorEnd;
  to: ConnectorEnd;
  stroke?: ComposedStroke;
  alt?: string;
  decorative?: true;
  hidden?: true;
}
/** An entry of `SlideComposition.overlayShapes`, in draw order. */
export type ComposedOverlayEntry = ComposedOverlayShape | ComposedConnector;

/** The promoted region keys of a slide (`left`, `center+right`, `top:left` ...), whose payloads are blocks too. */
const REGION_KEY = /^(?:(?:top|middle|bottom)(?:\+(?:middle|bottom))*(?::(?:left|center|right)(?:\+(?:center|right))*)?|(?:left|center|right)(?:\+(?:center|right))*)$/;

/** Every block id of a slide with its dotted path (`slides.0.blocks.1.blocks.0`), in document order; the first of a repeated id wins. */
export function slideBlockIds(slide: unknown, slidePath: string): Map<string, string> {
  const ids = new Map<string, string>();
  const walk = (payload: Rec, path: string, depth: number) => {
    if (depth > 64) return;
    if (nonEmpty(payload.id) && !ids.has(payload.id)) ids.set(payload.id, path);
    if (Array.isArray(payload.blocks)) payload.blocks.forEach((block: unknown, index: number) => { if (block !== null && typeof block === 'object') walk(record(block), `${path}.blocks.${index}`, depth + 1); });
  };
  const value = record(slide);
  if (Array.isArray(value.blocks)) value.blocks.forEach((block: unknown, index: number) => { if (block !== null && typeof block === 'object') walk(record(block), `${slidePath}.blocks.${index}`, 0); });
  for (const key of Object.keys(value)) if (REGION_KEY.test(key) && value[key] !== null && typeof value[key] === 'object' && !Array.isArray(value[key])) walk(record(value[key]), `${slidePath}.${key}`, 0);
  return ids;
}

/** A composed block an overlay attaches to: the item path (or group path), its visible box and its connection sites. */
interface BlockTarget { ref: string; target: 'block' | 'group'; box: LayoutBox; sites: () => ConnectionSite[] | undefined }
function blockTarget(composition: SlideComposition, blockPath: string): BlockTarget | undefined {
  const group = composition.groups.find(entry => entry.path === blockPath);
  const prefix = `${blockPath}.`;
  const items = composition.items.filter(item => item.path.startsWith(prefix) && !item.path.slice(prefix.length).startsWith('blocks.'));
  if (group) return { ref: group.path, target: 'group', box: { ...group.box }, sites: () => rectSites(group.box) };
  if (!items.length) return undefined;
  const visible = (item: ComposedItem): LayoutBox => item.frameBox ?? item.shape?.box ?? item.image?.box ?? item.box;
  const first = items[0]!;
  if (items.length === 1 && first.shape) return { ref: first.path, target: 'block', box: { ...first.shape.box }, sites: () => shapeSites(first.shape!) };
  if (items.length === 1 && first.image && !first.frameBox) {
    const image = first.image;
    return { ref: first.path, target: 'block', box: { ...image.box }, sites: () => maskSites(image.shape.preset, image.shape.adjust, image.box) ?? rectSites(image.box) };
  }
  const boxes = items.map(visible), x = Math.min(...boxes.map(box => box.x)), y = Math.min(...boxes.map(box => box.y));
  const box = { x: round(x), y: round(y), width: round(Math.max(...boxes.map(entry => entry.x + entry.width)) - x), height: round(Math.max(...boxes.map(entry => entry.y + entry.height)) - y) };
  return { ref: first.path, target: 'block', box, sites: () => rectSites(box) };
}

/** What composition gives an overlay shape item besides its geometry: the fitted text (in `shape.textBox`), its style and the composition settings. */
export type OverlayShapeItemFields = Pick<ComposedItem, 'text' | 'textStyle' | 'composition'>;

/**
 * The overlay of a slide (`SlideComposition.overlayShapes`), placed on its final composition: overlay shapes by fractions of the slide or
 * against a composed block, then connectors between blocks and overlay shapes. An entry whose block, or connector end, is not composed on
 * the slide is left out (validation reports opf/shape-anchor-missing and opf/connector-end-missing). `item` fits an overlay shape's text
 * as composition fits a shape block's.
 */
export function composeOverlayShapes(slide: unknown, composition: SlideComposition, context: { path: string; scale: number; rtl: boolean; item: (host: Rec, shape: ComposedShape, path: string) => OverlayShapeItemFields }): ComposedOverlayEntry[] {
  const entries = Array.isArray(record(slide).shapes) ? record(slide).shapes as unknown[] : [];
  if (!entries.length) return [];
  const { scale, rtl } = context, width = composition.width, height = composition.height;
  const blockIds = slideBlockIds(slide, context.path);
  const targets = new Map<string, BlockTarget | undefined>();
  const blockOf = (id: string): BlockTarget | undefined => {
    if (!targets.has(id)) { const path = blockIds.get(id); targets.set(id, path === undefined ? undefined : blockTarget(composition, path)); }
    return targets.get(id);
  };
  const shapes = new Map<number, ComposedOverlayShape>();
  const shapeIds = new Map<string, number>();
  entries.forEach((entry, index) => {
    const host = record(entry);
    if (!Object.keys(host).length || isOverlayConnector(host)) return;
    const path = `${context.path}.shapes.${index}`;
    const placed = overlayBox(host, { width, height, scale, rtl, blockOf });
    if (!placed) return;
    const shape = composeShape(host, placed.box, { scale, aspect: 0 });
    const item: ComposedOverlayShape = {
      kind: 'shape', index, ...(nonEmpty(host.id) ? { id: host.id } : {}), path, field: 'shape', type: 'shape', value: host.text, payload: host, box: { ...shape.box }, shape,
      ...context.item(host, shape, path), alignment: 'center', ...(placed.attachedTo ? { attachedTo: placed.attachedTo } : {}), layer: host.layer === 'back' ? 'back' : 'front',
    };
    shapes.set(index, item);
    if (nonEmpty(host.id) && !shapeIds.has(host.id)) shapeIds.set(host.id, index);
  });
  const endOf = (id: unknown): { ref: string; target: ConnectorEnd['target']; sites: () => ConnectionSite[] | undefined } | undefined => {
    if (!nonEmpty(id)) return undefined;
    const overlay = shapeIds.get(id);
    if (overlay !== undefined) { const item = shapes.get(overlay)!; return { ref: item.path, target: 'shape', sites: () => shapeSites(item.shape) }; }
    const block = blockOf(id);
    return block && { ref: block.ref, target: block.target, sites: block.sites };
  };
  const out: ComposedOverlayEntry[] = [];
  entries.forEach((entry, index) => {
    const host = record(entry);
    if (shapes.has(index)) { out.push(shapes.get(index)!); return; }
    if (!isOverlayConnector(host)) return;
    const connector = record(host.connector), from = endOf(connector.from), to = endOf(connector.to);
    if (!from || !to) return;
    const route: ConnectorRoute = (CONNECTOR_ROUTES as readonly unknown[]).includes(connector.route) ? connector.route : 'straight';
    const fromSites = from.sites(), toSites = to.sites();
    if (!fromSites?.length || !toSites?.length) return;
    const chosen = chooseConnectorSites(route, fromSites, toSites, { fromSite: connector.fromSite, toSite: connector.toSite, scale, same: from.ref === to.ref });
    if (!chosen) return;
    // An authored adjust keeps the route PowerPoint drew (SH-05 imports it): the sites stay the chosen ones, the middle is the author's.
    const own = record(host.adjust), geometry = Object.keys(own).length ? connectorRoute(route, fromSites[chosen.from]!, toSites[chosen.to]!, scale, own) ?? chosen.geometry : chosen.geometry, frame = geometry.frame;
    const paths: ComposedShapePath[] = [{ d: geometry.d, fill: 'none', stroke: true, open: true, ...(geometry.ends ? { ends: geometry.ends } : {}) }];
    const stroke = composeStroke(host.stroke, scale, { color: CONNECTOR_STROKE_COLOR, width: CONNECTOR_STROKE_WIDTH, join: 'round' });
    sketchStroke(stroke, paths, geometry.bounds, scale);
    const end = (id: string, side: typeof from, site: number, sites: ConnectionSite[]): ConnectorEnd => ({ id, ref: side!.ref, target: side!.target, site, point: { x: sites[site]!.x, y: sites[site]!.y }, angle: sites[site]!.angle });
    out.push({
      kind: 'connector', path: `${context.path}.shapes.${index}`, index, ...(nonEmpty(host.id) ? { id: host.id } : {}), route, preset: geometry.preset,
      box: frame.box, ...(frame.rotate ? { rotate: frame.rotate } : {}), ...(frame.flipH ? { flipH: true as const } : {}), ...(frame.flipV ? { flipV: true as const } : {}),
      adjust: geometry.adjust, avLst: geometry.avLst, paths, bounds: geometry.bounds,
      from: end(connector.from, from, chosen.from, fromSites), to: end(connector.to, to, chosen.to, toSites),
      ...(stroke ? { stroke } : {}), ...(typeof host.alt === 'string' ? { alt: host.alt } : {}), ...(host.decorative === true ? { decorative: true as const } : {}), ...(host.hidden === true ? { hidden: true as const } : {}),
    });
  });
  return out;
}

/**
 * An overlay shape's frame in slide pixels: `x`, `y`, `width`, `height` as fractions of the slide (`x` from the right edge in a right-to-left
 * deck), or `at` against a composed block. Undefined when the entry has neither placement, both, or a block that is not composed.
 */
function overlayBox(host: Rec, context: { width: number; height: number; scale: number; rtl: boolean; blockOf: (id: string) => BlockTarget | undefined }): { box: LayoutBox; attachedTo?: ComposedOverlayShape['attachedTo'] } | undefined {
  const { width, height, scale, rtl } = context;
  const fractions = ['x', 'y', 'width', 'height'].map(key => finite(host[key], 0, 1));
  const hasFractions = ['x', 'y', 'width', 'height'].some(key => host[key] !== undefined), hasAt = host.at !== undefined;
  if (hasFractions === hasAt) return undefined;
  if (hasFractions) {
    if (fractions.some(value => value === undefined)) return undefined;
    const [x, y, w, h] = fractions as number[];
    return { box: { x: round(rtl ? width - (x! + w!) * width : x! * width), y: round(y! * height), width: round(w! * width), height: round(h! * height) } };
  }
  const at = record(host.at);
  if (!nonEmpty(at.block) || !(OVERLAY_EDGES as readonly unknown[]).includes(at.edge)) return undefined;
  const block = context.blockOf(at.block);
  if (!block) return undefined;
  const target = block.box;
  const preset = typeof host.shape === 'string' && isPresetShape(host.shape) ? host.shape : host.path !== undefined ? undefined : 'rect';
  const aspect = presetAspect(preset);
  const size = (value: unknown, along: number): number | undefined => { const own = finite(value, Number.MIN_VALUE, 1280); return own === undefined ? undefined : own <= 1 ? own * along : own * scale; };
  let w = size(at.width, target.width), h = size(at.height, target.height);
  if (w === undefined && h === undefined) {
    const short = OVERLAY_ANCHOR_SHARE * Math.min(target.width, target.height);
    if (aspect >= 1) { h = short; w = short * aspect; } else { w = short; h = short / aspect; }
  } else if (w === undefined) w = h! * aspect;
  else if (h === undefined) h = w / aspect;
  const offset = (finite(at.offset, -720, 720) ?? 0) * scale;
  const edge = at.edge === 'start' ? (rtl ? 'right' : 'left') : at.edge === 'end' ? (rtl ? 'left' : 'right') : at.edge as 'top' | 'bottom' | 'center';
  const middleX = target.x + (target.width - w!) / 2, middleY = target.y + (target.height - h!) / 2;
  const [x, y] = edge === 'top' ? [middleX, target.y - offset - h!] : edge === 'bottom' ? [middleX, target.y + target.height + offset]
    : edge === 'left' ? [target.x - offset - w!, middleY] : edge === 'right' ? [target.x + target.width + offset, middleY] : [middleX, middleY];
  return { box: { x: round(x), y: round(y), width: round(w!), height: round(h!) }, attachedTo: { id: at.block, ref: block.ref, edge } };
}

// --- validation -----------------------------------------------------------------------------------------------------

/** The keys of the overlay vocabulary that only an overlay shape takes (a connector takes id, connector, adjust, stroke, alt, decorative, hidden and extensions). */
const SHAPE_ONLY_KEYS: ReadonlySet<string> = new Set(['x', 'y', 'width', 'height', 'at', 'layer', 'shape', 'path', 'fill', 'opacity', 'style', 'shadow', 'innerShadow', 'glow', 'softEdge', 'reflection', 'blur', 'rotate', 'flip', 'text', 'anchor', 'padding', 'textDirection', 'link']);
/** A validation issue of a slide's `shapes` (schema-check reports them); `code` absent means an opf/schema error. */
export interface OverlayIssue { path: string; message: string; code?: 'shape-anchor-missing' | 'connector-end-missing'; params: Record<string, unknown> }

/** How many connection sites the end `id` has (a rect's four for a block that is not a shape), or undefined when it cannot be told yet. */
function siteCount(id: string, slide: Rec, blockPaths: Map<string, string>, overlays: Map<string, Rec>, slidePath: string): number | undefined {
  const engine = shapeGeometry();
  // A block that is not a shape, a custom path and a rect mask have a rect's four sites; a preset (a shape's or a picture mask's) its own.
  const count = (host: Rec): number | undefined => {
    const preset = typeof host.shape === 'string' && isPresetShape(host.shape) ? host.shape : undefined;
    if (!preset || preset === 'rect') return 4;
    return engine ? engine.presetGeometry(preset, 100, 100).connectionSites.length : undefined;
  };
  const overlay = overlays.get(id);
  if (overlay) return count(overlay);
  const path = blockPaths.get(id);
  if (path === undefined) return undefined;
  let node: unknown = slide;
  for (const segment of path.slice(slidePath.length + 1).split(".")) node = node !== null && typeof node === "object" ? (node as Rec)[segment] : undefined;
  const host = record(node);
  return Array.isArray(host.blocks) ? 4 : count(host);
}

/**
 * The findings of a slide's `shapes`: an overlay shape with both placements or none (opf/schema), an `at` block that is not on the slide
 * (opf/shape-anchor-missing), a connector end that names no block or overlay shape of the slide (opf/connector-end-missing) and a site index
 * the end's shape does not have (opf/schema). `slidePath` is the slide's JSON Pointer (`/slides/0`).
 */
export function overlayIssues(slide: unknown, slidePath: string): OverlayIssue[] {
  const value = record(slide), entries = Array.isArray(value.shapes) ? value.shapes as unknown[] : [];
  if (!entries.length) return [];
  const issues: OverlayIssue[] = [];
  const dotted = slidePath.replace(/^\//, '').replaceAll('/', '.');
  const blockPaths = slideBlockIds(value, dotted);
  const overlays = new Map<string, Rec>(), connectors = new Set<string>();
  for (const entry of entries) {
    const host = record(entry);
    if (!nonEmpty(host.id)) continue;
    if (isOverlayConnector(host)) connectors.add(host.id); else if (!overlays.has(host.id)) overlays.set(host.id, host);
  }
  const known = [...blockPaths.keys(), ...overlays.keys()];
  entries.forEach((entry, index) => {
    const host = record(entry), at = `${slidePath}/shapes/${index}`;
    if (!Object.keys(host).length) return;
    if (isOverlayConnector(host)) {
      for (const key of Object.keys(host)) if (SHAPE_ONLY_KEYS.has(key)) issues.push({ path: `${at}/${key}`, message: `${key} does not apply to a connector; a connector takes only id, connector, adjust, stroke, alt, decorative, hidden and extensions`, params: { field: key } });
      const connector = record(host.connector);
      for (const side of ['from', 'to'] as const) {
        const id = connector[side];
        if (!nonEmpty(id)) continue;
        if (!blockPaths.has(id) && !overlays.has(id)) {
          issues.push({ path: `${at}/connector/${side}`, code: 'connector-end-missing', message: connectors.has(id) ? `connector ${side} '${id}' names a connector; a connector joins blocks and overlay shapes` : `connector ${side} '${id}' names no block or overlay shape on this slide`, params: { id, side, known } });
          continue;
        }
        const key = side === 'from' ? 'fromSite' : 'toSite', site = connector[key];
        if (typeof site !== 'number' || !Number.isInteger(site) || site < 0) continue;
        const count = siteCount(id, value, blockPaths, overlays, dotted);
        if (count !== undefined && site >= count) issues.push({ path: `${at}/connector/${key}`, message: `${key} ${site} is out of range: '${id}' has ${count} connection sites (0 to ${count - 1})`, params: { id, site, sites: count } });
      }
      return;
    }
    const fractions = ['x', 'y', 'width', 'height'].filter(key => host[key] !== undefined), anchored = host.at !== undefined;
    const missing = fractions.length ? ['x', 'y', 'width', 'height'].filter(key => host[key] === undefined) : [];
    if (missing.length && !anchored) issues.push({ path: at, message: `an overlay shape placed by fractions of the slide needs all of 'x', 'y', 'width' and 'height'; add ${missing.map(key => `'${key}'`).join(', ')}`, params: { missing } });
    if (fractions.length && anchored) issues.push({ path: at, message: "an overlay shape takes one placement: 'x', 'y', 'width' and 'height', or 'at', not both", params: { placements: [...fractions, 'at'] } });
    else if (!fractions.length && !anchored) issues.push({ path: at, message: "an overlay shape needs a placement: 'x', 'y', 'width' and 'height' (fractions of the slide), or 'at' (against a block)", params: {} });
    const block = record(host.at).block;
    if (anchored && nonEmpty(block) && !blockPaths.has(block)) issues.push({ path: `${at}/at/block`, code: 'shape-anchor-missing', message: `at.block '${block}' names no block on this slide; the shape is not drawn`, params: { id: block, known: [...blockPaths.keys()] } });
  });
  return issues;
}
