// Strict current/parent source and lossless evidence verification. This never runs Office.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../..');
const {unzipSync}=createRequire(path.join(root,'packages/pptx/package.json'))('fflate');
const sha=b=>createHash('sha256').update(b).digest('hex');
const receipt=JSON.parse(fs.readFileSync(path.join(here,'receipt-transport.json'),'utf8'));
function exact(bytes,record){assert.equal(bytes.length,record.bytes,record.path);assert.equal(sha(bytes),record.sha256,record.path);}
function archive(record){const b=fs.readFileSync(path.join(here,record.path));exact(b,record);const entries=unzipSync(b);assert.deepEqual(Object.keys(entries).sort(),record.files.map(x=>x.path).sort());for(const f of record.files)exact(Buffer.from(entries[f.path]),f);return entries;}
for(const file of receipt.sourceFiles)exact(fs.readFileSync(path.join(root,file.path)),file);
const entries=archive(receipt.archive),lane='tools/shapes/sh-21/node-shapes-observer';
const raw=gunzipSync(fs.readFileSync(path.join(root,lane,'observer-worker.ps1.gz'))),display=fs.readFileSync(path.join(root,lane,'observer-worker.ps1'));
assert.equal(sha(raw),receipt.qualifiedRawWorkerSha256);assert.equal(sha(display),receipt.readableGitWorkerSha256);assert.equal(display.toString('utf8'),raw.toString('utf8').replaceAll('\r\n','\n'));
let historicalFiles=0;
for(const record of receipt.parents){const b=fs.readFileSync(path.join(here,record.path));exact(b,record);const parent=JSON.parse(b);archive(parent.archive);historicalFiles+=parent.archive.files.length;for(const file of parent.sourceFiles){let bytes;if(file.path===lane+'/observer-worker.ps1')bytes=raw;else if(file.path===lane+'/derive-worker.mjs')bytes=Buffer.from(entries['artifacts/sh21-observer-transport-parent-01/derive-worker.mjs']);else if(file.path===lane+'/prepare-suite.mjs'||file.path==='packages/pptx/test/sh21-node-shapes-observer.mjs'){const folder=record.path==='receipt.json'?'sh21-observer-forward-parent-01':'sh21-observer-transport-parent-01';bytes=Buffer.from(entries['artifacts/'+folder+'/'+path.basename(file.path)]);}else bytes=fs.readFileSync(path.join(root,file.path));exact(bytes,file);}assert.equal(parent.nativeAcceptance,false);}
assert.equal(receipt.nativeRun,false);assert.equal(receipt.nativeAcceptance,false);assert(!fs.existsSync(path.join(root,lane,'.gitattributes')));
console.log(JSON.stringify({verified:true,currentSourceFiles:receipt.sourceFiles.length,transportArchiveFiles:receipt.archive.files.length,historicalArchiveFiles:historicalFiles,qualifiedRawWorkerSha256:sha(raw),readableGitSha256:sha(display),nativeRun:false}));
