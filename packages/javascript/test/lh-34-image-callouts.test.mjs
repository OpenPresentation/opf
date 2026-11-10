import assert from 'node:assert/strict';
import test from 'node:test';
import {composeSlide,PROSE_NOMINAL_SIZE,OPFCompositionError} from '../dist/composition.js';
import {fromMarkdown,toMarkdown} from '../dist/markdown.js';
import {promoteImage} from '../dist/convert.js';
import {check} from './support/validation.mjs';
const src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#2383a0"/></svg>');
const callouts=[{text:'Current words',x:.1,y:.15,width:.65,height:.3},{text:'Second label',x:.5,y:.6,width:.45,height:.3}];
const slide=(value=callouts,extra={})=>({blocks:[{type:'image',image:{src,alt:'A diagram',callouts:value},...extra}]});
const image=(value,options={})=>composeSlide(value,{width:1280,height:720,...options}).items.find(item=>item.image).image;
const near=(a,b)=>assert.ok(Math.abs(a-b)<.002,`${a} = ${b}`);
test('callouts belong to content image payloads, not logos, videos or reusable resources',()=>{
  assert.equal(check({slides:[slide()]}).valid,true);
  assert.equal(check({slides:[{image:{src,callouts}}]}).valid,true);
  for(const document of [{assets:{photo:{src,callouts}},slides:[{text:'Control'}]},{slides:[{video:{src,callouts}}]},{organization:{id:'control',name:'Control',logo:{src,callouts}},slides:[{text:'Control'}]}]){const plain=JSON.parse(JSON.stringify(document, (key,value)=>key==='callouts'?undefined:value));assert.equal(check(plain).valid,true);assert.equal(check(document).valid,false);}
  for(const patch of [{width:0},{height:-1},{x:NaN},{y:Infinity},{height:1.1},{width:Infinity},{text:['rich is not plain']},{unknown:'invalid'}])assert.equal(check({slides:[slide([{...callouts[0],...patch}])]}).valid,false);
  assert.throws(()=>image(slide([{...callouts[0],width:0}])),/Callouts need/);
});
test('one through nine callouts use physical fractions of the visible image frame across fit, masks, scale and direction',()=>{
  for(const count of [1,2,3,9])for(const scale of [.5,1,2])for(const direction of ['ltr','rtl'])for(const fit of ['contain','cover','stretch']){
    const values=Array.from({length:count},(_,index)=>({text:`Label ${index+1}`,x:(index%3)/3,y:Math.floor(index/3)/3,width:1/3,height:1/3}));
    const out=image(slide(values,{fit,shape:'roundRect'}),{width:1280*scale,height:720*scale,direction});
    assert.equal(out.callouts.length,count);const frame=out.calloutFrame;assert.deepEqual(frame,fit==='contain'?out.picture.image:out.box);
    for(const [index,label]of out.callouts.entries())for(const key of ['x','y','width','height']){
      const expected=key==='x'?frame.x+frame.width*values[index].x:key==='y'?frame.y+frame.height*values[index].y:frame[key]*values[index][key];near(label.box[key],expected);
    }
    for(const label of out.callouts)assert.ok(label.fit.fontSize>=PROSE_NOMINAL_SIZE*scale-1e-9);
  }
});
test('type grows when there is room; genuinely undersized labels preserve all words and report overflow',()=>{
  const unknown=image({image:{src:'unavailable.png',callouts}});assert.deepEqual(unknown.calloutFrame,unknown.box);
  const normal=image(slide([{text:'Large label',x:0,y:0,width:1,height:.8}]));assert.ok(normal.callouts[0].fit.fontSize>PROSE_NOMINAL_SIZE);
  const tiny=composeSlide(slide([{text:'Every word is retained in this small box.',x:.95,y:.9,width:.5,height:.02}]),{width:1280,height:720});
  assert.ok(tiny.diagnostics.some(item=>item.code==='text-overflow'&&item.path.endsWith('callouts.0')));
  const label=tiny.items.find(item=>item.image).image.callouts[0];assert.ok(label.fit.fontSize>=PROSE_NOMINAL_SIZE);assert.equal(label.text,'Every word is retained in this small box.');
  assert.throws(()=>composeSlide({...slide([{text:'Overflow remains explicit',x:.95,y:.9,width:.5,height:.02}]),composition:{overflow:'error'}},{width:1280,height:720}),OPFCompositionError);
  const blank=image(slide([{text:'',x:0,y:0,width:.5,height:.5}]));assert.equal(blank.callouts[0].text,'');assert.ok(blank.callouts[0].fit.lines.length>=1);
});
test('ordinary images keep exact composition; Markdown is lossless and image promotion declares the loss',()=>{
  const plain=slide();delete plain.blocks[0].image.callouts;
  const empty=slide([]);const before=image(plain),after=image(empty);delete after.callouts;assert.deepEqual(after,before);
  const document={slides:[slide()]};assert.deepEqual(fromMarkdown(toMarkdown(document).markdown).presentation,document);
  const promoted=promoteImage(slide(),['blocks',0],'background');assert.ok(JSON.stringify(promoted).includes('callouts'));
});

test('signed annotation origins intentionally cross image/slide edges without changing the image or text size',()=>{
 const values=[{text:'Left top',x:-.2,y:-.2,width:.45,height:.3},{text:'Right',x:1.1,y:.1,width:.45,height:.3},{text:'Below',x:.1,y:1.1,width:.45,height:.3}];
 assert.equal(check({slides:[slide(values)]}).valid,true);
 const boxes=[];for(const direction of ['ltr','rtl']){
  const current={...slide(values),composition:{overflow:'error'}},result=composeSlide(current,{width:1280,height:720,direction}),out=result.items.find(item=>item.image).image,plain=image(slide([]),{direction});
  assert.deepEqual(out.box,plain.box);assert.deepEqual(out.picture,plain.picture);assert.equal(result.diagnostics.some(d=>d.code==='text-overflow'),false);
  for(const [index,label]of out.callouts.entries()){near(label.box.x,out.calloutFrame.x+out.calloutFrame.width*values[index].x);near(label.box.y,out.calloutFrame.y+out.calloutFrame.height*values[index].y);assert.equal(label.text,values[index].text);assert.ok(label.fit.fontSize>=PROSE_NOMINAL_SIZE);}
  boxes.push(out.callouts.map(c=>c.box));
 }assert.deepEqual(boxes[0],boxes[1],'physical image coordinates do not mirror in RTL');
 for(const value of [-1e300,1e300])assert.throws(()=>image(slide([{...values[0],x:value}])),/safe integer native coordinate/);
 assert.equal(check({slides:[slide(values,{focus:{x:-.1,y:.5}})]}).valid,false,'normalized image focus stays bounded');
 const gradient=position=>({slides:[{shapes:[{shape:'rect',x:0,y:0,width:.2,height:.2,fill:{gradient:{stops:[{position,color:'#000000'},{position:1,color:'#FFFFFF'}]}}}]}]});
 assert.equal(check(gradient(0)).valid,true);assert.equal(check(gradient(-.1)).valid,false,'gradient stops stay bounded');
});

test('nonfinite annotation origins are located format errors without layout or font loading',()=>{
 for(const key of ['x','y'])for(const value of [NaN,Infinity,-Infinity]){
  let fonts=0;const report=check({slides:[slide([{...callouts[0],[key]:value}])]}, {fonts:{textMeasurement:()=>{fonts++;throw Error('must remain lazy');}}});
  assert.equal(report.valid,false);assert.ok(report.findings.some(f=>f.path==='/slides/0/blocks/0/image/callouts/0/'+key&&/finite signed fraction/.test(f.message)));assert.equal(report.checks.layout,'not-run');assert.equal(fonts,0);
 }
});
