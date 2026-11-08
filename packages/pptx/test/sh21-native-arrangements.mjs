// SH21: both engines use the measured geometry; native-shape export is complete while live text/edit eligibility awaits qualification.
import assert from 'node:assert/strict';
import {strFromU8,unzipSync} from 'fflate';
import {toPptx,fromPptx} from '../dist/index.js';
import {toSvg} from '@openpresentation/opf-render';
const tree=[{text:'Root',level:0},{text:'Build',level:1},{text:'Web',level:2},{text:'App',level:2},{text:'Ship',level:1}];
const layout=kind=>({name:kind,direction:'column',regions:[{name:'title'},{name:'nodes',accepts:['list'],role:'primary',flow:'none',arrangement:kind}]});
for(const kind of ['org-chart','hierarchy','venn']){
 const items=kind==='venn'?['One','Two','Three']:tree,deck={catalogs:{custom:{layouts:{[kind]:layout(kind)}}},slides:[{layout:'custom:'+kind,title:'A clear plan',items}]};
 const svg=toSvg(deck,{trace:true})[0];assert.ok(svg.includes('data-opf-arrangement="'+kind+'"'));
 if(kind==='hierarchy')assert.equal((svg.match(/fill-opacity="0.9"/g)||[]).length,tree.length);
 if(kind==='venn')assert.equal((svg.match(/fill-opacity="0.5"/g)||[]).length,items.length);
 const diagnostics=[],bytes=new Uint8Array(await toPptx(deck,{seed:2121,timestamp:'2026-11-07T00:00:00Z',zipDate:'2026-11-07T00:00:00Z',onDiagnostic:d=>diagnostics.push(d)})),entries=unzipSync(bytes),xml=strFromU8(entries['ppt/slides/slide1.xml']);
 assert.ok(!Object.keys(entries).some(name=>/^ppt\/diagrams\//.test(name)),'new live domain remains unqualified');assert.ok(diagnostics.some(d=>d.code==='smartart-unavailable'&&/awaiting native qualification/.test(d.reason)));
 if(kind==='hierarchy'){assert.equal((xml.match(/name="OPF arrangement slides\.0\.items rear \d+"/g)||[]).length,tree.length);assert.equal((xml.match(/fmla="val 10000"/g)||[]).length,tree.length*2);assert.equal((xml.match(/<a:alpha val="90000"\/>/g)||[]).length,tree.length);}
 if(kind==='venn')assert.equal((xml.match(/<a:alpha val="50000"\/>/g)||[]).length,items.length);
 if(kind!=='venn')assert.ok(xml.includes('connector 1 segment'),'tree edges export as editable native lines');
 const back=await fromPptx(bytes),actual=back.slides[0].items??back.slides[0].blocks?.find(block=>block.items)?.items;const semantic=values=>values.map(value=>typeof value==='string'?{text:value,level:0}:{...value,level:value.level??0});assert.deepEqual(semantic(actual),semantic(items),kind+': every original text/depth round-trips; rear cards/connectors are drawing');
}
console.log('SH21 native-shape export: three arrangements, paired rounded cards, alpha, editable edges and original text/levels all pass; no live-domain acceptance.');