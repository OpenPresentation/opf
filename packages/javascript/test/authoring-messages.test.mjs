// Mistakes whose schema errors used to say nothing about the fix: each is one finding, at the value the author wrote, that says what to write.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validate} from '../dist/index.js';
const errors=doc=>validate(doc,{only:['format']}).findings.filter(f=>f.severity==='error');
const deck=(slide,extra={})=>({name:'Messages',language:'en-US',slides:[{title:'Plan',...slide}],...extra});

test('a shape fill written like a background is one finding with the fix, not an error per branch of the union',()=>{
 for(const [fill,fixed,pattern] of [[{type:'solid',color:'accent1'},'accent1',/solid fill is the color itself.*"fill": "accent1"/],[{color:'#1E40AF'},'#1E40AF',/"fill": "#1E40AF"/]]){
  for(const slide of [{blocks:[{shape:'rect',text:'Plan',fill}]},{text:'Body',shapes:[{shape:'rect',x:.1,y:.1,width:.2,height:.1,fill}]}]){
   const found=errors(deck(slide));assert.equal(found.length,1,JSON.stringify(found.map(f=>[f.path,f.message])));
   const [finding]=found;assert.match(finding.path,/\/fill$/);assert.match(finding.message,pattern);assert.match(finding.help,/only a slide background takes/);
   assert.deepEqual(finding.fixes[0].patch,[{op:'replace',path:finding.path,value:fixed}]);
  }
 }
 const typed=errors(deck({blocks:[{shape:'rect',text:'Plan',fill:{type:'gradient',gradient:{stops:[{color:'accent1',position:0},{color:'accent2',position:1}]}}}]}));
 assert.equal(typed.length,1);assert.match(typed[0].message,/has no "type"/);assert.deepEqual(typed[0].fixes[0].patch,[{op:'remove',path:'/slides/0/blocks/0/fill/type'}]);
 // A real fill mistake that is not this one keeps its own errors, and a valid fill has none.
 assert.ok(errors(deck({blocks:[{shape:'rect',text:'Plan',fill:{gradient:{stops:[]}}}]})).length);
 for(const fill of ['accent1','none',{color:'accent1',lighten:.4},{gradient:{stops:[{color:'accent1',position:0},{color:'accent2',position:1}]}}])assert.deepEqual(errors(deck({blocks:[{shape:'rect',text:'Plan',fill}]})),[]);
});

test('a background no form accepts names the forms and the types, not schema definitions',()=>{
 for(const [background,message] of [[{type:'color',color:'accent1'},/"color" is not a background type/],[{color:'accent1'},/needs a "type"/],[42,/not a background OPF can read/]]){
  const found=errors(deck({text:'Body'},{design:{background}}));assert.equal(found.length,1,JSON.stringify(found.map(f=>f.message)));
  assert.equal(found[0].path,'/design/background');assert.match(found[0].message,message);assert.match(found[0].help,/"theme", "solid", "gradient", "image", "pattern"/);assert.doesNotMatch(found[0].message+found[0].help,/BackgroundShortcut/);
 }
 assert.equal(errors(deck({text:'Body',design:{background:{type:'solid'}}})).some(f=>/BackgroundShortcut/.test(f.message)),false);
});

test('type list beside bullets is one finding that says what to write',()=>{
 for(const [slide,path] of [[{blocks:[{type:'list',bullets:['Ship v2','Hire two engineers']}]},'/slides/0/blocks/0'],[{type:'list',bullets:['Ship v2']},'/slides/0']]){
  const found=errors(deck(slide));assert.equal(found.length,1,JSON.stringify(found.map(f=>f.message)));
  assert.equal(found[0].path,path);assert.match(found[0].message,/'bullets' belongs to a text payload.*'items'.*remove 'type'/);assert.match(found[0].help,/"items"/);
 }
 // A list type with nothing at all still says what it requires.
 assert.ok(errors(deck({blocks:[{type:'list'}]})).some(f=>/requires 'items'/.test(f.message)));
});

test('a failed if/then reports its then-error once; a dependent key says both ways out; a short enum lists its values',()=>{
 const noRaw=found=>assert.equal(found.some(f=>/must match "then" schema/.test(f.message)),false,JSON.stringify(found.map(f=>f.message)));
 noRaw(errors(deck({blocks:[{type:'chart'}]})));noRaw(errors(deck({blocks:[{type:'list',bullets:['a']}]})));
 const dependent=errors(deck({chart:{type:'column',data:{columns:['Q','A'],rows:[['Q1',1],['Q2',2]]},referenceLines:[{value:1,labelPosition:'start'}]}}));
 assert.equal(dependent.length,1);assert.match(dependent[0].help,/"labelPosition" only applies together with "label": add "label", or remove "labelPosition"/);
 const anchor=errors(deck({text:'Body',chart:undefined,blocks:[{id:'c',chart:{type:'column',data:{columns:['Q','A'],rows:[['Q1',1],['Q2',2]]}}}],shapes:[{shape:'ellipse',at:{block:'c',edge:'end',series:0}}]}));
 assert.ok(anchor.some(f=>/"series" only applies together with "point"/.test(f.help)),JSON.stringify(anchor.map(f=>f.help)));
 const legend=errors(deck({chart:{type:'column',legend:'bottom-right',data:{columns:['Q','A'],rows:[['Q1',1]]}}}));
 assert.equal(legend.length,1);assert.match(legend[0].help,/Use one of: "none", "top", "bottom", "left", "right"\./);
});

test('an option on the wrong kind of content says where it belongs',()=>{
 const found=errors(deck({blocks:[{image:{src:'./a.png',alt:'A'},shadow:'soft',alt:'Photo'},{text:'Body',fit:'cover'}],caption:undefined}));
 const help=path=>found.find(f=>f.path===path)?.help??'';
 assert.match(help('/slides/0/blocks/0/shadow'),/shape block .* or an overlay shape/);
 assert.match(help('/slides/0/blocks/0/alt'),/alt text goes inside its image object/);
 assert.match(help('/slides/0/blocks/1/fit'),/put it on an image block/);
 const caption=errors(deck({text:'Short',caption:'Not here'}));assert.match(caption.find(f=>f.path==='/slides/0/caption').help,/image, chart, table, video or diagram/);
});
