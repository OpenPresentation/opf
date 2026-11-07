// SH-01 PowerPoint comparison, step 1: a PPTX with every preset written as native a:prstGeom (2 sizes x 2 adjust
// values, a fill slide and a stroke slide per preset), and the engine's SVG of the same slides rendered with resvg.
//   node build.mjs <worktree> <outDir> [fillRule]      env: ONLY=name,name  SKIP_RENDER=1
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const [worktree = "C:/opf-work/sh-01-geometry", outDir = "C:/opf-work/shapes/sh-01/run", fillRule = "nonzero"] = process.argv.slice(2);
const geometry = await import(pathToFileURL(path.join(worktree, "packages/javascript/dist/shape-geometry.js")).href);
const { default: PptxGenJS } = await import(pathToFileURL(path.join(worktree, "packages/pptx/vendor/pptxgenjs/pptxgen.es.js")).href);
const requirePptx = createRequire(path.join(worktree, "packages/pptx/package.json"));
const requireCore = createRequire(path.join(worktree, "packages/javascript/package.json"));
const { unzipSync, zipSync, strFromU8, strToU8 } = requirePptx("fflate");
const { Resvg } = requireCore("@resvg/resvg-js");

const EMU = 9525;
const SIZES = [
  [360, 200],
  [150, 260],
];
const CELLS = [
  [0, 0],
  [640, 0],
  [0, 360],
  [640, 360],
];
const FILL = "4472C4";
const STROKE_WIDTH = Number(process.env.STROKE ?? 1);

const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const presets = geometry.PRESET_SHAPES.filter((name) => !only || only.includes(name));

function alternateAdjust(name, width, height) {
  const adjustments = geometry.presetAdjustments(name, width, height);
  const out = {};
  for (const [guide, info] of Object.entries(adjustments)) {
    if (info.min === null && info.max === null) continue;
    const d = info.default;
    let value;
    if (info.max !== null && info.max > d) value = d + (info.max - d) * 0.5;
    else if (info.min !== null && info.min < d) value = d + (info.min - d) * 0.5;
    else value = info.unit === "degrees" ? d + 45 : d * 0.6;
    if (info.unit === "degrees" && info.max !== null && info.min !== null && info.max - info.min > 300) value = d + 40;
    out[guide] = Math.round(value * (info.unit === "degrees" ? 60000 : 100000)) / (info.unit === "degrees" ? 60000 : 100000);
  }
  return out;
}

const variants = [];
for (const name of presets) {
  const cells = [];
  SIZES.forEach(([w, h], sizeIndex) => {
    for (const alt of [false, true]) {
      const [cx, cy] = CELLS[sizeIndex * 2 + (alt ? 1 : 0)];
      const adjust = alt ? alternateAdjust(name, w, h) : {};
      cells.push({ x: cx + (640 - w) / 2, y: cy + (360 - h) / 2, w, h, adjust });
    }
  });
  variants.push({ name, cells });
}

// --- PPTX ---------------------------------------------------------------------------------------------------------
const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
for (let index = 0; index < variants.length * 2; index++) pptx.addSlide();
const base = await pptx.write({ outputType: "uint8array" });
const files = unzipSync(base);

function spXml(id, name, cell, pass) {
  const avLst = geometry.adjustToDrawingML(name, cell.adjust);
  const gd = Object.entries(avLst)
    .map(([guide, value]) => `<a:gd name="${guide}" fmla="val ${value}"/>`)
    .join("");
  const fill =
    pass === "fill"
      ? `<a:solidFill><a:srgbClr val="${FILL}"/></a:solidFill><a:ln><a:noFill/></a:ln>`
      : `<a:noFill/><a:ln w="${STROKE_WIDTH * EMU}" cap="flat"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>`;
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name} ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${Math.round(cell.x * EMU)}" y="${Math.round(cell.y * EMU)}"/><a:ext cx="${Math.round(cell.w * EMU)}" cy="${Math.round(cell.h * EMU)}"/></a:xfrm><a:prstGeom prst="${name}"><a:avLst>${gd}</a:avLst></a:prstGeom>${fill}</p:spPr></p:sp>`;
}

variants.forEach((variant, index) => {
  for (const [offset, pass] of [
    [0, "fill"],
    [1, "stroke"],
  ]) {
    const slide = `ppt/slides/slide${index * 2 + offset + 1}.xml`;
    let xml = strFromU8(files[slide]);
    const shapes = variant.cells.map((cell, cellIndex) => spXml(10 + cellIndex, variant.name, cell, pass)).join("");
    xml = xml.replace(/<\/p:grpSpPr>/, `</p:grpSpPr>${shapes}`);
    files[slide] = strToU8(xml);
  }
});
await mkdir(path.join(outDir, "mine"), { recursive: true });
await mkdir(path.join(outDir, "ppt"), { recursive: true });
await writeFile(path.join(outDir, "shapes.pptx"), zipSync(files));

// --- SVG ----------------------------------------------------------------------------------------------------------
function svgOf(variant, pass) {
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#fff"/>`];
  for (const cell of variant.cells) {
    const g = geometry.presetGeometry(variant.name, cell.w, cell.h, cell.adjust);
    parts.push(`<g transform="translate(${cell.x} ${cell.y})">`);
    for (const p of g.paths) {
      if (pass === "fill") {
        if (p.fill === "none") continue;
        parts.push(`<path d="${p.d}" fill="#${FILL}" fill-rule="${fillRule}" stroke="none"/>`);
      } else {
        if (!p.stroke) continue;
        parts.push(`<path d="${p.d}" fill="none" stroke="#000" stroke-width="${STROKE_WIDTH}" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="8"/>`);
      }
    }
    parts.push("</g>");
  }
  parts.push("</svg>");
  return parts.join("");
}

const manifest = [];
for (const [index, variant] of variants.entries()) {
  for (const [offset, pass] of [
    [0, "fill"],
    [1, "stroke"],
  ]) {
    const slideNumber = index * 2 + offset + 1;
    const file = `${String(slideNumber).padStart(3, "0")}.png`;
    if (!process.env.SKIP_RENDER) {
      const png = new Resvg(svgOf(variant, pass), { fitTo: { mode: "width", value: 1280 } }).render().asPng();
      await writeFile(path.join(outDir, "mine", file), png);
    }
    manifest.push({ slide: slideNumber, name: variant.name, pass, file, cells: variant.cells });
  }
}
await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 1));
console.log(`wrote ${variants.length} presets, ${manifest.length} slides to ${outDir}`);
