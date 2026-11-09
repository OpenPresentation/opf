// Signed positions, sizes and their units: overlay shapes (fractions of the slide, up to 8 slides), anchored shapes (a fraction of
// the target, or reference pixels under their own keys), image callouts, and the warning for what lies wholly outside the slide.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validate} from '../dist/index.js';
import {composeSlide} from '../dist/composition.js';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const deck=(slide)=>({name:'Placement',language:'en-US',slides:[{title:'Launch plan',blocks:[{id:'note',text:'Three regions go live in March.'}],...slide}]});
const errors=doc=>validate(doc,{only:['format']}).findings.filter(f=>f.severity==='error');
const offSlide=doc=>validate(doc).findings.filter(f=>f.ruleId==='opf/shape-off-slide');
const boxes=(slide,options={})=>composeSlide(deck(slide).slides[0],{width:1280,height:720,...options}).overlayShapes.map(o=>o.box);

test('an overlay shape may be larger than the slide, up to 8 slides; origins are finite signed fractions',()=>{
 for(const frame of [{x:-0.3,y:-0.5,width:1.2,height:1.6},{x:0,y:0,width:8,height:8},{x:-7,y:0.4,width:8,height:0}])assert.deepEqual(errors(deck({shapes:[{shape:'ellipse',...frame}]})),[],JSON.stringify(frame));
 for(const frame of [{x:0,y:0,width:8.01,height:1},{x:0,y:0,width:1,height:-0.1}])assert.ok(errors(deck({shapes:[{shape:'ellipse',...frame}]})).length,JSON.stringify(frame));
 assert.deepEqual(boxes({shapes:[{shape:'ellipse',x:-0.3,y:-0.5,width:1.2,height:1.6}]}),[{x:-384,y:-360,width:1536,height:1152}]);
 // JSON text such as 1e999 reads as Infinity: the schema refuses it at the coordinate.
 for(const key of ['x','y'])for(const value of [Infinity,-Infinity,NaN]){const found=errors(deck({shapes:[{shape:'rect',x:0,y:0,width:.2,height:.1,[key]:value}]}));assert.ok(found.some(f=>f.path==='/slides/0/shapes/0/'+key),key+' '+value);}
});

test('an anchored size has one unit per key: a fraction of the target, or reference pixels',()=>{
 const at=extra=>({shape:'rect',at:{block:'note',edge:'center',...extra}});
 const target=composeSlide(deck({}).slides[0],{width:1280,height:720}).items.find(i=>i.path==='slides.0.blocks.0.text').box;
 const [same,wider,tiny,pixels,mixed]=boxes({shapes:[at({width:1,height:1}),at({width:1.08,height:1.08}),at({width:0.5}),at({widthPx:160,heightPx:64}),at({width:1.5,heightPx:40})]});
 const near=(a,b)=>assert.ok(Math.abs(a-b)<0.01,`${a} ~ ${b}`);
 near(same.width,target.width);near(same.height,target.height);
 // 1.08 is 8% larger than the target, not 1.08 pixels: there is no cliff at 1.
 near(wider.width,target.width*1.08);near(wider.height,target.height*1.08);
 near(tiny.width,target.width*0.5);
 near(pixels.width,160);near(pixels.height,64);
 near(mixed.width,target.width*1.5);near(mixed.height,40);
 assert.deepEqual(errors(deck({shapes:[at({width:1.08,height:1.08}),at({widthPx:160,heightPx:64}),at({width:8,heightPx:1280})]})),[]);
 for(const extra of [{width:0.4,widthPx:160},{height:0.4,heightPx:64},{width:8.01},{widthPx:1281},{width:0},{widthPx:0}])assert.ok(errors(deck({shapes:[at(extra)]})).length,JSON.stringify(extra));
});

test('a shape or callout wholly outside the slide is a warning; one that straddles an edge is not',()=>{
 const shape=frame=>deck({shapes:[{shape:'rect',text:'Draft',width:0.2,height:0.1,...frame}]});
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
 const callouts=list=>({name:'Sensor',language:'en-US',slides:[{title:'Where the sensor sits',image:{src:image,alt:'Pump housing',callouts:list}}]});
 const far=offSlide(callouts([{text:'Inlet sensor',x:50,y:50,width:0.3,height:0.14},{text:'Seal',x:-0.08,y:0.12,width:0.3,height:0.14}]));
 assert.equal(far.length,1);assert.equal(far[0].path,'/slides/0/image/callouts/0');assert.match(far[0].message,/image callout lies wholly outside the slide/);
});

test('a callout origin too far away to be exact geometry is an error at its coordinate, as a shape\'s is',()=>{
 const callouts=list=>({name:'Sensor',language:'en-US',slides:[{title:'Where the sensor sits',blocks:[{image:{src:image,alt:'Pump housing',callouts:list}}]}]});
 for(const key of ['x','y'])for(const value of [1e300,-1e300,1e20]){
  const found=errors(callouts([{text:'Inlet',x:0,y:0,width:0.3,height:0.14,[key]:value}]));
  assert.ok(found.some(f=>f.path==='/slides/0/blocks/0/image/callouts/0/'+key&&/safe integer native coordinate/.test(f.message)),key+' '+value+JSON.stringify(found.map(f=>f.path)));
 }
 assert.deepEqual(errors(callouts([{text:'Inlet',x:-1000,y:1000,width:0.3,height:0.14}])),[]);
});
