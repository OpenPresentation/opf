import * as C from '@openpresentation/opf/composition';
const words = n => Array.from({length:n},(_,i)=>['growth','revenue','customers','market'][i%4]).join(' ');
for (const [name, src] of [['big', 'flowchart LR\n' + Array.from({length:14},(_,i)=>`n${i}[Step ${i} ${words(3)}] --> n${i+1}`).join('\n')], ['small','flowchart LR\na[Start] --> b[End]'], ['mid','flowchart LR\na[Collect data] --> b[Clean it] --> c[Model] --> d[Ship the results]']]) {
  const r = C.composeSlide({ title:'D', diagram: src }); const it = r.items.find(i=>i.field==='diagram'); const g = it.diagram;
  const found = {}; JSON.stringify(g, (k,v)=>{ if (/font/i.test(k) && typeof v==='number') (found[k] ??= new Set()).add(+v.toFixed(2)); return v; });
  console.log(name, 'scale', g.scale, Object.entries(found).map(([k,s])=>k+'='+[...s].join('/')).join(' '), 'box', JSON.stringify(it.box), r.diagnostics.map(d=>d.code).join(','));
}
