// SH-02: shape blocks and strokes in the SVG preview.
//
// A shape block (core ComposedItem.shape) is drawn from core's evaluated geometry (SH-01 presetGeometry, in slide coordinates):
// each path filled in its DrawingML mode (norm, or the fill shaded by lighten, lightenLess, darken and darkenLess) and stroked where
// the path takes the line, in order; then the effects (SH-03's drawEffects); then the text, fitted by core in shape.textArea. The
// whole drawing turns about the frame's center (rotate) and mirrors (flip); the text turns with it but is not mirrored, and a vertical
// flip turns it upside down, as PowerPoint draws it. The PPTX export writes the same shape natively (opf-pptx src/shape-blocks.js).
//
// strokeElements draws every stroke property (color or gradient, width, dash presets and arrays, cap, join, miter limit, compound
// lines, inside alignment and arrowheads) for a shape's paths and for a picture's outline; sketch is PowerPoint's own randomized line
// and is drawn plain.

import { colorTransform, applyColorTransform, patternRuns, textColorForFill } from "@openpresentation/opf/composition";

const HIDDEN = Object.freeze({ "aria-hidden": "true" });
const number = value => (Number.isInteger(value) ? String(value) : Number(value).toFixed(3).replace(/\.?0+$/, ""));
const precise = value => String(Math.round(value * 1e6) / 1e6);

/** DrawingML preset dashes as dash and gap lengths in line widths (PowerPoint's patterns for a flat cap). */
export const PRESET_DASHES = Object.freeze({
  solid: null, dot: [1, 3], dash: [4, 3], longDash: [8, 3], dashDot: [4, 3, 1, 3], longDashDot: [8, 3, 1, 3], longDashDotDot: [8, 3, 1, 3, 1, 3],
  sysDot: [1, 1], sysDash: [3, 1], sysDashDot: [3, 1, 1, 1], sysDashDotDot: [3, 1, 1, 1, 1, 1],
});
/** Compound lines as bands across the line's width, from its outer edge (0) to its inner edge (1): the parts that are drawn. */
export const COMPOUND_BANDS = Object.freeze({
  single: [[0, 1]], double: [[0, 1 / 3], [2 / 3, 1]], thickThin: [[0, 0.6], [0.8, 1]], thinThick: [[0, 0.2], [0.4, 1]], triple: [[0, 1 / 6], [1 / 3, 2 / 3], [5 / 6, 1]],
});
/** Arrowhead width and length in line widths, for small, medium and large. */
export const ARROWHEAD_SIZES = Object.freeze({ small: 2, medium: 3, large: 5 });

// A ColorRef as an opaque #RRGGBB and the alpha of an eight-digit hex.
function paintOf(value, helpers, fallback) {
  const hex = helpers.resolveColorRef(value, fallback) ?? fallback;
  const raw = String(hex).replace(/^#/, "");
  const six = /^[0-9a-f]{3}$/i.test(raw) ? [...raw].map(char => char + char).join("") : raw.slice(0, 6);
  return { color: `#${six.toUpperCase()}`, alpha: raw.length === 8 ? parseInt(raw.slice(6), 16) / 255 : 1 };
}

// DrawingML path fill modes as PowerPoint draws them: lighten mixes 40% white into the fill, lightenLess 20%, darken scales it to 60%,
// darkenLess to 80%, on the sRGB values (measured in PowerPoint 365's export of can, cube and bevel).
const SHADE = Object.freeze({ lighten: ["tint", 0.6], lightenLess: ["tint", 0.8], darken: ["shade", 0.6], darkenLess: ["shade", 0.8] });
export function shadeColor(hex, mode) {
  const entry = SHADE[mode];
  if (!entry) return hex;
  const [kind, amount] = entry;
  const channels = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255);
  const mixed = channels.map(value => kind === "shade" ? value * amount : value * amount + (1 - amount));
  return `#${mixed.map(value => Math.round(Math.min(1, Math.max(0, value)) * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

// A gradient (core ComposedGradient) in the frame `box`: linear along its angle across the box; radial, rectangle and shape as an
// ellipse from the center (the preview's approximation of DrawingML's rect and shape paths, which follow the frame and the outline).
function gradientDef(gradient, id, box, helpers, mode, alpha = 1) {
  const stop = (offset, t) => {
    const color = sampleStops(gradient.stops, t, helpers);
    return helpers.tag("stop", { offset: precise(offset), "stop-color": shadeColor(color.color, mode), "stop-opacity": color.alpha * alpha < 1 ? precise(color.alpha * alpha) : undefined });
  };
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  if (gradient.type === "linear") {
    // PowerPoint mixes a gradient's colors in linear light and eases each span between two stops (smoothstep): the preview samples
    // the gradient so SVG's straight sRGB mixing between samples stays within a level or two of it.
    const offsets = [...new Set([...gradient.stops.map(entry => entry.position), ...Array.from({ length: GRADIENT_SAMPLES + 1 }, (_, index) => index / GRADIENT_SAMPLES)])].sort((a, b) => a - b);
    const angle = gradient.angle * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
    const half = (Math.abs(box.width * cos) + Math.abs(box.height * sin)) / 2;
    return helpers.tag("linearGradient", { id, gradientUnits: "userSpaceOnUse", x1: number(cx - half * cos), y1: number(cy - half * sin), x2: number(cx + half * cos), y2: number(cy + half * sin) }, offsets.map(offset => stop(offset, offset)).join(""));
  }
  // PowerPoint's path gradients run from the center to the frame's corners (an ellipse of sqrt(2) times the half width and height),
  // eased and mixed as a linear one (measured on PowerPoint 365's export of a:path circle).
  const reach = Math.SQRT2;
  const samples = Array.from({ length: GRADIENT_SAMPLES + 1 }, (_, index) => index / GRADIENT_SAMPLES).map(offset => stop(offset, offset)).join("");
  return helpers.tag("radialGradient", { id, gradientUnits: "userSpaceOnUse", cx: 0, cy: 0, r: 1, gradientTransform: `matrix(${number(box.width / 2 * reach)} 0 0 ${number(box.height / 2 * reach)} ${number(cx)} ${number(cy)})` }, samples);
}
const GRADIENT_SAMPLES = 24;
const toLinear = value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const toSrgb = value => value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
// The color `t` of the way through gradient stops, as PowerPoint draws it: within the span of two stops eased by smoothstep and mixed
// in linear light; the alpha mixed the same way.
function sampleStops(stops, t, helpers) {
  const paints = stops.map(entry => ({ position: entry.position, ...paintOf(entry.color, helpers, "#000000") }));
  if (t <= paints[0].position) return paints[0];
  const after = paints.findIndex(entry => entry.position >= t);
  if (after < 0) return paints[paints.length - 1];
  const a = paints[after - 1], b = paints[after], linear = b.position > a.position ? (t - a.position) / (b.position - a.position) : 1, k = linear * linear * (3 - 2 * linear);
  const channel = at => {
    const mixed = toLinear(parseInt(a.color.slice(at, at + 2), 16) / 255) * (1 - k) + toLinear(parseInt(b.color.slice(at, at + 2), 16) / 255) * k;
    return Math.round(Math.min(1, Math.max(0, toSrgb(mixed))) * 255).toString(16).padStart(2, "0");
  };
  return { color: `#${channel(1)}${channel(3)}${channel(5)}`.toUpperCase(), alpha: a.alpha * (1 - k) + b.alpha * k };
}

// The SVG paint of a fill (core ComposedFill) for one path's fill mode: { fill, opacity, defs }.
function fillPaint(fill, mode, id, box, helpers) {
  if (!fill || fill.type === "none" || mode === "none") return { fill: "none" };
  const alpha = fill.opacity ?? 1;
  if (fill.type === "solid") {
    const paint = paintOf(fill.color, helpers, helpers.colors.primary);
    return { fill: shadeColor(paint.color, mode), opacity: paint.alpha * alpha };
  }
  if (fill.type === "gradient") return { fill: `url(#${id})`, defs: gradientDef(fill.gradient, id, box, helpers, mode, alpha) };
  const runs = patternRuns(fill.preset);
  const foreground = shadeColor(paintOf(fill.foreground ?? "accent1", helpers, helpers.colors.primary).color, mode);
  const background = paintOf(fill.background ?? helpers.colors.background, helpers, helpers.colors.background);
  if (!runs) helpers.report?.({ code: "unsupported-pattern", message: `Pattern ${fill.preset} is not implemented by the SVG preview.` });
  const cell = helpers.tag("rect", { width: 8, height: 8, fill: shadeColor(background.color, mode), "fill-opacity": background.alpha < 1 ? precise(background.alpha) : undefined })
    + (runs ? helpers.tag("path", { d: runs.map(run => `M${run.x} ${run.y}h${run.width}v1h-${run.width}z`).join(""), fill: foreground, "shape-rendering": "crispEdges" }) : "");
  return { fill: `url(#${id})`, opacity: alpha, defs: helpers.tag("pattern", { id, x: number(box.x), y: number(box.y), width: 8, height: 8, patternUnits: "userSpaceOnUse" }, cell) };
}

// An arrowhead at one end (core ShapeEnd), as a polygon in the line's color; `cover` is the part of the line the head hides.
function arrowheadParts(head, end, width, color, helpers) {
  const w = Math.max(width, 1) * ARROWHEAD_SIZES[head.width], l = Math.max(width, 1) * ARROWHEAD_SIZES[head.length];
  const at = `translate(${number(end.x)} ${number(end.y)}) rotate(${number(end.angle)})`;
  const attrs = { ...HIDDEN, transform: at, fill: color.color, "fill-opacity": color.alpha < 1 ? precise(color.alpha) : undefined };
  switch (head.type) {
    case "triangle": return { shape: helpers.tag("path", { ...attrs, d: `M0 0L${number(-l)} ${number(w / 2)}L${number(-l)} ${number(-w / 2)}Z` }), cover: { transform: at, x: -l, width: l, height: Math.max(w, width) } };
    case "stealth": return { shape: helpers.tag("path", { ...attrs, d: `M0 0L${number(-l)} ${number(w / 2)}L${number(-l / 2)} 0L${number(-l)} ${number(-w / 2)}Z` }), cover: { transform: at, x: -l / 2, width: l / 2, height: Math.max(w / 2, width) } };
    case "diamond": return { shape: helpers.tag("path", { ...attrs, d: `M${number(l / 2)} 0L0 ${number(w / 2)}L${number(-l / 2)} 0L0 ${number(-w / 2)}Z` }) };
    case "oval": return { shape: helpers.tag("ellipse", { ...attrs, cx: 0, cy: 0, rx: number(l / 2), ry: number(w / 2) }) };
    default: return { shape: helpers.tag("path", { ...HIDDEN, transform: at, d: `M${number(-l)} ${number(w / 2)}L0 0L${number(-l)} ${number(-w / 2)}`, fill: "none", stroke: color.color, "stroke-opacity": color.alpha < 1 ? precise(color.alpha) : undefined, "stroke-width": number(width), "stroke-linejoin": "miter" }) };
  }
}

/**
 * The SVG of one stroke (core ComposedStroke) along path data `d`: the line, its compound bands and inside alignment as masks, and
 * its arrowheads at `ends` (an open path's ends). `closed` tells inside from outside. Returns { defs, elements }.
 */
export function strokeElements(stroke, d, id, { box, closed, ends, helpers, mode = "norm" }) {
  if (!stroke || !(stroke.width > 0)) return { defs: "", elements: "" };
  const defs = [], width = stroke.width;
  let paint;
  if (stroke.gradient) { defs.push(gradientDef(stroke.gradient, `${id}-grad`, box, helpers, mode)); paint = { stroke: `url(#${id}-grad)` }; }
  const color = paintOf(stroke.color ?? helpers.colors.border, helpers, helpers.colors.border);
  if (!paint) paint = { stroke: shadeColor(color.color, mode), "stroke-opacity": color.alpha < 1 ? precise(color.alpha) : undefined };
  const dash = Array.isArray(stroke.dash) ? stroke.dash : PRESET_DASHES[stroke.dash] ?? null;
  // The line's extent across the outline: centered on it, or inside it (closed outlines only).
  const inside = stroke.align === "inside" && closed, bands = COMPOUND_BANDS[stroke.compound] ?? COMPOUND_BANDS.single;
  // Offsets from the outline, positive outside: [outer, inner] edge of each band.
  const offsets = bands.map(([from, to]) => inside ? [-from * width, -to * width] : [width / 2 - from * width, width / 2 - to * width]);
  const reach = Math.max(...offsets.flat().map(Math.abs));
  const plain = !inside && bands.length === 1;
  const region = { x: -1e5, y: -1e5, width: 2e5, height: 2e5 };
  const heads = [stroke.start && ends?.start ? arrowheadParts(stroke.start, ends.start, width, color, helpers) : undefined, stroke.end && ends?.end ? arrowheadParts(stroke.end, ends.end, width, color, helpers) : undefined].filter(Boolean);
  const covers = heads.flatMap(head => head.cover ? [helpers.tag("rect", { transform: head.cover.transform, x: number(head.cover.x), y: number(-head.cover.height / 2 - 1), width: number(head.cover.width + 1), height: number(head.cover.height + 2), fill: "#000" })] : []);
  const base = { ...HIDDEN, d, fill: "none", ...paint, "stroke-linecap": stroke.cap === "flat" ? undefined : stroke.cap === "round" ? "round" : "square", "stroke-linejoin": stroke.join === "miter" ? "miter" : stroke.join, "stroke-miterlimit": stroke.join === "miter" ? number(stroke.miterLimit) : undefined,
    "stroke-dasharray": dash ? dash.map(part => number(part * width)).join(" ") : undefined };
  const elements = [], mask = (name, content) => { defs.push(helpers.tag("mask", { id: name, maskUnits: "userSpaceOnUse", ...region }, content + covers.join(""))); return `url(#${name})`; };
  const ring = (radius, color) => radius > 1e-9 ? helpers.tag("path", { d, fill: "none", stroke: color, "stroke-width": number(2 * radius), "stroke-linejoin": base["stroke-linejoin"], "stroke-miterlimit": base["stroke-miterlimit"], "stroke-linecap": base["stroke-linecap"] }) : "";
  if (plain) {
    elements.push(helpers.tag("path", { ...base, "stroke-width": number(width), mask: covers.length ? mask(`${id}-ends`, helpers.tag("rect", { ...region, fill: "#fff" })) : undefined }));
  } else {
    // Each band is the set of points whose distance from the outline (positive outside) lies between its inner and outer offsets: the
    // outline stroked as wide as the far edge less the stroke as wide as the near edge, on its side of a closed outline.
    let part = 0;
    const draw = content => elements.push(helpers.tag("path", { ...base, "stroke-width": number(2 * reach), mask: mask(`${id}-band-${part++}`, content) }));
    for (const [outer, inner] of offsets) {
      if (!closed) {
        const far = Math.max(Math.abs(outer), Math.abs(inner)), near = Math.sign(outer) === Math.sign(inner) ? Math.min(Math.abs(outer), Math.abs(inner)) : 0;
        draw(ring(far, "#fff") + ring(near, "#000"));
        continue;
      }
      const outHi = Math.max(0, outer), outLo = Math.max(0, inner);
      if (outHi - outLo > 1e-9) draw(ring(outHi, "#fff") + ring(outLo, "#000") + helpers.tag("path", { d, fill: "#000" }));
      const inFar = -Math.min(0, inner), inNear = -Math.min(0, outer);
      if (inFar - inNear > 1e-9) {
        const clip = `${id}-band-${part}-inside`;
        draw(helpers.tag("clipPath", { id: clip }, helpers.tag("path", { d })) + helpers.tag("g", { "clip-path": `url(#${clip})` }, ring(inFar, "#fff") + ring(inNear, "#000")));
      }
    }
  }
  return { defs: defs.join(""), elements: elements.join("") + heads.map(head => head.shape).join("") };
}

/**
 * SH-03 draws a shape's effects here (shadow, innerShadow, glow, softEdge, reflection, blur): `under` is drawn before the shape's
 * paths, `over` after them, `filter` is set on the shape's group. On SH-02's branch it draws nothing.
 */
export function drawEffects(_shape, _id, _helpers) {
  return { defs: "", under: "", over: "", filter: undefined };
}

/** The text color of a shape: the style's preferred color where it reads at 4.5:1 on the backdrop (core shapeTextColor), else black or white. */
export function shapeTextFill(shape, helpers) {
  const preferred = paintOf(shape.textColor, helpers, helpers.colors.text).color;
  if (shape.textBackdrop === undefined) return textColorForFill(helpers.colors.background, preferred);
  return textColorForFill(paintOf(shape.textBackdrop, helpers, helpers.colors.background).color, preferred);
}

/** A shape block (core ComposedItem.shape). `helpers` gives the renderer's tag, colors and text drawing. */
export function renderShapeBlock(item, helpers) {
  const shape = item.shape;
  if (!shape || shape.hidden) return "";
  const id = `${helpers.idPrefix}-shape-${item.path.replace(/[^A-Za-z0-9]+/g, "-")}`, box = shape.box, defs = [], parts = [];
  const effects = drawEffects(shape, id, helpers);
  if (effects.defs) defs.push(effects.defs);
  shape.paths.forEach((path, index) => {
    const fill = fillPaint(shape.fill, path.fill, `${id}-fill-${index}`, box, helpers);
    if (fill.defs) defs.push(fill.defs);
    const closed = !path.open;
    if (fill.fill !== "none") parts.push(helpers.tag("path", { ...HIDDEN, d: path.d, fill: fill.fill, "fill-opacity": fill.opacity !== undefined && fill.opacity < 1 ? precise(fill.opacity) : undefined }));
    if (path.stroke && shape.stroke) {
      const stroke = strokeElements(shape.stroke, path.d, `${id}-line-${index}`, { box, closed, ends: path.ends, helpers });
      if (stroke.defs) defs.push(stroke.defs);
      parts.push(stroke.elements);
    }
  });
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const turn = shape.rotate ? `rotate(${number(shape.rotate)} ${number(cx)} ${number(cy)})` : "";
  const mirror = shape.flipH || shape.flipV ? `translate(${number(cx)} ${number(cy)}) scale(${shape.flipH ? -1 : 1} ${shape.flipV ? -1 : 1}) translate(${number(-cx)} ${number(-cy)})` : "";
  const outline = helpers.tag("g", { transform: [turn, mirror].filter(Boolean).join(" ") || undefined, filter: effects.filter }, effects.under + parts.join("") + effects.over);
  let text = "";
  if (item.text && shape.textArea) {
    const area = shape.textArea, tx = area.x + area.width / 2, ty = shape.textBox.y + shape.textBox.height / 2;
    const fill = shapeTextFill(shape, helpers);
    const drawn = helpers.drawText(item, area, fill);
    const textTurn = [turn, shape.flipV ? `rotate(180 ${number(cx)} ${number(cy)})` : "", shape.textDirection === "vertical" ? `rotate(90 ${number(tx)} ${number(ty)})` : shape.textDirection === "vertical270" ? `rotate(-90 ${number(tx)} ${number(ty)})` : ""].filter(Boolean).join(" ");
    text = textTurn ? helpers.tag("g", { transform: textTurn }, drawn) : drawn;
  }
  const accessible = shape.decorative || (shape.alt === undefined && !item.text) ? HIDDEN : { role: "img", "aria-label": shape.alt ?? undefined };
  const body = (defs.length ? helpers.tag("defs", {}, defs.join("")) : "") + outline + text;
  const content = shape.link ? helpers.tag("a", { href: shape.link }, body) : body;
  return helpers.tag("g", { ...(shape.alt !== undefined && !shape.decorative ? accessible : shape.decorative ? HIDDEN : {}), ...helpers.trace }, content);
}

export { colorTransform, applyColorTransform };
