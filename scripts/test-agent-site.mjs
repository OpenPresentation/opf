import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const origin=process.env.OPF_SITE_ORIGIN??'http://localhost:3103';
async function get(url){const response=await fetch(new URL(url,origin));assert.equal(response.status,200,url);return response;}
const manifest=await (await get('/skills.json')).json();assert.equal(manifest.skills.length,6);assert.equal(manifest.license,'MIT');
let verified=0;
for(let at=0;at<manifest.files.length;at+=12)await Promise.all(manifest.files.slice(at,at+12).map(async file=>{
 const response=await get(file.url);assert.equal(response.headers.get('access-control-allow-origin'),'*');
 const bytes=new Uint8Array(await response.arrayBuffer());assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.url);verified++;
}));
for(const page of ['/agents','/docs/cli','/docs/agent-skills','/docs/dynamic-composition','/docs/data-import','/docs/live-editor','/docs/open-ecosystem']){
 const body=await (await get(page)).text();assert.match(body,/<h1/);assert.doesNotMatch(body,/This page could not be found/);
}
const index=await (await get('/llms.txt')).text();assert.ok(index.includes(manifest.sourceDigest));assert.ok(index.includes('/skills.json'));
const full=await (await get('/llms-full.txt')).text();assert.ok(full.includes('opf import-data'));assert.ok(full.includes('name: opf-author'));
const schema=await (await get('/schema/opf/v1')).json();assert.ok(schema.$defs.Composition);
const directory=await mkdtemp(path.join(tmpdir(),'opf-agent-download-'));
try{
 const archive=path.join(directory,'skills.tgz');await writeFile(archive,new Uint8Array(await (await get('/opf-agent-skills.tar.gz')).arrayBuffer()));
 const unpack=spawnSync('tar',['-xzf',archive,'-C',directory],{encoding:'utf8'});assert.equal(unpack.status,0,unpack.stderr);
 for(const skill of manifest.skills)for(const file of skill.files)assert.equal(createHash('sha256').update(await readFile(path.join(directory,file.path))).digest('hex'),file.sha256);
 const helper=spawnSync(process.execPath,[path.join(directory,'skills/opf-inspect/scripts/opf-inspect.mjs'),'version'],{cwd:directory,env:{...process.env,OPF_ROOT:path.resolve('.')},encoding:'utf8'});assert.equal(helper.status,0,helper.stderr);assert.equal(JSON.parse(helper.stdout).package,'@openpresentation/opf');
}finally{await rm(directory,{recursive:true,force:true});}
console.log(`Agent site passed: ${verified} raw file hashes, 6 portable downloaded skills, 7 guide pages, schema and text discovery endpoints.`);
