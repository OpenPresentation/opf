import assert from 'node:assert/strict';
import {fitRichText,composeSlide} from '../dist/composition.js';

const calls=[];
const measurement={
  resolveStyle:style=>({...style}),
  measure(text,size,style){
    assert.ok(!/[\t\r\n]/u.test(text),`layout control reached measurement: ${JSON.stringify(text)}`);
    calls.push({text,size,weight:style.fontWeight,italic:!!style.italic,path:style.path});
    if(text===' ')return size*.25;
    return Array.from(text).length*size*(style.fontWeight===700?.75:.5);
  },
  outlineBounds(text,size,style){
    assert.ok(!/[\t\r\n]/u.test(text),`layout control reached outline measurement: ${JSON.stringify(text)}`);
    return text.length?{x:0,y:-size*.8,width:measurement.measure(text,size,style),height:size}:null;
  },
};
const options={style:{fontFamily:'Carlito',fontWeight:400,path:'slides.0.table.rows.0.0'},textMeasurement:measurement,uniformLineHeight:true};
const wide={x:0,y:0,width:1000,height:500};

const edgeRuns=[{text:'\tA\t\t',fontSize:18},{text:'B',fontSize:30,bold:true}];
const edge=fitRichText(edgeRuns,wide,18,18,options);
const edgeFragments=edge.richLines[0].fragments;
assert.deepEqual(edgeFragments.map(({kind,text,x,width,runIndex,start,end,fontSize})=>({kind,text,x,width,runIndex,start,end,fontSize})),[
  {kind:'tab',text:'\t',x:0,width:24,runIndex:0,start:0,end:1,fontSize:24},
  {kind:undefined,text:'A',x:24,width:12,runIndex:0,start:1,end:2,fontSize:24},
  {kind:'tab',text:'\t',x:36,width:12,runIndex:0,start:2,end:3,fontSize:24},
  {kind:'tab',text:'\t',x:48,width:24,runIndex:0,start:3,end:4,fontSize:24},
  {kind:undefined,text:'B',x:72,width:30,runIndex:1,start:0,end:1,fontSize:40},
]);
assert.equal(edge.lines.join(''),edgeRuns.map(run=>run.text).join(''));
assert.equal(fitRichText([{text:'A\t',fontSize:18}],wide,18,18,options).richLines[0].fragments.at(-1).kind,'tab');

const utf16=fitRichText([{text:'😀\tZ',fontSize:18}],wide,18,18,options).richLines[0].fragments;
assert.deepEqual(utf16.map(({text,start,end})=>({text,start,end})),[
  {text:'😀',start:0,end:2},{text:'\t',start:2,end:3},{text:'Z',start:3,end:4},
]);

const mixedScripts=[{text:'e\u0301مرحبا',fontSize:18},{text:'\t',fontSize:30},{text:'漢字😀',fontSize:18}];
const mixedScriptFragments=fitRichText(mixedScripts,wide,18,18,options).richLines.flatMap(line=>line.fragments);
assert.equal(mixedScriptFragments.map(fragment=>fragment.text).join(''),mixedScripts.map(run=>run.text).join(''));
assert.deepEqual(mixedScriptFragments.filter(fragment=>fragment.kind==='tab').map(({runIndex,start,end})=>({runIndex,start,end})),[{runIndex:1,start:0,end:1}]);

const scripted=fitRichText([{text:'X'},{text:'\t',superscript:true}],wide,20,14,options).richLines[0].fragments;
assert.equal(scripted[1].kind,'tab');
assert.equal(scripted[1].fontSize,14);
assert.equal(scripted[1].baselineShift,-7);
assert.equal(scripted[1].x,10);
assert.equal(scripted[1].width,4);

const fixtureRuns=[
  {text:'Lead\t',fontSize:18},
  {text:'Large evidence phrase ',fontSize:30,bold:true},
  {text:'continues in smaller text across the same editable table cell so natural layout must wrap this sentence without authored line breaks or inserted offsets. ',fontSize:18},
  {text:'Second large phrase ',fontSize:30},
  {text:'finishes the control with exact source runs.',fontSize:18},
];
const fixtureText=fixtureRuns.map(run=>run.text).join('');
const wrapped=fitRichText(fixtureRuns,{x:0,y:0,width:240,height:2000},18,18,options);
assert.ok(wrapped.richLines.length>=2);
assert.equal(wrapped.lines.join(''),fixtureText);
assert.equal(wrapped.lines.some(line=>/[\r\n]/u.test(line)),false);
assert.ok(wrapped.richLines.every(line=>line.height===wrapped.richLines[0].height));
for(const [runIndex,run] of fixtureRuns.entries()) {
  const observed=wrapped.richLines.flatMap(line=>line.fragments).filter(fragment=>fragment.runIndex===runIndex).map(fragment=>fragment.text).join('');
  assert.equal(observed,run.text,`run ${runIndex} source changed`);
}
const fixtureTab=wrapped.richLines.flatMap(line=>line.fragments).find(fragment=>fragment.kind==='tab');
assert.ok(fixtureTab);
assert.equal(fixtureTab.runIndex,0);
assert.equal(fixtureTab.start,4);
assert.equal(fixtureTab.end,5);
assert.equal(fixtureTab.fontSize,24);
assert.equal(fixtureTab.style.fontWeight,400);

const before=JSON.stringify(fixtureRuns);
const composed=composeSlide({composition:{mode:'row'},blocks:[{text:fixtureRuns}]},{width:960,height:540,textMeasurement:measurement,fonts:{body:'Carlito'}});
assert.equal(JSON.stringify(fixtureRuns),before);
assert.ok(composed.items[0].text.richLines.flatMap(line=>line.fragments).some(fragment=>fragment.kind==='tab'));

const zeroSpace={measure:(text,size)=>text===' '?0:Array.from(text).length*size*.5};
assert.throws(()=>fitRichText(['A\tB'],wide,20,20,{style:options.style,textMeasurement:zeroSpace}),/positive finite measured space advance/);
assert.doesNotThrow(()=>fitRichText(['AB'],wide,20,20,{style:options.style,textMeasurement:zeroSpace}));
assert.ok(calls.some(call=>call.text===' '&&call.size===24&&call.weight===400));
assert.ok(calls.some(call=>call.text===' '&&call.size===14&&call.weight===400));

console.log(JSON.stringify({passed:true,node:process.version,officeOrFontRegistrationCalls:0,edgeFragmentCount:edgeFragments.length,wrappedLineCount:wrapped.richLines.length,fixtureLength:fixtureText.length,measurementCalls:calls.length}));
