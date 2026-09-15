import assert from 'node:assert/strict';
import {fitRichText,composeSlide} from '../dist/composition.js';
const box={x:0,y:0,width:240,height:200};
const measurement={measure:(text,size,style)=>Array.from(text).length*size*(style.fontWeight===700?.8:.5),resolveStyle:style=>style.fontFamily==='alias'?{...style,fontFamily:'Resolved'}:style};
const options={style:{fontFamily:'Base',fontWeight:400,path:'slides.0.text'},textMeasurement:measurement};
let checks=0;const check=(value,message)=>{assert.ok(value,message);checks++;};
const input=['Before ',{text:'BOLD',bold:true,fontFamily:'alias',color:'#ff0000'},' after'];
const fit=fitRichText(input,box,20,20,options);
check(fit.richLines.flatMap(line=>line.fragments).some(part=>part.style.fontFamily==='Resolved'&&part.style.fontWeight===700),'Run style resolution');
check(fit.richLines.flatMap(line=>line.fragments).map(p=>p.text).join('')==='Before BOLD after','Content preserved');
check(fit.richLines.every(line=>line.width<=box.width),'Wrapping');
const enlarged=fitRichText([{text:'Large large large',fontSize:36}],box,20,20,options);
check(enlarged.richLines.length>fit.richLines.length,'Point-sized runs affect wrapping');
check(enlarged.richLines[0].fragments[0].fontSize===48,'Point to pixel conversion');
check(fitRichText([{text:'Absolute points',fontSize:12}],{...box,width:1000},40,16,options).richLines[0].fragments[0].fontSize===16,'Explicit points stay absolute when they meet the selected readability floor');
check(fitRichText([{text:'Raised floor',fontSize:12}],{...box,width:1000},40,40,options).richLines[0].fragments[0].fontSize===40,'An explicit larger floor raises the painted run without changing authored point metadata');
const scripts=fitRichText(['H',{text:'2',subscript:true},'O and x',{text:'2',superscript:true}],box,20,20,options);
check(scripts.richLines.flatMap(l=>l.fragments).some(f=>f.baselineShift>0),'Subscript');
check(scripts.richLines.flatMap(l=>l.fragments).some(f=>f.baselineShift<0),'Superscript');
const whitespace=fitRichText([' A  B\n\nC\r\n'],{...box,width:1000},20,20,options);
assert.deepEqual(whitespace.lines,[' A  B','','C','']);checks++;
const unicode=fitRichText(['e\u0301👩‍💻e\u0301'],{...box,width:2},20,20,options);
check(unicode.lines.every(line=>['e\u0301','👩‍💻'].includes(line)),'Never split graphemes');
check(unicode.overflow,'Too-wide grapheme diagnoses overflow');
const noMutation=JSON.stringify(input);fitRichText(input,box);check(JSON.stringify(input)===noMutation,'No mutation');
assert.throws(()=>fitRichText([{text:'bad',fontSize:0}],box),/positive/);checks++;
const boldRows=composeSlide({composition:{mode:'row'},blocks:[{text:[{text:'Big '.repeat(300),fontSize:80}]}]},{width:500,height:300,textMeasurement:measurement});
check(boldRows.items[0].text.richLines.length>0,'Composition stores mixed-style geometry');
check(boldRows.diagnostics.some(d=>d.code==='text-overflow'),'Composition reports actual mixed-style overflow');
console.log(`Rich text passed ${checks} shared-layout checks.`);

const tabs=[{text:'A\t',fontSize:12,color:'#123456'},{text:'\tB\r\n\tC',fontSize:18,underline:true}];
const tabSource=structuredClone(tabs),measured=[];
const tabMeasurement={
  measure(text,size){assert.ok(!/[\r\n\t]/.test(text),'Control whitespace must never reach the font width provider');measured.push(text);return text.length*size/2;},
  outlineBounds(text,size){assert.ok(!/[\r\n\t]/.test(text),'Control whitespace must never reach the font outline provider');return {x:0,y:-size,width:text.length*size/2,height:size};},
};
const tabOptions={style:{fontFamily:'Base',fontWeight:400},textMeasurement:tabMeasurement};
const tabFit=fitRichText(tabs,{x:0,y:0,width:300,height:200},16,16,tabOptions);
assert.deepEqual(tabFit.lines,['A\t\tB','\tC']);
assert.deepEqual(tabFit.richLines.map(line=>line.width),[60,60]);
assert.deepEqual(tabFit.richLines.map(line=>line.fragments.filter(part=>part.kind==='tab').map(part=>part.x+part.width)),[[32,48],[48]],'Stops are relative to the line and use the current run font size');
for(const line of tabFit.richLines)for(const part of line.fragments)assert.equal(part.text,tabs[part.runIndex].text.slice(part.start,part.end));
const wrappedTabs=fitRichText(tabs,{x:0,y:0,width:40,height:500},16,16,tabOptions);
assert.equal(wrappedTabs.lines.join(''),tabs.map(run=>run.text).join('').replace(/\r\n/g,''),'Wrapping retains every original tab');
assert.ok(wrappedTabs.richLines.every(line=>line.width<=40||line.fragments.length===1&&line.fragments[0].kind==='tab'));
const composedTabs=composeSlide({text:tabs},{width:1280,height:720,textMeasurement:tabMeasurement});
assert.ok(composedTabs.items[0].text.richLines.flatMap(line=>line.fragments).some(part=>part.kind==='tab'));
assert.deepEqual(tabs,tabSource);
assert.throws(()=>fitRichText(['\t'],box,20,20,{...tabOptions,textMeasurement:{measure:()=>0}}),/positive finite/);
console.log('Rich tabs preserve source/style boundaries and line-relative stops across wrapping; width and outline providers never receive control tabs.');

// A non-additive provider exposes accidental shaping at source-run boundaries.
const jointCalls=[];
const jointMeasurement={measure(text,size){jointCalls.push(text);return size*(text.length*.5-(text.match(/AV/g)?.length??0)*.2-(text.match(/ffi/g)?.length??0)*.1);}};
const jointOptions={...options,textMeasurement:jointMeasurement};
const split=[{text:'A',color:'#CC2222',link:'https://example.org',underline:true},{text:'V of',color:'#2222CC'},{text:'fice\t tail\r'},{text:'\nA'},{text:'\u0301B'}];
const saved=structuredClone(split),joined=split.map(run=>run.text).join('');
for(const width of [200,82,41]){
 const actual=fitRichText(split,{...box,width,height:1000},20,20,jointOptions);
 const reference=fitRichText([joined],{...box,width,height:1000},20,20,jointOptions);
 assert.deepEqual(actual.lines,reference.lines,'Authored run boundaries cannot change wrapping');
 assert.deepEqual(actual.richLines.map(line=>line.width),reference.richLines.map(line=>line.width));
 for(const line of actual.richLines)for(const part of line.fragments){
  const sources=part.sources??[part];
  assert.equal(part.text,sources.map(source=>source.text).join(''));
  for(const source of sources){
   assert.equal(source.text,split[source.runIndex].text.slice(source.start,source.end));
   assert.equal(source.run,split[source.runIndex],'Source formatting and metadata retain the original run');
  }
 }
}
assert.deepEqual(split,saved);
assert.ok(jointCalls.includes('AV office'));
const isolated=fitRichText([{text:'A'},{text:'V',bold:true},{text:'A',italic:true},{text:'V',superscript:true},{text:'A',fontFamily:'Another'},{text:'V',fontSize:30}],{...box,width:1000},20,20,jointOptions);
assert.equal(isolated.richLines[0].fragments.length,6,'Effective typography changes retain separate contexts');
assert.ok(isolated.richLines[0].fragments.every(part=>!part.sources));
console.log('Cross-run shaping preserves joint widths, wraps, graphemes, tabs, original spans and paint metadata; effective typography changes remain separate.');
