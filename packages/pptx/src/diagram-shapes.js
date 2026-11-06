// SH-07: a diagram as native PowerPoint shapes (`toPptx(deck, { diagrams: "shapes" })`).
//
// The input is the SVG the preview draws: core's paintDiagram of pele's laid-out drawing in the slide's palette and fonts (with pele's
// classes kept, so nodes, edges and labels can be told apart). One geometry serves the preview and the PPTX: nothing is laid out or
// routed again, every shape is pele's own outline at pele's own place.
//
// - `rect`, `circle`, `ellipse`, `polygon`, `polyline`, `line` and `path` are p:sp shapes. A rectangle, a rounded rectangle (equal
//   corner radii), an ellipse and a polygon that is exactly a preset (diamond, hexagon, parallelogram, trapezoid, triangle) are written
//   as a:prstGeom, checked against SH-01's geometry (core presetMask); every other outline is a:custGeom of its exact path. Transforms
//   are flattened into the coordinates (a rotated preset keeps a:xfrm rot).
// - Fill and stroke are a:solidFill (with a:alpha for fill-opacity, stroke-opacity and group opacity) or a:gradFill (an SVG
//   linearGradient, its stops moved onto the shape's box as DrawingML measures them), and a:ln with the width, cap, join, miter limit
//   and dash (a:custDash in line widths).
// - An edge (pele's `pele-edge` group) is one p:cxnSp of custom geometry: its line exactly as pele routed it, and its arrowheads (pele's
//   `pele-marker` paths) as filled or stroked subpaths of the same geometry, so the arrowheads keep pele's shape and size, which
//   DrawingML's line ends (at most five line widths long) cannot. An end that touches a connection site of a node (SH-01's sites of the
//   node's preset, or the four edge midpoints of a custom outline, written as its a:cxnLst) is bound with a:stCxn or a:endCxn, so the
//   edge follows the node in PowerPoint; any other end stays unbound. A marker whose paint the line cannot share is its own shape.
// - Text is real text: each `text` element (its `tspan` lines and runs) at pele's baseline, in the measured font, size, weight, style and
//   color, aligned by its anchor, with no wrapping and no autofit. A node's label (a `pele-label` that fits inside the node's outline)
//   and an edge label are the text of their shape; any other text is a text box. PowerPoint puts the first baseline of exactly spaced
//   lines at three quarters of the line pitch below the top of the text (measured in PowerPoint for Aptos, Arial, Georgia, Segoe UI and
//   Cambria, at least 1.35 times the size), so every text body is written with exact spacing of at least 1.4 times its size and placed by
//   that rule.
//
// What has no native form (a clip path, mask, filter, pattern, marker element, image, `use`, a text path, right-to-left text, a
// positioned tspan with dx or dy, a radial gradient) makes the converter return `{ unsupported }`; the diagram then stays a picture.
//
// Every shape goes into one p:grpSp named after the diagram, with its alt text as the group's description. The shape ids are
// placeholders (`{{id:N}}`) the packaging step numbers (writeDiagramGroups).

import { composeShape, presetMask, shapeSites } from '@openpresentation/opf/composition';

const EMU = 9525;
const emu = value => Math.round(value * EMU);
const xmlEscape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
/** PowerPoint puts the first baseline of exactly spaced lines this share of the line pitch below the top of the text. */
export const DIAGRAM_BASELINE_SHARE = 0.75;
/** The smallest line pitch, in sizes, at which that rule holds for every font measured (below it the font's own ascent decides). */
export const DIAGRAM_MIN_PITCH = 1.35;
/** The pitch a single line is written with, in sizes. */
const SINGLE_PITCH = 1.4;
const ID = n => `{{id:${n}}}`;

// --- a small XML reader for pele's drawing (well-formed, escaped, no DTD) -------------------------------------------------------------

function decode(text) {
  return text.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[\da-f]+);/gi, (_, entity) => {
    const lower = entity.toLowerCase();
    if (lower === 'lt') return '<';
    if (lower === 'gt') return '>';
    if (lower === 'quot') return '"';
    if (lower === 'apos') return "'";
    if (lower === 'amp') return '&';
    const code = lower.startsWith('#x') ? Number.parseInt(lower.slice(2), 16) : Number(lower.slice(1));
    return Number.isFinite(code) ? String.fromCodePoint(code) : '';
  });
}

export function parseSvg(svg) {
  const root = { name: '#root', attrs: {}, children: [] };
  const stack = [root];
  const pattern = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/([\w:-]+)\s*>|<([\w:-]+)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)/g;
  for (const match of svg.matchAll(pattern)) {
    const [, close, open, attributes, selfClosing, text] = match;
    const parent = stack.at(-1);
    if (close) { if (stack.length > 1) stack.pop(); continue; }
    if (open) {
      const attrs = {};
      for (const [, name, value] of attributes.matchAll(/\s+([\w:-]+)\s*=\s*"([^"]*)"/g)) attrs[name] = decode(value);
      const node = { name: open, attrs, children: [] };
      parent.children.push(node);
      if (!selfClosing) stack.push(node);
      continue;
    }
    if (text !== undefined) parent.children.push({ text: decode(text) });
  }
  return root.children.find(node => node.name === 'svg') ?? root;
}

// --- 2-D affine transforms: [a, b, c, d, e, f] as SVG's matrix() --------------------------------------------------------------------

const IDENTITY = [1, 0, 0, 1, 0, 0];
const multiply = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const numbersOf = text => (String(text).match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []).map(Number);

export function parseTransform(text) {
  let matrix = IDENTITY;
  if (!text) return matrix;
  for (const [, kind, args] of String(text).matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const v = numbersOf(args);
    let step;
    if (kind === 'translate') step = [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0];
    else if (kind === 'scale') step = [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0];
    else if (kind === 'rotate') {
      const r = (v[0] ?? 0) * Math.PI / 180, cos = Math.cos(r), sin = Math.sin(r), cx = v[1] ?? 0, cy = v[2] ?? 0;
      step = multiply(multiply([1, 0, 0, 1, cx, cy], [cos, sin, -sin, cos, 0, 0]), [1, 0, 0, 1, -cx, -cy]);
    } else if (kind === 'matrix' && v.length === 6) step = v;
    else if (kind === 'skewX') step = [1, 0, Math.tan((v[0] ?? 0) * Math.PI / 180), 1, 0, 0];
    else if (kind === 'skewY') step = [1, Math.tan((v[0] ?? 0) * Math.PI / 180), 0, 1, 0, 0];
    else throw unsupported(`the transform ${kind}()`);
    matrix = multiply(matrix, step);
  }
  return matrix;
}
// The rotation (degrees clockwise), the uniform scale and whether the matrix is a similarity (no skew, no mirror, uniform scale).
function decompose(m) {
  const sx = Math.hypot(m[0], m[1]), sy = Math.hypot(m[2], m[3]);
  const det = m[0] * m[3] - m[1] * m[2];
  const similar = det > 0 && Math.abs(sx - sy) < 1e-6 * Math.max(sx, 1) && Math.abs(m[0] * m[2] + m[1] * m[3]) < 1e-6 * Math.max(sx * sy, 1);
  return { rotate: Math.atan2(m[1], m[0]) * 180 / Math.PI, scale: Math.sqrt(Math.abs(det)), similar };
}

// --- path data: every SVG command to absolute M, L, C, Q and Z --------------------------------------------------------------------

/** SVG path data as absolute segments: ['M', x, y], ['L', x, y], ['C', x1, y1, x2, y2, x, y], ['Q', x1, y1, x, y], ['Z']. */
export function parsePath(d) {
  const tokens = String(d).match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const out = [];
  let at = 0, command = '', x = 0, y = 0, startX = 0, startY = 0, lastControl = null, lastKind = '';
  const more = () => at < tokens.length && !/^[A-Za-z]$/.test(tokens[at]);
  const read = () => Number(tokens[at++]);
  // The arc flags may be written without separators ("a5 5 0 015 5"): split a run of flag digits.
  const flag = () => {
    const token = tokens[at];
    if (token.length > 1 && /^[01]/.test(token)) { tokens[at] = token.slice(1); return Number(token[0]); }
    at++;
    return Number(token);
  };
  while (at < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[at])) command = tokens[at++];
    else if (!command) throw unsupported('path data that does not start with a command');
    const relative = command === command.toLowerCase(), kind = command.toUpperCase();
    const ox = relative ? x : 0, oy = relative ? y : 0;
    if (kind === 'Z') { out.push(['Z']); x = startX; y = startY; lastControl = null; lastKind = 'Z'; command = ''; continue; }
    if (!more()) throw unsupported('path data with a missing coordinate');
    if (kind === 'M') {
      x = ox + read(); y = oy + read(); startX = x; startY = y; out.push(['M', x, y]);
      command = relative ? 'l' : 'L'; lastControl = null; lastKind = 'M'; continue;
    }
    if (kind === 'L') { x = ox + read(); y = oy + read(); out.push(['L', x, y]); lastKind = 'L'; lastControl = null; continue; }
    if (kind === 'H') { x = ox + read(); out.push(['L', x, y]); lastKind = 'L'; lastControl = null; continue; }
    if (kind === 'V') { y = oy + read(); out.push(['L', x, y]); lastKind = 'L'; lastControl = null; continue; }
    if (kind === 'C' || kind === 'S') {
      let x1, y1;
      if (kind === 'C') { x1 = ox + read(); y1 = oy + read(); }
      else if (lastKind === 'C' && lastControl) { x1 = 2 * x - lastControl[0]; y1 = 2 * y - lastControl[1]; }
      else { x1 = x; y1 = y; }
      const x2 = ox + read(), y2 = oy + read(), ex = ox + read(), ey = oy + read();
      out.push(['C', x1, y1, x2, y2, ex, ey]); lastControl = [x2, y2]; lastKind = 'C'; x = ex; y = ey; continue;
    }
    if (kind === 'Q' || kind === 'T') {
      let x1, y1;
      if (kind === 'Q') { x1 = ox + read(); y1 = oy + read(); }
      else if (lastKind === 'Q' && lastControl) { x1 = 2 * x - lastControl[0]; y1 = 2 * y - lastControl[1]; }
      else { x1 = x; y1 = y; }
      const ex = ox + read(), ey = oy + read();
      out.push(['Q', x1, y1, ex, ey]); lastControl = [x1, y1]; lastKind = 'Q'; x = ex; y = ey; continue;
    }
    if (kind === 'A') {
      const rx = read(), ry = read(), rotation = read(), large = flag(), sweep = flag(), ex = ox + read(), ey = oy + read();
      out.push(...arcToCubics(x, y, rx, ry, rotation, large, sweep, ex, ey));
      x = ex; y = ey; lastControl = null; lastKind = 'A'; continue;
    }
    throw unsupported(`the path command ${command}`);
  }
  return out;
}

// An SVG elliptical arc (any x-axis rotation) as cubic Béziers of at most a quarter turn each (SVG 1.1 implementation notes, F.6).
function arcToCubics(x1, y1, rx, ry, rotation, large, sweep, x2, y2) {
  if (x1 === x2 && y1 === y2) return [];
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (!rx || !ry) return [['L', x2, y2]];
  const phi = rotation * Math.PI / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const sign = large === sweep ? -1 : 1;
  const numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const factor = sign * Math.sqrt(Math.max(0, numerator / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
  const cxp = factor * rx * y1p / ry, cyp = -factor * ry * x1p / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const theta = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  else if (sweep && delta < 0) delta += 2 * Math.PI;
  const segments = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9)), step = delta / segments, k = 4 / 3 * Math.tan(step / 4);
  const point = (u, v) => [cx + cos * u - sin * v, cy + sin * u + cos * v];
  const out = [];
  for (let index = 0; index < segments; index++) {
    const a = theta + index * step, b = a + step;
    const p1 = point(rx * (Math.cos(a) - k * Math.sin(a)), ry * (Math.sin(a) + k * Math.cos(a)));
    const p2 = point(rx * (Math.cos(b) + k * Math.sin(b)), ry * (Math.sin(b) - k * Math.cos(b)));
    const end = index === segments - 1 ? [x2, y2] : point(rx * Math.cos(b), ry * Math.sin(b));
    out.push(['C', ...p1, ...p2, ...end]);
  }
  return out;
}

const mapSegments = (segments, m) => segments.map(([kind, ...v]) => {
  const points = [];
  for (let index = 0; index < v.length; index += 2) points.push(...apply(m, [v[index], v[index + 1]]));
  return [kind, ...points];
});

// The exact bounds of segments: end points and the extrema of every curve.
function boundsOf(segments) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, px = 0, py = 0;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  const roots = (a, b, c) => {
    if (Math.abs(a) < 1e-12) return Math.abs(b) < 1e-12 ? [] : [-c / b];
    const disc = b * b - 4 * a * c;
    if (disc < 0) return [];
    const s = Math.sqrt(disc);
    return [(-b + s) / (2 * a), (-b - s) / (2 * a)];
  };
  for (const [kind, ...v] of segments) {
    if (kind === 'M' || kind === 'L') { add(v[0], v[1]); px = v[0]; py = v[1]; continue; }
    if (kind === 'C') {
      const [ax, ay, bx, by, ex, ey] = v;
      add(ex, ey);
      for (const [p0, p1, p2, p3, axis] of [[px, ax, bx, ex, 0], [py, ay, by, ey, 1]]) {
        for (const t of roots(3 * (-p0 + 3 * p1 - 3 * p2 + p3), 6 * (p0 - 2 * p1 + p2), 3 * (p1 - p0))) {
          if (t <= 0 || t >= 1) continue;
          const u = 1 - t, value = u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
          if (axis === 0) add(value, py); else add(px, value);
        }
      }
      // add(value, py) above may widen y by the start point, which is already inside.
      px = ex; py = ey; continue;
    }
    if (kind === 'Q') {
      const [ax, ay, ex, ey] = v;
      add(ex, ey);
      for (const [p0, p1, p2, axis] of [[px, ax, ex, 0], [py, ay, ey, 1]]) {
        const denominator = p0 - 2 * p1 + p2;
        if (Math.abs(denominator) < 1e-12) continue;
        const t = (p0 - p1) / denominator;
        if (t <= 0 || t >= 1) continue;
        const value = (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
        if (axis === 0) add(value, py); else add(px, value);
      }
      px = ex; py = ey;
    }
  }
  return Number.isFinite(x0) ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : undefined;
}

// --- paint -------------------------------------------------------------------------------------------------------------------------

const INHERITED = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'text-decoration', 'letter-spacing', 'xml:space'];

function unsupported(reason) {
  return Object.assign(new Error(reason), { diagramShapes: reason });
}

/** An SVG paint: `{ none: true }`, `{ hex, alpha }` or `{ gradient: id }`. */
function paintOf(value) {
  const text = String(value ?? '').trim();
  if (!text || text === 'none' || text === 'transparent') return { none: true };
  const url = /^url\(\s*#([^)\s]+)\s*\)/.exec(text);
  if (url) return { gradient: url[1] };
  let hex = /^#([\da-f]{3,8})$/i.exec(text)?.[1];
  if (hex) {
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map(char => char + char).join('');
    if (hex.length !== 6 && hex.length !== 8) throw unsupported(`the color ${text}`);
    return { hex: hex.slice(0, 6).toUpperCase(), alpha: hex.length === 8 ? Number.parseInt(hex.slice(6), 16) / 255 : 1 };
  }
  const rgb = /^rgba?\(([^)]*)\)$/i.exec(text);
  if (rgb) {
    const [r, g, b, a = 1] = numbersOf(rgb[1]);
    return { hex: [r, g, b].map(channel => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0')).join('').toUpperCase(), alpha: a };
  }
  if (/^(black|white)$/i.test(text)) return { hex: /^black$/i.test(text) ? '000000' : 'FFFFFF', alpha: 1 };
  throw unsupported(`the color ${text}`);
}
const opacityOf = value => { const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 1; };
const colorXml = (hex, alpha) => { const value = Math.round(alpha * 100000); return `<a:srgbClr val="${hex}">${value < 100000 ? `<a:alpha val="${value}"/>` : ''}</a:srgbClr>`; };

// A linear gradient's stops on the shape's box as DrawingML measures a:lin (the gradient line through the box at the angle, its
// ends where the perpendiculars through the box's far corners cross it, as CSS does), clamped to the box with the colors at its ends.
function gradientFill(gradient, box, matrix, alpha) {
  const user = gradient.units !== 'objectBoundingBox';
  if (!user) throw unsupported('a gradient in bounding-box units');
  const start = apply(matrix, [gradient.x1, gradient.y1]), end = apply(matrix, [gradient.x2, gradient.y2]);
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  if (!length || box.width <= 0 && box.height <= 0) return `<a:solidFill>${colorXml(gradient.stops.at(-1)?.hex ?? '000000', alpha * (gradient.stops.at(-1)?.alpha ?? 1))}</a:solidFill>`;
  const dir = [(end[0] - start[0]) / length, (end[1] - start[1]) / length];
  const span = Math.abs(box.width * dir[0]) + Math.abs(box.height * dir[1]);
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2, origin = [cx - dir[0] * span / 2, cy - dir[1] * span / 2];
  const place = offset => { const p = [start[0] + offset * (end[0] - start[0]), start[1] + offset * (end[1] - start[1])]; return ((p[0] - origin[0]) * dir[0] + (p[1] - origin[1]) * dir[1]) / span; };
  const stops = gradient.stops.map(stop => ({ ...stop, position: place(stop.offset) }));
  const colorAt = position => {
    if (position <= stops[0].position) return stops[0];
    if (position >= stops.at(-1).position) return stops.at(-1);
    const index = stops.findIndex(stop => stop.position >= position), a = stops[index - 1], b = stops[index];
    const share = (position - a.position) / Math.max(1e-12, b.position - a.position);
    const channel = (from, to, offset) => Math.round(Number.parseInt(from.slice(offset, offset + 2), 16) * (1 - share) + Number.parseInt(to.slice(offset, offset + 2), 16) * share).toString(16).padStart(2, '0');
    return { hex: [0, 2, 4].map(offset => channel(a.hex, b.hex, offset)).join('').toUpperCase(), alpha: a.alpha * (1 - share) + b.alpha * share };
  };
  const inside = stops.filter(stop => stop.position > 0 && stop.position < 1);
  const all = [{ ...colorAt(0), position: 0 }, ...inside, { ...colorAt(1), position: 1 }];
  const angle = Math.round(((Math.atan2(dir[1], dir[0]) * 180 / Math.PI) % 360 + 360) % 360 * 60000) % 21600000;
  return `<a:gradFill rotWithShape="1"><a:gsLst>${all.map(stop => `<a:gs pos="${Math.round(stop.position * 100000)}">${colorXml(stop.hex, stop.alpha * alpha)}</a:gs>`).join('')}</a:gsLst><a:lin ang="${angle}" scaled="0"/></a:gradFill>`;
}

// --- the converter -----------------------------------------------------------------------------------------------------------------

const classesOf = node => new Set(String(node.attrs?.class ?? '').split(/\s+/).filter(Boolean));
const GRAPHICS = new Set(['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path']);
const IGNORED = new Set(['title', 'desc', 'metadata', 'style']);
const UNSUPPORTED = { clipPath: 'a clip path', mask: 'a mask', filter: 'a filter', pattern: 'a pattern', marker: 'a marker element', image: 'an image', use: 'a use element', foreignObject: 'embedded HTML', textPath: 'text on a path', radialGradient: 'a radial gradient', switch: 'a switch element', symbol: 'a symbol' };
const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

/**
 * Convert a painted diagram SVG to the children of one p:grpSp. `options`:
 * - `box` {x, y, width, height}: where the drawing goes on the slide, in pixels; the drawing's viewBox is scaled uniformly into it;
 * - `name` (the group's name) and `alt` (its description);
 * - `measure(text, sizePx, {family, bold, italic})`: the width of a run in pixels, as composition measures;
 * - `font(family, bold, italic)`: the native face `{fontFace, bold, italic}` the export writes for a run (nativeFontOptions);
 * - `lang`: the run language.
 * Returns `{ xml, ids, shapes, connectors, bound }` (ids: how many shape id placeholders the XML uses, the group's being {{id:0}}), or
 * `{ unsupported }` naming what has no native form.
 */
export function diagramShapes(svg, options) {
  try {
    return convert(parseSvg(svg), options);
  } catch (error) {
    if (error?.diagramShapes) return { unsupported: error.diagramShapes };
    throw error;
  }
}

function convert(root, options) {
  const viewBox = numbersOf(root.attrs.viewBox ?? '');
  const [vx, vy, vw, vh] = viewBox.length === 4 ? viewBox : [0, 0, Number(root.attrs.width) || 1, Number(root.attrs.height) || 1];
  const box = options.box;
  const scale = Math.min(box.width / Math.max(vw, 1e-9), box.height / Math.max(vh, 1e-9));
  const offsetX = box.x + (box.width - vw * scale) / 2 - vx * scale, offsetY = box.y + (box.height - vh * scale) / 2 - vy * scale;
  const base = [scale, 0, 0, scale, offsetX, offsetY];
  const gradients = new Map();
  const collectGradients = node => {
    for (const child of node.children ?? []) {
      if (child.name === 'linearGradient') {
        const stops = child.children.filter(stop => stop.name === 'stop').map(stop => {
          const paint = paintOf(stop.attrs['stop-color'] ?? '#000000');
          if (!paint.hex) throw unsupported('a gradient stop without a color');
          const offset = String(stop.attrs.offset ?? '0');
          return { offset: Math.max(0, Math.min(1, offset.endsWith('%') ? Number(offset.slice(0, -1)) / 100 : Number(offset) || 0)), hex: paint.hex, alpha: paint.alpha * opacityOf(stop.attrs['stop-opacity'] ?? 1) };
        });
        if (!stops.length) throw unsupported('a gradient without stops');
        if (child.attrs.gradientTransform || (child.attrs.spreadMethod && child.attrs.spreadMethod !== 'pad') || child.attrs.href || child.attrs['xlink:href']) throw unsupported('a transformed, repeated or linked gradient');
        const length = (value, fallback) => { const text = String(value ?? fallback); return text.endsWith('%') ? Number(text.slice(0, -1)) / 100 : Number(text); };
        gradients.set(child.attrs.id, { units: child.attrs.gradientUnits ?? 'objectBoundingBox', x1: length(child.attrs.x1, '0%'), y1: length(child.attrs.y1, '0%'), x2: length(child.attrs.x2, '100%'), y2: length(child.attrs.y2, '0%'), stops });
      } else if (child.name && child.name !== 'text') collectGradients(child);
    }
  };
  collectGradients(root);

  const out = { items: [], nodes: [], ids: 1 };
  const state = { fill: root.attrs.fill ?? '#000000', 'font-family': root.attrs['font-family'] ?? 'sans-serif', 'font-size': root.attrs['font-size'] ?? '16', opacity: 1 };
  walk(root, state, base, { node: undefined, edge: undefined, edgeLabel: undefined }, out, { gradients, options, scale });
  return withGradients(gradients, () => assemble(out, options));
}

function viewportTransform(attrs) {
  const x = Number.parseFloat(attrs.x ?? '0') || 0, y = Number.parseFloat(attrs.y ?? '0') || 0;
  const box = numbersOf(attrs.viewBox ?? '');
  if (box.length !== 4 || !(box[2] > 0 && box[3] > 0)) return [1, 0, 0, 1, x, y];
  if (attrs.preserveAspectRatio && attrs.preserveAspectRatio !== 'xMidYMid meet' && attrs.preserveAspectRatio !== 'xMidYMid') throw unsupported(`a nested viewport with preserveAspectRatio ${attrs.preserveAspectRatio}`);
  const width = Number.parseFloat(attrs.width ?? `${box[2]}`), height = Number.parseFloat(attrs.height ?? `${box[3]}`);
  const scale = Math.min(width / box[2], height / box[3]);
  return [scale, 0, 0, scale, x + (width - box[2] * scale) / 2 - box[0] * scale, y + (height - box[3] * scale) / 2 - box[1] * scale];
}

function inherit(node, parent) {
  const style = { ...parent, opacity: parent.opacity * opacityOf(node.attrs.opacity ?? 1) };
  for (const key of INHERITED) if (node.attrs[key] !== undefined && node.attrs[key] !== 'inherit') style[key] = node.attrs[key];
  return style;
}

function walk(node, style, matrix, scope, out, env) {
  for (const child of node.children) {
    if (!child.name) continue;
    if (UNSUPPORTED[child.name]) throw unsupported(UNSUPPORTED[child.name]);
    if (child.name === 'defs' || child.name === 'linearGradient' || IGNORED.has(child.name)) continue;
    if (child.attrs['clip-path'] || child.attrs.mask || child.attrs.filter) throw unsupported('a clip path, mask or filter');
    if (child.attrs.display === 'none' || child.attrs.visibility === 'hidden') continue;
    const own = inherit(child, style);
    let local = child.attrs.transform ? multiply(matrix, parseTransform(child.attrs.transform)) : matrix;
    // A nested svg (pele's icons) is its own viewport: placed at x, y and its viewBox fitted into width by height (xMidYMid meet).
    if (child.name === 'svg') local = multiply(local, viewportTransform(child.attrs));
    if (child.name === 'g' || child.name === 'svg' || child.name === 'a') {
      const classes = classesOf(child);
      const next = { ...scope };
      if (classes.has('pele-node') && !scope.edge) next.node = { id: child.attrs['data-id'], outline: undefined, label: undefined, shapes: [] };
      if (classes.has('pele-edge') && !classes.has('pele-edges')) next.edge = { id: child.attrs['data-id'], parts: [] };
      if (classes.has('pele-edge-label')) next.edgeLabel = { outline: undefined };
      walk(child, own, local, next, out, env);
      if (next.edge && next.edge !== scope.edge) out.items.push({ kind: 'edge', edge: next.edge });
      if (next.node && next.node !== scope.node) out.nodes.push(next.node);
      continue;
    }
    if (child.name === 'text') { out.items.push(textItem(child, own, local, scope, env)); continue; }
    if (!GRAPHICS.has(child.name)) throw unsupported(`the element ${child.name}`);
    const shape = graphic(child, own, local, env);
    if (!shape) continue;
    if (scope.edge) { scope.edge.parts.push({ ...shape, marker: classesOf(child).has('pele-marker') }); continue; }
    const item = { kind: 'shape', shape, classes: classesOf(child) };
    if (scope.node && !scope.node.outline && shape.closed) { scope.node.outline = item; item.node = scope.node; }
    if (scope.edgeLabel && !scope.edgeLabel.outline && shape.closed) { scope.edgeLabel.outline = item; item.edgeLabel = true; }
    out.items.push(item);
  }
}

// One drawn primitive: its outline (segments in slide pixels), the preset it is exactly, and its paint.
function graphic(node, style, matrix, env) {
  const a = node.attrs, number = (key, fallback = 0) => { const value = Number.parseFloat(a[key]); return Number.isFinite(value) ? value : fallback; };
  const { rotate, scale, similar } = decompose(matrix);
  let segments, closed = true, preset;
  if (node.name === 'rect') {
    const x = number('x'), y = number('y'), w = number('width'), h = number('height');
    if (!(w > 0 && h > 0)) return undefined;
    let rx = a.rx !== undefined ? number('rx') : undefined, ry = a.ry !== undefined ? number('ry') : undefined;
    rx = Math.min(Math.max(0, rx ?? ry ?? 0), w / 2); ry = Math.min(Math.max(0, ry ?? rx), h / 2);
    segments = rx > 0 && ry > 0
      ? [['M', x + rx, y], ['L', x + w - rx, y], ...arcToCubics(x + w - rx, y, rx, ry, 0, 0, 1, x + w, y + ry), ['L', x + w, y + h - ry], ...arcToCubics(x + w, y + h - ry, rx, ry, 0, 0, 1, x + w - rx, y + h), ['L', x + rx, y + h], ...arcToCubics(x + rx, y + h, rx, ry, 0, 0, 1, x, y + h - ry), ['L', x, y + ry], ...arcToCubics(x, y + ry, rx, ry, 0, 0, 1, x + rx, y), ['Z']]
      : [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']];
    if (similar) {
      const frame = { local: { x, y, width: w, height: h } };
      if (!(rx > 0 && ry > 0)) preset = { name: 'rect', ...frame };
      else if (Math.abs(rx - ry) < 1e-6) preset = { name: 'roundRect', adjust: { adj: Math.min(0.5, rx / Math.min(w, h)) }, ...frame };
    }
  } else if (node.name === 'circle' || node.name === 'ellipse') {
    const cx = number('cx'), cy = number('cy');
    const rx = node.name === 'circle' ? number('r') : number('rx', number('ry')), ry = node.name === 'circle' ? rx : number('ry', rx);
    if (!(rx > 0 && ry > 0)) return undefined;
    segments = [['M', cx + rx, cy], ...arcToCubics(cx + rx, cy, rx, ry, 0, 0, 1, cx, cy + ry), ...arcToCubics(cx, cy + ry, rx, ry, 0, 0, 1, cx - rx, cy), ...arcToCubics(cx - rx, cy, rx, ry, 0, 0, 1, cx, cy - ry), ...arcToCubics(cx, cy - ry, rx, ry, 0, 0, 1, cx + rx, cy), ['Z']];
    if (similar) preset = { name: 'ellipse', local: { x: cx - rx, y: cy - ry, width: 2 * rx, height: 2 * ry } };
  } else if (node.name === 'line') {
    segments = [['M', number('x1'), number('y1')], ['L', number('x2'), number('y2')]];
    closed = false;
  } else if (node.name === 'polyline' || node.name === 'polygon') {
    const v = numbersOf(a.points ?? '');
    if (v.length < 4) return undefined;
    const points = [];
    for (let index = 0; index + 1 < v.length; index += 2) points.push([v[index], v[index + 1]]);
    segments = [['M', ...points[0]], ...points.slice(1).map(point => ['L', ...point])];
    if (node.name === 'polygon') { segments.push(['Z']); if (similar) preset = polygonPreset(points); }
    else closed = false;
  } else {
    segments = parsePath(a.d ?? '');
    if (!segments.length) return undefined;
    const moves = segments.filter(segment => segment[0] === 'M').length, closes = segments.filter(segment => segment[0] === 'Z').length;
    closed = closes > 0 && closes >= moves;
  }
  const mapped = mapSegments(segments, matrix);
  const bounds = boundsOf(mapped);
  if (!bounds) return undefined;
  const fill = paintOf(style.fill ?? '#000000'), stroke = paintOf(style.stroke ?? 'none');
  const fillAlpha = style.opacity * opacityOf(style['fill-opacity'] ?? 1), strokeAlpha = style.opacity * opacityOf(style['stroke-opacity'] ?? 1);
  const width = Number.parseFloat(style['stroke-width'] ?? '1');
  const line = stroke.none || !(width > 0) ? undefined : {
    paint: stroke, alpha: strokeAlpha, px: width * scale,
    dash: dashOf(style['stroke-dasharray'], width), offset: Number.parseFloat(style['stroke-dashoffset'] ?? '0') || 0,
    cap: style['stroke-linecap'] ?? 'butt', join: style['stroke-linejoin'] ?? 'miter', miter: Number.parseFloat(style['stroke-miterlimit'] ?? '4') || 4,
  };
  if (line?.offset) throw unsupported('a dash offset');
  // An open path is filled as SVG fills it (closed implicitly); a line or an open polyline usually has no fill.
  const filled = !fill.none && fillAlpha > 0;
  if (!filled && !line) return undefined;
  if (preset) {
    const frame = presetFrame(preset.local, matrix, rotate);
    preset = { ...preset, frame };
    if (!presetMatches(preset, mapped, matrix)) preset = undefined;
  }
  return { segments: mapped, bounds, closed, preset, fill: filled ? { paint: fill, alpha: fillAlpha, matrix } : undefined, line };
}

// A dash array in line widths (a:custDash), or undefined for a solid line.
function dashOf(value, width) {
  if (!value || value === 'none') return undefined;
  const numbers = numbersOf(value).map(entry => Math.max(0, entry));
  if (!numbers.length || numbers.every(entry => entry === 0)) return undefined;
  const list = numbers.length % 2 ? [...numbers, ...numbers] : numbers;
  return list.map(entry => entry / width);
}

// The unrotated frame of a preset in slide pixels: its local box mapped by the matrix about its center, and the rotation.
function presetFrame(local, matrix, rotate) {
  const { scale } = decompose(matrix);
  const center = apply(matrix, [local.x + local.width / 2, local.y + local.height / 2]);
  const width = local.width * scale, height = local.height * scale;
  const turn = ((rotate % 360) + 360) % 360;
  return { x: center[0] - width / 2, y: center[1] - height / 2, width, height, rotate: Math.abs(turn) < 1e-6 || Math.abs(turn - 360) < 1e-6 ? 0 : turn };
}

// The presets a pele polygon may be exactly, fitted from its points (in its own coordinates): the candidate is kept only when SH-01's
// outline of it at that frame and adjust value (presetMatches) has the same corners.
function polygonPreset(points) {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys), width = Math.max(...xs) - x, height = Math.max(...ys) - y;
  if (!(width > 0 && height > 0)) return undefined;
  const local = { x, y, width, height }, ss = Math.min(width, height);
  const near = (a, b) => Math.abs(a - b) < 1e-3 * Math.max(1, width, height);
  if (points.length === 4) {
    const top = points.filter(p => near(p[1], y)), bottom = points.filter(p => near(p[1], y + height));
    if (points.every(p => (near(p[0], x + width / 2) && (near(p[1], y) || near(p[1], y + height))) || (near(p[1], y + height / 2) && (near(p[0], x) || near(p[0], x + width))))) return { name: 'diamond', local };
    if (top.length === 2 && bottom.length === 2) {
      const [t0, t1] = top.map(p => p[0]).sort((m, n) => m - n), [b0, b1] = bottom.map(p => p[0]).sort((m, n) => m - n);
      if (near(t0 - x, x + width - b1) && near(b0, x) && near(t1, x + width) && t0 - x > 0) return { name: 'parallelogram', adjust: { adj: (t0 - x) / ss }, local };
      if (near(t0, x) && near(t1, x + width) && near(b0 - x, x + width - b1) && b0 - x > 0) return { name: 'parallelogram', adjust: { adj: (b0 - x) / ss }, local, flipH: true };
      if (near(b0, x) && near(b1, x + width) && near(t0 - x, x + width - t1) && t0 - x > 0) return { name: 'trapezoid', adjust: { adj: (t0 - x) / ss }, local };
      if (near(t0, x) && near(t1, x + width) && near(b0 - x, x + width - b1) && b0 - x > 0) return { name: 'trapezoid', adjust: { adj: (b0 - x) / ss }, local, flipV: true };
    }
  }
  if (points.length === 3) {
    const apex = points.find(p => near(p[1], y)), base = points.filter(p => near(p[1], y + height));
    if (apex && base.length === 2) return { name: 'triangle', adjust: { adj: (apex[0] - x) / width }, local };
  }
  if (points.length === 6) {
    const middle = points.filter(p => near(p[1], y + height / 2));
    const top = points.filter(p => near(p[1], y));
    if (middle.length === 2 && top.length === 2) return { name: 'hexagon', adjust: { adj: (Math.min(...top.map(p => p[0])) - x) / ss, vf: 1.1547 }, local };
  }
  return undefined;
}

// Whether a preset at its frame is the drawn outline: SH-01's outline of the preset (core presetMask, flipped as the shape would be)
// has the same corners as the polygon, and a rectangle, rounded rectangle and ellipse are exact by construction.
function presetMatches(preset, mapped, matrix) {
  if (preset.name === 'rect' || preset.name === 'roundRect' || preset.name === 'ellipse') return true;
  if (preset.frame.rotate) return false;
  let outline;
  try { outline = presetMask(preset.name, preset.frame, preset.adjust); } catch { return false; }
  if (outline.preset !== preset.name) return false;
  const drawn = mapped.filter(segment => segment[0] === 'M' || segment[0] === 'L').map(segment => segment.slice(1));
  const cx = preset.frame.x + preset.frame.width / 2, cy = preset.frame.y + preset.frame.height / 2;
  const own = parsePath(outline.path).filter(segment => segment[0] === 'M' || segment[0] === 'L').map(([, x, y]) => [preset.flipH ? 2 * cx - x : x, preset.flipV ? 2 * cy - y : y]);
  if (own.length !== drawn.length) return false;
  const tolerance = 0.05 * Math.max(1, decompose(matrix).scale);
  return drawn.every(point => own.some(other => Math.hypot(point[0] - other[0], point[1] - other[1]) <= tolerance));
}

// --- text ----------------------------------------------------------------------------------------------------------------------------

function textItem(node, style, matrix, scope, env) {
  const lines = [];
  let line;
  const position = (attrs, at) => {
    for (const key of ['dx', 'dy', 'rotate', 'textLength', 'lengthAdjust']) if (attrs[key] !== undefined) throw unsupported(`a text ${key}`);
    const x = numbersOf(attrs.x ?? ''), y = numbersOf(attrs.y ?? '');
    if (x.length > 1 || y.length > 1) throw unsupported('a text with several positions');
    return { x: x[0] ?? at?.x, y: y[0] ?? at?.y };
  };
  const start = position(node.attrs, { x: 0, y: 0 });
  const begin = (at, runStyle) => { line = { x: at.x, y: at.y, anchor: runStyle['text-anchor'] ?? 'start', runs: [] }; lines.push(line); };
  begin(start, style);
  const visit = (parent, parentStyle) => {
    for (const child of parent.children) {
      if (child.text !== undefined) { line.runs.push({ text: child.text, style: parentStyle }); continue; }
      if (child.name !== 'tspan') { if (UNSUPPORTED[child.name]) throw unsupported(UNSUPPORTED[child.name]); continue; }
      const own = inherit(child, parentStyle);
      if (child.attrs.transform) throw unsupported('a transformed tspan');
      if (child.attrs.x !== undefined || child.attrs.y !== undefined) {
        const at = position(child.attrs, line);
        // A tspan that starts a line: the text's first (still empty) line takes its place.
        if (!line.runs.some(run => run.text.trim()) ) { line.x = at.x; line.y = at.y; line.anchor = own['text-anchor'] ?? line.anchor; line.runs = []; }
        else begin(at, own);
      } else position(child.attrs);
      visit(child, own);
    }
  };
  visit(node, style);
  const preserve = style['xml:space'] === 'preserve';
  const out = [];
  for (const entry of lines) {
    // SVG's default white space: line breaks removed, tabs to spaces, runs of spaces collapsed, the ends trimmed.
    let runs = entry.runs.map(run => ({ ...run, text: preserve ? run.text.replace(/[\r\n\t]/g, ' ') : run.text.replace(/[\r\n]/g, '').replace(/\t/g, ' ').replace(/ {2,}/g, ' ') }));
    if (!preserve && runs.length) {
      runs = runs.map((run, index) => index > 0 && runs[index - 1].text.endsWith(' ') ? { ...run, text: run.text.replace(/^ +/, '') } : run);
      runs[0] = { ...runs[0], text: runs[0].text.replace(/^ +/, '') };
      runs[runs.length - 1] = { ...runs.at(-1), text: runs.at(-1).text.replace(/ +$/, '') };
    }
    runs = runs.filter(run => run.text.length);
    if (!runs.length) continue;
    if (runs.some(run => RTL.test(run.text))) throw unsupported('right-to-left text');
    out.push({ ...entry, runs: runs.map(run => runOf(run, env)) });
  }
  return { kind: 'text', lines: out, matrix, classes: classesOf(node), node: scope.node, edgeLabel: scope.edgeLabel, edge: scope.edge };
}

function runOf(run, env) {
  const style = run.style;
  const family = firstFamily(style['font-family']);
  const size = Number.parseFloat(style['font-size'] ?? '16');
  if (!(size > 0)) throw unsupported('a text size');
  const weight = String(style['font-weight'] ?? 'normal');
  const bold = weight === 'bold' || weight === 'bolder' || Number(weight) >= 600;
  const italic = /italic|oblique/.test(String(style['font-style'] ?? ''));
  if (style['letter-spacing'] && !/^(normal|0(px)?)$/.test(String(style['letter-spacing']))) throw unsupported('letter spacing');
  const fill = paintOf(style.fill ?? '#000000');
  if (fill.gradient) throw unsupported('gradient text');
  const stroke = paintOf(style.stroke ?? 'none');
  if (stroke.gradient) throw unsupported('gradient text outlines');
  const decoration = String(style['text-decoration'] ?? '');
  return {
    text: run.text, family, size, bold, italic,
    fill: fill.none ? undefined : { hex: fill.hex, alpha: fill.alpha * style.opacity * opacityOf(style['fill-opacity'] ?? 1) },
    stroke: stroke.none ? undefined : { hex: stroke.hex, alpha: stroke.alpha * style.opacity * opacityOf(style['stroke-opacity'] ?? 1), width: Number.parseFloat(style['stroke-width'] ?? '1') || 1 },
    underline: /underline/.test(decoration), strike: /line-through/.test(decoration),
  };
}

const firstFamily = value => String(value ?? 'sans-serif').split(',')[0].trim().replace(/^['"]|['"]$/g, '') || 'sans-serif';

// --- assembly ------------------------------------------------------------------------------------------------------------------------

function assemble(out, options) {
  const parts = [];
  const counters = { shape: 0, text: 0, edge: 0 };
  const name = options.name;
  // Shape ids: the group is {{id:0}}, every child takes the next.
  let next = 1;
  const nodeIds = new Map();
  // Assign ids to node outlines first, so connectors can name them wherever they come in the drawing order.
  for (const item of out.items) if (item.kind === 'shape') item.id = next++;
  for (const item of out.items) if (item.kind === 'shape' && item.node) nodeIds.set(item.node, item);
  // Text that becomes the text of a node's outline or of an edge label's backing.
  for (const item of out.items) {
    if (item.kind !== 'text' || !item.lines.length) continue;
    const owner = item.node?.outline && item.classes.has('pele-label') && !item.node.label ? item.node.outline : item.edgeLabel?.outline && !item.edgeLabel.label ? item.edgeLabel.outline : undefined;
    if (!owner || owner.shape.preset?.frame.rotate) continue;
    const frame = owner.shape.preset?.frame ?? owner.shape.bounds;
    const body = textBody(item, options, frame, textRectOf(owner.shape));
    if (!body) continue;
    owner.text = body;
    owner.textRect = textRectOf(owner.shape);
    item.owned = true;
    if (item.node) item.node.label = item; else item.edgeLabel.label = item;
  }
  // Every node's sites before any edge is written: pele draws the edges first.
  const sites = new Map();
  for (const item of out.items) if (item.kind === 'shape' && item.node) sites.set(item, nodeSites(item));
  let connectors = 0, bound = 0;
  for (const item of out.items) {
    if (item.kind === 'shape') {
      const role = item.node ? `node ${item.node.id ?? ++counters.shape}` : item.edgeLabel ? `edge label ${++counters.shape}` : `shape ${++counters.shape}`;
      parts.push(shapeXml(item, `${name} ${role}`, options, sites.get(item)));
    } else if (item.kind === 'text') {
      if (item.owned) continue;
      const body = textBody(item, options);
      if (body) parts.push(textBoxXml(body, () => next++, `${name} text ${++counters.text}`));
    } else if (item.kind === 'edge') {
      const written = edgeXml(item.edge, `${name} edge ${item.edge.id ?? ++counters.edge}`, () => next++, out.nodes.map(node => nodeIds.get(node)).filter(Boolean), sites);
      parts.push(...written.xml);
      connectors += written.connectors;
      bound += written.bound;
    }
  }
  return { xml: parts.join(''), ids: next, shapes: parts.length, connectors, bound };
}

// A node outline's connection sites in slide pixels with their indexes: SH-01's sites of its preset (core shapeSites), or the four edge
// midpoints of its custom outline (written as its a:cxnLst).
function nodeSites(item) {
  const shape = item.shape;
  if (shape.preset) {
    const { frame } = shape.preset;
    const sites = shapeSites({ preset: shape.preset.name, adjust: shape.preset.adjust ?? {}, box: { x: frame.x, y: frame.y, width: frame.width, height: frame.height }, rotate: frame.rotate || undefined, flipH: shape.preset.flipH, flipV: shape.preset.flipV });
    return sites?.map((site, index) => ({ ...site, index })) ?? [];
  }
  const b = shape.bounds;
  return [{ x: b.x + b.width / 2, y: b.y, angle: 270 }, { x: b.x, y: b.y + b.height / 2, angle: 180 }, { x: b.x + b.width / 2, y: b.y + b.height, angle: 90 }, { x: b.x + b.width, y: b.y + b.height / 2, angle: 0 }].map((site, index) => ({ ...site, index }));
}

function fillXml(fill, bounds) {
  if (!fill) return '<a:noFill/>';
  if (fill.paint.gradient) return gradientFillFor(fill, bounds);
  return `<a:solidFill>${colorXml(fill.paint.hex, fill.paint.alpha * fill.alpha)}</a:solidFill>`;
}
let gradientTable;
function gradientFillFor(fill, bounds) {
  const gradient = gradientTable?.get(fill.paint.gradient);
  if (!gradient) throw unsupported('a missing gradient');
  return gradientFill(gradient, bounds, fill.matrix, fill.alpha);
}

function lineXml(line) {
  if (!line) return '<a:ln><a:noFill/></a:ln>';
  if (line.paint.gradient) throw unsupported('a gradient outline');
  const cap = { round: 'rnd', square: 'sq' }[line.cap] ?? 'flat';
  const join = line.join === 'round' ? '<a:round/>' : line.join === 'bevel' ? '<a:bevel/>' : `<a:miter lim="${Math.round(line.miter * 100000)}"/>`;
  // SVG adds a round or square cap to both ends of every dash (half a width each); PowerPoint draws a custom dash as long as it is written
  // (measured in PowerPoint 365), so a capped dash is written one width longer and its gap one width shorter.
  const capped = cap !== 'flat' ? 1 : 0;
  const dash = line.dash ? `<a:custDash>${pairs(line.dash).map(([d, sp]) => { const grow = Math.min(capped, sp); return `<a:ds d="${Math.round((d + grow) * 100000)}" sp="${Math.round((sp - grow) * 100000)}"/>`; }).join('')}</a:custDash>` : '<a:prstDash val="solid"/>';
  return `<a:ln w="${emu(line.px)}" cap="${cap}" cmpd="sng" algn="ctr"><a:solidFill>${colorXml(line.paint.hex, line.paint.alpha * line.alpha)}</a:solidFill>${dash}${join}</a:ln>`;
}
const pairs = list => list.flatMap((value, index) => index % 2 ? [] : [[value, list[index + 1]]]);

// a:custGeom of segments (slide pixels) in the frame `bounds`, one a:path per subpath set; `sites` adds the a:cxnLst.
function customGeometry(paths, bounds, sites) {
  const w = Math.max(1, emu(bounds.width)), h = Math.max(1, emu(bounds.height));
  const point = (x, y) => `<a:pt x="${emu(x - bounds.x)}" y="${emu(y - bounds.y)}"/>`;
  const xml = paths.map(path => {
    let body = '';
    for (const [kind, ...v] of path.segments) {
      if (kind === 'M') body += `<a:moveTo>${point(v[0], v[1])}</a:moveTo>`;
      else if (kind === 'L') body += `<a:lnTo>${point(v[0], v[1])}</a:lnTo>`;
      else if (kind === 'C') body += `<a:cubicBezTo>${point(v[0], v[1])}${point(v[2], v[3])}${point(v[4], v[5])}</a:cubicBezTo>`;
      else if (kind === 'Q') body += `<a:quadBezTo>${point(v[0], v[1])}${point(v[2], v[3])}</a:quadBezTo>`;
      else if (kind === 'Z') body += '<a:close/>';
    }
    return `<a:path w="${w}" h="${h}"${path.fill ? '' : ' fill="none"'}${path.stroke ? '' : ' stroke="0"'}>${body}</a:path>`;
  }).join('');
  const cxn = sites ? `<a:cxnLst>${[['hc', 't', 16200000], ['l', 'vc', 10800000], ['hc', 'b', 5400000], ['r', 'vc', 0]].map(([x, y, angle]) => `<a:cxn ang="${angle}"><a:pos x="${x}" y="${y}"/></a:cxn>`).join('')}</a:cxnLst>` : '<a:cxnLst/>';
  return `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/>${cxn}<a:rect l="l" t="t" r="r" b="b"/><a:pathLst>${xml}</a:pathLst></a:custGeom>`;
}

const xfrm = (frame, { rotate = 0, flipH = false, flipV = false } = {}) => `<a:xfrm${rotate ? ` rot="${Math.round(rotate * 60000) % 21600000}"` : ''}${flipH ? ' flipH="1"' : ''}${flipV ? ' flipV="1"' : ''}><a:off x="${emu(frame.x)}" y="${emu(frame.y)}"/><a:ext cx="${emu(Math.max(0, frame.width))}" cy="${emu(Math.max(0, frame.height))}"/></a:xfrm>`;

function shapeXml(item, name, options, sites) {
  const shape = item.shape;
  let geometry, frame, transform = {};
  if (shape.preset) {
    frame = shape.preset.frame;
    transform = { rotate: frame.rotate, flipH: shape.preset.flipH, flipV: shape.preset.flipV };
    const adjust = shape.preset.adjust ? presetMask(shape.preset.name, frame, shape.preset.adjust).adjust : undefined;
    const gd = Object.entries(adjust ?? {}).map(([key, value]) => `<a:gd name="${key}" fmla="val ${value}"/>`).join('');
    geometry = `<a:prstGeom prst="${shape.preset.name}">${gd ? `<a:avLst>${gd}</a:avLst>` : '<a:avLst/>'}</a:prstGeom>`;
  } else {
    frame = shape.bounds;
    geometry = customGeometry([{ segments: shape.segments, fill: true, stroke: true }], frame, sites !== undefined);
  }
  const text = item.text;
  const body = text ? bodyXml(text, insetsFor(text, frame, item.textRect)) : `<p:txBody><a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="0" anchor="ctr"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:endParaRPr lang="${options.lang ?? 'en-US'}" dirty="0"/></a:p></p:txBody>`;
  return `<p:sp><p:nvSpPr><p:cNvPr id="${ID(item.id)}" name="${xmlEscape(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(frame, transform)}${geometry}${fillXml(shape.fill, frame)}${lineXml(shape.line)}<a:effectLst/></p:spPr>${body}</p:sp>`;
}

// An edge. PowerPoint opens a connector (p:cxnSp) only with a preset geometry (one of custom geometry makes the whole file unreadable,
// measured in PowerPoint 365), and its line ends reach five line widths where pele's arrowheads are eight. So an edge that is one straight
// segment without arrowheads is a straightConnector1 between its two points, bound to the node sites it touches; every other edge is one
// shape of custom geometry: its line exactly as pele routed it, with the arrowheads that share its paint as subpaths (filled with the
// marker color, stroked with the line) and any other part as its own shape.
function edgeXml(edge, name, nextId, nodes, sites) {
  const parts = edge.parts;
  const lines = parts.filter(part => !part.marker && part.line);
  const main = lines[0] ?? parts.find(part => part.line);
  const xml = [];
  if (!main) {
    // Nothing stroked (an edge drawn as filled shapes): ordinary shapes.
    for (const part of parts) xml.push(shapeXml({ shape: part, id: nextId() }, name, {}, undefined));
    return { xml, connectors: 0, bound: 0 };
  }
  const straight = straightLine(main.segments);
  if (straight && parts.length === 1 && !main.fill) {
    const [[x1, y1], [x2, y2]] = straight;
    const frame = { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
    const binding = straight.map(end => bind(end, nodes, sites));
    const connection = ['stCxn', 'endCxn'].map((tag, index) => binding[index] ? `<a:${tag} id="${ID(binding[index].node.id)}" idx="${binding[index].site.index}"/>` : '').join('');
    const spPr = `<p:spPr>${xfrm(frame, { flipH: x2 < x1, flipV: y2 < y1 })}<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:noFill/>${lineXml(main.line)}<a:effectLst/></p:spPr>`;
    xml.push(`<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${ID(nextId())}" name="${xmlEscape(name)}"/><p:cNvCxnSpPr>${connection}</p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr>${spPr}</p:cxnSp>`);
    return { xml, connectors: 1, bound: binding.filter(Boolean).length };
  }
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const lineKey = line => line && { paint: line.paint, alpha: line.alpha, px: line.px, dash: line.dash, cap: line.cap, join: line.join, miter: line.miter };
  let fill;
  const members = [], separate = [];
  for (const part of parts) {
    if (part === main) { if (part.fill) separate.push({ ...part, line: undefined }); members.push({ segments: part.segments, fill: false, stroke: true }); continue; }
    const strokeOk = !part.line || same(lineKey(part.line), lineKey(main.line));
    const fillKey = part.fill && { paint: part.fill.paint, alpha: part.fill.alpha };
    const fillOk = !part.fill || fill === undefined || same(fillKey, fill);
    if (strokeOk && fillOk && !part.fill?.paint.gradient) {
      if (part.fill) fill = fillKey;
      members.push({ segments: part.segments, fill: Boolean(part.fill), stroke: Boolean(part.line) });
    } else separate.push(part);
  }
  // A part drawn under the line (a filled main path) comes first, as pele draws its fill before its stroke.
  for (const part of separate.filter(part => part.line === undefined && part.segments === main.segments)) xml.push(shapeXml({ shape: part, id: nextId() }, `${name} fill`, {}, undefined));
  const frame = boundsOf(members.flatMap(member => member.segments));
  const spPr = `<p:spPr>${xfrm(frame)}${customGeometry(members, frame)}${fill ? `<a:solidFill>${colorXml(fill.paint.hex, fill.paint.alpha * fill.alpha)}</a:solidFill>` : '<a:noFill/>'}${lineXml(main.line)}<a:effectLst/></p:spPr>`;
  xml.push(`<p:sp><p:nvSpPr><p:cNvPr id="${ID(nextId())}" name="${xmlEscape(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>${spPr}${EMPTY_BODY}</p:sp>`);
  let index = 0;
  for (const part of separate) if (!(part.line === undefined && part.segments === main.segments)) xml.push(shapeXml({ shape: part, id: nextId() }, `${name} part ${++index}`, {}, undefined));
  return { xml, connectors: 0, bound: 0 };
}

// The two ends of a path that is one straight segment (collinear points in one direction), else undefined.
function straightLine(segments) {
  if (segments.length < 2 || segments[0][0] !== 'M' || segments.slice(1).some(segment => segment[0] !== 'L')) return undefined;
  const points = segments.map(segment => segment.slice(1, 3));
  const [x1, y1] = points[0], [x2, y2] = points.at(-1), length = Math.hypot(x2 - x1, y2 - y1);
  if (!(length > 0)) return undefined;
  let along = 0;
  for (const [x, y] of points.slice(1)) {
    const t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / (length * length);
    const off = Math.abs((x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)) / length;
    if (off > 0.01 || t < along - 1e-9) return undefined;
    along = t;
  }
  return [[x1, y1], [x2, y2]];
}

const EMPTY_BODY = '<p:txBody><a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="0" anchor="ctr"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:endParaRPr dirty="0"/></a:p></p:txBody>';

function endsOf(segments, markers) {
  const first = segments.find(segment => segment[0] === 'M');
  const last = [...segments].reverse().find(segment => segment[0] !== 'Z');
  if (!first || !last) return [];
  const start = first.slice(1, 3), end = last.slice(-2);
  const tip = point => {
    let best = point, distance = 0;
    for (const marker of markers) {
      const corners = marker.segments.filter(segment => segment[0] !== 'Z').map(segment => segment.slice(-2));
      if (!corners.length || Math.min(...corners.map(corner => Math.hypot(corner[0] - point[0], corner[1] - point[1]))) > Math.max(2, marker.bounds.width, marker.bounds.height)) continue;
      for (const corner of corners) {
        const d = Math.hypot(corner[0] - point[0], corner[1] - point[1]);
        if (d > distance) { distance = d; best = corner; }
      }
    }
    return best;
  };
  return [tip(start), tip(end)];
}

// The node site an end touches (within a pixel and a half), if any.
function bind(end, nodes, sites) {
  let best;
  for (const node of nodes) {
    for (const site of sites.get(node) ?? []) {
      const distance = Math.hypot(site.x - end[0], site.y - end[1]);
      if (distance <= 1.5 && (!best || distance < best.distance)) best = { node, site, distance };
    }
  }
  return best;
}

// --- text bodies ---------------------------------------------------------------------------------------------------------------------

// The text body of a text element: its lines as paragraphs at an exact pitch (the lines' own when they are evenly spaced and at least
// DIAGRAM_MIN_PITCH sizes apart, else one text body per line), placed so PowerPoint's first baseline is pele's. `frame`, when given, is
// the shape the text goes into: the body is returned only when it fits inside it (no negative inset).
function textBody(item, options, frame, textRect) {
  const { lines, matrix } = item;
  if (!lines.length) return undefined;
  const { rotate, scale, similar } = decompose(matrix);
  if (!similar) throw unsupported('a skewed or mirrored text');
  const anchor = lines[0].anchor;
  if (lines.some(line => line.anchor !== anchor || Math.abs(line.x - lines[0].x) > 1e-6)) {
    if (frame) return undefined;
    // Lines with their own anchors or positions: one body each.
    return { split: lines.map(line => textBody({ ...item, lines: [line] }, options)) };
  }
  const size = Math.max(...lines[0].runs.map(run => run.size)) * scale;
  let pitch = SINGLE_PITCH * size;
  if (lines.length > 1) {
    const steps = lines.slice(1).map((line, index) => (line.y - lines[index].y) * scale);
    const even = steps.every(step => Math.abs(step - steps[0]) < 0.01);
    const largest = Math.max(...lines.map(line => Math.max(...line.runs.map(run => run.size)))) * scale;
    if (!even || steps[0] < DIAGRAM_MIN_PITCH * largest) {
      if (frame) return undefined;
      return { split: lines.map(line => textBody({ ...item, lines: [line] }, options)) };
    }
    pitch = steps[0];
  }
  const widths = lines.map(line => line.runs.reduce((sum, run) => sum + options.measure(run.text, run.size * scale, { family: run.family, bold: run.bold, italic: run.italic }), 0));
  const width = Math.max(...widths, 1);
  // In the text's own (unrotated) frame: x along the line from the anchor, y down from the first baseline.
  const left = anchor === 'middle' ? -width / 2 : anchor === 'end' ? -width : 0;
  const top = -DIAGRAM_BASELINE_SHARE * pitch;
  const height = pitch * lines.length;
  const origin = apply(matrix, [lines[0].x, lines[0].y]);
  const turn = ((rotate % 360) + 360) % 360;
  const radians = rotate * Math.PI / 180;
  // The body's center, rotated with the text about the anchor point.
  const local = [left + width / 2, top + height / 2];
  const center = [origin[0] + local[0] * Math.cos(radians) - local[1] * Math.sin(radians), origin[1] + local[0] * Math.sin(radians) + local[1] * Math.cos(radians)];
  const box = { x: center[0] - width / 2, y: center[1] - height / 2, width, height };
  const body = { box, rotate: Math.abs(turn) < 1e-6 ? 0 : turn, anchor, origin, pitch, lines: lines.map(line => ({ runs: line.runs.map(run => ({ ...run, size: run.size * scale, strokeWidth: run.stroke ? run.stroke.width * scale : 0 })) })), lang: options.lang ?? 'en-US', font: options.font };
  if (frame) {
    if (body.rotate) return undefined;
    const insets = insetsFor(body, frame, textRect);
    if (!insets) return undefined;
  }
  return body;
}

// The text rectangle of a shape: its preset's (SH-01's, through core composeShape: the insets of a shape's text count from it), else the
// whole frame of a custom outline (written with a:rect l t r b).
function textRectOf(shape) {
  if (!shape.preset) return shape.bounds;
  const { frame, name, adjust } = shape.preset;
  try {
    const composed = composeShape({ shape: name, ...(adjust ? { adjust } : {}), aspectRatio: frame.width / Math.max(frame.height, 1e-9) }, { x: frame.x, y: frame.y, width: frame.width, height: frame.height }, { scale: 1 });
    if (composed.preset !== name) return undefined;
    const rect = composed.textRect;
    // A flipped shape mirrors its text rectangle about the frame's center.
    return { x: shape.preset.flipH ? 2 * frame.x + frame.width - rect.x - rect.width : rect.x, y: shape.preset.flipV ? 2 * frame.y + frame.height - rect.y - rect.height : rect.y, width: rect.width, height: rect.height };
  } catch { return undefined; }
}

// The insets that put a body's text where it is (top anchored, aligned by its anchor) inside the text rectangle `rect` of a shape whose
// frame is `frame`, or undefined when the text does not lie inside the shape or cannot be placed from that rectangle.
function insetsFor(body, frame, rect = frame) {
  if (!rect) return undefined;
  const slack = 0.5;
  const bottom = frame.y + frame.height - (body.box.y + body.box.height);
  // The text is the shape's own only when it lies inside the shape (its pitch's leading may reach past the bottom).
  if (body.box.y < frame.y - slack || bottom < -body.pitch * (1 - DIAGRAM_BASELINE_SHARE) - slack) return undefined;
  if (body.box.x < frame.x - slack || body.box.x + body.box.width > frame.x + frame.width + slack) return undefined;
  const top = body.box.y - rect.y;
  let left = 0, right = 0;
  if (body.anchor === 'middle') {
    const d = 2 * (body.origin[0] - rect.x) - rect.width;
    if (d >= 0) left = d; else right = -d;
  } else if (body.anchor === 'end') right = rect.x + rect.width - body.origin[0];
  else left = body.origin[0] - rect.x;
  if (top < -slack || left < -slack || right < -slack || left > rect.width || right > rect.width) return undefined;
  return { left: Math.max(0, left), top: Math.max(0, top), right: Math.max(0, right), bottom: Math.max(0, Math.min(rect.y + rect.height - (body.box.y + body.box.height), rect.height)) };
}

function runsXml(runs, body) {
  return runs.map(run => {
    const face = body.font ? body.font(run.family, run.bold, run.italic) : { fontFace: run.family, bold: run.bold, italic: run.italic };
    const fill = run.fill ? `<a:solidFill>${colorXml(run.fill.hex, run.fill.alpha)}</a:solidFill>` : '<a:noFill/>';
    const outline = run.stroke ? `<a:ln w="${emu(run.strokeWidth)}"><a:solidFill>${colorXml(run.stroke.hex, run.stroke.alpha)}</a:solidFill></a:ln>` : '';
    const attributes = `lang="${xmlEscape(body.lang)}" sz="${Math.max(100, Math.round(run.size * 75))}" b="${face.bold ? 1 : 0}" i="${face.italic ? 1 : 0}"${run.underline ? ' u="sng"' : ''}${run.strike ? ' strike="sngStrike"' : ''} dirty="0"`;
    return `<a:r><a:rPr ${attributes}>${outline}${fill}<a:latin typeface="${xmlEscape(face.fontFace)}"/></a:rPr><a:t>${xmlEscape(run.text)}</a:t></a:r>`;
  }).join('');
}

function bodyXml(body, insets) {
  const algn = body.anchor === 'middle' ? 'ctr' : body.anchor === 'end' ? 'r' : 'l';
  const spacing = `<a:lnSpc><a:spcPts val="${Math.round(body.pitch * 75)}"/></a:lnSpc><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft>`;
  const paragraphs = body.lines.map(line => `<a:p><a:pPr algn="${algn}" indent="0" marL="0">${spacing}<a:buNone/></a:pPr>${runsXml(line.runs, body)}</a:p>`).join('');
  const i = insets ?? { left: 0, top: 0, right: 0, bottom: 0 };
  return `<p:txBody><a:bodyPr wrap="none" lIns="${emu(i.left)}" tIns="${emu(i.top)}" rIns="${emu(i.right)}" bIns="${emu(i.bottom)}" rtlCol="0" anchor="t" anchorCtr="0"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paragraphs}</p:txBody>`;
}

function textBoxXml(body, nextId, name) {
  if (body.split) return body.split.filter(Boolean).map((part, index) => textBoxXml(part, nextId, index ? `${name} line ${index + 1}` : name)).join('');
  return `<p:sp><p:nvSpPr><p:cNvPr id="${ID(nextId())}" name="${xmlEscape(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(body.box, { rotate: body.rotate })}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>${bodyXml(body)}</p:sp>`;
}

// The gradients of the drawing being converted (its fills are written inside one synchronous conversion).
function withGradients(table, run) {
  const previous = gradientTable;
  gradientTable = table;
  try { return run(); } finally { gradientTable = previous; }
}

/**
 * Replace each stand-in rectangle of a slide part (`groups`: Map of the diagram's object name to diagramShapes' result with its `box` and
 * `alt`) with the diagram's p:grpSp: the name, the alt text as its description, an identity transform at the drawn box, and the
 * children with their shape ids numbered after the part's highest id.
 */
export function writeDiagramGroups(xml, groups) {
  let next = Math.max(0, ...[...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map(match => Number(match[1]))) + 1;
  return xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
    const name = /<p:cNvPr\b[^>]*\bname="([^"]+)"/.exec(shape)?.[1];
    const group = name !== undefined && groups.get(decode(name));
    if (!group) return shape;
    const base = next;
    next += group.ids;
    const children = group.xml.replace(/\{\{id:(\d+)\}\}/g, (_, n) => String(base + Number(n)));
    const { box } = group, frame = `<a:off x="${emu(box.x)}" y="${emu(box.y)}"/><a:ext cx="${emu(box.width)}" cy="${emu(box.height)}"/>`;
    const descr = group.alt ? ` descr="${xmlEscape(group.alt).replace(/\r/g, '&#13;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;')}"` : '';
    return `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${base}" name="${name}"${descr}/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm>${frame}${frame.replace('<a:off', '<a:chOff').replace('<a:ext', '<a:chExt')}</a:xfrm></p:grpSpPr>${children}</p:grpSp>`;
  });
}
