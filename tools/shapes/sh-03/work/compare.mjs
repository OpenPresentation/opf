// Build the same cells two ways: a PPTX through effectsXml (opened in PowerPoint) and an SVG through effectsSvg (rendered by resvg).
import { pathToFileURL } from "node:url";
import { effectsXml } from "file:///C:/opf-work/sh-03-effects/packages/pptx/src/effects.js";
import { effectsSvg } from "file:///C:/opf-work/sh-03-effects/packages/render/src/effects.js";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const req = createRequire("C:/opf-work/sh-03-effects/packages/render/package.json");
const { Resvg } = req("@resvg/resvg-js");
const [specFile, outDir] = process.argv.slice(2);
const spec = (await import(pathToFileURL(specFile).href)).default;
mkdirSync(outDir, { recursive: true });
const colors = { accent: "#ED7D31", accent1: "#4472C4" };
const resolveHex = ref => colors[ref] ?? ref;
// PPTX spec for build-pptx.mjs
const pptxSpec = { slides: spec.slides.map(slide => ({ cells: slide.cells.map(c => ({ ...c, fx: effectsXml(c.effects, resolveHex) })) })) };
writeFileSync(`${outDir}/deck.json`, JSON.stringify(pptxSpec));
execFileSync("node", ["C:/opf-work/shapes/sh-03/work/build-pptx.mjs", `${outDir}/deck.json`, `${outDir}/deck.pptx`], { stdio: "inherit" });
// SVG per slide
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
spec.slides.forEach((slide, si) => {
  const defs = [], body = [];
  slide.cells.forEach((c, ci) => {
    const fill = c.fill && c.fill !== "none" ? c.fill : "none";
    const fo = c.fillOpacity != null ? ` fill-opacity="${c.fillOpacity}"` : "";
    const stroke = c.line ? ` stroke="${c.line}" stroke-width="${c.lineWidth ?? 2}"` : "";
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    const rot = c.rotate ? ` transform="rotate(${c.rotate} ${cx} ${cy})"` : "";
    let shape;
    if (c.geom === "ellipse") shape = `<ellipse cx="${cx}" cy="${cy}" rx="${c.w / 2}" ry="${c.h / 2}" fill="${fill}"${fo}${stroke}${rot}/>`;
    else if (c.geom === "roundRect") { const r = 0.16667 * Math.min(c.w, c.h); shape = `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="${r}" fill="${fill}"${fo}${stroke}${rot}/>`; }
    else shape = `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="${fill}"${fo}${stroke}${rot}/>`;
    const text = c.text ? `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="Arial" font-weight="bold" font-size="${(c.fontSize ?? 28) * 4 / 3}" fill="${c.textColor ?? "#FFFFFF"}"${rot}>${esc(c.text)}</text>` : "";
    const fx = effectsSvg(c.effects, { x: c.x, y: c.y, width: c.w, height: c.h, rotate: c.rotate }, resolveHex, { id: `fx-${si}-${ci}` });
    defs.push(fx.defs);
    body.push(fx.wrap(shape, text));
    if (c.label) body.push(`<text x="${c.x}" y="${c.y + c.h + (c.labelDy ?? 6) + 10}" font-family="Arial" font-size="12" fill="#666666">${esc(c.label)}</text>`);
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#FFFFFF"/><defs>${defs.join("")}</defs>${body.join("")}</svg>`;
  writeFileSync(`${outDir}/slide${si + 1}.svg`, svg);
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 2560 }, font: { loadSystemFonts: true, defaultFontFamily: "Arial" } }).render().asPng();
  writeFileSync(`${outDir}/svg-slide${si + 1}.png`, png);
});
console.log("done", outDir);
