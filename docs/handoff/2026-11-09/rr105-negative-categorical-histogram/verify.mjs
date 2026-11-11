import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../..');
const require=createRequire(path.join(root,'packages/pptx/package.json')),{unzipSync,strFromU8}=require('fflate');
const sharp=createRequire(path.join(root,'packages/render/package.json'))('sharp');
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(readFileSync(path.join(here,'manifest.json'))),zip=readFileSync(path.join(here,manifest.archive.path));
assert.ok(zip.length<10*1024*1024);assert.equal(zip.length,manifest.archive.bytes);assert.equal(sha(zip),manifest.archive.sha256);
const files=unzipSync(zip),names=Object.keys(files).sort();assert.equal(names.length,manifest.archive.members);assert.deepEqual(names,manifest.files.map(item=>item.path).sort());assert.equal(new Set(names.map(name=>name.toLowerCase())).size,names.length);
let total=0;for(const item of manifest.files){assert.ok(!path.isAbsolute(item.path)&&!item.path.includes('\\')&&item.path.split('/').every(part=>part&&part!=='.'&&part!=='..'));const b=files[item.path];assert.equal(b.length,item.bytes,item.path);assert.equal(sha(b),item.sha256,item.path);total+=b.length;}assert.equal(total,manifest.archive.expandedBytes);assert.ok(total<20*1024*1024);
const json=name=>JSON.parse(strFromU8(files[name]));
const facts=json('records/native-facts.json');assert.equal(facts.nativeAcceptance,false);assert.equal(facts.newOfficeRuns,0);assert.equal(facts.suiteSha256,'fd13b7725ea3b76717ec6976c9e12a7f6df9db5135818120cc026fa54c9c5d65');
for(const [index,label] of ['auto','fallback'].entries()){
 const item=facts.cases[index],prefix='observed/'+label+'/';assert.equal(item.phaseBytesEqual,true);const first=files[prefix+'original.png'];
 assert.deepEqual(files[prefix+'edited.png'],first);assert.deepEqual(files[prefix+'reopened.png'],first);for(const phase of item.phases)assert.equal(sha(files[prefix+phase.phase+'.png']),phase.sha256);
 const {data,info}=await sharp(first).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,1280);assert.equal(info.height,720);assert.equal(sha(data),item.rgbaSha256);
 let below=0;const xs=[];for(let x=100;x<1216;x++){let pixels=0;for(let y=150;y<=622;y++){const p=(y*info.width+x)*4;if(data[p]===49&&data[p+1]===137&&data[p+2]===195){pixels++;if(y>=500)below++;}}if(pixels)xs.push(x);}
 const runs=[];for(const x of xs){if(!runs.length||x>runs.at(-1)[1]+1)runs.push([x,x]);else runs.at(-1)[1]=x;}assert.deepEqual(runs,item.barFillColumnRuns);assert.equal(below,item.barFillPixelsY500to622);
 for(const archive of item.archives){const file=files[prefix+archive.label+'.pptx'];assert.equal(sha(file),archive.sha256);const parts=unzipSync(file);const chart=strFromU8(parts['ppt/charts/chart1.xml']);const values=kind=>{const block=chart.match(new RegExp('<c:'+kind+'[ >][\\s\\S]*?</c:'+kind+'>'))?.[0]??'';return [...block.matchAll(/<c:pt\b[^>]*>[\s\S]*?<c:v>([\s\S]*?)<\/c:v>[\s\S]*?<\/c:pt>/g)].map(([,value])=>value);};assert.deepEqual(values('cat'),['North','South','East','West']);assert.deepEqual(values('val'),['42','31','-8','19']);assert.equal(Object.keys(parts).filter(name=>/^ppt\/charts\/chartEx\d+\.xml$/.test(name)).length,label==='auto'?1:0);}
}
assert.equal(facts.cases[0].barFillColumnRuns.length,3);assert.equal(facts.cases[0].barFillPixelsY500to622,0);assert.equal(facts.cases[1].barFillColumnRuns.length,4);assert.equal(facts.cases[1].barFillPixelsY500to622,4400);
for(const mode of ['default','auto','native','fallback'])assert.deepEqual(files['candidate/representative/'+mode+'.pptx'],files['observed/fallback/input.pptx']);
assert.equal(sha(files['observed/fallback/input.pptx']),'b1dacc5a077cafa4d6f1c7e895c4a1dfb00f5675a012f9b9987b5ebea6756a3f');
for(const [label,archiveMember] of [['observed-auto.png','observed/auto/original.png'],['observed-fallback.png','observed/fallback/original.png'],['source-preview.png','source/primary.png']])assert.ok(Buffer.from(readFileSync(path.join(here,label))).equals(Buffer.from(files[archiveMember])),label+' exact archived bytes');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();assert.equal(git('rev-parse',manifest.source+'^{tree}'),manifest.tree);assert.equal(git('rev-parse',manifest.source+':packages/pptx/src'),git('rev-parse',manifest.runtimeTested+':packages/pptx/src'));
for(const target of ['spec','packages/javascript','packages/render','packages/pptx/vendor','packages/pptx/test/fixtures','scripts/native-acceptance/fixtures','.github','pnpm-lock.yaml','pnpm-workspace.yaml','package.json'])assert.equal(git('rev-parse',manifest.source+':'+target),git('rev-parse',manifest.base+':'+target),target+' unchanged');
assert.equal(manifest.nativeAcceptance,false);assert.equal(manifest.agentOfficeRuns,0);
const metadata=JSON.parse(readFileSync(path.join(here,'metadata-check.json'))),metadataZip=readFileSync(path.join(here,metadata.archive.path));
assert.equal(metadataZip.length,metadata.archive.bytes);assert.equal(sha(metadataZip),metadata.archive.sha256);const metadataFiles=unzipSync(metadataZip);assert.deepEqual(Object.keys(metadataFiles).sort(),metadata.files.map(item=>item.path).sort());for(const item of metadata.files){assert.equal(metadataFiles[item.path].length,item.bytes);assert.equal(sha(metadataFiles[item.path]),item.sha256);}assert.equal(metadata.status,'RED');assert.equal(metadata.passed,5);assert.equal(metadata.failed,2);
console.log(JSON.stringify({status:'PASS',source:manifest.source,members:names.length,bytes:total,exactExistingFallbackInEveryMode:true,nativeAcceptance:false,newOfficeRuns:0}));
