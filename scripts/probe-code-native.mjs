// Controlled Windows PowerPoint tab feasibility and published-import observation.
// node scripts/probe-code-native.mjs generate|compare <registry-consumer> <evidence-directory>
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {layoutCode} from '../packages/javascript/dist/composition.js';

assert.ok(!process.env.NODE_OPTIONS&&!process.execArgv.some(value=>/^(--import|--loader|--experimental-loader|--require|-r)(=|$)/.test(value)),'Do not alias the registry consumer to candidate sources.');
const [mode,consumer,directory]=process.argv.slice(2);
assert.ok(['generate','compare'].includes(mode)&&consumer&&directory,'Provide mode, actual registry consumer and evidence directory.');
const output=path.resolve(directory),modules=await realpath(path.join(consumer,'node_modules'));
const lock=JSON.parse(await readFile(path.join(consumer,'package-lock.json'),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async file=>JSON.parse((await readFile(path.join(output,file),'utf8')).replace(/^\uFEFF/,''));
const write=(file,value)=>writeFile(path.join(output,file),JSON.stringify(value,null,2)+'\n');
const packages=[],runtimeHashes=[],seen=new Set();
async function fingerprint(file,base) {
  if (seen.has(file)) return;seen.add(file);
  assert.ok(file.startsWith(base+path.sep),'Runtime imports must remain inside their verified package.');
  const bytes=await readFile(file);
  runtimeHashes.push({file:path.relative(process.cwd(),file).split(path.sep).join('/'),sha256:hash(bytes)});
  for (const [,specifier] of bytes.toString().matchAll(/\b(?:from|import)\s*['"](\.[^'"]+\.js)['"]/g)) await fingerprint(path.resolve(path.dirname(file),specifier),base);
}
async function installed(name) {
  const root=await realpath(path.join(modules,name));assert.ok(root.startsWith(modules+path.sep),'No source package links.');
  const manifest=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')),entry=lock.packages['node_modules/'+name];
  assert.ok(entry?.version===manifest.version&&!entry.link&&entry.resolved?.startsWith('https://registry.npmjs.org/')&&entry.integrity?.startsWith('sha512-'));
  packages.push({name,version:manifest.version,integrity:entry.integrity});
  return root;
}
const renderer=await installed('@openpresentation/opf-render'),converter=await installed('@openpresentation/opf-pptx'),core=await installed('@openpresentation/opf');
await installed('jszip');await installed('fontkit');
const {createFontRegistry}=await import(pathToFileURL(path.join(renderer,'dist/fonts.js')));
const {fromPptx}=await import(pathToFileURL(path.join(converter,'dist/index.js')));
const {validatePresentation}=await import(pathToFileURL(path.join(core,'dist/validator.js')));
const {default:PptxGenJS}=await import(pathToFileURL(path.join(converter,'vendor/pptxgenjs/pptxgen.es.js')));
await mkdir(output,{recursive:true});
if (mode==='generate') {
  assert.equal(process.platform,'win32','Generation requires the local Windows Courier New reference files.');
  const fontHashes=[],faces=[];
  for (const [file,weight] of [['cour.ttf',400],['courbd.ttf',700]]) {
    const data=await readFile(path.join(process.env.WINDIR??'C:/Windows','Fonts',file));
    faces.push({data,family:'Courier New',weight,italic:false});fontHashes.push({file,weight,sha256:hash(data)});
  }
  const registry=createFontRegistry(faces,{substitutionPolicy:'none'}),pptx=new PptxGenJS(),cases=[];
  pptx.layout='LAYOUT_WIDE';pptx.author='OpenPresentation native code compatibility probe';
  for (const source of ['a\tb','aaaa\tb','\tconst value = "two  spaces";','  indentation  ','a\t','\t\t',' \t \tkeep  ','src\tCaseSensitive.ts']) {
    const role=source.startsWith('src')?'filename':'body';
    const part=layoutCode(role==='filename'?{source:'body',filename:source}:source,{x:0,y:0,width:1000,height:500},{fonts:{code:'Courier New'},textMeasurement:registry.textMeasurement}).parts.find(part=>part.role===role);
    assert.ok(part?.fit&&!part.fit.overflow);assert.equal(part.fit.lines.length,1);
    const line=part.fit.sourceLines[0],tabStops=line.segments.filter(segment=>segment.kind==='tab').map(segment=>({position:(segment.x+segment.width)/96,alignment:'l'}));
    pptx.addSlide().addText(source,{x:1,y:1,w:10,h:.8,margin:0,fontFace:part.style.fontFamily,fontSize:part.fit.fontSize*.75,bold:part.style.fontWeight>=600,align:'left',valign:'top',breakLine:false,paraSpaceAfter:0,fit:'none',wrap:false,tabStops,objectName:'code-probe'});
    cases.push({source,role,fontSize:part.fit.fontSize,style:part.style,line,tabStops});
  }
  const bytes=await pptx.write({outputType:'nodebuffer'});await writeFile(path.join(output,'tabs.pptx'),bytes);
  for (const root of [renderer,converter,core]) await fingerprint(path.join(root,'dist',root===renderer?'fonts.js':root===core?'validator.js':'index.js'),root);
  await fingerprint(path.join(converter,'vendor/pptxgenjs/pptxgen.es.js'),converter);
  await fingerprint(path.resolve('packages/javascript/dist/composition.js'),path.resolve('packages/javascript/dist'));
  const sourceHashes=[];
  for (const file of ['scripts/probe-code-native.mjs','scripts/probe-code-native.ps1','packages/javascript/src/composition.ts']) sourceHashes.push({file,sha256:hash(await readFile(file))});
  await write('generation.json',{node:process.version,fontHashes,packages,sourceHashes,runtimeHashes,pptxSha256:hash(bytes),cases,
    scope:'Controlled native tab-stop feasibility using the candidate core layoutCode API, local Courier New and the registry converter\'s vendored PptxGenJS. This is not integrated OPF export, substitute-font equivalence, glyph-bound equivalence or a raster comparison. No proprietary font bytes are copied or embedded.'});
  console.log(`Generated ${cases.length} source-preserving native tab cases.`);
} else {
  const generation=await json('generation.json'),native=await json('native.json');
  assert.deepEqual(packages,generation.packages);
  for (const item of [...generation.sourceHashes,...generation.runtimeHashes]) assert.equal(hash(await readFile(item.file)),item.sha256,`Stale native input: ${item.file}`);
  assert.equal(hash(await readFile(path.join(output,'tabs.pptx'))),generation.pptxSha256);
  assert.equal(native.generationSha256,hash(await readFile(path.join(output,'generation.json'))));
  assert.equal(native.reports.length,generation.cases.length);
  const imports=[];
  for (const file of ['tabs.pptx','tabs-saved.pptx','tabs-edited.pptx']) {
    const bytes=await readFile(path.join(output,file));
    if (file!=='tabs.pptx') assert.equal(hash(bytes),native[file==='tabs-saved.pptx'?'savedSha256':'editedSha256']);
    const presentation=await fromPptx(bytes);assert.ok(validatePresentation(presentation).valid);
    const observed=presentation.slides.map((slide,index)=>({expected:generation.cases[index].source+(file==='tabs-edited.pptx'?' edited':''),actual:slide.blocks?.map(block=>typeof block.text==='string'?block.text:JSON.stringify(block.text)).join('\n')}));
    imports.push({file,sha256:hash(bytes),schemaValid:true,exactText:observed.every(item=>item.expected===item.actual),observed});
  }
  let maximumTabTargetErrorPoints=0,maximumTextWidthDifferencePoints=0;
  for (const [index,report] of native.reports.entries()) {
    const expected=generation.cases[index];
    assert.equal(report.text,expected.source);assert.equal(native.reopenedText[index],expected.source);assert.equal(native.editedText[index],expected.source+' edited');
    assert.ok(Math.abs(report.fontSize-expected.fontSize*.75)<=.01);assert.equal(report.font,expected.style.fontFamily);
    for (const [i,segment] of report.segments.entries()) {
      const model=expected.line.segments[i];assert.ok(model);assert.equal(segment.kind,model.kind);
      assert.equal(segment.text,expected.source.slice(model.start,model.end));
      assert.ok(Math.abs(segment.expectedX-model.x*.75)<1e-8&&Math.abs(segment.expectedWidth-model.width*.75)<1e-8);
      if (i>0&&report.segments[i-1].kind==='tab') maximumTabTargetErrorPoints=Math.max(maximumTabTargetErrorPoints,Math.abs(segment.left-segment.expectedX));
      if (segment.kind==='text') maximumTextWidthDifferencePoints=Math.max(maximumTextWidthDifferencePoints,Math.abs(segment.width-segment.expectedWidth));
    }
  }
  assert.ok(maximumTabTargetErrorPoints<=.02,'Native text after each tab must begin at the accepted stop within 0.02 point.');
  await write('comparison.json',{generationSha256:hash(await readFile(path.join(output,'generation.json'))),nativeSha256:hash(await readFile(path.join(output,'native.json'))),
    nativeTextPreserved:true,editsReopened:generation.cases.length,maximumTabTargetErrorPoints,tabTargetTolerancePoints:.02,maximumTextWidthDifferencePoints,imports,
    scope:'Native text/whitespace and edits survive save/reopen, and text after tabs begins at accepted stops within the stated tolerance. Text-width differences and published reimport loss are observations, not success gates or pixel-equivalence claims. OPF code semantics, multi-line source reconstruction and integrated preview/export remain unverified.'});
  console.log(`Verified ${generation.cases.length} native text/edit cases; maximum tab-target error ${maximumTabTargetErrorPoints.toFixed(5)}pt. Exact imports: ${imports.filter(item=>item.exactText).length}/${imports.length}.`);
}
