// Mechanically derive a separate three-slide/no-action controller shell from the reviewed whole-seven shell.
// No original source is edited. Default invocation only checks derivation; --write creates new source files exclusively.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const folder=fileURLToPath(new URL('./',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const bases=[
  ['seven-chart-worker.ps1','reference-chart-worker.ps1','7735dcd6c9c1f3ff6d0a454319697eda040f66ec515dde96e705a1ed65571af4'],
  ['run-seven-chart-profile.ps1','run-reference-chart-profile.ps1','060cafa0e782f7aaaaafb9d395bbfa51598f89c2269986a56c17e3e0ce5e3878'],
  ['seven-chart-worker-self-test.ps1','reference-chart-worker-self-test.ps1','35b1b4e69d21181144ad0cfed5f4050488929717840fff514894f97751d8aa0b']
];
const once=(source,before,after)=>{assert.equal(source.split(before).length-1,1,'Unique policy derivation '+before);return source.replace(before,after);};
export function referenceControllerBaseDerivation(){
  return bases.map(([base,file,expected])=>{
    const bytes=fs.readFileSync(path.join(folder,base));assert.equal(sha(bytes),expected,'Reviewed source changed '+base);
    let text=bytes.toString('utf8').replaceAll('seven-chart','reference-chart').replaceAll('Seven','ReferenceWitness').replaceAll('seven','referenceWitness');
    if(base==='seven-chart-worker.ps1'){
      text=once(text,'$count -eq 7)','$count -eq 3)');
      text=once(text,'"$Phase.slides.count" 7 $count','"$Phase.slides.count" 3 $count');
      text=once(text,'$index -le 7;','$index -le 3;');
      text=once(text,'$total -le 20','$total -le 9');
      text=once(text,"'<=20'","'<=9'");
    }
    if(base==='run-seven-chart-profile.ps1'){
      text=once(text,"'scripts/native-acceptance/reference-chart-archive.mjs',","'scripts/native-acceptance/reference-chart-archive.mjs','scripts/native-acceptance/reference-runtime-routes.mjs',");
      text=once(text,'all six exact code identities','all seven exact code identities');
    }
    if(base==='seven-chart-worker-self-test.ps1'){
      text=once(text,'=="slideCount"?6:7;','=="slideCount"?2:3;');
      assert.equal(text.split('rasters).Count -ne 7').length-1,2,'Two phase raster-count anchors');
      text=text.replaceAll('rasters).Count -ne 7','rasters).Count -ne 3');
      text=once(text,'saved.slide.7.export','saved.slide.3.export');
    }
    return{base,file,baseSha256:expected,bytes:Buffer.byteLength(text),sha256:sha(text),source:text};
  });
}

// Canonical second stage comes from the independently reviewed f3f source, never from the target being checked.
const postflightPlan=JSON.parse(fs.readFileSync(new URL('./reference-postflight-derivation.json',import.meta.url),'utf8'));
export function applyExactReferenceEdits(source,edits){
  assert.equal(typeof source,'string');assert(Array.isArray(edits));
  for(const edit of edits){
    assert.equal(typeof edit.before,'string');assert.equal(typeof edit.after,'string');assert(edit.before.length>0&&edit.after.length>0);
    assert.equal(source.split(edit.before).length-1,1,'Unique postflight policy anchor '+edit.name);
    source=source.replace(edit.before,()=>edit.after);
  }
  return source;
}
export function deriveReferencePostflight(source,plan=postflightPlan){
  assert.equal(plan.schema,1);
  assert.equal(plan.reviewedRevision,'f3f04183c2d38ffe3e5755a23b571b6b9ce8155e');
  assert.equal(plan.reviewedFile,'scripts/native-acceptance/run-reference-chart-profile.ps1');
  assert.equal(plan.reviewedSourceSha256,'8902c341911dd9711872b4745d8ac3fe6524b9f5dcaa6d7ccd17b7f1f1116ee3');
  assert.equal(sha(Buffer.from(source)),plan.baseSourceSha256,'Exact pre-postflight derivative');
  assert.equal(Buffer.byteLength(source),plan.baseBytes);
  assert.deepEqual(plan.edits.map(edit=>edit.name),['insert-reviewed-postflight-definitions','replace-legacy-terminal-confirmation']);
  const result=applyExactReferenceEdits(source,plan.edits);
  assert.equal(sha(Buffer.from(result)),plan.reviewedSourceSha256,'Exact reviewed postflight derivative');
  assert.equal(Buffer.byteLength(result),plan.reviewedBytes);
  return result;
}
export function referenceControllerDerivation(){
  return referenceControllerBaseDerivation().map(item=>{
    if(item.file!=='run-reference-chart-profile.ps1')return item;
    const source=deriveReferencePostflight(item.source);
    return {...item,prePostflightSha256:item.sha256,bytes:Buffer.byteLength(source),sha256:sha(Buffer.from(source)),source};
  });
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.ok(process.argv.length<=3&&[undefined,'--check','--write'].includes(process.argv[2]));
  const records=referenceControllerDerivation();
  for(const item of records){
    const file=path.join(folder,item.file);
    if(process.argv[2]==='--write')fs.writeFileSync(file,item.source,{flag:'wx'});
    else assert.deepEqual(fs.readFileSync(file),Buffer.from(item.source),'Derived source differs '+item.file);
  }
  console.log(JSON.stringify({scope:'mechanical source derivation only; no Office/native acceptance',files:records.map(({source,...item})=>item)}));
}
