import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,unlinkSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {preparePublishedHarness,consumerIdentity,assertComparablePublishedHosts} from './prepare-harness.mjs';
const head='a'.repeat(40),hash='b'.repeat(64),integrity='sha512-b25l';
const installed=()=>({registryTag:'latest',packages:Object.fromEntries(['opf','opf-render','opf-pptx','opf-editor','gallery'].map(name=>[`@openpresentation/${name}`,{version:'0.33.0',gitHead:head,integrity}]))});
const host=()=>{const i=installed();return{installed:i,driver:{schema:1,driver:{head:'c'.repeat(40),files:['scripts/test-font-switch-ecosystem.mjs','scripts/font-switch-list-fixture.mjs'].map(path=>({path,gitBlob:'d'.repeat(40),sha256:hash}))},fixture:{path:'docs/fixtures/image-treatments.opf.json',commit:head,gitBlob:'e'.repeat(40),sha256:hash},consumer:consumerIdentity(i)}};};
test('same driver and exact published set compare independently of platform metadata',()=>{const a=host(),b=host();a.installed.platform='linux';b.installed.platform='win32';assert.doesNotThrow(()=>assertComparablePublishedHosts({linux:a,windows:b}));});
test('missing/mixed driver, helper, release fixture or installed graph is refused before allowlists',()=>{
  for(const change of [h=>delete h.driver,h=>h.driver.driver.head='f'.repeat(40),h=>h.driver.driver.files.pop(),h=>h.driver.driver.files[1].sha256='f'.repeat(64),h=>h.driver.fixture.commit='f'.repeat(40),h=>h.installed.packages['@openpresentation/opf'].version='0.34.0',h=>h.installed.packages['@openpresentation/opf'].gitHead='f'.repeat(40),h=>h.installed.packages['@openpresentation/opf'].integrity='sha512-dHdv']){const other=host();change(other);assert.throws(()=>assertComparablePublishedHosts({linux:host(),windows:other}));}
});
test('a consistently different installed set still cannot compare with another OS',()=>{const other=host();other.installed.packages['@openpresentation/opf'].version='0.34.0';other.driver.consumer=consumerIdentity(other.installed);assert.throws(()=>assertComparablePublishedHosts({linux:host(),windows:other}),/mixed/);});
test('driver staging copies Git-owned current files and the installed core release fixture, refusing dirty source and reused output',()=>{
  const root=mkdtempSync(path.join(os.tmpdir(),'opf-harness-'));
  try{
    const repo=path.join(root,'repo'),consumer=path.join(root,'consumer');mkdirSync(repo);mkdirSync(consumer);
    const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8',stdio:['pipe','pipe','pipe']});
    git('init');git('config','user.name','OPF test');git('config','user.email','opf-test@example.invalid');
    for(const file of ['scripts/test-font-switch-ecosystem.mjs','scripts/font-switch-list-fixture.mjs','docs/fixtures/image-treatments.opf.json']){mkdirSync(path.dirname(path.join(repo,file)),{recursive:true});writeFileSync(path.join(repo,file),`initial ${file}\n`);}
    git('-c','core.autocrlf=false','add','.');git('commit','-m','released fixture');const released=git('rev-parse','HEAD').trim();
    const fixture=readFileSync(path.join(repo,'docs/fixtures/image-treatments.opf.json'));
    writeFileSync(path.join(repo,'scripts/test-font-switch-ecosystem.mjs'),'current fixed driver\n');writeFileSync(path.join(repo,'docs/fixtures/image-treatments.opf.json'),'unpublished fixture\n');git('-c','core.autocrlf=false','add','.');git('commit','-m','reviewed driver');
    const i=installed();for(const entry of Object.values(i.packages))entry.gitHead=released;writeFileSync(path.join(consumer,'installed.json'),JSON.stringify(i));
    const options={repo,consumer,output:path.join(root,'harness'),out:path.join(root,'out')};const proof=preparePublishedHarness(options);
    assert.equal(proof.driver.head,git('rev-parse','HEAD').trim());assert.equal(proof.fixture.commit,released);
    assert.ok(readFileSync(path.join(options.output,'docs/fixtures/image-treatments.opf.json')).equals(fixture));
    assert.equal(readFileSync(path.join(options.output,'scripts/test-font-switch-ecosystem.mjs'),'utf8'),'current fixed driver\n');assert.equal(JSON.parse(readFileSync(path.join(options.out,'driver.json'))).consumer.packages['@openpresentation/opf'].version,'0.33.0');
    assert.throws(()=>preparePublishedHarness(options),/fresh/);
    writeFileSync(path.join(repo,'scripts/font-switch-list-fixture.mjs'),'uncommitted change\n');assert.throws(()=>preparePublishedHarness({...options,output:path.join(root,'dirty')}),/uncommitted/);
    i.packages['@openpresentation/opf'].gitHead='f'.repeat(40);writeFileSync(path.join(consumer,'installed.json'),JSON.stringify(i));assert.throws(()=>preparePublishedHarness({...options,output:path.join(root,'unknown')}));
  }finally{assert.ok(path.resolve(root).startsWith(path.join(os.tmpdir(),'opf-harness-')));rmSync(root,{recursive:true,force:true});}
});

test('actual cross-OS CLI refuses mixed identities and still refuses missing digest sets',()=>{
 const root=mkdtempSync(path.join(os.tmpdir(),'opf-compare-'));
 try{
  const comparator=new URL('./compare.mjs',import.meta.url);
  const fixture=()=>({driver:host().driver,installed:installed(),consumer:{svg:hash,png:hash,pptx:hash},digests:{states:1,digests:{'pairwise-01 A':{pptx:hash,svg:hash,slides:['b'.repeat(16)],png:[hash]}}},determinism:{passed:true,node:'v24.20.0',icu:'77',unicode:'16',tzdata:'2026a',graphemeSignature:'abc'}});
  const hosts={linux:fixture(),windows:fixture()};
  const save=()=>{for(const[name,reports]of Object.entries(hosts)){const dir=path.join(root,'published-matrix-'+name);mkdirSync(dir,{recursive:true});for(const[file,data]of Object.entries(reports))writeFileSync(path.join(dir,file+'.json'),JSON.stringify(data));}};
  const run=()=>spawnSync(process.execPath,[fileURLToPath(comparator),root],{encoding:'utf8'});
  save();let result=run();assert.equal(result.status,0,result.stderr);
  hosts.windows.driver.driver.head='f'.repeat(40);save();result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/mixed driver/);
  hosts.windows=fixture();hosts.windows.installed.packages['@openpresentation/opf'].version='0.34.0';hosts.windows.driver.consumer=consumerIdentity(hosts.windows.installed);save();result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/mixed driver/);
  hosts.windows=fixture();save();unlinkSync(path.join(root,'published-matrix-windows/digests.json'));result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/need at least two operating systems/);
 }finally{assert.ok(path.resolve(root).startsWith(path.join(os.tmpdir(),'opf-compare-')));rmSync(root,{recursive:true,force:true});}
});
