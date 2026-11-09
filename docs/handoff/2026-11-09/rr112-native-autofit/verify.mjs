import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const directory=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(directory,'../../../..');
const require=createRequire(path.join(root,'packages/pptx/package.json')),{unzipSync}=require('fflate');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(readFileSync(path.join(directory,'checks.json'),'utf8')),archive=readFileSync(path.join(directory,'checks.zip'));
assert.equal(sha(archive),manifest.zipSHA256);assert.equal(archive.length,manifest.zipBytes);
const files=unzipSync(archive);assert.deepEqual(Object.keys(files).sort(),manifest.files.map(item=>item.path).sort());
for(const item of manifest.files){assert.ok(!item.path.startsWith('/')&&!item.path.split('/').includes('..'));assert.equal(files[item.path].length,item.bytes,item.path);assert.equal(sha(files[item.path]),item.sha256,item.path);}
assert.equal(Object.values(files).reduce((sum,file)=>sum+file.length,0),manifest.rawBytes);
const json=name=>JSON.parse(new TextDecoder().decode(files[name]));
const proof=json('raw/source-proof.json'),env={...process.env,GIT_NO_LAZY_FETCH:'1'},git=args=>execFileSync('git',args,{cwd:root,env,encoding:'utf8',maxBuffer:64*1024*1024}).trim();
assert.equal(proof.head,'373d472f8d7d1be73cd4518a79a655fecc204979');assert.equal(git(['rev-parse',proof.head+'^{tree}']),proof.tree);
execFileSync('git',['merge-base','--is-ancestor',proof.head,'HEAD'],{cwd:root,env});
for(const item of proof.protectedObjects)assert.equal(git(['rev-parse','HEAD:'+item.path]),item.object,item.path);
for(const item of proof.payload){const expected=item.path==='packages/pptx/README.md'?manifest.documentation.readmeBlob:item.blob;assert.equal(git(['rev-parse','HEAD:'+item.path]),expected,item.path);}
execFileSync('git',['merge-base','--is-ancestor',manifest.documentation.head,'HEAD'],{cwd:root,env});
assert.equal(git(['rev-parse',manifest.documentation.head+':packages/pptx/README.md']),manifest.documentation.readmeBlob);
const changes=git(['diff','--name-only',proof.base,'HEAD']).split('\n').filter(Boolean);
for(const file of changes)assert.ok(proof.ownedPaths.includes(file)||file.startsWith('docs/handoff/2026-11-09/rr112-native-autofit/'),file);
for(const item of proof.baseline.files){const actual=execFileSync('git',['show',proof.base+':'+item.path],{cwd:root,env,maxBuffer:64*1024*1024});assert.equal(sha(actual),item.sha256,item.path);}
assert.equal(json('raw/baseline-probe.exit.json').exitCode,1,'Original actual public RED');
assert.equal(json('raw/before-final.exit.json').exitCode,1,'Exact-source baseline regression RED');
const peerBefore=json('raw/peer-before-01/results.json');assert.equal(peerBefore.cases.filter(item=>item.passed).length,34);assert.equal(peerBefore.cases.length,36);
const after=json('raw/after-05/results.json');assert.equal(after.cases.length,36);assert.ok(after.cases.every(item=>item.passed));assert.equal(json('raw/after-test-05.exit.json').exitCode,0);
assert.deepEqual(json('raw/before-final/results.json').owned,after.owned,'Measured/native byte and import identities');
const focused=json('raw/focused-results.json');assert.equal(focused.rows.length,7);assert.equal(focused.rows[0].exitCode,1);assert.ok(focused.rows.slice(1).every(item=>item.exitCode===0));
const mapped=json('raw/mapped-01.exit.json');assert.equal(mapped.head,proof.head);assert.equal(mapped.tree,proof.tree);assert.equal(mapped.exitCode,manifest.mapped.exitCode);
const rawLog=new TextDecoder().decode(files['raw/mapped-01.log']);assert.equal(rawLog,manifest.mapped.logText,'Literal original aggregate/table retained');
const tracker=json('raw/tracker-closed-step-01.json');assert.equal(sha(files['raw/tracker-closed-step-01.log']),tracker.sha256);
const hydration=json('raw/hydration.json');assert.equal(hydration.head,proof.base);
const qa=json('raw/portable-observations/receipt.json');assert.equal(qa.head,proof.head);assert.equal(qa.originalQA02.remainsFailed,true);assert.equal(json('raw/portable-qa-02.exit.json').exitCode,1);for(const item of qa.records){assert.equal(sha(files['raw/portable-observations/'+item.name+'.svg']),item.svgSHA256);assert.equal(sha(files['raw/portable-observations/'+item.name+'.png']),item.pngSHA256);}
const factor=json('raw/portable-observations/larger-factor-only-receipt.json');assert.equal(factor.head,proof.head);assert.equal(sha(files['raw/portable-observations/larger-100.svg']),factor.svg100SHA256);assert.equal(sha(files['raw/portable-observations/larger-100.png']),factor.png100SHA256);assert.deepEqual(factor.actual100.map(item=>item.fontSize),[48,32]);assert.deepEqual(factor.actual55.map(item=>item.fontSize),[26.4,17.6]);
if(existsSync(path.join(directory,'final-docs-checks.json'))){const tail=JSON.parse(readFileSync(path.join(directory,'final-docs-checks.json'),'utf8')),zip=readFileSync(path.join(directory,'final-docs-checks.zip'));assert.equal(sha(zip),tail.zipSHA256);const raw=unzipSync(zip);assert.deepEqual(Object.keys(raw).sort(),tail.files.map(item=>item.path).sort());for(const item of tail.files){assert.equal(raw[item.path].length,item.bytes);assert.equal(sha(raw[item.path]),item.sha256);}}
console.log(JSON.stringify({passed:true,source:proof.head,rawFiles:manifest.files.length,rawBytes:manifest.rawBytes,protectedObjects:proof.protectedObjects.length,frozenPayload:proof.payload.filter(item=>item.path!=='packages/pptx/README.md').length,qualifiedDocumentation:1,baselineFiles:proof.baseline.files.length,scope:'Offline transport/source/receipts only; strict mapped results remain literal, no native/release acceptance.'}));
