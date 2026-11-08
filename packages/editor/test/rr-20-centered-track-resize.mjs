import assert from 'node:assert/strict';
import {test} from 'node:test';
import {slideScene} from '../dist/slide-scene.js';
import {composeSlideGeometry} from '../dist/slide-adapter.js';
import {drawnTracks,prepareSceneTrackResize} from '../dist/slide-edits.js';
import {trackPairBounds} from '../dist/studio-track-geometry.js';

const make=(language='en',count=3)=>({language,slides:[{id:'stack',title:'A stack',composition:{mode:'column'},blocks:Array.from({length:count},(_,i)=>({id:'b'+i,text:language==='ar'?'نص قصير '+(i+1):language==='ja'?'短い文章 '+(i+1):'Short line '+(i+1)}))}]});
const scene=doc=>{const geometry=composeSlideGeometry(doc,0);return{geometry,scene:slideScene(doc,0,{geometry})};};
const dividers=c=>c.tracks.slice(0,-1).map(t=>t.start+t.length);

test('a centered content-sized column at rest is an exact no-op at every divider and keeps all accepted type',()=>{
 for(const language of ['en','ar','ja'])for(const count of [2,3]){
  const doc=make(language,count),before=scene(doc),s=before.scene,flow=s.flowOf(s.slideKey),container=s.node(s.slideKey).container;
  assert.ok(flow.rows[0].offset>0,'this is genuinely centered with leading space');
  for(let boundary=0;boundary<count-1;boundary++){
   const a=container.tracks[boundary],b=container.tracks[boundary+1];
   const prepared=prepareSceneTrackResize(doc,s,s.slideKey,boundary,a.length/(a.length+b.length));
   assert.equal(prepared.changed,false,language+'/'+count+'/'+boundary+': no edit or history step at rest');
   assert.deepEqual(prepared.presentation,doc);
   const after=scene(prepared.presentation);assert.deepEqual(dividers(after.scene.node(s.slideKey).container),dividers(container));
   assert.deepEqual(after.geometry.items,before.geometry.items,'actual boxes, native text and accepted font sizes stay exact');
  }
 }
});

test('drawn weights allocate both leading and trailing slack, preserving all divider coordinates',()=>{
 for(const language of ['en','ar','ja']){
  const doc=make(language),{scene:s}=scene(doc),flow=s.flowOf(s.slideKey),drawn=drawnTracks(flow);
  const room=flow.box.height-flow.gap*(flow.rows.length-1),sum=drawn.weights.reduce((a,b)=>a+b,0);let used=0;
  for(let i=0;i<flow.rows.length-1;i++){used+=room*drawn.weights[i]/sum;assert.ok(Math.abs(used+flow.gap*i-(flow.rows[i].offset+flow.rows[i].size))<0.01,language+': weighted divider '+i+' remains at its actual physical coordinate');}
 }
});

test('already explicit weighted rows keep their established resize semantics',()=>{
 const doc={slides:[{id:'row',composition:{mode:'row',weights:[2,1]},blocks:[{text:'Left'},{text:'Right'}]}]},s=scene(doc).scene,drawn=drawnTracks(s.flowOf(s.slideKey));
 assert.equal(drawn.drawn,false);assert.deepEqual(drawn.weights,[2,1]);assert.equal(drawn.scale(0),1);
 assert.deepEqual(prepareSceneTrackResize(doc,s,s.slideKey,0,.5).weights,[1,1]);
});

const typeSizes=g=>g.items.filter(i=>i.field==='text').map(i=>i.text.fontSize);
const request=(doc,boundary,delta,options={})=>{const before=scene(doc),s=before.scene,c=s.node(s.slideKey).container,a=c.tracks[boundary],b=c.tracks[boundary+1];return{before,prepared:prepareSceneTrackResize(doc,s,s.slideKey,boundary,a.length/(a.length+b.length)+delta,options)};};
test('allowed outer-slack drags preserve type and every unrelated divider, with free and snapped bounds',()=>{
 for(const language of ['en','ar','ja'])for(const [boundary,delta]of [[0,-.1],[1,.1],[0,-2],[1,2]])for(const free of [false,true]){
  const doc=make(language),{before,prepared}=request(doc,boundary,delta,{free}),after=scene(prepared.presentation);
  assert.equal(prepared.changed,true);assert.deepEqual(typeSizes(after.geometry),typeSizes(before.geometry),'an implicit conversion never makes current text smaller');
  const oldDiv=dividers(before.scene.node(before.scene.slideKey).container),nextDiv=dividers(after.scene.node(after.scene.slideKey).container);
  assert.ok((nextDiv[boundary]-oldDiv[boundary])*Math.sign(delta)>0,'the divider moves in the requested feasible direction');
  for(let i=0;i<oldDiv.length;i++)if(i!==boundary)assert.ok(Math.abs(nextDiv[i]-oldDiv[i])<.004,'an unrelated divider keeps its position');
  assert.deepEqual(prepared.presentation.slides[0].blocks,doc.slides[0].blocks,'every authored word/id/order remains exact');
 }
});
test('the original positive-first request and opposite inner edge refuse to shrink current type',()=>{
 for(const language of ['en','ar','ja'])for(const [boundary,delta]of [[0,.1],[1,-.1],[0,2],[1,-2]]){
  const doc=make(language),copy=structuredClone(doc);assert.throws(()=>request(doc,boundary,delta),error=>error.code==='studio-refused');assert.deepEqual(doc,copy);
 }
});
test('current display-tile compositions cannot convert stale shorter flow tracks into smaller text',()=>{
 const doc=make('en',4),before=scene(doc),s=before.scene,c=s.node(s.slideKey).container;
 assert.equal(before.geometry.items.filter(i=>i.field==='text').length,4);
 const a=c.tracks[0],b=c.tracks[1],rest=prepareSceneTrackResize(doc,s,s.slideKey,0,a.length/(a.length+b.length));
 assert.equal(rest.changed,false);assert.deepEqual(scene(rest.presentation).geometry.items,before.geometry.items);
 let prepared;try{prepared=request(doc,0,-.1).prepared;}catch(error){assert.equal(error.code,'studio-refused');}
 if(prepared)assert.ok(typeSizes(scene(prepared.presentation).geometry).every((size,index)=>size>=typeSizes(before.geometry)[index]),'future corrected track metadata must still preserve current type');
});
test('physical gap midpoint maps to the logical first share for actual LTR and RTL weighted rows',()=>{
 for(const language of ['en','ar']){const doc={language,slides:[{composition:{mode:'row',weights:[2,1]},blocks:[{text:'One'},{text:'Two'}]}]},s=scene(doc).scene,c=s.node(s.slideKey).container,[a,b]=c.tracks,pair=trackPairBounds(a,b),fraction=(pair.at-pair.pairStart)/pair.pairLength;
  assert.ok(Math.abs(fraction-a.length/(a.length+b.length))<1e-9);
  const edge=language==='ar'?(a.start+b.start+b.length)/2:(a.start+a.length+b.start)/2;assert.ok(Math.abs(pair.at-edge)<1e-9);
  assert.equal(Math.sign(pair.pairLength),language==='ar'?-1:1);
 }
});

test('two-track whole-ratio snapping keeps its ratio and skips a snapped no-op before the first nudge',()=>{
 for(const language of ['en','ar','ja']){const doc=make(language,2),tiny=request(doc,0,.001).prepared;assert.equal(tiny.changed,false);assert.deepEqual(tiny.presentation,doc);
  for(const delta of[-.1,.1])for(const free of[false,true]){const{before,prepared}=request(doc,0,delta,{free}),after=scene(prepared.presentation);assert.equal(prepared.changed,true);if(!free)assert.ok(prepared.weights.every(Number.isInteger),'whole-ratio snapping keeps a small integer ratio');
   const old=dividers(before.scene.node(before.scene.slideKey).container)[0],next=dividers(after.scene.node(after.scene.slideKey).container)[0];assert.ok((next-old)*Math.sign(delta)>0,'normalization never reverses the requested direction');
   assert.ok(Math.abs(next-old)<.1,'the two-track first nudge stays bounded');assert.deepEqual(typeSizes(after.geometry),typeSizes(before.geometry));
  }
 }
});

test('an already filled implicit row also keeps exact source and geometry at rest',()=>{
 const doc={slides:[{id:'row',composition:{mode:'row'},blocks:[{text:'Left'},{text:'Right'}]}]},before=scene(doc),c=before.scene.node(before.scene.slideKey).container,[a,b]=c.tracks;
 const prepared=prepareSceneTrackResize(doc,before.scene,before.scene.slideKey,0,a.length/(a.length+b.length));assert.equal(prepared.changed,false);assert.deepEqual(prepared.presentation,doc);assert.deepEqual(scene(prepared.presentation).geometry.items,before.geometry.items);
});
