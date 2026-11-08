import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {composeSlide,layoutCode,LONE_DISPLAY_SIZES} from '../dist/composition.js';
import {gallery} from '@openpresentation/gallery';
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/lh-101-mixed-code.json',import.meta.url),'utf8'));
const options=direction=>({direction,fontFamilies:{body:'Original body',heading:'Original heading',code:'Original code'},textMeasurement:{measure:(text,size,style)=>[...text].length*size*(style.fontFamily==='Original code'?.6:.45)}});
const panel=r=>r.items.find(i=>i.codeLayout),body=r=>panel(r).codeLayout.parts.find(p=>p.role==='body');
function sourceIntegrity(part){
 const source=part.text,fit=part.fit;let cursor=0,reconstructed='';
 for(const [index,line]of fit.sourceLines.entries()){
  assert.equal(line.start,cursor);assert.equal(fit.lines[index],source.slice(line.start,line.end));reconstructed+=source.slice(line.start,line.nextStart);cursor=line.nextStart;
  for(const segment of line.segments){assert.ok(segment.start>=line.start&&segment.end<=line.end);assert.equal(segment.kind==='tab'?source.slice(segment.start,segment.end):source.slice(segment.start,segment.end).includes('\t'),segment.kind==='tab'?'\t':false);assert.ok(Number.isFinite(segment.x)&&Number.isFinite(segment.width));}
 }
 assert.equal(reconstructed,source);assert.equal(cursor,source.length);
 assert.deepEqual(fit.lines.join(' ').trim().split(/\s+/u),source.trim().split(/\s+/u),'wrapped lines never split a whitespace-delimited source token');
}
for(const fixture of fixtures)for(const direction of['ltr','rtl'])test('short mixed code grows in its settled row '+fixture.id+'/'+direction,()=>{
 const slide=structuredClone(fixture.slide),original=JSON.stringify(slide),before=composeSlide(slide,{...options(direction),fill:false}),after=composeSlide(slide,options(direction));
 assert.deepEqual(after.diagnostics,[]);assert.equal(JSON.stringify(slide),original);assert.equal(body(after).fit.fontSize,fixture.id==='overview-dynamic'?56:26);assert.ok(body(after).fit.fontSize>body(before).fit.fontSize);
 assert.deepEqual(panel(after).box,panel(before).box,'the code frame and authored row weights stay exact');assert.deepEqual(panel(after).value,panel(before).value);
 assert.deepEqual(after.items.filter(i=>!i.codeLayout),before.items.filter(i=>!i.codeLayout),'notes, all headings and their complete geometry/styles are unchanged');
 for(const key of['composition','contentBox','flows','titleRule','design'])assert.deepEqual(after[key],before[key],key);
 for(const part of panel(after).codeLayout.parts){const old=panel(before).codeLayout.parts.find(p=>p.path===part.path);assert.equal(part.text,old.text);assert.deepEqual(part.sources,old.sources);assert.deepEqual(part.style,old.style);assert.ok(part.fit.fontSize>=old.fit.fontSize);sourceIntegrity(part);assert.ok(part.box.y>=panel(after).box.y-.01&&part.box.y+part.box.height<=panel(after).box.y+panel(after).box.height+.01);}
});
test('tabs, CRLF, blank lines, trailing newline and exact source offsets survive an active growth trial',()=>{
 const slide=structuredClone(fixtures[1].slide);slide.blocks[0].code.source='\tlet x = 1;\r\n\tuse(x);\n\n  done();\n';const r=composeSlide(slide,options('ltr'));assert.deepEqual(r.diagnostics,[]);assert.ok(body(r).fit.fontSize>22);sourceIntegrity(body(r));assert.equal(body(r).text,slide.blocks[0].code.source);assert.ok(body(r).fit.sourceLines.flatMap(l=>l.segments).some(s=>s.kind==='tab'));
});
test('explicit gap and row weights keep the exact settled note and panel frames',()=>{
 const slide=structuredClone(fixtures[0].slide);slide.composition.gap=.02;const before=composeSlide(slide,{...options('ltr'),fill:false}),after=composeSlide(slide,options('ltr'));assert.equal(after.composition.gap,.02);assert.deepEqual(after.composition.weights,[3,2]);assert.deepEqual(after.items.filter(i=>!i.codeLayout),before.items.filter(i=>!i.codeLayout));assert.deepEqual(panel(after).box,panel(before).box);assert.ok(body(after).fit.fontSize>22);
});
test('author minimum, maximum and fill:false keep the existing code size',()=>{
 for(const settings of[{minFontSize:18},{maxFontSize:24}]){const slide=structuredClone(fixtures[0].slide);Object.assign(slide.composition,settings);const a=composeSlide(slide,options('ltr')),b=composeSlide(slide,{...options('ltr'),fill:false});assert.deepEqual(a.items,b.items);}
 const off=composeSlide(fixtures[0].slide,{...options('ltr'),fill:false});assert.equal(body(off).fit.fontSize,22);
});
test('pinned layout-code and vertical rows do not acquire the mixed-panel treatment',()=>{
 const slide=structuredClone(fixtures[0].slide);slide.layout='code';slide.blocks[0].region='code';slide.blocks[1].region='notes';const pinned=composeSlide(slide,{...options('ltr'),layout:gallery.layouts.code});assert.ok(pinned.regions);assert.equal(body(pinned).fit.fontSize,22);assert.ok(panel(pinned).box.height<300);
 const column=structuredClone(fixtures[0].slide);column.composition={mode:'column'};const r=composeSlide(column,options('ltr'));assert.ok(body(r).fit.fontSize<=22);
});
test('over-capacity code remains explicit and retains its complete source',()=>{
 const slide=structuredClone(fixtures[1].slide);slide.blocks[0].code.source='  run(workstream);\n'.repeat(50);const r=composeSlide(slide,options('ltr'));assert.ok(r.diagnostics.some(d=>d.code==='text-overflow'));assert.equal(panel(r).value.source,slide.blocks[0].code.source);assert.ok(body(r).fit.fontSize>=16);
});
test('public layoutCode and the lone-code display ceiling remain 32px',()=>{
 assert.equal(LONE_DISPLAY_SIZES.code,32);const r=layoutCode({source:'first();\nnext();',filename:'sample.ts',language:'ts'},{x:0,y:0,width:1000,height:600},{growth:100});assert.equal(r.parts.find(p=>p.role==='body').fit.fontSize,32);
});
test('a measurement failure during a growth trial propagates instead of hiding the failure',()=>{
 const o=options('ltr'),measure=o.textMeasurement.measure;o.textMeasurement.measure=(text,size,style)=>{if(style.fontFamily==='Original code'&&size>30)throw new Error('deliberate growth measurement failure');return measure(text,size,style);};assert.throws(()=>composeSlide(fixtures[0].slide,o),/deliberate growth measurement failure/u);
});
