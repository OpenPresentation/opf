// node triage.mjs : per slide, whether the combined branch's PPTX slide (with its chart parts) and preview PNG differ from main's.
// Joins sheets/scores.json and writes sheets/triage.json.
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const { unzipSync, strFromU8 } = createRequire('C:/opf-work/sh-phase-2/packages/pptx/package.json')('fflate');
const base = 'C:/opf-work/harvest/wave8/verify/w8';
const scores = JSON.parse(readFileSync(`${base}/sheets-ex/scores.json`, 'utf8'));
const hash = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
const cache = new Map();
function slideDigests(file) {
  if (cache.has(file)) return cache.get(file);
  if (!existsSync(file)) { cache.set(file, null); return null; }
  const parts = unzipSync(readFileSync(file));
  const out = {};
  for (const name of Object.keys(parts)) {
    const m = name.match(/^ppt\/slides\/slide(\d+)\.xml$/);
    if (!m) continue;
    // ids and rIds differ harmlessly; strip creation-specific attributes before hashing
    let x = strFromU8(parts[name]).replace(/ id="\d+"/g, '').replace(/r:(id|embed)="rId\d+"/g, '');
    const rels = parts[`ppt/slides/_rels/slide${m[1]}.xml.rels`] ? strFromU8(parts[`ppt/slides/_rels/slide${m[1]}.xml.rels`]) : '';
    for (const t of rels.matchAll(/Target="\.\.\/charts\/([^"]+)"/g)) { const p = parts[`ppt/charts/${t[1]}`]; if (p) x += strFromU8(p); }
    out[Number(m[1])] = hash(x);
  }
  cache.set(file, out);
  return out;
}
const pngHash = (dir, n) => { if (!existsSync(dir)) return null; const f = readdirSync(dir).find((f) => Number(f.match(/(\d+)\.png$/)?.[1]) === n); return f ? hash(readFileSync(`${dir}/${f}`)) : null; };
const rows = scores.filter((s) => !s.missing).map((s) => {
  const a = slideDigests(`${base}/export-ex/pptx/${s.id}.pptx`), b = slideDigests(`${base}/export-ex-main/pptx/${s.id}.pptx`);
  const pa = pngHash(`${base}/export-ex/preview/${s.id}`, s.slide), pb = pngHash(`${base}/export-ex-main/preview/${s.id}`, s.slide);
  return { ...s, pptxChanged: b ? a?.[s.slide] !== b[s.slide] : 'no main', previewChanged: pb ? pa !== pb : 'no main' };
});
writeFileSync(`${base}/sheets-ex/triage.json`, JSON.stringify(rows, null, 1));
const changed = rows.filter((r) => r.pptxChanged === true || r.previewChanged === true);
console.log(`slides ${rows.length}; changed vs main: ${changed.length}`);
for (const r of changed) console.log(`${r.id}#${r.slide} pptx ${r.pptxChanged} preview ${r.previewChanged} mad ${r.mad} hot ${r.hot}`);
