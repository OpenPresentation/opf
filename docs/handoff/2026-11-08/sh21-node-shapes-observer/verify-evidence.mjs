// Verify current source, explicit historical source copies and both lossless mock archives.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../..');
const {unzipSync}=createRequire(path.join(root,'packages/pptx/package.json'))('fflate');
const sha=b=>createHash('sha256').update(b).digest('hex');
const receipt=JSON.parse(fs.readFileSync(path.join(here,'receipt-final.json'),'utf8'));
function exact(bytes,record){assert.equal(bytes.length,record.bytes,record.path);assert.equal(sha(bytes),record.sha256,record.path);}
function archive(record){const b=fs.readFileSync(path.join(here,record.path));exact(b,record);const entries=unzipSync(b);assert.deepEqual(Object.keys(entries).sort(),record.files.map(x=>x.path).sort());for(const file of record.files)exact(Buffer.from(entries[file.path]),file);return entries;}
for(const file of receipt.sourceFiles)exact(fs.readFileSync(path.join(root,file.path)),file);
const finalEntries=archive(receipt.archive),parentBytes=fs.readFileSync(path.join(here,receipt.parent.path));exact(parentBytes,receipt.parent);const parent=JSON.parse(parentBytes);
archive(parent.archive);
for(const file of parent.sourceFiles){const copy=receipt.parent.changedSourceCopies[file.path];exact(copy?Buffer.from(finalEntries[copy]):fs.readFileSync(path.join(root,file.path)),file);}
assert.equal(receipt.officeConstructed,false);assert.equal(receipt.nativeAcceptance,false);assert.equal(parent.officeConstructed,false);
console.log(JSON.stringify({verified:true,currentSourceFiles:receipt.sourceFiles.length,finalArchiveFiles:receipt.archive.files.length,historicalArchiveFiles:parent.archive.files.length,officeConstructed:false,nativeAcceptance:false}));
