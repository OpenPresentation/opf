import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url));
const env={...process.env,GIT_NO_LAZY_FETCH:'1'};
const root=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:here,encoding:'utf8',env}).trim();
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32<<20,env}).trim();
const sha=b=>createHash('sha256').update(b).digest('hex');
const {unzipSync}=createRequire(path.join(root,'packages/pptx/package.json'))('fflate');
const receipt=JSON.parse(fs.readFileSync(path.join(here,'checks.json'),'utf8'));
assert.equal(git('rev-parse',receipt.source+'^{tree}'),receipt.sourceTree);git('merge-base','--is-ancestor',receipt.source,'HEAD');
assert.deepEqual(git('diff','--name-only',receipt.base,receipt.source).split('\n').sort(),receipt.ownedPaths);
for(const {file,object}of receipt.protectedObjects)for(const ref of [receipt.base,receipt.source,'HEAD'])assert.equal(git('rev-parse',`${ref}:${file}`),object,ref+' protected '+file);
for(const {file,object}of receipt.sourceBindings)assert.equal(git('rev-parse',`HEAD:${file}`),object,'Frozen runtime/test '+file);
const prefix=path.relative(root,here).split(path.sep).join('/')+'/';
for(const file of git('diff','--name-only',receipt.source,'HEAD').split('\n').filter(Boolean))assert.ok(file.startsWith(prefix),'Only own evidence may follow frozen source: '+file);
const file='packages/javascript/src/composition.ts',overlap=receipt.compositionOverlap;
assert.equal(git('rev-parse',`${receipt.base}:${file}`),overlap.baselineObject);assert.equal(git('rev-parse',`${overlap.coordinator}:${file}`),overlap.baselineObject);assert.equal(git('rev-parse',`${receipt.source}:${file}`),overlap.sourceObject);
const selector=ref=>{const text=git('show',`${ref}:${file}`),start=text.indexOf('function composeArranged(');return text.slice(start,text.indexOf('\n/**',start));};
for(const ref of [receipt.base,receipt.source,overlap.coordinator])assert.equal(sha(selector(ref)),overlap.retainedSelectorSha256,'A selector unchanged '+ref);
assert.equal(git('diff','--unified=0',receipt.base,receipt.source,'--',file),overlap.diff);
const bytes=fs.readFileSync(path.join(here,'checks.zip'));assert.equal(bytes.length,receipt.archiveBytes);assert.equal(sha(bytes),receipt.archiveSha256);
const raw=unzipSync(bytes);assert.deepEqual(Object.keys(raw).sort(),receipt.files.map(row=>row.name));
let count=0;for(const row of receipt.files){assert.equal(raw[row.name].length,row.bytes,row.name);assert.equal(sha(raw[row.name]),row.sha256,row.name);count+=row.bytes;}
assert.equal(count,receipt.rawBytes);assert.equal(Object.keys(raw).length,receipt.rawFiles);
const json=name=>JSON.parse(Buffer.from(raw[name]).toString('utf8'));
for(const name of ['mapped/lh144-mapped-01.exit.json','mapped/lh144-peer-delta-01.exit.json','attempts/code-font-column-before.exit.json'])assert.equal(json(name).exitCode,1,name);
assert.equal(json('attempts/peer-controls-after.exit.json').exitCode,0);
const before=json('lh144-qa-portable-02/receipt.json').report[0],after=json('lh144-qa-portable-02/receipt.json').report[1];
assert.deepEqual(before.pages.map(row=>row.blocks),[3,2]);assert.deepEqual(after.pages.map(row=>row.blocks),[2,2,1]);assert.deepEqual(before.pages.map(row=>row.sizes),[[17],[22.667]]);assert.deepEqual(after.pages.map(row=>row.sizes),[[24],[24],[24]]);
const header=json('attempts/header-pixel-proof.json').rows;assert.equal(header[0].headerRawSha256,header[1].headerRawSha256);assert.equal(header[0].headerSvgSha256,header[1].headerSvgSha256);assert.ok(header.every(row=>row.brightHeaderPixels>0));
console.log(JSON.stringify({source:receipt.source,protectedObjects:receipt.protectedObjects.length,rawFiles:receipt.rawFiles,rawBytes:count,compositionBase:overlap.baselineObject,initialMappedExit:1,peerMappedExit:1,result:'Offline source/overlap and lossless evidence PASS; qualification aggregates remain RED until managed goldens/combined CI'}));

const finalPath=path.join(here,'final-docs-checks.json');
if(fs.existsSync(finalPath)){
 const final=JSON.parse(fs.readFileSync(finalPath,'utf8'));git('merge-base','--is-ancestor',final.source,'HEAD');assert.equal(git('rev-parse',final.source+'^{tree}'),final.sourceTree);
 const bytes=fs.readFileSync(path.join(here,'final-docs-checks.zip'));assert.equal(bytes.length,final.archiveBytes);assert.equal(sha(bytes),final.archiveSha256);
 const entries=unzipSync(bytes);assert.deepEqual(Object.keys(entries).sort(),final.files.map(row=>row.name));let total=0;
 for(const row of final.files){assert.equal(entries[row.name].length,row.bytes);assert.equal(sha(entries[row.name]),row.sha256);total+=row.bytes;}
 assert.equal(total,final.rawBytes);assert.equal(final.rawFiles,7);assert.equal(JSON.parse(Buffer.from(entries['run.exit.json']).toString('utf8')).exitCode,0);
 console.log(JSON.stringify({finalDocsSource:final.source,rawFiles:7,passedSteps:5,typecheckSkipped:1,result:'Final handoff-only qualification PASS; original runtime aggregates remain RED'}));
}
