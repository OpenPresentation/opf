// Baselines on the attempt-1 FF-46 native PNGs (1280 px, light text on the dark theme) with the probe estimator (bottom edge of the last
// row holding >= 35 % of the peak row's ink) and the mode of per-column ink bottoms, in em of the run size below the line-box top.
import sharp from 'sharp';
import {readFileSync} from 'node:fs';
const m = JSON.parse(readFileSync('manifest.json', 'utf8'));
const decks = process.argv.slice(2);
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
for (const id of decks) {
  const d = m.sets.ff46.decks[id];
  const read = JSON.parse(readFileSync(`native/attempt-1/ff46/${id}/${id}.json`, 'utf8').replace(/^﻿/, ''));
  const out = {title: [], body: []}, mode = {title: [], body: []};
  for (const ps of d.perSlide) {
    const ns = read.slides.find(s => s.index === ps.index);
    const {data, info} = await sharp(`native/attempt-1/ff46/${id}/${ns.png}`).removeAlpha().raw().toBuffer({resolveWithObject: true});
    const k = info.width / 960, ch = info.channels;
    for (const sh of ps.shapes) {
      const size = sh.runs[0]?.size; if (!size) continue;
      const b = sh.box, y0 = Math.round((b.y - 1) * k), y1 = Math.round((b.y + b.h + 4) * k), x0 = Math.round(b.x * k), x1 = Math.round((b.x + b.w) * k);
      const bg = [data[(y0 * info.width + x1 - 2) * ch], data[(y0 * info.width + x1 - 2) * ch + 1], data[(y0 * info.width + x1 - 2) * ch + 2]];
      const ink = (x, y) => { const i = (y * info.width + x) * ch; return Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 300; };
      const rows = []; for (let y = y0; y < y1; y++) { let n = 0; for (let x = x0; x < x1; x++) if (ink(x, y)) n++; rows.push([y, n]); }
      const peak = Math.max(...rows.map(r => r[1])); if (!peak) continue;
      const bl = rows.filter(r => r[1] >= peak * 0.35).at(-1)[0];
      const bottoms = new Map(); for (let x = x0; x < x1; x++) { let last = -1; for (let y = y0; y < y1; y++) if (ink(x, y)) last = y; if (last >= 0) bottoms.set(last, (bottoms.get(last) ?? 0) + 1); }
      const mo = [...bottoms.entries()].sort((a, c) => c[1] - a[1])[0][0];
      const kind = /heading/.test(sh.name) ? 'title' : 'body';
      out[kind].push(+(((bl + 1) / k - b.y) / size).toFixed(3)); mode[kind].push(+(((mo + 1) / k - b.y) / size).toFixed(3));
    }
  }
  console.log(id.padEnd(34), 'peak35 title', med(out.title), 'body', med(out.body), JSON.stringify(out.body), '| mode title', med(mode.title), 'body', med(mode.body));
}
