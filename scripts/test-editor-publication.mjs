// node scripts/test-editor-publication.mjs <version> <release-commit> [editor-checkout]
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,writeFile,realpath,symlink,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {packageManagerInvocation} from './package-manager.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
assert.ok(!process.env.NODE_OPTIONS&&!process.execArgv.some(arg=>/^(--import|--loader|--experimental-loader|--require|-r)(=|$)/.test(arg)),'Registry verification must not use source loaders or module aliases');
const [version,ref,checkout=path.resolve(root,'../opf-editor')]=process.argv.slice(2);
assert.match(version??'',/^\d+\.\d+\.\d+$/);assert.match(ref??'',/^[a-f0-9]{40}$/);
const environment={...process.env};delete environment.NODE_OPTIONS;
const execute=(command,args,cwd,encoding='utf8')=>execFileSync(command,args,{cwd,encoding,env:environment,maxBuffer:16*1024*1024});
const git=args=>execute('git',args,checkout);
const sourceManifest=JSON.parse(git(['show',`${ref}:package.json`]));
assert.equal(sourceManifest.name,'@openpresentation/opf-editor');assert.equal(sourceManifest.version,version);
const [releaseMajor,releaseMinor]=version.split('.').map(Number),verifyCode=releaseMajor>0||releaseMinor>=6;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const artifactRoot=path.join(root,'artifacts/npm');await mkdir(artifactRoot,{recursive:true});
assert.ok((await realpath(artifactRoot)).startsWith((await realpath(root))+path.sep));
const major=process.versions.node.split('.')[0];
const temporary=await mkdtemp(path.join(artifactRoot,`editor-${version}-node${major}-`));
const actualTemporary=await realpath(temporary);
const npm=args=>{const invocation=packageManagerInvocation('npm',args);return execute(invocation.command,invocation.args,temporary);};
try{
 const spec=`${sourceManifest.name}@${version}`;
 await writeFile(path.join(temporary,'package.json'),JSON.stringify({private:true,type:'module'}));
 const metadata=JSON.parse(npm(['view',spec,'--json','--offline=false','--prefer-online']));assert.equal(metadata.gitHead,ref);
 npm(['install','--ignore-scripts','--no-fund','--no-audit','--offline=false','--prefer-online',spec,...Object.entries(sourceManifest.devDependencies).map(([name,version])=>`${name}@${version}`)]);
 const lock=JSON.parse(await readFile(path.join(temporary,'package-lock.json'),'utf8'));
 const installed=path.join(temporary,'node_modules/@openpresentation/opf-editor'),entry=lock.packages['node_modules/@openpresentation/opf-editor'];
 assert.equal(entry.version,version);assert.equal(entry.integrity,metadata.dist.integrity);
 assert.ok(entry.resolved.startsWith('https://registry.npmjs.org/')&&!entry.link);
 assert.ok((await realpath(installed)).startsWith((await realpath(path.join(temporary,'node_modules')))+path.sep));
 const packed=JSON.parse(npm(['pack',spec,'--json','--ignore-scripts','--offline=false','--prefer-online']))[0],archive=path.join(temporary,packed.filename);
 assert.equal(`sha512-${createHash('sha512').update(await readFile(archive)).digest('base64')}`,entry.integrity);
 const files={};
 for(const name of execute('tar',['-tzf',archive],temporary).trim().split(/\r?\n/)){
  assert.ok(name.startsWith('package/')&&!name.split('/').includes('..'));
  const file=name.slice('package/'.length);if(!file||file.endsWith('/'))continue;
  const bytes=await readFile(path.join(installed,file)),source=execute('git',['show',`${ref}:${file}`],checkout,null);
  assert.equal(hash(bytes),hash(source),`Registry bytes differ from the release commit: ${file}`);files[file]=hash(bytes);
 }
 const dependencies={};
 for(const name of ['@openpresentation/opf','@openpresentation/opf-render','@openpresentation/opf-pptx']){
  const dependency=lock.packages['node_modules/'+name];
  assert.ok(dependency.resolved.startsWith('https://registry.npmjs.org/')&&!dependency.link);
  assert.ok((await realpath(path.join(temporary,'node_modules',name))).startsWith((await realpath(path.join(temporary,'node_modules')))+path.sep));
  dependencies[name]={version:dependency.version,integrity:dependency.integrity};
 }
 const audit=JSON.parse(npm(['audit','--json']));assert.equal(audit.metadata.vulnerabilities.total,0);
 const signatures=npm(['audit','signatures']);process.stdout.write(signatures);
 const fixture=path.join(temporary,'verification');await mkdir(fixture);
 const testsArchive=path.join(temporary,'tests.tar');git(['archive',ref,'test','scripts','examples','--output',testsArchive]);
 execute('tar',['-xf',testsArchive,'-C',fixture],temporary);
 for(const alias of ['src','dist']){
  await symlink(path.join(installed,'dist'),path.join(fixture,alias),process.platform==='win32'?'junction':'dir');
  assert.equal(await realpath(path.join(fixture,alias)),await realpath(path.join(installed,'dist')));
 }
 const tests=[];
 for(const test of ['smoke.mjs','component-smoke.mjs','canvas-fields.mjs','transfer.mjs','schema.mjs','rich-text.mjs','layout.mjs','blocks.mjs','styled-table.mjs']){
  const output=execute(process.execPath,[path.join(fixture,'test',test)],temporary);process.stdout.write(output);tests.push({test,output:output.trim()});
 }
 process.stdout.write(execute(process.execPath,[path.join(fixture,'scripts/build-playground.mjs')],temporary));
 const browser=JSON.parse(execute(process.execPath,[path.join(fixture,'test/playground-pptx.mjs')],temporary));
 let codeBrowser;
 if(verifyCode){
  const output=path.join(temporary,'code-browser.json');
  process.stdout.write(execute(process.execPath,[path.join(fixture,'test/code-browser.mjs'),output],temporary));
  codeBrowser=JSON.parse(await readFile(output,'utf8'));
  assert.equal(codeBrowser.results.length,2);assert.equal(codeBrowser.blankTargets.length,2);
  assert.deepEqual(codeBrowser.errors,[]);assert.deepEqual(codeBrowser.externalRequests,[]);
  assert.equal(codeBrowser.verifierSha256,hash(await readFile(path.join(fixture,'test/code-browser.mjs'))));
 }
 for(const [file,digest] of Object.entries(files))assert.equal(hash(await readFile(path.join(installed,file))),digest,'Verification must not rebuild the published editor');
 const report={checkedAt:new Date().toISOString(),node:process.version,name:sourceManifest.name,version,gitHead:ref,integrity:entry.integrity,attestations:metadata.dist.attestations,dependencies,files,knownVulnerabilities:0,signatureVerification:signatures.trim(),tests,browser,...(codeBrowser?{codeBrowser}:{}),boundary:'Actual npm editor and all predecessors; every shipped file matches the immutable release commit. Nine model/component suites and the offline browser author/edit/paginate/export/reimport/undo workflow execute installed distributables. Editor 0.6+ adds wide/portrait code source/metadata/pagination/export/reimport and blank multiline target/no-op/edit/undo cases. Native comparisons, all canvas suites and deployed-site adoption are separate evidence.'};
 const reportPath=path.join(artifactRoot,`editor-${version}-node${major}-report.json`);await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
 console.log(`Published editor ${version} verified: ${Object.keys(files).length} immutable file matches, ${tests.length} model suites, offline browser ${browser.browser}. Report: ${reportPath}`);
}finally{
 const actual=await realpath(temporary);assert.equal(actual,actualTemporary);assert.ok(actual.startsWith((await realpath(artifactRoot))+path.sep));
 await rm(actual,{recursive:true,force:true});
}
