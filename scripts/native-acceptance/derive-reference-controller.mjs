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
export function referenceControllerDerivation(){
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
