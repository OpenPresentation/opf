import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile, readFile, readdir, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSpec } from '../../../scripts/package-manager.mjs';
import { assertLockstep, packWorkspacePackage } from '../../../scripts/workspace-pack.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
// MR-23c: the candidate and its workspace siblings are packed with `pnpm pack` (the packed manifest, not the workspace: specs, is what
// is tested) and installed from their tarballs; the version of a lockstep release is not on the registry yet. Run `pnpm run build:deps`
// first (the test:packed script does).
// Narrow control: node test/packed-install.mjs --production-only
const native=process.argv.includes('--native');
const productionOnly=process.argv.includes('--production-only');
assert.ok(!productionOnly || !native, 'Production-only control never runs native Office checks.');
assert.ok(!native||process.platform==='win32','--native requires Windows with Microsoft PowerPoint installed.');
const temporary = await mkdtemp(path.join(tmpdir(), 'opf-pptx-packed-'));
const actualTemporary=await realpath(temporary),temporaryParent=await realpath(tmpdir());
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const npm = (args, cwd) => { const { command, args: argv, options } = spawnSpec(['npm', ...args]); return execFileSync(command, argv, { ...options, cwd, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }); };
try {
  const candidateManifest=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
  assert.equal(candidateManifest.dependencies['@rgrove/parse-xml'],'4.2.3','The shipped vendor requires the pinned production XML parser, not a dev dependency.');
  assert.equal(candidateManifest.devDependencies?.['@rgrove/parse-xml'],undefined,'No dev parser may disguise the runtime dependency.');
  const packed = packWorkspacePackage('@openpresentation/opf-pptx', temporary);
  const coreName = '@openpresentation/opf', galleryName = '@openpresentation/gallery', renderName = '@openpresentation/opf-render';
  const core = packWorkspacePackage(coreName, temporary), gallery = packWorkspacePackage(galleryName, temporary);
  assertLockstep(packed, core); assertLockstep(packed, gallery);
  const shipped = new Set(packed.files.map(file => file.path));
  for (const name of ['pptxgen.es.js', 'LICENSE', 'UPSTREAM.json', 'package.json']) {
    assert.ok(shipped.has(`vendor/pptxgenjs/${name}`), `Missing shipped vendor file: ${name}`);
  }
  // RR-20: the engine's browser ZIP bundle (vendor/jszip/UPSTREAM.json).
  for (const name of ['index-min.js', 'LICENSE.md', 'UPSTREAM.json']) assert.ok(shipped.has(`vendor/jszip/${name}`), `Missing shipped vendor file: jszip/${name}`);
  const consumer = path.join(temporary, 'consumer');
  await mkdir(consumer);
  // Core 0.17 declares this package as an optional peer of its /node entry. `npm audit signatures` follows that registry edge
  // to the tarball and asks npm for a version it does not have yet (ETARGET); the override resolves the edge to the tarball too.
  // Core is a direct dependency at this package's range, so npm keeps the one core at the top level next to it.
  // Every workspace sibling the packed manifest names is installed from its own tarball (direct dependencies, so the overrides can
  // point the transitive edges at them and npm keeps one core at the top level).
  const self = packed.manifest, local = [packed, core, gallery];
  const localDependencies = packages => Object.fromEntries(packages.map(item => [item.name, `file:${item.tarball}`]));
  const localOverrides = packages => Object.fromEntries(packages.map(item => [item.name, `$${item.name}`]));
  await writeFile(path.join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: localDependencies(local), overrides: localOverrides(local) }));
  // --legacy-peer-deps: the optional peers (the renderer, at the lockstep range) are not on the registry yet, and npm would otherwise try to resolve
  // them from it (ERESOLVE). Optional peers are not installed either way; this only skips resolving the edge.
  npm(['install', '--omit=dev', '--ignore-scripts', '--no-fund', '--no-audit', '--legacy-peer-deps'], consumer);
  const installed=path.join(consumer,'node_modules/@openpresentation/opf-pptx'),files={};
  const actualConsumer=await realpath(consumer),actualModules=await realpath(path.join(consumer,'node_modules'));
  assert.equal(actualModules,path.join(actualConsumer,'node_modules'),'Fresh modules cannot alias an ancestor tree');
  const productionLock=JSON.parse(await readFile(path.join(consumer,'package-lock.json'),'utf8'));
  const candidateEntry=productionLock.packages['node_modules/@openpresentation/opf-pptx'];
  assert.equal(candidateEntry.integrity,packed.integrity,'Installed candidate comes from the packed tarball');
  assert.ok(!candidateEntry.link && candidateEntry.resolved.startsWith('file:') && candidateEntry.resolved.endsWith(packed.filename),'Candidate is the tarball, not a source directory alias');
  for(const item of [core,gallery])assert.equal(productionLock.packages['node_modules/'+item.name].integrity,item.integrity,`${item.name} comes from its packed tarball`);
  assert.equal(productionLock.packages['node_modules/@rgrove/parse-xml'].dev,undefined,'Runtime parser is not a dev-only lock entry');
  for(const {path:file} of packed.files){
    assert.ok(!path.isAbsolute(file)&&!file.split(/[/\\]/).includes('..'));
    const bytes=await readFile(path.join(installed,file));
    // The shipped manifest is the packed one (workspace: specs resolved); every other file is the source file.
    assert.equal(hash(bytes),hash(file==='package.json'?packed.entries.get(file):await readFile(path.join(root,file))),`Installed file differs: ${file}`);files[file]=hash(bytes);
  }
  const audit = JSON.parse(npm(['audit', '--json'], consumer));
  assert.equal(audit.metadata.vulnerabilities.total, 0);
  await writeFile(path.join(consumer, 'verify.mjs'), `
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,realpath,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {toPptx,fromPptx} from '@openpresentation/opf-pptx';
import {validate} from '@openpresentation/opf';
const require = createRequire(import.meta.url);
for(const name of ['image-size','pptxgenjs','@openpresentation/opf-render']) assert.throws(()=>require.resolve(name),{code:'MODULE_NOT_FOUND'});
const pkg = new URL('./', import.meta.resolve('@openpresentation/opf-pptx/package.json'));
const modules=await realpath(new URL('./node_modules/',import.meta.url));
const installedRoot=await realpath(pkg);
assert.equal(installedRoot,await realpath(new URL('./node_modules/@openpresentation/opf-pptx/',import.meta.url)),'Candidate imports from this isolated consumer');
assert.ok(installedRoot.startsWith(modules+path.sep));
const installedManifest=JSON.parse(await readFile(new URL('package.json',pkg),'utf8'));
assert.equal(installedManifest.dependencies['@rgrove/parse-xml'],'4.2.3');
const vendorRequire=createRequire(new URL('vendor/pptxgenjs/pptxgen.es.js',pkg));
const parserFile=await realpath(vendorRequire.resolve('@rgrove/parse-xml'));
const parserRoot=await realpath(new URL('./node_modules/@rgrove/parse-xml/',import.meta.url));
assert.ok(parserRoot.startsWith(modules+path.sep));
assert.ok(parserFile.startsWith(parserRoot+path.sep),'Shipped vendor parser cannot escape into source/ancestor modules');
const parserManifest=JSON.parse(await readFile(path.join(parserRoot,'package.json'),'utf8'));
assert.equal(parserManifest.version,'4.2.3');
const manifest = JSON.parse(await readFile(new URL('vendor/pptxgenjs/UPSTREAM.json',pkg),'utf8'));
for(const name of ['pptxgen.es.js','LICENSE']) {
 const bytes = await readFile(new URL('vendor/pptxgenjs/'+name,pkg));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.files[name].sha256);
}
const input = {name:'Installed package',slides:[
 {title:'Editable output',table:{columns:['Item','Value'],rows:[['Quality',42]]}},
 {title:'Metric',metric:{value:'42%',label:'Measured outcome'}},
 {title:'Quote',quote:{text:'Keep the source.',attribution:'Reviewer',source:'Interview'}},
 {title:'Code',code:{language:'python',source:'approve(change)'}},
 {title:'Timeline',timeline:{events:[{when:'Q1',what:'Pilot'},{when:'Q2',what:'Rollout'}]}}
]};
const bytes = await toPptx(input);
assert.ok(bytes.byteLength>1000);
const restored = await fromPptx(bytes);
assert.equal(restored.slides.length,input.slides.length);
assert.equal(validate(restored, {only: ['format']}).valid,true);
assert.ok(JSON.stringify(restored).includes('Quality'));
// FF-57: the quote re-imports as a quote payload, so its attribution and source are separate fields.
assert.ok(JSON.stringify(restored.slides[2].quote ?? restored.slides[2].blocks).includes(JSON.stringify(input.slides[2].quote)),'Installed quote payload');
for(const text of ['42%','approve(change)','Pilot','Rollout']) assert.ok(JSON.stringify(restored).includes(text), 'Installed payload text: '+text);
await writeFile('production-identity.json',JSON.stringify({installedRoot,parserFile,parserVersion:parserManifest.version,sourceAliases:false,productionOnlyInstall:true,exportBytes:bytes.byteLength,slides:restored.slides.length}));
console.log('Packed consumer: isolated production parser4.2.3, vendored licenses/hashes, absent unused dependencies, table/metric/quote/code/timeline export/reimport and schema validation pass.');
`);
  process.stdout.write(execFileSync(process.execPath, ['verify.mjs'], { cwd: consumer, encoding: 'utf8' }));
  const productionIdentity=JSON.parse(await readFile(path.join(consumer,'production-identity.json'),'utf8'));
  await mkdir(path.join(root,'artifacts'),{recursive:true});
  await writeFile(path.join(root,'artifacts/packed-production.json'),JSON.stringify({productionOnly,packed:{filename:packed.filename,integrity:packed.integrity,sha256:hash(await readFile(path.join(temporary,packed.filename)))},candidateVersion:candidateManifest.version,files,consumer:productionIdentity,lock:JSON.parse(await readFile(path.join(consumer,'package-lock.json'),'utf8'))},null,2)+'\n');
  if (!productionOnly) {
  // The basic consumer above also proves the optional renderer can be absent.
  // Add the packed renderer (the same lockstep version, from its own tarball) for accepted-layout and native checks.
  const manifest=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
  const render=packWorkspacePackage(renderName,temporary);assertLockstep(packed,render);assertLockstep(render,core);
  // Core lists the renderer as an optional peer at the lockstep range: a direct dependency plus an override make npm resolve that edge to
  // the tarball too (the same arrangement as the candidate above).
  const consumerManifest=JSON.parse(await readFile(path.join(consumer,'package.json'),'utf8'));
  await writeFile(path.join(consumer,'package.json'),JSON.stringify({...consumerManifest,dependencies:{...consumerManifest.dependencies,...localDependencies([render])},overrides:{...consumerManifest.overrides,...localOverrides([render])}}));
  npm(['install','--ignore-scripts','--no-fund','--no-audit','--legacy-peer-deps'],consumer);
  // RR-63: from opf-render 0.16 its PNG converter and the font packages of the base and office packs are optional peers, which npm
  // does not install. The copied tests load fonts and rasterize through render, so add them at the versions this package tests with
  // (render 0.15 lists the same versions as dependencies, so this adds nothing there).
  const renderPeers=['@resvg/resvg-js','@expo-google-fonts/arimo','@expo-google-fonts/caladea','@expo-google-fonts/cousine','@expo-google-fonts/gelasio','@expo-google-fonts/noto-sans','@expo-google-fonts/roboto','@expo-google-fonts/roboto-mono','@expo-google-fonts/tinos'];
  for(const name of renderPeers)assert.ok(manifest.devDependencies[name],`package.json devDependencies must pin ${name} for the packed consumer`);
  npm(['install','--ignore-scripts','--no-fund','--no-audit',...renderPeers.map(name=>`${name}@${manifest.devDependencies[name]}`)],consumer);
  const lock=JSON.parse(await readFile(path.join(consumer,'package-lock.json'),'utf8')),dependencies={};
  for(const item of [core,render]){
    const name=item.name,entry=lock.packages['node_modules/'+name];
    assert.ok(entry.resolved.startsWith('file:')&&!entry.link&&entry.integrity===item.integrity,`${name} is installed from its packed tarball`);
    assert.ok((await realpath(path.join(consumer,'node_modules',name))).startsWith((await realpath(path.join(consumer,'node_modules')))+path.sep));
    dependencies[name]={version:entry.version,resolved:entry.resolved,integrity:entry.integrity};
  }
  const registryFixtures=[];
  // FA-23: the copied tests import helpers from test/helpers/ (default-catalog.mjs registers the default catalog the way a
  // host does; RR-72's master-furniture.mjs reads a slide's layout and master). Install every helper next to them,
  // rewritten to the installed package, so a new helper cannot be missing from the clean consumer.
  await mkdir(path.join(consumer,'helpers'),{recursive:true});
  for(const helper of (await readdir(path.join(root,'test/helpers'))).filter(name=>name.endsWith('.mjs')))
    await writeFile(path.join(consumer,'helpers',helper),(await readFile(path.join(root,'test/helpers',helper),'utf8')).replaceAll("'../../dist/index.js'","'@openpresentation/opf-pptx'"));
  for(const file of ['shared-quote.mjs','shared-code.mjs','code-provenance.mjs','shared-timeline.mjs','font-variants.mjs','script-fonts.mjs','media-placeholder.mjs','layout-intent.mjs','chart-cache-import.mjs','zip-date.mjs','native-text-whitespace.mjs','native-underline.mjs','native-body-rich-text.mjs','engine-text-weights.mjs']){
    const shared=(await readFile(path.join(root,'test',file),'utf8'))
      .replaceAll("'../dist/index.js'","'@openpresentation/opf-pptx'")
      .replaceAll("'../dist/code-provenance.js'","'./node_modules/@openpresentation/opf-pptx/dist/code-provenance.js'")
      .replaceAll("'../dist/media-provenance.js'","'./node_modules/@openpresentation/opf-pptx/dist/media-provenance.js'")
      .replaceAll("'../vendor/pptxgenjs/pptxgen.es.js'","'./node_modules/@openpresentation/opf-pptx/vendor/pptxgenjs/pptxgen.es.js'");
    await writeFile(path.join(consumer,file),shared);
    process.stdout.write(execFileSync(process.execPath,[file],{cwd:consumer,encoding:'utf8',
      env:file==='zip-date.mjs'?{...process.env,OPF_ZIP_DATE_ARTIFACTS:path.join(root,'artifacts/zip-date/packed')}:file==='native-text-whitespace.mjs'?{...process.env,OPF_NATIVE_TEXT_ARTIFACTS:path.join(root,'artifacts/native-text-whitespace/packed')}:file==='native-body-rich-text.mjs'?{...process.env,OPF_NATIVE_BODY_ARTIFACTS:path.join(root,'artifacts/native-body-rich-text/packed')}:file==='native-underline.mjs'?{...process.env,OPF_NATIVE_UNDERLINE_ARTIFACTS:path.join(root,'artifacts/native-underline/packed')}:process.env}));
    registryFixtures.push({file,sha256:hash(Buffer.from(shared)),passed:true});
  }
  const withRendererAudit=JSON.parse(npm(['audit','--json'],consumer));assert.equal(withRendererAudit.metadata.vulnerabilities.total,0);
  const signatures=npm(['audit','signatures'],consumer);process.stdout.write(signatures);
  let nativeEvidence,nativeCodeEvidence;
  if(native){
    const tests=path.join(consumer,'test');await mkdir(tests);
    // MR-23c: the native harnesses record lock evidence through test/helpers/lock-evidence.mjs, which reads scripts/pnpm-lock.mjs. In the
    // consumer it finds package-lock.json next to the tests and hashes that; the modules just have to resolve.
    await mkdir(path.join(tests,'helpers'));await mkdir(path.join(consumer,'scripts'));
    await writeFile(path.join(tests,'helpers/lock-evidence.mjs'),await readFile(path.join(root,'test/helpers/lock-evidence.mjs')));
    await writeFile(path.join(consumer,'scripts/pnpm-lock.mjs'),await readFile(path.join(root,'scripts/pnpm-lock.mjs')));
    await writeFile(path.join(tests,'native-quote.mjs'),await readFile(path.join(root,'test/native-quote.mjs')));
    await writeFile(path.join(tests,'native-quote-import-contract.mjs'),await readFile(path.join(root,'test/native-quote-import-contract.mjs')));
    const evidence=path.join(root,`artifacts/native-quote-packed-node${process.versions.node.split('.')[0]}`);
    process.stdout.write(execFileSync(process.execPath,[path.join(tests,'native-quote.mjs'),'generate',evidence],{cwd:consumer,encoding:'utf8'}));
    process.stdout.write(execFileSync('powershell.exe',['-NoProfile','-File',path.join(root,'test/native-quote.ps1'),'-EvidenceDirectory',evidence],{cwd:consumer,encoding:'utf8',timeout:120000}));
    process.stdout.write(execFileSync(process.execPath,[path.join(tests,'native-quote.mjs'),'compare',evidence],{cwd:consumer,encoding:'utf8'}));
    nativeEvidence={report:path.relative(root,path.join(evidence,'comparison.json')).split(path.sep).join('/'),sha256:hash(await readFile(path.join(evidence,'comparison.json')))};
    const codeSource=await readFile(path.join(root,'test/native-code.mjs'),'utf8');
    const codeHarness=codeSource.replaceAll("'../dist/index.js'","'@openpresentation/opf-pptx'")
      .replaceAll("'vendor/pptxgenjs/pptxgen.es.js'","'node_modules/@openpresentation/opf-pptx/vendor/pptxgenjs/pptxgen.es.js'");
    await writeFile(path.join(tests,'native-code.mjs'),codeHarness);
    await writeFile(path.join(tests,'native-code.ps1'),await readFile(path.join(root,'test/native-code.ps1')));
    const codeEvidence=path.join(root,`artifacts/native-code-packed-node${process.versions.node.split('.')[0]}`);
    process.stdout.write(execFileSync(process.execPath,[path.join(tests,'native-code.mjs'),'generate',codeEvidence],{cwd:consumer,encoding:'utf8'}));
    process.stdout.write(execFileSync('powershell.exe',['-NoProfile','-File',path.join(tests,'native-code.ps1'),'-EvidenceDirectory',codeEvidence],{cwd:consumer,encoding:'utf8',timeout:120000}));
    process.stdout.write(execFileSync(process.execPath,[path.join(tests,'native-code.mjs'),'compare',codeEvidence],{cwd:consumer,encoding:'utf8'}));
    nativeCodeEvidence={report:path.relative(root,path.join(codeEvidence,'comparison.json')).split(path.sep).join('/'),sha256:hash(await readFile(path.join(codeEvidence,'comparison.json'))),sourceHarnessSha256:hash(codeSource),installedHarnessSha256:hash(codeHarness)};
  }
  await mkdir(path.join(root,'artifacts'),{recursive:true});
  await writeFile(path.join(root,`artifacts/packed-consumer-node${process.versions.node.split('.')[0]}.json`),JSON.stringify({node:process.version,name:manifest.name,version:manifest.version,integrity:packed.integrity,files,dependencies,registryFixtures,knownVulnerabilities:0,signatureVerification:signatures.trim(),nativeEvidence,nativeCodeEvidence,boundary:'Fresh installed candidate, every shipped file byte-matched, actual registry predecessors, optional-renderer absence, shared accepted quote/code/timeline geometry, media current-caption/link re-export and layout intent, physical font variants, guarded code/timeline provenance, indexed sparse chart-cache import, explicit UTC ZIP-date determinism and native notes/property whitespace, current untagged body rich-text import and native rich-run underline tested (linked social furniture excluded only from the historical registry fixture). Native evidence, when present, covers twelve controlled Calibri quote and eight Courier New code cases, including source/metadata edits and save/reopen; raster differences are observations without an equivalence threshold.'},null,2)+'\n');
  console.log(`Packed installation audit: zero known vulnerabilities; ${packed.filename}, ${packed.integrity}`);
  }
} finally {
  const actual=await realpath(temporary);assert.equal(actual,actualTemporary);
  assert.ok(actual.startsWith(temporaryParent+path.sep)&&path.basename(actual).startsWith('opf-pptx-packed-'));
  await rm(actual, { recursive: true, force: true });
}
