// Synthetic categories must disappear only with valid unchanged-cache evidence.
// They remain authored/native data after an edit or without full provenance.
import assert from 'node:assert/strict';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';
import {fromPptx,toPptx} from '../dist/index.js';

const data={columns:['Sample'],rows:[[3],[5],[8],[13],[5.5],[9]]};
const deckOf=(type,source=data)=>({slides:[{title:type,chart:{type,data:source}}]});
const chartOf=deck=>deck.slides[0].chart??deck.slides[0].blocks?.find(block=>block.chart)?.chart;
const observed=(source=data)=>({columns:['Row','Sample'],rows:source.rows.map(([value],index)=>[String(index+1),value])});
async function imported(bytes){
  const diagnostics=[];
  const deck=await fromPptx(bytes,{onDiagnostic:entry=>diagnostics.push(entry)});
  return {chart:chartOf(deck),diagnostics};
}
function repack(bytes,edit){
  const entries=unzipSync(bytes);
  for(const name of Object.keys(entries)){
    if(!/\.(xml|rels)$/.test(name))continue;
    const before=strFromU8(entries[name]),after=edit(name,before);
    if(after!==before)entries[name]=strToU8(after);
  }
  return zipSync(entries);
}
const hasDataTag=bytes=>Object.values(unzipSync(bytes)).some(entry=>strFromU8(entry).includes('OPF_DATA_V1'));
let controls=0;
for(const type of ['waterfall','funnel']){
  const diagnostics=[];
  const bytes=await toPptx(deckOf(type),{chartex:'native',onDiagnostic:entry=>diagnostics.push(entry)});
  assert.ok(diagnostics.some(entry=>entry.code==='chart-data-adapted'&&entry.adaptation==='row-numbers'),type);
  assert.ok(hasDataTag(bytes),`${type}: full mode records the authored form`);
  assert.deepEqual((await imported(bytes)).chart,{type,data},`${type}: exact one-column source returns`);
  for(const provenance of ['references-only',false]){
    const bare=await toPptx(deckOf(type),{chartex:'native',provenance});
    assert.equal(hasDataTag(bare),false,`${type}: ${provenance} carries no data snapshot`);
    assert.deepEqual((await imported(bare)).chart,{type,data:observed()},`${type}: ${provenance} retains native categories`);
  }
  const edits=[
    ['category','<cx:pt idx="0">1</cx:pt>','<cx:pt idx="0">Native category</cx:pt>',['Native category',3]],
    ['value','<cx:pt idx="0">3</cx:pt>','<cx:pt idx="0">37</cx:pt>',['1',37]],
  ];
  for(const [label,before,after,row] of edits){
    let changed=false;
    const edited=repack(bytes,(name,xml)=>{
      if(name!=='ppt/charts/chartEx1.xml')return xml;
      assert.ok(xml.includes(before),`${type}: ${label} fixture targets actual cache`);
      changed=true;return xml.replace(before,after);
    });
    assert.ok(changed);
    const result=await imported(edited),native=observed();native.rows[0]=row;
    assert.deepEqual(result.chart,{type,data:native},`${type}: edited ${label} must survive`);
    assert.ok(result.diagnostics.some(entry=>entry.code==='chart-data-provenance-changed'),`${type}: ${label} edit is explained`);
  }
  let damaged=false;
  const tampered=repack(bytes,(name,xml)=>{
    if(!/^ppt\/tags\/opfData\d+\.xml$/.test(name))return xml;
    damaged=true;return xml.replace(/(<p:tag name="OPF_DATA_V1" val=")[^"]*("\/?>)/,'$1BAD$2');
  });
  assert.ok(damaged,`${type}: actual data record damaged`);
  const rejected=await imported(tampered);
  assert.deepEqual(rejected.chart,{type,data:observed()},`${type}: unreadable tags preserve observed data`);
  assert.ok(rejected.diagnostics.some(entry=>entry.code==='invalid-data-provenance'));
  const stripped=repack(bytes,(_name,xml)=>xml.replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g,''));
  assert.deepEqual((await imported(stripped)).chart,{type,data:observed()},`${type}: row labels are not inferred away without tags`);
  controls+=8;
}
// The opt-in follows the actual adaptation, including classic and other chartex
// constructs, rather than a waterfall/funnel type allowlist.
for(const type of ['column','scatter','treemap','box-and-whisker']){
  const bytes=await toPptx(deckOf(type),{chartex:'native'});
  assert.ok(hasDataTag(bytes),`${type}: actual row-number adaptation opts in`);
  assert.deepEqual((await imported(bytes)).chart.data,data,`${type}: unchanged caches restore one source column`);
  if(type==='scatter'){
    for(const [before,after,index] of [
      ['<c:v>1</c:v>','<c:v>41</c:v>',1],
      ['<c:v>3</c:v>','<c:v>43</c:v>',2],
    ]){
      // Target only xVal/yVal, not a duplicated point label or series cache.
      const role=index===1?'xVal':'yVal';
      const edited=repack(bytes,(name,xml)=>name==='ppt/charts/chart1.xml'
        ?xml.replace(new RegExp(`<c:${role}>[\\s\\S]*?</c:${role}>`),body=>{
          assert.ok(body.includes(before));return body.replace(before,after);
        }):xml);
      const result=await imported(edited);
      assert.deepEqual(result.chart.data.columns,['Point','Row','Sample']);
      assert.equal(result.chart.data.rows[0][index],index===1?41:43);
      assert.ok(result.diagnostics.some(entry=>entry.code==='chart-data-provenance-changed'));
      controls++;
    }
  }
  controls++;
}
// A two-column scatter with synthesized X is a different structural adaptation
// and does not opt in just because it shares the row-numbers diagnostic.
{
  const source={columns:['Label','Sample'],rows:[['a',3],['b',5]]};
  const bytes=await toPptx(deckOf('scatter',source));
  assert.equal(hasDataTag(bytes),false);
  assert.deepEqual((await imported(bytes)).chart.data.columns,['Point','X','Sample']);
  controls++;
}
// A category named Row is authored data, even when all labels resemble numbers.
{
  const authored=observed(),bytes=await toPptx(deckOf('waterfall',authored),{chartex:'native'});
  assert.equal(hasDataTag(bytes),false);
  assert.deepEqual((await imported(bytes)).chart,{type:'waterfall',data:authored});
  controls++;
}
// A histogram fallback holds bin counts, never the original raw samples.
{
  const bytes=await toPptx(deckOf('histogram'),{chartex:'fallback'});
  assert.equal(hasDataTag(bytes),false,'binning does not opt into row-number restoration');
  const result=await imported(bytes);
  assert.equal(result.chart.type,'column');
  assert.deepEqual(result.chart.data.columns,['Bin','Frequency']);
  assert.equal(result.chart.data.rows.reduce((sum,row)=>sum+row[1],0),data.rows.length);
  assert.notDeepEqual(result.chart.data,data);
  controls++;
}
console.log(`Row-data provenance: ${controls} controls preserve source shape with unchanged evidence and native category/value edits otherwise; no Office execution.`);
