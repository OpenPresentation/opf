import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validate} from '../dist/index.js';
import {composeSlide} from '../dist/composition.js';
const shape={id:'glow',shape:'ellipse',x:0.2692,y:-0.1,width:0.42,height:0.75,fill:{color:'accent2',darken:0.2},stroke:'none',layer:'back',decorative:true,opacity:0.45,softEdge:60};
const deck=shapes=>({name:'Bleed',language:'en-US',slides:[{title:'Slide',shapes}]});
test('signed origins and oversized dimensions are valid, while negative or unrepresentable dimensions refuse',()=>{
 for(const [x,y] of [[0.2692,-0.1],[-0.1,0.2],[1.05,0.2],[0.2,1.05]])assert.equal(validate(deck([{...shape,x,y}])).findings.filter(f=>f.severity==='error').length,0);
 assert.equal(validate(deck([{...shape,width:1.2,height:1.6}]),{only:['format']}).valid,true);
 for(const [key,value] of [['width',-0.1],['height',Infinity],['x',NaN],['y',Infinity]])assert.ok(validate(deck([{...shape,[key]:value}])).findings.filter(f=>f.severity==='error').length,key+' rejects '+value);
});
test('the reported ellipse retains its off-slide box and never moves content',()=>{
 const doc=deck([shape]);const options={width:1280,height:720,presentation:doc};
 const before=composeSlide({...doc.slides[0],shapes:[]},options),after=composeSlide(doc.slides[0],options);
 assert.deepEqual(after.overlayShapes[0].box,{x:344.576,y:-72,width:537.6,height:540});
 assert.deepEqual(after.items,before.items);
});
test('RTL mirrors the signed origin without pulling it inside',()=>{
 const doc=deck([{...shape,x:-0.1,width:0.2}]);
 const result=composeSlide(doc.slides[0],{width:1280,height:720,presentation:doc,direction:'rtl'});
 assert.deepEqual(result.overlayShapes[0].box,{x:1152,y:-72,width:256,height:540});
});

test('finite but unrepresentable origins refuse at the coordinate, before invalid geometry or native output',()=>{
 for(const key of ['x','y'])for(const value of [1e300,-1e300,1e20,-1e20]) {
  const doc=deck([{...shape,[key]:value}]);const result=validate(doc,{only:['format']});
  assert.ok(result.findings.some(f=>f.severity==='error'&&f.path==='/slides/0/shapes/0/'+key&&/safe integer native coordinate/.test(f.message)),key+' '+value);
  // RR-105: composition reports it at the coordinate and leaves the shape out; validation refuses the document (above).
  const composed=composeSlide(doc.slides[0],{presentation:doc});assert.equal(composed.overlayShapes,undefined);assert.ok(composed.diagnostics.some(d=>d.code==='unresolved-content'&&d.path==='slides.0.shapes.0.'+key));
 }
 for(const value of [-1000,1000]){const doc=deck([{...shape,x:value,y:value}]);assert.equal(validate(doc,{only:['format']}).valid,true);const box=composeSlide(doc.slides[0],{presentation:doc}).overlayShapes[0].box;assert.ok(Object.values(box).every(Number.isFinite));}
 for(const value of [NaN,Infinity,-Infinity]){const doc=deck([{...shape,x:value}]),composed=composeSlide(doc.slides[0],{presentation:doc});assert.equal(composed.overlayShapes,undefined);assert.ok(composed.diagnostics.some(d=>d.code==='unresolved-content'&&d.path==='slides.0.shapes.0.x'));}
});
test('representability uses actual deck/theme dimensions and deck size overrides',()=>{
 const doc=deck([{...shape,x:1e9}]);doc.design={dimensions:{widthInches:5,heightInches:7.5}};
 assert.equal(validate(doc,{only:['format']}).valid,true);
 doc.design.dimensions.widthInches=10;assert.equal(validate(doc,{only:['format']}).valid,false);
 doc.design={theme:'narrow'};doc.catalogs={custom:{themes:{narrow:{name:'Narrow',dimensions:{widthInches:5,heightInches:7.5}}}}};
 assert.equal(validate(doc,{only:['format']}).valid,true);
 doc.design.dimensions={widthInches:10,heightInches:7.5};assert.equal(validate(doc,{only:['format']}).valid,false);
});

test('fractional format validation resolves dimensions without layout or font requests',()=>{
 let requests=0;const doc=deck([{...shape,x:-.2,y:1.1}]);
 const report=validate(doc,{only:['format'],fonts:{textMeasurement:()=>{requests++;throw Error('format-only must stay lazy');}}});
 assert.equal(report.valid,true);assert.equal(report.checks.layout,'not-run');assert.equal(requests,0);
});
