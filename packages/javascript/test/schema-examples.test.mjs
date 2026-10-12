import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {presentation,validateCatalogRecord} from '../dist/index.js';
const catalogs=presentation.$defs.Catalogs;
const schemaId=kind=>JSON.parse(readFileSync(new URL(`../../../spec/schemas/${kind==='layouts'?'layout':'theme'}.schema.json`,import.meta.url))).$id;
const examples=[...catalogs.examples,...catalogs.properties.default.examples.filter(value=>value&&typeof value==='object').map(value=>({default:value}))];
test('every schema-example embedded record satisfies core companion and v2 grid semantics',()=>{
 let checked=0;
 for(const example of examples)for(const group of Object.values(example))for(const [kind,records] of Object.entries(group)){
  if(kind==='source')continue;
  for(const [id,record] of Object.entries(records)){const result=validateCatalogRecord(kind,{$schema:schemaId(kind),id,...record});assert.equal(result.valid,true,JSON.stringify(result.findings));checked++;}
 }
 assert.equal(checked,4);
});
test('a schema-example chart region with nonrectangular areas is rejected by core semantics',()=>{
 const record=structuredClone(catalogs.examples[0].custom.layouts['q4-special']);record.areas=['title title','chart .','chart chart'];
 const result=validateCatalogRecord('layouts',{$schema:schemaId('layouts'),id:'q4-special',...record});assert.equal(result.valid,false);assert.ok(result.findings.some(finding=>finding.path.startsWith('/areas')));
});
