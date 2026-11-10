import * as C from '@openpresentation/opf/composition';
const words = n => Array.from({length:n},(_,i)=>['growth','revenue','customers','market'][i%4]).join(' ');
for (const [name, src] of [['big', 'flowchart LR\n' + Array.from({length:14},(_,i)=>`n${i}[Step ${i} ${words(3)}] --> n${i+1}`).join('\n')], ['small','flowchart LR\na[Start] --> b[End]']]) {
  const r = C.composeSlide({ title:'D', diagram: src }); const g = r.items.find(i=>i.field==='diagram').diagram;
  const sizes = new Set(); JSON.stringify(g, (k,v)=>{ if ((k==='fontSize'||k==='size') && typeof v==='number') sizes.add(v); return v; });
  console.log(name, 'scale', g.scale, 'nominal', g.nominal, 'label sizes', [...sizes].join('/'), 'drawn', [...sizes].map(s=>(s*g.scale).toFixed(1)).join('/'), r.diagnostics.map(d=>d.code).join(','));
}
