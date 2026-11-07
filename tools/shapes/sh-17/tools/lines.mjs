// node lines.mjs <sweep-dir>: per live instance of the gate, core's line counts and size with the native score.
import { readFileSync } from 'node:fs';
const core = await import('file:///C:/opf-work/sh-17-linear-smartart/packages/javascript/dist/index.js');
const comp = await import('file:///C:/opf-work/sh-17-linear-smartart/packages/javascript/dist/composition.js');
const { gallery } = await import('file:///C:/opf-work/sh-17-linear-smartart/packages/gallery/dist/index.js');
const dir = process.argv[2], gate = JSON.parse(readFileSync(`${dir}/gate.json`, 'utf8'));
for (const row of gate.filter(r => r.live)) {
  const deck = JSON.parse(readFileSync(`${dir}/decks/${row.id.replace(/-1$/, '')}.opf.json`, 'utf8'));
  const ctx = core.resolveSlideContext(deck, 0, { catalogs: [gallery] }), g = comp.composeSlide(deck.slides[0], ctx.options), a = g.arrangements[0];
  const room = a.nodes.map((node, i) => { const col = g.items.find(it => it.path === a.path).listColumns[i]; const [l, t, r, b] = a.margins; return +((node.textBox.height - t - b - col.box.height) / a.fontSize).toFixed(2); });
  const cols=g.items.find(it=>it.path===a.path).listColumns; const ink=cols.reduce((t,c)=>t+c.text.listEntries[0].text.richLines.reduce((u,l)=>u+l.width*a.fontSize,0),0)/(a.frame.width*a.frame.height); const fill=cols.map((c,i)=>{const n=a.nodes[i],[l,t,r,b]=a.margins,e=c.text.listEntries[0];return [Math.max(...e.text.richLines.map(x=>x.width))/(n.textBox.width-l-r), e.text.height/(n.textBox.height-t-b)];}); const hf=Math.max(...fill.map(f=>f[0])), vf=Math.max(...fill.map(f=>f[1])); console.log("hfill",hf.toFixed(3),"vfill",vf.toFixed(3),"dens",ink.toFixed(3),row.result.slice(0, 22).padEnd(22), row.id.padEnd(34), 'size', (a.fontSize * .75).toFixed(1), 'lines', a.smartArt.lines.join(','), 'room(em)', Math.min(...room), 'rect', row.rect, 'nat', row.native?.mad, row.native?.mad1280);
}
