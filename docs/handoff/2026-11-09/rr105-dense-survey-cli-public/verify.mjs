import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const folder=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(process.argv[2]??fileURLToPath(new URL('../../../../',import.meta.url)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifestBytes=fs.readFileSync(path.join(folder,'raw-files.json'));
assert.equal(sha(manifestBytes),'0ac11c903d2dc2d843be891926d7f4667aa4a910c9f844e77ffead0c2645ef47');
const manifest=JSON.parse(manifestBytes),raw=new Map(),archives=new Set();let bytes=0,compressedBytes=0;
assert.equal(manifest.publicSafe,true);assert.equal(manifest.neverMerge,true);assert.equal(manifest.count,269);
for(const item of manifest.files){assert.ok(item.path&&!path.isAbsolute(item.path)&&!item.path.split('/').includes('..'));assert.match(item.archive,/^raw\/\d{3}\.gz$/u);assert.ok(!raw.has(item.path)&&!archives.has(item.archive));archives.add(item.archive);assert.ok(item.bytes<=16*1024*1024);const zipped=fs.readFileSync(path.join(folder,item.archive));assert.equal(zipped.length,item.compressedBytes);assert.equal(sha(zipped),item.compressedSha256);const value=gunzipSync(zipped,{maxOutputLength:item.bytes+1});assert.equal(value.length,item.bytes);assert.equal(sha(value),item.sha256,item.path);raw.set(item.path,value);bytes+=value.length;compressedBytes+=zipped.length;}
assert.equal(raw.size,269);assert.equal(bytes,1764208);assert.equal(bytes,manifest.bytes);assert.equal(compressedBytes,manifest.compressedBytes);
const json=name=>JSON.parse(raw.get(name).toString('utf8').replace(/^\uFEFF/u,'')),text=name=>raw.get(name).toString('utf8');
const source='623e4dbc1c958132ae055b2c544e8f3b986fe85d',base='bcfc13037c860476cc61034e84d8cd1e94226253';
const proof=json('source/identity.json');assert.ok(raw.get('source/identity.json').equals(fs.readFileSync(path.join(folder,'source-proof.json'))));assert.equal(proof.source,source);assert.equal(proof.base,base);assert.equal(proof.sourceTree,'4d0bccb377e1002caa2ee176bbf09e08b911d938');
const git=(...args)=>execFileSync('git',args,{cwd:repo,env:{...process.env,GIT_NO_LAZY_FETCH:'1'},maxBuffer:8*1024*1024});
assert.equal(git('rev-parse',source+'^{tree}').toString().trim(),proof.sourceTree);assert.equal(Object.keys(proof.owned).length,5);assert.equal(Object.keys(proof.protectedObjects).length,13);
for(const [file,oid]of Object.entries({...proof.owned,...proof.protectedObjects}))assert.equal(git('rev-parse',source+':'+file).toString().trim(),oid,file);
for(const [file,oid]of Object.entries(proof.protectedObjects))assert.equal(git('rev-parse',base+':'+file).toString().trim(),oid,file+' unchanged');
assert.deepEqual(git('diff','--name-only',base,source).toString().trim().split('\n'),Object.keys(proof.owned));
const modulePath='scripts/native-acceptance/dense-survey-contract.mjs',testPath='scripts/native-acceptance/dense-survey-contract.test.mjs';
const before=git('show',base+':'+modulePath).toString(),after=git('show',source+':'+modulePath).toString();
assert.equal(after,before.replace('/^--[a-z-]+$/u','/^--[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u'),'exact single grammar correction');
const oldTests=git('show',base+':'+testPath),newTests=git('show',source+':'+testPath);assert.ok(newTests.subarray(0,oldTests.length).equals(oldTests),'all original19 controls byte-exact prefix');
assert.equal(json('correction/root-original-create/create-exit.json').exitCode,1);assert.equal(json('correction/root-original-create/create-exit.json').OfficeCalls,0);
assert.equal(json('correction/before-public-cli-01.exit.json').status,1);assert.ok(text('correction/before-public-cli-01.log').includes('/^--[a-z-]+$/u'));assert.ok(json('correction/child-cli-receipts/dense-public-cli-receipts-BLqt0q/001-create-valid.json').args.includes('--expected-manifest-sha256'));
assert.equal(json('correction/after-public-cli-02.exit.json').status,0);assert.match(text('correction/after-public-cli-02.log'),/pass 22/u);assert.match(text('correction/after-public-cli-02.log'),/fail 0/u);
assert.equal(json('correction/lint-03.exit.json').status,0);
assert.equal(json('correction/mapped-01.exit.json').status,1);assert.match(text('correction/mapped-01.log'),/3 of 11 steps failed/u);assert.match(text('correction/mapped-01.log'),/no .ts, .mts or tsconfig change/u);
assert.match(text('mapped-original-steps/pnpm_run_check_native-acceptance.log'),/pass 83/u);assert.match(text('mapped-original-steps/pnpm_run_check_native-acceptance.log'),/fail 4/u);assert.match(text('mapped-original-steps/pnpm_run_check_gallery-tracker.log'),/pass 9/u);assert.match(text('mapped-original-steps/pnpm_run_check_text.log'),/painting-Linux.json.gz/u);
const groups=json('correction/child-cli-groups.json');assert.deepEqual(groups.map(item=>item.commands),[1,31]);let commands=0;
for(const item of groups){const prefix='correction/child-cli-receipts/'+item.directory+'/';const receipts=[...raw.keys()].filter(name=>name.startsWith(prefix)&&name.endsWith('.json'));assert.equal(receipts.length,item.commands);for(const name of receipts){const record=json(name);for(const channel of ['stdout','stderr']){const channelName=name.slice(0,-5)+'.'+channel+'.log',value=raw.get(channelName);assert.ok(value,channelName);assert.match(record.controllerCodeSha256,/^[a-f0-9]{64}$/u);assert.match(record.scope,/no Office/u);}commands++;}}
assert.equal(commands,32);
const flow=json('real-pure-flow/flow-receipt.json');assert.equal(flow.source,source);assert.equal(flow.suiteFiles,339);assert.equal(flow.suiteManifestSha256,'fd13b7725ea3b76717ec6976c9e12a7f6df9db5135818120cc026fa54c9c5d65');assert.deepEqual(flow.steps.map(item=>[item.name,item.status]),[['create',0],['verify',0],['default-pure',0]]);assert.equal(flow.OfficeCalls,0);assert.equal(flow.noNativeDirectory,true);
const envelope=raw.get('real-pure-flow/execution-envelope.json');assert.equal(sha(envelope),'bbdb04137845ec16b2bdfc0bee4acf6e6e9ace57075f67c8bd09ddcea99a5040');assert.equal(flow.envelopeSha256,sha(envelope));
const runner=json('real-pure-flow/default-pure-attempt/runner.json');assert.equal(runner.status,'pure-checks-completed; native-not-run');assert.equal(runner.runOfficeRequested,false);assert.equal(runner.nativeAcceptance,false);assert.equal(runner.registryAcceptance,false);assert.equal(runner.timeoutSeconds,45);
for(const phase of ['create','verify','default-pure']){const receipt=json('real-pure-flow/'+phase+'.exit.json');assert.equal(receipt.status,0);assert.ok(!receipt.args.includes('-RunOffice'));for(const channel of ['stdout','stderr']){const value=raw.get('real-pure-flow/'+phase+'.'+channel+'.log');assert.equal(value.length,receipt[channel].bytes);assert.equal(sha(value),receipt[channel].sha256);}}
assert.ok(![...raw.keys()].some(name=>name.startsWith('real-pure-flow/default-pure-attempt/native/')||name.endsWith('/native-worker.log')||name.endsWith('/dense-survey-observation.json')));
assert.equal(raw.get('source/status.txt').length,0);
console.log(JSON.stringify({verified:true,publicSafe:true,neverMerge:true,source,rawFiles:raw.size,rawBytes:bytes,childCommands:commands,sourcePaths:5,protectedObjects:13,qualification:'22 controls and real public default-pure PASS; required mapped original7PASS/3sparseFAIL/TSskip; OfficeCalls0/native acceptance not claimed'}));

const metadataBytes=fs.readFileSync(path.join(folder,'metadata-files.json'));assert.equal(sha(metadataBytes),'e6aaa5d31abc016475273aae23718fd1f8de37ae05d8561fb8f4916cd3a4b02d');const metadata=JSON.parse(metadataBytes),metadataRaw=new Map();let metadataSize=0,metadataCompressed=0;
for(const item of metadata.files){assert.ok(item.path&&!path.isAbsolute(item.path)&&!item.path.split('/').includes('..'));assert.match(item.archive,/^metadata\/\d{3}\.gz$/u);assert.ok(!metadataRaw.has(item.path));const zipped=fs.readFileSync(path.join(folder,item.archive));assert.equal(zipped.length,item.compressedBytes);assert.equal(sha(zipped),item.compressedSha256);const value=gunzipSync(zipped,{maxOutputLength:item.bytes+1});assert.equal(value.length,item.bytes);assert.equal(sha(value),item.sha256);metadataRaw.set(item.path,value);metadataSize+=value.length;metadataCompressed+=zipped.length;}
assert.equal(metadataRaw.size,11);assert.equal(metadataSize,31401);assert.equal(metadataSize,metadata.bytes);assert.equal(metadataCompressed,metadata.compressedBytes);const identity=JSON.parse(metadataRaw.get('identity.json'));assert.equal(identity.source,source);assert.equal(identity.testedHead,'8955624538e246fbe1cef384f8663430e06f7820');assert.equal(git('rev-parse',identity.testedHead+'^{tree}').toString().trim(),identity.testedTree);for(const [file,oid]of Object.entries(identity.qualifiedInputs))assert.equal(git('rev-parse',identity.testedHead+':'+file).toString().trim(),oid,file);assert.equal(JSON.parse(metadataRaw.get('evidence-setup-01.exit.json')).status,0);assert.equal(JSON.parse(metadataRaw.get('evidence-metadata-01.exit.json')).status,1);assert.match(metadataRaw.get('evidence-metadata-01.log').toString(),/1 of 6 steps failed: pnpm run check:text/u);assert.match(metadataRaw.get('step/pnpm_run_check_text.log').toString(),/painting-Linux.json.gz/u);console.log(JSON.stringify({metadataFiles:metadataRaw.size,metadataBytes:metadataSize,testedHead:identity.testedHead,result:'4PASS/1missingTextInputFAIL/typesSKIP; no retry/restoration or native execution'}));
