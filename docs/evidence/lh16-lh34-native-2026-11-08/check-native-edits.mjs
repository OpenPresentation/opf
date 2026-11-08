import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const args=Object.fromEntries(process.argv.slice(2).map((value,index,all)=>index%2===0?[value.replace(/^--/,''),all[index+1]]:null).filter(Boolean));
const json=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
const gitHead=repo=>execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const verified=[];
for(const [id,short] of [['lh16-duration','lh16'],['lh34-callouts','lh34']]) {
 const feature=args[short+'-source'],importer=args[short+'-importer']??feature,worker=args.worker;
 assert.ok(feature&&importer&&worker,'provide source/importer and worker repository roots');
 const suiteRoot=path.join(root,'clean-edit-suites',id),suite=json(path.join(suiteRoot,'suite.json'));
 const attempt=path.join(root,'native-edits',short+'-edit-cli-01'),report=json(path.join(attempt,'native/report.json')),request=json(path.join(attempt,'native/request.json')),runner=json(path.join(attempt,'runner.json'));
 assert.equal(hash(path.join(suiteRoot,'suite.json')),runner.manifestSha256,'runner binds exact suite');
 const controls=[];
 for(const [name,record] of Object.entries(request)) if(record?.path&&record?.sha256&&record?.snapshotPath) {
   const original=hash(record.path),snapshot=hash(record.snapshotPath);
   assert.equal(original,record.sha256,name+' original hash');assert.equal(snapshot,record.snapshotSha256,name+' snapshot hash');assert.equal(original,snapshot,name+' immutable original and snapshot');
   controls.push({name,path:record.path,snapshotPath:record.snapshotPath,sha256:original,originalAndSnapshotUnchanged:true});
 }
 for(const file of suite.files) {const p=path.join(suiteRoot,file.path);assert.equal(hash(p),file.sha256);assert.equal(fs.statSync(p).size,file.bytes);}
 assert.equal(hash(path.join(root,'clean-cli-inputs',id,'build.json')),suite.provenance.sourceCliManifest.sha256);
 const code=[];
 for(const [kind,repo,record] of [['feature',feature,suite.provenance.suiteRepository],['worker',path.join(worker,'packages/pptx'),suite.provenance.workerRepository]]) {
   assert.equal(gitHead(repo),record.revision,kind+' frozen revision');
   for(const file of record.files) {
     const p=path.join(repo,file.path),sha256=hash(p);assert.equal(sha256,file.sha256,kind+' code '+file.path);assert.equal(fs.statSync(p).size,file.bytes);
     const dest=path.join(root,'sealed-code',id,kind,file.path);fs.mkdirSync(path.dirname(dest),{recursive:true});
     if(fs.existsSync(dest))assert.equal(hash(dest),sha256);else fs.copyFileSync(p,dest,fs.constants.COPYFILE_EXCL);
     code.push({kind,path:file.path,bytes:file.bytes,sha256,unchanged:true});
   }
 }
 assert.equal(report.cleanupConfirmed,true);assert.equal(report.lastStatus,'success');assert.equal(json(path.join(attempt,'native/worker.json')).exitCode,0);
 assert.ok(report.actionPlan.completed.every(a=>a.status==='success'));assert.equal(report.actionPlan.completed.length,report.actionPlan.actions.length);
 const diagnostics=[],{fromPptx}=await import(pathToFileURL(path.join(importer,'packages/pptx/test/helpers/default-catalog.mjs')).href);
 const saved=path.join(attempt,'native/native-furniture-control.pptx');
 const deck=await fromPptx(fs.readFileSync(saved),{onDiagnostic:d=>diagnostics.push(d)});
 let semantic;
 if(short==='lh16') {
   const events=deck.slides[0].timeline?.events??deck.slides[0].blocks?.find(b=>b.timeline)?.timeline.events;
   assert.equal(events[1].what,'Build in PowerPoint');assert.equal(events[1].duration,4);assert.equal(events[1].when,'Weeks 2–5');semantic={events};
 } else {
   const original=await fromPptx(fs.readFileSync(path.join(suiteRoot,'input.pptx'))),image=d=>d.slides[0].blocks?.find(b=>b.image)?.image??d.slides[0].image;
   const callouts=image(deck).callouts;assert.deepEqual(callouts.map(c=>c.text),['Native edit\nSecond line','','Inspection point']);assert.deepEqual(callouts.map(({text,...frame})=>frame),image(original).callouts.map(({text,...frame})=>frame));
   assert.ok(!diagnostics.some(d=>d.code==='invalid-image-callout-provenance'));semantic={callouts,exactAuthoredFractions:true};
 }
 const proof={featureSourceRevision:gitHead(feature),importerRevision:gitHead(importer),importerCodeSha256:hash(path.join(importer,'packages/pptx/src',short==='lh34'?'image-callout-provenance.js':'index.js')),savedSha256:hash(saved),requestFiles:controls,sourceAndWorkerCode:code,suiteAndCliHashesUnchanged:true,cleanupConfirmed:true,completedNativeActions:report.actionPlan.completed,semantic,diagnostics,nativeSemanticsAccepted:true,visualFontAcceptance:'held; not implied by semantic text edit'};
 write(path.join(attempt,'opf-reimport-corrected.opf.json'),deck);write(path.join(attempt,'opf-reimport-corrected-verification.json'),proof);
 verified.push({id,sourceRevision:proof.featureSourceRevision,importerRevision:proof.importerRevision,sourceAndSnapshotCount:controls.length,codeFiles:code.length,savedSha256:proof.savedSha256,nativeSemanticsAccepted:true});
}
write(path.join(root,'independent-verification.json'),{verified,scope:'No Office calls. Independent original/snapshot, sealed suite, frozen source/worker code and saved-file import verification.'});
console.log(JSON.stringify(verified,null,2));
