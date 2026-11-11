import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readDeckReport} from '@openpresentation/opf/internal/engine';
const here=path.dirname(fileURLToPath(import.meta.url)),cli=path.resolve(here,'../dist/index.js');
const run=(args,raw,cwd=path.resolve(here,'..'))=>spawnSync(process.execPath,[cli,...args],{cwd,input:raw,encoding:'utf8',timeout:30000});
const inputs=[
  ['json','{"name":"x","slides":[{"title":3}]}'],
  ['json','{"slides": [}'],
  ['json','{"slides":[{"title":"First","title":"Second"}]}'],
  ['yaml','name: Y\nslides:\n  - title: [\n'],
  ['markdown','---\nname: [\n---\n# Slide\n'],
];
test('actual CLI invalid source reports stay canonical and located after font demand planning',()=>{
  for(const[format,raw]of inputs){const result=run(['validate','-',...(format==='json'?[]:['--from',format==='markdown'?'md':format])],raw);assert.equal(result.status,1,result.stderr);assert.equal(result.stderr,'');const report=JSON.parse(result.stdout),canonical=readDeckReport(raw,{format,validate:{}});assert.equal(report.valid,false);assert.equal(report.schemaValid,canonical.schemaValid);assert.deepEqual(report.findings,canonical.findings);assert.ok(report.findings.some(f=>f.location?.line>=1&&f.location?.column>=1),'source locations are retained');}
});
test('format-only and mixed file reporting preserve statuses without promoting errors to internal failures',()=>{
  const dir=mkdtempSync(path.join(here,'../.validation-fonts-'));
  try{writeFileSync(path.join(dir,'invalid.opf.json'),inputs[0][1]);writeFileSync(path.join(dir,'valid.opf.json'),'{"language":"en-US","slides":[{"title":"Valid","text":"Readable text."}]}');
    const only=run(['validate','invalid.opf.json','--only','format'],undefined,dir);assert.equal(only.status,1);assert.equal(JSON.parse(only.stdout).checks.layout,'not-run');
    const mixed=run(['validate','invalid.opf.json','valid.opf.json'],undefined,dir);assert.equal(mixed.status,1,mixed.stderr);const reports=JSON.parse(mixed.stdout).files;assert.deepEqual(reports.map(r=>r.ok),[false,true]);assert.ok(reports[0].findings.some(f=>f.path==='/slides/0/title'));assert.equal(reports[1].checks.layout,'measured');
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('configured font catalogs prepare the same host-only family as the validation report',()=>{
  const dir=mkdtempSync(path.join(here,'../.validation-fonts-'));
  try{const catalog={source:'pkg:validation-font-host',fontSchemes:{'only-here':{name:'Host mono',major:'Roboto Mono',minor:'Roboto Mono'}}};
    const deck={language:'en-US',catalogs:{brand:{source:catalog.source}},design:{fontScheme:'brand:only-here'},slides:[{title:'Host font',text:'Readable host-catalog content.'}]};
    writeFileSync(path.join(dir,'host.json'),JSON.stringify({catalogs:[catalog]}));
    const result=run(['validate','-','--config','host.json'],JSON.stringify(deck),dir);assert.equal(result.status,0,result.stderr||result.stdout);const report=JSON.parse(result.stdout);assert.equal(report.schemaValid,true);assert.equal(report.checks.layout,'measured');assert.equal(report.counts.error,0);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
