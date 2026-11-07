// node pairs.mjs <exportDir> <pptDir> <sheetDir> [ids...]
// Per deck: preview (<exportDir>/preview/<id>/s-<n>.png) beside PowerPoint (<pptDir>/<id>/<n>.png). Scores every slide (mean absolute
// difference per channel at 320x180, and the share of 8x8 blocks whose mean differs by more than 24/255: a visible local difference),
// writes <sheetDir>/scores.json and one sheet per deck (<sheetDir>/<id>-<k>.png, 8 pairs a sheet, preview left | PowerPoint right).
import { readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const sharp = createRequire('C:/opf-work/sh-phase-2/packages/pptx/package.json')('sharp');
const [exportDir, pptDir, sheetDir, ...only] = process.argv.slice(2);
mkdirSync(sheetDir, { recursive: true });
const ids = only.length ? only : readdirSync(path.join(exportDir, 'preview'));
const W = 320, H = 180;
const raw = (file) => sharp(file).flatten({ background: '#ffffff' }).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer();
const scores = [];
for (const id of ids) {
  const pdir = path.join(exportDir, 'preview', id), qdir = path.join(pptDir, id);
  if (!existsSync(qdir)) { scores.push({ id, missing: 'no PowerPoint export' }); continue; }
  const previews = readdirSync(pdir).filter((f) => f.endsWith('.png')).map((f) => ({ f, n: Number(f.match(/(\d+)\.png$/)[1]) })).sort((a, b) => a.n - b.n);
  const tiles = [];
  for (const { f, n } of previews) {
    const a = path.join(pdir, f), b = path.join(qdir, `${n}.png`);
    if (!existsSync(b)) { scores.push({ id, slide: n, missing: 'no PowerPoint slide' }); continue; }
    const [x, y] = await Promise.all([raw(a), raw(b)]);
    let sum = 0; for (let i = 0; i < x.length; i++) sum += Math.abs(x[i] - y[i]);
    let blocks = 0, hot = 0;
    for (let by = 0; by < H; by += 8) for (let bx = 0; bx < W; bx += 8) {
      let d = 0, c = 0;
      for (let yy = by; yy < Math.min(by + 8, H); yy++) for (let xx = bx; xx < Math.min(bx + 8, W); xx++) for (let ch = 0; ch < 3; ch++) { const i = (yy * W + xx) * 3 + ch; d += x[i] - y[i]; c++; }
      blocks++; if (Math.abs(d / c) > 24) hot++;
    }
    const row = { id, slide: n, mad: +(sum / x.length).toFixed(2), hot: +(hot / blocks * 100).toFixed(1) };
    scores.push(row);
    tiles.push({ ...row, a, b });
  }
  const per = 8, tw = 640, th = 360, head = 26, gap = 10;
  for (let k = 0; k * per < tiles.length; k++) {
    const group = tiles.slice(k * per, (k + 1) * per);
    const SW = gap + 2 * (tw + gap) , SH = 34 + group.length * (th + head + gap);
    const comps = [{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="34"><text x="${gap}" y="24" font-family="Arial" font-size="18" font-weight="bold">${id}: preview (left) | PowerPoint (right)</text></svg>`), left: 0, top: 0 }];
    for (const [i, t] of group.entries()) {
      const top = 34 + i * (th + head + gap);
      comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${head}"><text x="${gap}" y="18" font-family="Arial" font-size="14">slide ${t.slide}   mad ${t.mad}   hot ${t.hot}%</text></svg>`), left: 0, top });
      comps.push({ input: await sharp(t.a).resize(tw, th, { fit: 'fill' }).png().toBuffer(), left: gap, top: top + head });
      comps.push({ input: await sharp(t.b).resize(tw, th, { fit: 'fill' }).png().toBuffer(), left: gap * 2 + tw, top: top + head });
    }
    await sharp({ create: { width: SW, height: SH, channels: 3, background: '#e6e6e6' } }).composite(comps).png().toFile(path.join(sheetDir, `${id}-${k + 1}.png`));
  }
  process.stdout.write(`${id} ${tiles.length}\n`);
}
writeFileSync(path.join(sheetDir, 'scores.json'), JSON.stringify(scores, null, 1));
