// Contact sheets: per preset, preview | PowerPoint for the fill slide (top) and the stroke slide (bottom).
//   node sheet.mjs <runDir> <outPrefix> [perSheet]
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const sharp = createRequire("C:/opf-work/sh-01-geometry/packages/pptx/package.json")("sharp");
const [runDir, outPrefix, perSheet = "48"] = process.argv.slice(2);
const manifest = JSON.parse(await readFile(path.join(runDir, "manifest.json"), "utf8"));
const byShape = JSON.parse(await readFile(path.join(runDir, "by-shape.json"), "utf8"));
const far = new Map(byShape.map((s) => [s.name, s.maxFar]));
const names = [...new Set(manifest.map((e) => e.name))];
const TW = 256, TH = 144, LABEL = 20, COLS = 4, GAP = 8;
const tileW = TW * 2 + GAP, tileH = TH * 2 + LABEL;
const per = Number(perSheet);
for (let sheet = 0; sheet * per < names.length; sheet++) {
  const group = names.slice(sheet * per, (sheet + 1) * per);
  const rows = Math.ceil(group.length / COLS);
  const composites = [];
  for (const [index, name] of group.entries()) {
    const left = (index % COLS) * (tileW + GAP * 2);
    const top = Math.floor(index / COLS) * (tileH + GAP);
    composites.push({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tileW}" height="${LABEL}"><text x="2" y="15" font-family="Arial" font-size="14">${name}  (preview | PowerPoint; pixels off by more than 1px: ${far.get(name) ?? 0})</text></svg>`),
      left,
      top,
    });
    for (const [row, pass] of ["fill", "stroke"].entries()) {
      const entry = manifest.find((e) => e.name === name && e.pass === pass);
      for (const [col, dir] of ["mine", "ppt"].entries()) {
        const img = await sharp(path.join(runDir, dir, entry.file)).resize(TW, TH).png().toBuffer();
        composites.push({ input: img, left: left + col * (TW + GAP), top: top + LABEL + row * TH });
      }
    }
  }
  const out = `${outPrefix}-${sheet + 1}.png`;
  await sharp({ create: { width: COLS * (tileW + GAP * 2), height: rows * (tileH + GAP), channels: 3, background: "#fff" } }).composite(composites).png().toFile(out);
  console.log(out);
}
