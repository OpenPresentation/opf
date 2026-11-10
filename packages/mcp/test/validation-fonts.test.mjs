import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readDeckReport} from '@openpresentation/opf/internal/engine';
import {checkDeckText} from '../dist/stdio.js';
import {connect} from './helpers/mcp-client.mjs';
const inputs=[['json','{"name":"x","slides":[{"title":3}]}'],['json','{"slides": [}'],['json','{"slides":[{"title":"First","title":"Second"}]}'],['yaml','name: Y\nslides:\n  - title: [\n'],['markdown','---\nname: [\n---\n# Slide\n']];
test('stdio validation adapter retains exact canonical source findings across invalid formats',async()=>{
  for(const[format,raw]of inputs){const actual=await checkDeckText(raw,format,{}),canonical=readDeckReport(raw,{format,validate:{}});assert.equal(actual.valid,false);assert.equal(actual.schemaValid,canonical.schemaValid);assert.deepEqual(actual.findings,canonical.findings);assert.ok(actual.findings.some(f=>f.location?.line>=1));}
});
test('actual MCP stdio tool returns structured invalid reports and still measures a valid deck',async()=>{
  const client=await connect();try{for(const[format,document]of inputs){const result=await client.callTool({name:'validate_deck',arguments:{document,format}});assert.notEqual(result.isError,true);assert.ok(result.structuredContent);assert.equal(result.structuredContent.ok,false);assert.ok(result.structuredContent.counts.error>0);assert.ok(result.structuredContent.findings.some(f=>f.location?.line>=1));}
    const valid=await client.callTool({name:'validate_deck',arguments:{document:{language:'en-US',slides:[{title:'Valid',text:'Readable text.'}]}}});assert.notEqual(valid.isError,true);assert.equal(valid.structuredContent.schemaValid,true);assert.equal(valid.structuredContent.checks.layout,'measured');
  }finally{await client.close();}
});

test('stdio font planning uses the same explicit host catalog as validation',async()=>{
  const catalog={source:'pkg:validation-font-host',fontSchemes:{'only-here':{name:'Host mono',major:'Roboto Mono',minor:'Roboto Mono'}}};
  const deck={language:'en-US',catalogs:{brand:{source:catalog.source}},design:{fontScheme:'brand:only-here'},slides:[{title:'Host font',text:'Readable host-catalog content.'}]};
  const result=await checkDeckText(JSON.stringify(deck),'json',{catalogs:[catalog]});assert.equal(result.schemaValid,true);assert.equal(result.valid,true);assert.equal(result.checks.layout,'measured');assert.equal(result.counts.error,0);
});
