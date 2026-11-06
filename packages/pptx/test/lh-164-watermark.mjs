// LH-164: on the accent surface of a message-only slide an image watermark made for the plain surface is drawn in the slide's text color,
// by the preview (a one-color feColorMatrix) and by the export (a one-color a:duotone on the blip), and an import restores design.watermark.
import assert from "node:assert/strict";
import { unzipSync } from "fflate";
import { gallery as defaultCatalog } from "@openpresentation/gallery";
import { toSvg as renderToSvg } from "@openpresentation/opf-render";
import { fromPptx as importPptx, toPptx as exportPptx } from "../dist/index.js";

const catalogs = [defaultCatalog];
const toSvg = (deck, slide) => renderToSvg(deck, slide, { catalogs });
// A 2 x 2 dark-blue PNG (an opaque mark).
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGNkYPj/n4EIwDiqEAzxKAQAJH0DAcQDRTQAAAAASUVORK5CYII=";
const deck = {
  name: "Watermark on the surface",
  language: "en-US",
  assets: { mark: { src: png, alt: "Mark" } },
  slides: [
    { title: "Why this matters", text: "One short message fills the slide.", design: { watermark: { src: "asset:mark", opacity: 0.2 } } },
    { title: "Plain", items: ["One", "Two"], design: { watermark: { src: "asset:mark", opacity: 0.2 } } },
  ],
};
const surface = toSvg(deck, 1), plain = toSvg(deck, 2);
assert.match(surface, /<feColorMatrix[^>]*values="0 0 0 0 [^"]*0 0 0 0 [^"]*0 0 0 0 [^"]*0 0 0 1 0"/, "the preview draws the mark in one color");
assert.doesNotMatch(plain, /watermark-recolor/, "a slide on the plain surface draws the mark as it is");

const bytes = await exportPptx(deck, { catalogs });
const files = unzipSync(bytes), decode = (name) => new TextDecoder().decode(files[name]);
const first = decode("ppt/slides/slide1.xml"), second = decode("ppt/slides/slide2.xml");
const picture = (xml) => xml.match(/<p:pic>(?:(?!<\/p:pic>)[\s\S])*?name="[^"]*[Ww]atermark[^"]*"[\s\S]*?<\/p:pic>/)?.[0] ?? "";
const duotone = picture(first).match(/<a:duotone>([\s\S]*?)<\/a:duotone>/)?.[1] ?? "", colors = duotone.match(/<a:(?:srgbClr|schemeClr)\b[^>]*(?:\/>|>[\s\S]*?<\/a:(?:srgbClr|schemeClr)>)/g) ?? [];
assert.equal(colors.length, 2, "the export recolors the mark");
assert.equal(colors[0], colors[1], "in one color (a theme color where the theme holds it)");
assert.match(picture(first), /<a:alphaModFix amt="20000"\/>/, "and keeps its opacity");
assert.doesNotMatch(picture(second), /a:duotone/, "a slide on the plain surface keeps the mark as it is");
const imported = await importPptx(bytes, { catalogs });
assert.equal((imported.slides[0].design?.watermark ?? imported.design?.watermark)?.opacity, 0.2, "an import restores design.watermark (the deck's, when every slide carries it)");
assert.equal(imported.slides[0].design?.variant, undefined, "and the surface adds no variant");
console.log("LH-164 watermark on the surface passed: one-color mark in the preview and the export, plain slide unchanged, import restores the watermark.");
