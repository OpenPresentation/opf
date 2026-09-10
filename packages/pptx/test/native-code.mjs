// Actual OPF export -> Windows PowerPoint -> candidate import. Local reference
// fonts are measured but are never copied into the evidence or embedded in PPTX.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createFontRegistry} from '@openpresentation/opf-render/fonts';
import {renderSvgDeck,resolvePresentation,svgToPng} from '@openpresentation/opf-render';
import {validatePresentation} from '@openpresentation/opf';
import {toPptx,fromPptx} from '../dist/index.js';
const [mode,directory='artifacts/native-code']=process.argv.slice(2);
assert.ok(['generate','compare'].includes(mode));
const output=path.resolve(directory),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const write=(name,value)=>writeFile(path.join(output,name),JSON.stringify(value,null,2)+'\n');
const json=async name=>JSON.parse((await readFile(path.join(output,name),'utf8')).replace(/^\uFEFF/,''));
await mkdir(output,{recursive:true});
const runtime={};
for(const name of ['@openpresentation/opf','@openpresentation/opf-render','@openpresentation/opf-pptx']) {
  const root=path.dirname(fileURLToPath(import.meta.resolve(name+'/package.json'))),seen=new Set();
  const visit=async file=>{
    if(seen.has(file))return;seen.add(file);
    const bytes=await readFile(path.join(root,'dist',file));runtime[name+'/dist/'+file]=hash(bytes);
    for(const [,child] of bytes.toString().matchAll(/(?:from\s*|import\s*)['"](\.\/[^'"]+\.js)['"]/g))await visit(path.posix.join(path.posix.dirname(file),child));
  };
  const files=name==='@openpresentation/opf'?['composition.js','validator.js','catalogs.js']:(await readdir(path.join(root,'dist'))).filter(file=>file.endsWith('.js')).sort();
  for(const file of files)await visit(file);
  runtime[name+'/package.json']=hash(await readFile(path.join(root,'package.json')));
}
for(const file of ['test/native-code.mjs','test/native-code.ps1','vendor/pptxgenjs/pptxgen.es.js','package-lock.json'])runtime[file]=hash(await readFile(new URL('../'+file,import.meta.url)));
if(mode==='generate') {
  assert.equal(process.platform,'win32');
  const faces=[],fontHashes={},fontFiles=[];
  for(const [file,weight] of [['cour.ttf',400],['courbd.ttf',700]]) {
    const fontPath=path.join(process.env.WINDIR??'C:/Windows','Fonts',file);fontFiles.push(fontPath);
    const data=await readFile(fontPath);
    faces.push({data,family:'Courier New',weight,italic:false});fontHashes[file]=hash(data);
  }
  const fonts=createFontRegistry(faces,{substitutionPolicy:'none'}),decks=[];
  for(const dimensions of [{width:1280,height:720},{width:540,height:960}]) {
    const id='code-'+dimensions.width,values=['', '\t\t',
      {source:'  const value = "two  spaces";\r\n\r\n'+'longtoken'.repeat(22)+'\n\treturn value;  \r',filename:'src\tCaseSensitive.ts',language:'TypeScript'},
      {source:'',filename:'a-long-path/'.repeat(15),language:'Long-language-label-'.repeat(12)}];
    const family={family:'Courier New'};
    const document={design:{dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96},fontScheme:{id:'calibri',heading:family,body:family,code:family}},slides:values.map(code=>({composition:{minFontSize:24},code}))};
    const options={textMeasurement:fonts.textMeasurement},bound=resolvePresentation(document,options);
    for(const slide of bound.slides)assert.deepEqual(slide.geometry.diagnostics,[]);
    const pptx=await toPptx(document,options),svgs=renderSvgDeck(document,{...options,embeddedFonts:fonts.embeddedFonts});
    await writeFile(path.join(output,id+'.pptx'),pptx);
    const rasters=[];
    for(const [index,svg] of svgs.entries()) {
      const png=await svgToPng(svg,{fontFiles,useBundledFonts:false,loadSystemFonts:false});await writeFile(path.join(output,`${id}-svg-${index+1}.png`),png);
      rasters.push(hash(png));
    }
    decks.push({id,...dimensions,document,pptxSha256:hash(pptx),svgRasterSha256:rasters,layouts:bound.slides.map(slide=>({cell:slide.geometry.items[0].box,...slide.geometry.items[0].codeLayout}))});
  }
  await write('generation.json',{node:process.version,runtime,fontHashes,decks,scope:'Actual candidate OPF code export with local Courier New reference bytes. Separate SVG raster and native PowerPoint observations; no substitute-font or pixel-equivalence claim.'});
  console.log('Generated eight wide/portrait native code slides with accepted source geometry.');
} else {
  const generation=await json('generation.json'),native=await json('native.json');
  assert.deepEqual(runtime,generation.runtime,'Native evidence requires unchanged runtimes and verifiers');
  assert.equal(native.generationSha256,hash(await readFile(path.join(output,'generation.json'))));
  const imports=[];
  for(const deck of generation.decks)for(const state of ['original','saved','edited']) {
    const filename=deck.id+(state==='original'?'':`-${state}`)+'.pptx',bytes=await readFile(path.join(output,filename));
    const record=native.decks.find(item=>item.id===deck.id);
    assert.equal(hash(bytes),state==='original'?deck.pptxSha256:record[state+'Sha256']);
    const diagnostics=[],result=await fromPptx(bytes,{onDiagnostic:issue=>diagnostics.push(issue)});
    assert.equal(validatePresentation(result).valid,true);assert.equal(result.slides.length,deck.document.slides.length);
    for(const [index,slide] of result.slides.entries()) {
      let code=structuredClone(deck.document.slides[index].code);
      if(state==='edited') {
        if(typeof code==='string')code='NATIVE '+code;
        else {code.source='NATIVE '+code.source;if(code.filename)code.filename='Saved '+code.filename;}
      }
      assert.deepEqual(slide.blocks,[{type:'code',code}],filename+' slide '+(index+1));
    }
    assert.ok(diagnostics.every(issue=>issue.code==='code-import-reflow'));
    imports.push({filename,sha256:hash(bytes),slides:result.slides.length,exactCodeAndMetadata:true,diagnostics});
  }
  await write('comparison.json',{runtime,imports,scope:'Original/native-saved/native-edited code semantics and exact source text, including CR/LF/CRLF, blank lines and soft wraps. Imported native geometry, formatting, font theme and raster equivalence remain outside this gate.'});
  console.log('All 24 original/saved/edited slide imports preserve exact code source and metadata.');
}
