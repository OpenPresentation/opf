// customGeometry check: custom outlines written as native a:custGeom from `commands` (as a PPTX writer would) vs the
// engine's SVG. node custom.mjs <outDir>
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const wt = "C:/opf-work/sh-01-geometry";
const [outDir = "C:/opf-work/shapes/sh-01/custom"] = process.argv.slice(2);
const g = await import(pathToFileURL(`${wt}/packages/javascript/dist/shape-geometry.js`).href);
const { default: PptxGenJS } = await import(pathToFileURL(`${wt}/packages/pptx/vendor/pptxgenjs/pptxgen.es.js`).href);
const { unzipSync, zipSync, strFromU8, strToU8 } = createRequire(`${wt}/packages/pptx/package.json`)("fflate");
const { Resvg } = createRequire(`${wt}/packages/javascript/package.json`)("@resvg/resvg-js");
const EMU = 9525;
const PATHS = [
  { d: "M0 5a5 5 0 1010 0a5 5 0 10-10 0z", viewBox: "0 0 10 10" },
  { d: "M50 0 L61 35 L98 35 L68 57 L79 91 L50 70 L21 91 L32 57 L2 35 L39 35 Z", viewBox: "0 0 100 100" },
  "M0.5 0.25 C0.5 0.1 0.3 0 0.2 0 C0.05 0 0 0.15 0 0.3 C0 0.6 0.5 0.8 0.5 1 C0.5 0.8 1 0.6 1 0.3 C1 0.15 0.95 0 0.8 0 C0.7 0 0.5 0.1 0.5 0.25 Z",
  { d: "M0 0 H80 A20 20 0 0 1 100 20 V60 Q100 80 80 80 H40 L20 100 V80 H0 Z", viewBox: "0 0 100 100" },
];
const cells = [];
PATHS.forEach((p, i) => {
  for (const [j, [w, h]] of [[300, 160], [130, 220]].entries()) cells.push({ p, x: (i % 4) * 320 + (320 - w) / 2, y: j * 360 + (360 - h) / 2, w, h });
});
const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.addSlide();
const files = unzipSync(await pptx.write({ outputType: "uint8array" }));
const e = (v) => Math.round(v * EMU);
const sps = cells.map((c, i) => {
  const geo = g.customGeometry(c.p, c.w, c.h);
  const cmds = geo.paths[0].commands.map((k) => {
    const pt = (x, y) => `<a:pt x="${e(x)}" y="${e(y)}"/>`;
    if (k[0] === "M") return `<a:moveTo>${pt(k[1], k[2])}</a:moveTo>`;
    if (k[0] === "L") return `<a:lnTo>${pt(k[1], k[2])}</a:lnTo>`;
    if (k[0] === "C") return `<a:cubicBezTo>${pt(k[1], k[2])}${pt(k[3], k[4])}${pt(k[5], k[6])}</a:cubicBezTo>`;
    if (k[0] === "Q") return `<a:quadBezTo>${pt(k[1], k[2])}${pt(k[3], k[4])}</a:quadBezTo>`;
    return "<a:close/>";
  }).join("");
  return `<p:sp><p:nvSpPr><p:cNvPr id="${10 + i}" name="c${i}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${e(c.x)}" y="${e(c.y)}"/><a:ext cx="${e(c.w)}" cy="${e(c.h)}"/></a:xfrm><a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="${e(c.w)}" h="${e(c.h)}">${cmds}</a:path></a:pathLst></a:custGeom><a:solidFill><a:srgbClr val="4472C4"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;
});
let xml = strFromU8(files["ppt/slides/slide1.xml"]);
xml = xml.replace("</p:grpSpPr>", `</p:grpSpPr>${sps.join("")}`);
files["ppt/slides/slide1.xml"] = strToU8(xml);
await mkdir(path.join(outDir, "mine"), { recursive: true });
await writeFile(path.join(outDir, "custom.pptx"), zipSync(files));
const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#fff"/>`];
for (const c of cells) svg.push(`<path transform="translate(${c.x} ${c.y})" d="${g.customGeometry(c.p, c.w, c.h).paths[0].d}" fill="#4472C4"/>`);
svg.push("</svg>");
await writeFile(path.join(outDir, "mine", "001.png"), new Resvg(svg.join("")).render().asPng());
await writeFile(path.join(outDir, "manifest.json"), JSON.stringify([{ slide: 1, name: "custom", pass: "fill", file: "001.png", cells: [] }]));
