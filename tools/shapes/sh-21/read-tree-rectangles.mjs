// Re-extract independent native rectangles. Template supplies only measured-case identity and observed semantic-entry metadata.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const [source,templateFile,out]=process.argv.slice(2);
if(!source||!templateFile||!out||existsSync(out))throw Error('Usage: read-tree-rectangles.mjs <raw-trees.json> <case-template.json> <fresh-output.json>');
const rawBytes=readFileSync(source),templateBytes=readFileSync(templateFile),raw=JSON.parse(rawBytes.toString('utf8').replace(/^\uFEFF/,'')),template=JSON.parse(templateBytes);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(raw.length,580,'full immutable measured corpus');assert.equal(template.cases.length,420,'observed non-assistant tree cases');
const rect=item=>[item.left,item.top,item.width,item.height];
const cases=template.cases.map(model=>{
 assert.ok(['org-chart','hierarchy'].includes(model.kind));const org=model.kind==='org-chart';
 const matches=raw.filter(item=>item.layout===(org?'orgChart1':'hierarchy1')&&item.set===model.set&&item.frame===model.frame);assert.equal(matches.length,1,'unambiguous native measurement');const native=matches[0];
 assert.equal(native.nodes,model.entries.length,'observed native data nodes, including blank seed nodes');
 const items=native.items.filter(item=>org?typeof item.text==='string':item.type===5);assert.equal(items.length,model.entries.length*(org?1:2),'no dropped foreground/background node');
 const expected=model.entries.map((entry,index)=>{const front=items[org?index:2*index+1],back=org?undefined:items[2*index];assert.equal(front.text??'',entry.text,'native/source node order');return{box:rect(front),...(back?{background:rect(back)}:{})};});
 const connectors=native.items.filter(item=>item.type===-2).map(rect);assert.equal(connectors.length,model.entries.length-1,'native parent edge count');
 return{...model,expected,connectors};
});
assert.equal(sha(readFileSync(source)),sha(rawBytes),'source unchanged');assert.equal(sha(readFileSync(templateFile)),sha(templateBytes),'template unchanged');
writeFileSync(out,JSON.stringify({...template,sourceSha256:sha(rawBytes),cases},null,2)+'\n',{flag:'wx'});
console.log(`${cases.length} cases extracted from native source bytes; no product geometry was used for expected rectangles.`);