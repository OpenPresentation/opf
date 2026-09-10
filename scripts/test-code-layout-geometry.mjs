// Current checkout core API + installed registry renderer/fonts. No source-package alias.
import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {layoutCode,OPFCompositionError} from '../packages/javascript/dist/composition.js';

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
const fixtureBytes=await readFile('docs/evidence/code-layout-gap-2026-09-09.opf.json');
const fixture=JSON.parse(fixtureBytes);
const results=[];
for (const dimensions of [{width:1280,height:720},{width:540,height:960}]) {
  for (const scenario of ['long-language','whitespace-filename','tabs','irreducible']) {
    const overflowing=scenario==='irreducible';
    const code=scenario==='long-language'?fixture.slides[0].code:scenario==='whitespace-filename'?fixture.slides[1].code:
      scenario==='tabs'?{source:'\tconst value = "two  spaces";\r\n\t\treturn value;\n',language:'JavaScript',filename:'src/CaseSensitive.js'}:
      {source:'Every source character remains.',language:'ts',filename:'long-file-path/'.repeat(1000)};
    const deck={...fixture,design:{...fixture.design,dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96}},slides:[{code}]};
    assert.ok(validatePresentation(deck).valid,'Probe inputs must use actual schema-valid dimensions');
    const bound=resolvePresentation(deck,{textMeasurement:registry.textMeasurement}).slides[0];
    assert.deepEqual(bound.design.dimensions,dimensions);
    const options={fonts:bound.design.fonts,textMeasurement:registry.textMeasurement,path:'slides.0.code',minFontSize:24,scale:Math.min(dimensions.width,dimensions.height)/720};
    const layout=layoutCode(code,bound.geometry.items[0].box,options);
    assert.equal(layout.overflow,overflowing);
    assert.equal(layout.parts.at(-1).text,code.source);
    for (const field of ['language','filename']) if (code[field]) assert.equal(layout.parts.find(part=>part.role===field).text,code[field]);
    assert.equal(layout.textMeasurement,'provided');
    for (const part of layout.parts) if (part.fit) {
      assert.ok(part.fit.fontSize>=part.minFontSize);
      assert.equal(part.fit.sourceLines.map(line=>part.text.slice(line.start,line.nextStart)).join(''),part.text);
      assert.deepEqual(part.fit.lines,part.fit.sourceLines.map(line=>part.text.slice(line.start,line.end)));
      for (const line of part.fit.sourceLines) {
        assert.equal(line.segments.map(segment=>part.text.slice(segment.start,segment.end)).join(''),part.text.slice(line.start,line.end));
        assert.ok(Math.abs(line.segments.reduce((sum,segment)=>sum+segment.width,0)-line.width)<1e-8);
      }
      if (!overflowing) assert.ok(part.fit.sourceLines.every(line=>line.width<=part.box.width+.01));
    }
    if (scenario==='long-language') assert.ok(layout.parts[0].fit.lines.length>1);
    if (overflowing) {
      assert.ok(layout.diagnostics.some(item=>item.reason==='part-outside-cell'&&item.parts[0]==='filename'));
      assert.throws(()=>layoutCode(code,bound.geometry.items[0].box,{...options,overflow:'error'}),OPFCompositionError);
    }
    results.push({dimensions,scenario,overflowing,algorithm:layout.algorithm,textMeasurement:layout.textMeasurement,diagnostics:layout.diagnostics,
      parts:layout.parts.map(part=>({role:part.role,path:part.path,textSha256:hash(part.text),sourceLength:part.text.length,
        ...(part.text.length<128?{text:part.text}:{}),sources:part.sources,generated:part.generated,box:part.box,
        requestedFontSize:part.requestedFontSize,minFontSize:part.minFontSize,requestedStyle:part.requestedStyle,style:part.style,
        fit:part.fit?{fontSize:part.fit.fontSize,lineHeight:part.fit.lineHeight,lineCount:part.fit.lines.length,
          maximumLineWidth:Math.max(...part.fit.sourceLines.map(line=>line.width)),tabSize:part.fit.tabSize,tabWidth:part.fit.tabWidth,
          tabSegments:part.fit.sourceLines.flatMap(line=>line.segments).filter(segment=>segment.kind==='tab').length,
          sourceReconstructedExactly:true,overflow:part.fit.overflow}:null}))});
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
for (const file of ['packages/javascript/src/composition.ts','packages/javascript/src/index.ts','scripts/test-code-layout-geometry.mjs']) sourceHashes.push({file,sha256:hash(await readFile(file))});
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
const report={scope:'Current checkout code-flow-v1 core API with the release-plan registry renderer used only to supply existing outer boxes and open-font advances. Exact text/line boundaries, measured tabs, filename/language and a 24-reference-pixel floor are checked. This source probe is separate from installed-registry code workflows and does not verify composition selection, renderer/converter integration, browser glyph bounds or native raster equivalence.',
  fixtureSha256:hash(fixtureBytes),sourceHashes,runtimeHashes,fontHashes,packages:[...checked.values()].map(({manifest,integrity})=>({name:manifest.name,version:manifest.version,integrity})),results};
if (output) await writeFile(output,`${JSON.stringify(report,null,2)}\n`);
console.log(`Verified ${results.length} wide/portrait code layouts with exact installed font measurements.`);
