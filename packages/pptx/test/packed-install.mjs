import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run through npm run test:packed for portable npm execution.');
const temporary = await mkdtemp(path.join(tmpdir(), 'opf-pptx-packed-'));
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
for(const name of ['image-size','pptxgenjs']) assert.throws(()=>require.resolve(name),{code:'MODULE_NOT_FOUND'});
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
  console.log(`Packed installation audit: zero known vulnerabilities; ${packed.filename}, ${packed.integrity}`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
