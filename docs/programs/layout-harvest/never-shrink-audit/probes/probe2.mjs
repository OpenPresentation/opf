import { composeSlide } from '@openpresentation/opf/composition';
import { paginateSlide } from '@openpresentation/opf';
const words = n => Array.from({length:n},(_,i)=>['growth','revenue','customers','market','platform','strategy','quarter','team'][i%8]).join(' ');
const long = Array.from({length:14},(_,i)=>`Point ${i+1}: ${words(10)}`);
const show = (name, slide) => { try { const r = composeSlide(slide); const s = Math.min(r.width,r.height)/720;
  const out = r.items.map(it => { let v = it.text ? (it.text.fontSize/s).toFixed(2) : '-';
    if (it.field==='table' && it.table) v = 'cells ' + [...new Set(it.table.rows.flatMap(row=>row.cells.map(c=>(c.fit.fontSize/s).toFixed(2))))].join('/');
    if (it.diagram) v = 'diagram scale ' + it.diagram?.scale;
    return `${it.field}:${v}${it.listColumns?`(cols ${it.listColumns.length})`:''}`; }).join(' ');
  console.log(name.padEnd(16), out, '| diag:', r.diagnostics.map(d=>d.code).join(',')||'none'); return r; } catch(e) { console.log(name,'ERR',e.message.slice(0,200)); } };
show('longList cols', { title:'x', blocks:[{ items: long, columns:'auto' }] });
show('longList cols2', { title:'x', items: long, columns:'auto' });
show('longList floor24', { title:'x', items: long, composition:{minFontSize:24} });
show('longList floor28', { title:'x', items: long, composition:{minFontSize:28} });
const t = n => ({ title:'Table', table:{ columns:['A','B','C','D'], rows:Array.from({length:n},(_,i)=>[`r${i}`, words(3), words(4), String(i*100)]) } });
const r1 = show('table 4', t(4)); show('table 14', t(14)); show('table 30', t(30));
if (r1) { const it = r1.items.find(i=>i.field==='table'); console.log('table keys', Object.keys(it).join(' ')); }
show('shape short', { title:'x', blocks:[{ shape:'rect', text:'Hi' }] });
show('shape long', { title:'x', blocks:[{ shape:'rect', text: words(80) }] });
try { const p = paginateSlide({ title:'Thirty', items: Array.from({length:30},(_,i)=>`Point ${i+1}: ${words(14)}`) });
  console.log('paginate pages', p.slides.length); for (const sl of p.slides) show(' page', sl); } catch(e) { console.log('paginate ERR', e.message.slice(0,200)); }
try { const p = paginateSlide({ title:'Fourteen', items: long });
  console.log('paginate14 pages', p.slides.length); for (const sl of p.slides) show(' page', sl); } catch(e) { console.log('paginate ERR', e.message.slice(0,200)); }
