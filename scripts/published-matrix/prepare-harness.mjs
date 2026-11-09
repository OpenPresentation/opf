import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const SHA=/^[a-f0-9]{40}$/u, HASH=/^[a-f0-9]{64}$/u;
const DRIVER_FILES=['scripts/test-font-switch-ecosystem.mjs','scripts/font-switch-list-fixture.mjs'];
const FIXTURE='docs/fixtures/image-treatments.opf.json';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function consumerIdentity(installed) {
  assert.match(installed.registryTag,/^[A-Za-z0-9][A-Za-z0-9._-]*$/u,'registry plan tag required');
  const packages={};
  for(const name of Object.keys(installed.packages).sort()){
    const entry=installed.packages[name];
    assert.match(entry.version,/^\d+\.\d+\.\d+$/u,`${name}: exact registry version required`);
    assert.match(entry.gitHead,SHA,`${name}: exact published gitHead required`);
    assert.match(entry.integrity,/^sha512-[A-Za-z0-9+/]+={0,2}$/u,`${name}: registry integrity required`);
    packages[name]={version:entry.version,gitHead:entry.gitHead,integrity:entry.integrity};
  }
  for(const name of ['opf','opf-render','opf-pptx','opf-editor'])assert.ok(packages[`@openpresentation/${name}`],`${name}: consumer required`);
  return {tag:installed.registryTag,packages};
}
export function preparePublishedHarness({repo,consumer,output,out}) {
  const git=(...args)=>execFileSync('git',args,{cwd:repo,maxBuffer:8*1024*1024});
  const head=git('rev-parse','HEAD').toString().trim();assert.match(head,SHA);
  const installed=JSON.parse(readFileSync(path.join(consumer,'installed.json'),'utf8'));
  const identity=consumerIdentity(installed), fixtureRef=identity.packages['@openpresentation/opf'].gitHead;
  assert.ok(!existsSync(output),'fresh harness output required');
  const files=DRIVER_FILES.map(file=>{
    const bytes=git('show',`${head}:${file}`);
    assert.ok(readFileSync(path.join(repo,file)).equals(bytes),`uncommitted driver refused: ${file}`);
    const gitBlob=git('rev-parse',`${head}:${file}`).toString().trim();assert.match(gitBlob,SHA);
    return {path:file,gitBlob,sha256:sha(bytes),bytes};
  });
  const fixture=git('show',`${fixtureRef}:${FIXTURE}`),fixtureBlob=git('rev-parse',`${fixtureRef}:${FIXTURE}`).toString().trim();assert.match(fixtureBlob,SHA);
  for(const file of [...files,{path:FIXTURE,bytes:fixture}]){const destination=path.join(output,file.path);mkdirSync(path.dirname(destination),{recursive:true});writeFileSync(destination,file.bytes,{flag:'wx'});assert.ok(readFileSync(destination).equals(file.bytes));}
  const proof={schema:1,driver:{head,files:files.map(({bytes,...file})=>file)},fixture:{commit:fixtureRef,path:FIXTURE,gitBlob:fixtureBlob,sha256:sha(fixture)},consumer:identity};
  mkdirSync(out,{recursive:true});writeFileSync(path.join(out,'driver.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
  return proof;
}
export function assertComparablePublishedHosts(hosts) {
  const names=Object.keys(hosts).sort();assert.ok(names.length>=2,'At least two host reports are required');let baseline;
  for(const name of names){
    const proof=hosts[name].driver;assert.equal(proof?.schema,1,`${name}: driver provenance required`);assert.match(proof.driver.head,SHA);
    assert.deepEqual(proof.driver.files.map(file=>file.path),DRIVER_FILES,`${name}: complete driver files required`);
    for(const file of proof.driver.files){assert.match(file.gitBlob,SHA);assert.match(file.sha256,HASH);}
    assert.equal(proof.fixture.path,FIXTURE);assert.match(proof.fixture.commit,SHA);assert.match(proof.fixture.gitBlob,SHA);assert.match(proof.fixture.sha256,HASH);
    assert.deepEqual(proof.consumer,consumerIdentity(hosts[name].installed),`${name}: driver/installed consumer mismatch`);
    assert.equal(proof.fixture.commit,proof.consumer.packages['@openpresentation/opf'].gitHead,`${name}: fixture is not the published core source`);
    if(baseline)assert.deepEqual(proof,baseline,`${name}: mixed driver, fixture or consumer identities`);else baseline=proof;
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [consumer,output,out]=process.argv.slice(2);assert.ok(consumer&&output&&out,'usage: prepare-harness.mjs <consumer> <fresh-harness> <out>');
  const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
  console.log(JSON.stringify(preparePublishedHarness({repo,consumer:path.resolve(consumer),output:path.resolve(output),out:path.resolve(out)})));
}
