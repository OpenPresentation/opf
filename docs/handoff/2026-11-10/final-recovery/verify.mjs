// Offline byte-integrity verification only. Never executes or imports archived code.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
assert.equal(process.argv.length,2,'No arguments or execution modes');
const root=path.dirname(fileURLToPath(import.meta.url));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const manifestBytes=fs.readFileSync(path.join(root,'manifest.json'));
assert.equal(sha(manifestBytes),'849753332c0167746000d401ab5bc774738ddb1ba20a6ddb2c30a356b5e3932f','Exact reviewed manifest');
const manifest=JSON.parse(manifestBytes);
assert.equal(manifest.neverMerge,true);assert.equal(manifest.unqualified,true);
assert.equal(manifest.nativeAcceptance,false);assert.equal(manifest.productAcceptance,false);
assert.equal(manifest.baseRevision,'a52dc9441f7eec9dc6f72debb174339758e1761e');
const packed=fs.readFileSync(path.join(root,'raw.json.gz'));
assert.equal(packed.length,471363);assert.equal(sha(packed),'dbaf30493447d134a4c4e63dd3588abacef3a5704f365fe02b66bdc874faa494');
const raw=zlib.gunzipSync(packed,{maxOutputLength:2*1024*1024});
assert.equal(raw.length,manifest.archive.jsonBytes);assert.equal(sha(raw),manifest.archive.jsonSha256);
const packet=JSON.parse(raw);assert.equal(packet.schema,1);
const expected=["inheritance/README.md","inheritance/review-packet.zip.gz","inheritance/review-packet-inventory.json","inheritance/verify-review.mjs","sh21/artifacts-sh20-marker-gate.log","sh21/artifacts-sh21-candidate-build.log","sh21/artifacts-sh21-product-pilot.log"];
assert.deepEqual(packet.records.map(record=>record.path),expected);
assert.equal(manifest.files.length,7);assert.equal(manifest.recordCount,7);
let bytes=0;
for(let i=0;i<7;i++){
 const record=packet.records[i],pin=manifest.files[i];
 assert.deepEqual(Object.keys(record).sort(),['base64','bytes','path','sha256']);
 assert.equal(record.path,pin.path);assert.equal(typeof record.base64,'string');
 const value=Buffer.from(record.base64,'base64');
 assert.equal(value.toString('base64'),record.base64,'Canonical base64');
 assert.equal(value.length,pin.bytes);assert.equal(record.bytes,pin.bytes);
 assert.equal(sha(value),pin.sha256);assert.equal(record.sha256,pin.sha256);bytes+=value.length;
}
assert.equal(bytes,483041);assert.equal(bytes,manifest.decodedBytes);
assert.equal(manifest.eolOnlyFlags.files.length,6);
for(const flag of manifest.eolOnlyFlags.files){assert.equal(flag.normalizedEqualsHead,true);assert.equal(flag.headGitBlob,flag.lfGitBlob);}
assert.equal(manifest.alreadyPreservedArchiveLogs.files.length,3);
for(const log of manifest.alreadyPreservedArchiveLogs.files){assert.equal(log.entrySha256VerifiedExact,true);}
console.log(JSON.stringify({passed:true,neverMerge:true,unqualified:true,records:7,decodedBytes:bytes,archiveBytes:packed.length,archiveSha256:sha(packed),archivedCodeExecuted:false,nativeAcceptance:false}));
