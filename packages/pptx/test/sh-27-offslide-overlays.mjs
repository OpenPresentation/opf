import assert from 'node:assert/strict';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {composeSlide} from '@openpresentation/opf/composition';
import {toPptx,fromPptx} from '../dist/index.js';
const shapes=[
 {id:'glow',shape:'ellipse',x:0.2692,y:-0.1,width:0.42,height:0.75,fill:'#8000CC',stroke:'none',layer:'back',decorative:true,opacity:0.45,softEdge:60},
 {id:'left',shape:'rect',x:-0.1,y:0.3,width:0.2,height:0.2,fill:'#FF0000',stroke:'none'},
 {id:'right',shape:'rect',x:1.05,y:0.3,width:0.2,height:0.2,fill:'#00FF00',stroke:'none'}
];
for(const direction of ['ltr','rtl']){
 const doc={name:'Bleed',language:direction==='rtl'?'ar-SA':'en-US',design:{direction},slides:[{title:'Slide',shapes}]};
 const diagnostics=[],bytes=await toPptx(doc,{typefaces:'safe'}),parts=unzipSync(bytes),xml=strFromU8(parts['ppt/slides/slide1.xml']);
 const composition=composeSlide(doc.slides[0],{presentation:doc});
 for(const overlay of composition.overlayShapes){
  const box=overlay.box;
  assert.ok(xml.includes('<a:off x="'+Math.round(box.x*9525)+'" y="'+Math.round(box.y*9525)+'"/>'),direction+' keeps the signed native transform');
 }
 const imported=await fromPptx(bytes,{onDiagnostic:d=>diagnostics.push(d)});
 for(const original of shapes){
  const actual=imported.slides[0].shapes.find(s=>s.id===original.id);
  assert.ok(actual,original.id+' restored');
  for(const key of ['x','y','width','height'])assert.equal(actual[key],original[key],direction+' '+original.id+' '+key);
 }
 assert.equal(diagnostics.filter(d=>d.code==='shape-property-dropped').length,0);
 // An actual native edit must come back at its edited signed position, rather than stale OPF source.
 const oldY=Math.round(composition.overlayShapes[0].box.y*9525),nextY=-Math.round(0.2*720*9525);
 const editedXml=xml.replace('y="'+oldY+'"','y="'+nextY+'"');assert.notEqual(editedXml,xml);
 const changed=await fromPptx(zipSync({...parts,'ppt/slides/slide1.xml':strToU8(editedXml)}));
 assert.equal(changed.slides[0].shapes.find(s=>s.shape==='ellipse').y,-0.2,'current native position is authoritative');
}
console.log('SH-27 signed native shape export/import passed');
