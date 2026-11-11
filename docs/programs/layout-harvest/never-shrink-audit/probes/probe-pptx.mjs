import { toPptx } from '@openpresentation/opf-pptx';
import { writeFileSync, mkdirSync } from 'node:fs';
const words = n => Array.from({length:n},(_,i)=>['growth','revenue','customers','market','platform','strategy','quarter','team'][i%8]).join(' ');
const deck = { name: 'Probe', slides: [
  { title: 'Short list', items: ['Fast', 'Cheap', 'Good'] },
  { title: 'Long list', items: Array.from({length:14},(_,i)=>`Point ${i+1}: ${words(10)}`) },
  { title: 'Table', table: { columns:['A','B','C','D'], rows:Array.from({length:14},(_,i)=>[`r${i}`, words(3), words(4), String(i*100)]) } },
  { title: 'Chart', chart: { type: 'column', data: { columns: ['Quarter','Rev'], rows: [['Q1',1],['Q2',2],['Q3',3]] } } },
  { title: 'Shape', blocks: [{ shape: 'rect', text: 'Hello' }] },
]};
mkdirSync('C:/opf-work/never-shrink/out', { recursive: true });
for (const mode of ['measured', 'native']) {
  try { const out = await toPptx(deck, { bodyText: mode, outputType: 'nodebuffer' }); const buf = out.buffer ?? out.data ?? out; writeFileSync(`C:/opf-work/never-shrink/out/probe-${mode}.pptx`, Buffer.from(buf)); console.log(mode, 'ok', typeof out, Object.keys(out).slice(0,5)); }
  catch (e) { console.log(mode, 'ERR', e.message.slice(0,300), JSON.stringify(e.findings ?? e.details ?? '').slice(0,600)); }
}
