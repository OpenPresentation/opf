import { createRequire } from 'node:module';
const sharp = createRequire('C:/opf-work/sh-02-shape-block/packages/render/package.json')('sharp');
const [file, ...regions] = process.argv.slice(2);
const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
const px = (x, y) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
const isBg = (x, y) => { const [r, g, b] = px(x, y); return Math.abs(r - 42) + Math.abs(g - 51) + Math.abs(b - 64) < 12; };
for (const region of regions) {
  const [name, x0, y0, x1, y1] = region.split(',');
  let a = 1e9, b = 1e9, c = -1, d = -1;
  for (let y = +y0; y < +y1; y++) for (let x = +x0; x < +x1; x++) if (!isBg(x, y)) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  const cx = (a + c) / 2, cy = (b + d) / 2;
  const ray = (dx, dy) => { const out = []; for (let i = 0; ; i++) { const x = Math.round(cx + dx * i), y = Math.round(cy + dy * i); if (x < a || x > c || y < b || y > d || isBg(x, y)) { out.push(`edge@${i}`); break; } out.push(px(x, y)[0]); } return out.join(','); };
  console.log(name, 'box', a, b, c, d, '\n  R', ray(1, 0), '\n  U', ray(0, -1), '\n  D', ray(0, 1), '\n  UR', ray((c - a) / 2 / 100, -(d - b) / 2 / 100));
}
