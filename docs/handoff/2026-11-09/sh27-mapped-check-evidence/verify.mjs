import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const own=import.meta.dirname,hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(own,'manifest.json'))),archive=fs.readFileSync(path.join(own,manifest.archive));
assert.equal(archive.length,manifest.bytes);assert.equal(hash(archive),manifest.sha256);
const files=JSON.parse(gunzipSync(archive)).files;assert.equal(files.length,26);assert.deepEqual(files.map(f=>f.file),manifest.files.map(f=>f.file));
const members=new Map();for(const file of files){const bytes=Buffer.from(file.data,'base64');assert.equal(bytes.length,file.bytes);assert.equal(hash(bytes),file.sha256);assert.deepEqual({file:file.file,bytes:file.bytes,sha256:file.sha256},manifest.files.find(f=>f.file===file.file));members.set(file.file,bytes);}
const receipt=JSON.parse(members.get('check-changed01-exit.json'));assert.deepEqual(receipt,manifest.receipt);assert.equal(receipt.exitCode,1);assert.equal(receipt.source,'58e0d7939fc318119f5f81a8ba1455bbfab7f1cd');
const decode=bytes=>bytes[0]===255&&bytes[1]===254?bytes.toString('utf16le'):bytes.toString('utf8');
assert.match(decode(members.get('steps/pnpm_run_check_text.log')),/painting-Linux\.json\.gz/);
assert.match(decode(members.get('steps/tests_opf.log')),/script-corpora\.json/);
assert.match(decode(members.get('steps/tests_opf.log')),/pass 4248/);
const output=decode(members.get('check-changed01.log'));assert.match(output,/2 of 24 steps failed/);assert.match(output,/tests pptx\s+passed/);assert.match(output,/tests editor\s+passed/);assert.match(output,/typecheck\s+passed/);
assert.equal(manifest.combinedAcceptance,false);assert.equal(manifest.nativeAcceptance,false);
console.log(JSON.stringify({status:'PASS',members:files.length,originalAggregateExit:1,steps:manifest.steps,combinedAcceptance:false,nativeAcceptance:false}));
