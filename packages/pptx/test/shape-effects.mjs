// SH-03: the shape effects as DrawingML a:effectLst (src/effects.js): exact units, the schema's child order, the shadow presets
// as a:outerShdw, and the same presets and defaults as the preview (opf-render src/effects.js).
import assert from "node:assert/strict";
import { XMLParser } from "fast-xml-parser";
import { EFFECT_DEFAULTS, SHADOW_PRESETS, effectsXml, normalizeEffects } from "../dist/effects.js";
import * as preview from "../../render/src/effects.js";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", preserveOrder: true });
const children = (xml) => parser.parse(xml)[0]["a:effectLst"].map((node) => Object.keys(node).find((key) => key !== ":@"));
const attrs = (xml, name) => parser.parse(xml)[0]["a:effectLst"].find((node) => node[name])[":@"];
const hex = (ref) => ({ accent: "#ED7D31", primary: "#4472C4" })[ref] ?? ref;

// Nothing to write.
assert.equal(effectsXml(undefined, hex), "");
assert.equal(effectsXml({}, hex), "");
assert.equal(effectsXml({ softEdge: 0, blur: 0, glow: { radius: 0 } }, hex), "");
assert.equal(effectsXml({ shadow: "none" }, hex), "", "an unknown preset writes nothing");

// CT_EffectList is a sequence: blur, fillOverlay, glow, innerShdw, outerShdw, prstShdw, reflection, softEdge.
const all = effectsXml({ softEdge: 4, reflection: {}, shadow: "soft", innerShadow: {}, glow: { color: "primary" }, blur: 2 }, hex);
assert.deepEqual(children(all), ["a:blur", "a:glow", "a:innerShdw", "a:outerShdw", "a:reflection", "a:softEdge"]);
assert.ok(!all.includes("prstShdw"), "presets are written as a:outerShdw");

// Units: 9525 EMU a reference pixel (times the slide scale), 60000ths of a degree, 1/100000 alpha.
const shadow = effectsXml({ shadow: { color: "#FF0000", opacity: 0.5, blur: 10, distance: 20, angle: 135 } }, hex);
assert.equal(shadow, '<a:effectLst><a:outerShdw blurRad="95250" dist="190500" dir="8100000" algn="tl" rotWithShape="0"><a:srgbClr val="FF0000"><a:alpha val="50000"/></a:srgbClr></a:outerShdw></a:effectLst>');
assert.equal(attrs(effectsXml({ shadow: { distance: 20, angle: -90 } }, hex), "a:outerShdw").dir, "16200000", "angles wrap into 0..360");
assert.equal(attrs(effectsXml({ shadow: { angle: 360 } }, hex), "a:outerShdw").dir, "0", "dir stays below 21600000");
assert.equal(attrs(effectsXml({ blur: 10 }, hex, { scale: 0.75 }), "a:blur").rad, String(Math.round(10 * 0.75 * 9525)), "scale follows the slide's short edge");

// A shadow's size scales it about the shape's center.
assert.deepEqual(attrs(effectsXml({ shadow: { size: 1.2 } }, hex), "a:outerShdw"), { blurRad: "50800", dist: "38100", dir: "5400000", sx: "120000", sy: "120000", algn: "ctr", rotWithShape: "0" });

// The presets look like PowerPoint's Shadow gallery entries.
assert.equal(effectsXml({ shadow: "soft" }, hex), '<a:effectLst><a:outerShdw blurRad="50800" dist="38100" dir="5400000" algn="tl" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="40000"/></a:srgbClr></a:outerShdw></a:effectLst>', "soft: Offset: Bottom (4 pt blur, 3 pt down, 60% transparent)");
assert.equal(effectsXml({ shadow: "hard" }, hex), '<a:effectLst><a:outerShdw blurRad="0" dist="76200" dir="2700000" algn="tl" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="25000"/></a:srgbClr></a:outerShdw></a:effectLst>');
assert.equal(effectsXml({ shadow: "perspective" }, hex), '<a:effectLst><a:outerShdw blurRad="152400" dist="317500" dir="5400000" sx="90000" sy="-19000" algn="b" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="15000"/></a:srgbClr></a:outerShdw></a:effectLst>', "perspective: Perspective: Below");

// Inner shadow, glow, soft edge, reflection and blur.
assert.equal(effectsXml({ innerShadow: { color: "#000000", opacity: 1, blur: 4, distance: 6, angle: 45 } }, hex), '<a:effectLst><a:innerShdw blurRad="38100" dist="57150" dir="2700000"><a:srgbClr val="000000"/></a:innerShdw></a:effectLst>');
assert.equal(effectsXml({ glow: { color: "accent", opacity: 0.6, radius: 10 } }, hex), '<a:effectLst><a:glow rad="95250"><a:srgbClr val="ED7D31"><a:alpha val="60000"/></a:srgbClr></a:glow></a:effectLst>');
assert.equal(effectsXml({ softEdge: 8 }, hex), '<a:effectLst><a:softEdge rad="76200"/></a:effectLst>');
assert.equal(effectsXml({ blur: 4 }, hex), '<a:effectLst><a:blur rad="38100" grow="1"/></a:effectLst>');
assert.equal(effectsXml({ reflection: { opacity: 0.5, size: 0.35, distance: 4, blur: 2 } }, hex), '<a:effectLst><a:reflection blurRad="19050" stA="50000" stPos="0" endA="0" endPos="35000" dist="38100" dir="5400000" sy="-100000" algn="bl" rotWithShape="0"/></a:effectLst>');

// Colors: an alpha byte multiplies the opacity; a color element from the caller keeps its transforms and gets a:alpha last.
assert.match(effectsXml({ glow: { color: "#00FF0080", opacity: 0.5 } }, hex), /<a:srgbClr val="00FF00"><a:alpha val="25098"\/><\/a:srgbClr>/);
assert.match(effectsXml({ glow: { color: "accent1", opacity: 0.4 } }, () => '<a:schemeClr val="accent1"><a:lumMod val="75000"/></a:schemeClr>'), /<a:schemeClr val="accent1"><a:lumMod val="75000"\/><a:alpha val="40000"\/><\/a:schemeClr>/);
assert.match(effectsXml({ glow: { color: "accent1", opacity: 0.4 } }, () => '<a:schemeClr val="accent1"/>'), /<a:schemeClr val="accent1"><a:alpha val="40000"\/><\/a:schemeClr>/);
assert.match(effectsXml({ glow: { color: "accent1", opacity: 1 } }, () => '<a:schemeClr val="accent1"/>'), /<a:glow rad="63500"><a:schemeClr val="accent1"\/><\/a:glow>/);

// Out-of-range input is clamped, never written as an invalid DrawingML value.
const clamped = effectsXml({ shadow: { opacity: 3, blur: -4, distance: -2 }, reflection: { opacity: -1, size: 4 } }, hex);
assert.match(clamped, /blurRad="0" dist="0"/);
assert.match(clamped, /<a:srgbClr val="000000"\/>/);
assert.match(clamped, /stA="0" stPos="0" endA="0" endPos="100000"/);

// The preview reads the same presets, defaults and normalization.
assert.deepEqual(SHADOW_PRESETS, preview.SHADOW_PRESETS);
assert.deepEqual(EFFECT_DEFAULTS, preview.EFFECT_DEFAULTS);
for (const effects of [{ shadow: "perspective", glow: {}, softEdge: 3 }, { shadow: { size: 1.1 }, innerShadow: { angle: 200 }, reflection: { size: 2 }, blur: 1 }]) {
  assert.deepEqual(normalizeEffects(effects), preview.normalizeEffects(effects));
}

console.log("shape effects (a:effectLst): ok");
