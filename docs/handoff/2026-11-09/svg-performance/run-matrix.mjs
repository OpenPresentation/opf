import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const dir=new URL('.',import.meta.url),out=new URL('results/server-baseline-01/',dir),started=new Date().toISOString(),rows=[];
mkdirSync(out,{recursive:true});
const cases=[];for(const size of ['16','36'])for(const mode of ['batch-fonts','selected-default','selected-once','batch-system'])cases.push({size,mode});
for(const item of cases){
 const name=item.size+'-'+item.mode,at=performance.now(),resultPath=fileURLToPath(new URL(name+'.json',out));
 const result=spawnSync(process.execPath,['--expose-gc',fileURLToPath(new URL('benchmark-case.mjs',dir)),item.size,item.mode,'5',resultPath],{encoding:'utf8',timeout:90000,maxBuffer:2e6});
 writeFileSync(new URL(name+'.stdout.log',out),result.stdout??'',{flag:'wx'});writeFileSync(new URL(name+'.stderr.log',out),result.stderr??'',{flag:'wx'});
 const row={...item,exitCode:result.status,signal:result.signal,error:result.error?.message??null,parentWallMs:performance.now()-at};rows.push(row);
 writeFileSync(new URL('progress.json',out),JSON.stringify({started,updated:new Date().toISOString(),rows},null,2)+'\n');
 console.log(JSON.stringify(row));
 if(result.status!==0){process.exitCode=1;break;}
}
let equivalent=false;
if(rows.length===8&&rows.every(r=>r.exitCode===0)){
 for(const size of ['16','36']){
  const cases=['batch-fonts','selected-default','selected-once'].map(mode=>JSON.parse(readFileSync(new URL(size+'-'+mode+'.json',out))));
  const baseline=cases[0].storage.perSlide.map(x=>x.sha256);
  for(const result of cases.slice(1))assert.deepEqual(result.storage.perSlide.map(x=>x.sha256),baseline,'batch and selective renders agree byte-for-byte');
 }
 equivalent=true;
}
writeFileSync(new URL('summary.json',out),JSON.stringify({status:equivalent?'PASS':'INCOMPLETE',started,finished:new Date().toISOString(),runtimeSource:'58e0d7939fc318119f5f81a8ba1455bbfab7f1cd',protocol:'Team heavy commands held; sequential independent Node24 children; first-render plus five warm runs; exposed GC at fixed checkpoints; compression outside render timing. Fresh module cache, warm OS filesystem cache. Real mobile qualification is not claimed.',equivalentStandaloneOutput:equivalent,rows},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:equivalent?'PASS':'INCOMPLETE',cases:rows.length,equivalentStandaloneOutput:equivalent}));
