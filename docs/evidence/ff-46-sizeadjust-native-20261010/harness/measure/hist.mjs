import sharp from 'sharp';
import {readFileSync} from 'node:fs';
const m = JSON.parse(readFileSync('manifest.json', 'utf8'));
const [id, slideNo, nameRe] = process.argv.slice(2);
const d = m.sets.probe38.decks[id], slide = d.layout.find(s => s.slide === +slideNo);
const {data, info} = await sharp(`native/attempt-2/probe38/${id}/${id}-slide-${slideNo}.native.png`).removeAlpha().raw().toBuffer({resolveWithObject: true});
const k = info.width / 960;
for (const r of slide.rows.filter(r => new RegExp(nameRe).test(r.name))) {
  const b = r.box, y0 = Math.round((b.y - 2) * k), y1 = Math.round((b.y + b.h + 6) * k), x0 = Math.round(b.x * k), x1 = Math.round((b.x + b.w) * k);
  const line = [];
  for (let y = y0; y <= y1; y++) { let n = 0; for (let x = x0; x <= x1; x++) { const i = (y * info.width + x) * 3; if (data[i] + data[i + 1] + data[i + 2] < 384) n++; } line.push(`${(((y + 1) / k - b.y) / slide.size).toFixed(3)}:${n}`); }
  console.log(r.name, '\n', line.filter(s => !s.endsWith(':0')).join(' '));
}
