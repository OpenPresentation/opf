// node compare.mjs <mode> [ids...]: preview (../preview/<id>-1.png) against PowerPoint (../<mode>/ppt/<id>/1.png).
// Scores each source as the earlier verification tools do (harvest/wave8/verify/w8/tools/pairs.mjs): the mean absolute difference per
// channel at 320x180 (mad), and the share of 8x8 blocks whose mean differs by more than 24/255 (hot, a visible local difference).
// Also the same two at full 1280x720 (mad1280, hot1280 over 16x16 blocks). Writes ../<mode>/scores.json and one sheet per family
// (../<mode>/sheets/<family>.png): for each source, preview | PowerPoint | difference (amplified, white = same).
import { readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const sharp = createRequire('C:/opf-work/sh-07-native-diagrams/packages/pptx/package.json')('sharp');
const root = process.env.SH07_ROOT ?? 'C:/opf-work/shapes/sh-07';
const [mode = 'shapes', ...only] = process.argv.slice(2);
const out = `${root}/${mode}/sheets`;
mkdirSync(out, { recursive: true });
const ids = readdirSync(`${root}/preview`).filter((f) => f.endsWith('-1.png')).map((f) => f.slice(0, -6))
  .filter((id) => !only.length || only.some((o) => id === o || id.startsWith(`${o}-`))).sort();
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
const scores = [];
const byFamily = new Map();
for (const id of ids) {
  const a = `${root}/preview/${id}-1.png`, b = `${root}/${mode}/ppt/${id}/1.png`;
  if (!existsSync(b)) { scores.push({ id, missing: true }); continue; }
  const small = score(await raw(a, 320, 180), await raw(b, 320, 180), 320, 180, 8);
  const [x, y] = [await raw(a, 1280, 720), await raw(b, 1280, 720)];
  const full = score(x, y, 1280, 720, 16);
  // The difference image: white where equal, darker with the per-pixel difference (x4).
  const diff = Buffer.alloc(x.length);
  for (let i = 0; i < x.length; i += 3) {
    const d = Math.min(255, 4 * Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2])));
    diff[i] = 255; diff[i + 1] = 255 - d; diff[i + 2] = 255 - d;
  }
  const row = { id, family: id.replace(/-[a-z]$/, ''), ...small, mad1280: full.mad, hot1280: full.hot };
  scores.push(row);
  if (!byFamily.has(row.family)) byFamily.set(row.family, []);
  byFamily.get(row.family).push({ ...row, a, b, diff: await sharp(diff, { raw: { width: 1280, height: 720, channels: 3 } }).png().toBuffer() });
}
const tw = 640, th = 360, head = 26, gap = 10;
for (const [family, rows] of byFamily) {
  const SW = gap + 3 * (tw + gap), SH = 34 + rows.length * (th + head + gap);
  const comps = [{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="34"><text x="${gap}" y="24" font-family="Arial" font-size="18" font-weight="bold">${family} (diagrams: ${mode}): preview | PowerPoint | difference</text></svg>`), left: 0, top: 0 }];
  for (const [i, t] of rows.entries()) {
    const top = 34 + i * (th + head + gap);
    comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${head}"><text x="${gap}" y="18" font-family="Arial" font-size="14">${t.id}   mad ${t.mad}   hot ${t.hot}%   (1280: mad ${t.mad1280}, hot ${t.hot1280}%)</text></svg>`), left: 0, top });
    comps.push({ input: await sharp(t.a).resize(tw, th, { fit: 'fill' }).png().toBuffer(), left: gap, top: top + head });
    comps.push({ input: await sharp(t.b).resize(tw, th, { fit: 'fill' }).png().toBuffer(), left: gap * 2 + tw, top: top + head });
    comps.push({ input: await sharp(t.diff).resize(tw, th, { fit: 'fill' }).png().toBuffer(), left: gap * 3 + tw * 2, top: top + head });
  }
  await sharp({ create: { width: SW, height: SH, channels: 3, background: '#e6e6e6' } }).composite(comps).png().toFile(`${out}/${family}.png`);
}
writeFileSync(`${root}/${mode}/scores.json`, JSON.stringify(scores, null, 1));
for (const s of scores) console.log(s.id.padEnd(18), s.missing ? 'missing' : `mad ${String(s.mad).padStart(5)} hot ${String(s.hot).padStart(5)}%  | 1280 mad ${String(s.mad1280).padStart(5)} hot ${String(s.hot1280).padStart(5)}%`);
