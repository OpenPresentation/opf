import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {unzipSync}=createRequire(new URL('../../../../packages/pptx/package.json',import.meta.url))('fflate');
const manifest=JSON.parse(readFileSync(new URL('manifest.json',import.meta.url),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const raw=readFileSync(new URL(manifest.archive.path,import.meta.url));assert.equal(raw.length,manifest.archive.bytes);assert.equal(hash(raw),manifest.archive.sha256);
const files=unzipSync(raw);assert.deepEqual(Object.keys(files).sort(),manifest.members.map(m=>m.path).sort());
for(const member of manifest.members){assert.equal(files[member.path].length,member.bytes);assert.equal(hash(files[member.path]),member.sha256);}
const focused=JSON.parse(new TextDecoder().decode(files['focused02.json']));assert.ok(focused.every(r=>r.exitCode===0));
assert.match(new TextDecoder().decode(files['browser02.log']),/shape overlays browser test ok: 34 checks/);
console.log(JSON.stringify({status:'PASS',members:manifest.members.length,archiveBytes:raw.length,qualification:manifest.qualification}));
