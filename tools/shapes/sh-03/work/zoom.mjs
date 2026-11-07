import { createRequire } from "node:module";
const sharp = createRequire("C:/opf-work/sh-03-effects/packages/pptx/package.json")("sharp");
const [out, ...items] = process.argv.slice(2); // items: file:left,top,w,h
const tiles = [];
for (const it of items) { const [file, r] = it.split("@"); const [left, top, width, height] = r.split(",").map(Number);
  tiles.push(await sharp(file).flatten({ background: "#fff" }).extract({ left, top, width, height }).resize(width * 2, height * 2, { kernel: "nearest" }).png().toBuffer()); }
const meta = await Promise.all(tiles.map(t => sharp(t).metadata()));
const W = meta.reduce((s, m) => s + m.width + 10, 0), H = Math.max(...meta.map(m => m.height));
let x = 0; const comps = tiles.map((t, i) => { const c = { input: t, left: x, top: 0 }; x += meta[i].width + 10; return c; });
await sharp({ create: { width: W, height: H, channels: 3, background: "#888" } }).composite(comps).png().toFile(out);
