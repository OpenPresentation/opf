import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {composeSlide} from '../dist/composition.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/lh-10-reading-measure.json',import.meta.url),'utf8'));
const body=result=>result.items.filter(item=>item.field==='text');
const options=(scale=1,advance=.4)=>({width:1280*scale,height:720*scale,layout:fixture.layout,fontFamilies:{body:'Narrow test face',heading:'Narrow test heading'},textMeasurement:{measure:(text,size)=>[...text].length*size*advance}});
for(const scale of [.75,1,1.5])for(const advance of [.4,.42])test('under-capacity body keeps settled type while wrapping at70chars '+scale+'/'+advance,()=>{
 const source=structuredClone(fixture.slide),frozen=JSON.stringify(source),result=composeSlide(source,options(scale,advance));
 assert.deepEqual(result.diagnostics,[]);assert.equal(JSON.stringify(source),frozen,'authored content is not rewritten');
 for(const item of body(result)){
  assert.ok(item.text.lines.every(line=>line.trim().length<=70),item.path+' reading measure');
  const block=source.blocks[Number(/blocks\.(\d+)/.exec(item.path)[1])],size=item.eyebrow?20:item.emphasis?28:advance===.4?32:scale===.75?28:30;
  assert.ok(item.text.fontSize>=size*scale-.02,item.path+' does not shrink');
  assert.equal(item.text.lines.join('').replace(/\s+/g,' ').trim(),block.text.replace(/\s+/g,' ').trim(),'all authored words remain in order');
  assert.ok(item.box.y>=result.contentBox.y-.01&&item.box.y+item.box.height<=result.height-result.contentBox.y+.01,'retained content stays on slide');
 }
 const paragraphs=body(result).filter(item=>!item.eyebrow&&!item.emphasis);assert.ok(paragraphs[0].text.lines.length>=3);assert.ok(paragraphs.at(-1).text.lines.length>=3);
});
test('source rich runs stay rich at their settled size and retain their authored text',()=>{
 const source=structuredClone(fixture.slide),text=source.blocks[0].text;source.blocks[0].text=[{text:text.slice(0,42)},{text:text.slice(42),bold:true,lang:'en-US'}];const result=composeSlide(source,options()),item=body(result)[0];
 assert.equal(item.text.fontSize,32);assert.ok(item.text.richLines);assert.deepEqual(item.value,source.blocks[0].text);assert.equal(item.text.lines.join(''),text);assert.ok(item.text.lines.every(line=>line.trim().length<=70));
});
test('authored narrow columns and short content retain their row arrangement and complete text',()=>{
 const source={composition:{mode:'row'},blocks:[{text:'Scope and ownership stay clear.'},{text:'Each team can explain the next decision.'}]},result=composeSlide(source,options());
 assert.deepEqual(result.diagnostics,[]);const items=body(result);assert.equal(items.length,2);assert.ok(items[0].box.x<items[1].box.x);for(const [i,item]of items.entries())assert.equal(item.text.lines.join(''),source.blocks[i].text);
});
test('an explicit authored gap stays exact during active reading-measure reflow',()=>{
 for(const gap of [.02,1/30]){
  const source=structuredClone(fixture.slide);source.composition={gap};const result=composeSlide(source,options(1,.42));assert.deepEqual(result.diagnostics,[]);assert.ok(body(result).every(item=>item.text.lines.every(line=>line.trim().length<=70)));
  const frames=[...new Map(body(result).filter(item=>item.frameBox).map(item=>[item.frameBox.y,item.frameBox])).values()].sort((a,b)=>a.y-b.y);assert.equal(frames.length,3);
  for(let i=1;i<frames.length;i++)assert.ok(Math.abs(frames[i].y-frames[i-1].y-frames[i-1].height-gap*720)<.001,'authored gap must not be compressed');
 }
});
