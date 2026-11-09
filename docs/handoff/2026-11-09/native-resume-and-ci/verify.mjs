import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(readFileSync(path.join(root,'manifest.json'),'utf8'));
assert.equal(manifest.schemaVersion,1);
assert.equal(manifest.nativeAcceptance,false);
assert.equal(manifest.registryAcceptance,false);
assert.equal(manifest.records.length,12);
let rawFiles=0,rawBytes=0;
for(const item of manifest.records){
 assert.match(item.path,/^[a-z0-9.-]+$/);
 const compressed=readFileSync(path.join(root,item.path));
 assert.equal(compressed.length,item.bytes);
 assert.equal(sha(compressed),item.sha256);
 const raw=gunzipSync(compressed);
 assert.equal(raw.length,item.rawBytes);
 assert.equal(sha(raw),item.rawSha256);
 if(item.logicalFiles!==undefined){
  const packet=JSON.parse(raw),seen=new Set();
  assert.equal(packet.schemaVersion,1);
  assert.equal(packet.members.length,item.logicalFiles);
  let total=0;
  for(const member of packet.members){
   assert.ok(member.path&&!member.path.includes('\\')&&!path.posix.isAbsolute(member.path)&&member.path.split('/').every(p=>p&&p!=='.'&&p!=='..'));
   assert.ok(!seen.has(member.path.toLowerCase()));seen.add(member.path.toLowerCase());
   const bytes=Buffer.from(member.data,'base64');
   assert.equal(bytes.length,member.bytes);assert.equal(sha(bytes),member.sha256);total+=bytes.length;
  }
  assert.equal(total,item.logicalBytes);rawFiles+=packet.members.length;rawBytes+=total;
  const get=name=>JSON.parse(Buffer.from(packet.members.find(x=>x.path===name).data,'base64').toString('utf8').replace(/^\uFEFF/,''));
  const runner=get('feature-metrics-01/runner.json'),worker=get('feature-metrics-01/native/supervisor.json'),geometry=get('feature-metrics-01/text-comparison.json');
  assert.equal(runner.status,'native-observation-completed; acceptance-requires-supervisor-review');
  assert.equal(worker.exitCode,0);assert.equal(worker.timedOut,false);assert.equal(worker.cleanupConfirmed,true);
  assert.equal(geometry.passed,true);assert.deepEqual(geometry.findings,[]);assert.equal(geometry.textShapes,14);
  assert.equal(get('feature-metrics-01-compare-text-fonts-exit.json').exitCode,1);
  const snapshots=['original','edited','reopened'].map(p=>packet.members.find(x=>x.path==='feature-metrics-01/native/'+p+'-slide-01.png'));
  assert.ok(snapshots.every(x=>x.sha256===snapshots[0].sha256));
 }else{rawFiles++;rawBytes+=raw.length;}
}
console.log(JSON.stringify({passed:true,archives:12,rawFiles,rawBytes,nativeAcceptance:false,registryAcceptance:false}));
