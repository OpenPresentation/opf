// Estimator C: the mode of per-column ink bottoms among columns whose ink reaches more than 0.15 em below the peak row (so columns holding only a
// headline or top marks are ignored); the baseline is that row's bottom edge. Run on the attempt-2 probe PNGs (or any native dir).
import sharp from 'sharp';
import {readFileSync} from 'node:fs';
const nativeDir = process.argv[2] ?? 'native/attempt-2';
const m = JSON.parse(readFileSync('manifest.json', 'utf8'));
const res = {};
for (const [id, d] of Object.entries(m.sets.probe38.decks)) for (const slide of d.layout) {
  const {data, info} = await sharp(`${nativeDir}/probe38/${id}/${id}-slide-${slide.slide}.native.png`).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const k = info.width / 960;
  const dark = (x, y) => { const i = (y * info.width + x) * 3; return data[i] + data[i + 1] + data[i + 2] < 384; };
  for (const r of slide.rows) {
    const b = r.box, y0 = Math.max(0, Math.round((b.y - 6) * k)), y1 = Math.round((b.y + b.h + 6) * k), x0 = Math.round(b.x * k), x1 = Math.round((b.x + b.w) * k);
    const counts = []; for (let y = y0; y <= y1; y++) { let n = 0; for (let x = x0; x <= x1; x++) if (dark(x, y)) n++; counts.push(n); }
    const peakY = y0 + counts.indexOf(Math.max(...counts));
    const bottoms = new Map();
    for (let x = x0; x <= x1; x++) { let last = -1; for (let y = y0; y <= y1; y++) if (dark(x, y)) last = y; if (last > peakY + 0.15 * slide.size * k) bottoms.set(last, (bottoms.get(last) ?? 0) + 1); }
    const mode = [...bottoms.entries()].sort((a, c) => c[1] - a[1])[0]?.[0];
    const em = +(((mode + 1) / k - b.y) / slide.size).toFixed(3);
    const key = `${r.family}|${r.weight}|${r.kind}`;
    (res[key] ??= []).push(em);
  }
}
const med = a => [...a].sort((x, y) => x - y)[a.length >> 1];
for (const [key, v] of Object.entries(res)) console.log(key.padEnd(36), v.join(' / '), ' median', med(v));
