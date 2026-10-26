import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,realpath,rm,cp,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSpec} from '../../../scripts/package-manager.mjs';
import {packWorkspacePackage} from '../../../scripts/workspace-pack.mjs';
// MR-23d/23e: the editor is packed with `pnpm pack` (it rewrites `workspace:` to the versions the published package carries) and its
// packed manifest is the one read below. The consumer installs the packed editor together with the packed workspace packages it
// needs (gallery, core, renderer, PPTX converter), all through scripts/workspace-pack.mjs: 0.26.0 is not on the registry before the
// release, so these tarballs stand for the published dependencies. Every npm command goes through spawnSpec, which runs the package
// manager's JavaScript entrypoint on Windows without a shell and does not need npm_execpath (`pnpm run` sets it to pnpm's own entrypoint).
const root=fileURLToPath(new URL('../',import.meta.url));
const temporary=await mkdtemp(path.join(tmpdir(),'opf-editor-packed-'));
const actualTemporary=await realpath(temporary),temporaryParent=await realpath(tmpdir());
const run=(argv,cwd)=>{const {command,args,options}=spawnSpec(argv);return execFileSync(command,args,{...options,cwd,encoding:'utf8',maxBuffer:12*1024*1024});};
const npm=(args,cwd)=>run(['npm',...args],cwd);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
 // The editor under test, packed as it publishes; its manifest is read from the tarball, where `workspace:` is already a version.
 // packWorkspacePackage reads the packed manifest from the tarball and fails when it still holds a `workspace:` spec.
 const packed=packWorkspacePackage('@openpresentation/opf-editor',temporary),tarball=packed.tarball,manifest=packed.manifest;
 const manifestText=packed.entries.get('package.json').toString('utf8');
 const consumer=path.join(temporary,'consumer');await mkdir(consumer);
 await writeFile(path.join(consumer,'package.json'),JSON.stringify({private:true,type:'module'}));
 // The consumer installs the workspace's candidates for the packages the editor depends on, so its font packages (exact-pinned optional
 // peers of opf-render) are the versions that renderer declares, not the editor's own development pins.
 const candidates=[];
 for(const name of ['@openpresentation/gallery','@openpresentation/opf','@openpresentation/opf-render','@openpresentation/opf-pptx'])candidates.push(packWorkspacePackage(name,temporary));
 const candidate=name=>candidates.find(item=>item.name===name);
 const published=candidate('@openpresentation/opf-render').manifest;
 const fontPeers=Object.fromEntries(Object.entries(published.peerDependencies??{}).filter(([name])=>name.startsWith('@expo-google-fonts/')));
 const installSpec=([name,version])=>`${name}@${fontPeers[name]??version}`;
 // An `npm:` alias (react-18, react-dom-18) is only for the repository's React 18 browser test, and npm would refuse its peer on React 18 beside React 19.
 const thirdParty=Object.entries(manifest.devDependencies).filter(([name,spec])=>!candidate(name)&&name!==manifest.name&&!String(spec).startsWith('npm:'));
 npm(['install','--ignore-scripts','--no-audit','--no-fund',tarball,...candidates.map(item=>item.tarball),...thirdParty.map(installSpec)],consumer);
 const installed=path.join(consumer,'node_modules/@openpresentation/opf-editor'),files={};
 assert.ok((await realpath(installed)).startsWith((await realpath(path.join(consumer,'node_modules')))+path.sep));
 for(const {path:file} of packed.files){
  assert.ok(!path.isAbsolute(file)&&!file.split(/[/\\]/).includes('..'));
  const bytes=await readFile(path.join(installed,file));
  // package.json is the one file pnpm pack rewrites (workspace: ranges), so it is compared with the tarball's own copy.
  assert.equal(hash(bytes),file==='package.json'?hash(Buffer.from(manifestText)):hash(await readFile(path.join(root,file))),`Installed file differs: ${file}`);files[file]=hash(bytes);
 }
 const lock=JSON.parse(await readFile(path.join(consumer,'package-lock.json'),'utf8')),dependencies={};
 for(const name of ['@openpresentation/opf','@openpresentation/opf-render','@openpresentation/opf-pptx']){
  const entry=lock.packages['node_modules/'+name],candidateTarball=candidate(name);
  assert.ok(entry.resolved.startsWith('file:')&&!entry.link,`${name} is installed from the workspace candidate tarball`);
  assert.equal(entry.integrity,candidateTarball.integrity,`${name} is the packed candidate`);
  assert.ok((await realpath(path.join(consumer,'node_modules',name))).startsWith((await realpath(path.join(consumer,'node_modules')))+path.sep));
  dependencies[name]={version:entry.version,resolved:entry.resolved,integrity:entry.integrity};
 }
 assert.equal(dependencies['@openpresentation/opf-render'].version,published.version,'the consumer installed the renderer whose peers it installed');
 for(const [name,version] of Object.entries(fontPeers))if(manifest.devDependencies[name])assert.equal(lock.packages['node_modules/'+name]?.version,version,`${name} is the version the published renderer pins`);
 const fixture=path.join(consumer,'verification');await mkdir(fixture);
 for(const directory of ['test','examples'])await cp(path.join(root,directory),path.join(fixture,directory),{recursive:true});
 await mkdir(path.join(fixture,'scripts'));await cp(path.join(root,'scripts/build-playground.mjs'),path.join(fixture,'scripts/build-playground.mjs'));
 // Legacy fixture imports use both names. Both aliases point only to the
 // byte-matched installed distributables; no source runtime is copied or built.
 for(const alias of ['src','dist']){
  await symlink(path.join(installed,'dist'),path.join(fixture,alias),process.platform==='win32'?'junction':'dir');
  assert.equal(await realpath(path.join(fixture,alias)),await realpath(path.join(installed,'dist')));
 }
 const tests=[];
 for(const file of ['json-source.mjs','json-options.mjs']){
  const output=execFileSync(process.execPath,[path.join(fixture,'test',file)],{cwd:consumer,encoding:'utf8'});
  process.stdout.write(output);tests.push({file,fixtureSha256:hash(await readFile(path.join(fixture,'test',file))),output:output.trim()});
 }
 // Exercise the public JSON entrypoint using only installed consumer bytes.
 // Retain this scoped checkpoint even if an unrelated later package gate fails.
 await mkdir(path.join(root,'artifacts'),{recursive:true});
 const jsonReport=path.join(root,`artifacts/packed-json-browser-node${process.versions.node.split('.')[0]}.json`);
 process.stdout.write(execFileSync(process.execPath,[path.join(fixture,'test/json-editor-browser.mjs'),jsonReport,consumer],{cwd:consumer,encoding:'utf8',maxBuffer:8*1024*1024}));
 const jsonBrowser=JSON.parse(await readFile(jsonReport,'utf8'));
 assert.equal(jsonBrowser.status,'passed');assert.equal(jsonBrowser.runtime,'installed');assert.equal(jsonBrowser.checks.length,8);
 assert.ok(jsonBrowser.checks.includes('V2 metric layout reference preserves subtitle/notes/content and undo/redo atomically'));
 assert.deepEqual(jsonBrowser.errors,[]);assert.deepEqual(jsonBrowser.externalRequests,[]);
 for(const [file,digest] of Object.entries(files))assert.equal(hash(await readFile(path.join(installed,file))),digest,'JSON verification must not rebuild the installed editor');
 await writeFile(path.join(root,`artifacts/packed-json-consumer-node${process.versions.node.split('.')[0]}.json`),JSON.stringify({node:process.version,name:manifest.name,version:manifest.version,integrity:packed.integrity,files,dependencies,tests:[...tests],jsonBrowser,boundary:'JSON control only, from a byte-matched installed candidate and the workspace candidates of its dependencies (packed tarballs, not yet on the registry). Full-package acceptance still requires every subsequent gate and a successful overall command exit.'},null,2)+'\n');
 for(const file of ['smoke.mjs','component-smoke.mjs','canvas-fields.mjs','transfer.mjs','schema.mjs','rich-text.mjs','layout.mjs','blocks.mjs','styled-table.mjs','switches.mjs','switches-export.mjs','block-convert.mjs','content-actions.mjs','design-options.mjs','table-options.mjs','data-grid.mjs','switches-ui.mjs','assets.mjs','background-options.mjs','image-options.mjs','catalogs.mjs']){
  const output=execFileSync(process.execPath,[path.join(fixture,'test',file)],{cwd:consumer,encoding:'utf8'});
  process.stdout.write(output);tests.push({file,fixtureSha256:hash(await readFile(path.join(fixture,'test',file))),output:output.trim()});
 }
 process.stdout.write(execFileSync(process.execPath,[path.join(fixture,'scripts/build-playground.mjs')],{cwd:consumer,encoding:'utf8'}));
 const browser=execFileSync(process.execPath,[path.join(fixture,'test/playground-pptx.mjs')],{cwd:consumer,encoding:'utf8',maxBuffer:8*1024*1024});process.stdout.write(browser);
 const codeReport=path.join(temporary,'code-browser.json');
 process.stdout.write(execFileSync(process.execPath,[path.join(fixture,'test/code-browser.mjs'),codeReport],{cwd:consumer,encoding:'utf8',maxBuffer:8*1024*1024}));
 const codeBrowser=JSON.parse(await readFile(codeReport,'utf8'));
 assert.equal(codeBrowser.results.length,2);assert.equal(codeBrowser.blankTargets.length,2);
 assert.deepEqual(codeBrowser.errors,[]);assert.deepEqual(codeBrowser.externalRequests,[]);
 const richReport=path.join(temporary,'rich-input-browser.json');
 process.stdout.write(execFileSync(process.execPath,[path.join(fixture,'test/rich-input-browser.mjs'),richReport,'measured',consumer],{cwd:consumer,encoding:'utf8',maxBuffer:8*1024*1024}));
 const richBrowser=JSON.parse(await readFile(richReport,'utf8'));
 assert.equal(richBrowser.status,'passed');assert.equal(richBrowser.runtime,'installed');assert.equal(richBrowser.checks.length,14);
 assert.deepEqual(richBrowser.errors,[]);assert.deepEqual(richBrowser.externalRequests,[]);
 for(const [file,digest] of Object.entries(files))assert.equal(hash(await readFile(path.join(installed,file))),digest,'Browser verification must not rebuild the installed editor');
 const audit=JSON.parse(npm(['audit','--json'],consumer));assert.equal(audit.metadata.vulnerabilities.total,0);
 // Registry signatures exist only for packages that are on the registry. Before a release the workspace candidates are not, and
 // `npm audit signatures` fails looking them up, so the check is recorded as skipped until every candidate version is published.
 const unpublished=[];
 for(const item of candidates){try{npm(['view',`${item.name}@${item.manifest.version}`,'version'],temporary);}catch{unpublished.push(`${item.name}@${item.manifest.version}`);}}
 const signatures=unpublished.length?`skipped: ${unpublished.join(', ')} not on the registry yet (the release workflow verifies registry signatures after publication)`:npm(['audit','signatures'],consumer);process.stdout.write(signatures+'\n');
 await mkdir(path.join(root,'artifacts'),{recursive:true});
 await writeFile(path.join(root,`artifacts/packed-consumer-node${process.versions.node.split('.')[0]}.json`),JSON.stringify({node:process.version,name:manifest.name,version:manifest.version,integrity:packed.integrity,files,dependencies,tests,browser:browser.trim(),codeBrowser,richBrowser,jsonBrowser,signatureVerification:signatures.trim(),knownVulnerabilities:0,boundary:'Actual installed editor candidate with byte-matched distributables and the workspace candidates of its dependencies; eleven model/component suites and offline browser author/edit/paginate/export/reimport/undo, including JSON control/history/catalog menus, code source/metadata preservation, blank multiline targets and rich-input source/selection/formatting/undo. Native PowerPoint and complete-set deployed-site evidence are separate gates.'},null,2)+'\n');
 console.log(`Packed editor passed: ${Object.keys(files).length} byte-matched files, ${tests.length} model suites, offline browser workflow; ${packed.integrity}`);
}finally{
 const actual=await realpath(temporary);assert.equal(actual,actualTemporary);
 assert.ok(actual.startsWith(temporaryParent+path.sep)&&path.basename(actual).startsWith('opf-editor-packed-'));
 await rm(actual,{recursive:true,force:true});
}
