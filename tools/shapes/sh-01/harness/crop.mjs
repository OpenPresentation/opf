// node crop.mjs <runDir> <out.png> <slide> <cell> [zoom]
import path from "node:path"; import { createRequire } from "node:module";
const sharp = createRequire("C:/opf-work/sh-01-geometry/packages/pptx/package.json")("sharp");
const [runDir, out, slide, cell, zoom = "2", rx, ry, rw, rh] = process.argv.slice(2);
const file = `${String(slide).padStart(3, "0")}.png`;
const [x0, y0] = [[0,0],[640,0],[0,360],[640,360]][Number(cell)];
const region = rx ? { left: x0 + Number(rx), top: y0 + Number(ry), width: Number(rw), height: Number(rh) } : { left: x0, top: y0, width: 640, height: 360 };
const z = Number(zoom);
const imgs = [];
for (const dir of ["mine", "ppt"]) imgs.push(await sharp(path.join(runDir, dir, file)).extract(region).resize(region.width * z, region.height * z, { kernel: "nearest" }).png().toBuffer());
await sharp({ create: { width: region.width * z * 2 + 10, height: region.height * z, channels: 3, background: "#f00" } }).composite([{ input: imgs[0], left: 0, top: 0 }, { input: imgs[1], left: region.width * z + 10, top: 0 }]).png().toFile(out);
