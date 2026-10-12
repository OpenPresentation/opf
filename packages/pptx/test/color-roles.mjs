// FA-05: the SVG preview and the PPTX export resolve the color-scheme roles (primary, secondary, accent, background,
// surface, text, textSecondary) and the hyperlink slot to the same colors, through core resolveColorRoles.
import assert from "node:assert/strict";
import { unzipSync } from "fflate";
import { gallery as defaultCatalog } from "@openpresentation/gallery";
import { resolveColorRoles } from "@openpresentation/opf/composition";
import { toSvg as renderToSvg } from "@openpresentation/opf-render";
import {fromPptx as importPptx, toPptx as exportPptx} from "../dist/index.js";

// OPF 0.15 (FA-23): the gallery records these checks name come from the snapshot, which a host registers explicitly
// (`catalogs: [defaultCatalog]`); `records` lists them with their keys as ids.
const records = Object.fromEntries(Object.entries(defaultCatalog).filter(([, map]) => map && typeof map === 'object').map(([kind, map]) => [kind, Object.entries(map).map(([id, record]) => ({id, ...record}))]));
const toSvg = (presentation, slide, options = {}) => renderToSvg(presentation, slide, {catalogs: [defaultCatalog], ...options});
const toPptx = (presentation, options = {}) => exportPptx(presentation, {catalogs: [defaultCatalog], ...options});
const fromPptx = (bytes, options = {}) => importPptx(bytes, {catalogs: [defaultCatalog], ...options});

const ROLES = ["primary", "secondary", "accent", "background", "surface", "text", "textSecondary", "hyperlink"];
const contentSlot = { tx1: "dk1", bg1: "lt1", tx2: "dk2", bg2: "lt2" };
const decode = (bytes) => new TextDecoder().decode(bytes);

function themeColors(files) {
  const xml = decode(files["ppt/theme/theme1.xml"]);
  return Object.fromEntries([...xml.matchAll(/<a:(dk1|lt1|dk2|lt2|accent[1-6]|hlink|folHlink)><a:srgbClr val="([0-9A-F]{6})"\/>/g)].map((m) => [m[1], m[2]]));
}

// The fill of the run whose text is `label`, as RRGGBB, resolving a:schemeClr through the exported theme.
function pptxFill(xml, label, theme) {
  const text = `<a:t>${label}</a:t>`;
  const at = xml.indexOf(text);
  assert.ok(at > 0, `${label} run in the slide`);
  const run = xml.slice(xml.lastIndexOf("<a:r>", at), at);
  const solid = /<a:solidFill>(.*?)<\/a:solidFill>/.exec(run)?.[1];
  assert.ok(solid, `${label} run has a fill`);
  const scheme = /<a:schemeClr val="(\w+)"/.exec(solid)?.[1];
  if (scheme) return theme[contentSlot[scheme] ?? scheme];
  return /<a:srgbClr val="([0-9A-F]{6})"/.exec(solid)[1];
}

function svgFill(svg, label) {
  const found = new RegExp(`<(?:tspan|text)[^>]*? fill="(#[0-9A-Fa-f]{6})"[^>]*>${label}</(?:tspan|text)>`).exec(svg);
  assert.ok(found, `${label} run in the SVG`);
  return found[1].slice(1).toUpperCase();
}

const cases = [
  { name: "role overrides on a light slide", link: "slot", design: { theme: "classic", colorScheme: { id: "cool-horizon", primary: "#112233", secondary: "#223344", accent: "#FF00AA", background: "#FFF8E7", surface: "#EEEEDD", text: "#334455", textSecondary: "#556677" } } },
  { name: "role overrides with a literal dark background", link: "slot", design: { theme: "classic", background: "#10151C", colorScheme: { id: "cool-horizon", surface: "#202A36", text: "#334455", textSecondary: "#8899AA", hyperlink: "#7AB8FF" } } },
  { name: "role overrides on a dark theme slot background", link: "text", design: { theme: "minimal", colorScheme: { id: "cool-horizon", surface: "#1A2B3C", textSecondary: "#99AABB", background: "#FFF8E7" } } },
  { name: "scheme without overrides", link: "slot", design: { theme: "classic", colorScheme: "forest-green" } },
  { name: "hyperlink slot override", link: "slot", design: { theme: "classic", colorScheme: { id: "cool-horizon", hyperlink: "#AA3311", followedHyperlink: "#663399" } } },
];

for (const { name, design, link: linkSource } of cases) {
  // One slide per run, so no run wraps into another.
  const runs = [
    ...ROLES.map((role) => ({ text: `ref${role}`, color: role })),
    { text: "plainlink", link: "https://example.com/plain" },
    { text: "coloredlink", link: "https://example.com/colored", color: "#C0FFEE" },
    { text: "plaintext" },
  ];
  const deck = { design, slides: runs.map((run) => ({ title: "Roles", text: [run] })) };
  const files = unzipSync(await toPptx(deck));
  const theme = themeColors(files);
  const slide = (label) => {
    const index = runs.findIndex((run) => run.text === label);
    return { svg: toSvg(deck, index + 1), xml: decode(files[`ppt/slides/slide${index + 1}.xml`]) };
  };
  const fills = (label) => { const { svg, xml } = slide(label); return { svg: svgFill(svg, label), pptx: pptxFill(xml, label, theme) }; };
  for (const role of ROLES) {
    const { svg, pptx } = fills(`ref${role}`);
    assert.equal(svg, pptx, `${name}: ${role} agrees in preview and export`);
  }
  const link = fills("plainlink");
  assert.equal(link.svg, link.pptx, `${name}: a link run draws in the same color in preview and export`);
  // A link run with no color is drawn in the hyperlink slot, or in the slide text color where the slot is hard to read on the slide.
  assert.equal(link.svg, fills(linkSource === "slot" ? "refhyperlink" : "reftext").svg, `${name}: a link run with no color is drawn in the ${linkSource === "slot" ? "hyperlink slot" : "slide text color"}`);
  const colored = fills("coloredlink");
  assert.equal(colored.svg, "C0FFEE", `${name}: a link run color is kept in the preview`);
  assert.equal(colored.pptx, "C0FFEE", `${name}: a link run color is kept in the export`);
  const { svg: linkSvg, xml: linkXml } = slide("plainlink");
  assert.match(linkSvg, /text-decoration="underline"[^>]*>plainlink</, `${name}: the preview underlines a link`);
  assert.match(linkXml.slice(linkXml.lastIndexOf("<a:r>", linkXml.indexOf("<a:t>plainlink</a:t>")), linkXml.indexOf("<a:t>plainlink</a:t>")), /u="sng"/, `${name}: the export underlines a link`);
  const text = fills("plaintext");
  assert.equal(text.svg, text.pptx, `${name}: default text agrees`);
}

// The resolved colors are core's: a role override reaches both engines as core resolves it.
const cool = records.colorSchemes.find((record) => record.id === "cool-horizon");
const expected = resolveColorRoles({ ...cool, ...cases[0].design.colorScheme }, {});
assert.equal(expected.text, "#334455", "a text override applies on a light background");
assert.equal(expected.surface, "#EEEEDD");
assert.equal(expected.textSecondary, "#556677");
assert.equal(expected.background, "#FFF8E7");
assert.equal(resolveColorRoles({ ...cool, ...cases[0].design.colorScheme }, { background: "#000000" }).text, cool.light1.toUpperCase(), "a text override does not apply on a dark background");
const lightSvg = toSvg({ design: cases[0].design, slides: [{ text: [{ text: "reftext", color: "text" }] }] }, 1);
assert.equal(svgFill(lightSvg, "reftext"), "334455");

// A text override does not make text unreadable on a dark background: the dark slide keeps light1 text, in both engines.
const darkSvg = toSvg({ design: cases[1].design, slides: [{ text: [{ text: "reftext", color: "text" }] }] }, 1);
assert.notEqual(svgFill(darkSvg, "reftext"), "334455", "text override ignored on a dark background");

// Import: a link written in the theme hyperlink color comes back as a link with no color; a link with its own color keeps it.
const linkDeck = { design: { theme: "classic", colorScheme: "forest-green" }, slides: [{ title: "Links", text: [{ text: "plain", link: "https://example.com/p" }, { text: "colored", link: "https://example.com/c", color: "#C0FFEE" }] }] };
const imported = await fromPptx(await toPptx(linkDeck));
const importedRuns = imported.slides[0].text;
const plainRun = importedRuns.find((run) => run.text === "plain"), coloredRun = importedRuns.find((run) => run.text === "colored");
assert.equal(plainRun.link, "https://example.com/p");
assert.equal(plainRun.color, undefined, "a link in the hyperlink color imports with no color");
assert.equal(coloredRun.color, "#C0FFEE", "a link color survives import");

console.log(`Color roles: ${cases.length} decks resolve ${ROLES.length} roles and link runs identically in the preview and the export.`);
