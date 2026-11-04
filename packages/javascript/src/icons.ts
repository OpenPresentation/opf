// LH-14: icons. An `icon` on a list entry, a metric or a group names one drawing:
//
//   `<set>:<name>`  an icon of a set (a catalog's `iconSets` record, such as the gallery's `lucide` or `tabler`);
//   `<name>`        a deck-local icon from the document's `icons` map (an author's or an LLM's SVG, written once and reused);
//   a source        `asset:<id>`, `./file.svg`, `https://…` or a `data:image/svg+xml` URI: an SVG file, as pictures accept.
//
// Catalog-free and edge-safe: this module reads the document and the catalogs a host registers, never bundled data. A host
// registers a set as its record or as a function that loads it (the gallery loads each set on first use), and `ensureIcons`
// loads the sets (and the SVG files) a document uses before the synchronous code (validate, composition, the engines) reads
// them, as `ensureDiagrams` does for diagram types. Every icon is normalized to one form: path commands (M, L, C, Z only) in a
// 24 x 24 viewBox, which the preview draws as SVG paths and the PPTX export as a native custom geometry. An SVG that is not one
// color (a monochrome icon: one paint, or `currentColor`) is a picture with its own colors.
import { applyLuminance, colorContrast, normalizeHexColor, readableSchemeColor, type ResolvedColorRoles } from './color.js';

/** The viewBox every resolved icon is drawn in (its larger side is scaled to fit, centered). */
export const ICON_VIEWBOX = 24;
/** An SVG an icon reads is at most this many characters. */
export const ICON_SVG_LIMIT = 200_000;
/** A set id, an icon name and a deck-local icon name. */
export const ICON_SET_PATTERN = /^[a-z][a-z0-9-]*$/, ICON_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const SOURCE_PATTERN = /^(?:asset:|https:\/\/|data:|\.\/|\.\.\/)/;

/** An icon reference as written: a set's icon, a deck-local icon or an SVG source. */
export type IconReference = { kind: 'set'; set: string; name: string } | { kind: 'deck'; name: string } | { kind: 'source'; src: string };

/** Parse an `icon` value; undefined when it is none of the three forms. */
export function parseIconReference(value: unknown): IconReference | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (SOURCE_PATTERN.test(text)) return { kind: 'source', src: text };
  const colon = text.indexOf(':');
  if (colon > 0) {
    const set = text.slice(0, colon), name = text.slice(colon + 1);
    return ICON_SET_PATTERN.test(set) && ICON_NAME_PATTERN.test(name) ? { kind: 'set', set, name } : undefined;
  }
  return ICON_SET_PATTERN.test(text) ? { kind: 'deck', name: text } : undefined;
}

/** One icon of a set record: its path data (drawn as the set's style) or its stroked and filled parts. */
export type IconSetIcon = string | { stroke?: string; fill?: string };
/** An icon-set record (https://openpresentation.org/schema/opf-icon-set/v1), embedded or registered. */
export interface IconSetRecord {
  name: string; license: string; copyright: string; viewBox: readonly [number, number, number, number]; style: 'stroke' | 'fill';
  strokeWidth?: number; strokeLinecap?: 'butt' | 'round' | 'square'; strokeLinejoin?: 'miter' | 'round' | 'bevel';
  icons: Readonly<Record<string, IconSetIcon>>; tags?: Readonly<Record<string, readonly string[]>>;
  summary?: string; version?: string; package?: string; homepage?: string; licenseText?: string;
}
/** A registered catalog's set: its record, or a function that loads it (a module whose default export is the record also does). */
export type IconSetLoader = () => Promise<unknown>;
export type RegisteredIconSet = IconSetRecord | IconSetLoader;

/** A path command in absolute coordinates: every SVG command is normalized to these four. */
export type IconCommand = ['M', number, number] | ['L', number, number] | ['C', number, number, number, number, number, number] | ['Z'];
/** One part of a monochrome icon: filled (nonzero, or even-odd), stroked at `stroke` viewBox units, or both, in the one ink. */
export interface IconPart { commands: IconCommand[]; fill?: true; evenOdd?: true; stroke?: number; linecap?: 'butt' | 'round' | 'square'; linejoin?: 'miter' | 'round' | 'bevel' }
/** A resolved icon: a monochrome glyph (`parts`, in a 0 0 24 24 viewBox) or a multicolor SVG `picture` with its own colors. */
export interface ResolvedIcon {
  /** The reference as written. */
  reference: string;
  kind: IconReference['kind'];
  /** `set` for a set's icon (with `name`), the deck-local name, or the source. */
  set?: string;
  name: string;
  parts?: IconPart[];
  /** A multicolor SVG (sanitized: no script, external reference or raster), drawn contained in the icon's box, with its aspect. */
  picture?: { svg: string; width: number; height: number };
  /** The set's license and copyright, for a set's icon. */
  license?: string;
  copyright?: string;
}
export type IconResolution = { ok: true; icon: ResolvedIcon } | { ok: false; code: 'icon-unknown' | 'icon-invalid' | 'icon-unloaded'; message: string; suggestions?: string[] };

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec => typeof value === 'object' && value !== null && !Array.isArray(value);

// ------------------------------------------------------------------------------------------------------------------------------
// Path data

const round = (value: number) => { const rounded = Math.round(value * 1000) / 1000; return Object.is(rounded, -0) ? 0 : rounded; };

/** Arc to cubic curves (SVG 2 appendix B.2.4: endpoint to center parameterization), each segment at most a quarter turn. */
function arcCurves(x1: number, y1: number, rx: number, ry: number, angle: number, large: boolean, sweep: boolean, x2: number, y2: number): IconCommand[] {
  if (x1 === x2 && y1 === y2) return [];
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (!rx || !ry) return [['L', x2, y2]];
  const phi = angle * Math.PI / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  const lambda = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coefficient = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator));
  const cxp = coefficient * rx * y1p / ry, cyp = -coefficient * ry * x1p / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const vectorAngle = (ux: number, uy: number, vx: number, vy: number) => { const sign = ux * vy - uy * vx < 0 ? -1 : 1; return sign * Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy))))); };
  const theta = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = vectorAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const segments = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9)), step = delta / segments, k = 4 / 3 * Math.tan(step / 4);
  const point = (t: number) => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos] as const;
  const derivative = (t: number) => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos] as const;
  const curves: IconCommand[] = [];
  for (let index = 0; index < segments; index++) {
    const t1 = theta + index * step, t2 = t1 + step, [px, py] = point(t1), [qx, qy] = index === segments - 1 ? [x2, y2] : point(t2), [d1x, d1y] = derivative(t1), [d2x, d2y] = derivative(t2);
    curves.push(['C', px + k * d1x, py + k * d1y, qx - k * d2x, qy - k * d2y, qx, qy]);
  }
  return curves;
}

/**
 * SVG path data as absolute M, L, C and Z commands (H and V become lines, S, Q and T cubic curves, arcs cubic curves of at most a
 * quarter turn each). Throws a RangeError for path data that is not well formed.
 */
export function iconPathCommands(d: string): IconCommand[] {
  const tokens = String(d).match(/[MmLlHhVvCcSsQqTtAaZz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? [];
  const out: IconCommand[] = [];
  let at = 0, command = '', x = 0, y = 0, startX = 0, startY = 0, lastControl: [number, number] | undefined, lastQuad: [number, number] | undefined;
  const number = () => { const token = tokens[at++]; if (token === undefined || /[a-z]/i.test(token)) throw new RangeError('Icon path data ends inside a command.'); return Number(token); };
  // An arc's flags may be written without separators ("a1 1 0 001 1"); the tokenizer then joins them into one number.
  const flag = () => {
    const token = tokens[at];
    if (token === undefined) throw new RangeError('Icon path data ends inside an arc.');
    if (token === '0' || token === '1') { at++; return token === '1'; }
    if (/^[01]/.test(token)) { tokens[at] = token.slice(1); return token[0] === '1'; }
    throw new RangeError('An arc flag is not 0 or 1.');
  };
  while (at < tokens.length) {
    if (/^[a-z]$/i.test(tokens[at]!)) command = tokens[at++]!;
    else if (!command) throw new RangeError('Icon path data does not start with a command.');
    const upper = command.toUpperCase(), relative = command !== upper;
    const ox = relative ? x : 0, oy = relative ? y : 0;
    switch (upper) {
      case 'M': { x = ox + number(); y = oy + number(); startX = x; startY = y; out.push(['M', x, y]); command = relative ? 'l' : 'L'; lastControl = lastQuad = undefined; break; }
      case 'L': { x = ox + number(); y = oy + number(); out.push(['L', x, y]); lastControl = lastQuad = undefined; break; }
      case 'H': { x = ox + number(); out.push(['L', x, y]); lastControl = lastQuad = undefined; break; }
      case 'V': { y = (relative ? y : 0) + number(); out.push(['L', x, y]); lastControl = lastQuad = undefined; break; }
      case 'C': { const x1 = ox + number(), y1 = oy + number(), x2 = ox + number(), y2 = oy + number(); x = ox + number(); y = oy + number(); out.push(['C', x1, y1, x2, y2, x, y]); lastControl = [x2, y2]; lastQuad = undefined; break; }
      case 'S': { const [x1, y1] = lastControl ? [2 * x - lastControl[0], 2 * y - lastControl[1]] : [x, y], x2 = ox + number(), y2 = oy + number(); x = ox + number(); y = oy + number(); out.push(['C', x1, y1, x2, y2, x, y]); lastControl = [x2, y2]; lastQuad = undefined; break; }
      case 'Q': case 'T': {
        const [qx, qy] = upper === 'Q' ? [ox + number(), oy + number()] : lastQuad ? [2 * x - lastQuad[0], 2 * y - lastQuad[1]] : [x, y];
        const ex = ox + number(), ey = oy + number();
        out.push(['C', x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), ex + 2 / 3 * (qx - ex), ey + 2 / 3 * (qy - ey), ex, ey]);
        x = ex; y = ey; lastQuad = [qx, qy]; lastControl = undefined; break;
      }
      case 'A': { const rx = number(), ry = number(), angle = number(), large = flag(), sweep = flag(), ex = ox + number(), ey = oy + number(); out.push(...arcCurves(x, y, rx, ry, angle, large, sweep, ex, ey)); x = ex; y = ey; lastControl = lastQuad = undefined; break; }
      case 'Z': { out.push(['Z']); x = startX; y = startY; lastControl = lastQuad = undefined; command = ''; if (at < tokens.length && !/^[a-z]$/i.test(tokens[at]!)) throw new RangeError('Icon path data has numbers after a closepath.'); break; }
      default: throw new RangeError(`Unknown path command ${command}.`);
    }
  }
  return out;
}

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const multiply = (m: Matrix, n: Matrix): Matrix => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const applyPoint = (m: Matrix, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
function transformCommands(commands: readonly IconCommand[], m: Matrix): IconCommand[] {
  return commands.map(command => {
    if (command[0] === 'Z') return command;
    if (command[0] === 'C') { const [a, b] = applyPoint(m, command[1], command[2]), [c, d] = applyPoint(m, command[3], command[4]), [e, f] = applyPoint(m, command[5], command[6]); return ['C', round(a), round(b), round(c), round(d), round(e), round(f)]; }
    const [a, b] = applyPoint(m, command[1], command[2]);
    return [command[0], round(a), round(b)];
  });
}
/** An SVG `transform` list as one matrix; undefined when it cannot be read. */
function parseTransform(value: string): Matrix | undefined {
  let m: Matrix = IDENTITY;
  const pattern = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let consumed = '';
  for (const match of value.matchAll(pattern)) {
    consumed += match[0];
    const a = (match[2]!.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? []).map(Number);
    let n: Matrix;
    switch (match[1]) {
      case 'matrix': if (a.length !== 6) return undefined; n = a as Matrix; break;
      case 'translate': n = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0]; break;
      case 'scale': n = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0]; break;
      case 'rotate': { const r = (a[0] ?? 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), cx = a[1] ?? 0, cy = a[2] ?? 0; n = multiply(multiply([1, 0, 0, 1, cx, cy], [c, s, -s, c, 0, 0]), [1, 0, 0, 1, -cx, -cy]); break; }
      case 'skewX': n = [1, 0, Math.tan((a[0] ?? 0) * Math.PI / 180), 1, 0, 0]; break;
      default: n = [1, Math.tan((a[0] ?? 0) * Math.PI / 180), 0, 1, 0, 0];
    }
    m = multiply(m, n);
  }
  return consumed.replace(/[\s,]/g, '') === value.replace(/[\s,]/g, '') ? m : undefined;
}

/** Path commands as SVG path data (what the preview draws). */
export function iconPathData(commands: readonly IconCommand[]): string {
  const n = (value: number) => String(round(value));
  return commands.map(command => command[0] === 'Z' ? 'Z' : command[0] === 'C' ? `C${command.slice(1).map(value => n(value as number)).join(' ')}` : `${command[0]}${n(command[1])} ${n(command[2])}`).join('');
}

/** The commands placed in `box` (canvas pixels) from the 0 0 24 24 icon viewBox. */
export function placeIconCommands(commands: readonly IconCommand[], box: { x: number; y: number; width: number; height: number }): IconCommand[] {
  const scale = Math.min(box.width, box.height) / ICON_VIEWBOX;
  return transformCommands(commands, [scale, 0, 0, scale, box.x + (box.width - scale * ICON_VIEWBOX) / 2, box.y + (box.height - scale * ICON_VIEWBOX) / 2]);
}

/** The matrix that fits a viewBox into the 0 0 24 24 icon box, its larger side scaled to 24 and centered. */
function normalizer(viewBox: readonly number[]): Matrix {
  const [x, y, width, height] = viewBox as [number, number, number, number], scale = ICON_VIEWBOX / Math.max(width, height);
  return [scale, 0, 0, scale, -x * scale + (ICON_VIEWBOX - width * scale) / 2, -y * scale + (ICON_VIEWBOX - height * scale) / 2];
}

/** A set's icon as parts in the 0 0 24 24 viewBox; undefined when its path data cannot be read. */
function setIconParts(set: IconSetRecord, icon: IconSetIcon): IconPart[] | undefined {
  const m = normalizer(set.viewBox), scale = m[0], width = (set.strokeWidth ?? 2) * scale;
  const stroke = (d: string): IconPart => ({ commands: transformCommands(iconPathCommands(d), m), stroke: round(width), linecap: set.strokeLinecap ?? 'round', linejoin: set.strokeLinejoin ?? 'round' });
  try {
    if (typeof icon === 'string') return [set.style === 'fill' ? { commands: transformCommands(iconPathCommands(icon), m), fill: true } : stroke(icon)];
    return [...(icon.fill ? [{ commands: transformCommands(iconPathCommands(icon.fill), m), fill: true as const }] : []), ...(icon.stroke ? [stroke(icon.stroke)] : [])];
  } catch { return undefined; }
}

// ------------------------------------------------------------------------------------------------------------------------------
// SVG intake

/** Elements an icon is drawn from; anything that can run code, load a document or show a raster refuses the SVG. */
const SHAPES = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);
const QUIET = new Set(['title', 'desc', 'metadata']);
const REFUSED = new Set(['script', 'foreignobject', 'image', 'iframe', 'object', 'embed', 'audio', 'video', 'handler', 'listener', 'feimage']);
const PAINTS = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'fill-opacity', 'stroke-opacity', 'fill-rule', 'display', 'visibility', 'color'] as const;

interface SvgElement { name: string; attributes: Record<string, string>; children: SvgElement[] }

/** The text of an SVG that refuses nothing: one root <svg>, well nested, no DOCTYPE, CDATA or entity other than the predefined ones. */
function parseSvg(text: string): SvgElement {
  const entity = (value: string) => value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_all, name: string) => name[0] === '#' ? String.fromCodePoint(name[1]!.toLowerCase() === 'x' ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1))) : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[name.toLowerCase()]!);
  const stack: SvgElement[] = [];
  let root: SvgElement | undefined, index = 0;
  while (index < text.length) {
    const open = text.indexOf('<', index);
    if (open < 0) { if (text.slice(index).trim()) throw new Error('text outside the root element'); break; }
    if (text.slice(index, open).includes('&') && /&(?!(?:#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);)/i.test(text.slice(index, open))) throw new Error('an entity reference');
    if (!stack.length && text.slice(index, open).trim()) throw new Error('text outside the root element');
    if (text.startsWith('<!--', open)) { const end = text.indexOf('-->', open + 4); if (end < 0) throw new Error('an unterminated comment'); index = end + 3; continue; }
    if (text.startsWith('<?', open)) { const end = text.indexOf('?>', open + 2); if (end < 0 || !/^<\?xml[\s?]/i.test(text.slice(open, open + 6))) throw new Error('a processing instruction'); index = end + 2; continue; }
    if (text.startsWith('<!', open)) throw new Error('a DOCTYPE or CDATA section');
    const close = /^<\/\s*([A-Za-z_][\w:.-]*)\s*>/.exec(text.slice(open));
    if (close) {
      const element = stack.pop();
      if (!element || element.name !== close[1]!.toLowerCase().replace(/^svg:/, '')) throw new Error(`</${close[1]}> closes nothing open`);
      index = open + close[0].length; continue;
    }
    const tag = /^<([A-Za-z_][\w:.-]*)((?:\s+[A-Za-z_:][\w:.-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>/.exec(text.slice(open));
    if (!tag) throw new Error('an unreadable tag');
    const element: SvgElement = { name: tag[1]!.toLowerCase().replace(/^svg:/, ''), attributes: {}, children: [] };
    for (const attribute of tag[2]!.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/g)) {
      const key = attribute[1]!.toLowerCase();
      if (Object.hasOwn(element.attributes, key)) throw new Error(`the attribute ${key} twice`);
      element.attributes[key] = entity(attribute[2] ?? attribute[3] ?? '');
    }
    if (stack.length) stack.at(-1)!.children.push(element);
    else if (root) throw new Error('more than one root element');
    else root = element;
    if (!tag[3]) stack.push(element);
    index = open + tag[0].length;
  }
  if (stack.length) throw new Error(`<${stack.at(-1)!.name}> is never closed`);
  if (!root || root.name !== 'svg') throw new Error('the root element is not <svg>');
  return root;
}

/** Why an SVG cannot be an icon (script, external reference, raster), or undefined when nothing is refused. */
function refusal(element: SvgElement): string | undefined {
  if (REFUSED.has(element.name)) return `a <${element.name}> element`;
  for (const [key, value] of Object.entries(element.attributes)) {
    if (/^on/.test(key)) return `an event handler (${key})`;
    if (/(?:^|:)href$/.test(key) && !value.trim().startsWith('#')) return 'an external reference';
    if (/url\(\s*['"]?(?!#)/i.test(value) || /@import/i.test(value) || /javascript:/i.test(value)) return 'an external reference';
  }
  if (element.name === 'style' && element.children.length) return 'a nested element in a style sheet';
  for (const child of element.children) { const found = refusal(child); if (found) return found; }
  return undefined;
}

/** The paint attributes an element sets, from its attributes and its `style` declarations (which win). */
function paintsOf(element: SvgElement): Partial<Record<typeof PAINTS[number], string>> {
  const out: Partial<Record<typeof PAINTS[number], string>> = {};
  for (const key of PAINTS) if (element.attributes[key] !== undefined) out[key] = element.attributes[key]!.trim();
  for (const declaration of (element.attributes.style ?? '').split(';')) {
    const colon = declaration.indexOf(':');
    if (colon < 0) continue;
    const key = declaration.slice(0, colon).trim().toLowerCase() as typeof PAINTS[number], value = declaration.slice(colon + 1).trim();
    if ((PAINTS as readonly string[]).includes(key)) out[key] = value;
  }
  return out;
}

const pathOfShape = (element: SvgElement): string => {
  const a = element.attributes, value = (key: string) => Number.parseFloat(a[key] ?? '0') || 0, n = (number: number) => String(round(number));
  switch (element.name) {
    case 'path': return a.d ?? '';
    case 'line': return `M${n(value('x1'))} ${n(value('y1'))}L${n(value('x2'))} ${n(value('y2'))}`;
    case 'polyline': case 'polygon': {
      const values = (a.points ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number);
      const points: string[] = [];
      for (let index = 0; index + 1 < values.length; index += 2) points.push(`${n(values[index]!)} ${n(values[index + 1]!)}`);
      return points.length < 2 ? '' : `M${points.join('L')}${element.name === 'polygon' ? 'Z' : ''}`;
    }
    case 'circle': case 'ellipse': {
      const cx = value('cx'), cy = value('cy'), rx = element.name === 'circle' ? value('r') : value('rx'), ry = element.name === 'circle' ? value('r') : value('ry');
      return rx > 0 && ry > 0 ? `M${n(cx - rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx + rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx - rx)} ${n(cy)}Z` : '';
    }
    default: {
      const x = value('x'), y = value('y'), width = value('width'), height = value('height');
      if (!(width > 0 && height > 0)) return '';
      let rx = a.rx === undefined ? a.ry : a.rx, ry = a.ry === undefined ? a.rx : a.ry;
      const rxv = Math.min(Math.max(0, Number.parseFloat(rx ?? '0') || 0), width / 2), ryv = Math.min(Math.max(0, Number.parseFloat(ry ?? '0') || 0), height / 2);
      if (!rxv || !ryv) return `M${n(x)} ${n(y)}H${n(x + width)}V${n(y + height)}H${n(x)}Z`;
      const arc = (dx: number, dy: number) => `A${n(rxv)} ${n(ryv)} 0 0 1 ${n(dx)} ${n(dy)}`;
      rx = ry = undefined;
      return `M${n(x + rxv)} ${n(y)}H${n(x + width - rxv)}${arc(x + width, y + ryv)}V${n(y + height - ryv)}${arc(x + width - rxv, y + height)}H${n(x + rxv)}${arc(x, y + height - ryv)}V${n(y + ryv)}${arc(x + rxv, y)}Z`;
    }
  }
};

/**
 * An author's or an LLM's SVG as an icon. A script, an event handler, an external reference (`href`, `url()` or `@import` that is not
 * a fragment) or a raster refuses it (`icon-invalid`): nothing is fetched or run. An SVG whose shapes (path, circle, ellipse, rect,
 * line, polyline, polygon, in groups with transforms) are drawn in one paint (a color or `currentColor`, opacity 1) is a monochrome
 * glyph: its shapes become path commands in the 0 0 24 24 viewBox (normalized from its own viewBox, or its width and height), drawn in
 * the accent. Any other SVG (several colors, gradients, text, opacity) is a picture with its own colors.
 */
export function iconFromSvg(text: string): { ok: true; parts?: IconPart[]; picture?: ResolvedIcon['picture'] } | { ok: false; message: string } {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, message: 'The icon has no SVG text.' };
  if (text.length > ICON_SVG_LIMIT) return { ok: false, message: `The icon's SVG is longer than ${ICON_SVG_LIMIT} characters.` };
  let root: SvgElement;
  try { root = parseSvg(text.trim()); } catch (error) { return { ok: false, message: `The icon is not a well-formed SVG: ${(error as Error).message}.` }; }
  const refused = refusal(root);
  if (refused) return { ok: false, message: `The icon's SVG has ${refused}; an icon draws only its own shapes.` };
  const numbers = (value: string | undefined) => (value ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number);
  let viewBox = numbers(root.attributes.viewbox);
  if (viewBox.length !== 4 || !viewBox.every(Number.isFinite) || viewBox[2]! <= 0 || viewBox[3]! <= 0) {
    const width = Number.parseFloat(root.attributes.width ?? ''), height = Number.parseFloat(root.attributes.height ?? '');
    if (!(width > 0 && height > 0)) return { ok: false, message: "The icon's SVG has no viewBox and no width and height, so it has no size." };
    viewBox = [0, 0, width, height];
  }
  const picture = { svg: text.trim(), width: viewBox[2]!, height: viewBox[3]! };
  // The paints the drawn shapes use, inherited down the tree as SVG does (fill black and stroke none at the root).
  const inks = new Set<string>(), parts: IconPart[] = [];
  let convertible = true;
  const visit = (element: SvgElement, inherited: Record<string, string>, m: Matrix) => {
    if (QUIET.has(element.name) || !convertible) return;
    if (element.name !== 'svg' && element.name !== 'g' && !SHAPES.has(element.name)) { convertible = false; return; }
    const own = paintsOf(element), paint: Record<string, string> = { ...inherited, ...Object.fromEntries(Object.entries(own).filter(([, value]) => value !== 'inherit')) };
    if (paint.display === 'none' || paint.visibility === 'hidden') return;
    let matrix = m;
    if (element.attributes.transform !== undefined) { const t = parseTransform(element.attributes.transform); if (!t) { convertible = false; return; } matrix = multiply(m, t); }
    for (const key of ['opacity', 'fill-opacity', 'stroke-opacity']) if (paint[key] !== undefined && Number.parseFloat(paint[key]!) !== 1 && element.name !== 'svg') { convertible = false; return; }
    if (!SHAPES.has(element.name)) { for (const child of element.children) visit(child, paint, matrix); return; }
    const ink = (value: string | undefined) => { const lower = (value ?? '').trim().toLowerCase(); return lower === 'currentcolor' ? 'currentcolor' : normalizeHexColor(lower)?.toLowerCase() ?? lower; };
    // A line has no area to fill; every other shape (a polyline too) fills as SVG does.
    const fill = paint.fill ?? 'black', stroke = paint.stroke ?? 'none', filled = fill.toLowerCase() !== 'none' && element.name !== 'line', stroked = stroke.toLowerCase() !== 'none';
    if (!filled && !stroked) return;
    let commands: IconCommand[];
    try { commands = iconPathCommands(pathOfShape(element)); } catch { convertible = false; return; }
    if (!commands.length) return;
    if (filled) inks.add(ink(fill));
    if (stroked) inks.add(ink(stroke));
    const det = Math.sqrt(Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]));
    const linecap = (['butt', 'round', 'square'] as const).find(cap => cap === paint['stroke-linecap']) ?? 'butt', linejoin = (['miter', 'round', 'bevel'] as const).find(join => join === paint['stroke-linejoin']) ?? 'miter';
    parts.push({ commands: transformCommands(commands, matrix), ...(filled ? { fill: true as const } : {}), ...(filled && paint['fill-rule'] === 'evenodd' ? { evenOdd: true as const } : {}),
      ...(stroked ? { stroke: round((Number.parseFloat(paint['stroke-width'] ?? '1') || 1) * det), linecap, linejoin } : {}) });
  };
  visit(root, {}, IDENTITY);
  if (!convertible || inks.size !== 1 || !parts.length) return { ok: true, picture };
  const normal = normalizer(viewBox), scale = normal[0];
  return { ok: true, parts: parts.map(part => ({ ...part, commands: transformCommands(part.commands, normal), ...(part.stroke !== undefined ? { stroke: round(part.stroke * scale) } : {}) })) };
}

// ------------------------------------------------------------------------------------------------------------------------------
// Resolution

/** Sets loaded by ensureIcons (or registered as records), by id: what the synchronous code resolves a set's icon in. */
const loadedSets = new Map<string, IconSetRecord>();
/** SVG text of the icon sources ensureIcons read, by source. */
const sourceTexts = new Map<string, string>();

/** The registered catalogs' sets, by id (the first catalog that registers an id wins). */
function registeredSets(catalogs: readonly unknown[] | undefined): Map<string, RegisteredIconSet> {
  return new Map([...registeredSources(catalogs)].map(([id, entry]) => [id, entry.set]));
}
/** The registered sets with the source of the catalog that registers each. */
function registeredSources(catalogs: readonly unknown[] | undefined): Map<string, { set: RegisteredIconSet; source: string }> {
  const sets = new Map<string, { set: RegisteredIconSet; source: string }>();
  for (const catalog of catalogs ?? []) {
    const own = isRec(catalog) ? catalog.iconSets : undefined;
    if (!isRec(own) || typeof (catalog as Rec).source !== 'string') continue;
    for (const [id, set] of Object.entries(own)) if (!sets.has(id) && (typeof set === 'function' || isRec(set))) sets.set(id, { set: set as RegisteredIconSet, source: (catalog as Rec).source as string });
  }
  return sets;
}
/** The sets the document embeds (`catalogs.<group>.iconSets`), `custom` first, then `default`, then the named groups. */
function embeddedSets(document: unknown): Map<string, IconSetRecord> {
  const sets = new Map<string, IconSetRecord>(), catalogs = isRec(document) && isRec(document.catalogs) ? document.catalogs : {};
  const groups = ['custom', 'default', ...Object.keys(catalogs).filter(name => name !== 'custom' && name !== 'default')];
  for (const group of groups) {
    const own = isRec(catalogs[group]) ? (catalogs[group] as Rec).iconSets : undefined;
    if (isRec(own)) for (const [id, set] of Object.entries(own)) if (!sets.has(id) && isRec(set) && isRec(set.icons)) sets.set(id, set as unknown as IconSetRecord);
  }
  return sets;
}

/** Every `icon` value of a document (or a slide), with its dotted path: list entries, metrics and groups at any depth. */
export function documentIcons(input: unknown): { path: string; value: unknown }[] {
  const found: { path: string; value: unknown }[] = [];
  const payload = (value: unknown, path: string, depth: number) => {
    if (!isRec(value) || depth > 40) return;
    if (value.icon !== undefined) found.push({ path: `${path}.icon`, value: value.icon });
    if (isRec(value.metric) && value.metric.icon !== undefined) found.push({ path: `${path}.metric.icon`, value: value.metric.icon });
    if (Array.isArray(value.items)) value.items.forEach((entry, index) => { if (isRec(entry) && entry.icon !== undefined) found.push({ path: `${path}.items.${index}.icon`, value: entry.icon }); });
    if (Array.isArray(value.blocks)) value.blocks.forEach((block, index) => payload(block, `${path}.blocks.${index}`, depth + 1));
  };
  // A slide holds root payload fields (items, metric) or blocks, as a group does.
  const slide = (value: unknown, path: string) => payload(value, path, 0);
  if (isRec(input) && Array.isArray(input.slides)) input.slides.forEach((value, index) => slide(value, `slides.${index}`));
  else slide(input, 'slide');
  return found;
}

/** The deck-local icon map's value for `name`, as SVG text or a source. */
const deckIcon = (document: unknown, name: string): unknown => isRec(document) && isRec(document.icons) && Object.hasOwn(document.icons, name) ? document.icons[name] : undefined;

/** The source an asset reference stands for (`asset:<id>` through the document's `assets`), else the source itself. */
function sourceOf(document: unknown, src: string): string | undefined {
  if (!src.startsWith('asset:')) return src;
  const asset = isRec(document) && isRec(document.assets) ? document.assets[src.slice(6)] : undefined;
  const value = typeof asset === 'string' ? asset : isRec(asset) && typeof asset.src === 'string' ? asset.src : undefined;
  return value === undefined || value.startsWith('asset:') ? undefined : value;
}
/** The SVG text of a data URI, or undefined when the URI is not an SVG data URI. */
function dataUriText(uri: string): string | undefined {
  const match = /^data:image\/svg\+xml((?:;[^;,]*)*),/i.exec(uri);
  if (!match) return undefined;
  try {
    const payload = uri.slice(match[0].length);
    if (/;base64/i.test(match[1]!)) { const binary = atob(payload.replace(/\s+/g, '')); return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0))); }
    return decodeURIComponent(payload);
  } catch { return undefined; }
}

/** Damerau-free edit distance, bounded: the near-name suggestions of `icon-unknown`. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]!; row[0] = i;
    for (let j = 1; j <= b.length; j++) { const current = row[j]!; row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1)); previous = current; }
  }
  return row[b.length]!;
}
/** Up to `limit` names nearest to `name`: names that contain it or that it contains first, then the fewest edits. */
export function nearIconNames(name: string, names: Iterable<string>, limit = 5): string[] {
  const scored: [string, number][] = [];
  for (const candidate of names) {
    const contains = candidate.includes(name) || name.includes(candidate) ? 0 : 1, edits = distance(name, candidate);
    if (contains === 0 || edits <= Math.max(2, Math.floor(name.length / 3))) scored.push([candidate, contains * 100 + edits + Math.abs(candidate.length - name.length) / 100]);
  }
  return scored.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([candidate]) => candidate);
}

export interface IconOptions {
  /** The catalogs the host registered: their `iconSets` (records or loaders) are where `<set>:<name>` resolves after the document's own. */
  catalogs?: readonly unknown[];
}

/**
 * Resolve one `icon` value. The order: a deck-local name in the document's `icons`; a set's icon in the sets the document embeds
 * (`catalogs.<group>.iconSets`), then in the registered catalogs' sets (records, or the sets ensureIcons loaded); a source through
 * the document's assets, as a data URI or the text ensureIcons read. `icon-unknown` (with near names) when the set or name is not
 * found, `icon-invalid` for a value or an SVG that cannot be an icon, `icon-unloaded` for a registered set or a source that
 * ensureIcons has not loaded yet (not a problem of the document).
 */
export function resolveIcon(document: unknown, value: unknown, options: IconOptions = {}): IconResolution {
  const reference = parseIconReference(value);
  if (!reference) return { ok: false, code: 'icon-invalid', message: `${JSON.stringify(value)} is not an icon: write "<set>:<name>" (such as "lucide:truck"), a name from the document's icons, or an SVG source ("asset:<id>", "./icon.svg").` };
  const written = String(value).trim();
  if (reference.kind === 'set') {
    const embedded = embeddedSets(document).get(reference.set), registered = registeredSets(options.catalogs).get(reference.set);
    const set = embedded && Object.hasOwn(embedded.icons, reference.name) ? embedded : isRec(registered) ? registered as IconSetRecord : loadedSets.get(reference.set) ?? embedded;
    if (!set) {
      if (typeof registered === 'function') return { ok: false, code: 'icon-unloaded', message: `The icon set ${reference.set} is registered but not loaded yet (ensureIcons).` };
      const known = new Set([...embeddedSets(document).keys(), ...registeredSets(options.catalogs).keys(), ...loadedSets.keys()]);
      const suggestions = nearIconNames(reference.set, known);
      return { ok: false, code: 'icon-unknown', message: `No icon set ${reference.set} is embedded or registered${known.size ? ` (sets: ${[...known].sort().join(', ')})` : ''}.`, ...(suggestions.length ? { suggestions: suggestions.map(set => `${set}:${reference.name}`) } : {}) };
    }
    const icon = Object.hasOwn(set.icons, reference.name) ? set.icons[reference.name] : undefined;
    if (icon === undefined) {
      const suggestions = nearIconNames(reference.name, Object.keys(set.icons));
      return { ok: false, code: 'icon-unknown', message: `The icon set ${reference.set} has no icon ${reference.name}.`, ...(suggestions.length ? { suggestions: suggestions.map(name => `${reference.set}:${name}`) } : {}) };
    }
    const parts = setIconParts(set, icon);
    if (!parts) return { ok: false, code: 'icon-invalid', message: `The path data of ${written} cannot be read.` };
    return { ok: true, icon: { reference: written, kind: 'set', set: reference.set, name: reference.name, parts, license: set.license, copyright: set.copyright } };
  }
  let svg: string | undefined, name: string;
  if (reference.kind === 'deck') {
    name = reference.name;
    const local = deckIcon(document, reference.name);
    if (local === undefined) {
      const names = isRec(document) && isRec(document.icons) ? Object.keys(document.icons) : [];
      const suggestions = nearIconNames(reference.name, names);
      return { ok: false, code: 'icon-unknown', message: `The document's icons have no ${reference.name}; a set's icon is written "<set>:<name>", such as "lucide:${reference.name}".`, ...(suggestions.length ? { suggestions } : {}) };
    }
    if (typeof local !== 'string') return { ok: false, code: 'icon-invalid', message: `icons.${reference.name} is not SVG text or an SVG source.` };
    if (local.trim().startsWith('<')) svg = local;
    else { const nested = parseIconReference(local); if (nested?.kind !== 'source') return { ok: false, code: 'icon-invalid', message: `icons.${reference.name} is neither SVG text ("<svg …>") nor an SVG source.` }; return resolveSource(document, nested.src, written, name); }
  } else return resolveSource(document, reference.src, written, reference.src);
  return fromSvg(svg, written, 'deck', name);
}
function fromSvg(svg: string, written: string, kind: 'deck' | 'source', name: string): IconResolution {
  const read = iconFromSvg(svg);
  if (!read.ok) return { ok: false, code: 'icon-invalid', message: read.message };
  return { ok: true, icon: { reference: written, kind, name, ...(read.parts ? { parts: read.parts } : { picture: read.picture! }) } };
}
function resolveSource(document: unknown, src: string, written: string, name: string): IconResolution {
  const source = sourceOf(document, src);
  if (source === undefined) return { ok: false, code: 'icon-unknown', message: `The asset ${src.slice(6)} the icon names is not in the document's assets.` };
  const text = source.startsWith('data:') ? dataUriText(source) : sourceTexts.get(source);
  if (text === undefined) return source.startsWith('data:') ? { ok: false, code: 'icon-invalid', message: 'An icon data URI must be an SVG (data:image/svg+xml).' } : { ok: false, code: 'icon-unloaded', message: `The SVG ${source} has not been read yet (ensureIcons with readSource).` };
  return fromSvg(text, written, 'source', name);
}

/** What ensureIcons loads: the registered sets the document names that are not loaded yet, and the SVG files it has not read. */
export function iconsPending(document: unknown, options: IconOptions = {}): { sets: string[]; sources: string[] } {
  const sets = new Set<string>(), sources = new Set<string>(), registered = registeredSets(options.catalogs), embedded = embeddedSets(document);
  const visit = (value: unknown) => {
    const reference = parseIconReference(value);
    if (reference?.kind === 'set') { if (!loadedSets.has(reference.set) && typeof registered.get(reference.set) === 'function' && !(embedded.get(reference.set) && Object.hasOwn(embedded.get(reference.set)!.icons, reference.name))) sets.add(reference.set); }
    else if (reference?.kind === 'source') { const source = sourceOf(document, reference.src); if (source && !source.startsWith('data:') && !sourceTexts.has(source)) sources.add(source); }
    else if (reference?.kind === 'deck') { const local = deckIcon(document, reference.name); if (typeof local === 'string' && !local.trim().startsWith('<')) visit(local); }
  };
  for (const { value } of documentIcons(document)) visit(value);
  return { sets: [...sets], sources: [...sources] };
}

/**
 * Load what a document's icons need before the synchronous code reads them: each registered set it names that is a loader (the
 * gallery's sets load on first use, so a deck that draws no icon never loads one), and, with `readSource`, each SVG file it names (an
 * asset, a relative path or an HTTPS URL; core never fetches by itself). Resolves with the sets and sources it loaded. Cheap when
 * nothing is pending. opf-pptx's `toPptx`, the renderer's browser fonts handle, core's Node file API, the CLI and the MCP call it.
 */
export async function ensureIcons(document: unknown, options: IconOptions & { readSource?: (source: string) => Promise<string | Uint8Array | undefined> } = {}): Promise<{ sets: string[]; sources: string[] }> {
  const pending = iconsPending(document, options), registered = registeredSets(options.catalogs), loaded: string[] = [], read: string[] = [];
  // A set registered as its record is available to the synchronous code (composition has no catalogs option) as a loaded one is.
  for (const [id, set] of registered) if (isRec(set) && !loadedSets.has(id) && isRec(set.icons)) loadedSets.set(id, set as unknown as IconSetRecord);
  await Promise.all(pending.sets.map(async id => {
    const loader = registered.get(id);
    if (typeof loader !== 'function') return;
    const module = await loader();
    const record = isRec(module) && isRec(module.default) && !isRec(module.icons) ? module.default : module;
    if (isRec(record) && isRec(record.icons) && Array.isArray(record.viewBox)) { loadedSets.set(id, record as unknown as IconSetRecord); loaded.push(id); }
  }));
  if (options.readSource) await Promise.all(pending.sources.map(async source => {
    try {
      const bytes = await options.readSource!(source);
      if (bytes === undefined) return;
      sourceTexts.set(source, typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes));
      read.push(source);
    } catch { /* an unreadable file stays unloaded: resolveIcon reports it */ }
  }));
  return { sets: loaded, sources: read };
}

/** The finding an icon value gets in validation, or undefined when it resolves (or waits on a load the host has not made). */
export function iconIssue(document: unknown, value: unknown, options: IconOptions = {}): Extract<IconResolution, { ok: false }> | undefined {
  const resolution = resolveIcon(document, value, options);
  return resolution.ok || resolution.code === 'icon-unloaded' ? undefined : resolution;
}

/**
 * Embed the set icons a document uses: each set's icons it names go under `catalogs.default.iconSets.<id>` (the set's license,
 * copyright, viewBox and style, and only those icons), so the document draws them with no registered catalog. The group is the one
 * the set's catalog is the source of: `default` when the document's default has that source or names none (it is then given the
 * source), else `custom`. A registered set embeds once it is loaded (ensureIcons). Returns a copy, and the `<set>:<name>` added.
 */
export function embedIcons(document: unknown, options: IconOptions = {}): { document: unknown; added: string[] } {
  if (!isRec(document)) return { document, added: [] };
  const wanted = new Map<string, Set<string>>();
  for (const { value } of documentIcons(document)) { const reference = parseIconReference(value); if (reference?.kind === 'set') (wanted.get(reference.set) ?? wanted.set(reference.set, new Set()).get(reference.set)!).add(reference.name); }
  const embedded = embeddedSets(document), registered = registeredSources(options.catalogs), added: string[] = [];
  const catalogs: Rec = isRec(document.catalogs) ? { ...document.catalogs } : {};
  const groups = new Map<string, Rec>();
  const groupFor = (origin: string): Rec | undefined => {
    const current = isRec(catalogs.default) ? catalogs.default as Rec : undefined;
    const name = catalogs.default === false || (current && typeof current.source === 'string' && current.source !== origin) ? 'custom' : 'default';
    if (!groups.has(name)) {
      const base: Rec = isRec(catalogs[name]) ? { ...catalogs[name] as Rec } : {};
      if (name === 'default' && base.source === undefined) base.source = origin;
      groups.set(name, { ...base, iconSets: isRec(base.iconSets) ? { ...base.iconSets as Rec } : {} });
    }
    return groups.get(name)!.iconSets as Rec;
  };
  for (const [id, names] of wanted) {
    const own = embedded.get(id), entry = registered.get(id), source = (entry && isRec(entry.set) ? entry.set as IconSetRecord : undefined) ?? (entry ? loadedSets.get(id) : undefined);
    if (!source || !entry) continue;
    const sets = groupFor(entry.source)!;
    const missing = [...names].filter(name => !(own && Object.hasOwn(own.icons, name)) && Object.hasOwn(source.icons, name)).sort();
    if (!missing.length) continue;
    const base = isRec(sets[id]) ? sets[id] as Rec : (({ icons: _icons, tags: _tags, licenseText: _text, ...rest }) => Object.fromEntries(Object.entries(rest).filter(([key]) => key !== '$schema' && key !== 'id' && !key.startsWith('x-'))))(source as unknown as Rec & IconSetRecord);
    sets[id] = { ...base, icons: { ...(isRec(base.icons) ? base.icons : {}), ...Object.fromEntries(missing.map(name => [name, source.icons[name]])) } };
    added.push(...missing.map(name => `${id}:${name}`));
  }
  if (!added.length) return { document, added };
  return { document: { ...document, catalogs: { ...catalogs, ...Object.fromEntries(groups) } }, added };
}

// ------------------------------------------------------------------------------------------------------------------------------
// Colors

/** The color of an icon's chip or glyph: the slide's primary with a DrawingML luminance transform, or a scheme slot. */
export interface IconPaint { hex: string; role: 'primary' | 'bg1' | 'tx1'; lumMod?: number; lumOff?: number }
/** LH-14: on a light slide the chip is the primary lightened to 20% of its luminance plus 80% (PowerPoint's "Lighter 80%"). */
export const ICON_CHIP_TINT = { lumMod: 20000, lumOff: 80000 } as const;
/** The least contrast of an icon's glyph against its chip (WCAG 1.4.11, graphical objects). */
export const ICON_MIN_CONTRAST = 3;

/**
 * LH-14: the chip and glyph colors of an icon, as Claude Design draws an icon chip. On a light slide: a chip in a light tint of the
 * primary (ICON_CHIP_TINT) with the glyph in the primary; on a dark one the inverse: a primary chip with the glyph in the scheme
 * color that reads best on it (readableSchemeColor). A glyph under ICON_MIN_CONTRAST against its chip takes the text color instead.
 * The export writes the primary as its theme accent with the same transform, so the icon recolors with the theme.
 */
export function iconColors(roles: Pick<ResolvedColorRoles, 'primary' | 'text' | 'background'>, dark: boolean): { chip: IconPaint; glyph: IconPaint } {
  const primary = normalizeHexColor(roles.primary) ?? roles.primary;
  if (dark) {
    const readable = readableSchemeColor(primary, roles as ResolvedColorRoles);
    return { chip: { hex: primary, role: 'primary' }, glyph: { hex: readable.hex, role: readable.slot === 'bg1' ? 'bg1' : 'tx1' } };
  }
  const chip: IconPaint = { hex: applyLuminance(primary, ICON_CHIP_TINT.lumMod, ICON_CHIP_TINT.lumOff), role: 'primary', ...ICON_CHIP_TINT };
  const glyph: IconPaint = (colorContrast(primary, chip.hex) ?? 0) >= ICON_MIN_CONTRAST ? { hex: primary, role: 'primary' } : { hex: normalizeHexColor(roles.text) ?? roles.text, role: 'tx1' };
  return { chip, glyph };
}
