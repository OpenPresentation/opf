import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile, readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run through npm run test:packed for portable npm execution.');
const native=process.argv.includes('--native');
assert.ok(!native||process.platform==='win32','--native requires Windows with Microsoft PowerPoint installed.');
const temporary = await mkdtemp(path.join(tmpdir(), 'opf-pptx-packed-'));
const actualTemporary=await realpath(temporary),temporaryParent=await realpath(tmpdir());
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const npm = (args, cwd) => execFileSync(process.execPath, [npmCli, ...args], { cwd, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 });
try {
  const packed = JSON.parse(npm(['pack', '--json', '--pack-destination', temporary], root))[0];
  const shipped = new Set(packed.files.map(file => file.path));
  for (const name of ['pptxgen.es.js', 'LICENSE', 'UPSTREAM.json', 'package.json']) {
    assert.ok(shipped.has(`vendor/pptxgenjs/${name}`), `Missing shipped vendor file: ${name}`);
  }
  const consumer = path.join(temporary, 'consumer');
  await mkdir(consumer);
  await writeFile(path.join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  npm(['install', '--ignore-scripts', '--no-fund', '--no-audit', path.join(temporary, packed.filename)], consumer);
  const installed=path.join(consumer,'node_modules/@openpresentation/opf-pptx'),files={};
  for(const {path:file} of packed.files){
    assert.ok(!path.isAbsolute(file)&&!file.split(/[/\\]/).includes('..'));
    const bytes=await readFile(path.join(installed,file));
    assert.equal(hash(bytes),hash(await readFile(path.join(root,file))),`Installed file differs: ${file}`);files[file]=hash(bytes);
  }
  const audit = JSON.parse(npm(['audit', '--json'], consumer));
  assert.equal(audit.metadata.vulnerabilities.total, 0);
  await writeFile(path.join(consumer, 'verify.mjs'), `
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {toPptx,fromPptx} from '@openpresentation/opf-pptx';
import {validatePresentation} from '@openpresentation/opf';
const require = createRequire(import.meta.url);
for(const name of ['image-size','pptxgenjs','@openpresentation/opf-render']) assert.throws(()=>require.resolve(name),{code:'MODULE_NOT_FOUND'});
const pkg = new URL('./', import.meta.resolve('@openpresentation/opf-pptx/package.json'));
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
assert.equal(validatePresentation(restored).valid,true);
assert.ok(JSON.stringify(restored).includes('Quality'));
for(const text of ['42%','Reviewer - Interview','approve(change)','Pilot','Rollout']) assert.ok(JSON.stringify(restored).includes(text), 'Installed payload text: '+text);
console.log('Packed consumer: vendored licenses/hashes, absent unused dependencies, table/metric/quote/code/timeline export/reimport and schema validation pass.');
`);
  process.stdout.write(execFileSync(process.execPath, ['verify.mjs'], { cwd: consumer, encoding: 'utf8' }));
  // The basic consumer above also proves the optional renderer can be absent.
  // Add its exact published fixture version for accepted-layout and native checks.
  const manifest=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
  npm(['install','--ignore-scripts','--no-fund','--no-audit',`@openpresentation/opf-render@${manifest.devDependencies['@openpresentation/opf-render']}`],consumer);
  const lock=JSON.parse(await readFile(path.join(consumer,'package-lock.json'),'utf8')),dependencies={};
  for(const name of ['@openpresentation/opf','@openpresentation/opf-render']){
    const entry=lock.packages['node_modules/'+name];
    assert.ok(entry.resolved.startsWith('https://registry.npmjs.org/')&&!entry.link);
    assert.ok((await realpath(path.join(consumer,'node_modules',name))).startsWith((await realpath(path.join(consumer,'node_modules')))+path.sep));
    dependencies[name]={version:entry.version,resolved:entry.resolved,integrity:entry.integrity};
  }
  const shared=(await readFile(path.join(root,'test/shared-quote.mjs'),'utf8')).replaceAll("'../dist/index.js'","'@openpresentation/opf-pptx'");
  await writeFile(path.join(consumer,'shared-quote.mjs'),shared);
  process.stdout.write(execFileSync(process.execPath,['shared-quote.mjs'],{cwd:consumer,encoding:'utf8'}));
  const withRendererAudit=JSON.parse(npm(['audit','--json'],consumer));assert.equal(withRendererAudit.metadata.vulnerabilities.total,0);
  const signatures=npm(['audit','signatures'],consumer);process.stdout.write(signatures);
  let nativeEvidence;
  if(native){
    const tests=path.join(consumer,'test');await mkdir(tests);
    await writeFile(path.join(tests,'native-quote.mjs'),await readFile(path.join(root,'test/native-quote.mjs')));
    const evidence=path.join(root,`artifacts/native-quote-packed-node${process.versions.node.split('.')[0]}`);
    process.stdout.write(execFileSync(process.execPath,[path.join(tests,'native-quote.mjs'),'generate',evidence],{cwd:consumer,encoding:'utf8'}));
    process.stdout.write(execFileSync('powershell.exe',['-NoProfile','-File',path.join(root,'test/native-quote.ps1'),'-EvidenceDirectory',evidence],{cwd:consumer,encoding:'utf8',timeout:120000}));
    process.stdout.write(execFileSync(process.execPath,[path.join(tests,'native-quote.mjs'),'compare',evidence],{cwd:consumer,encoding:'utf8'}));
    nativeEvidence={report:path.relative(root,path.join(evidence,'comparison.json')).split(path.sep).join('/'),sha256:hash(await readFile(path.join(evidence,'comparison.json')))};
  }
  await mkdir(path.join(root,'artifacts'),{recursive:true});
  await writeFile(path.join(root,`artifacts/packed-consumer-node${process.versions.node.split('.')[0]}.json`),JSON.stringify({node:process.version,name:manifest.name,version:manifest.version,integrity:packed.integrity,files,dependencies,knownVulnerabilities:0,signatureVerification:signatures.trim(),nativeEvidence,boundary:'Fresh installed candidate, every shipped file byte-matched, actual registry predecessors, optional-renderer absence and shared accepted geometry tested. Native evidence, when present, covers twelve controlled Calibri cases and reports raster differences without an equivalence threshold.'},null,2)+'\n');
  console.log(`Packed installation audit: zero known vulnerabilities; ${packed.filename}, ${packed.integrity}`);
} finally {
  const actual=await realpath(temporary);assert.equal(actual,actualTemporary);
  assert.ok(actual.startsWith(temporaryParent+path.sep)&&path.basename(actual).startsWith('opf-pptx-packed-'));
  await rm(actual, { recursive: true, force: true });
}
