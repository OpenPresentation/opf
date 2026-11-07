import { composeSlide } from '@openpresentation/opf/composition';
const words = n => Array.from({length:n},(_,i)=>['growth','revenue','customers','market','platform','strategy','quarter','team'][i%8]).join(' ');
const cases = {
  shortList: { title: 'Three points', items: ['Fast', 'Cheap', 'Good'] },
  mediumList: { title: 'Six points', items: Array.from({length:6},(_,i)=>`Point ${i+1}: ${words(8)}`) },
  longList: { title: 'Fourteen points', items: Array.from({length:14},(_,i)=>`Point ${i+1}: ${words(10)}`) },
  hugeList: { title: 'Thirty points', items: Array.from({length:30},(_,i)=>`Point ${i+1}: ${words(14)}`) },
  shortProse: { title: 'Prose', text: words(12) },
  longProse: { title: 'Prose', text: words(160) },
  hugeProse: { title: 'Prose', text: words(500) },
  table: { title: 'Table', table: { columns: ['A','B','C','D'], rows: Array.from({length:14},(_,i)=>[`r${i}`, words(3), words(4), String(i*100)]) } },
};
for (const [name, slide] of Object.entries(cases)) {
  try {
    const r = composeSlide(slide);
    const scale = Math.min(r.width, r.height)/720;
    const sizes = r.items.map(it => `${it.field}:${it.text ? (it.text.fontSize/scale).toFixed(2)+'px' : it.field==='table' ? 'table' : '-'}${it.listColumns ? `(cols ${it.listColumns.length})` : ''}`).join(' ');
    console.log(name.padEnd(11), `${r.width}x${r.height}`, sizes, '| diag:', r.diagnostics.map(d=>d.code).join(',') || 'none');
  } catch (e) { console.log(name, 'ERR', e.message.slice(0,200)); }
}
