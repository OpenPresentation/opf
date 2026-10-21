// Explicit source qualification only. This never establishes registry installability or publishes a package.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {lstatSync,mkdirSync,readFileSync,realpathSync,rmSync,symlinkSync,readdirSync,existsSync,appendFileSync} from 'node:fs';
import path from 'node:path';
import {REPOSITORIES,pullRequestOfEvent,githubApi} from './ecosystem-lock.mjs';
import {fileURLToPath} from 'node:url';

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

// Each reviewed configuration version names the one Gallery release it stages and, from version 2, the catalog contract
// (opf.catalogSchema) that release targets: 1 is Gallery 2, 2 is Gallery 3 (nested area arrays), 3 is Gallery 5 (FA-33,
// layouts as one list of regions).
const CONTRACTS={1:{gallery:'2.0.0'},2:{gallery:'3.0.0',catalogSchema:3},3:{gallery:'5.0.0',catalogSchema:4}};
export function galleryConfiguration(manifest,configuration){
  const required=manifest.opf?.requiresUnreleasedGallery;
  if(configuration===undefined&&!Object.hasOwn(manifest.opf??{},'requiresUnreleasedGallery'))return null;
  assert.ok(configuration,'missing reviewed candidate-gallery configuration');
  assert.deepEqual(Object.keys(configuration).sort(),['gallery','version']);
  const contract=Object.hasOwn(CONTRACTS,configuration.version)?CONTRACTS[configuration.version]:undefined;
  assert.ok(contract,'unsupported candidate configuration version');
  const current=contract.catalogSchema!==undefined;
  assert.equal(required,contract.gallery,'candidate source must explicitly declare the reviewed Gallery version');
  assert.deepEqual(Object.keys(configuration.gallery).sort(),current?['catalogSchema','repository','sha','version']:['repository','sha','version']);
  assert.equal(configuration.gallery.repository,'OpenPresentation/gallery');
  assert.equal(configuration.gallery.version,required);
  if(current)assert.equal(configuration.gallery.catalogSchema,contract.catalogSchema,`candidate configuration version ${configuration.version} requires catalog contract ${contract.catalogSchema}`);
  assert.match(configuration.gallery.sha,/^[0-9a-f]{40}$/,'gallery SHA must be immutable');
  return {...configuration.gallery,catalogSchema:current?contract.catalogSchema:2};
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
export function optionalRegularJson(file){
  try{lstatSync(file);}catch(error){if(error.code==='ENOENT')return undefined;throw error;}
  return readRegularJson(file);
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
  return Object.fromEntries(['package.json','package-lock.json'].map(file=>{const target=path.join(directory,file);readRegularJson(target);return [file,createHash('sha256').update(readFileSync(target)).digest('hex')];}));
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

const defaultRegistry = async (name, version) => {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`);
  assert.ok(response.ok, `published control registry lookup failed: ${response.status}`);
  return response.json();
};
const STABLE = /^(\d+)\.(\d+)\.(\d+)$/;
const stableParts = version => STABLE.exec(version ?? '')?.slice(1).map(Number);
// The plan is a floor, not an equality: a patch release that lands after the plan was written must not block every in-flight
// candidate-gallery pull request (RR-101). A package accepts the plan's major.minor with a patch >= the plan's; the independent
// gallery accepts the plan's major with a minor/patch >= the plan's. A new minor (or major) of a package, and anything lower,
// still needs a deliberate plan refresh, so a registry `latest` that is not covered by the reviewed plan fails as before.
export function publishedControlFloor(planVersion, latestVersion, {independent = false} = {}) {
  const [major, minor, patch] = stableParts(planVersion) ?? [], latest = stableParts(latestVersion);
  if (!latest || major === undefined || latest[0] !== major) return false;
  if (independent) return latest[1] > minor || (latest[1] === minor && latest[2] >= patch);
  return latest[1] === minor && latest[2] >= patch;
}
const GIT_HEAD = /^[0-9a-f]{40}$/;
// Resolves the plan against the registry: the refs the published source must be checked out at, and a RESOLVED plan (the
// reviewed plan with versions and verification refs raised to the registry's `latest` where it is a newer accepted release).
export async function resolvePublishedControl(plan, registry = defaultRegistry, notice = message => console.log(message)) {
  const resolved = structuredClone(plan), refs = {};
  const resolve = async ({name, planVersion, planRef, independent, strictRef}) => {
    assert.match(planVersion ?? '', STABLE, independent ? 'published control needs an exact independent gallery version' : 'published control needs a stable exact version');
    if (strictRef) assert.match(planRef ?? '', GIT_HEAD, 'published control needs an immutable source SHA');
    const current = await registry(name, 'latest');
    if (current.version === planVersion) {
      const metadata = await registry(name, planVersion);
      assert.equal(metadata.name, name); assert.equal(metadata.version, planVersion);
      if (strictRef) assert.equal(metadata.gitHead, planRef, 'published control source does not match registry gitHead');
      return {version: planVersion, ref: planRef};
    }
    assert.ok(publishedControlFloor(planVersion, current.version, {independent}), `published control requires the current reviewed stable registry graph: ${name} registry latest ${current.version} is not ${planVersion} or a newer release the plan accepts; refresh release-plan.json`);
    const metadata = await registry(name, current.version);
    assert.equal(metadata.name, name); assert.equal(metadata.version, current.version);
    assert.match(metadata.gitHead ?? '', GIT_HEAD, `published control needs a 40 hex gitHead for ${name}@${current.version}`);
    notice(`::notice::plan is behind registry: ${name} ${planVersion} -> ${current.version}`);
    return {version: current.version, ref: metadata.gitHead};
  };
  for (const repository of [...REPOSITORIES, 'cli']) {
    const name = `@openpresentation/${repository}`, item = resolved.packages?.find(entry => entry.name === name);
    const {version, ref} = await resolve({name, planVersion: item?.version, planRef: plan.verificationRefs?.[repository], strictRef: true});
    item.version = version; resolved.verificationRefs[repository] = ref; refs[repository] = ref;
  }
  const gallery = resolved.independentPackages?.find(entry => entry.name === '@openpresentation/gallery');
  const {version, ref} = await resolve({name: gallery?.name, planVersion: gallery?.version, planRef: plan.verificationRefs?.gallery, independent: true, strictRef: false});
  if (version !== gallery.version) { gallery.version = version; resolved.verificationRefs.gallery = ref; }
  return {refs, plan: resolved};
}

export async function publishedGalleryControl(plan, registry) {
  return (await resolvePublishedControl(plan, registry)).refs;
}

export function assertPublishedGallery(manifest,configuration){
  assert.ok(!Object.hasOwn(manifest.opf??{},'requiresUnreleasedGallery')&&configuration===undefined,'unresolved candidate gallery cannot qualify release, tag, registry or publication');
  if(manifest.name==='@openpresentation/opf'&&/^0\.19\./.test(manifest.version??''))assert.match(manifest.dependencies?.['@openpresentation/gallery']??'',/^\^2\.\d+\.\d+$/,'core 0.19 publication requires an actual gallery ^2 registry dependency');
  if(manifest.name==='@openpresentation/opf'&&/^0\.20\./.test(manifest.version??''))assert.match(manifest.dependencies?.['@openpresentation/gallery']??'',/^\^3\.\d+\.\d+$/,'core 0.20 publication requires an actual gallery ^3 registry dependency');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const command=process.argv[2],root=path.resolve(process.env.CANDIDATE_CORE_ROOT??'.');
  const manifest=readRegularJson(path.join(root,'packages/javascript/package.json'));
  const file=path.join(root,'.github/candidate-gallery.json');
  const configuration=optionalRegularJson(file);
  if(command==='resolve'){
    const candidate=await resolveCandidateGallery({manifest,configuration,event:process.env.GITHUB_EVENT_NAME,ref:process.env.GITHUB_REF,input:process.env.CANDIDATE_GALLERY_REF??'',pullRequest:pullRequestOfEvent(),eventRepository:process.env.GITHUB_REPOSITORY,api:githubApi()});
    const control=candidate?await publishedGalleryControl(readRegularJson(path.join(root,'release-plan.json'))):{};
    const controlLines=Object.entries(control).map(([repo,sha])=>`published_${repo.replaceAll('-','_')}=${sha}\n`).join('');
    const lines=controlLines+`candidate_gallery=${candidate?.sha??''}\ncandidate_gallery_version=${candidate?.version??''}\n`;
    if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,lines);
    if(process.env.GITHUB_ENV)appendFileSync(process.env.GITHUB_ENV,`CANDIDATE_GALLERY_REF=${candidate?.sha??''}\n`);
    console.log(lines.trim());
  }else if(command==='link'){
    const candidate=galleryConfiguration(manifest,configuration);assert.ok(candidate,'link requires explicit candidate configuration');
    assert.equal(process.env.CANDIDATE_GALLERY_REF,candidate.sha,'resolved gallery SHA differs from reviewed configuration');
    const workspace=path.resolve(process.env.GITHUB_WORKSPACE??path.dirname(root));
    const consumers=[root,path.join(root,'packages/javascript'),path.join(root,'packages/cli'),...REPOSITORIES.filter(name=>name!=='opf').map(name=>path.join(workspace,name)).filter(directory=>existsSync(directory))];
    console.log(JSON.stringify(linkCandidateGallery({gallery:path.join(workspace,'gallery-candidate'),candidate,consumers}),null,2));
  }else if(command==='publication')assertPublishedGallery(manifest,configuration);
  else throw Error('expected resolve, link or publication');
}
