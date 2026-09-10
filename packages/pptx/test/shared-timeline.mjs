import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {unzipSync,zipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {toPptx,fromPptx} from '../dist/index.js';
import {decodeTextTag} from '../dist/code-provenance.js';
import {prepareNodeFonts} from '../../opf-render/dist/fonts-node.js';
import {resolvePresentation} from '../../opf-render/dist/svg.js';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false}),decode=bytes=>new TextDecoder().decode(bytes),encode=text=>new TextEncoder().encode(text),array=v=>v===undefined?[]:Array.isArray(v)?v:[v];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),{options:fontOptions}=await prepareNodeFonts(),results=[];
const fixtures=[
 [{when:' Q1 ',what:'Pilot',description:'First\r\n\r\nLast  '},{what:'Next'}],
 {name:'Migration plan',description:'Context stays attached.',events:[{when:'Now',what:'A\u00a0B\tC',description:'  Keep  spaces  '},{what:'',description:'Blank labels remain fields.'}]},
 {events:[{what:'Only one event'}]},
 {name:'',description:'',events:[{when:'',what:'',description:''}]},
];
let control;
for(const measured of [false,true])for(const [width,height]of [[1280,720],[720,1280]])for(const [fixture,timeline]of fixtures.entries()){
 const source={design:{fontScheme:'roboto',dimensions:{widthInches:width/96,heightInches:height/96}},slides:[{title:'Timeline source',composition:{minFontSize:24,overflow:'error'},timeline}]},before=structuredClone(source),options=measured?fontOptions:{};
 const bound=resolvePresentation(source,options).slides[0],layout=bound.geometry.items.find(item=>item.timelineLayout).timelineLayout;
 const bytes=await toPptx(source,options),entries=unzipSync(bytes),xml=decode(entries['ppt/slides/slide1.xml']),root=parser.parse(xml)['p:sld']['p:cSld']['p:spTree'];
 const shapes=array(root['p:sp']),timed=shapes.filter(shape=>shape['p:nvSpPr']?.['p:cNvPr']?.name.startsWith('OPF timeline '));
 assert.equal(timed.length,layout.parts.reduce((n,p)=>n+p.fit.sourceLines.length,0)+layout.markers.length+1);
 for(const [partIndex,part]of layout.parts.entries())for(const [index,line]of part.fit.sourceLines.entries()){
  const shape=timed.find(shape=>shape['p:nvSpPr']['p:cNvPr'].name.endsWith(`part ${partIndex} line ${index}`));assert.ok(shape);
  const native=array(shape['p:txBody']['a:p']).map(p=>array(p['a:r']).map(r=>r['a:t']??'').join('')).join('\n');assert.equal(native,part.text.slice(line.start,line.end));
  const fit=part.fit,placed=fit.placement?.lines[index],factor=part.alignment==='center'?.5:0,area=placed?{x:placed.x+placed.width*factor-part.box.width*factor,y:placed.baseline-fit.fontSize,width:part.box.width,height:placed.height}:{x:part.box.x,y:part.box.y+index*fit.lineHeight,width:part.box.width,height:fit.lineHeight};
  const xfrm=shape['p:spPr']['a:xfrm'];for(const [actual,expected]of [[xfrm['a:off'].x,area.x],[xfrm['a:off'].y,area.y],[xfrm['a:ext'].cx,area.width],[xfrm['a:ext'].cy,area.height]])assert.equal(Number(actual),Math.round(expected*9525));
  for(const p of array(shape['p:txBody']['a:p']))for(const run of array(p['a:r']))assert.equal(Number(run['a:rPr'].sz),Math.round(fit.fontSize*.75*100));
  for(const auto of ['a:normAutofit','a:spAutoFit'])assert.ok(!Object.hasOwn(shape['p:txBody']['a:bodyPr'],auto));
 }
 const diagnostics=[],imported=await fromPptx(bytes,{onDiagnostic:d=>diagnostics.push(d)});
 assert.deepEqual(imported.slides[0].blocks,[{type:'timeline',timeline}]);assert.equal(imported.slides[0].title,source.slides[0].title);assert.deepEqual(source,before);assert.ok(diagnostics.every(d=>['timeline-import-reflow','heading-import-reflow'].includes(d.code)));
 results.push({measured,width,height,fixture,parts:layout.parts.length,shapes:timed.length,arrangement:layout.arrangement,sha256:hash(bytes)});
 if(!measured&&width===1280&&fixture===0)control={entries,xml,timeline};
}
const rebuilt=async mutate=>{const entries=structuredClone(control.entries);await mutate(entries);const diagnostics=[];const imported=await fromPptx(zipSync(entries),{onDiagnostic:d=>diagnostics.push(d)});return {imported,diagnostics};};
const editXml=(entries,change)=>entries['ppt/slides/slide1.xml']=encode(change(decode(entries['ppt/slides/slide1.xml'])));
const changed=await rebuilt(entries=>editXml(entries,xml=>xml.replace('<a:t>Pilot</a:t>','<a:t>Edited milestone</a:t>')));
assert.equal(changed.imported.slides[0].blocks[0].timeline[0].what,'Edited milestone');
const cleared=await rebuilt(entries=>editXml(entries,xml=>xml.replace('<a:t>Pilot</a:t>','<a:t></a:t>')));
assert.equal(cleared.imported.slides[0].blocks[0].timeline[0].what,'');
const reordered=await rebuilt(entries=>editXml(entries,xml=>{const shapes=[...xml.matchAll(/<p:sp>[^]*?<\/p:sp>/g)].map(match=>match[0]).reverse();return xml.replace(/<p:sp>[^]*?<\/p:sp>/g,()=>shapes.shift());}));
assert.deepEqual(reordered.imported.slides[0].blocks,[{type:'timeline',timeline:control.timeline}]);
const fields=Object.entries(control.entries).filter(([name])=>name.startsWith('ppt/tags/')).flatMap(([,bytes])=>array(parser.parse(decode(bytes))['p:tagLst']?.['p:tag'])).filter(tag=>tag.name==='OPF_TIMELINE_V1').map(tag=>decodeTextTag(tag.val));
assert.ok(!JSON.stringify(fields).includes('Pilot'));assert.ok(!JSON.stringify(fields).includes('First'));
const failures=[];
const mutateNamed=(xml,pattern,change)=>xml.replace(/<p:sp>[^]*?<\/p:sp>/g,shape=>pattern.test(shape)?change(shape):shape);
for(const [name,change]of [
 ['missing-field',xml=>mutateNamed(xml,/name="OPF timeline 0 part 1 line 0"/,()=> '')],
 ['duplicate-field',xml=>mutateNamed(xml,/name="OPF timeline 0 part 1 line 0"/,shape=>shape+shape)],
 ['missing-marker',xml=>mutateNamed(xml,/name="OPF timeline 0 marker 0"/,()=> '')],
 ['changed-marker',xml=>mutateNamed(xml,/name="OPF timeline 0 marker 0"/,shape=>shape.replace('prst="ellipse"','prst="rect"'))],
 ['marker-text',xml=>mutateNamed(xml,/name="OPF timeline 0 marker 0"/,shape=>shape.replace('</p:sp>','<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1200"/><a:t>New native marker words</a:t></a:r></a:p></p:txBody></p:sp>'))],
 ['native-bullet',xml=>mutateNamed(xml,/name="OPF timeline 0 part 1 line 0"/,shape=>shape.replace('</a:pPr>','<a:buChar char="•"/></a:pPr>'))],
]){
 const result=await rebuilt(entries=>editXml(entries,change));assert.ok(result.diagnostics.some(d=>d.code==='invalid-timeline-provenance'),name);assert.ok(!result.imported.slides[0].blocks.some(block=>block.timeline),name);
 const text=JSON.stringify(result.imported);assert.ok(text.includes('Next'),name);if(name==='missing-field')assert.ok(!text.includes('Pilot'));if(name==='marker-text')assert.ok(text.includes('New native marker words'));
 failures.push({name,diagnostics:result.diagnostics});
}
const multiple={slides:[{blocks:[{timeline:control.timeline},{timeline:fixtures[1]}]}]};assert.deepEqual((await fromPptx(await toPptx(multiple))).slides[0].blocks,multiple.slides[0].blocks.map(block=>({type:'timeline',...block})));
const dense={design:{fontScheme:'roboto'},slides:[{timeline:{events:Array.from({length:12},(_,index)=>({when:`Q${index+1}`,what:`Milestone ${index+1}`,description:'Keep every label inside its allocated space.'}))},composition:{minFontSize:32,overflow:'error'}}]};
for(const options of [{},fontOptions]){
 await assert.rejects(toPptx(dense,options),error=>error.code==='layout-overflow'&&!(error instanceof TypeError));
 const warned=structuredClone(dense),diagnostics=[];warned.slides[0].composition.overflow='warn';
 const bytes=await toPptx(warned,{...options,onDiagnostic:diagnostic=>diagnostics.push(diagnostic)});
 assert.ok(diagnostics.some(diagnostic=>diagnostic.code==='text-overflow'));
 assert.deepEqual((await fromPptx(bytes)).slides[0].blocks,[{type:'timeline',timeline:dense.slides[0].timeline}]);
}
if(process.argv[2]){await mkdir(path.dirname(path.resolve(process.argv[2])),{recursive:true});await writeFile(process.argv[2],JSON.stringify({node:process.version,verifierSha256:hash(await readFile(new URL(import.meta.url))),results,failures,overflowControls:{strict:2,warn:2},scope:'Editable XML structure and controlled native-text mutations only; no native Office execution. Current field values, array/object form and source boundaries survive complete tags. Damaged tags retain ordinary native text.'},null,2)+'\n');}
console.log('16 timeline exports match accepted text boxes, fonts and source; current edits, clearing, reordering, six damaged-group controls multiple timelines and four strict/warn overflow controls pass.');
