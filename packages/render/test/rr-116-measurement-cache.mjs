import assert from 'node:assert/strict';
import {loadFonts} from '../dist/fonts-node.js';

const fonts=await loadFonts({strictGlyphs:false}),registry=fonts.registry;
const calls=[];
let multiplier=1;
registry.setShaper({shape(face,text,options){
  calls.push({family:face.family,weight:face.weight,text,...options});
  const direction=options.direction==='rtl'?2:options.direction==='ltr'?1:3;
  const language=options.lang==='ar'?0.1:options.lang==='en'?0.2:0;
  return [{gid:0,advance:face.font.unitsPerEm*(direction+language)*multiplier,xOffset:0,yOffset:0}];
}});
const style={fontFamily:'Roboto',fontWeight:400};
const measure=(text,extra={},size=16)=>registry.textMeasurement.measure(text,size,{...style,...extra});
const outline=(text,extra={})=>registry.textMeasurement.outlineBounds(text,16,{...style,...extra});
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);

for(const [text,direction] of [
  ['Hello world','ltr'],['مرحبا بالعالم','rtl'],['مرحبا\nHello','rtl'],
  ['Hello\nمرحبا','ltr'],['\u2067مرحبا\u2069 Hello','ltr'],['','ltr'],
]){
  const before=calls.length;
  near(measure(text),direction==='rtl'?32:16);
  assert.equal(calls.at(-1).direction,direction);
  near(measure(text),direction==='rtl'?32:16);
  assert.equal(calls.length,before+1,'Repeated equivalent measurements reuse the shaped result');
  near(measure(text,{},32),direction==='rtl'?64:32);
  assert.equal(calls.length,before+1,'Font size scaling reuses unit metrics');
}
console.log('PASS automatic direction, paragraph/isolate boundaries and cached size scaling');

const rtl='مرحبا override';
near(measure(rtl),32);
near(measure(rtl,{direction:'ltr'}),16);
near(measure(rtl,{direction:'rtl'}),32);
near(measure(rtl,{direction:'auto'}),48);
near(measure(rtl),32);
near(measure(rtl,{direction:'auto'}),48);
near(measure(rtl,{direction:'ltr',lang:'ar'}),17.6);
near(measure(rtl,{direction:'ltr',lang:'en'}),19.2);
console.log('PASS independent explicit direction and language requests, including untyped host values');

const beforeOutline=calls.length;
near(measure('outline upgrade'),16);
assert.ok(outline('outline upgrade'));
assert.equal(calls.length,beforeOutline+2,'A width-only result upgrades its outline once');
near(measure('outline upgrade'),16);
assert.ok(outline('outline upgrade'));
assert.equal(calls.length,beforeOutline+2,'Subsequent width and outline requests reuse the upgrade');
console.log('PASS width-to-outline upgrade and subsequent reuse');

const beforeFaces=calls.length;
near(measure('independent faces',{fontWeight:400}),16);
near(measure('independent faces',{fontWeight:700}),16);
assert.equal(calls.length,beforeFaces+2);
assert.deepEqual(calls.slice(-2).map(call=>call.weight),[400,700]);
const oldFace=registry.exportFaces().find(face=>face.family==='Roboto');
registry.addFaces([{family:'Host Alternate',weight:400,data:oldFace.data}]);
near(measure('independent faces',{fontFamily:'Host Alternate'}),16);
assert.equal(calls.at(-1).family,'Host Alternate');
console.log('PASS per-face caches and added caller-face selection');

const retained='oldest bounded cache entry';
measure(retained);
for(let i=0;i<600;i++)measure('entry-'+i);
let before=calls.length;measure(retained);assert.equal(calls.length,before+1,'Old measurements are evicted at the existing bound');
const long='a'.repeat(2049);before=calls.length;measure(long);measure(long);assert.equal(calls.length,before+2,'Long inputs are not retained');
multiplier=2;
registry.setShaper({shape(face,text,options){calls.push({text,...options});return[{gid:0,advance:face.font.unitsPerEm*multiplier,xOffset:0,yOffset:0}];}});
before=calls.length;near(measure(retained),32);assert.equal(calls.length,before+1,'Changing shaping engines invalidates old metrics');
console.log('PASS bounded eviction, unretained long inputs and shaper-reset invalidation');
