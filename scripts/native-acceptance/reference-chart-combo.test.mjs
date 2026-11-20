// Exact real partial02 archive; no export/generation or Office. Core resolves all defaults/roles.
import assert from 'node:assert/strict';import fs from 'node:fs';import {fileURLToPath} from 'node:url';import test from 'node:test';
import {resolveChartData} from '../../packages/javascript/dist/index.js';import {fromPptx} from '../../packages/pptx/dist/index.js';import {gallery} from '../../packages/gallery/dist/index.js';
import {compareReferenceWitnessImports} from './reference-chart-profile.mjs';import {inspectReferenceArchive} from './reference-chart-archive.mjs';import {digest} from './identity.mjs';
const folder=fileURLToPath(new URL('./test-fixtures/reference-combo/',import.meta.url)),manifest=JSON.parse(fs.readFileSync(folder+'manifest.json','utf8')),read=name=>{const b=fs.readFileSync(folder+name),pin=manifest.files.find(x=>x.name===name);assert.equal(b.length,pin.bytes);assert.equal(digest(b),pin.sha256);return b;},bytes=read('reference-native-axes.pptx'),source=JSON.parse(read('source.opf.json')),canvas=inspectReferenceArchive(bytes).canvas,diagnostics=[],document=await fromPptx(bytes,{catalogs:[gallery],onDiagnostic:d=>diagnostics.push(d)}),result={document,diagnostics},phases=()=>({original:structuredClone(result),'saved-reopened':structuredClone(result)}),compare=(wanted,imports)=>compareReferenceWitnessImports(wanted,imports,canvas,resolveChartData),combo=d=>d.slides[0].chart;
test('actual native combo default elision preserves complete resolved roles/data/order/axes',()=>{
 assert.deepEqual(combo(source).line,['Margin']);assert.equal(combo(document).line,undefined);
 assert.deepEqual(resolveChartData(combo(source)),resolveChartData(combo(document)));
 assert.deepEqual(resolveChartData(combo(source)).combo,[{role:'bar',axis:'primary'},{role:'line',axis:'secondary'}]);
 assert.deepEqual(compare(source,phases()),[]);assert.equal(result.diagnostics.length,1);assert.equal(result.diagnostics[0].code,'chart-option-adapted');assert.equal(result.diagnostics[0].option,'series.1.line.color');
});
test('changed combo line roles, secondary association and explicit empty lines remain failures',()=>{
 for(const change of [c=>{c.line=['Revenue'];},c=>{c.secondaryAxis=['Revenue'];},c=>{delete c.secondaryAxis;},c=>{c.secondaryAxis=[];},c=>{c.line=[];},c=>{c.secondaryAxis=['Margin','Unknown'];}]){const imported=phases();change(combo(imported['saved-reopened'].document));assert(compare(source,imported).some(x=>x.phase==='saved-reopened'&&x.code==='import-combo-axis-association-differs'));}
});
test('failed source/actual resolution cannot pass merely because both invalid models match',()=>{
 const wanted=structuredClone(source),imports=phases();combo(wanted).data.rows=[];combo(imports.original.document).data.rows=[];combo(imports['saved-reopened'].document).data.rows=[];
 assert.equal(resolveChartData(combo(wanted)).ok,false);assert(compare(wanted,imports).some(x=>x.code==='import-combo-axis-association-differs'));
});
test('extra ordinary helper data and changed named series order are never ignored',()=>{
 for(const change of [c=>{c.data.columns.push('Unintended helper');for(const row of c.data.rows)row.push(180);},c=>{[c.data.columns[1],c.data.columns[2]]=[c.data.columns[2],c.data.columns[1]];for(const row of c.data.rows)[row[1],row[2]]=[row[2],row[1]];}]){const imports=phases();change(combo(imports['saved-reopened'].document));const findings=compare(source,imports);assert(findings.some(x=>x.code==='import-authored-data-differs'));assert(findings.some(x=>x.code==='import-combo-axis-association-differs'));}
});
test('the actual core resolver is an explicit required qualification dependency',()=>{
 for(const missing of [undefined,null,{},()=>undefined]){if(typeof missing==='function')assert(compareReferenceWitnessImports(source,phases(),canvas,missing).some(x=>x.code==='import-combo-axis-association-differs'));else assert.throws(()=>compareReferenceWitnessImports(source,phases(),canvas,missing),/core.resolveChartData/);}
});
