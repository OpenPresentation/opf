import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide, OPFCompositionError} from '../dist/composition.js';
import {validatePresentation} from '../dist/index.js';

const blocks = count => Array.from({length:count},(_,i)=>({text:`Observation ${i+1}. `.repeat(i+1)}));

test('explanation preserves geometry, source values and measurement calls', () => {
  for (const [width,height] of [[1280,720],[720,1280],[320,180]]) {
    for (const mode of ['auto','grid','row','column']) {
      const slide={title:'Evidence',composition:{mode,columns:4,weights:[2,1]},blocks:[{blocks:blocks(3)},...blocks(4)]};
      const before=structuredClone(slide);
      let calls=0;
      const options={width,height,textMeasurement:{measure:(text,size)=>{calls++;return text.length*size*.5;}}};
      const original=composeSlide(slide,options), originalCalls=calls;
      calls=0;
      const {explanation,...geometry}=composeSlide(slide,{...options,explain:true});
      assert.deepEqual(geometry,original);
      assert.deepEqual(slide,before);
      assert.equal(calls,originalCalls,'Explaining must not repeat measurements or search');
      assert.equal(explanation.textMeasurement,'provided');
      assert.deepEqual(explanation,composeSlide(slide,{...options,explain:true}).explanation);
    }
  }
});

test('candidate penalties account for the score and report the selected flow', () => {
  const slide={composition:{mode:'auto',columns:3,minFontSize:24},blocks:[
    {text:'Detailed explanation. '.repeat(90)},
    {table:{columns:['Heading'],rows:Array.from({length:30},(_,i)=>[`Row ${i}`])}},
    ...blocks(3),
  ]};
  const result=composeSlide(slide,{width:720,height:1280,explain:true,slideIndex:4});
  const decision=result.explanation.decisions[0];
  assert.equal(result.explanation.algorithm,'grid-score-v1');
  assert.equal(result.explanation.textMeasurement,'estimated');
  assert.equal(decision.path,'slides.4');
  assert.equal(decision.reason,'lowest-score');
  assert.deepEqual(decision.candidates.map(candidate=>candidate.columns),[1,2,3]);
  for (const candidate of decision.candidates) {
    const total=Object.values(candidate.penalties).reduce((sum,value)=>sum+value,0);
    assert.ok(Math.abs(candidate.score-total)<1e-8);
    assert.equal(candidate.rows,Math.ceil(5/candidate.columns));
    assert.equal(candidate.penalties.emptySlots,(candidate.rows*candidate.columns-5)*2);
    assert.ok(Object.values(candidate.penalties).every(value=>Number.isFinite(value)&&value>=0));
  }
  const best=decision.candidates.reduce((a,b)=>b.score<a.score?b:a);
  assert.equal(decision.selectedColumns,best.columns);
  assert.equal(result.flows[0].columns.length,best.columns);
  assert.ok(decision.candidates.some(candidate=>candidate.penalties.textOverflow>0));
  assert.ok(decision.candidates.some(candidate=>candidate.penalties.tableOverflow>0));
});

test('fixed modes and promoted regions retain placement with no invented search', () => {
  const slide={left:{composition:{mode:'column',weights:[2,1]},blocks:blocks(2)},right:{blocks:blocks(3)}};
  const result=composeSlide(slide,{explain:true});
  assert.deepEqual(result.explanation.decisions.map(({path,mode,reason})=>({path,mode,reason})),[
    {path:'slides.0',mode:'regions',reason:'promoted-regions'},
    {path:'slides.0.left',mode:'column',reason:'configured-mode'},
    {path:'slides.0.right',mode:'auto',reason:'lowest-score'},
  ]);
  assert.deepEqual(result.explanation.decisions[0].candidates,[]);
  assert.equal(result.explanation.decisions[0].selectedColumns,undefined);
  assert.deepEqual(result.explanation.decisions[1].candidates,[]);
  assert.equal(result.explanation.decisions[1].selectedColumns,1);
  assert.ok(Math.abs(result.items[0].box.height/result.items[1].box.height-2)<1e-5);
  const inherited=composeSlide({blocks:blocks(2)},{explain:true,layout:{slideLayoutDirection:'Vertical'}});
  assert.equal(inherited.explanation.decisions[0].reason,'configured-mode');
  assert.equal(inherited.explanation.decisions[0].mode,'column');
});

test('reserved slots, candidate caps and empty slides are explicit', () => {
  const reserved=composeSlide({blocks:blocks(1)},{explain:true,layout:{placeholders:Array.from({length:8},()=>({type:'text'}))}});
  assert.equal(reserved.flows[0].slotCount,8);
  assert.equal(reserved.explanation.decisions[0].candidates.length,6);
  const capped=composeSlide({blocks:blocks(13),composition:{columns:12}},{explain:true});
  assert.equal(capped.explanation.decisions[0].candidates.length,12);
  assert.deepEqual(composeSlide({}, {explain:true}).explanation.decisions,[]);
});

test('equal scores retain the first, lower-column candidate', () => {
  const result=composeSlide({blocks:blocks(2),composition:{gap:0,padding:0}},{width:1600,height:1000,explain:true});
  const decision=result.explanation.decisions[0];
  assert.equal(decision.candidates[0].score,decision.candidates[1].score);
  assert.equal(decision.selectedColumns,1);
});

test('unsupported internal fit stays visible and strict failures retain their explanation', () => {
  const fields=['image','video','chart','metric','quote','timeline'];
  const values=['./image.png','./video.mp4',{type:'bar',data:{columns:['Category','Value'],rows:[['A',1],['B',2]]}},
    {value:42,label:'Metric'},{text:'Body',attribution:'Footer'},{events:[{when:'Q1',what:'Launch'}]}];
  const slide={blocks:fields.map((field,i)=>({[field]:values[i]}))};
  assert.equal(validatePresentation({slides:[slide]}).valid,true);
  const result=composeSlide(slide,{explain:true});
  assert.deepEqual(result.explanation.unmeasuredPayloads,fields.map((field,i)=>`slides.0.blocks.${i}.${field}`));
  const overflow={text:'All original content. '.repeat(1000),composition:{overflow:'error'}};
  assert.throws(()=>composeSlide(overflow,{explain:true}),error=>{
    assert.ok(error instanceof OPFCompositionError);
    assert.equal(error.explanation.decisions[0].candidates[0].penalties.textOverflow,1000);
    assert.equal(error.diagnostics[0].code,'text-overflow');
    return true;
  });
  assert.throws(()=>composeSlide(overflow),error=>error instanceof OPFCompositionError && error.explanation===undefined);
});
