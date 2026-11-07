// node geom.mjs <mode> [ids...]: the difference outside the text: mean absolute difference per channel at 1280x720 over the pixels that are
// not inside any text body of the exported diagram (each text body's lines, grown by 4 px), and the hot share (16x16 blocks whose mean
// differs by more than 24/255) over the same pixels. Separates the geometry (shapes, lines, fills) from the font the preview stands in with.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('C:/opf-work/sh-07-native-diagrams/packages/pptx/package.json');
const sharp = require('sharp');
const { unzipSync, strFromU8 } = require('fflate');
const root = process.env.SH07_ROOT ?? 'C:/opf-work/shapes/sh-07';
const [mode = 'shapes', ...only] = process.argv.slice(2);
const ids = readdirSync(`${root}/${mode}/pptx`).map((f) => f.slice(0, -5)).filter((id) => !only.length || only.some((o) => id === o || id.startsWith(`${o}-`))).sort();
const rgb = async (file) => sharp(file).resize(1280, 720, { fit: 'fill' }).flatten({ background: '#fff' }).removeAlpha().raw().toBuffer();
const out = [];
for (const id of ids) {
  const png = `${root}/${mode}/ppt/${id}/1.png`;
  if (!existsSync(png)) continue;
  const parts = unzipSync(readFileSync(`${root}/${mode}/pptx/${id}.pptx`));
  const k = 1280 / Number(/<p:sldSz cx="(\d+)"/.exec(strFromU8(parts['ppt/presentation.xml']))[1]);
  const xml = strFromU8(parts['ppt/slides/slide1.xml']);
  const mask = new Uint8Array(1280 * 720);
  for (const sp of xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g) ?? []) {
    if (!/<a:t>/.test(sp)) continue;
    const [x, y, w, h] = /<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/.exec(sp).slice(1).map(Number);
    const rot = Number(/<a:xfrm rot="(\d+)"/.exec(sp)?.[1] ?? 0);
    const ins = /lIns="(\d+)" tIns="(\d+)" rIns="(\d+)" bIns="(\d+)"/.exec(sp)?.slice(1).map(Number) ?? [0, 0, 0, 0];
    // A rotated text body (a quarter turn) covers its frame turned about the center; other bodies their inset frame.
    let [l, t, r, b] = [(x + ins[0]) * k, (y + ins[1]) * k, (x + w - ins[2]) * k, (y + h - ins[3]) * k];
    if (/<a:xfrm rot=/.test(sp) && rot) { const cx = (x + w / 2) * k, cy = (y + h / 2) * k, hw = Math.max(w, h) * k / 2; [l, t, r, b] = [cx - hw, cy - hw, cx + hw, cy + hw]; }
    // The text may overflow its inset area across (no wrap): take the whole frame's width.
    l = Math.min(l, x * k); r = Math.max(r, (x + w) * k);
    for (let row = Math.max(0, Math.floor(t - 4)); row < Math.min(720, Math.ceil(b + 4)); row++) for (let col = Math.max(0, Math.floor(l - 4)); col < Math.min(1280, Math.ceil(r + 4)); col++) mask[row * 1280 + col] = 1;
  }
  const [a, c] = [await rgb(`${root}/preview/${id}-1.png`), await rgb(png)];
  let sum = 0, n = 0, blocks = 0, hot = 0;
  for (let i = 0; i < mask.length; i++) if (!mask[i]) { for (let ch = 0; ch < 3; ch++) sum += Math.abs(a[i * 3 + ch] - c[i * 3 + ch]); n++; }
  for (let by = 0; by < 720; by += 16) for (let bx = 0; bx < 1280; bx += 16) {
    let d = 0, cnt = 0;
    for (let yy = by; yy < by + 16; yy++) for (let xx = bx; xx < bx + 16; xx++) { const i = yy * 1280 + xx; if (mask[i]) continue; for (let ch = 0; ch < 3; ch++) { d += a[i * 3 + ch] - c[i * 3 + ch]; cnt++; } }
    if (cnt < 3 * 64) continue;
    blocks++; if (Math.abs(d / cnt) > 24) hot++;
  }
  const row = { id, geometryMad: +(sum / (3 * n)).toFixed(2), geometryHot: +(hot / blocks * 100).toFixed(2), textShare: +(100 - n / mask.length * 100).toFixed(1) };
  out.push(row);
  console.log(id.padEnd(18), 'geometry mad', String(row.geometryMad).padStart(5), ' hot', String(row.geometryHot).padStart(5), '%   text area', row.textShare, '%');
}
writeFileSync(`${root}/${mode}/geometry.json`, JSON.stringify(out, null, 1));
