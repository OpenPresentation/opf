// SH-05: native PowerPoint shapes (p:sp, p:cxnSp) as OPF shapes.
//
// The exporter writes a shape block as one native shape named `OPF shape <path>` (shape-blocks.js) and an overlay shape or connector
// as one named by SH-04's exporter; either comes back as the OPF it was, because every property the exporter writes is read back from
// the DrawingML: the preset and its a:avLst (SH-01's adjustFromDrawingML), a:custGeom as an OPF path, the fill, the line, the effects,
// the theme style (p:style), the frame, rotation and flips, the text body's anchor, insets and direction, the alt text, decorative and
// hidden flags and the click link. A shape PowerPoint wrote (no OPF name) is read the same way and becomes an overlay shape placed by
// fractions of the slide (SH-04), or a connector bound to the shapes its ends are connected to. What OPF does not represent (3-D,
// preset shadows, fill overlay, wrap, columns and autofit, an alternative text title, hover links, locks, black-and-white mode, custom
// data) is dropped and reported (`shape-property-dropped`, naming the property).
//
// The readers here work on the order-preserving parse of the slide part, so the z order across tags (p:sp, p:cxnSp, p:pic) and
// the transforms of the groups a shape sits in are known; a color is read with its transforms in document order.
import {XMLParser} from 'fast-xml-parser';
import {applyColorTransform, colorTransform, presetAspect} from '@openpresentation/opf/composition';
import {drawingObject} from './background-import.js';
import {colorTransforms, presetPatterns, readBackgroundColor} from './background.js';
import {SHADOW_PRESETS} from './effects.js';
import {readFrameAlt} from './frame-alt.js';

// The exporter names a shape block `OPF shape slides.N.blocks.I.shape` and an overlay shape `OPF shape slides.N.shapes.I` (I is its entry in
// `slide.shapes`), and a connector `OPF connector slides.N.shapes.I`: the name says which each is.
const EXPORTED_SHAPE = /^OPF shape (slides\.\d+\.(.+))$/;
const EXPORTED_CONNECTOR = /^OPF connector slides\.\d+\.shapes\.(\d+)$/;
/** What an exported shape's name says: `{kind: 'block', path}` or `{kind: 'overlay', index}`; undefined for any other name. */
export function exportedShape(name) {
  const match = EXPORTED_SHAPE.exec(String(name));
  if (!match) return undefined;
  const overlay = /^shapes\.(\d+)$/.exec(match[2]);
  return overlay ? {kind: 'overlay', index: Number(overlay[1])} : {kind: 'block', path: match[1]};
}
const EMU_PER_PX = 9525;
const orderedParser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', preserveOrder: true, parseAttributeValue: false, parseTagValue: false, trimValues: false});

// The preset geometry (SH-01) loads on first use, as core's does: a deck with no shape never carries it into a browser bundle.
let geometry;
/** Load the preset geometry; `fromPptx` awaits this for a package that has shapes, because the readers below are synchronous. */
export async function loadShapeGeometry() { geometry ??= await import('@openpresentation/opf/shape-geometry'); return geometry; }

const array = value => value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const tagOf = node => { for (const key in node) if (key !== ':@' && key !== '#text') return key; return undefined; };
const kidsOf = node => { const tag = tagOf(node); return tag ? node[tag] ?? [] : []; };
const findKid = (kids, tag) => (kids ?? []).find(node => Object.hasOwn(node, tag));
const number = value => value === undefined || value === '' || value === null ? undefined : Number.isFinite(Number(value)) ? Number(value) : undefined;
const round = (value, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;
const truthy = value => value === '1' || value === 'true' || value === true;
const upper = value => String(value).toUpperCase();

// ---------------------------------------------------------------------------
// The slide's shape tree

/** The indexes `nativeTextShapes` gives p:sp nodes (a level's own elements first, then each group's, depth first). */
function spIndexes(nodes) {
  const map = new Map();
  const visit = list => {
    for (const node of list ?? []) if (Object.hasOwn(node, 'p:sp')) map.set(node, map.size);
    for (const node of list ?? []) if (Object.hasOwn(node, 'p:grpSp')) visit(node['p:grpSp']);
  };
  visit(nodes);
  return map;
}

const xfrmOf = node => {
  if (!object(node)) return undefined;
  const off = node['a:off'], ext = node['a:ext'];
  const x = number(off?.x), y = number(off?.y), cx = number(ext?.cx), cy = number(ext?.cy);
  if ([x, y, cx, cy].some(value => value === undefined)) return undefined;
  const chOff = node['a:chOff'], chExt = node['a:chExt'];
  return {x, y, cx, cy, rot: number(node.rot) ?? 0, flipH: truthy(node.flipH), flipV: truthy(node.flipV),
    child: chOff && chExt && [chOff.x, chOff.y, chExt.cx, chExt.cy].every(value => number(value) !== undefined) ? {x: number(chOff.x), y: number(chOff.y), cx: number(chExt.cx), cy: number(chExt.cy)} : undefined};
};

/**
 * A frame (EMU, with rotation in 60000ths of a degree and flips) as it sits on the slide, carried out of the groups it is in (outer to
 * inner in `groups`): each group scales the child space to its box, mirrors it, then turns it about the box's center. A rotated shape
 * inside a group that scales its axes unevenly is approximated: its own frame is scaled on the slide's axes.
 */
export function frameOnSlide(frame, groups) {
  let current = {...frame};
  for (let index = groups.length - 1; index >= 0; index--) {
    const group = groups[index];
    if (!group) continue;
    const sx = group.child?.cx ? group.cx / group.child.cx : 1, sy = group.child?.cy ? group.cy / group.child.cy : 1;
    const ox = group.child?.x ?? group.x, oy = group.child?.y ?? group.y;
    const quarter = Math.round(((current.rot / 60000) % 180 + 180) % 180 / 90) % 2 === 1 && Math.abs(((current.rot / 60000) % 90 + 90) % 90) < 1e-6;
    const width = current.cx * (quarter ? sy : sx), height = current.cy * (quarter ? sx : sy);
    let px = group.x + (current.x + current.cx / 2 - ox) * sx, py = group.y + (current.y + current.cy / 2 - oy) * sy;
    const gx = group.x + group.cx / 2, gy = group.y + group.cy / 2;
    if (group.flipH) px = 2 * gx - px;
    if (group.flipV) py = 2 * gy - py;
    const turn = group.rot / 60000 * Math.PI / 180;
    if (group.rot) { const dx = px - gx, dy = py - gy; px = gx + dx * Math.cos(turn) - dy * Math.sin(turn); py = gy + dx * Math.sin(turn) + dy * Math.cos(turn); }
    const mirrored = group.flipH !== group.flipV;
    const rot = ((mirrored ? group.rot - current.rot : group.rot + current.rot) % 21600000 + 21600000) % 21600000;
    current = {x: px - width / 2, y: py - height / 2, cx: width, cy: height, rot, flipH: current.flipH !== group.flipH, flipV: current.flipV !== group.flipV, ...(current.child ? {child: current.child} : {})};
  }
  return current;
}

/**
 * The slide's drawn shapes in z order (the shape tree walked in document order, groups flattened with their transforms applied):
 * `p:sp` (`index` is its nativeTextShapes index) and `p:cxnSp` with their parsed properties and their frame on the slide, and
 * `p:pic` and `p:graphicFrame` with their frame only (they take a z slot; the overlay check reads their boxes).
 */
export function readDrawnShapes(xml) {
  const tree = orderedParser.parse(xml);
  const slide = tree.find(node => Object.hasOwn(node, 'p:sld'));
  const cSld = findKid(kidsOf(slide), 'p:cSld');
  const spTree = findKid(kidsOf(cSld), 'p:spTree');
  const treeKids = kidsOf(spTree);
  const indexes = spIndexes(treeKids);
  const drawn = [];
  let z = 0;
  const walk = (nodes, groups) => {
    for (const node of nodes ?? []) {
      const tag = tagOf(node);
      if (tag === 'p:grpSp') {
        const properties = findKid(kidsOf(node), 'p:grpSpPr');
        const group = properties ? xfrmOf(drawingObject([properties])['p:grpSpPr']?.['a:xfrm']) : undefined;
        z++;
        walk(kidsOf(node), [...groups, group]);
      } else if (tag === 'p:sp' || tag === 'p:cxnSp') {
        const props = drawingObject([node])[tag];
        const own = xfrmOf(props?.['p:spPr']?.['a:xfrm']);
        drawn.push({tag, z: z++, index: tag === 'p:sp' ? indexes.get(node) : undefined, props, grouped: groups.length > 0, frame: own ? frameOnSlide(own, groups) : undefined});
      } else if (tag === 'p:pic' || tag === 'p:graphicFrame') {
        const properties = drawingObject(kidsOf(node).filter(kid => ['p:spPr', 'p:xfrm'].some(name => Object.hasOwn(kid, name))));
        const own = xfrmOf(properties['p:spPr']?.['a:xfrm'] ?? properties['p:xfrm']);
        drawn.push({tag, z: z++, frame: own ? frameOnSlide(own, groups) : undefined});
      } else if (tag === 'mc:AlternateContent') z++;
    }
  };
  walk(treeKids, []);
  return drawn;
}

// ---------------------------------------------------------------------------
// Colors

const SCHEME_NAMES = {dk1: 'dark1', lt1: 'light1', dk2: 'dark2', lt2: 'light2', accent1: 'accent1', accent2: 'accent2', accent3: 'accent3', accent4: 'accent4', accent5: 'accent5', accent6: 'accent6', hlink: 'hyperlink', folHlink: 'followedHyperlink'};
const PRESET_COLORS = {black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', gray: '808080', grey: '808080', silver: 'C0C0C0', orange: 'FFA500', purple: '800080', cyan: '00FFFF', magenta: 'FF00FF', lime: '00FF00', navy: '000080', teal: '008080', maroon: '800000', olive: '808000', aqua: '00FFFF', fuchsia: 'FF00FF', brown: 'A52A2A', pink: 'FFC0CB', gold: 'FFD700'};
const SYSTEM_COLORS = {windowText: '000000', window: 'FFFFFF', menuText: '000000', menu: 'FFFFFF', buttonFace: 'F0F0F0', buttonText: '000000'};

/**
 * A DrawingML color element as `{ref, alpha, dropped}`: `ref` is the OPF ColorRef (`#RRGGBB`, a scheme slot name, or
 * `{ color, lighten }` / `{ color, darken }` for a:lumMod and a:lumOff), `alpha` 0 to 1, `dropped` the transforms OPF has no form for
 * (their effect is not applied). Undefined when the element holds no readable color. A theme color goes through the slide's color map
 * (`mapping`: bg1 to lt1 and so on), so `tx1` is the slot it reaches.
 */
export function readColor(node, {mapping, phColor} = {}) {
  if (!object(node)) return undefined;
  const kind = ['a:srgbClr', 'a:schemeClr', 'a:sysClr', 'a:prstClr'].find(key => object(node[key]));
  if (!kind) return undefined;
  const color = node[kind];
  const transforms = color[colorTransforms] ?? Object.entries(color).filter(([key]) => key.startsWith('a:')).flatMap(([key, value]) => array(value).map(item => [key, item]));
  let base;
  if (kind === 'a:srgbClr') base = /^[\da-f]{6}$/i.test(color.val ?? '') ? `#${upper(color.val)}` : undefined;
  else if (kind === 'a:sysClr') base = /^[\da-f]{6}$/i.test(color.lastClr ?? '') ? `#${upper(color.lastClr)}` : SYSTEM_COLORS[color.val] ? `#${SYSTEM_COLORS[color.val]}` : undefined;
  else if (kind === 'a:prstClr') base = PRESET_COLORS[color.val] ? `#${PRESET_COLORS[color.val]}` : undefined;
  else if (color.val === 'phClr') base = phColor;
  else {
    const slot = mapping && Object.hasOwn(mapping, color.val) ? mapping[color.val] : color.val;
    base = Object.hasOwn(SCHEME_NAMES, slot) ? SCHEME_NAMES[slot] : undefined;
  }
  if (base === undefined) return undefined;
  let alpha = 1, mod = 1, off = 0;
  const dropped = [];
  for (const [name, attributes] of transforms) {
    const value = number(attributes?.val);
    if (value === undefined) { dropped.push(name.replace(/^a:/, '')); continue; }
    const fraction = value / 100000;
    if (name === 'a:alpha') alpha = fraction;
    else if (name === 'a:alphaMod') alpha *= fraction;
    else if (name === 'a:alphaOff') alpha += fraction;
    else if (name === 'a:lumMod') mod *= fraction;
    else if (name === 'a:lumOff') off += fraction;
    else dropped.push(name.replace(/^a:/, ''));
  }
  alpha = Math.min(1, Math.max(0, alpha));
  let ref = base;
  if (mod !== 1 || off !== 0) {
    if (off === 0 && mod < 1 && mod >= 0) ref = {color: base, darken: round(1 - mod)};
    else if (off > 0 && mod >= 0 && Math.abs(mod + off - 1) < 1e-4) ref = {color: base, lighten: round(off)};
    else dropped.push('lumMod/lumOff');
  }
  return {ref, alpha, dropped};
}

// A ColorRef carrying an alpha: eight-digit hex where it is a hex color, else the alpha is lost (reported by the caller).
const withAlpha = (ref, alpha) => alpha < 1 && typeof ref === 'string' && ref.startsWith('#') ? `${ref}${Math.round(alpha * 255).toString(16).padStart(2, '0').toUpperCase()}` : ref;
// A whole percent is an opacity; any other alpha is the byte of an eight-digit hex color.
const isWholePercent = alpha => Math.abs(alpha * 100 - Math.round(alpha * 100)) < 1e-6;

// ---------------------------------------------------------------------------
// Geometry

const guessNumber = (token, guides) => { const value = Number(token); return Number.isFinite(value) ? value : guides.get(token); };

// An a:arcTo as cubic Béziers from the current point: DrawingML's angles are the visual angle of the ray from the ellipse's center.
function arcCommands(start, wR, hR, stAng, swAng) {
  const visual = value => value / 60000 * Math.PI / 180;
  const parametric = angle => Math.atan2(wR * Math.sin(angle), hR * Math.cos(angle));
  const v1 = visual(stAng), sweep = visual(swAng);
  if (!wR || !hR || !sweep) return {commands: [], end: start};
  const steps = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
  const angles = [];
  let previous = parametric(v1);
  angles.push(previous);
  for (let step = 1; step <= steps; step++) {
    let next = parametric(v1 + sweep * step / steps);
    while (sweep > 0 && next < previous) next += 2 * Math.PI;
    while (sweep < 0 && next > previous) next -= 2 * Math.PI;
    angles.push(next);
    previous = next;
  }
  const cx = start[0] - wR * Math.cos(angles[0]), cy = start[1] - hR * Math.sin(angles[0]);
  const commands = [];
  let end = start;
  for (let index = 0; index < steps; index++) {
    const a = angles[index], b = angles[index + 1], k = 4 / 3 * Math.tan((b - a) / 4);
    const p1 = [cx + wR * (Math.cos(a) - k * Math.sin(a)), cy + hR * (Math.sin(a) + k * Math.cos(a))];
    const p2 = [cx + wR * (Math.cos(b) + k * Math.sin(b)), cy + hR * (Math.sin(b) - k * Math.cos(b))];
    end = [cx + wR * Math.cos(b), cy + hR * Math.sin(b)];
    commands.push(['C', ...p1, ...p2, ...end]);
  }
  return {commands, end};
}

/**
 * An a:custGeom as an OPF path: SVG path data in a 0 to 1 box (each a:path scaled by its own w and h, so the outline stretches to the
 * frame as the format says). Guide coordinates are evaluated from the shape's gdLst; arcs become cubic Béziers. `modes` is true when
 * a path has a fill mode or a stroke flag OPF's single path has no form for. Undefined when no outline is readable.
 */
export function readCustomGeometry(custom, frame) {
  const guides = new Map([['l', 0], ['t', 0], ['r', frame.cx], ['b', frame.cy], ['w', frame.cx], ['h', frame.cy], ['hc', frame.cx / 2], ['vc', frame.cy / 2]]);
  for (const guide of array(custom['a:gdLst']?.['a:gd'])) {
    try { guides.set(guide.name, geometry.evaluateGuideFormula(guide.fmla, guides)); } catch { /* an unreadable guide leaves the points that use it unreadable */ }
  }
  const parts = [];
  let modes = false;
  for (const path of array(custom['a:pathLst']?.['a:path'])) {
    const w = number(path.w) || frame.cx, h = number(path.h) || frame.cy;
    if (!(w > 0) || !(h > 0)) continue;
    if ((path.fill && path.fill !== 'norm') || path.stroke === '0' || path.stroke === 'false' || path.extrusionOk === '1') modes = true;
    const point = node => { const x = guessNumber(node?.x, guides), y = guessNumber(node?.y, guides); return x === undefined || y === undefined ? undefined : [x / w, y / h]; };
    const fmt = value => String(round(value, 5));
    let d = '', current = [0, 0], failed = false;
    for (const [name, nodes] of Object.entries(path)) {
      for (const node of array(nodes)) {
        if (name === 'a:close') { d += 'Z '; continue; }
        const points = array(node?.['a:pt']).map(point);
        if (name === 'a:moveTo' || name === 'a:lnTo') {
          if (!points[0]) { failed = true; continue; }
          d += `${name === 'a:moveTo' ? 'M' : 'L'}${fmt(points[0][0])} ${fmt(points[0][1])} `;
          current = points[0];
        } else if (name === 'a:cubicBezTo') {
          if (points.length !== 3 || points.some(item => !item)) { failed = true; continue; }
          d += `C${points.map(item => `${fmt(item[0])} ${fmt(item[1])}`).join(' ')} `;
          current = points[2];
        } else if (name === 'a:quadBezTo') {
          if (points.length !== 2 || points.some(item => !item)) { failed = true; continue; }
          d += `Q${points.map(item => `${fmt(item[0])} ${fmt(item[1])}`).join(' ')} `;
          current = points[1];
        } else if (name === 'a:arcTo') {
          const wR = guessNumber(node.wR, guides), hR = guessNumber(node.hR, guides), st = guessNumber(node.stAng, guides), sw = guessNumber(node.swAng, guides);
          if ([wR, hR, st, sw].some(value => value === undefined)) { failed = true; continue; }
          // Work in the path's own units so a non-uniform w and h keep their ellipse; the result is scaled to the box afterwards.
          const arc = arcCommands([current[0] * w, current[1] * h], wR, hR, st, sw);
          for (const [, ...values] of arc.commands) d += `C${values.map((value, index) => fmt(index % 2 ? value / h : value / w)).join(' ')} `;
          current = [arc.end[0] / w, arc.end[1] / h];
        }
      }
    }
    if (!failed && d.trim()) parts.push(d.trim());
    else if (failed) modes = true;
  }
  if (!parts.length) return undefined;
  return {path: parts.join(' '), modes};
}

// ---------------------------------------------------------------------------
// Fill, stroke and effects

/** The solid, gradient or pattern fill of a shape's properties (or `none`); `{}` when the properties state no fill. */
function readFill(properties, context, drop, frame) {
  const result = {};
  const color = node => {
    const read = readColor(node, context);
    if (!read) return undefined;
    for (const name of read.dropped) drop(`color transform ${name}`);
    return read;
  };
  if (object(properties['a:noFill'])) return {fill: 'none'};
  if (object(properties['a:solidFill'])) {
    const read = color(properties['a:solidFill']);
    if (!read) return {};
    if (read.alpha < 1) {
      if (isWholePercent(read.alpha) || typeof read.ref !== 'string' || !read.ref.startsWith('#')) return {fill: read.ref, opacity: round(read.alpha)};
      return {fill: withAlpha(read.ref, read.alpha)};
    }
    return {fill: read.ref};
  }
  if (object(properties['a:gradFill'])) {
    const gradient = properties['a:gradFill'];
    const stops = array(gradient['a:gsLst']?.['a:gs']).map(stop => ({read: color(stop), position: number(stop.pos)})).filter(stop => stop.read && stop.position !== undefined);
    if (stops.length < 2) { drop('gradient fill'); return {}; }
    const alphas = new Set(stops.map(stop => round(stop.read.alpha)));
    const uniform = alphas.size === 1;
    const alpha = stops[0].read.alpha;
    const make = {stops: stops.map(stop => ({color: uniform ? stop.read.ref : withAlpha(stop.read.ref, stop.read.alpha), position: round(stop.position / 100000, 5)}))};
    if (object(gradient['a:path'])) {
      const kind = gradient['a:path'].path;
      make.type = kind === 'circle' ? 'radial' : kind === 'rect' ? 'rectangle' : 'shape';
      const rect = gradient['a:path']['a:fillToRect'];
      if (rect && ['l', 't', 'r', 'b'].some(side => number(rect[side]) !== undefined && number(rect[side]) !== 50000)) drop('gradient focus');
      return {fill: {gradient: {type: make.type, stops: make.stops}}, ...(uniform && alpha < 1 ? {opacity: round(alpha)} : {})};
    }
    const lin = gradient['a:lin'];
    let angle = (number(lin?.ang) ?? 0) / 60000;
    if (lin && truthy(lin.scaled) && frame?.cx && frame?.cy) angle = Math.atan2(frame.cy * Math.sin(angle * Math.PI / 180), frame.cx * Math.cos(angle * Math.PI / 180)) * 180 / Math.PI;
    angle = ((round(angle, 3) % 360) + 360) % 360;
    return {fill: {gradient: {...(angle !== 90 ? {angle} : {}), stops: make.stops}}, ...(uniform && alpha < 1 ? {opacity: round(alpha)} : {})};
  }
  if (object(properties['a:pattFill'])) {
    const pattern = properties['a:pattFill'];
    const foreground = color(pattern['a:fgClr']), background = color(pattern['a:bgClr']);
    if (!presetPatterns.has(pattern.prst)) { drop('pattern fill'); return {}; }
    const uniform = !foreground || !background || round(foreground.alpha) === round(background.alpha);
    const alpha = foreground?.alpha ?? background?.alpha ?? 1;
    const tone = read => read ? (uniform ? read.ref : withAlpha(read.ref, read.alpha)) : undefined;
    return {fill: {pattern: {preset: pattern.prst, ...(foreground ? {foregroundColor: tone(foreground)} : {}), ...(background ? {backgroundColor: tone(background)} : {})}}, ...(uniform && alpha < 1 ? {opacity: round(alpha)} : {})};
  }
  if (object(properties['a:blipFill'])) { drop('picture fill'); return result; }
  if (object(properties['a:grpFill'])) { drop('group fill'); return result; }
  return result;
}

const DASHES = {solid: 'solid', dot: 'dot', dash: 'dash', lgDash: 'longDash', dashDot: 'dashDot', lgDashDot: 'longDashDot', lgDashDotDot: 'longDashDotDot', sysDot: 'sysDot', sysDash: 'sysDash', sysDashDot: 'sysDashDot', sysDashDotDot: 'sysDashDotDot'};
const CAPS = {flat: 'flat', rnd: 'round', sq: 'square'};
const COMPOUNDS = {sng: 'single', dbl: 'double', thickThin: 'thickThin', thinThick: 'thinThick', tri: 'triple'};
const SIZES = {sm: 'small', med: 'medium', lg: 'large'};
const SKETCHES = {'ask:lineSketchCurved': 'curved', 'ask:lineSketchFreehand': 'freehand', 'ask:lineSketchScribble': 'scribble'};

/**
 * The line (`a:ln`) as an OPF stroke: `none`, or an object holding only what is not the default (width, cap, dash and the rest). The
 * color is always read (the style's default is removed once the document's colors can say it is the same). `width` is in reference
 * pixels. Undefined when the shape states no line of its own.
 */
function readStroke(ln, context, drop, scale) {
  if (!object(ln)) return undefined;
  if (object(ln['a:noFill'])) return 'none';
  const stroke = {};
  const color = node => { const read = readColor(node, context); if (read) for (const name of read.dropped) drop(`color transform ${name}`); return read; };
  if (object(ln['a:solidFill'])) {
    const read = color(ln['a:solidFill']);
    if (read) {
      if (read.alpha < 1 && typeof read.ref === 'string' && read.ref.startsWith('#')) stroke.color = withAlpha(read.ref, read.alpha);
      else { stroke.color = read.ref; if (read.alpha < 1) drop('line transparency'); }
    }
  } else if (object(ln['a:gradFill'])) {
    const fill = readFill({'a:gradFill': ln['a:gradFill']}, context, drop);
    if (fill.fill?.gradient) stroke.gradient = fill.fill.gradient;
  } else if (object(ln['a:pattFill'])) drop('pattern line');
  const width = number(ln.w);
  if (width !== undefined) stroke.width = round(width / EMU_PER_PX / scale);
  if (ln.cap && CAPS[ln.cap] && CAPS[ln.cap] !== 'flat') stroke.cap = CAPS[ln.cap];
  if (ln.cmpd && COMPOUNDS[ln.cmpd] && COMPOUNDS[ln.cmpd] !== 'single') stroke.compound = COMPOUNDS[ln.cmpd];
  if (ln.algn === 'in') stroke.align = 'inside';
  if (object(ln['a:prstDash']) && DASHES[ln['a:prstDash'].val] && DASHES[ln['a:prstDash'].val] !== 'solid') stroke.dash = DASHES[ln['a:prstDash'].val];
  if (object(ln['a:custDash'])) {
    const dash = array(ln['a:custDash']['a:ds']).flatMap(item => [number(item.d), number(item.sp)]);
    if (dash.length >= 2 && dash.every(value => value !== undefined && value > 0)) stroke.dash = dash.map(value => round(value / 100000, 4));
  }
  if (object(ln['a:round'])) stroke.join = 'round';
  else if (object(ln['a:bevel'])) stroke.join = 'bevel';
  else if (object(ln['a:miter'])) { const limit = number(ln['a:miter'].lim); if (limit !== undefined && Math.abs(limit - 800000) > 1) stroke.miterLimit = round(limit / 100000); }
  for (const [name, key] of [['a:headEnd', 'start'], ['a:tailEnd', 'end']]) {
    const end = ln[name];
    if (!object(end) || !end.type || end.type === 'none') continue;
    if (!['triangle', 'stealth', 'diamond', 'oval', 'arrow'].includes(end.type)) { drop(`arrowhead ${end.type}`); continue; }
    const head = {type: end.type, ...(SIZES[end.w] && SIZES[end.w] !== 'medium' ? {width: SIZES[end.w]} : {}), ...(SIZES[end.len] && SIZES[end.len] !== 'medium' ? {length: SIZES[end.len]} : {})};
    stroke[key] = head;
  }
  for (const ext of array(ln['a:extLst']?.['a:ext'])) {
    const props = ext?.['ask:lineSketchStyleProps'];
    const type = props && Object.keys(SKETCHES).find(key => object(props['ask:type']?.[key]));
    if (type) stroke.sketch = SKETCHES[type];
  }
  return stroke;
}

const angleOf = value => round((((number(value) ?? 0) / 60000) % 360 + 360) % 360, 3);

/**
 * The effects of `a:effectLst` as OPF keys (shadow, innerShadow, glow, softEdge, reflection, blur), lengths in reference pixels.
 * A shadow equal to a preset is its name. Colors are read as they are (defaults are removed once the document's colors can say
 * it is the same); `a:prstShdw`, `a:fillOverlay` and `a:effectDag` are dropped.
 */
function readEffects(list, context, drop, scale) {
  const out = {};
  if (!object(list)) return out;
  const px = value => round((number(value) ?? 0) / EMU_PER_PX / scale);
  const color = node => { const read = readColor(node, context); if (read) for (const name of read.dropped) drop(`color transform ${name}`); return read; };
  if (object(list['a:blur'])) { const radius = px(list['a:blur'].rad); if (radius > 0) out.blur = radius; }
  if (object(list['a:glow'])) {
    const read = color(list['a:glow']);
    out.glow = {...(read ? {color: read.ref} : {}), ...(read ? {opacity: round(read.alpha)} : {}), radius: px(list['a:glow'].rad)};
  }
  if (object(list['a:innerShdw'])) {
    const shadow = list['a:innerShdw'], read = color(shadow);
    out.innerShadow = {...(read ? {color: read.ref, opacity: round(read.alpha)} : {}), blur: px(shadow.blurRad), distance: px(shadow.dist), angle: angleOf(shadow.dir)};
  }
  if (object(list['a:outerShdw'])) {
    const shadow = list['a:outerShdw'], read = color(shadow);
    const sx = (number(shadow.sx) ?? 100000) / 100000, sy = (number(shadow.sy) ?? 100000) / 100000;
    const value = {color: read?.ref ?? '#000000', opacity: round(read?.alpha ?? 1), blur: px(shadow.blurRad), distance: px(shadow.dist), angle: angleOf(shadow.dir)};
    const black = typeof value.color === 'string' && /^#000000$/i.test(value.color);
    const near = (a, b) => Math.abs(a - b) < 0.01;
    const preset = black && Object.entries(SHADOW_PRESETS).find(([name, p]) => near(p.opacity, value.opacity) && near(p.blur, value.blur) && near(p.distance, value.distance) && near(p.angle, value.angle)
      && near(p.scaleX ?? p.size ?? 1, sx) && near(p.scaleY ?? p.size ?? 1, name === 'perspective' ? sy : sy));
    if (preset) out.shadow = preset[0];
    else {
      if (near(sx, sy)) { if (!near(sx, 1)) value.size = round(sx); }
      else { value.size = round(sx); drop('shadow scale'); }
      out.shadow = value;
    }
  }
  if (object(list['a:reflection'])) {
    const reflection = list['a:reflection'];
    out.reflection = {opacity: round((number(reflection.stA) ?? 100000) / 100000), size: round((number(reflection.endPos) ?? 100000) / 100000), distance: px(reflection.dist), blur: px(reflection.blurRad)};
  }
  if (object(list['a:softEdge'])) { const radius = px(list['a:softEdge'].rad); if (radius > 0) out.softEdge = radius; }
  if (object(list['a:prstShdw'])) drop('preset shadow');
  if (object(list['a:fillOverlay'])) drop('fill overlay');
  return out;
}

// ---------------------------------------------------------------------------
// The theme style

/** The OPF style a `p:style` is (subtle, moderate, intense), `none` without one, or undefined for a style OPF does not have. */
function readStyle(style, context) {
  if (!object(style)) return {name: 'none'};
  const ref = name => { const node = style[name]; return object(node) ? {idx: number(node.idx), color: readColor(node, context)?.ref} : undefined; };
  const ln = ref('a:lnRef'), fill = ref('a:fillRef'), effect = ref('a:effectRef');
  const key = `${ln?.idx}/${fill?.idx}/${effect?.idx}`;
  if (key === '2/1/0') return {name: object(fill.color) && fill.color.lighten !== undefined ? 'subtle' : 'moderate', ln, fill, effect};
  if (key === '0/1/2') return {name: 'intense', ln, fill, effect};
  return {name: undefined, ln, fill, effect};
}

// ---------------------------------------------------------------------------
// One shape

const PADDING = {left: 91440, top: 45720, right: 91440, bottom: 45720};
const TEXT_DIRECTIONS = {horz: 'horizontal', vert: 'vertical', vert270: 'vertical270', wordArtVert: 'stacked', eaVert: 'vertical', mongolianVert: 'vertical'};

/**
 * The OPF shape of a drawn `p:sp`: `{ fields, dropped, connection }`. `fields` holds the shape vocabulary (shape or path, adjust, fill,
 * opacity, stroke, style, the effects, rotate, flip, anchor, padding, textDirection, alt, decorative, hidden, link); the text is not
 * read here (the caller adds it). `dropped` lists the native properties OPF has no form for. `context`: `mapping` (the color map),
 * `scale` (the slide's short edge in reference pixels over 720), `relationships` (the slide part's), `theme` (the format scheme).
 */
export function readShape(drawn, context) {
  const props = drawn.props ?? {};
  const spPr = props['p:spPr'] ?? {};
  const nv = props['p:nvSpPr'] ?? props['p:nvCxnSpPr'] ?? {};
  const cNvPr = nv['p:cNvPr'] ?? {};
  const dropped = [];
  const drop = property => { if (!dropped.includes(property)) dropped.push(property); };
  const scale = context.scale;
  const frame = drawn.frame;
  const fields = {};
  // Geometry.
  const preset = spPr['a:prstGeom']?.prst;
  if (object(spPr['a:custGeom'])) {
    const custom = frame ? readCustomGeometry(spPr['a:custGeom'], frame) : undefined;
    if (custom) { fields.path = custom.path; if (custom.modes) drop('custom path fill or stroke mode'); }
    else { drop('custom geometry'); fields.shape = 'rect'; }
  } else if (preset) {
    if (preset === 'rect' || geometry?.isPresetShape(preset)) {
      fields.shape = preset;
      const avLst = Object.fromEntries(array(spPr['a:prstGeom']['a:avLst']?.['a:gd']).flatMap(guide => {
        const match = /^val\s+(-?\d+)$/.exec(String(guide?.fmla ?? '').trim());
        return match && guide.name ? [[guide.name, Number(match[1])]] : [];
      }));
      if (Object.keys(avLst).length && geometry) {
        const adjust = geometry.adjustFromDrawingML(preset, avLst), defaults = geometry.presetAdjustments(preset);
        const changed = Object.fromEntries(Object.entries(adjust).filter(([name, value]) => !defaults[name] || Math.abs(defaults[name].default - value) > 1e-6));
        if (Object.keys(changed).length) fields.adjust = changed;
      }
    } else { drop(`geometry ${preset}`); fields.shape = 'rect'; }
  } else fields.shape = 'rect';
  // Style, fill and line.
  const style = readStyle(props['p:style'], context);
  const colors = {mapping: context.mapping};
  const fill = readFill(spPr, colors, drop, frame);
  if (fill.fill !== undefined) { fields.fill = fill.fill; if (fill.opacity !== undefined) fields.opacity = fill.opacity; }
  else if (fill.opacity !== undefined) fields.opacity = fill.opacity;
  let stroke = readStroke(spPr['a:ln'], colors, drop, scale);
  if (style.name === undefined) {
    // A p:style OPF has no name for: its references give the fill and the line the shape does not state itself.
    if (fields.fill === undefined && style.fill?.idx > 0 && style.fill.color) fields.fill = style.fill.color;
    // The line a theme style reference gives (its color, and its width from the theme's line styles) joins what the shape states.
    if (stroke !== 'none' && style.ln?.idx > 0 && style.ln.color && (stroke === undefined || (!stroke.color && !stroke.gradient))) {
      const widths = array(context.format?.['a:lnStyleLst']?.['a:ln']);
      const width = number(widths[style.ln.idx - 1]?.w);
      stroke = {color: style.ln.color, ...(width !== undefined ? {width: round(width / EMU_PER_PX / scale)} : {}), ...(stroke ?? {})};
    }
  }
  if (stroke !== undefined) fields.stroke = stroke;
  if (style.name === undefined) fields.style = 'none';
  else if (style.name !== 'moderate') fields.style = style.name;
  Object.assign(fields, readEffects(spPr['a:effectLst'], colors, drop, scale));
  if (object(spPr['a:effectDag'])) drop('effect graph');
  // Transform.
  if (frame) {
    const rotate = ((frame.rot / 60000) % 360 + 360) % 360;
    if (rotate) fields.rotate = round(rotate, 3);
    if (frame.flipH && frame.flipV) fields.flip = 'both';
    else if (frame.flipH) fields.flip = 'horizontal';
    else if (frame.flipV) fields.flip = 'vertical';
  }
  // The text body's frame.
  const body = props['p:txBody']?.['a:bodyPr'];
  if (object(body)) {
    const anchor = {t: 'top', ctr: 'middle', b: 'bottom'}[body.anchor];
    if (anchor && anchor !== 'middle') fields.anchor = anchor;
    if (TEXT_DIRECTIONS[body.vert] && TEXT_DIRECTIONS[body.vert] !== 'horizontal') fields.textDirection = TEXT_DIRECTIONS[body.vert];
    const inset = side => { const value = number(body[`${side[0]}Ins`]); return round((value ?? PADDING[side]) / EMU_PER_PX / scale); };
    const padding = {top: inset('top'), right: inset('right'), bottom: inset('bottom'), left: inset('left')};
    const standard = {top: 4.8, right: 9.6, bottom: 4.8, left: 9.6};
    if (Object.keys(padding).some(side => Math.abs(padding[side] - standard[side]) > 0.01)) {
      fields.padding = Object.values(padding).every(value => value === padding.top) ? padding.top : padding;
    }
    if (body.wrap === 'none') drop('text wrapping');
    if (number(body.numCol) > 1) drop('text columns');
    if (object(body['a:spAutoFit']) || object(body['a:normAutofit'])) drop('autofit');
    if (object(body['a:scene3d']) || object(body['a:sp3d'])) drop('3-D format');
  }
  // Accessibility and behavior.
  const alt = readFrameAlt(cNvPr);
  if (alt === '') fields.decorative = true;
  else if (alt !== undefined) fields.alt = alt;
  if (truthy(cNvPr.hidden)) fields.hidden = true;
  const link = cNvPr['a:hlinkClick'];
  if (object(link)) {
    const target = context.relationships?.get(link['r:id']);
    if (target?.targetMode === 'External' && /^(https?:\/\/|mailto:|tel:)\S+$/.test(target.target ?? '')) fields.link = target.target;
    else drop('click action');
  }
  // What OPF does not represent.
  if (object(spPr['a:scene3d']) || object(spPr['a:sp3d'])) drop('3-D format');
  if (cNvPr.title) drop('alternative text title');
  if (object(cNvPr['a:hlinkHover'])) drop('hover link');
  const locks = nv['p:cNvSpPr']?.['a:spLocks'] ?? nv['p:cNvCxnSpPr']?.['a:cxnSpLocks'];
  if (object(locks) && Object.keys(locks).length) drop('locks');
  if (spPr.bwMode && spPr.bwMode !== 'auto') drop('black-and-white mode');
  if (object(nv['p:nvPr']?.['p:custDataLst'])) drop('custom data');
  return {fields, dropped, style};
}

/**
 * The connector a `p:cxnSp` is: `{ route, from, to, fromSite, toSite, fields, dropped }` where `from` and `to` are the native shape ids its
 * a:stCxn and a:endCxn name (undefined for a free end) and the sites their `idx`; `fields` the stroke, alt, decorative and hidden. A connector
 * is drawn by its preset (line and straightConnector1 straight, bentConnector2 to 5 elbow, curvedConnector2 to 5 curved).
 */
export function readConnector(drawn, context) {
  const shape = readShape(drawn, context);
  const props = drawn.props ?? {};
  const preset = shape.fields.shape;
  const cNvCxnSpPr = props['p:nvCxnSpPr']?.['p:cNvCxnSpPr'] ?? {};
  const end = node => object(node) && number(node.id) !== undefined ? {id: number(node.id), site: number(node.idx) ?? 0} : undefined;
  const route = /^bentConnector/.test(preset) ? 'elbow' : /^curvedConnector/.test(preset) ? 'curved' : /^(line|lineInv|straightConnector1)$/.test(preset) ? 'straight' : undefined;
  return {route, preset, from: end(cNvCxnSpPr['a:stCxn']), to: end(cNvCxnSpPr['a:endCxn']), shape};
}

// ---------------------------------------------------------------------------
// Which shapes are shapes

const refIndex = (style, name) => number(style?.[name]?.idx) ?? 0;

/** Whether a native shape draws a fill, a line or an effect (its own, or its p:style's). */
export function drawsLook(props) {
  const spPr = props?.['p:spPr'] ?? {}, style = props?.['p:style'];
  const filled = object(spPr['a:noFill']) ? false : ['a:solidFill', 'a:gradFill', 'a:pattFill', 'a:blipFill'].some(key => object(spPr[key])) || (refIndex(style, 'a:fillRef') > 0 && !object(spPr['a:grpFill']));
  const ln = spPr['a:ln'];
  const lined = object(ln) && (object(ln['a:noFill']) || number(ln.w) === 0) ? false : object(ln) && ['a:solidFill', 'a:gradFill', 'a:pattFill'].some(key => object(ln[key])) ? true : refIndex(style, 'a:lnRef') > 0;
  const effects = object(spPr['a:effectLst']) && Object.keys(spPr['a:effectLst']).length > 0;
  return {filled, lined, effects, visible: filled || lined || effects};
}

/**
 * What an unclaimed `p:sp` is: `block` (an exported shape block, by its name), `overlay` (an exported overlay shape by its name, or any
 * shape PowerPoint wrote that draws something), or `text` (a text box, a placeholder, an OPF object another reader owns, or a shape that
 * draws nothing: today's text import).
 */
export function shapeRole(drawn, {hasText} = {}) {
  const props = drawn.props ?? {};
  const nv = props['p:nvSpPr'] ?? {};
  const name = String(nv['p:cNvPr']?.name ?? '');
  if (nv['p:nvPr']?.['p:ph'] !== undefined || !drawn.frame) return 'text';
  const exported = exportedShape(name);
  if (exported) return exported.kind;
  if (name.startsWith('OPF ') || object(nv['p:nvPr']?.['p:custDataLst']?.['p:tags'])) return 'text';
  const look = drawsLook(props);
  const spPr = props['p:spPr'] ?? {};
  const rectangle = !object(spPr['a:custGeom']) && (spPr['a:prstGeom']?.prst ?? 'rect') === 'rect';
  if (hasText && rectangle && !look.visible) return 'text';
  if (!look.visible) return 'text';
  if (hasText && truthy(nv['p:cNvSpPr']?.txBox) && !look.filled && !look.lined && !look.effects) return 'text';
  return 'overlay';
}

/** A shape's text from the native body reader's paragraphs: OPF text with the run emphasis, links and colors; sizes and faces are the composition's. */
export function shapeText(paragraphs) {
  if (!paragraphs?.length) return undefined;
  const runs = paragraphs.flatMap((paragraph, index) => [...(index ? ['\n'] : []), ...(Array.isArray(paragraph.richText) ? paragraph.richText : [paragraph.richText ?? paragraph.text])]);
  const cleaned = runs.map(run => {
    if (typeof run === 'string') return run;
    const {fontSize: _size, fontFamily: _family, ...rest} = run;
    return Object.keys(rest).length === 1 && typeof rest.text === 'string' ? rest.text : rest;
  });
  const plain = cleaned.every(run => typeof run === 'string');
  const value = plain ? cleaned.join('') : cleaned;
  return value === '' || (Array.isArray(value) && !value.length) ? undefined : value;
}

// ---------------------------------------------------------------------------
// Into the slide

const EMU_PER_INCH = 914400;

const reportDropped = (dropped, name, slideIndex, report) => {
  for (const property of dropped) report({code: 'shape-property-dropped', path: `slides.${slideIndex}`, property, shape: name, message: `The native shape ${JSON.stringify(name)} has ${property}, which OPF does not represent; it was dropped.`});
};

// An overlay frame as fractions of the slide: from the right edge in a right-to-left deck, as the rest of OPF mirrors start and end.
function placement(frame, {width, height, rtl}, report, name, slideIndex) {
  const left = rtl ? width - frame.x - frame.cx : frame.x;
  const place = {x: left / width, y: frame.y / height, width: frame.cx / width, height: frame.cy / height};
  const clamped = Object.fromEntries(Object.entries(place).map(([key, value]) => [key, round(Math.min(1, Math.max(0, value)), 6)]));
  if (Object.keys(place).some(key => Math.abs(clamped[key] - round(place[key], 6)) > 1e-6)) report({code: 'shape-property-dropped', path: `slides.${slideIndex}`, property: 'position outside the slide', shape: name, message: `The native shape ${JSON.stringify(name)} reaches past the slide's edge, which overlay shapes do not (x, y, width and height are fractions 0 to 1); it was placed at the edge.`});
  return clamped;
}

/**
 * Import one unclaimed native `p:sp` the way `role` says (shapeRole): a shape block comes back as an item of the flat blocks (the
 * caller sorts it with the others, and the stored content record places it again), an overlay shape is kept for assembleOverlayShapes.
 * `context`: width and height (slide EMU), scale, rtl, mapping, format, relationships, text (the shape's OPF text), report, slideIndex, state.
 */
export function importNativeShape(entry, role, context) {
  const cNvPr = entry.props['p:nvSpPr']?.['p:cNvPr'] ?? {};
  const name = String(cNvPr.name ?? ''), frame = entry.frame;
  const read = readShape(entry, context);
  reportDropped(read.dropped, name, context.slideIndex, context.report);
  const fields = read.fields;
  if (context.text !== undefined) fields.text = context.text;
  const nativeId = number(cNvPr.id);
  if (role === 'block') {
    const aspect = frame.cx / frame.cy, expected = presetAspect(fields.shape);
    const payload = {type: 'shape', ...fields};
    // The frame composition gave the block has the preset's proportions unless the block set its own (`aspectRatio`).
    if (frame.cy > 0 && Math.abs(aspect / expected - 1) > 0.01) payload.aspectRatio = round(aspect, 3);
    return {kind: 'shape', bounds: {x: frame.x / EMU_PER_INCH, y: frame.y / EMU_PER_INCH, w: frame.cx / EMU_PER_INCH, h: frame.cy / EMU_PER_INCH}, payload};
  }
  // A filled shape across the whole slide is a background; an overlay is drawn over the content, so it would hide the slide.
  if (frame.cx >= context.width * 0.98 && frame.cy >= context.height * 0.98 && drawsLook(entry.props).filled) {
    context.report({code: 'shape-not-imported', path: `slides.${context.slideIndex}`, shape: name, message: `The native shape ${JSON.stringify(name)} fills the whole slide; an overlay shape is drawn over the content, so it was not imported (set the slide's background instead).`});
    return undefined;
  }
  const shape = {...placement(frame, context, context.report, name, context.slideIndex), ...fields};
  // Whether it hides what is under it: an opaque fill (its own, or its style's).
  const opaque = fields.fill !== 'none' && (fields.fill !== undefined || (fields.style ?? 'moderate') !== 'none') && (fields.opacity ?? 1) > 0.5;
  context.state.overlays.push({z: entry.z, nativeId, name, entry: shape, index: exportedShape(name)?.index, frame, opaque});
  return undefined;
}

/** Keep the slide's `p:cxnSp` connectors for assembleOverlayShapes (their ends resolve once the blocks are rebuilt). */
export function importNativeConnectors(drawn, context) {
  for (const entry of drawn) {
    if (entry.tag !== 'p:cxnSp' || !entry.frame) continue;
    const cNvPr = entry.props['p:nvCxnSpPr']?.['p:cNvPr'] ?? {};
    const name = String(cNvPr.name ?? '');
    const read = readConnector(entry, context);
    reportDropped(read.shape.dropped, name, context.slideIndex, context.report);
    const free = {...placement(entry.frame, context, context.report, name, context.slideIndex), ...read.shape.fields};
    context.state.connectors.push({z: entry.z, nativeId: number(cNvPr.id), name, read, free, index: Number(EXPORTED_CONNECTOR.exec(name)?.[1] ?? NaN)});
  }
}

// ---------------------------------------------------------------------------
// The slide's own colors

const XML_SLOTS = Object.fromEntries(Object.entries(SCHEME_NAMES).map(([xml, name]) => [name, xml]));
const ROLE_VALUES = {text: 'tx1', background: 'bg1', textSecondary: 'tx2', surface: 'bg2', primary: 'accent1', secondary: 'accent2', accent: 'accent3'};

/**
 * `resolve(ref)` for the colors of one slide as the package states them: a ColorRef (hex, a scheme slot or role, `{ color, lighten }`)
 * as `#RRGGBB` through the slide's color map and the theme's clrScheme; undefined for a name the theme does not hold (a variable).
 * The importer compares a shape's colors with what its theme style gives, and picks the text color a shape reads in, with these.
 */
export function nativeColorResolver({colors, mapping}) {
  const slotHex = value => {
    const slot = mapping && Object.hasOwn(mapping, value) ? mapping[value] : value;
    return colors?.[`a:${slot}`] ? readBackgroundColor(colors[`a:${slot}`], {colors, mapping})?.hex : undefined;
  };
  const resolve = ref => {
    if (typeof ref === 'string') {
      const literal = /^#([\da-f]{6})(?:[\da-f]{2})?$/i.exec(ref.trim());
      if (literal) return `#${upper(literal[1])}`;
      return slotHex(ROLE_VALUES[ref] ?? XML_SLOTS[ref]);
    }
    const transform = colorTransform(ref);
    const base = transform && resolve(transform.color);
    return base ? applyColorTransform(base, transform) : undefined;
  };
  return resolve;
}

/**
 * The native id of every shape and picture of a slide (the parsed `p:sp` and `p:pic` nodes, in nativeTextShapes and nativePictures order) by
 * its object name and by the importer's own key (`sp:N`, `pic:N`): what a connector's a:stCxn and a:endCxn name.
 */
export function nativeShapeNames(shapes, pictures) {
  const names = new Map(), keys = new Map();
  const add = (node, key) => {
    const properties = node?.['p:nvSpPr']?.['p:cNvPr'] ?? node?.['p:nvPicPr']?.['p:cNvPr'];
    const id = number(properties?.id);
    if (id === undefined) return;
    names.set(id, String(properties.name ?? ''));
    keys.set(id, key);
  };
  shapes.forEach((node, index) => add(node, `sp:${index}`));
  pictures.forEach((node, index) => add(node, `pic:${index}`));
  return {names, keys};
}

/**
 * An overlay shape is drawn over the composed slide, so a shape PowerPoint drew behind a text box or a picture covers it once imported. Report each
 * opaque overlay shape that lies below content in the slide's z order and overlaps it (`content`: the drawn entries that are text, pictures or
 * frames, with `name`).
 */
export function reportCoveredContent(content, context) {
  for (const overlay of context.state.overlays) {
    if (!overlay.opaque || overlay.index !== undefined) continue;
    const frame = overlay.frame;
    const covered = content.find(item => item.z > overlay.z && item.frame && item.frame.cx > 0 && item.frame.cy > 0 && (() => {
      const width = Math.min(frame.x + frame.cx, item.frame.x + item.frame.cx) - Math.max(frame.x, item.frame.x);
      const height = Math.min(frame.y + frame.cy, item.frame.y + item.frame.cy) - Math.max(frame.y, item.frame.y);
      return width > 0 && height > 0 && (width * height) / (item.frame.cx * item.frame.cy) > 0.25;
    })());
    if (covered) context.report({code: 'shape-covers-content', path: `slides.${context.slideIndex}`, shape: overlay.name, covers: covered.name, message: `The native shape ${JSON.stringify(overlay.name)} is drawn behind ${JSON.stringify(covered.name)}, but an overlay shape is always drawn over the content, so it now covers it. OPF has no layer behind the content; set a slide background or a card instead.`});
  }
}
