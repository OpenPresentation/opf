import * as C from '@openpresentation/opf/composition';
console.log(Object.keys(C).filter(k=>/table|diagram|TABLE|NOMINAL|LONE/i.test(k)).join(' '));
const words = n => Array.from({length:n},(_,i)=>['growth','revenue','customers','market'][i%4]).join(' ');
for (const n of [4,14,30]) {
  const slide = { title:'T', table:{ columns:['A','B','C','D'], rows:Array.from({length:n},(_,i)=>[`r${i}`, words(3), words(4), String(i*100)]) } };
  const r = C.composeSlide(slide); const it = r.items.find(i=>i.field==='table');
  const t = C.layoutTable(it.value, it.box, { scale:1, minFontSize: it.composition.minFontSize, ...(it.tableGrowth?{growth:it.tableGrowth}:{}) });
  console.log('table', n, 'rows: cell sizes', [...new Set(t.rows.flatMap(row=>row.cells.map(c=>c.fit.fontSize)))].join('/'), 'growth', it.tableGrowth ?? '-');
}
const d = C.composeSlide({ title:'D', diagram: 'flowchart LR\n' + Array.from({length:14},(_,i)=>`n${i}[Step ${i} ${words(3)}] --> n${i+1}`).join('\n') });
const di = d.items.find(i=>i.field==='diagram'); console.log('diagram', Object.keys(di).join(' ').slice(0,300), 'scale', di.scale, 'diag', d.diagnostics.map(x=>x.code).join(','));
const ds = C.composeSlide({ title:'D', diagram: 'flowchart LR\na[Start] --> b[End]' }); const dd = ds.items.find(i=>i.field==='diagram'); console.log('small diagram scale', dd.scale, 'nominal', dd.nominal ?? dd.fontSize);
