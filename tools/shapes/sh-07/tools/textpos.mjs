// node textpos.mjs <mode> [ids...]: for every text of each exported diagram, where its ink lies in the preview and in PowerPoint's drawing
// (the ink centroid inside the text's box, at 1280x720), and the difference. Prints per source the median and largest offsets in pixels.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('C:/opf-work/sh-07-native-diagrams/packages/pptx/package.json');
const sharp = require('sharp');
const { unzipSync, strFromU8 } = require('fflate');
const root = process.env.SH07_ROOT ?? 'C:/opf-work/shapes/sh-07';
const [mode = 'shapes', ...only] = process.argv.slice(2);
const ids = readdirSync(`${root}/${mode}/pptx`).map((f) => f.slice(0, -5)).filter((id) => !only.length || only.some((o) => id === o || id.startsWith(`${o}-`))).sort();
const gray = async (file) => (await sharp(file).resize(1280, 720, { fit: 'fill' }).flatten({ background: '#fff' }).removeAlpha().greyscale().raw().toBuffer());
const report = [];
for (const id of ids) {
  const png = `${root}/${process.env.IMAGE ?? mode}/ppt/${id}/1.png`;
  if (!existsSync(png)) continue;
  const parts = unzipSync(readFileSync(`${root}/${mode}/pptx/${id}.pptx`));
  const cx = Number(/<p:sldSz cx="(\d+)"/.exec(strFromU8(parts['ppt/presentation.xml']))[1]);
  const k = 1280 / cx;
  const xml = strFromU8(parts['ppt/slides/slide1.xml']);
  const group = /<p:grpSp>[\s\S]*<\/p:grpSp>/.exec(xml)?.[0] ?? '';
  const [a, b] = [await gray(`${root}/preview/${id}-1.png`), await gray(png)];
  const rows = [];
  for (const sp of group.match(/<p:sp>[\s\S]*?<\/p:sp>/g) ?? []) {
    if (!/<a:t>/.test(sp) || /<a:xfrm rot=/.test(sp)) continue;
    const [x, y, w, h] = /<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/.exec(sp).slice(1).map(Number);
    const ins = /lIns="(\d+)" tIns="(\d+)" rIns="(\d+)" bIns="(\d+)"/.exec(sp).slice(1).map(Number);
    const pitch = Number(/spcPts val="(\d+)"/.exec(sp)[1]) / 100 / 72 * 914400;
    const lines = (sp.match(/<a:p>/g) ?? []).length;
    const text = [...sp.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(' ');
    const algn = /algn="(\w+)"/.exec(sp)?.[1] ?? 'l';
    // The text block: the inset area's top, the lines' height; across, the whole inset area (the ink decides).
    const left = (x + ins[0]) * k, right = (x + w - ins[2]) * k, top = (y + ins[1]) * k, bottom = top + pitch * lines * k;
    const box = { left: Math.max(0, Math.floor(left - 4)), top: Math.max(0, Math.floor(top - 2)), right: Math.min(1279, Math.ceil(right + 4)), bottom: Math.min(719, Math.ceil(bottom + 2)) };
    const centroid = (data) => {
      const counts = new Map();
      for (let r = box.top; r <= box.bottom; r++) for (let c = box.left; c <= box.right; c++) { const v = data[r * 1280 + c]; counts.set(v, (counts.get(v) ?? 0) + 1); }
      const bg = [...counts].sort((m, n) => n[1] - m[1])[0][0];
      let sx = 0, sy = 0, t = 0;
      for (let r = box.top; r <= box.bottom; r++) for (let c = box.left; c <= box.right; c++) { const d = Math.abs(data[r * 1280 + c] - bg); if (d > 40) { sx += c * d; sy += r * d; t += d; } }
      return t ? [sx / t, sy / t, t] : undefined;
    };
    const p = centroid(a), q = centroid(b);
    if (!p || !q || p[2] < 200) continue;
    rows.push({ text: text.slice(0, 30), algn, dx: +(q[0] - p[0]).toFixed(2), dy: +(q[1] - p[1]).toFixed(2), size: +(Number(/sz="(\d+)"/.exec(sp)[1]) / 100 / 0.75 * (k * 9525)).toFixed(1) });
  }
  const med = (list) => { const s = [...list].sort((m, n) => m - n); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const dys = rows.map((r) => r.dy), dxs = rows.map((r) => r.dx);
  const summary = { id, texts: rows.length, dyMedian: med(dys), dyMax: Math.max(0, ...dys.map(Math.abs)), dxMedian: med(dxs), dxMax: Math.max(0, ...dxs.map(Math.abs)) };
  report.push({ ...summary, rows });
  console.log(id.padEnd(18), `texts ${String(rows.length).padStart(3)}  dy median ${String(summary.dyMedian).padStart(6)} max ${String(summary.dyMax).padStart(5)}  dx median ${String(summary.dxMedian).padStart(6)} max ${String(summary.dxMax).padStart(5)}`);
  if (process.env.ROWS) for (const r of rows) console.log('   ', r.algn, r.size, r.dx, r.dy, r.text);
}
writeFileSync(`${root}/${process.env.IMAGE ?? mode}/textpos.json`, JSON.stringify(report, null, 1));
