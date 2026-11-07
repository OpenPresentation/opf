// node cmp.mjs <kind> <id>: PowerPoint's shapes (COM probe) against OPF's interpreter of the file's layout part, in points.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { parseLayoutDefinition } from './layout-xml.mjs';
const c = await import('file:///C:/opf-work/sh-19-smartart-layouts/packages/javascript/dist/composition.js');
const [kind, id] = process.argv.slice(2), dir = `C:/opf-work/shapes/sh-19/sweep/${kind}`;
const p = JSON.parse(readFileSync(`${dir}/ppt/probe.json`, 'utf8').replace(/^\uFEFF/, '')).find(d => d.file === id);
const sa = p.slides[0].smartArt[0];
const slide = execSync(`unzip -p ${dir}/pptx/${id}.pptx ppt/slides/slide1.xml`).toString(), m = /<p:graphicFrame>[\s\S]*?<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/.exec(slide);
const f = { x: m[1] / 9525, y: m[2] / 9525, width: m[3] / 9525, height: m[4] / 9525 };
const def = parseLayoutDefinition(execSync(`unzip -p ${dir}/pptx/${id}.pptx ppt/diagrams/layout1.xml`).toString());
const mine = c.evaluateLayoutDefinition(def, f, sa.nodes).filter(s => !s.hidden);
console.log('frame pt', (f.x * .75).toFixed(2), (f.y * .75).toFixed(2), (f.width * .75).toFixed(2), (f.height * .75).toFixed(2), 'ppt', sa.left, sa.top, sa.width, sa.height);
sa.items.forEach((i, k) => { const s = mine[k]; console.log(`ppt ${i.type} ${[i.left, i.top, i.width, i.height].map(v => v.toFixed(2)).join(' ')} rot ${i.rotation ?? ''} sz ${i.size ?? ''} lines ${(i.lines || []).length} | opf ${s?.preset} ${s ? [s.box.x, s.box.y, s.box.width, s.box.height].map(v => (v * .75).toFixed(2)).join(' ') : ''} rot ${s?.rotation?.toFixed(2)}`); });
