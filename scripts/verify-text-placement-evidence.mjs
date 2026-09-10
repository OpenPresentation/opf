import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),prefix='docs/evidence/text-placement/';
const summary=JSON.parse(readFileSync(new URL('../'+prefix+'summary.json',import.meta.url),'utf8'));
const ref=process.argv.includes('--staged')?'':'HEAD';
const result=spawnSync('git',['cat-file','--batch'],{cwd:root,input:summary.artifacts.map(item=>ref+':'+prefix+item.path+'\n').join(''),maxBuffer:64*1024*1024});
assert.equal(result.status,0,result.stderr.toString());let offset=0;
for(const item of summary.artifacts) {
  const end=result.stdout.indexOf(10,offset),header=result.stdout.subarray(offset,end).toString();assert.match(header,/^[0-9a-f]+ blob \d+$/);
  const size=Number(header.split(' ')[2]),bytes=result.stdout.subarray(end+1,end+1+size);offset=end+size+2;
  assert.equal(size,item.bytes,item.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256,item.path);
}
assert.equal(offset,result.stdout.length);console.log(`Verified all ${summary.artifacts.length} recorded artifacts against actual ${ref||'staged'} Git bytes.`);
