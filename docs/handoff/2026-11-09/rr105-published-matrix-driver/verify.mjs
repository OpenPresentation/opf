#!/usr/bin/env node
// Offline replay of the tested snapshot, never a new matrix/browser/native run.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../..');
const{unzipSync}=createRequire(path.join(root,'packages/pptx/package.json'))('fflate');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(readFileSync(path.join(here,'files.json'),'utf8')),receipt=JSON.parse(readFileSync(path.join(here,'receipt.json'),'utf8'));
const raw=readFileSync(path.join(here,'raw.zip'));assert.equal(raw.length,manifest.bytes);assert.ok(raw.length<8*1024*1024);assert.equal(sha(raw),manifest.sha256);
const expected=new Map(manifest.members.map(file=>[file.file,file]));assert.equal(expected.size,manifest.members.length);const seen=new Set();let expanded=0;
const files=unzipSync(raw,{filter:file=>{assert.ok(!file.name.startsWith('/')&&!file.name.includes('\\')&&file.name.split('/').every(p=>p&&p!=='.'&&p!=='..'));assert.ok(!seen.has(file.name));seen.add(file.name);const entry=expected.get(file.name);assert.ok(entry);assert.equal(file.originalSize,entry.bytes);assert.ok(file.originalSize<4*1024*1024);expanded+=file.originalSize;assert.ok(expanded<32*1024*1024);return true;}});
assert.equal(seen.size,expected.size);for(const[file,entry]of expected){assert.equal(files[file].length,entry.bytes);assert.equal(sha(files[file]),entry.sha256);}
const json=file=>JSON.parse(Buffer.from(files[file]).toString('utf8'));const driver=json('raw/published033-out/driver.json'),installed=json('raw/published033-out/installed.json'),report=json('raw/published033-out/report.json'),digests=json('raw/published033-out/digests.json');
assert.equal(receipt.source,'bf0096079e67d679297a47b59d4d2682b0ff7ddf');assert.equal(driver.driver.head,receipt.source);assert.equal(receipt.fullMatrix.exitCode,0);assert.equal(json('raw/full-published033-01.exit.json').exitCode,0);assert.equal(json('raw/check-changed-01.exit.json').exitCode,1);assert.equal(receipt.requiredCheck.passed,15);assert.equal(receipt.requiredCheck.failed,5);assert.equal(receipt.noRestorationPerformed,true);assert.equal(receipt.nativeOfficeRuns,0);
assert.equal(report.decks,57);assert.equal(report.factors.length,14);assert.equal(report.states.length,264);assert.equal(report.chartPaths.length,27);assert.equal(digests.states,291);assert.equal(Object.keys(digests.digests).length,291);assert.equal(Object.keys(digests.digests).filter(key=>key.startsWith('chart:')).length,27);assert.equal(installed.registryTag,'latest');assert.equal(Object.keys(installed.packages).length,5);
for(const[name,entry]of Object.entries(installed.packages)){assert.equal(entry.version,'0.33.0');assert.equal(entry.gitHead,'26fd4de9cee7e57f9e0620eddcad2dcef04e00e3');assert.equal(driver.consumer.packages[name].integrity,entry.integrity);}
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
for(const file of driver.driver.files){assert.equal(git('rev-parse',`${receipt.source}:${file.path}`),file.gitBlob);const bytes=execFileSync('git',['show',`${receipt.source}:${file.path}`],{cwd:root,maxBuffer:2<<20});assert.equal(sha(bytes),file.sha256);assert.equal(sha(files['raw/published-harness/'+file.path]),file.sha256);}
const protectedSource=json('raw/protected-source.json');for(const entry of protectedSource.protectedObjects){assert.equal(git('rev-parse',`${receipt.source}:${entry.path}`),entry.object);assert.equal(git('rev-parse',`${receipt.base}:${entry.path}`),entry.object);}
for(const entry of json('raw/unchanged-windows-checks.json').files){assert.equal(git('rev-parse',`${receipt.source}:${entry.file}`),entry.gitBlob);assert.equal(git('rev-parse',`${receipt.base}:${entry.file}`),entry.gitBlob);}
assert.equal(sha(files['raw/published-harness/'+driver.fixture.path]),driver.fixture.sha256);
console.log(JSON.stringify({result:'PASS',testedDriver:receipt.source,publishedVersion:'0.33.0',rawFiles:expected.size,rawBytes:expanded,pairwiseDecks:57,fixedSwitches:18,states:264,localAggregate:'15PASS/5RED/typeSKIP retained',replayedSnapshotOnly:true,nativeAcceptance:false}));
