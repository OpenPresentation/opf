// Exercise code workflows using only an ordinary installed candidate package set.
// Test tooling is supplied by the verification checkout, not by the runtime API.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
assert.ok(!process.env.NODE_OPTIONS&&!process.execArgv.some(arg=>/^(--import|--loader|--experimental-loader|--require|-r)(=|$)/.test(arg)),'Installed verification must not alias packages with a loader.');
const out=await realpath(path.join(root,'artifacts/npm'));
const consumer=await realpath(process.argv[2]??path.join(out,'consumer'));
const within=(parent,file)=>{const relative=path.relative(parent,file);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);};
assert.ok(within(out,consumer));
const modules=await realpath(path.join(consumer,'node_modules'));
assert.ok(within(consumer,modules),'Installed modules must remain inside this consumer');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const lockBytes=await readFile(path.join(consumer,'package-lock.json')),lock=JSON.parse(lockBytes);
const manifest=JSON.parse(await readFile(path.join(out,'manifest.json'),'utf8'));
assert.equal(manifest.published,false,'This runner checks candidate tarballs; registry gates use published release harnesses.');
const packages=[],runtime={},harnesses=[];
for(const item of manifest.artifacts) {
  const installed=await realpath(path.join(modules,item.name));assert.ok(within(modules,installed),'No linked source packages');
  const pkg=JSON.parse(await readFile(path.join(installed,'package.json'),'utf8'));
  const entry=lock.packages['node_modules/'+item.name];assert.equal(pkg.version,item.version);assert.equal(entry.version,item.version);assert.ok(!entry.link);
  const tarball=await readFile(path.join(out,item.file));
  assert.equal(hash(tarball),item.sha256,'Candidate tarball changed');
  assert.ok(entry.resolved?.startsWith('file:'),'Use the candidate tarball, not a registry package with the same version');
  assert.equal(entry.integrity,'sha512-'+createHash('sha512').update(tarball).digest('base64'),'Candidate integrity must match the installed lock');
  packages.push({...item,installedVersion:pkg.version,integrity:entry.integrity});
  for(const directory of ['dist',...(item.name==='@openpresentation/opf-pptx'?['vendor']:[])]) {
    for(const file of (await readdir(path.join(installed,directory),{recursive:true})).filter(file=>/\.(?:js|mjs|cjs)$/.test(file)).sort()) {
      const actual=await realpath(path.join(installed,directory,file));assert.ok(within(installed,actual));
      const digest=hash(await readFile(actual));
      assert.equal(digest,hash(await readFile(path.join(out,'staging',item.name.split('/').at(-1),directory,file))),'Installed runtime differs from the staged package');
      runtime[item.name+'/'+directory+'/'+file.split(path.sep).join('/')]=digest;
    }
  }
}
const tooling=createRequire(path.resolve(root,'../opf-editor/package.json'));
const toolUrl=name=>pathToFileURL(tooling.resolve(name)).href;
const run=args=>{
  const result=spawnSync(process.execPath,args,{cwd:consumer,stdio:'inherit'});
  if(result.error)throw result.error;assert.equal(result.status,0,args.join(' '));
};
async function harness(repo,sourceFile,destination,adapt,args=[]) {
  const directory=repo==='opf'?root:path.resolve(root,'..',repo);
  const source=await readFile(path.join(directory,sourceFile),'utf8'),adapted=adapt(source);
  await writeFile(path.join(consumer,destination),adapted);
  harnesses.push({repo,sourceFile,destination,sourceSha256:hash(source),executedSha256:hash(adapted)});
  run([...args,destination]);
}
const core=source=>source.replaceAll("'../dist/composition.js'","'@openpresentation/opf/composition'").replaceAll("'../dist/pagination.js'","'@openpresentation/opf/pagination'").replaceAll("'../dist/index.js'","'@openpresentation/opf'");
for(const name of ['code-layout.test.mjs','code-composition.test.mjs'])await harness('opf','packages/javascript/test/'+name,name,core,['--test']);
const vendor="'./node_modules/@openpresentation/opf-pptx/vendor/pptxgenjs/pptxgen.es.js'";
for(const name of ['shared-code.mjs','code-provenance.mjs'])await harness('opf-pptx','test/'+name,'pptx-'+name,source=>source.replaceAll("'../dist/index.js'","'@openpresentation/opf-pptx'").replaceAll("'../vendor/pptxgenjs/pptxgen.es.js'",vendor));
await harness('opf-render','test/shared-code.mjs','renderer-code.mjs',source=>source.replaceAll("'../dist/svg.js'","'@openpresentation/opf-render/svg'").replaceAll("'../dist/fonts-node.js'","'@openpresentation/opf-render/fonts-node'"));
const reportDirectory=path.join(root,'artifacts/editor');await mkdir(reportDirectory,{recursive:true});
const browserReports=[];
for(const repo of ['opf-render','opf-editor']) {
  const isEditor=repo==='opf-editor',name=isEditor?'test/code-browser.mjs':'test/shared-code-browser.mjs';
  let source=await readFile(path.resolve(root,'..',repo,name),'utf8');
  const sourceHash=hash(source);
  source=source.replace("import {chromium} from 'playwright';",`import playwright from '${toolUrl('playwright')}'; const {chromium}=playwright;`)
    .replace("import {build} from 'esbuild';",`import esbuild from '${toolUrl('esbuild')}'; const {build}=esbuild;`);
  if(isEditor) {
    source=source.replaceAll("'./dist/index.js'","'@openpresentation/opf-editor'").replaceAll("'./dist/canvas.js'","'@openpresentation/opf-editor/canvas'").replace("new URL('../',import.meta.url)","new URL('./',import.meta.url)");
    source=source.replace('write:false,minify:true','write:false,minify:true,metafile:true');
    // Every browser bundle input must resolve under the installed consumer.
    source=source.replace("const bundle=bundled.outputFiles[0].text",`const installedBundleInputs={};
    for(const [input,metadata] of Object.entries(bundled.metafile.inputs))if(input!=='<stdin>'){
      if(input.startsWith('(disabled):')){
        assert.equal(metadata.bytes,0);assert.deepEqual(metadata.imports,[]);
        installedBundleInputs[input]={disabled:true,bytes:0};continue;
      }
      const actual=await (await import('node:fs/promises')).realpath(input);
      const modules=await (await import('node:fs/promises')).realpath('node_modules');
      assert.ok(actual.startsWith(modules+(await import('node:path')).sep),'Browser code must come from installed packages: '+input);
      installedBundleInputs[input]=hash(await readFile(actual));
    }
    const bundle=bundled.outputFiles[0].text`);
    source=source.replace('const report={browser:browser.version(),','const report={installedBundleInputs,browser:browser.version(),');
  } else {
    source=source.replace("readFile(new URL('../dist/svg.js',import.meta.url))","readFile(new URL('./node_modules/@openpresentation/opf-render/dist/svg.js',import.meta.url))")
      .replaceAll("'../dist/svg.js'","'@openpresentation/opf-render/svg'").replaceAll("'../dist/fonts-node.js'","'@openpresentation/opf-render/fonts-node'");
  }
  const file=repo+'-installed-code-browser.mjs',report=path.join(reportDirectory,repo+'-installed-code-browser.json');
  await writeFile(path.join(consumer,file),source);harnesses.push({repo,sourceFile:name,destination:file,sourceSha256:sourceHash,executedSha256:hash(source)});
  run([file,report]);const bytes=await readFile(report);browserReports.push({file:path.basename(report),sha256:hash(bytes),report:JSON.parse(bytes)});
}
assert.equal(hash(await readFile(path.join(consumer,'package-lock.json'))),hash(lockBytes));
await writeFile(path.join(reportDirectory,'installed-code-summary.json'),JSON.stringify({node:process.version,mode:'candidate-tarballs',consumer:path.relative(root,consumer).split(path.sep).join('/'),lockSha256:hash(lockBytes),packages,runtime,harnesses,browserReports,scope:'Fresh candidate installation: core code/compose/pagination tests, actual converter source/metadata/guard tests, renderer source/measurement checks and executed font-loaded offline editor/SVG browser workflows. No source aliases or bundled runtime outside installed node_modules. This is separate from registry publication and native PowerPoint evidence.'},null,2)+'\n');
console.log('Installed code: candidate source, pagination, metadata guards and actual offline browser workflows passed.');
