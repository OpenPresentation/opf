// Reproduce RR-38's own probe numbers from its native PNGs (old scratch) with RR-38 baseline.mjs, then with the attempt-2 variants.
import sharp from 'sharp';
import {readFileSync} from 'node:fs';
const D = process.env.RR38_DIR ?? '<rr-38 scratch folder>/';
const m = JSON.parse(readFileSync(D + 'probe-arabic.manifest.json', 'utf8'));
const probe = JSON.parse(readFileSync(D + 'native/probe.json', 'utf8').replace(/^﻿/, ''));
for (const [si, slide] of m.slides.entries()) {
  const {data, info} = await sharp(D + `native/probe-slide-${si + 1}.png`).raw().toBuffer({resolveWithObject: true});
  const k = info.width / 960, ch = info.channels, bg = [data[0], data[1], data[2]];
  for (const r0 of slide.rows) {
    const nat = probe.slides[si].rows.find(x => x.name === `${r0.id} ${slide.size}pt`);
    if (!nat) { console.log('no native row', r0.id); continue; }
    const r = {...r0, boxPt: {top: nat.top, height: r0.boxPt.height}};
    const y0 = Math.round((r.boxPt.top - 2) * k), y1 = Math.round((r.boxPt.top + r.boxPt.height + 6) * k), x0 = Math.round(60 * k), x1 = Math.round(900 * k);
    const ink = (x, y) => { const i = (y * info.width + x) * ch; const d = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]); return d > 300 && !(data[i] > 200 && data[i + 1] < 150) && !(data[i + 1] > 200 && data[i] < 150); };
    const rows = []; for (let y = y0; y < y1; y++) { let n = 0; for (let x = x0; x < x1; x++) if (ink(x, y)) n++; if (n < 0.5 * (x1 - x0)) rows.push([y, n]); }   // drop box outlines and guide lines (rows inked over half the width)
    const peak = Math.max(...rows.map(x => x[1])); const bl = rows.filter(x => x[1] >= peak * 0.35).at(-1)[0];
    const bottoms = new Map(); for (let x = x0; x < x1; x++) { let last = -1; for (let y = y0; y < y1; y++) if (ink(x, y) && rows.some(r => r[0] === y)) last = y; if (last >= 0) bottoms.set(last, (bottoms.get(last) ?? 0) + 1); }
    const mode = [...bottoms.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const em = (y, edge) => +(((y + edge) / k - r.boxPt.top) / slide.size).toFixed(3);
    console.log(slide.size, r.id.padEnd(9), 'RR-38 (top edge, 35%)', em(bl, 0), '| bottom edge 35%', em(bl, 1), '| mode bottom edge', em(mode, 1), '| boxH', r.boxPt.height);
  }
}
