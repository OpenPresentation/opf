import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {installedEngines} from '/tmp/opf-schema-review/scripts/native-acceptance/generate.mjs';
import {loadFixtureSource} from '/tmp/opf-schema-review/scripts/native-acceptance/fixture-source.mjs';
const root='/tmp/opf-schema-review',out='/tmp/opf-schema-nine-audit-4e',oldRoot='/tmp/opf-schema-locked-nine';
const sha=b=>createHash('sha256').update(b).digest('hex');
const head=()=>execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
assert.equal(head(),'4e03508b64e3e83e9bbdc33b2e4cd597b8a22985');
await mkdir(out);
const runtime=[];
for(const pkg of ['javascript','gallery','render','pptx'])for(const f of await readdir(path.join(root,'packages',pkg,'dist'),{recursive:true})){
 const file=path.join(root,'packages',pkg,'dist',f);try{const b=await readFile(file);runtime.push({path:path.relative(root,file),bytes:b.length,sha256:sha(b)});}catch(e){if(e.code!=='EISDIR')throw e;}
}
const engine=await installedEngines(root),{chartFixture,chartBaselines}=await loadFixtureSource(),{pptx,gallery,fflate}=engine;
const oldReceipt=JSON.parse(await readFile(path.join(oldRoot,'receipt.json'),'utf8'));
const reports=[];
for(const [name,deck] of Object.entries(chartFixture.decks)){
 const before=await readFile(path.join(oldRoot,name+'.pptx'));
 assert.equal(sha(before),chartFixture.entries[name].sha256);assert.equal(before.length,chartFixture.entries[name].bytes);
 const diagnostics=[],after=await pptx.toPptx(deck,{catalogs:[gallery],chartex:'fallback',onDiagnostic:issue=>diagnostics.push(issue)});
 if(reports.length===0)assert.equal(sha(after),'3a658a3b08bc67f05f306f2a3381b170721b03a1ab285d785641573366f5ac68','matches original frozen4e first refusal');
 await writeFile(path.join(out,name+'.pptx'),after,{flag:'wx'});
 const a=fflate.unzipSync(before),b=fflate.unzipSync(after),names=[...new Set([...Object.keys(a),...Object.keys(b)])].sort(),changes=[];
 for(const part of names){
  const x=a[part],y=b[part];if(x&&y&&sha(x)===sha(y))continue;
  const entry={part,kind:!x?'added':!y?'removed':'changed',oldBytes:x?.length??null,newBytes:y?.length??null,oldSha256:x?sha(x):null,newSha256:y?sha(y):null};
  const safeName=part.replaceAll('/','__');
  if(x)await writeFile(path.join(out,name+'__before__'+safeName),x,{flag:'wx'});
  if(y)await writeFile(path.join(out,name+'__after__'+safeName),y,{flag:'wx'});
  if(part.startsWith('ppt/tags/')){
   const tags=buf=>[...(buf?fflate.strFromU8(buf):'').matchAll(/<p:tag\b[^>]*name="([^"]+)"[^>]*val="([^"]*)"/g)].map(m=>{let value=m[2];if(/^(?:[0-9a-f]{2})+$/i.test(value)){try{value=JSON.parse(Buffer.from(value,'hex').toString('utf8'));}catch{}}return{name:m[1],value};});
   entry.oldTags=tags(x);entry.newTags=tags(y);
  }
  changes.push(entry);
 }
 const imported=await pptx.fromPptx(after,{catalogs:[gallery]});
 await writeFile(path.join(out,name+'-imported.opf.json'),JSON.stringify(imported,null,2)+'\n',{flag:'wx'});
 const report={name,before:{bytes:before.length,sha256:sha(before)},after:{bytes:after.length,sha256:sha(after)},diagnostics,orderedDiagnosticsMatch:JSON.stringify(diagnostics.map(i=>i.code+(i.adaptation?'/'+i.adaptation:'')))===JSON.stringify(chartFixture.entries[name].diagnostics),parts:names.length,changes};reports.push(report);
 console.log(JSON.stringify({name,changes:changes.map(i=>i.part),orderedDiagnosticsMatch:report.orderedDiagnosticsMatch}));
}
for(const row of runtime)assert.equal(sha(await readFile(path.join(root,row.path))),row.sha256,'runtime changed during audit');
assert.equal(head(),'4e03508b64e3e83e9bbdc33b2e4cd597b8a22985');
await writeFile(path.join(out,'audit.json'),JSON.stringify({source:head(),boundary:'Diagnostic workspace build comparison only; original strict guards remain RED, no native/registry/installed-consumer qualification.',oldEvidence:{commit:oldReceipt.evidenceCommit,zip:oldReceipt.evidenceZip,producer:oldReceipt.producer},chartBaselines,runtime,reports},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({completed:true,archives:reports.length,allChangesTagParts:reports.every(r=>r.changes.every(c=>c.part.startsWith('ppt/tags/'))),out}));
