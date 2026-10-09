import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile, realpath} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {packCliCandidate} from '../../../scripts/pack-cli-candidate.mjs';
import {assertOneCore} from '../../../scripts/check-one-core.mjs';
import {satisfies} from '../../../scripts/unreleased-gate.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const pkg=path.join(root,'packages/cli'),out=path.join(root,'artifacts/cli');
const registry=process.argv.includes('--registry');
const plan=JSON.parse(await readFile(path.join(root,'release-plan.json'),'utf8'));
const option=name=>process.argv.find(value=>value.startsWith(`${name}=`))?.slice(name.length+1);
const version=option('--version'),verificationRef=option('--verification-ref');
assert.ok((!version&&!verificationRef)||(registry&&version&&verificationRef),'Use --registry with both --version=<version> and --verification-ref=<40-character commit>');
if(version)assert.match(version,/^\d+\.\d+\.\d+$/);
if(verificationRef)assert.match(verificationRef,/^[a-f0-9]{40}$/);
const expected=registry
 ? (version?{name:'@openpresentation/cli',version}:plan.packages.find(item=>item.name==='@openpresentation/cli'))
 : JSON.parse(await readFile(path.join(pkg,'package.json'),'utf8'));
assert.ok(expected?.version,'Missing CLI version in the published release plan');
const registrySpec=`${expected.name}@${expected.version}`;
const temp=await mkdtemp(path.join(tmpdir(),'opf-cli-installed-'));
function run(command,args,cwd,env={}) {
 if(process.platform==='win32'&&(command==='npm'||command==='pnpm')){
  const entry=command==='npm'
   ? (process.env.PATH??'').split(path.delimiter).flatMap(directory=>[path.join(directory,'node_modules/npm/bin/npm-cli.js'),path.resolve(directory,'../npm/bin/npm-cli.js')]).find(existsSync)
   : (process.env.npm_execpath?.endsWith('pnpm.cjs')?process.env.npm_execpath:(process.env.PATH??'').split(path.delimiter).flatMap(directory=>[path.join(directory,'node_modules/pnpm/bin/pnpm.cjs'),path.resolve(directory,'../pnpm/bin/pnpm.cjs')]).find(existsSync));
  assert.ok(entry,`Cannot locate ${command} JavaScript entrypoint`);args=[entry,...args];command=process.execPath;
 }
 const result=spawnSync(command,args,{cwd,encoding:'utf8',env:{...process.env,...env},timeout:120000});
 if(result.error)throw result.error;
 assert.equal(result.status,0,result.stderr||result.stdout);return result.stdout;
}
try {
 await mkdir(out,{recursive:true});
 if(!registry)run('pnpm',['build'],pkg);
 const cache=path.join(temp,'npm-cache');
 // RR-62: the CLI depends on core (one core for the command and for @openpresentation/cli/api). A local run packs the candidate core
 // with it and installs both; a registry run installs the published CLI, which pulls the published core.
 let packed,tarball,candidateCore=[];
 if(registry){
  packed=JSON.parse(run('npm',['pack',registrySpec,'--json','--ignore-scripts','--pack-destination',out,'--cache',cache],pkg))[0];
  tarball=path.join(out,packed.filename);
 } else {
  const candidate=await packCliCandidate({cliDirectory:pkg,coreDirectory:path.join(root,'packages/javascript'),destination:out,run,npmArgs:['--cache',cache]});
  packed=candidate.cli;tarball=candidate.cliTarball;candidateCore=[candidate.coreTarball];
 }
 if(registry){
  // Install directly from npm as well as from the inspected tarball so npm can
  // authenticate the registry signature and provenance for this exact artifact.
  const consumer=path.join(temp,'registry-consumer');await mkdir(consumer);
  await writeFile(path.join(consumer,'package.json'),JSON.stringify({private:true}));
  run('npm',['install','--ignore-scripts','--no-fund','--no-audit','--prefer-online','--cache',cache,registrySpec],consumer);
  const lock=JSON.parse(await readFile(path.join(consumer,'package-lock.json'),'utf8'));
  const entry=lock.packages[`node_modules/${expected.name}`];
  assert.equal(entry.version,expected.version);
  assert.ok(entry.resolved.startsWith('https://registry.npmjs.org/')&&!entry.link);
  assert.equal(entry.integrity,packed.integrity,'Registry install must match the inspected tarball');
  console.log(run('npm',['audit','signatures','--cache',cache],consumer).trim());
 }
 // Install globally into an isolated prefix with no workspace links: the CLI, the core it depends on and core's own dependencies come from tarballs and the registry.
 run('npm',['install','--global','--prefix',temp,'--ignore-scripts','--no-audit','--no-fund','--cache',cache,tarball,...candidateCore],temp);
 const installed=path.join(temp,process.platform==='win32'?'node_modules':'lib/node_modules','@openpresentation/cli');
 const manifest=JSON.parse(await readFile(path.join(installed,'package.json'),'utf8'));
 assert.equal(manifest.version,expected.version);
 assert.ok(!manifest.private);
 // The manifest this installation is checked against: the source of this checkout, or (registry mode) of the release commit. A release
 // before RR-62 bundles core (no dependencies, no /api); from RR-62 core is the only runtime dependency, shared with @openpresentation/cli/api.
 const registryRef=registry?(verificationRef??plan.verificationRefs.cli):undefined;
 if(registryRef)assert.match(registryRef,/^[a-f0-9]{40}$/);
 const sourceManifest=registry?JSON.parse(run('git',['show',`${registryRef}:packages/cli/package.json`],root)):JSON.parse(await readFile(path.join(pkg,'package.json'),'utf8'));
 if(registry)assert.equal(sourceManifest.version,expected.version,'Command tests must belong to the selected CLI version');
 assert.deepEqual(Object.keys(manifest.dependencies??{}),Object.keys(sourceManifest.dependencies??{}),'The installed CLI declares the dependencies of its source');
 const bin=path.join(installed,manifest.bin.opf);
 const versions=JSON.parse(run(process.execPath,[bin,'--version'],temp));
 assert.equal(versions.cli,expected.version);
 if(sourceManifest.dependencies?.['@openpresentation/opf']){
  assert.deepEqual(Object.keys(manifest.dependencies),['@openpresentation/opf'],'core is the only runtime dependency of the CLI');
  assert.equal(manifest.exports['./api'].import,'./dist/api.js');assert.equal(manifest.exports['./api'].types,'./dist/api.d.ts');
  for(const file of ['dist/api.js','dist/api.d.ts','dist/index.js'])assert.ok(existsSync(path.join(installed,file)),file+' ships');
  // One core: the installation holds a single @openpresentation/opf, which the command and @openpresentation/cli/api both use.
  // A global install has no application beside the CLI: core is the CLI's own dependency (nested, or hoisted when a candidate
  // core tarball is installed with it), and the CLI must resolve the one copy.
  const one=await assertOneCore(path.dirname(path.dirname(installed)),{application:false});
  assert.equal(versions.opf,(await readFile(path.join(one.copy,'package.json'),'utf8').then(JSON.parse)).version,'opf --version reports the one installed core');
  if(registry)assert.ok(satisfies(one.version,sourceManifest.dependencies['@openpresentation/opf']),'The installed core must satisfy the CLI dependency range at the release commit');
 } else {
  const coreManifest=JSON.parse(run('git',['show',`${registryRef}:packages/javascript/package.json`],root));
  assert.equal(versions.opf,coreManifest.version,'Bundled core must match the immutable CLI source');
 }
 assert.ok(JSON.parse(run(process.execPath,[bin,'create','-','--title','Installed binary'],temp)).slides.length);
 const richDeck={slides:[{table:{columns:[['Rich ',{text:'header',bold:true}]],rows:[[[{text:'Cell',italic:true}]]]}}]};
 const richFile=path.join(temp,'rich-table.opf.json');await writeFile(richFile,JSON.stringify(richDeck));
 run(process.execPath,[bin,'validate',richFile],temp);
 await writeFile(path.join(temp,'AGENTS.md'),'Keep existing project instructions.');
 const npxResult=JSON.parse(run('npm',['exec','--yes','--prefer-online','--ignore-scripts','--cache',cache,'--package',registry?registrySpec:tarball,...candidateCore.flatMap(file=>['--package',file]),'--','opf','skills','install'],temp));
 assert.equal(npxResult.changed.length,6,'npx-style installation must install the bundled skills');
 assert.equal(await readFile(path.join(temp,'AGENTS.md'),'utf8'),'Keep existing project instructions.');
 assert.deepEqual(JSON.parse(run(process.execPath,[bin,'skills','install'],temp)).changed,[]);
 assert.ok(JSON.parse(await readFile(path.join(temp,'.agents/skills/opf-author/assets/decision-brief.opf.json'),'utf8')).slides.length);
 let commandTests=path.join(pkg,'test/cli.mjs');
 if(registry){
  const ref=verificationRef??plan.verificationRefs.cli;
  assert.match(ref,/^[a-f0-9]{40}$/);
  // The published harness keeps its place in its release's tree: it is written at packages/cli/test/ under a scratch root,
  // with every repository file it reads by a relative URL (the catalog snapshot it counts layouts against, fixtures) taken
  // from the same release commit, so it checks the published CLI against what that release shipped.
  const tree=path.join(temp,'published-tree');
  commandTests=path.join(tree,'packages/cli/test/published-command-tests.mjs');
  const source=run('git',['show',`${ref}:packages/cli/test/cli.mjs`],root);
  await mkdir(path.dirname(commandTests),{recursive:true});
  await writeFile(commandTests,source);
  for(const [,relative] of source.matchAll(/new URL\(\s*['"](\.\.?\/[^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g)){
   const file=path.posix.normalize(path.posix.join('packages/cli/test',relative));
   if(file.startsWith('..')||file.endsWith('/'))continue;
   const target=path.join(tree,...file.split('/'));
   await mkdir(path.dirname(target),{recursive:true});
   await writeFile(target,spawnSync('git',['show',`${ref}:${file}`],{cwd:root,maxBuffer:256*1024*1024}).stdout);
  }
 }
 const output=run(process.execPath,[commandTests],temp,{OPF_TEST_BIN:bin});
 console.log(output.trim());console.log(`Standalone global and npx-style installation passed (${registry?'npm registry':'local pack'}). Integrity: ${packed.integrity}. Tarball: ${tarball}`);
}finally{
 const actual=await realpath(temp),parent=await realpath(tmpdir());
 assert.ok(actual.startsWith(parent+path.sep)&&path.basename(actual).startsWith('opf-cli-installed-'));
 await rm(actual,{recursive:true,force:true});
}
