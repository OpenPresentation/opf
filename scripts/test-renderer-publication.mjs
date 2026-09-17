// Verify an independently published renderer before advancing the complete set.
// node scripts/test-renderer-publication.mjs <version> <release-commit> [renderer-checkout]
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,writeFile,realpath,symlink,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {packageManagerInvocation} from './package-manager.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
assert.ok(!process.env.NODE_OPTIONS&&!process.execArgv.some(arg=>/^(--import|--loader|--experimental-loader|--require|-r)(=|$)/.test(arg)),'Registry verification must not use source loaders or module aliases');
const [version,ref,checkout=path.resolve(root,'../opf-render')]=process.argv.slice(2);
assert.match(version??'',/^\d+\.\d+\.\d+$/);assert.match(ref??'',/^[a-f0-9]{40}$/);
const environment={...process.env};
for(const key of ['NODE_OPTIONS','OPF_TEST_RASTER_MODULE','OPF_GOLDEN_BASELINE','OPF_EXAMPLES_DIR','OPF_GOLDEN_OUT','OPF_GOLDEN_SCALE'])delete environment[key];
const execute=(command,args,cwd,encoding='utf8')=>execFileSync(command,args,{cwd,encoding,env:environment,maxBuffer:16*1024*1024});
const git=args=>execute('git',args,checkout);
const sourceManifest=JSON.parse(git(['show',`${ref}:package.json`]));
assert.equal(sourceManifest.name,'@openpresentation/opf-render');assert.equal(sourceManifest.version,version);
const [major,minor]=version.split('.').map(Number),verifyCode=major>0||minor>=7;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const artifactRoot=path.join(root,'artifacts/npm');await mkdir(artifactRoot,{recursive:true});
assert.ok((await realpath(artifactRoot)).startsWith((await realpath(root))+path.sep));
const temporary=await mkdtemp(path.join(artifactRoot,`renderer-${version}-node${process.versions.node.split('.')[0]}-`));
const actualTemporary=await realpath(temporary);
const npm=args=>{const invocation=packageManagerInvocation('npm',args);return execute(invocation.command,invocation.args,temporary);};
try{
 const spec=`${sourceManifest.name}@${version}`;
 await writeFile(path.join(temporary,'package.json'),JSON.stringify({private:true,type:'module'}));
 const metadata=JSON.parse(npm(['view',spec,'--json','--offline=false','--prefer-online']));assert.equal(metadata.gitHead,ref);
 npm(['install','--ignore-scripts','--no-fund','--no-audit','--offline=false','--prefer-online',spec,`esbuild@${sourceManifest.devDependencies.esbuild}`,`playwright@${sourceManifest.devDependencies.playwright}`]);
 const lock=JSON.parse(await readFile(path.join(temporary,'package-lock.json'),'utf8'));
 const installed=path.join(temporary,'node_modules/@openpresentation/opf-render');
 const entry=lock.packages['node_modules/@openpresentation/opf-render'];
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
  const bytes=await readFile(path.join(installed,file));
  const source=execute('git',['show',`${ref}:${file}`],checkout,null);
  assert.equal(hash(bytes),hash(source),`Registry bytes differ from the release commit: ${file}`);files[file]=hash(bytes);
 }
 const audit=JSON.parse(npm(['audit','--json']));assert.equal(audit.metadata.vulnerabilities.total,0);
 const signatures=npm(['audit','signatures']);process.stdout.write(signatures);
 const fixture=path.join(temporary,'verification');await mkdir(fixture);
 const testsArchive=path.join(temporary,'tests.tar');git(['archive',ref,'test','scripts','--output',testsArchive]);
 execute('tar',['-xf',testsArchive,'-C',fixture],temporary);
 await symlink(path.join(installed,'dist'),path.join(fixture,'dist'),process.platform==='win32'?'junction':'dir');
 assert.equal(await realpath(path.join(fixture,'dist')),await realpath(path.join(installed,'dist')));
 const results=[];
 for(const test of ['webp.mjs','jpeg-orientation.mjs','rich-table.mjs','styled-table.mjs','quote-footer.mjs','shared-quote.mjs',...(verifyCode?['shared-code.mjs']:[]),'golden.mjs']){
  const output=execute(process.execPath,[path.join(fixture,'test',test)],temporary);process.stdout.write(output);results.push({test,output:output.trim()});
 }
 process.stdout.write(execute(process.execPath,[path.join(fixture,'scripts/build-browser-check.mjs')],temporary));
 const browser=JSON.parse(execute(process.execPath,[path.join(fixture,'test/browser-check.mjs')],temporary));
 let codeBrowser;
 if(verifyCode){
  const output=path.join(temporary,'code-browser.json');
  process.stdout.write(execute(process.execPath,[path.join(fixture,'test/shared-code-browser.mjs'),output],temporary));
  codeBrowser=JSON.parse(await readFile(output,'utf8'));
  assert.equal(codeBrowser.results.length,12);assert.deepEqual(codeBrowser.errors,[]);assert.deepEqual(codeBrowser.externalRequests,[]);
  assert.equal(codeBrowser.rendererSha256,files['dist/svg.js']);
  assert.equal(codeBrowser.verifierSha256,hash(await readFile(path.join(fixture,'test/shared-code-browser.mjs'))));
 }
 const core=lock.packages['node_modules/@openpresentation/opf'];
 assert.ok(core.resolved.startsWith('https://registry.npmjs.org/')&&!core.link);
 for(const [file,digest] of Object.entries(files))assert.equal(hash(await readFile(path.join(installed,file))),digest,'Verification must not rebuild the published renderer');
 const report={checkedAt:new Date().toISOString(),node:process.version,name:sourceManifest.name,version,gitHead:ref,integrity:entry.integrity,attestations:metadata.dist.attestations,core:{version:core.version,integrity:core.integrity},files,knownVulnerabilities:0,signatureVerification:signatures.trim(),tests:results,browser,...(codeBrowser?{codeBrowser}:{}),boundary:'Actual npm renderer and core, shipped bytes matched to the immutable release commit, pinned source fixtures, loaded-font browser execution and reviewed raster baseline. For renderer 0.7+, includes code source/XML-boundary regressions and twelve actual code SVG/font browser cases. No source renderer rebuild, native PowerPoint equivalence or complete-set adoption claim.'};
 const reportPath=path.join(artifactRoot,`renderer-${version}-node${process.versions.node.split('.')[0]}-report.json`);
 await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
 console.log(`Published renderer ${version} verified: ${Object.keys(files).length} immutable file matches, ${results.length} suites, browser ${browser.browser}. Report: ${reportPath}`);
}finally{
 const actual=await realpath(temporary);assert.equal(actual,actualTemporary);
 assert.ok(actual.startsWith((await realpath(artifactRoot))+path.sep));
 await rm(actual,{recursive:true,force:true});
}
