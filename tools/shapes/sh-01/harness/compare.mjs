// SH-01 PowerPoint comparison, step 3: per slide and cell, the ink masks of the engine's rendering and PowerPoint's
// export, their XOR, and the pixels that differ by more than `TOL` pixels (a visible difference, not antialiasing).
//   node compare.mjs <runDir> [--sheet]
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const [runDir = "C:/opf-work/shapes/sh-01/run"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const requirePptx = createRequire("C:/opf-work/sh-01-geometry/packages/pptx/package.json");
const sharp = requirePptx("sharp");
const TOL = Number(process.env.TOL ?? 2);
const manifest = JSON.parse(await readFile(path.join(runDir, "manifest.json"), "utf8"));

async function mask(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const m = new Uint8Array(info.width * info.height);
  for (let i = 0; i < m.length; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    m[i] = (r + g + b) / 3 < 215 ? 1 : 0;
  }
  return { m, w: info.width, h: info.height };
}

function near(m, w, h, x, y, value, r) {
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      if (m[yy * w + xx] === value) return true;
    }
  return false;
}

const rows = [];
for (const entry of manifest) {
  const a = await mask(path.join(runDir, "mine", entry.file));
  const b = await mask(path.join(runDir, "ppt", entry.file));
  if (a.w !== b.w || a.h !== b.h) throw new Error(`size mismatch ${entry.file}`);
  const cellRects = [
    [0, 0],
    [640, 0],
    [0, 360],
    [640, 360],
  ];
  entry.cells.forEach((cell, index) => {
    const [x0, y0] = cellRects[index];
    let xor = 0, union = 0, far = 0, inkA = 0, inkB = 0;
    for (let y = y0; y < y0 + 360; y++)
      for (let x = x0; x < x0 + 640; x++) {
        const i = y * a.w + x;
        const va = a.m[i], vb = b.m[i];
        inkA += va; inkB += vb;
        if (va || vb) union++;
        if (va !== vb) {
          xor++;
          // a mine-only pixel with no PowerPoint ink within TOL, or a PowerPoint-only pixel with none of mine within TOL
          if (va && !near(b.m, a.w, a.h, x, y, 1, TOL)) far++;
          if (vb && !near(a.m, a.w, a.h, x, y, 1, TOL)) far++;
        }
      }
    rows.push({ slide: entry.slide, name: entry.name, pass: entry.pass, cell: index, w: cell.w, h: cell.h, adjust: cell.adjust, inkMine: inkA, inkPpt: inkB, xor, union, xorPct: union ? (100 * xor) / union : 0, far });
  });
}
await writeFile(path.join(runDir, "compare.json"), JSON.stringify(rows, null, 1));
const byShape = new Map();
for (const row of rows) {
  const s = byShape.get(row.name) ?? { name: row.name, maxFar: 0, maxXorPct: 0, far: 0, cells: [] };
  s.maxFar = Math.max(s.maxFar, row.far);
  s.maxXorPct = Math.max(s.maxXorPct, row.xorPct);
  s.far += row.far;
  if (row.far > 0) s.cells.push(`${row.pass}#${row.cell}:${row.far}`);
  byShape.set(row.name, s);
}
const shapes = [...byShape.values()].sort((x, y) => y.maxFar - x.maxFar);
await writeFile(path.join(runDir, "by-shape.json"), JSON.stringify(shapes, null, 1));
const flagged = shapes.filter((s) => s.maxFar > 0);
console.log(`cells ${rows.length}; mean xor ${(rows.reduce((t, r) => t + r.xorPct, 0) / rows.length).toFixed(2)}%; shapes with pixels off by more than ${TOL}px: ${flagged.length}`);
for (const s of flagged.slice(0, 60)) console.log(`${s.name.padEnd(28)} maxFar ${String(s.maxFar).padStart(6)}  maxXor ${s.maxXorPct.toFixed(2)}%  ${s.cells.join(" ")}`);
