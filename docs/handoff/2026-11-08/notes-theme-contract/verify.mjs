import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),prefix='docs/handoff/2026-11-08/notes-theme-contract/',ref=process.argv[2]??'HEAD';
const receipt=JSON.parse(readFileSync(new URL('./receipt.json',import.meta.url),'utf8')),git=args=>execFileSync('git',args,{cwd:root,maxBuffer:32*1024*1024}),blob=(p,r=ref)=>git(['show',r+':'+p]),hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(hash(blob(prefix+'verify.mjs')),receipt.verifierSha256);
for(const item of receipt.source){assert.equal(hash(blob(item.path)),item.sha256,item.path);assert.equal(hash(blob(item.path,receipt.testedSource)),item.sha256,item.path+' frozen source');}
for(const item of receipt.protected)for(const revision of[receipt.base,receipt.testedSource,ref])assert.equal(git(['rev-parse',revision+':'+item.path]).toString().trim(),item.gitObject,item.path+' protected');
for(const item of receipt.artifacts){assert.ok(item.path.startsWith(prefix));const bytes=blob(item.path);assert.equal(bytes.length,item.bytes);assert.equal(hash(bytes),item.sha256,item.path);if(item.rawSha256)assert.equal(hash(gunzipSync(bytes)),item.rawSha256,item.path+' original raw bytes');}
const provenance=JSON.parse(blob(prefix+'before-provenance.json'));assert.equal(hash(blob(provenance.archive.path)),provenance.archive.sha256);assert.equal(provenance.archive.sha256,provenance.producer67);assert.equal(provenance.archive.sha256,provenance.producerC2da);
const raw=p=>gunzipSync(blob(prefix+p)).toString(),mapped=raw('mapped-b42a49153.log.gz'),pptx=raw('mapped-tests_pptx.log.gz');assert.match(mapped,/check-changed: passed/);assert.match(mapped,/typecheck\s+skipped/);assert.match(mapped,/total\s+110\.6 s/);
const actual=JSON.parse(pptx.trim().split(/\r?\n/).at(-1));assert.equal(actual.passed,true);assert.equal(actual.decks,3);assert.equal(actual.corpus,147);assert.deepEqual(actual.expectedThemeCounts,[2,4]);assert.equal(actual.negativeControls,6);
assert.match(raw('release-doc-before.log.gz'),/actual: 6/);assert.match(raw('release-doc-before.log.gz'),/expected: 7/);assert.match(raw('release-doc-after.log.gz'),/pass 26/);assert.match(raw('release-doc-after.log.gz'),/fail 0/);
console.log(JSON.stringify({verified:true,ref,source:receipt.source.length,protected:receipt.protected.length,artifacts:receipt.artifacts.length,handDecks:actual.decks,corpus:actual.corpus,negativeControls:actual.negativeControls,mapped:'13 passed + correct no-TS skip'}));
