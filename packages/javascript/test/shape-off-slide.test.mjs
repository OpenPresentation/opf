// opf/shape-off-slide: an overlay shape or an image callout with no part on the slide draws nothing, which is nearly always a percent or
// a pixel written where a fraction belongs. It is a warning; a position outside the slide stays valid, and one that straddles an edge
// is never reported.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validate} from '../dist/index.js';
import {composeSlide} from '../dist/composition.js';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const deck=(slide)=>({name:'Placement',language:'en-US',slides:[{title:'Launch plan',blocks:[{id:'note',text:'Three regions go live in March.'}],...slide}]});
const errors=doc=>validate(doc,{only:['format']}).findings.filter(f=>f.severity==='error');
const offSlide=doc=>validate(doc).findings.filter(f=>f.ruleId==='opf/shape-off-slide');
const shape=frame=>deck({shapes:[{shape:'rect',text:'Draft',width:0.2,height:0.1,...frame}]});

test('a shape or callout wholly outside the slide is a warning; one that straddles an edge is not',()=>{
 for(const frame of [{x:20,y:30},{x:1,y:0.2},{x:-0.2,y:0.2},{x:0.2,y:1},{x:0.2,y:-0.1},{x:1.5,y:0.2}]){
  const found=offSlide(shape(frame));assert.equal(found.length,1,JSON.stringify(frame));
  assert.equal(found[0].path,'/slides/0/shapes/0');assert.equal(found[0].severity,'warning');assert.match(found[0].message,/wholly outside the slide/);assert.match(found[0].help,/fractions/);
  assert.deepEqual(errors(shape(frame)),[],'a position outside the slide stays valid');
 }
 for(const frame of [{x:-0.06,y:-0.05},{x:0.95,y:0.2},{x:0.2,y:0.95},{x:-0.19,y:0.2},{x:0.4,y:0.4}])assert.deepEqual(offSlide(shape(frame)),[],JSON.stringify(frame));
 // Right to left the origin counts from the right edge: the same numbers are outside or inside on the mirrored side.
 const rtl=frame=>({...shape(frame),language:'ar'});
 assert.equal(offSlide(rtl({x:1,y:0.2})).length,1);assert.deepEqual(offSlide(rtl({x:0.9,y:0.2})),[]);
 // A turned shape is judged by the circle through its corners, so a corner that may reach the slide is never reported; a hidden shape is not drawn at all.
 assert.equal(offSlide(shape({x:1.002,y:0.4})).length,1);assert.deepEqual(offSlide(shape({x:1.002,y:0.4,rotate:45})),[]);assert.equal(offSlide(shape({x:3,y:0.4,rotate:45})).length,1);
 assert.deepEqual(offSlide(shape({x:20,y:30,hidden:true})),[]);
 // An anchored shape is judged where composition puts it.
 assert.deepEqual(offSlide(deck({shapes:[{shape:'rect',at:{block:'note',edge:'top',widthPx:40,heightPx:20}}]})),[]);
});

test('an image callout wholly outside the slide is reported at the callout',()=>{
 const callouts=list=>({name:'Sensor',language:'en-US',slides:[{title:'Where the sensor sits',image:{src:image,alt:'Pump housing',callouts:list}}]});
 const far=offSlide(callouts([{text:'Inlet sensor',x:50,y:50,width:0.3,height:0.14},{text:'Seal',x:-0.08,y:0.12,width:0.3,height:0.14}]));
 assert.equal(far.length,1);assert.equal(far[0].path,'/slides/0/image/callouts/0');assert.match(far[0].message,/image callout lies wholly outside the slide/);
});

test('a strict composition still composes an off-slide shape: it is advice, not an overflow',()=>{
 const doc=shape({x:20,y:30});
 const strict=composeSlide({...doc.slides[0],composition:{overflow:'error'}},{width:1280,height:720,presentation:doc});
 assert.ok(strict.diagnostics.some(d=>d.code==='shape-off-slide'&&d.path==='slides.0.shapes.0'));
 assert.equal(strict.overlayShapes.length,1);
});
