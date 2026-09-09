// Candidate core API + actual installed registry renderer/fonts. No source-package alias.
import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {layoutQuote,OPFCompositionError} from '../packages/javascript/dist/composition.js';

assert.ok(!process.env.NODE_OPTIONS && !process.execArgv.some(value=>/^(--import|--loader|--experimental-loader|--require|-r)(=|$)/.test(value)),
  'Run without preload/loader arguments or NODE_OPTIONS.');
const consumer=path.resolve(process.argv[2]??'artifacts/npm/registry-consumer');
const output=process.argv[3];
const modules=await realpath(path.join(consumer,'node_modules'));
const lock=JSON.parse(await readFile(path.join(consumer,'package-lock.json'),'utf8'));
const plan=JSON.parse(await readFile('release-plan.json','utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const checked=new Map();
async function packageManifest(name) {
  if (checked.has(name)) return checked.get(name);
  const directory=await realpath(path.join(modules,name));
  assert.ok(directory.startsWith(modules+path.sep),`No source link for ${name}`);
  const manifest=JSON.parse(await readFile(path.join(directory,'package.json'),'utf8'));
  const entry=lock.packages[`node_modules/${name}`];
  assert.ok(manifest.name===name&&entry?.version===manifest.version&&!entry.link&&entry.resolved?.startsWith('https://registry.npmjs.org/')&&entry.integrity?.startsWith('sha512-'));
  const result={directory,manifest,integrity:entry.integrity};
  checked.set(name,result);
  return result;
}
async function load(name,entrypoint) {
  const {directory,manifest}=await packageManifest(name);
  const entry=manifest.exports[entrypoint];
  return import(pathToFileURL(path.resolve(directory,typeof entry==='string'?entry:entry.import??entry.default)).href);
}
for (const name of ['@openpresentation/opf','@openpresentation/opf-render']) {
  assert.equal((await packageManifest(name)).manifest.version,plan.packages.find(item=>item.name===name)?.version);
}
const {resolvePresentation}=await load('@openpresentation/opf-render','./svg');
const {validatePresentation}=await load('@openpresentation/opf','.');
const {loadOfficeFontRegistry}=await load('@openpresentation/opf-render','./fonts-node');
const registry=await loadOfficeFontRegistry();
const fixtureBytes=await readFile('docs/evidence/payload-fit-gaps-2026-09-09.opf.json');
const fixture=JSON.parse(fixtureBytes);
const results=[];
for (const dimensions of [{width:1280,height:720},{width:540,height:960}]) {
  for (const overflowing of [false,true]) {
    const quote={...fixture.slides[0].quote,...(overflowing?{}:{attribution:'Preserved author',source:'Preserved source'})};
    const deck={...fixture,design:{...fixture.design,dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96}},slides:[{quote}]};
    assert.ok(validatePresentation(deck).valid,'Probe inputs must use actual schema-valid dimensions');
    const bound=resolvePresentation(deck,{textMeasurement:registry.textMeasurement}).slides[0];
    assert.deepEqual(bound.design.dimensions,dimensions);
    const options={fonts:bound.design.fonts,textMeasurement:registry.textMeasurement,path:'slides.0.quote',scale:Math.min(dimensions.width,dimensions.height)/720};
    const layout=layoutQuote(quote,bound.geometry.items[0].box,options);
    assert.equal(layout.overflow,overflowing);
    assert.equal(layout.parts[1].text,quote.attribution+(quote.source?` - ${quote.source}`:''));
    assert.equal(layout.textMeasurement,'provided');
    assert.ok(layout.parts.every(part=>part.fit.fontSize>=part.minFontSize));
    if (overflowing) {
      assert.ok(layout.diagnostics.some(item=>item.reason==='text-fit'&&item.parts[0]==='footer'));
      assert.throws(()=>layoutQuote(quote,bound.geometry.items[0].box,{...options,overflow:'error'}),OPFCompositionError);
    }
    results.push({dimensions,overflowing,layout});
  }
}
const fontHashes=[];
for (const file of registry.fontFiles) {
  const actual=await realpath(file);
  assert.ok(actual.startsWith(modules+path.sep),'Font bytes must come from installed packages');
  const relative=path.relative(modules,actual).split(path.sep).join('/');
  const segments=relative.split('/');
  await packageManifest(segments.slice(0,relative.startsWith('@')?2:1).join('/'));
  fontHashes.push({file:relative,sha256:hash(await readFile(actual))});
}
const sourceHashes=[];
for (const file of ['packages/javascript/src/composition.ts','packages/javascript/src/index.ts']) sourceHashes.push({file,sha256:hash(await readFile(file))});
const runtimeHashes=[],runtimeFiles=new Set(),dist=path.resolve('packages/javascript/dist');
async function fingerprint(file) {
  if (runtimeFiles.has(file)) return;
  assert.ok(file.startsWith(dist+path.sep),'Candidate runtime dependencies must remain inside dist');
  runtimeFiles.add(file);
  const bytes=await readFile(file);
  runtimeHashes.push({file:path.relative(process.cwd(),file).split(path.sep).join('/'),sha256:hash(bytes)});
  // tsup emits relative static import/export specifiers. Include every referenced chunk.
  for (const [,specifier] of bytes.toString('utf8').matchAll(/\b(?:from|import)\s*['"](\.\/[^'"]+\.js)['"]/g)) {
    await fingerprint(path.resolve(path.dirname(file),specifier));
  }
}
await fingerprint(path.join(dist,'composition.js'));
const report={scope:'Unreleased standalone core source API with the release-plan registry renderer and open-font advances. Existing composition/render/export are unchanged; no browser glyph or native raster equivalence claim.',
  fixtureSha256:hash(fixtureBytes),sourceHashes,runtimeHashes,fontHashes,packages:[...checked.values()].map(({manifest,integrity})=>({name:manifest.name,version:manifest.version,integrity})),results};
if (output) await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(`Verified ${results.length} wide/portrait quote layouts with exact installed font measurements.`);
