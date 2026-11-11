#!/usr/bin/env node
// Generate a review candidate only. Promotion of the locked nine-deck fixture is a separate reviewed change.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,readdirSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {reviewFallbackArchives,sha256,validateFixture} from './chartex-fallback-archives.mjs';

const usage='review-chartex-fallback-archives.mjs --baseline DIR --candidate DIR --out FRESH_DIR --baseline-export-ref FULL_SHA';
const options={};
for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i],value=process.argv[i+1];assert.ok(['--baseline','--candidate','--out','--baseline-export-ref'].includes(key)&&value&&!Object.hasOwn(options,key),usage);options[key]=value;}
for(const key of ['--baseline','--candidate','--out','--baseline-export-ref'])assert.ok(options[key],usage);
assert.match(options['--baseline-export-ref'],/^[0-9a-f]{40}$/,'Select the exact accepted baseline source');
const requestedOut=path.resolve(options['--out']);assert.ok(!existsSync(requestedOut),'Preserve previous evidence: choose a fresh output directory');
const out=path.join(realpathSync(path.dirname(requestedOut)),path.basename(requestedOut));assert.ok(!existsSync(out),'Preserve previous evidence: choose a fresh output directory');
const fixtureRelative='packages/pptx/test/fixtures/chartex-fallback-main.json';
const baselineRoot=realpathSync(path.resolve(options['--baseline'])),candidateRoot=realpathSync(path.resolve(options['--candidate']));
const toolRoot=realpathSync(fileURLToPath(new URL('../../..',import.meta.url)));assert.equal(toolRoot,candidateRoot,'Run the maintained command from the selected candidate checkout');
for(const root of [baselineRoot,candidateRoot]){const relative=path.relative(root,out);assert.ok(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative),'Choose an external evidence directory, outside both producer checkouts');}
const candidateFile=path.join(candidateRoot,fixtureRelative),baselineFile=path.join(baselineRoot,fixtureRelative);
const fixtureBytes=readFileSync(candidateFile),baselineFixtureBytes=readFileSync(baselineFile),fixture=JSON.parse(fixtureBytes);
validateFixture(fixture);assert.deepEqual(JSON.parse(baselineFixtureBytes),fixture,'Both runtimes must start from the same reviewed lock, not a preedited candidate');
const git=(root,...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',maxBuffer:16*1024*1024}).trim();
const inside=(root,file)=>{const relative=path.relative(root,realpathSync(file));assert.ok(relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative),'Runtime module must resolve within its own checkout: '+file);return relative.split(path.sep).join('/');};
const inventory=(root,directory)=>{const entries=[];for(const entry of readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())entries.push(...inventory(root,file));else{assert.ok(entry.isFile(),'No linked runtime files');const bytes=readFileSync(file);entries.push({file:inside(root,file),bytes:bytes.length,sha256:sha256(bytes)});}}return entries.sort((a,b)=>a.file.localeCompare(b.file,'en'));};
function sealRuntime(runtime){
  const record=runtime.provenance;assert.equal(git(record.root,'rev-parse','HEAD'),record.head,'Producer source moved');assert.equal(git(record.root,'status','--porcelain'),'','Producer became dirty');
  const current=['javascript','gallery','render','pptx'].flatMap(pkg=>inventory(record.root,path.join(record.root,'packages',pkg,'dist')));assert.deepEqual(current,record.dist,'Built runtime changed during review');assert.equal(sha256(JSON.stringify(runtime.catalog)),record.catalogSha256,'Catalog changed during review');
}
async function loadRuntime(root,expected){
  const head=git(root,'rev-parse','HEAD');assert.match(head,/^[0-9a-f]{40}$/);
  if(expected)assert.equal(head,expected,'Baseline checkout must be the exact selected export revision');
  assert.equal(git(root,'status','--porcelain'),'','Use a clean committed producer and preserve its build receipt');
  // Use Node's import conditions from the selected producer, including import-only subpaths.
  // This resolver reads package metadata only; no producer file is written or module executed.
  const specifiers={pptx:'@openpresentation/opf-pptx',gallery:'@openpresentation/gallery',core:'@openpresentation/opf/composition',render:'@openpresentation/opf-render/svg'};
  const resolver='const names=JSON.parse(process.argv[1]);process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(names).map(([name,specifier])=>[name,import.meta.resolve(specifier)]))));';
  const urls=JSON.parse(execFileSync(process.execPath,['--input-type=module','--eval',resolver,JSON.stringify(specifiers)],{cwd:path.join(root,'packages/pptx'),encoding:'utf8',timeout:10000,maxBuffer:1024*1024}));
  assert.deepEqual(Object.keys(urls),Object.keys(specifiers),'Exactly four declared runtime modules');
  const modules=Object.fromEntries(Object.entries(urls).map(([name,url])=>[name,fileURLToPath(url)]));
  const resolved=Object.fromEntries(Object.entries(modules).map(([name,file])=>[name,inside(root,file)]));
  const dist=['javascript','gallery','render','pptx'].flatMap(pkg=>inventory(root,path.join(root,'packages',pkg,'dist')));
  const sourceTrees=git(root,'ls-tree','HEAD','--','packages/javascript','packages/gallery','packages/render','packages/pptx','spec','pnpm-lock.yaml','pnpm-workspace.yaml','package.json');
  const pptx=await import(pathToFileURL(modules.pptx)),gallery=await import(pathToFileURL(modules.gallery));
  assert.equal(typeof pptx.toPptx,'function');assert.ok(gallery.gallery);
  return {toPptx:pptx.toPptx,catalog:gallery.gallery,provenance:{root,head,sourceTrees,resolved,dist,catalogSha256:sha256(JSON.stringify(gallery.gallery))}};
}
try{
  const baseline=await loadRuntime(baselineRoot,options['--baseline-export-ref']),candidate=await loadRuntime(candidateRoot);
  const helper=path.join(path.dirname(fileURLToPath(import.meta.url)),'../test/helpers/chartex-fallback-decks.mjs');
  const runner=fileURLToPath(import.meta.url),library=fileURLToPath(new URL('./chartex-fallback-archives.mjs',import.meta.url));
  const provenance={node:process.version,platform:process.platform,arch:process.arch,baseline:baseline.provenance,candidate:candidate.provenance,fixture:{file:fixtureRelative,sha256:sha256(fixtureBytes),baselineSha256:sha256(baselineFixtureBytes)},tools:[runner,library,helper,path.join(candidateRoot,'packages/pptx/test/fixtures/chartex-fallback-main.mjs.txt')].map(file=>({file:path.basename(file),sha256:sha256(readFileSync(file))})),buildBoundary:'Both roots must be freshly built from the recorded clean source; retain their build logs. Dist files and module resolution are sealed here. This command does not build, modify locks or invoke native applications.'};
  const review=await reviewFallbackArchives({fixture,baseline,candidate,out,provenance,verifyProducers:()=>{sealRuntime(baseline);sealRuntime(candidate);}});
  console.log(`${review.entries.length} exact baseline locks reproduced; ${review.entries.filter(row=>row.parts.changed.length).length} archive differences require review. Candidate JSON written only to ${out}. Locked fixtures unchanged.`);
}finally{
  assert.ok(readFileSync(candidateFile).equals(fixtureBytes),'Candidate lock must remain byte-exact');assert.ok(readFileSync(baselineFile).equals(baselineFixtureBytes),'Baseline lock must remain byte-exact');
}
