// Explicit source qualification only. This never establishes registry installability or publishes a package.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {lstatSync,mkdirSync,readFileSync,realpathSync,rmSync,symlinkSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {REPOSITORIES} from './ecosystem-lock.mjs';

export function candidateGalleryTrailer(body) {
  let fence=null;const values=[];
  for(const line of String(body??'').split(/\r?\n/)){
    const mark=/^\s*(`{3,}|~{3,})/.exec(line);
    if(mark){fence=fence===mark[1][0]?null:fence??mark[1][0];continue;}
    if(fence)continue;
    const match=/^\s*Candidate-Gallery:\s*(.*?)\s*$/i.exec(line);
    if(!match)continue;
    assert.match(match[1],/^OpenPresentation\/gallery@[0-9a-f]{40}$/,'Candidate-Gallery must name an exact gallery SHA');
    values.push(match[1].slice('OpenPresentation/gallery@'.length));
  }
  assert.ok(new Set(values).size<=1,'conflicting Candidate-Gallery trailers');
  return values[0];
}

export function galleryConfiguration(manifest,configuration){
  const required=manifest.opf?.requiresUnreleasedGallery;
  if(!configuration&&!required)return null;
  assert.equal(required,'2.0.0','candidate source must explicitly declare requiresUnreleasedGallery 2.0.0');
  assert.ok(configuration,'missing reviewed candidate-gallery configuration');
  assert.deepEqual(Object.keys(configuration).sort(),['gallery','version']);
  assert.equal(configuration.version,1);
  assert.deepEqual(Object.keys(configuration.gallery).sort(),['repository','sha','version']);
  assert.equal(configuration.gallery.repository,'OpenPresentation/gallery');
  assert.equal(configuration.gallery.version,required);
  assert.match(configuration.gallery.sha,/^[0-9a-f]{40}$/,'gallery SHA must be immutable');
  return {...configuration.gallery,catalogSchema:2};
}

export async function resolveCandidateGallery({manifest,configuration,event,ref='',input='',pullRequest,eventRepository,api}){
  const candidate=galleryConfiguration(manifest,configuration);
  if(!candidate){assert.equal(input,'','candidate input needs a reviewed source configuration');return null;}
  assert.ok(!ref.startsWith('refs/tags/'),'candidate gallery is forbidden on release tags');
  assert.ok(['pull_request','merge_group','workflow_dispatch'].includes(event),'candidate gallery is source qualification only; publish/schedule/push cannot use it');
  if(event==='workflow_dispatch')assert.equal(input,candidate.sha,'manual candidate SHA differs from reviewed source');
  else{
    assert.ok(pullRequest&&api,'candidate gallery requires the current pull request authorization');
    assert.ok(REPOSITORIES.some(name=>eventRepository===`OpenPresentation/${name}`),'unsupported CI event repository');
    assert.equal(pullRequest.repository,eventRepository,'pull request authorization must come from this CI event');
    assert.ok(Number.isSafeInteger(pullRequest.number)&&pullRequest.number>0,'invalid event pull request number');
    // No payload fallback: a stale PR body or an unreadable queue authorization must not select different data.
    const current=await api(`/repos/${pullRequest.repository}/pulls/${pullRequest.number}`);
    assert.equal(candidateGalleryTrailer(current.body),candidate.sha,'PR candidate SHA differs from reviewed source');
    if(input)assert.equal(input,candidate.sha,'candidate input conflicts with PR/source authorization');
  }
  return candidate;
}

export function readRegularJson(file){
  assert.equal(realpathSync(file),path.resolve(file),'aliased candidate data path');
  assert.ok(lstatSync(file).isFile(),'candidate data must be a regular file');
  return JSON.parse(readFileSync(file,'utf8'));
}
const git=(directory,...args)=>execFileSync('git',['-C',directory,...args],{encoding:'utf8'}).trim();
export function verifyGalleryCheckout(directory,candidate){
  assert.equal(realpathSync(directory),path.resolve(directory),'aliased gallery checkout');
  assert.equal(git(directory,'rev-parse','HEAD'),candidate.sha,'gallery checkout does not match reviewed SHA');
  assert.equal(git(directory,'diff','--name-only','HEAD'),'','tracked candidate source was modified');
  assert.equal(git(directory,'ls-files','--others','--exclude-standard'),'','untracked candidate source was introduced');
  const manifest=readRegularJson(path.join(directory,'package.json'));
  assert.equal(manifest.name,'@openpresentation/gallery');assert.equal(manifest.version,candidate.version);
  assert.equal(manifest.opf?.catalogSchema,candidate.catalogSchema);
  return manifest;
}
export function galleryMetadataDigests(directory){
  return Object.fromEntries(['package.json','package-lock.json'].map(file=>[file,createHash('sha256').update(readFileSync(path.join(directory,file))).digest('hex')]));
}
export function linkCandidateGallery({gallery,candidate,consumers}){
  verifyGalleryCheckout(gallery,candidate);
  const dist=path.join(gallery,'dist');
  assert.equal(realpathSync(dist),dist,'aliased candidate build output');
  const buildHash=createHash('sha256');
  const inspect=(directory)=>{for(const name of readdirSync(directory).sort()){
    const file=path.join(directory,name),stat=lstatSync(file);
    assert.ok(!stat.isSymbolicLink(),'candidate build output contains a symlink');
    if(stat.isDirectory())inspect(file);
    else{assert.ok(stat.isFile(),'nonregular candidate build output');buildHash.update(path.relative(dist,file)).update('\0').update(readFileSync(file)).update('\0');}
  }};
  inspect(dist);
  assert.ok(lstatSync(path.join(dist,'index.js')).isFile(),'build candidate gallery before linking');
  const before=galleryMetadataDigests(gallery);
  for(const directory of consumers){
    assert.equal(realpathSync(directory),path.resolve(directory),'aliased consumer checkout');
    const parent=path.join(directory,'node_modules/@openpresentation');mkdirSync(parent,{recursive:true});
    assert.equal(realpathSync(parent),parent,'aliased package parent');
    const target=path.join(parent,'gallery');rmSync(target,{recursive:true,force:true});symlinkSync(gallery,target,process.platform==='win32'?'junction':'dir');
  }
  assert.deepEqual(galleryMetadataDigests(gallery),before,'gallery linking changed manifest/lock metadata');
  return {gallery:candidate,metadata:before,builtDistSha256:buildHash.digest('hex'),consumers:consumers.map(directory=>path.resolve(directory)),qualification:'source-only; packed and registry qualification are separate'};
}
