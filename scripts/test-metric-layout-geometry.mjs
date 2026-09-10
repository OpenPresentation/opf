// Current checkout metric API; registry renderer supplies only outer cells and font advances.
// node scripts/test-metric-layout-geometry.mjs <registry-consumer> [report.json]
import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {layoutMetric,OPFCompositionError} from '../packages/javascript/dist/composition.js';
import {metricLayoutFixtures} from './metric-layout-fixtures.mjs';

assert.ok(!process.env.NODE_OPTIONS&&!process.execArgv.some(x=>/^(--import|--loader|--experimental-loader|--require|-r)(=|$)/.test(x)), 'Run without source aliases or preload/loader arguments.');
const consumer=path.resolve(process.argv[2]??'artifacts/npm/registry-consumer'),output=process.argv[3];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const modules=await realpath(path.join(consumer,'node_modules'));
const lock=JSON.parse(await readFile(path.join(consumer,'package-lock.json'),'utf8'));
const plan=JSON.parse(await readFile('release-plan.json','utf8'));
const baselineBytes=await readFile('docs/evidence/shared-code-complete/registry-code-node24.json');
const baseline=JSON.parse(baselineBytes),packages=[];
async function load(name,entrypoint) {
  const dir=await realpath(path.join(modules,name));
  assert.ok(dir.startsWith(modules+path.sep),`No source link for ${name}`);
  const manifest=JSON.parse(await readFile(path.join(dir,'package.json'),'utf8'));
  if (!packages.some(p=>p.name===name)) {
    const entry=lock.packages['node_modules/'+name],expected=baseline.packages.find(p=>p.name===name);
    assert.equal(manifest.version,plan.packages.find(p=>p.name===name).version);
    assert.equal(entry.version,manifest.version);assert.ok(!entry.link&&entry.resolved.startsWith('https://registry.npmjs.org/'));
    assert.equal(entry.integrity,expected.integrity);
    for (const [file,digest] of Object.entries(expected.files)) {
      const actual=await realpath(path.join(dir,file));assert.ok(actual.startsWith(dir+path.sep));
      assert.equal(hash(await readFile(actual)),digest,`${name}/${file} must match its verified registry archive`);
    }
    packages.push({name,version:manifest.version,integrity:entry.integrity,verifiedFiles:Object.keys(expected.files).length});
  }
  const entry=manifest.exports[entrypoint];
  return import(pathToFileURL(path.resolve(dir,typeof entry==='string'?entry:entry.import??entry.default)).href);
}
const {resolvePresentation}=await load('@openpresentation/opf-render','./svg');
const {validatePresentation}=await load('@openpresentation/opf','.');
const {loadOfficeFontRegistry}=await load('@openpresentation/opf-render','./fonts-node');
const registry=await loadOfficeFontRegistry(),results=[];
for (const fixture of metricLayoutFixtures()) {
  const {id,family,dimensions,document,metric,minFontSize,overflow}=fixture,before=JSON.stringify(document);
  assert.equal(validatePresentation(document).valid,true);
  const bound=resolvePresentation(document,{textMeasurement:registry.textMeasurement}).slides[0];
  assert.deepEqual(bound.design.dimensions,dimensions);
  const box=bound.geometry.items[0].box,scale=Math.min(dimensions.width,dimensions.height)/720;
  const options={fonts:bound.design.fonts,textMeasurement:registry.textMeasurement,path:'slides.0.metric',minFontSize,scale};
  if (fixture.missingGlyph) {
    let error;
    assert.throws(()=>layoutMetric(metric,box,options),actual=>{
      assert.equal(actual.code,'missing-glyph');assert.equal(actual.details.character,fixture.missingGlyph);
      assert.equal(actual.details.path,'slides.0.metric.label');assert.equal(actual.details.fontFamily,family);
      error={code:actual.code,details:actual.details};return true;
    });
    assert.equal(JSON.stringify(document),before);
    results.push({id,family,dimensions,box,scale,minFontSize,error,sourceUnchanged:true});
    continue;
  }
  const layout=layoutMetric(metric,box,options);
  assert.equal(layout.overflow,overflow,`${family}/${dimensions.width}/${id}`);
  assert.deepEqual(layoutMetric(metric,box,options),layout,'Repeated inputs must produce identical allocations');
  assert.equal(JSON.stringify(document),before);assert.equal(layout.textMeasurement,'provided');
  assert.ok(layout.attempts>=1&&layout.attempts<=48);
  for (const part of layout.parts) {
    assert.equal(part.text,String(part.sources[0].value));assert.ok(part.requestedFontSize>=minFontSize*scale);
    if (part.fit) {
      assert.ok(part.fit.fontSize>=part.minFontSize);
      assert.equal(part.fit.sourceLines.map(line=>part.text.slice(line.start,line.nextStart)).join(''),part.text);
      assert.deepEqual(part.fit.lines,part.fit.sourceLines.map(line=>part.text.slice(line.start,line.end)));
      for (const line of part.fit.sourceLines) {
        assert.equal(line.segments.map(s=>part.text.slice(s.start,s.end)).join(''),part.text.slice(line.start,line.end));
        assert.ok(Math.abs(line.segments.reduce((sum,s)=>sum+s.width,0)-line.width)<1e-8);
        if (!overflow) assert.ok(line.width<=part.box.width+.01);
      }
    }
    if (!overflow&&part.visible) for (const [start,size] of [['x','width'],['y','height']]) {
      assert.ok(part.box[start]>=box[start]-.01&&part.box[start]+part.box[size]<=box[start]+box[size]+.01);
    }
  }
  if (id==='all-metadata') {assert.equal(layout.arrangement,'inline-unit');assert.equal(layout.parts.find(p=>p.role==='delta').text,'0');}
  if (id==='long-unit'||id==='literal-whitespace') assert.equal(layout.arrangement,'stacked');
  if (overflow) assert.throws(()=>layoutMetric(metric,box,{...options,overflow:'error'}),error=>{
    assert.ok(error instanceof OPFCompositionError);assert.deepEqual(error.diagnostics,layout.diagnostics);return true;
  });
  results.push({id,family,dimensions,box,scale,minFontSize,overflow,algorithm:layout.algorithm,arrangement:layout.arrangement,attempts:layout.attempts,
    diagnostics:layout.diagnostics,parts:layout.parts.map(part=>({role:part.role,path:part.path,visible:part.visible,textSha256:hash(part.text),sourceLength:part.text.length,
      sourceType:typeof part.sources[0].value,box:part.box,requestedFontSize:part.requestedFontSize,minFontSize:part.minFontSize,requestedStyle:part.requestedStyle,style:part.style,
      fit:part.fit?{fontSize:part.fit.fontSize,lineHeight:part.fit.lineHeight,lineCount:part.fit.lines.length,
        maximumLineWidth:Math.max(0,...part.fit.sourceLines.map(line=>line.width)),sourceReconstructedExactly:true,overflow:part.fit.overflow}:null}))});
}
const fontHashes=[];
for (const file of registry.fontFiles) {
  const actual=await realpath(file);assert.ok(actual.startsWith(modules+path.sep));
  const relative=path.relative(modules,actual).split(path.sep).join('/'),name=relative.split('/').slice(0,2).join('/'),entry=lock.packages['node_modules/'+name];
  assert.ok(!entry.link&&entry.resolved.startsWith('https://registry.npmjs.org/')&&entry.integrity.startsWith('sha512-'));
  fontHashes.push({file:relative,sha256:hash(await readFile(actual)),packageIntegrity:entry.integrity});
}
const sourceHashes=[];
for (const file of ['packages/javascript/src/composition.ts','packages/javascript/src/index.ts','scripts/metric-layout-fixtures.mjs','scripts/test-metric-layout-geometry.mjs']) sourceHashes.push({file,sha256:hash(await readFile(file))});
const runtimeHashes=[],runtimeFiles=new Set(),dist=path.resolve('packages/javascript/dist');
async function fingerprint(file) {
  if (runtimeFiles.has(file)) return;
  assert.ok(file.startsWith(dist+path.sep));runtimeFiles.add(file);
  const bytes=await readFile(file);runtimeHashes.push({file:path.relative(process.cwd(),file).split(path.sep).join('/'),sha256:hash(bytes)});
  for (const [,specifier] of bytes.toString('utf8').matchAll(/\b(?:from|import)\s*['"](\.\/[^'"]+\.js)['"]/g)) await fingerprint(path.resolve(path.dirname(file),specifier));
}
await fingerprint(path.join(dist,'composition.js'));
const report={scope:'Standalone candidate metric-flow-v1 with exact registry font bytes. The published renderer supplies existing outer cells only; no composition/pagination, integrated SVG/editor or native PPTX improvement is claimed. Source preservation, deterministic geometry, requested/resolved styles, readability floors, conservative bounds and strict irreducible failure are verified, not glyph appearance or raster equivalence.',
  baselineSha256:hash(baselineBytes),sourceHashes,runtimeHashes,fontHashes,packages,results};
if (output) await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(`Verified ${results.length} standalone metric layouts across three font families and wide/portrait canvases.`);
