import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validate} from '../dist/index.js';
import {composeSlide} from '../dist/composition.js';
const shape={id:'glow',shape:'ellipse',x:0.2692,y:-0.1,width:0.42,height:0.75,fill:{color:'accent2',darken:0.2},stroke:'none',layer:'back',decorative:true,opacity:0.45,softEdge:60};
const deck=shapes=>({name:'Bleed',language:'en-US',slides:[{title:'Slide',shapes}]});
test('negative origins and positions beyond 1 are valid, while dimensions retain their limits',()=>{
 for(const [x,y] of [[0.2692,-0.1],[-0.1,0.2],[1.05,0.2],[0.2,1.05]])assert.equal(validate(deck([{...shape,x,y}])).findings.filter(f=>f.severity==='error').length,0);
 for(const [key,value] of [['width',-0.1],['height',1.1],['x',NaN],['y',Infinity]])assert.ok(validate(deck([{...shape,[key]:value}])).findings.filter(f=>f.severity==='error').length,key+' rejects '+value);
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
