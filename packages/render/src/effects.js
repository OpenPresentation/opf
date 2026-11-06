// SH-03: the six shape effects (shadow, innerShadow, glow, softEdge, reflection, blur) drawn as SVG filters, the preview's twin of
// opf-pptx src/effects.js (a:effectLst). Both read the same presets and defaults; a parity test keeps the two tables equal.
//
// How PowerPoint draws them (measured on PowerPoint for Windows renders through COM, docs/shape-effects.md):
// - every blur radius r is a Gaussian with a standard deviation of r / 3 (outer and inner shadow, blur, reflection);
// - a glow is the outline grown by 0.45 r and blurred by r / 6, drawn behind the shape;
// - a soft edge shrinks the outline by 0.91 r and blurs it by r / 3, and the shape is drawn through that mask;
// - the inner shadow is the outside of the shape moved by the distance toward the angle, blurred and clipped to the shape, so it
//   lies along the edges the angle points at;
// - the order: inner shadow, soft edge, blur on the shape's own fill and outline (never on its text); the glow from that result;
//   the text on top; the outer shadow from all of it (glow and text included, so a shape without fill casts its text's shadow);
//   the reflection is the whole of it (shadow and glow included) mirrored about the shape's bottom edge and faded linearly from
//   `opacity` to transparent over `size` of the shape's height.
// The shadow follows the drawn alpha (the outline, not the bounding box) and keeps its direction when the shape rotates
// (rotWithShape="0" in the export).

/** PowerPoint blur radius to Gaussian standard deviation. */
const SIGMA = 1 / 3;
const SOFT_EDGE_SHRINK = 0.91;
const SOFT_EDGE_SIGMA = 1 / 3;
const GLOW_SPREAD = 0.45;
const GLOW_SIGMA = 0.165;

/** The `shadow` presets (see opf-pptx src/effects.js and docs/shape-effects.md); lengths in reference pixels. */
export const SHADOW_PRESETS = Object.freeze({
  soft: Object.freeze({ color: "#000000", opacity: 0.4, blur: 16 / 3, distance: 4, angle: 90, size: 1 }),
  hard: Object.freeze({ color: "#000000", opacity: 0.25, blur: 0, distance: 8, angle: 45, size: 1 }),
  perspective: Object.freeze({ color: "#000000", opacity: 0.15, blur: 16, distance: 100 / 3, angle: 90, scaleX: 0.9, scaleY: -0.19, align: "b" }),
});

/** Defaults for the object forms (a key left out takes these). */
export const EFFECT_DEFAULTS = Object.freeze({
  shadow: SHADOW_PRESETS.soft,
  innerShadow: Object.freeze({ color: "#000000", opacity: 0.5, blur: 20 / 3, distance: 16 / 3, angle: 45 }),
  glow: Object.freeze({ color: "accent", opacity: 0.4, radius: 20 / 3 }),
  reflection: Object.freeze({ opacity: 0.5, size: 0.35, distance: 0, blur: 2 / 3 }),
});

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value, fallback) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** The block's effects resolved to numbers in reference pixels; an effect that is absent or off is left out. */
export function normalizeEffects(effects = {}) {
  if (!isObject(effects)) return {};
  const out = {};
  const shadow = effects.shadow;
  if (typeof shadow === "string" && Object.hasOwn(SHADOW_PRESETS, shadow)) out.shadow = { preset: shadow, ...SHADOW_PRESETS[shadow] };
  else if (isObject(shadow)) {
    const base = EFFECT_DEFAULTS.shadow;
    const size = Math.max(0, finite(shadow.size, 1));
    out.shadow = {
      color: shadow.color ?? base.color,
      opacity: clamp01(finite(shadow.opacity, base.opacity)),
      blur: Math.max(0, finite(shadow.blur, base.blur)),
      distance: Math.max(0, finite(shadow.distance, base.distance)),
      angle: finite(shadow.angle, base.angle),
      size,
    };
  }
  if (isObject(effects.innerShadow)) {
    const value = effects.innerShadow, base = EFFECT_DEFAULTS.innerShadow;
    out.innerShadow = {
      color: value.color ?? base.color,
      opacity: clamp01(finite(value.opacity, base.opacity)),
      blur: Math.max(0, finite(value.blur, base.blur)),
      distance: Math.max(0, finite(value.distance, base.distance)),
      angle: finite(value.angle, base.angle),
    };
  }
  if (isObject(effects.glow)) {
    const value = effects.glow, base = EFFECT_DEFAULTS.glow;
    const radius = Math.max(0, finite(value.radius, base.radius));
    if (radius > 0) out.glow = { color: value.color ?? base.color, opacity: clamp01(finite(value.opacity, base.opacity)), radius };
  }
  const softEdge = Math.max(0, finite(effects.softEdge, 0));
  if (softEdge > 0) out.softEdge = softEdge;
  if (isObject(effects.reflection)) {
    const value = effects.reflection, base = EFFECT_DEFAULTS.reflection;
    out.reflection = {
      opacity: clamp01(finite(value.opacity, base.opacity)),
      size: clamp01(finite(value.size, base.size)),
      distance: Math.max(0, finite(value.distance, base.distance)),
      blur: Math.max(0, finite(value.blur, base.blur)),
    };
  }
  const blur = Math.max(0, finite(effects.blur, 0));
  if (blur > 0) out.blur = blur;
  return out;
}

const round = (value) => {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
};
const escapeAttr = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function tag(name, attrs = {}, children = "") {
  const serialized = Object.keys(attrs)
    .filter((key) => attrs[key] !== undefined && attrs[key] !== null && attrs[key] !== false)
    .map((key) => ` ${key}="${escapeAttr(typeof attrs[key] === "number" ? round(attrs[key]) : attrs[key])}"`)
    .join("");
  return children === "" ? `<${name}${serialized}/>` : `<${name}${serialized}>${children}</${name}>`;
}

/** A CSS color and its alpha: #RGB, #RRGGBB, #RRGGBBAA, rgb() and rgba() are split; anything else keeps alpha 1. */
function paint(value) {
  const text = String(value ?? "").trim();
  const hex = text.replace(/^#/, "");
  if (/^[\da-f]{3}$/i.test(hex)) return { color: `#${[...hex].map((char) => char + char).join("")}`.toUpperCase(), alpha: 1 };
  if (/^[\da-f]{6}$/i.test(hex)) return { color: `#${hex}`.toUpperCase(), alpha: 1 };
  if (/^[\da-f]{8}$/i.test(hex)) return { color: `#${hex.slice(0, 6)}`.toUpperCase(), alpha: parseInt(hex.slice(6), 16) / 255 };
  const rgba = text.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i);
  if (rgba) {
    const alpha = rgba[4] === undefined ? 1 : rgba[4].endsWith("%") ? parseFloat(rgba[4]) / 100 : parseFloat(rgba[4]);
    return { color: `rgb(${rgba[1]}, ${rgba[2]}, ${rgba[3]})`, alpha: clamp01(alpha) };
  }
  return { color: text || "#000000", alpha: 1 };
}

function flood(ref, opacity, resolveColor, result) {
  const { color, alpha } = paint(typeof resolveColor === "function" ? resolveColor(ref) : ref);
  return tag("feFlood", { "flood-color": color, "flood-opacity": round(clamp01(opacity * alpha)), result });
}

const radians = (degrees) => (degrees * Math.PI) / 180;
const expand = (box, by) => ({ x: box.x - by, y: box.y - by, width: box.width + 2 * by, height: box.height + 2 * by });
const union = (a, b) => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
};
const shift = (box, dx, dy) => ({ ...box, x: box.x + dx, y: box.y + dy });
function transformBox(box, [a, b, c, d, e, f]) {
  const xs = [], ys = [];
  for (const [x, y] of [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]) {
    xs.push(a * x + c * y + e);
    ys.push(b * x + d * y + f);
  }
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}
const region = (box) => ({ filterUnits: "userSpaceOnUse", x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) });

/** The axis-aligned bounds of the outline box turned by `rotate` degrees about its center. */
function bounds(outline) {
  const box = { x: finite(outline?.x, 0), y: finite(outline?.y, 0), width: Math.max(0, finite(outline?.width, 0)), height: Math.max(0, finite(outline?.height, 0)) };
  const turn = finite(outline?.rotate, 0) % 360;
  if (!turn) return box;
  const cos = Math.abs(Math.cos(radians(turn))), sin = Math.abs(Math.sin(radians(turn)));
  const width = box.width * cos + box.height * sin, height = box.width * sin + box.height * cos;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

// The point a scaled shadow grows from (DrawingML ST_RectAlignment on the shape's bounds).
function anchor(box, align = "ctr") {
  const horizontal = align === "ctr" ? "" : align.replace(/^[tb]/, ""), vertical = align === "ctr" ? "" : align.replace(/[lr]$/, "");
  const x = horizontal === "l" ? box.x : horizontal === "r" ? box.x + box.width : box.x + box.width / 2;
  const y = vertical === "t" ? box.y : vertical === "b" ? box.y + box.height : box.y + box.height / 2;
  return [x, y];
}

const DIAGONAL = 0.8, RAMP = 0.35;
// Grow (distance > 0) or shrink (distance < 0) an alpha with a round pen, as PowerPoint does. SVG's feMorphology pen is a square:
// alone it squares a glow's corners and pinches an ellipse's soft edge. A blur cut at the level a straight edge reaches at that
// distance (0.16 outside, 0.84 inside) is round but cuts convex corners too deep. The union of the two is close to the round pen:
// growing, the cut gives the distance along edges and a square of 0.8 of it fills the corners (tuned against PowerPoint); shrinking, a
// square of the full distance keeps a rectangle's corners sharp and the cut keeps an ellipse's ends from pinching.
// `soften` is the blur that follows, which hides the cut's ramp.
function morph(input, distance, soften, result) {
  const reach = Math.abs(distance), grow = distance > 0;
  const level = grow ? 0.1587 : 0.8413, slope = reach / (0.242 * Math.max(soften * RAMP, 0.1));
  return [
    tag("feMorphology", { in: input, operator: grow ? "dilate" : "erode", radius: round(grow ? reach * DIAGONAL : reach), result: `${result}-square` }),
    tag("feGaussianBlur", { in: input, stdDeviation: round(reach), result: `${result}-spread` }),
    tag("feComponentTransfer", { in: `${result}-spread`, result: `${result}-cut` }, tag("feFuncA", { type: "linear", slope: round(slope), intercept: round(0.5 - slope * level) })),
    tag("feComposite", { in: `${result}-square`, in2: `${result}-cut`, operator: "arithmetic", k1: -1, k2: 1, k3: 1, k4: 0, result }),
  ];
}

const NONE = Object.freeze({ defs: "", attributes: Object.freeze({}), empty: true, wrap: (geometry = "", text = "") => `${geometry}${text}` });

/**
 * The SVG for a shape's effects.
 * - `effects`: the block's keys `{ shadow, innerShadow, glow, softEdge, reflection, blur }` in OPF units.
 * - `outline`: `{ x, y, width, height, rotate? }`, the shape's box in the SVG's user units before its rotation (degrees about its
 *   center); the reflection mirrors about the bottom of its rotated bounds and the filter regions are sized from it.
 * - `resolveColor(ref)`: a ColorRef to a CSS color (#RRGGBB, #RRGGBBAA, rgb(), rgba()).
 * - `options.id`: a document-unique id prefix; `options.scale`: user units per reference pixel (min(width, height) / 720).
 * Returns `{ defs, attributes, wrap(geometry, text), empty }`: put `defs` in the document and draw `wrap(geometry, text)`, where
 * `geometry` is the shape's fill and outline markup and `text` its text, both already transformed (rotated or flipped).
 * `attributes` is the filter on the geometry alone, for a caller that draws its own wrapper (no outer shadow or reflection).
 */
export function effectsSvg(effects, outline, resolveColor, { id = "opf-effects", scale = 1 } = {}) {
  const fx = normalizeEffects(effects);
  if (!Object.keys(fx).length) return NONE;
  const box = bounds(outline);
  const px = (value) => value * scale;
  const slack = Math.max(px(8), 0.1 * Math.max(box.width, box.height));
  const defs = [];

  // The geometry: inner shadow, soft edge and blur on its fill and outline, then the glow behind it.
  const body = [];
  let last = "SourceGraphic", bodyMargin = slack;
  if (fx.innerShadow) {
    const value = fx.innerShadow, distance = px(value.distance), angle = radians(value.angle);
    body.push(
      tag("feOffset", { in: "SourceAlpha", dx: round(-distance * Math.cos(angle)), dy: round(-distance * Math.sin(angle)), result: "inner-offset" }),
      tag("feGaussianBlur", { in: "inner-offset", stdDeviation: round(px(value.blur) * SIGMA), result: "inner-blur" }),
      tag("feComposite", { in: "SourceAlpha", in2: "inner-blur", operator: "out", result: "inner-mask" }),
      flood(value.color, value.opacity, resolveColor, "inner-color"),
      tag("feComposite", { in: "inner-color", in2: "inner-mask", operator: "in", result: "inner" }),
      tag("feMerge", { result: "inner-shape" }, tag("feMergeNode", { in: last }) + tag("feMergeNode", { in: "inner" })),
    );
    last = "inner-shape";
  }
  if (fx.softEdge) {
    const radius = px(fx.softEdge);
    body.push(
      ...morph("SourceAlpha", -radius * SOFT_EDGE_SHRINK, radius * SOFT_EDGE_SIGMA, "soft-shrink"),
      tag("feGaussianBlur", { in: "soft-shrink", stdDeviation: round(radius * SOFT_EDGE_SIGMA), result: "soft-mask" }),
      tag("feComposite", { in: last, in2: "soft-mask", operator: "in", result: "soft" }),
    );
    last = "soft";
  }
  if (fx.blur) {
    const radius = px(fx.blur);
    body.push(tag("feGaussianBlur", { in: last, stdDeviation: round(radius * SIGMA), result: "blurred" }));
    last = "blurred";
    bodyMargin += radius;
  }
  if (fx.glow) {
    const value = fx.glow, radius = px(value.radius);
    body.push(
      ...morph(last, radius * GLOW_SPREAD, radius * GLOW_SIGMA, "glow-grow"),
      tag("feGaussianBlur", { in: "glow-grow", stdDeviation: round(radius * GLOW_SIGMA), result: "glow-mask" }),
      flood(value.color, value.opacity, resolveColor, "glow-color"),
      tag("feComposite", { in: "glow-color", in2: "glow-mask", operator: "in", result: "glow" }),
      tag("feMerge", { result: "glowing" }, tag("feMergeNode", { in: "glow" }) + tag("feMergeNode", { in: last })),
    );
    last = "glowing";
    bodyMargin += radius * (GLOW_SPREAD + 3 * GLOW_SIGMA);
  }
  const core = expand(box, bodyMargin);
  const attributes = {};
  if (body.length) {
    defs.push(tag("filter", { id: `${id}-body`, ...region(core), "color-interpolation-filters": "sRGB" }, body.join("")));
    attributes.filter = `url(#${id}-body)`;
  }

  // The outer shadow: the whole shape (glow and text included), scaled about its anchor, moved and blurred, drawn behind it.
  let all = core, shadowMarkup = "";
  if (fx.shadow) {
    const value = fx.shadow, distance = px(value.distance), angle = radians(value.angle);
    const dx = distance * Math.cos(angle), dy = distance * Math.sin(angle), sigma = px(value.blur) * SIGMA;
    const sx = value.scaleX ?? value.size ?? 1, sy = value.scaleY ?? value.size ?? 1;
    const scaled = sx !== 1 || sy !== 1;
    const [ax, ay] = anchor(box, value.align ?? "ctr");
    const matrix = [sx, 0, 0, sy, ax - sx * ax, ay - sy * ay];
    const cast = scaled ? transformBox(core, matrix) : core;
    const area = expand(union(cast, shift(cast, dx, dy)), 3 * sigma + px(1));
    defs.push(tag("filter", { id: `${id}-shadow`, ...region(area), "color-interpolation-filters": "sRGB" }, [
      flood(value.color, value.opacity, resolveColor, "shadow-color"),
      tag("feComposite", { in: "shadow-color", in2: "SourceAlpha", operator: "in", result: "shadow-shape" }),
      tag("feOffset", { in: "shadow-shape", dx: round(dx), dy: round(dy), result: "shadow-offset" }),
      sigma > 0 ? tag("feGaussianBlur", { in: "shadow-offset", stdDeviation: round(sigma) }) : "",
    ].join("")));
    const use = tag("use", { href: `#${id}-core`, ...(scaled ? { transform: `matrix(${matrix.map(round).join(" ")})` } : {}) });
    shadowMarkup = tag("g", { "aria-hidden": "true", filter: `url(#${id}-shadow)` }, use);
    all = union(core, shift(cast, dx, dy));
  }

  // The reflection: everything above mirrored about the bottom of the shape, moved down by the distance, faded and blurred.
  let reflectionMarkup = "";
  if (fx.reflection && fx.reflection.opacity > 0 && fx.reflection.size > 0) {
    const value = fx.reflection, bottom = box.y + box.height, top = bottom + px(value.distance), sigma = px(value.blur) * SIGMA;
    const mirror = [1, 0, 0, -1, 0, 2 * bottom + px(value.distance)];
    const mirrored = expand(transformBox(all, mirror), 3 * sigma + px(1));
    const fadeEnd = top + value.size * box.height;
    defs.push(
      tag("linearGradient", { id: `${id}-reflection-fade`, gradientUnits: "userSpaceOnUse", x1: 0, y1: round(top), x2: 0, y2: round(fadeEnd) },
        tag("stop", { offset: 0, "stop-color": "#FFFFFF", "stop-opacity": round(value.opacity) }) + tag("stop", { offset: 1, "stop-color": "#FFFFFF", "stop-opacity": 0 })),
      tag("mask", { id: `${id}-reflection-mask`, maskUnits: "userSpaceOnUse", x: round(mirrored.x), y: round(top), width: round(mirrored.width), height: round(Math.max(0, fadeEnd - top)) },
        tag("rect", { x: round(mirrored.x), y: round(top), width: round(mirrored.width), height: round(Math.max(0, fadeEnd - top)), fill: `url(#${id}-reflection-fade)` })),
    );
    if (sigma > 0) defs.push(tag("filter", { id: `${id}-reflection-blur`, ...region(mirrored), "color-interpolation-filters": "sRGB" }, tag("feGaussianBlur", { in: "SourceGraphic", stdDeviation: round(sigma) })));
    const use = tag("use", { href: `#${id}-all`, transform: `matrix(${mirror.map(round).join(" ")})` });
    reflectionMarkup = tag("g", { "aria-hidden": "true", mask: `url(#${id}-reflection-mask)` }, sigma > 0 ? tag("g", { filter: `url(#${id}-reflection-blur)` }, use) : use);
  }

  const needsCore = Boolean(shadowMarkup);
  const needsAll = Boolean(reflectionMarkup);
  return {
    defs: defs.join(""),
    attributes,
    empty: false,
    wrap(geometry = "", text = "") {
      const shape = body.length ? tag("g", { filter: attributes.filter }, geometry) : geometry;
      const coreMarkup = needsCore ? tag("g", { id: `${id}-core` }, `${shape}${text}`) : `${shape}${text}`;
      const whole = `${shadowMarkup}${coreMarkup}`;
      return needsAll ? `${reflectionMarkup}${tag("g", { id: `${id}-all` }, whole)}` : whole;
    },
  };
}
