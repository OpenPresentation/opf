import fs from 'node:fs'; import path from 'node:path';
import JSZip from "file:///C:/opf-work/sh-02-shape-block/packages/pptx/vendor/jszip/index-min.js";
const roots = process.argv.slice(2); let n = 0;
async function walk(dir, depth = 0) {
  if (depth > 7) return; let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.git|AppData\Local\Temp/.test(p)) await walk(p, depth + 1); continue; }
    if (!/\.(pptx|potx|docx|dotx|xlsx|thmx)$/i.test(e.name) || fs.statSync(p).size > 60e6) continue;
    n++;
    try { const z = await JSZip.loadAsync(fs.readFileSync(p)); for (const f of Object.keys(z.files)) { if (!/\.xml$/.test(f)) continue; const t = await z.file(f).async('string'); if (t.includes('lineSketchStyleProps')) { console.log('FOUND', p, f); break; } } } catch {}
  }
}
for (const r of roots) await walk(r);
console.log('scanned', n);
