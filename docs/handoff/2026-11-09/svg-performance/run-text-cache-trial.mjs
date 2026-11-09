import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const own=path.join(process.cwd(),'docs/handoff/2026-11-09/svg-performance');
const out=path.join(own,'results/text-cache-01');fs.mkdirSync(out,{recursive:false});
const archive=JSON.parse(gunzipSync(fs.readFileSync(path.join(own,'server-baseline-01.raw.json.gz')))).files;
const expected=new Map([16,36].map(size=>[size,JSON.parse(Buffer.from(archive.find(f=>f.file==='results/server-baseline-01/'+size+'-batch-fonts.json').data,'base64')).storage.perSlide.map(s=>s.sha256)]));
const order=[[16,'before'],[16,'after'],[36,'before'],[36,'after'],[36,'after'],[36,'before'],[16,'after'],[16,'before']];
const receipt={schema:1,started:new Date().toISOString(),status:'RUNNING',protocol:'Explicit team quiet window; fixed mirrored order of eight fresh Node24 children, first render plus two warm runs each, identical eager office fonts and runtime. Symmetric adapted modules differ only at the metric-cache boundary. All SVG hashes must equal the accepted baseline; compression/GC/hashing outside render timing.',rows:[]};
const save=()=>fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(receipt,null,2)+'\n');save();
for(const [index,[size,variant]]of order.entries()){
 const name=String(index+1).padStart(2,'0')+'-'+size+'-'+variant,json=path.join(out,name+'.json');
 const row={order:index+1,size,variant,started:new Date().toISOString()};
 const run=spawnSync(process.execPath,['--expose-gc',path.join(own,'text-cache-case.mjs'),String(size),'batch-fonts','2',json,variant],{cwd:process.cwd(),encoding:'utf8',timeout:45000,maxBuffer:1024*1024});
 Object.assign(row,{finished:new Date().toISOString(),exitCode:run.status,signal:run.signal,error:run.error?.message});receipt.rows.push(row);
 fs.writeFileSync(path.join(out,name+'.stdout'),run.stdout||'');fs.writeFileSync(path.join(out,name+'.stderr'),run.stderr||'');
 try{
  assert.equal(run.status,0,name+' failed');const result=JSON.parse(fs.readFileSync(json));assert.equal(result.fontVariant,variant);
  assert.deepEqual(result.storage.perSlide.map(s=>s.sha256),expected.get(size),'Output drift: '+name);
  const cpu=result.samples.slice(1).map(s=>s.userCpuMs+s.systemCpuMs).sort((a,b)=>a-b);
  Object.assign(row,{allSvgEquivalent:true,firstRenderMs:result.samples[0].elapsedMs,warmMedianMs:result.warmMedianMs,warmMedianCpuMs:(cpu[0]+cpu[1])/2,renderPeakRssBytes:Math.max(...result.samples.map(s=>s.afterRender.peakRssBytes)),finalMemory:result.finalMemory});
 }catch(error){receipt.status='FAIL';receipt.failure=error.message;receipt.finished=new Date().toISOString();save();throw error;}
 save();console.log(JSON.stringify(row));
}
receipt.status='PASS';receipt.finished=new Date().toISOString();receipt.childSha256=createHash('sha256').update(fs.readFileSync(path.join(own,'text-cache-case.mjs'))).digest('hex');save();
console.log(JSON.stringify({status:'PASS',cases:8,baselineSlideComparisons:208}));
