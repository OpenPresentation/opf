// node scripts/test-pptx-publication.mjs <version> <release-commit> [checkout] [--native]
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,writeFile,realpath,symlink,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {packageManagerInvocation} from './package-manager.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
assert.ok(!process.env.NODE_OPTIONS&&!process.execArgv.some(arg=>/^(--import|--loader|--experimental-loader|--require|-r)(=|$)/.test(arg)),'Registry verification must not use source loaders or module aliases');
const [version,ref,checkout=path.resolve(root,'../opf-pptx')]=process.argv.slice(2).filter(value=>value!=='--native');
const native=process.argv.includes('--native');
assert.match(version??'',/^\d+\.\d+\.\d+$/);assert.match(ref??'',/^[a-f0-9]{40}$/);
assert.ok(!native||process.platform==='win32','Native verification requires Windows with PowerPoint.');
const environment={...process.env};
for(const key of ['NODE_OPTIONS','OPF_TEST_RASTER_MODULE','OPF_TEST_PPTX_MODULE','OPF_GOLDEN_BASELINE','OPF_EXAMPLES_DIR','OPF_GOLDEN_OUT','OPF_GOLDEN_SCALE'])delete environment[key];
const execute=(command,args,cwd,encoding='utf8')=>execFileSync(command,args,{cwd,encoding,env:environment,maxBuffer:16*1024*1024});
const git=args=>execute('git',args,checkout);
const sourceManifest=JSON.parse(git(['show',`${ref}:package.json`]));
assert.equal(sourceManifest.name,'@openpresentation/opf-pptx');assert.equal(sourceManifest.version,version);
const [releaseMajor,releaseMinor]=version.split('.').map(Number),verifyCode=releaseMajor>0||releaseMinor>=7;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const artifactRoot=path.join(root,'artifacts/npm');await mkdir(artifactRoot,{recursive:true});
assert.ok((await realpath(artifactRoot)).startsWith((await realpath(root))+path.sep));
const major=process.versions.node.split('.')[0];
const temporary=await mkdtemp(path.join(artifactRoot,`pptx-${version}-node${major}-`));
const actualTemporary=await realpath(temporary);
const npm=args=>{const invocation=packageManagerInvocation('npm',args);return execute(invocation.command,invocation.args,temporary);};
try{
 const spec=`${sourceManifest.name}@${version}`;
 await writeFile(path.join(temporary,'package.json'),JSON.stringify({private:true,type:'module'}));
 const metadata=JSON.parse(npm(['view',spec,'--json','--offline=false','--prefer-online']));assert.equal(metadata.gitHead,ref);
 npm(['install','--ignore-scripts','--no-fund','--no-audit','--offline=false','--prefer-online',spec,...Object.entries(sourceManifest.devDependencies).map(([name,version])=>`${name}@${version}`)]);
 const lockBytes=await readFile(path.join(temporary,'package-lock.json')),lock=JSON.parse(lockBytes);
 const installed=path.join(temporary,'node_modules/@openpresentation/opf-pptx');
 const entry=lock.packages['node_modules/@openpresentation/opf-pptx'];
 assert.equal(entry.version,version);assert.equal(entry.integrity,metadata.dist.integrity);
 assert.ok(entry.resolved.startsWith('https://registry.npmjs.org/')&&!entry.link);
 assert.ok((await realpath(installed)).startsWith((await realpath(path.join(temporary,'node_modules')))+path.sep));
 const packed=JSON.parse(npm(['pack',spec,'--json','--ignore-scripts','--offline=false','--prefer-online']))[0];
 const archive=path.join(temporary,packed.filename);
 assert.equal(`sha512-${createHash('sha512').update(await readFile(archive)).digest('base64')}`,entry.integrity);
 const files={};
 for(const name of execute('tar',['-tzf',archive],temporary).trim().split(/\r?\n/)){
  assert.ok(name.startsWith('package/')&&!name.split('/').includes('..'));
  const file=name.slice('package/'.length);if(!file||file.endsWith('/'))continue;
  const bytes=await readFile(path.join(installed,file)),source=execute('git',['show',`${ref}:${file}`],checkout,null);
  assert.equal(hash(bytes),hash(source),`Registry bytes differ from the release commit: ${file}`);files[file]=hash(bytes);
 }
 const dependencies={};
 for(const name of ['@openpresentation/opf','@openpresentation/opf-render']){
  const dependency=lock.packages['node_modules/'+name];
  assert.ok(dependency.resolved.startsWith('https://registry.npmjs.org/')&&!dependency.link);
  assert.ok((await realpath(path.join(temporary,'node_modules',name))).startsWith((await realpath(path.join(temporary,'node_modules')))+path.sep));
  dependencies[name]={version:dependency.version,integrity:dependency.integrity};
 }
 const audit=JSON.parse(npm(['audit','--json']));assert.equal(audit.metadata.vulnerabilities.total,0);
 const signatures=npm(['audit','signatures']);process.stdout.write(signatures);
 const fixture=path.join(temporary,'verification');await mkdir(fixture);
 const testsArchive=path.join(temporary,'tests.tar');git(['archive',ref,'test','scripts','--output',testsArchive]);
 execute('tar',['-xf',testsArchive,'-C',fixture],temporary);
 await writeFile(path.join(fixture,'package-lock.json'),lockBytes);
 for(const part of ['dist','vendor']){
  await symlink(path.join(installed,part),path.join(fixture,part),process.platform==='win32'?'junction':'dir');
  assert.equal(await realpath(path.join(fixture,part)),await realpath(path.join(installed,part)));
 }
 const tests=[];
 for(const test of ['dependency-boundary.mjs','styled-table.mjs','styled-table-import.mjs','content-layout.mjs','shared-quote.mjs',...(verifyCode?['shared-code.mjs','code-provenance.mjs']:[])]){
  const output=execute(process.execPath,[path.join(fixture,'test',test)],temporary);process.stdout.write(output);tests.push({test,output:output.trim()});
 }
 process.stdout.write(execute(process.execPath,[path.join(fixture,'scripts/build-browser-check.mjs')],temporary));
 const browser=JSON.parse(execute(process.execPath,[path.join(fixture,'test/browser-check.mjs')],temporary));
 let nativeEvidence,nativeCodeEvidence;
 if(native){
  const readEnvironment=()=>JSON.parse(execute('powershell.exe',['-NoProfile','-File',path.join(root,'scripts/powerpoint-environment.ps1')],temporary));
  const nativeEnvironment=readEnvironment();
  const output=path.join(artifactRoot,`pptx-${version}-native-node${major}`);
  process.stdout.write(execute(process.execPath,[path.join(fixture,'test/native-quote.mjs'),'generate',output],temporary));
  process.stdout.write(execute('powershell.exe',['-NoProfile','-File',path.join(fixture,'test/native-quote.ps1'),'-EvidenceDirectory',output],temporary));
  process.stdout.write(execute(process.execPath,[path.join(fixture,'test/native-quote.mjs'),'compare',output],temporary));
  const report=path.join(output,'comparison.json');nativeEvidence={report:path.relative(root,report).split(path.sep).join('/'),sha256:hash(await readFile(report)),environment:nativeEnvironment};
  if(verifyCode){
   const codeOutput=path.join(artifactRoot,`pptx-${version}-code-native-node${major}`);
   process.stdout.write(execute(process.execPath,[path.join(fixture,'test/native-code.mjs'),'generate',codeOutput],temporary));
   process.stdout.write(execute('powershell.exe',['-NoProfile','-File',path.join(fixture,'test/native-code.ps1'),'-EvidenceDirectory',codeOutput],temporary));
   process.stdout.write(execute(process.execPath,[path.join(fixture,'test/native-code.mjs'),'compare',codeOutput],temporary));
   const report=path.join(codeOutput,'comparison.json');nativeCodeEvidence={report:path.relative(root,report).split(path.sep).join('/'),sha256:hash(await readFile(report)),environment:nativeEnvironment};
  }
  assert.deepEqual(readEnvironment(),nativeEnvironment,'PowerPoint/Windows reference environment changed during verification');
 }
 for(const [file,digest] of Object.entries(files))assert.equal(hash(await readFile(path.join(installed,file))),digest,'Verification must not rebuild the published converter');
 const report={checkedAt:new Date().toISOString(),node:process.version,name:sourceManifest.name,version,gitHead:ref,integrity:entry.integrity,attestations:metadata.dist.attestations,dependencies,files,knownVulnerabilities:0,signatureVerification:signatures.trim(),tests,browser,nativeEvidence,...(nativeCodeEvidence?{nativeCodeEvidence}:{}),boundary:'Actual npm converter and predecessors; every shipped file matches the immutable release commit, pinned full model/corpus and browser fixtures execute installed dist/vendor. Converter 0.7+ adds code source/XML-boundary and provenance fixtures. Optional native evidence covers twelve controlled Calibri quote cases and, for 0.7+, eight Courier New code cases with editable source/metadata, save/reopen and reimport. Raster observations have no equivalence threshold.'};
 const reportPath=path.join(artifactRoot,`pptx-${version}-node${major}-report.json`);await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
 console.log(`Published PPTX ${version} verified: ${Object.keys(files).length} immutable file matches, full model/corpus and browser ${browser.browser}${native?', native PowerPoint passed':''}. Report: ${reportPath}`);
}finally{
 const actual=await realpath(temporary);assert.equal(actual,actualTemporary);assert.ok(actual.startsWith((await realpath(artifactRoot))+path.sep));
 await rm(actual,{recursive:true,force:true});
}
