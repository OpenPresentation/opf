// Local tarball qualification. Original manifests remain unchanged and are not claimed registry-installable.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cpSync,lstatSync,mkdirSync,readFileSync,readdirSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {packageManagerInvocation} from './package-manager.mjs';
import {satisfies} from './release-plan-cli.mjs';
import {tar} from './archive-tar.mjs';
import {galleryConfiguration,verifyGalleryCheckout,readRegularJson,optionalRegularJson} from './candidate-gallery.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const specifiers=['@openpresentation/opf','@openpresentation/opf-render','@openpresentation/opf-pptx','@openpresentation/opf-editor','@openpresentation/cli','@openpresentation/gallery'];
export function stagedManifest(original,versions,tarballs={}){
 const staged=structuredClone(original);
 for(const section of ['dependencies','peerDependencies','optionalDependencies'])for(const name of Object.keys(staged[section]??{}))if(versions[name])staged[section][name]=section==='peerDependencies'?`^${versions[name]}`:(tarballs[name]?`file:${tarballs[name]}`:versions[name]);
 delete staged.scripts;delete staged.devDependencies;
 if(staged.opf){delete staged.opf.requiresUnreleasedCore;delete staged.opf.requiresUnreleasedGallery;if(!Object.keys(staged.opf).length)delete staged.opf;}
 return staged;
}
function regularTree(directory){for(const name of readdirSync(directory)){
 const file=path.join(directory,name),stat=lstatSync(file);assert.ok(!stat.isSymbolicLink(),'symlink in staged distributables');
 if(stat.isDirectory())regularTree(file);else assert.ok(stat.isFile(),'nonregular staged distributable');
}}
export function stageGalleryGraph({coreRoot,workspace,out,run=(command,args,cwd)=>{if(command==='npm')({command,args}=packageManagerInvocation(command,args));return execFileSync(command,args,{cwd,encoding:'utf8'});}}){
 const originalCore=readRegularJson(path.join(coreRoot,'packages/javascript/package.json'));
 const candidate=galleryConfiguration(originalCore,readRegularJson(path.join(coreRoot,'.github/candidate-gallery.json')));
 assert.ok(candidate,'staging requires reviewed candidate configuration');
 assert.equal(process.env.CANDIDATE_GALLERY_REF,candidate.sha,'staging SHA differs from authorized resolution');
 const gallery=path.join(workspace,'gallery-candidate');verifyGalleryCheckout(gallery,candidate);
 const directories=[path.join(coreRoot,'packages/javascript'),path.join(workspace,'opf-render'),path.join(workspace,'opf-pptx'),path.join(workspace,'opf-editor'),path.join(coreRoot,'packages/cli'),gallery];
 const originals=directories.map(directory=>readRegularJson(path.join(directory,'package.json')));
 assert.deepEqual(originals.map(item=>item.name),specifiers,'candidate graph package identity mismatch');
 const versions=Object.fromEntries(originals.map(item=>[item.name,item.version]));
 mkdirSync(out,{recursive:true});assert.equal(realpathSync(out),path.resolve(out),'aliased candidate artifact output');
 const tarballs=Object.fromEntries(originals.map(item=>[item.name,path.join(out,`${item.name.slice(1).replace('/','-')}-${item.version}.tgz`)]));
 const artifacts=[];
 for(let index=0;index<directories.length;index++){
  const directory=directories[index],original=originals[index],staged=stagedManifest(original,versions,tarballs);
  assert.equal(realpathSync(directory),path.resolve(directory),'aliased candidate package source');
  const sourceRoot=index===0||index===4?coreRoot:directory;
  const sourceSha=run('git',['rev-parse','HEAD'],sourceRoot).trim();assert.match(sourceSha,/^[0-9a-f]{40}$/);
  assert.equal(run('git',['diff','--name-only','HEAD'],sourceRoot).trim(),'','candidate source changed during staging');
  assert.equal(run('git',['ls-files','--others','--exclude-standard'],sourceRoot).trim(),'','untracked candidate source during staging');
  const stage=path.join(out,'staging',original.name.split('/')[1]);
  mkdirSync(path.dirname(stage),{recursive:true});assert.equal(realpathSync(path.dirname(stage)),path.dirname(stage),'aliased stage parent');
  try{assert.ok(!lstatSync(stage).isSymbolicLink(),'aliased stage');}catch(error){if(error.code!=='ENOENT')throw error;}
  rmSync(stage,{recursive:true,force:true});mkdirSync(stage);
  for(const relative of new Set([...(original.files??['dist']),'README.md','LICENSE'])){
   assert.ok(typeof relative==='string'&&!path.isAbsolute(relative)&&!relative.split(/[/\\]/).includes('..')&&!/[*?\[\]{}!]/.test(relative),'invalid package distributable path');
   const file=path.join(directory,relative);assert.equal(realpathSync(file),file,'aliased distributable');
   if(lstatSync(file).isDirectory())regularTree(file);else assert.ok(lstatSync(file).isFile(),'nonregular distributable');
   cpSync(file,path.join(stage,relative),{recursive:true});
  }
  for(const bin of typeof staged.bin==='string'?[staged.bin]:Object.values(staged.bin??{})){
   assert.ok(typeof bin==='string'&&!path.isAbsolute(bin)&&!bin.split(/[/\\]/).includes('..'),'invalid staged executable path');
   const file=path.join(stage,bin),text=readFileSync(file).toString('latin1');
   writeFileSync(file,Buffer.from(text.replace(/^(#![^\r\n]*)\r\n/,'$1\n'),'latin1'));
  }
  const stagedBytes=Buffer.from(JSON.stringify(staged,null,2)+'\n');writeFileSync(path.join(stage,'package.json'),stagedBytes);
  const packed=JSON.parse(run('npm',['pack','--json','--ignore-scripts','--pack-destination',out,'--cache',path.join(out,'cache')],stage))[0];
  const bytes=readFileSync(path.join(out,packed.filename));
  artifacts.push({name:original.name,version:original.version,sourceVersion:original.version,sourceSha,file:packed.filename,sha256:hash(bytes),bytes:bytes.length,npmPack:packed,originalManifest:original,stagedManifest:staged,originalManifestSha256:hash(readFileSync(path.join(directory,'package.json'))),stagedManifestSha256:hash(stagedBytes)});
  assert.deepEqual(readRegularJson(path.join(directory,'package.json')),original,'staging modified original metadata');
 }
 const report={published:false,qualification:'candidate-tarballs; original metadata registry qualification remains pending',gallery:candidate,artifacts};
 writeFileSync(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');return report;
}
export function candidateArtifacts(root){
 const configured=galleryConfiguration(readRegularJson(path.join(root,'packages/javascript/package.json')),optionalRegularJson(path.join(root,'.github/candidate-gallery.json')));
 if(!process.env.CANDIDATE_GALLERY_REF){assert.equal(configured,null,'configured gallery needs explicit authorized candidate mode; no published fallback');return null;}
 assert.ok(configured,'candidate artifacts need reviewed source configuration');
 const report=readRegularJson(path.join(root,'artifacts/npm/manifest.json'));
 assert.equal(report.published,false);assert.equal(report.gallery.sha,process.env.CANDIDATE_GALLERY_REF);
 assert.deepEqual(report.artifacts.map(item=>item.name),specifiers,'incomplete candidate tarball graph');
 const candidate=configured;
 assert.equal(candidate.sha,report.gallery.sha,'artifact gallery differs from reviewed configuration');
 const workspace=path.dirname(root);
 const directories=[path.join(root,'packages/javascript'),path.join(workspace,'opf-render'),path.join(workspace,'opf-pptx'),path.join(workspace,'opf-editor'),path.join(root,'packages/cli'),path.join(workspace,'gallery-candidate')];
 for(const item of report.artifacts){
  assert.equal(item.version,item.originalManifest.version,'artifact version differs from original source version');
  assert.equal(item.sourceVersion,item.originalManifest.version,'artifact sourceVersion differs from original source version');
  assert.equal(item.stagedManifest.version,item.originalManifest.version,'staging must preserve the package own version');
 }
 for(const [index,item] of report.artifacts.entries()){
  const directory=directories[index],sourceRoot=index===0||index===4?root:directory;
  assert.equal(execFileSync('git',['-C',sourceRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),item.sourceSha,'artifact source SHA mismatch');
  assert.equal(execFileSync('git',['-C',sourceRoot,'diff','--name-only','HEAD'],{encoding:'utf8'}).trim(),'','candidate source changed after staging');
  assert.deepEqual(readRegularJson(path.join(directory,'package.json')),item.originalManifest,'artifact original metadata differs from source');
  assert.equal(hash(readFileSync(path.join(directory,'package.json'))),item.originalManifestSha256,'original metadata byte digest mismatch');
  assert.ok(!item.file.includes('/')&&!item.file.includes('\\')&&!item.file.includes('..'),'invalid tarball path');
  const file=path.join(root,'artifacts/npm',item.file);assert.equal(realpathSync(file),file,'aliased candidate tarball');assert.ok(lstatSync(file).isFile());assert.equal(hash(readFileSync(file)),item.sha256,'candidate tarball digest mismatch');
  const stagedFile=path.join(root,'artifacts/npm/staging',item.name.split('/')[1],'package.json');
  assert.deepEqual(readRegularJson(stagedFile),item.stagedManifest,'staging metadata differs from report');
  assert.equal(hash(readFileSync(stagedFile)),item.stagedManifestSha256,'staged metadata byte digest mismatch');
  assert.deepEqual(JSON.parse(tar(file,'-xOzf',['package/package.json'])),item.stagedManifest,'actual tarball metadata differs from report');
  assert.ok(tar(file,'-tvzf').trim().split(/\r?\n/).every(line=>line.startsWith('-')),'tarball must contain only regular files');
  const members=tar(file,'-tzf').trim().split(/\r?\n/);
  assert.deepEqual(members.sort(),item.npmPack.files.map(record=>`package/${record.path}`).sort(),'actual tarball file set differs from report');
  for(const record of item.npmPack.files){
   assert.ok(!path.isAbsolute(record.path)&&!record.path.split(/[/\\]/).includes('..'),'invalid tarball member');
   const bytes=tar(file,'-xOzf',[`package/${record.path}`],{encoding:null});
   const staged=path.join(root,'artifacts/npm/staging',item.name.split('/')[1],record.path);
   assert.equal(realpathSync(staged),staged,'aliased staged runtime');
   assert.deepEqual(bytes,readFileSync(staged),'actual tarball bytes differ from stage');
   if(record.path!=='package.json'){
    const source=path.join(directory,record.path);assert.equal(realpathSync(source),source,'aliased runtime source');
    const bins=typeof item.originalManifest.bin==='string'?[item.originalManifest.bin]:Object.values(item.originalManifest.bin??{});
    const original=readFileSync(source);
    const expected=bins.includes(record.path)?Buffer.from(original.toString('latin1').replace(/^(#![^\r\n]*)\r\n/,'$1\n'),'latin1'):original;
    assert.deepEqual(bytes,expected,'candidate tarball runtime differs from built source');
   }
  }
  assert.deepEqual(item.stagedManifest,stagedManifest(item.originalManifest,Object.fromEntries(report.artifacts.map(record=>[record.name,record.version])),Object.fromEntries(report.artifacts.map(record=>[record.name,path.join(root,'artifacts/npm',record.file)]))),'unexpected staged metadata change');
 }
 return report;
}

// Source Node tests use original manifests/runtime, but authenticate the exact staged
// graph and its source resolutions before exercising selected unpublished engines.
export function sourceCandidateCorePreflight(root,executable){
 const graph=candidateArtifacts(root);if(!graph)return null;
 const coreRoot=path.join(root,'packages/javascript');
 assert.equal(realpathSync(executable),path.join(coreRoot,'dist/index.js'),'candidate Node executable differs from selected core');
 assertCandidatePeerPreflight(root);
 const workspace=path.dirname(root),directories={
  '@openpresentation/opf':coreRoot,
  '@openpresentation/opf-render':path.join(workspace,'opf-render'),
  '@openpresentation/opf-pptx':path.join(workspace,'opf-pptx'),
  '@openpresentation/gallery':path.join(workspace,'gallery-candidate'),
 };
 for(const [consumer,names] of [
  [coreRoot,['@openpresentation/opf-render','@openpresentation/opf-pptx','@openpresentation/gallery']],
  [directories['@openpresentation/opf-render'],['@openpresentation/opf','@openpresentation/gallery']],
  [directories['@openpresentation/opf-pptx'],['@openpresentation/opf','@openpresentation/opf-render','@openpresentation/gallery']],
 ]){
  const require=createRequire(path.join(consumer,'package.json'));
  for(const name of names){
   assert.equal(realpathSync(path.join(consumer,'node_modules',name,'package.json')),path.join(directories[name],'package.json'),'candidate Node source links a different selected package');
   assert.equal(realpathSync(require.resolve(`${name}/package.json`)),path.join(directories[name],'package.json'),'candidate Node source resolves a different selected package');
  }
 }
 return {graph,coreRoot,directories};
}

// A provided OPF_TEST_BIN always selects the strict installed path. Only its
// deliberate absence selects authenticated source qualification; invalid bins
// never become source-mode fallbacks.
export function candidateCliContext(root,executable){
 if(executable!==undefined)return installedCandidatePreflight(root,executable);
 const context=sourceCandidateCorePreflight(root,path.join(root,'packages/javascript/dist/index.js'));if(!context)return null;
 const cliRoot=path.join(root,'packages/cli'),require=createRequire(path.join(cliRoot,'package.json'));
 for(const [name,directory] of Object.entries(context.directories)){
  assert.equal(realpathSync(path.join(cliRoot,'node_modules',name,'package.json')),path.join(directory,'package.json'),'candidate CLI source links a different selected package');
  assert.equal(realpathSync(require.resolve(`${name}/package.json`)),path.join(directory,'package.json'),'candidate CLI source resolves a different selected package');
 }
 const cli=context.graph.artifacts.find(item=>item.name==='@openpresentation/cli');
 const relative=normalizedCandidateBin(typeof cli.originalManifest.bin==='string'?cli.originalManifest.bin:cli.originalManifest.bin?.opf);
 const bin=path.join(cliRoot,relative);assert.equal(realpathSync(bin),bin,'candidate source binary is aliased');
 return {...context,source:true,bin};
}

// The existing isolator deliberately copies original core bytes and links only its
// runtime dependencies. Verify that closure before either missing-peer or stub tests.
export function assertSourceCandidateIsolatedCore(context,directory){
 if(!context)return;
 assert.ok(!lstatSync(directory).isSymbolicLink(),'isolated candidate core is aliased');
 directory=realpathSync(directory); // macOS tmpdir may have the system /var -> /private/var parent alias.
 const core=context.graph.artifacts.find(item=>item.name==='@openpresentation/opf');
 assert.deepEqual(readRegularJson(path.join(directory,'package.json')),core.originalManifest,'isolated core metadata differs from original source');
 for(const file of core.npmPack.files.filter(item=>item.path.startsWith('dist/'))){
  const copied=path.join(directory,file.path);assert.equal(realpathSync(copied),copied,'isolated runtime is aliased');
  assert.deepEqual(readFileSync(copied),readFileSync(path.join(context.coreRoot,file.path)),'isolated core runtime differs from validated source');
 }
 const require=createRequire(path.join(directory,'package.json'));
 assert.equal(realpathSync(require.resolve('@openpresentation/gallery/package.json')),path.join(context.directories['@openpresentation/gallery'],'package.json'),'isolated core resolves a different gallery');
 for(const name of ['@openpresentation/opf-render','@openpresentation/opf-pptx'])assert.throws(()=>require.resolve(`${name}/package.json`),{code:'MODULE_NOT_FOUND'},'isolated core must have no optional engine');
}

export function candidatePeerPreflight(root,defaultGate){
 return candidateArtifacts(root)?assertCandidatePeerPreflight(root):defaultGate();
}

// Preflight only the explicitly staged artifact relationships. Original source ranges
// remain unchanged and are still checked by ordinary source/registry/publication gates.
export function assertCandidatePeerPreflight(root){
 const graph=candidateArtifacts(root);assert.ok(graph,'candidate peer preflight requires an authorized staged graph');
 for(const name of ['@openpresentation/opf','@openpresentation/cli']){
  const consumer=graph.artifacts.find(item=>item.name===name);assert.ok(consumer,'missing staged peer consumer');
  for(const peerName of ['@openpresentation/opf-render','@openpresentation/opf-pptx']){
   const peer=graph.artifacts.find(item=>item.name===peerName);assert.ok(peer,'missing staged engine');
   assert.equal(consumer.stagedManifest.peerDependencies?.[peerName],`^${peer.version}`,'staged peer relationship differs from selected artifact');
  }
 }
 return {run:true};
}

export function normalizedCandidateBin(value){
 assert.equal(typeof value,'string','candidate CLI bin must be a relative string');
 const relative=value.startsWith('./')?value.slice(2):value;
 assert.ok(/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(relative)&&relative.split('/').every(part=>part!=='.'&&part!=='..'),'unsafe candidate CLI bin path');
 return relative;
}

// Installed drawing tests must exercise the exact selected binary, never a workspace
// binary merely because candidate mode is enabled.
export function installedCandidatePreflight(root,executable){
 const graph=candidateArtifacts(root);if(!graph)return null;
 assert.ok(executable,'installed candidate preflight requires OPF_TEST_BIN');
 const bin=realpathSync(executable),cli=graph.artifacts.find(item=>item.name==='@openpresentation/cli');
 const relative=normalizedCandidateBin(typeof cli.stagedManifest.bin==='string'?cli.stagedManifest.bin:cli.stagedManifest.bin?.opf);
 const cliRoot=path.resolve(bin,...relative.split('/').map(()=> '..'));
 const modules=path.dirname(path.dirname(cliRoot));
 assert.equal(cliRoot,path.join(modules,'@openpresentation/cli'),'candidate binary is outside an installed CLI');
 assert.equal(bin,path.join(cliRoot,relative),'candidate binary differs from the selected manifest');
 assertInstalledCandidatePeers(root,modules,['@openpresentation/cli','@openpresentation/opf-render','@openpresentation/opf-pptx'],graph.artifacts.find(item=>item.name==='@openpresentation/opf').version);
 assertCandidatePeerPreflight(root);
 return {graph,bin,modules};
}

export function assertCandidateDoctor(context,doctor){
 const core=context.graph.artifacts.find(item=>item.name==='@openpresentation/opf');
 assert.ok(core,'candidate doctor requires the selected core');
 const readiness={};
 for(const name of ['@openpresentation/opf-render','@openpresentation/opf-pptx']){
  const engine=context.graph.artifacts.find(item=>item.name===name);
  assert.ok(engine,'candidate doctor requires the selected engine');
  // Doctor reads core's runtime peer contract, not the development-only staged peer relationships.
  const wanted=core.originalManifest.peerDependencies?.[name];
  assert.match(wanted??'',/^\^\d+\.\d+\.\d+$/,'candidate doctor needs an explicit stable caret peer contract');
  assert.match(engine.version??'',/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,'candidate doctor needs a selected semantic version');
  const ok=satisfies(engine.version,wanted);
  const facts=doctor.packages.filter(item=>item.name===name);
  assert.equal(facts.length,1,'doctor must report exactly one selected engine');
  const fact=facts[0];
  assert.deepEqual([fact.installed,fact.version,fact.wanted,fact.ok],[true,engine.version,wanted,ok]);
  readiness[name]=ok;
 }
 for(const format of ['json','yaml','md'])assert.equal(doctor.formats[format].ready,true);
 // The drawing fixture has already exercised the required office fonts. Peer compatibility must
 // still be reflected truthfully: old0.18 engines stay unready; selected compatible0.19 engines are ready.
 assert.equal(doctor.formats.svg.ready,readiness['@openpresentation/opf-render']);
 assert.equal(doctor.formats['pptx-import'].ready,readiness['@openpresentation/opf-pptx']);
}

export function assertInstalledCandidateGraph(root,consumer){
 const report=candidateArtifacts(root);assert.ok(report,'installed candidate graph needs explicit candidate mode');
 const galleryPaths=new Set();
 for(const item of report.artifacts){
  const directory=path.join(consumer,'node_modules',item.name);
  assert.equal(realpathSync(directory),directory,'installed candidate must not be a source alias');
  assert.deepEqual(readRegularJson(path.join(directory,'package.json')),item.stagedManifest,'installed metadata differs from reviewed staged artifact');
  for(const file of item.npmPack.files){
   assert.ok(!path.isAbsolute(file.path)&&!file.path.split(/[/\\]/).includes('..'),'invalid packed runtime path');
   if(file.path==='package.json')continue;
   const staged=path.join(root,'artifacts/npm/staging',item.name.split('/')[1],file.path),installed=path.join(directory,file.path);
   assert.equal(realpathSync(installed),installed,'installed runtime is aliased');
   assert.deepEqual(readFileSync(installed),readFileSync(staged),'installed runtime differs from staged tarball');
  }
  const require=createRequire(path.join(directory,'package.json'));
  if(item.name!=='@openpresentation/gallery')galleryPaths.add(require.resolve('@openpresentation/gallery/package.json'));
 }
 assert.equal(galleryPaths.size,1,'candidate engines resolve different gallery installations');
 assert.equal([...galleryPaths][0],path.join(consumer,'node_modules/@openpresentation/gallery/package.json'));
 return report;
}

// Local file dependency relationships are validated as artifacts, never interpreted as published semver.
export function assertInstalledCandidatePeers(root,modules,names,coreVersion){
 const graph=candidateArtifacts(root);assert.ok(graph,'candidate peers require an explicit staged graph');
 // macOS tmpdir has a system /var -> /private/var alias; validate package leaves under its canonical root.
 modules=realpathSync(modules);
 const core=graph.artifacts.find(item=>item.name==='@openpresentation/opf');
 assert.equal(coreVersion,core.version,'installed core version differs from the staged graph');
 for(const name of new Set(['@openpresentation/opf','@openpresentation/gallery',...names])){
  const item=graph.artifacts.find(record=>record.name===name);assert.ok(item,'unknown staged peer');
  const directory=path.join(modules,name);assert.equal(realpathSync(directory),directory,'installed peer is aliased');
  assert.deepEqual(readRegularJson(path.join(directory,'package.json')),item.stagedManifest,'installed peer metadata differs from the exact staged graph');
  for(const file of item.npmPack.files){if(file.path==='package.json')continue;
   const installed=path.join(directory,file.path);assert.equal(realpathSync(installed),installed,'installed peer runtime is aliased');
   assert.deepEqual(readFileSync(installed),readFileSync(path.join(root,'artifacts/npm/staging',name.split('/')[1],file.path)),'installed peer runtime differs from staged bytes');
  }
  if(name!=='@openpresentation/opf'&&name!=='@openpresentation/gallery')assert.equal(createRequire(path.join(directory,'package.json')).resolve('@openpresentation/opf/package.json'),path.join(modules,'@openpresentation/opf/package.json'),'installed peer resolves a different core');
  if(name!=='@openpresentation/gallery')assert.equal(createRequire(path.join(directory,'package.json')).resolve('@openpresentation/gallery/package.json'),path.join(modules,'@openpresentation/gallery/package.json'),'installed peer resolves a different gallery');
 }
 return {run:true};
}

export function assertCandidateExecInstalls(root,cache,names){
 const directory=path.join(realpathSync(cache),'_npx');
 const graph=candidateArtifacts(root);assert.ok(graph,'npm exec qualification needs a staged graph');
 const version=graph.artifacts.find(item=>item.name==='@openpresentation/opf').version;
 let installs=0;
 for(const entry of readdirSync(directory)){
  const modules=path.join(directory,entry,'node_modules');
  if(!optionalRegularJson(path.join(modules,'@openpresentation/cli/package.json')))continue;
  assertInstalledCandidatePeers(root,modules,['@openpresentation/cli',...names],version);installs++;
 }
 assert.ok(installs>0,'npm exec did not create a qualified candidate installation');return installs;
}
