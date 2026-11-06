// SH-03: the shape effects as SVG filters (src/effects.js): the filters PowerPoint's effects map to, the order they are drawn in,
// and a raster check through resvg that each one lands where PowerPoint draws it (docs/shape-effects.md has the measurements).
import assert from "node:assert/strict";
import { Resvg } from "@resvg/resvg-js";
import { EFFECT_DEFAULTS, SHADOW_PRESETS, effectsSvg, normalizeEffects } from "../dist/effects.js";

const hex = (ref) => ({ accent: "#ED7D31", primary: "#4472C4" })[ref] ?? ref;
const box = { x: 100, y: 100, width: 200, height: 120 };
const rect = `<rect x="100" y="100" width="200" height="120" fill="#4472C4"/>`;

// No effects: the markup passes through.
for (const effects of [undefined, {}, { softEdge: 0 }, { shadow: "none" }, { glow: { radius: 0 } }]) {
  const none = effectsSvg(effects, box, hex);
  assert.equal(none.empty, true);
  assert.equal(none.defs, "");
  assert.equal(none.wrap(rect, "<text/>"), `${rect}<text/>`);
}

// Normalization and the presets (shared with opf-pptx src/effects.js; its test checks the two tables are equal).
assert.deepEqual(Object.keys(SHADOW_PRESETS), ["soft", "hard", "perspective"]);
assert.equal(EFFECT_DEFAULTS.shadow, SHADOW_PRESETS.soft);
assert.deepEqual(normalizeEffects({ shadow: { color: "accent" } }).shadow, { color: "accent", opacity: 0.4, blur: 16 / 3, distance: 4, angle: 90, size: 1 });
assert.deepEqual(normalizeEffects({ reflection: { size: 3, opacity: -1 } }).reflection, { opacity: 0, size: 1, distance: 0, blur: 2 / 3 });

// The filters: blur radius r is a Gaussian of r / 3; the inner shadow moves the outside toward the angle; a glow grows the
// outline by 0.45 r and blurs it by 0.165 r behind the shape; a soft edge shrinks it by 0.91 r and blurs it by r / 3.
{
  const fx = effectsSvg({ innerShadow: { distance: 10, angle: 0, blur: 6 }, softEdge: 10, blur: 3, glow: { color: "accent", radius: 20, opacity: 0.5 } }, box, hex, { id: "a" });
  const body = fx.defs.match(/<filter id="a-body"[^>]*>([\s\S]*?)<\/filter>/)[1];
  const order = [...body.matchAll(/result="([a-z-]+)"/g)].map((match) => match[1]).filter((name) => !/-(?:square|spread|cut|color|offset|blur|mask)$/.test(name));
  assert.deepEqual(order, ["inner", "inner-shape", "soft-shrink", "soft", "blurred", "glow-grow", "glow", "glowing"], "inner shadow, soft edge, blur, then the glow");
  assert.match(body, /<feOffset in="SourceAlpha" dx="-10" dy="0"/, "the inner shadow lies along the edge the angle points at");
  assert.match(body, /<feGaussianBlur in="inner-offset" stdDeviation="2"/);
  assert.match(body, /<feMorphology in="SourceAlpha" operator="erode" radius="9.1"/);
  assert.match(body, /<feGaussianBlur in="soft-shrink" stdDeviation="3.333"/);
  assert.match(body, /<feGaussianBlur in="soft" stdDeviation="1"/);
  assert.match(body, /<feGaussianBlur in="glow-grow" stdDeviation="3.3"/);
  assert.match(body, /<feFlood flood-color="#ED7D31" flood-opacity="0.5" result="glow-color"/);
  assert.match(body, /<feMerge result="glowing"><feMergeNode in="glow"\/><feMergeNode in="blurred"\/><\/feMerge>/, "the glow is behind the shape");
  assert.deepEqual(fx.attributes, { filter: "url(#a-body)" });
  // The text is drawn on top, outside the geometry's filter.
  assert.equal(fx.wrap(rect, "<text>T</text>"), `<g filter="url(#a-body)">${rect}</g><text>T</text>`);
}

// The outer shadow is cast by the whole shape (glow and text included), behind it, in slide space (it does not turn with the
// shape); the reflection mirrors everything about the shape's bottom edge.
{
  const fx = effectsSvg({ shadow: { color: "#000000", opacity: 0.5, distance: 10, angle: 90, blur: 6 }, reflection: { opacity: 0.4, size: 0.5, distance: 4 } }, box, hex, { id: "s", scale: 2 });
  assert.match(fx.defs, /<feOffset in="shadow-shape" dx="0" dy="20"/, "distances are reference pixels times the scale");
  assert.match(fx.defs, /<feGaussianBlur in="shadow-offset" stdDeviation="4"/);
  assert.match(fx.defs, /<linearGradient id="s-reflection-fade" gradientUnits="userSpaceOnUse" x1="0" y1="228" x2="0" y2="288">/);
  assert.match(fx.defs, /stop-opacity="0.4"/);
  const drawn = fx.wrap(rect, "<text>T</text>");
  assert.equal(drawn.indexOf('mask="url(#s-reflection-mask)"') < drawn.indexOf('filter="url(#s-shadow)"'), true, "the reflection, then the shadow, then the shape");
  assert.match(drawn, /<use href="#s-all" transform="matrix\(1 0 0 -1 0 448\)"\/>/);
  assert.match(drawn, /<g id="s-core"><rect[^>]*\/><text>T<\/text><\/g>/);
  assert.match(drawn, /<g aria-hidden="true" filter="url\(#s-shadow\)"><use href="#s-core"\/><\/g>/);
  const scaled = effectsSvg({ shadow: { size: 1.5 } }, box, hex, { id: "z" }).wrap(rect);
  assert.match(scaled, /<use href="#z-core" transform="matrix\(1.5 0 0 1.5 -100 -80\)"\/>/, "a sized shadow grows from the center");
  const perspective = effectsSvg({ shadow: "perspective" }, box, hex, { id: "p" }).wrap(rect);
  assert.match(perspective, /transform="matrix\(0.9 0 0 -0.19 20 261.8\)"/, "the perspective shadow folds down from the bottom edge");
  const turned = effectsSvg({ reflection: {} }, { ...box, rotate: 90 }, hex, { id: "r" }).wrap(rect);
  assert.match(turned, /matrix\(1 0 0 -1 0 520\)/, "a turned shape reflects about the bottom of its turned bounds");
}

// Raster: draw each effect with resvg and look at the pixels around the shape.
const W = 400, H = 360;
function raster(effects, { geometry = rect, text = "" } = {}) {
  const fx = effectsSvg(effects, box, hex, { id: "t" });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#FFFFFF"/><defs>${fx.defs}</defs>${fx.wrap(geometry, text)}</svg>`;
  const { pixels } = new Resvg(svg, { font: { loadSystemFonts: false } }).render();
  return (x, y) => [...pixels.subarray((y * W + x) * 4, (y * W + x) * 4 + 3)];
}
const blue = [68, 114, 196], white = [255, 255, 255];
const near = (actual, expected, tolerance = 6, label = "") => assert.ok(actual.every((value, index) => Math.abs(value - expected[index]) <= tolerance), `${label}: ${actual} is not near ${expected}`);
{
  const px = raster({ shadow: { color: "#000000", opacity: 1, blur: 0, distance: 20, angle: 45 } });
  near(px(200, 160), blue, 2, "shape");
  near(px(305, 225), [0, 0, 0], 2, "hard shadow down and to the right");
  near(px(95, 95), white, 2, "nothing up and to the left");
}
{
  const px = raster({ shadow: { color: "#000000", opacity: 1, blur: 20, distance: 0 } });
  const edge = px(300, 160)[0];
  assert.ok(edge > 100 && edge < 160, `a centered blur is half dark at the edge (${edge})`);
  near(px(322, 160), white, 4, "a blur of 20 reaches about 20 out");
}
{
  const px = raster({ glow: { color: "#FF0000", opacity: 1, radius: 20 } });
  near(px(302, 160), [255, 0, 0], 10, "a glow is the full color next to the edge");
  near(px(330, 160), white, 4, "and gone a radius out");
  near(px(200, 160), blue, 2, "behind the shape");
}
{
  const px = raster({ softEdge: 20 });
  near(px(200, 160), blue, 2, "a soft edge leaves the middle");
  near(px(102, 160), white, 6, "and fades the edge out");
}
{
  const px = raster({ innerShadow: { color: "#000000", opacity: 1, blur: 0, distance: 15, angle: 45 } });
  near(px(295, 160), [0, 0, 0], 2, "the inner shadow lies along the right edge for 45 degrees");
  near(px(105, 160), blue, 2, "not along the left edge");
}
{
  const px = raster({ reflection: { opacity: 1, size: 1, distance: 10, blur: 0 } });
  near(px(200, 225), white, 2, "the distance leaves a gap");
  const top = px(200, 232)[0], bottom = px(200, 345)[0];
  assert.ok(top < 110 && bottom > 230, `the reflection fades from ${top} to ${bottom}`);
}
{
  // Text in a shape without fill casts the shadow; the glow and soft edge never touch it.
  const text = `<rect x="180" y="140" width="40" height="40" fill="#4472C4"/>`;
  const shadowed = raster({ shadow: { color: "#000000", opacity: 1, blur: 0, distance: 10, angle: 0 } }, { geometry: "", text });
  near(shadowed(225, 160), [0, 0, 0], 2, "the text casts the shadow");
  const soft = raster({ softEdge: 30 }, { geometry: rect, text });
  near(soft(181, 141), blue, 2, "the soft edge leaves the text");
}

console.log("shape effects (SVG filters): ok");
