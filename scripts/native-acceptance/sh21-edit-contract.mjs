// Closed diagnostic historical-input contract. This never enables live export.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {digest} from './identity.mjs';
import {assertOwnedKeys} from './owned-postflight.mjs';

export const SH21_PROFILE='sh21-three-case-node-and-text-edit-v1';
export const SH21_REVISION='77cbe3b41f2fb647cf014cfd1008d053165f7b3b';
export const SH21_DIRECTORY='docs/programs/shapes/sh21-product-candidate-2026-11-07/';
export const SH21_MANIFEST={bytes:8188,sha256:'4c94d40b88ed8fddfd9cbedac2d9133e6da4d366ec8b9a70579db1d12079771a'};
export const SH21_CASES=Object.freeze({
 'org-chart-3':{kind:'org-chart',bytes:117059,sha256:'098581b8ddf53f8fc035cd3fb7164e7605977e702a79db494c5160e98c761c7b',layout:'orgChart1'},
 'hierarchy-3':{kind:'hierarchy',bytes:137659,sha256:'7f8130b1251ba803d26055f7b4f779ad14c7ee42117fd6e35227e352997f88ca',layout:'hierarchy1'},
 'venn-3':{kind:'venn',bytes:172612,sha256:'d5c3996d89c1ac7b442b65cc6fe81b5985813d36d3df17f5e7f85355e5450db8',layout:'venn1'},
});
export function sh21Plan(caseId){
 const c=SH21_CASES[caseId];assert.ok(c,'Closed three-case SH21 selection required');
 const tree=c.kind!=='venn';
 const nodes=texts=>texts.map((text,i)=>({index:i+1,text,level:tree&&i>0?2:1,parent:tree&&i>0?'Lead':null,type:1,children:tree&&i===0?texts.length-1:0}));
 return {schemaVersion:1,profile:SH21_PROFILE,caseId,kind:c.kind,inputSha256:c.sha256,shapeId:2,shapeName:'OPF smartart slides.0.items',layoutId:'urn:microsoft.com/office/officeart/2005/8/layout/'+c.layout,slideCount:1,sourceFontSize:36,
  before:nodes(tree?['Lead','Build','Ship']:['N1','N2','N3']),after:nodes(tree?['Lead','Craft','Ship','Grow']:['N1','E2','N3','N4']),
  operations:[{op:'set-existing-text',index:2,text:tree?'Craft':'E2'},{op:'add-node',afterIndex:3,position:2,type:1},{op:'set-new-text',index:4,text:tree?'Grow':'N4'}],
  nativeAcceptance:false,registryAcceptance:false};
}
export function assertSh21Plan(plan){assertOwnedKeys(plan,Object.keys(sh21Plan(plan?.caseId)));assert.deepEqual(plan,sh21Plan(plan.caseId));return plan;}
export function readSh21HistoricalInput(root,caseId){
 const c=SH21_CASES[caseId];assert.ok(c);
 const blob=relative=>execFileSync('git',['-C',root,'show',SH21_REVISION+':'+SH21_DIRECTORY+relative],{maxBuffer:1024*1024});
 const manifest=blob('manifest.json');assert.deepEqual({bytes:manifest.length,sha256:digest(manifest)},SH21_MANIFEST);
 const bytes=blob('pptx/'+caseId+'.pptx');assert.deepEqual({bytes:bytes.length,sha256:digest(bytes)},{bytes:c.bytes,sha256:c.sha256});
 const parsed=JSON.parse(manifest),entry=parsed.cases.find(row=>row.id===caseId);assert.ok(entry);assert.equal(entry.live.sha256,c.sha256);assert.equal(entry.layoutId,sh21Plan(caseId).layoutId);
 return {bytes,manifest,plan:sh21Plan(caseId)};
}
export function sh21ExpectedNodes(plan,state){
 assertSh21Plan(plan);assert.ok(['before','middle','after'].includes(state));const rows=structuredClone(state==='after'?plan.after:plan.before);if(state==='middle')rows[1].text=plan.after[1].text;return rows;
}
export function sh21NodeMap(rows,plan,state){
 const expected=sh21ExpectedNodes(plan,state);assert.ok(Array.isArray(rows));assert.equal(rows.length,expected.length);const fields=['text','level','parent','type','children'];
 for(const [i,row]of rows.entries()){assertOwnedKeys(row,['index',...fields]);assert.equal(row.index,i+1);assert.equal(typeof row.text,'string');assert.ok(Number.isSafeInteger(row.level)&&[1,2].includes(row.level));assert.ok(row.parent===null||typeof row.parent==='string');assert.equal(row.type,1);assert.ok(Number.isSafeInteger(row.children)&&row.children>=0&&row.children<rows.length);}
 const map=expected.map(node=>{const matches=rows.filter(row=>fields.every(key=>row[key]===node[key]));assert.equal(matches.length,1,'Exactly one full semantic native node tuple required');return matches[0].index;});assert.equal(new Set(map).size,rows.length,'Full semantic/native bijection required');return map;
}
export function assertSh21Observation(observation,plan,state){assertOwnedKeys(observation,['nodes','semanticToNativeIndex']);const map=sh21NodeMap(observation.nodes,plan,state);assert.deepEqual(observation.semanticToNativeIndex,map,'Reported mapping must equal actual full-tuple matching');return map;}
export function assertSh21NodeRows(rows,plan,edited){return sh21NodeMap(rows,plan,edited?'after':'before');}
