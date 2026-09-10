import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,realpath,rm,cp,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),npmCli=process.env.npm_execpath;
assert.ok(npmCli?.endsWith('npm-cli.js'),'Run through npm run test:packed.');
const temporary=await mkdtemp(path.join(tmpdir(),'opf-editor-packed-'));
const actualTemporary=await realpath(temporary),temporaryParent=await realpath(tmpdir());
const npm=(args,cwd)=>execFileSync(process.execPath,[npmCli,...args],{cwd,encoding:'utf8',maxBuffer:12*1024*1024});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
 const manifest=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
 const packed=JSON.parse(npm(['pack','--json','--pack-destination',temporary],root))[0];
 const consumer=path.join(temporary,'consumer');await mkdir(consumer);
 await writeFile(path.join(consumer,'package.json'),JSON.stringify({private:true,type:'module'}));
 npm(['install','--ignore-scripts','--no-audit','--no-fund',path.join(temporary,packed.filename),...Object.entries(manifest.devDependencies).map(([name,version])=>`${name}@${version}`)],consumer);
 const installed=path.join(consumer,'node_modules/@openpresentation/opf-editor'),files={};
 assert.ok((await realpath(installed)).startsWith((await realpath(path.join(consumer,'node_modules')))+path.sep));
 for(const {path:file} of packed.files){
  assert.ok(!path.isAbsolute(file)&&!file.split(/[/\\]/).includes('..'));
  const bytes=await readFile(path.join(installed,file));
  assert.equal(hash(bytes),hash(await readFile(path.join(root,file))),`Installed file differs: ${file}`);files[file]=hash(bytes);
 }
 const lock=JSON.parse(await readFile(path.join(consumer,'package-lock.json'),'utf8')),dependencies={};
 for(const name of ['@openpresentation/opf','@openpresentation/opf-render','@openpresentation/opf-pptx']){
  const entry=lock.packages['node_modules/'+name];
  assert.ok(entry.resolved.startsWith('https://registry.npmjs.org/')&&!entry.link);
  assert.ok((await realpath(path.join(consumer,'node_modules',name))).startsWith((await realpath(path.join(consumer,'node_modules')))+path.sep));
  dependencies[name]={version:entry.version,resolved:entry.resolved,integrity:entry.integrity};
 }
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
 for(const file of ['smoke.mjs','component-smoke.mjs','canvas-fields.mjs','transfer.mjs','schema.mjs','rich-text.mjs','layout.mjs','blocks.mjs','styled-table.mjs']){
  const output=execFileSync(process.execPath,[path.join(fixture,'test',file)],{cwd:consumer,encoding:'utf8'});
  process.stdout.write(output);tests.push({file,fixtureSha256:hash(await readFile(path.join(fixture,'test',file))),output:output.trim()});
 }
 process.stdout.write(execFileSync(process.execPath,[path.join(fixture,'scripts/build-playground.mjs')],{cwd:consumer,encoding:'utf8'}));
 const browser=execFileSync(process.execPath,[path.join(fixture,'test/playground-pptx.mjs')],{cwd:consumer,encoding:'utf8',maxBuffer:8*1024*1024});process.stdout.write(browser);
 for(const [file,digest] of Object.entries(files))assert.equal(hash(await readFile(path.join(installed,file))),digest,'Browser verification must not rebuild the installed editor');
 const audit=JSON.parse(npm(['audit','--json'],consumer));assert.equal(audit.metadata.vulnerabilities.total,0);
 const signatures=npm(['audit','signatures'],consumer);process.stdout.write(signatures);
 await mkdir(path.join(root,'artifacts'),{recursive:true});
 await writeFile(path.join(root,`artifacts/packed-consumer-node${process.versions.node.split('.')[0]}.json`),JSON.stringify({node:process.version,name:manifest.name,version:manifest.version,integrity:packed.integrity,files,dependencies,tests,browser:browser.trim(),signatureVerification:signatures.trim(),knownVulnerabilities:0,boundary:'Actual installed editor candidate with byte-matched distributables and registry predecessors; nine model/component suites and offline browser author/edit/paginate/export/reimport/undo. Native PowerPoint and complete-set deployed-site evidence are separate gates.'},null,2)+'\n');
 console.log(`Packed editor passed: ${Object.keys(files).length} byte-matched files, ${tests.length} model suites, offline browser workflow; ${packed.integrity}`);
}finally{
 const actual=await realpath(temporary);assert.equal(actual,actualTemporary);
 assert.ok(actual.startsWith(temporaryParent+path.sep)&&path.basename(actual).startsWith('opf-editor-packed-'));
 await rm(actual,{recursive:true,force:true});
}
