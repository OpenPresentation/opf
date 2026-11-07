// node pairs.mjs <out-dir> <pair-json>: compare preview PNGs with PowerPoint's PNGs of the same slides, as SH-07's native gate does.
// <pair-json>: [{ id, preview, powerpoint, text?: [{x,y,width,height}] (1280-px boxes holding one text each) }].
// Scores: mad = mean absolute difference per channel at 320 x 180, hot = share of 8 x 8 blocks whose mean differs by more than 24/255;
// the same at 1280 x 720 over 16 x 16 blocks; and, per text box, the offset of the ink centroid (pixels at 1280). Writes <out>/scores.json
// and one sheet per id (<out>/sheets/<id>.png): preview | PowerPoint | difference x4 (white = same).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const sharp = createRequire('C:/opf-work/sh-09-smartart-tier1/packages/pptx/package.json')('sharp');
const [outDir, pairsFile] = process.argv.slice(2);
mkdirSync(`${outDir}/sheets`, { recursive: true });
const pairs = JSON.parse(readFileSync(pairsFile, 'utf8'));
const raw = (file, W, H) => sharp(file).flatten({ background: '#ffffff' }).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer();
function score(x, y, W, H, block, limit = 24) {
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += Math.abs(x[i] - y[i]);
  let blocks = 0, hot = 0;
  for (let by = 0; by < H; by += block) for (let bx = 0; bx < W; bx += block) {
    let d = 0, c = 0;
    for (let yy = by; yy < Math.min(by + block, H); yy++) for (let xx = bx; xx < Math.min(bx + block, W); xx++) for (let ch = 0; ch < 3; ch++) { const i = (yy * W + xx) * 3 + ch; d += x[i] - y[i]; c++; }
    blocks++; if (Math.abs(d / c) > limit) hot++;
  }
  return { mad: +(sum / x.length).toFixed(2), hot: +(hot / blocks * 100).toFixed(2) };
}
// The ink of a text box: pixels far from the box's most common color (the node's fill), as a weighted centroid.
function ink(buffer, box) {
  const x0 = Math.max(0, Math.round(box.x)), y0 = Math.max(0, Math.round(box.y)), x1 = Math.min(1280, Math.round(box.x + box.width)), y1 = Math.min(720, Math.round(box.y + box.height));
  const counts = new Map();
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * 1280 + x) * 3, key = (buffer[i] >> 3) << 10 | (buffer[i + 1] >> 3) << 5 | buffer[i + 2] >> 3; counts.set(key, (counts.get(key) ?? 0) + 1); }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0, bg = [(top >> 10) << 3, ((top >> 5) & 31) << 3, (top & 31) << 3];
  let w = 0, sx = 0, sy = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * 1280 + x) * 3, d = (Math.abs(buffer[i] - bg[0]) + Math.abs(buffer[i + 1] - bg[1]) + Math.abs(buffer[i + 2] - bg[2])) / 3;
    if (d > 60) { w += d; sx += d * x; sy += d * y; }
  }
  return w ? { x: sx / w, y: sy / w, weight: w } : undefined;
}
const median = values => { const s = [...values].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0; };
const scores = [];
for (const pair of pairs) {
  const small = score(await raw(pair.preview, 320, 180), await raw(pair.powerpoint, 320, 180), 320, 180, 8);
  const [x, y] = [await raw(pair.preview, 1280, 720), await raw(pair.powerpoint, 1280, 720)];
  const full = score(x, y, 1280, 720, 16);
  const offsets = (pair.text ?? []).map(box => { const a = ink(x, box), b = ink(y, box); return a && b ? { dx: +(b.x - a.x).toFixed(2), dy: +(b.y - a.y).toFixed(2) } : undefined; }).filter(Boolean);
  const diff = Buffer.alloc(x.length);
  for (let i = 0; i < x.length; i += 3) {
    const d = Math.min(255, 4 * Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2])));
    diff[i] = 255; diff[i + 1] = 255 - d; diff[i + 2] = 255 - d;
  }
  const W = 640, H = 360, gap = 8, head = 22;
  const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${3 * W + 4 * gap}" height="${head}"><text x="8" y="16" font-family="Arial" font-size="14">${pair.id}: preview | PowerPoint | difference x4 — mad ${small.mad}, hot ${small.hot}%, mad1280 ${full.mad}, hot1280 ${full.hot}%</text></svg>`);
  await sharp({ create: { width: 3 * W + 4 * gap, height: H + head + gap, channels: 3, background: '#dddddd' } }).composite([
    { input: label, left: 0, top: 0 },
    { input: await sharp(pair.preview).resize(W, H, { fit: 'fill' }).png().toBuffer(), left: gap, top: head },
    { input: await sharp(pair.powerpoint).resize(W, H, { fit: 'fill' }).png().toBuffer(), left: 2 * gap + W, top: head },
    { input: await sharp(diff, { raw: { width: 1280, height: 720, channels: 3 } }).resize(W, H).png().toBuffer(), left: 3 * gap + 2 * W, top: head },
  ]).png().toFile(`${outDir}/sheets/${pair.id}.png`);
  scores.push({ id: pair.id, mad: small.mad, hot: small.hot, mad1280: full.mad, hot1280: full.hot, textDx: +median(offsets.map(o => Math.abs(o.dx))).toFixed(2), textDy: +median(offsets.map(o => Math.abs(o.dy))).toFixed(2), textMax: +Math.max(0, ...offsets.map(o => Math.hypot(o.dx, o.dy))).toFixed(2), texts: offsets.length });
}
writeFileSync(`${outDir}/scores.json`, JSON.stringify(scores, null, 2));
for (const s of scores) console.log(JSON.stringify(s));
