// A preview | PowerPoint | difference strip for chosen slides: node pair.mjs <runDir> <out.png> <slide> [slide...]
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const requirePptx = createRequire("C:/opf-work/sh-01-geometry/packages/pptx/package.json");
const sharp = requirePptx("sharp");
const [runDir, out, ...slides] = process.argv.slice(2);
const manifest = JSON.parse(await readFile(path.join(runDir, "manifest.json"), "utf8"));
const W = 1280 / 2, H = 720 / 2;
const composites = [];
let row = 0;
for (const slide of slides) {
  const entry = manifest.find((e) => e.slide === Number(slide));
  const mine = await sharp(path.join(runDir, "mine", entry.file)).removeAlpha().raw().toBuffer();
  const ppt = await sharp(path.join(runDir, "ppt", entry.file)).removeAlpha().raw().toBuffer();
  const diff = Buffer.alloc(mine.length);
  for (let i = 0; i < mine.length; i += 3) {
    const a = (mine[i] + mine[i + 1] + mine[i + 2]) / 3 < 215, b = (ppt[i] + ppt[i + 1] + ppt[i + 2]) / 3 < 215;
    const [r, g, bl] = a && b ? [180, 180, 180] : a ? [230, 40, 40] : b ? [30, 120, 230] : [255, 255, 255];
    diff[i] = r; diff[i + 1] = g; diff[i + 2] = bl;
  }
  const opts = { raw: { width: 1280, height: 720, channels: 3 } };
  for (const [col, buf] of [mine, ppt, diff].entries()) {
    const img = await sharp(buf, opts).resize(W, H).png().toBuffer();
    composites.push({ input: img, left: col * W, top: row * (H + 24) + 24 });
  }
  const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${3 * W}" height="24"><text x="6" y="17" font-family="Arial" font-size="15">${entry.name} (${entry.pass}) slide ${entry.slide}: preview | PowerPoint | difference (red preview only, blue PowerPoint only)</text></svg>`);
  composites.push({ input: label, left: 0, top: row * (H + 24) });
  row++;
}
await sharp({ create: { width: 3 * W, height: row * (H + 24), channels: 3, background: "#fff" } }).composite(composites).png().toFile(out);
console.log(out);
