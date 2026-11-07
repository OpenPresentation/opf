// For each cell: crop the SVG render and the PowerPoint render, report the mean absolute difference, and compose a pair grid.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const sharp = createRequire("C:/opf-work/sh-03-effects/packages/pptx/package.json")("sharp");
const [specFile, dir, out, crop = "300x230"] = process.argv.slice(2);
const spec = (await import(pathToFileURL(specFile).href)).default;
const [cw, ch] = crop.split("x").map(Number);
const K = 2, tiles = [], report = [];
for (const [si, slide] of spec.slides.entries()) {
  for (const c of slide.cells) {
    const box = { left: Math.max(0, (c.x - 40) * K), top: Math.max(0, (c.y - 30) * K), width: cw * K, height: ch * K };
    box.width = Math.min(box.width, 2560 - box.left); box.height = Math.min(box.height, 1440 - box.top);
    const a = await sharp(`${dir}/svg-slide${si + 1}.png`).flatten({ background: "#ffffff" }).extract(box).removeAlpha().raw().toBuffer();
    const b = await sharp(`${dir}/ppt/slide${si + 1}.png`).flatten({ background: "#ffffff" }).extract(box).removeAlpha().raw().toBuffer();
    let sum = 0, max = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); sum += d; if (d > max) max = d; }
    report.push(`${(c.label ?? "").padEnd(22)} mad ${(sum / a.length).toFixed(2)}`);
    const pa = await sharp(a, { raw: { width: box.width, height: box.height, channels: 3 } }).png().toBuffer();
    const pb = await sharp(b, { raw: { width: box.width, height: box.height, channels: 3 } }).png().toBuffer();
    tiles.push({ label: c.label, pa, pb, w: box.width, h: box.height });
  }
}
console.log(report.join("\n"));
if (out) {
  const scale = 0.5, tw = Math.round(cw * K * scale), th = Math.round(ch * K * scale), cols = 3, head = 28, gap = 12;
  const pairW = tw * 2 + 8, rows = Math.ceil(tiles.length / cols);
  const W = cols * (pairW + gap) + gap, H = rows * (th + head + gap) + gap + 40;
  const comps = [];
  comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="40"><text x="${gap}" y="26" font-family="Arial" font-size="20" font-weight="bold">${process.env.TITLE ?? "SH-03 shape effects"}: preview (left) | PowerPoint (right)</text></svg>`), left: 0, top: 0 });
  for (const [i, t] of tiles.entries()) {
    const col = i % cols, row = Math.floor(i / cols), x = gap + col * (pairW + gap), y = 40 + gap + row * (th + head + gap);
    comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${pairW}" height="${head}"><text x="0" y="19" font-family="Arial" font-size="15">${t.label}</text></svg>`), left: x, top: y });
    comps.push({ input: await sharp(t.pa).resize(tw, th).png().toBuffer(), left: x, top: y + head });
    comps.push({ input: await sharp(t.pb).resize(tw, th).png().toBuffer(), left: x + tw + 8, top: y + head });
  }
  await sharp({ create: { width: W, height: H, channels: 3, background: "#e8e8e8" } }).composite(comps).png().toFile(out);
  console.log("wrote", out);
}
