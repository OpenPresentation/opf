/** Compare actual composition geometry with the previous fontless estimate, without promoting goldens. */
import {readFile,writeFile} from 'node:fs/promises';
import {composeSlide} from '../packages/javascript/dist/composition.js';
const corpus=JSON.parse(await readFile(new URL('../docs/evidence/script-corpora-20261001/script-corpora.json',import.meta.url)));
const previous=(text,size)=>[...text].reduce((sum,c)=>sum+(/\p{Mark}|\u200d|\ufe0f/u.test(c)?0:c===' '?.32:/[A-Z0-9]/u.test(c)?.62:c.codePointAt(0)>0x2e80?1:.54),0)*size;
const geometry=result=>result.items.map(item=>({box:item.box,text:item.text?{fontSize:item.text.fontSize,lines:item.text.lines}:undefined}));
const rows=corpus.groups.flatMap(group=>group.samples.map(sample=>{
  const slide={title:sample.text,blocks:[{text:sample.text}]};
  const before=geometry(composeSlide(slide,{width:640,height:360,textMeasurement:{measure:previous}}));
  const after=geometry(composeSlide(slide,{width:640,height:360}));
  return {script:group.script,id:sample.id,changed:JSON.stringify(before)!==JSON.stringify(after),before,after};
}));
const summary=corpus.groups.map(group=>({script:group.script,cases:rows.filter(row=>row.script===group.script).length,changed:rows.filter(row=>row.script===group.script&&row.changed).length}));
await writeFile(new URL('../docs/evidence/script-width-estimates/geometry.json',import.meta.url),JSON.stringify({method:'140 FF-44 strings as title and body at 640x360, automatic composition; old estimate supplied as measurement, compared only boxes/font sizes/lines; no fonts, baseline promotion or native claim.',summary,rows},null,2)+'\n');
console.log(JSON.stringify({cases:rows.length,changed:rows.filter(row=>row.changed).length,summary},null,2));
