// Exercise code workflows using an ordinary installed candidate or registry set.
// Test tooling is supplied by the verification checkout, not by the runtime API.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath,readdir,mkdtemp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {packageManagerInvocation} from './package-manager.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
assert.ok(!process.env.NODE_OPTIONS&&!process.execArgv.some(arg=>/^(--import|--loader|--experimental-loader|--require|-r)(=|$)/.test(arg)),'Installed verification must not alias packages with a loader.');
const out=await realpath(path.join(root,'artifacts/npm'));
const registry=process.argv.includes('--registry');
const consumer=await realpath(process.argv.slice(2).find(arg=>arg!=='--registry')??path.join(out,registry?'registry-consumer':'consumer'));
const within=(parent,file)=>{const relative=path.relative(parent,file);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);};
assert.ok(within(out,consumer));
const modules=await realpath(path.join(consumer,'node_modules'));
assert.ok(within(consumer,modules),'Installed modules must remain inside this consumer');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const lockBytes=await readFile(path.join(consumer,'package-lock.json')),lock=JSON.parse(lockBytes);
const plan=registry?JSON.parse(await readFile(path.join(root,'release-plan.json'),'utf8')):null;
const manifest=registry?{artifacts:plan.packages.filter(item=>item.name!=='@openpresentation/cli')}:JSON.parse(await readFile(path.join(out,'manifest.json'),'utf8'));
if(!registry)assert.equal(manifest.published,false,'Candidate mode requires unpublished local archives.');
const checkout=repo=>repo==='opf'?root:path.resolve(root,'..',repo);
const immutable=(repo,file)=>{
 const ref=plan.verificationRefs[repo];assert.match(ref??'',/^[a-f0-9]{40}$/);
 return execFileSync('git',['show',`${ref}:${file}`],{cwd:checkout(repo),maxBuffer:16*1024*1024});
};
const sourceFile=async(repo,file)=>registry?immutable(repo,file).toString('utf8'):readFile(path.join(checkout(repo),file),'utf8');
const npm=args=>{const invocation=packageManagerInvocation('npm',args);return execFileSync(invocation.command,invocation.args,{cwd:consumer,encoding:'utf8',maxBuffer:16*1024*1024});};
const packages=[],runtime={},harnesses=[];
for(const item of manifest.artifacts) {
  const installed=await realpath(path.join(modules,item.name));assert.ok(within(modules,installed),'No linked source packages');
  const pkg=JSON.parse(await readFile(path.join(installed,'package.json'),'utf8'));
  const entry=lock.packages['node_modules/'+item.name];assert.equal(pkg.version,item.version);assert.equal(entry.version,item.version);assert.ok(!entry.link);
  let expectedDirectory,record;
  if(registry){
    assert.ok(entry.resolved?.startsWith('https://registry.npmjs.org/')&&!entry.link,'Use a registry package');
    const repo=item.name.split('/').at(-1),spec=`${item.name}@${item.version}`;
    const metadata=JSON.parse(npm(['view',spec,'--json','--offline=false','--prefer-online']));
    assert.equal(metadata.gitHead,plan.verificationRefs[repo]);assert.equal(entry.integrity,metadata.dist.integrity,'Registry integrity must match the installed lock');
    const packed=JSON.parse(npm(['pack',spec,'--json','--ignore-scripts','--offline=false','--prefer-online']))[0];
    assert.equal(path.basename(packed.filename),packed.filename);
    const archive=path.join(consumer,packed.filename),tarball=await readFile(archive);
    assert.equal('sha512-'+createHash('sha512').update(tarball).digest('base64'),entry.integrity);
    const entries=execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).trim().split(/\r?\n/);
    assert.ok(entries.every(file=>file.startsWith('package/')&&!file.split(/[\\/]/).includes('..')));
    const extracted=await mkdtemp(path.join(consumer,'registry-code-archive-'));assert.ok(within(consumer,await realpath(extracted)));
    execFileSync('tar',['-xzf',archive,'-C',extracted]);expectedDirectory=path.join(extracted,'package');
    const files={};
    for(const file of entries.map(name=>name.slice('package/'.length)).filter(name=>name&&!name.endsWith('/'))){
      const actual=await realpath(path.join(installed,file));assert.ok(within(installed,actual));
      const expected=await realpath(path.join(expectedDirectory,file));assert.ok(within(extracted,expected));
      const digest=hash(await readFile(actual));assert.equal(digest,hash(await readFile(expected)),'Installed files differ from registry archive');files[file]=digest;
      if(repo!=='opf')assert.equal(digest,hash(immutable(repo,file)),'Installed files differ from immutable release commit');
    }
    record={...item,gitHead:metadata.gitHead,installedVersion:pkg.version,integrity:entry.integrity,archiveSha256:hash(tarball),files};
  }else{
  const tarball=await readFile(path.join(out,item.file));
  assert.equal(hash(tarball),item.sha256,'Candidate tarball changed');
  assert.ok(entry.resolved?.startsWith('file:'),'Use the candidate tarball, not a registry package with the same version');
  assert.equal(entry.integrity,'sha512-'+createHash('sha512').update(tarball).digest('base64'),'Candidate integrity must match the installed lock');
  record={...item,installedVersion:pkg.version,integrity:entry.integrity};expectedDirectory=path.join(out,'staging',item.name.split('/').at(-1));
  }
  packages.push(record);
  for(const directory of ['dist',...(item.name==='@openpresentation/opf-pptx'?['vendor']:[])]) {
    for(const file of (await readdir(path.join(installed,directory),{recursive:true})).filter(file=>/\.(?:js|mjs|cjs)$/.test(file)).sort()) {
      const actual=await realpath(path.join(installed,directory,file));assert.ok(within(installed,actual));
      const digest=hash(await readFile(actual));
      assert.equal(digest,hash(await readFile(path.join(expectedDirectory,directory,file))),registry?'Installed runtime differs from registry archive':'Installed runtime differs from the staged package');
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
  const source=registry?immutable(repo,sourceFile).toString('utf8'):await readFile(path.join(checkout(repo),sourceFile),'utf8'),adapted=adapt(source);
  await writeFile(path.join(consumer,destination),adapted);
  harnesses.push({repo,...(registry?{ref:plan.verificationRefs[repo]}:{}),sourceFile,destination,sourceSha256:hash(source),executedSha256:hash(adapted)});
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
  let source=await sourceFile(repo,name);
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
  const file=repo+'-installed-code-browser.mjs',report=path.join(reportDirectory,repo+`-installed-code${registry?'-registry':''}-browser.json`);
  await writeFile(path.join(consumer,file),source);harnesses.push({repo,...(registry?{ref:plan.verificationRefs[repo]}:{}),sourceFile:name,destination:file,sourceSha256:sourceHash,executedSha256:hash(source)});
  run([file,report]);const bytes=await readFile(report),data=JSON.parse(bytes);
  if(registry){assert.equal(data.results.length,isEditor?2:12);assert.deepEqual(data.errors,[]);assert.deepEqual(data.externalRequests,[]);if(isEditor)assert.equal(data.blankTargets.length,2);}
  browserReports.push({file:path.basename(report),sha256:hash(bytes),report:data});
}
assert.equal(hash(await readFile(path.join(consumer,'package-lock.json'))),hash(lockBytes));
for(const [file,digest] of Object.entries(runtime))assert.equal(hash(await readFile(path.join(modules,file))),digest,'Installed runtime must not change during verification');
await writeFile(path.join(reportDirectory,`installed-code${registry?'-registry':''}-summary.json`),JSON.stringify({node:process.version,mode:registry?'registry':'candidate-tarballs',consumer:path.relative(root,consumer).split(path.sep).join('/'),lockSha256:hash(lockBytes),packages,runtime,harnesses,browserReports,scope:`Fresh ${registry?'registry installation with immutable released fixtures and archive byte matches':'candidate installation'}: core code/compose/pagination tests, actual converter source/metadata/guard tests, renderer source/measurement checks and executed font-loaded offline editor/SVG browser workflows. No source aliases or bundled runtime outside installed node_modules. Native PowerPoint and public deployment evidence remain separate.`},null,2)+'\n');
console.log(`Installed code: ${registry?'registry':'candidate'} source, pagination, metadata guards and actual offline browser workflows passed.`);
