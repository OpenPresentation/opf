// Windows local PowerPoint regression. No proprietary font bytes are distributed.
// node test/native-quote.mjs generate|compare [evidence-directory]
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validatePresentation, paginateSlide} from '@openpresentation/opf';
import {renderSvgDeck, svgToPng, resolvePresentation} from '@openpresentation/opf-render';
import {createFontRegistry} from '@openpresentation/opf-render/fonts';
import sharp from 'sharp';
import {toPptx, fromPptx} from '@openpresentation/opf-pptx';

const [mode, directory = 'artifacts/native-quote',selectedDeck] = process.argv.slice(2);
assert.ok(['generate','compare','compare-deck'].includes(mode));
if(mode==='compare-deck')assert.ok(['quote-1280','quote-540'].includes(selectedDeck));
const output = path.resolve(directory), root = path.dirname(fileURLToPath(import.meta.resolve('@openpresentation/opf-pptx/package.json')));
const verificationRoot=fileURLToPath(new URL('../',import.meta.url));
await mkdir(output,{recursive:true});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async file => JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
const write = (file,value) => writeFile(path.join(output,file),JSON.stringify(value,null,2)+'\n');
const runtime = {};
for(const file of ['package.json',...(await readdir(path.join(root,'dist'),{recursive:true})).filter(file=>file.endsWith('.js')).map(file=>'dist/'+file)]) runtime['@openpresentation/opf-pptx/'+file.split(path.sep).join('/')]=hash(await readFile(path.join(root,file)));
for(const file of ['test/native-quote.mjs','test/native-quote.ps1','test/native-deck.ps1','test/native-process.ps1','vendor/pptxgenjs/pptxgen.es.js','package-lock.json'])runtime[file]=hash(await readFile(path.join(verificationRoot,file)));
for (const name of ['@openpresentation/opf','@openpresentation/opf-render']) {
  const directory=path.dirname(fileURLToPath(import.meta.resolve(name+'/package.json')));
  runtime[name+'/package.json']=hash(await readFile(path.join(directory,'package.json')));
  const dist=path.join(directory,'dist'),seen=new Set();
  const fingerprint=async file=>{
    if (seen.has(file)) return; seen.add(file);
    const relative=path.relative(dist,file);
    assert.ok(!relative.startsWith('..')&&!path.isAbsolute(relative),'Runtime imports must stay inside dist');
    const bytes=await readFile(file);
    runtime[name+'/dist/'+relative.split(path.sep).join('/')]=hash(bytes);
    for (const match of bytes.toString().matchAll(/(?:from\s*|import\s*)['"](\.\/[^'"]+\.js)['"]/g)) await fingerprint(path.resolve(path.dirname(file),match[1]));
  };
  // Fingerprint the core geometry/validation/catalog closure, excluding bundled
  // documentation/evidence so recording a report does not invalidate itself.
  const entries=name==='@openpresentation/opf'?['composition.js','pagination.js','validator.js','catalogs.js']
    :(await readdir(dist,{recursive:true})).filter(file=>file.endsWith('.js')).sort();
  for (const file of entries) {
    await fingerprint(path.join(dist,file));
  }
}
if(mode==='generate') {
  const faces = [['calibri.ttf',400,false],['calibrib.ttf',700,false],['calibrii.ttf',400,true],['calibriz.ttf',700,true]];
  const fontFiles = faces.map(([file])=>path.join(process.env.WINDIR??'C:/Windows','Fonts',file));
  const fontHashes = {}, fontFaces=[];
  for(const [index,[file,weight,italic]] of faces.entries()) {
    const bytes=await readFile(fontFiles[index]); fontHashes[file]=hash(bytes);
    fontFaces.push({data:new Uint8Array(bytes),family:'Calibri',weight,italic});
  }
  const fonts=createFontRegistry(fontFaces,{substitutionPolicy:'none'}), decks=[];
  for(const dimensions of [{width:1280,height:720},{width:540,height:960}]) {
    const id='quote-'+dimensions.width;
    const document={design:{dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96},fontScheme:{id:'calibri',code:{family:'Calibri'}}},slides:[12,16,20,24].map(repeats=>({title:'A quote and its source',quote:{text:'A shared layout keeps the evidence readable when the words change. '.repeat(repeats),attribution:'A reviewer',source:'Recorded interview'}}))};
    document.slides.push({title:'A quote and its source',quote:{text:'Keep the complete source visible.',attribution:'Long attribution '.repeat(60),source:'Recorded interview'}});
    const readable=paginateSlide({title:'A quote and its source',quote:{text:'This source keeps the selected readability floor.',attribution:'Repeated source '.repeat(15),source:'Recorded interview'}},{...dimensions,fonts:{heading:'Calibri',body:'Calibri',code:'Calibri'},textMeasurement:fonts.textMeasurement});
    assert.equal(readable.slides.length,1);
    assert.equal(readable.slides[0].composition.minFontSize,24,'Return the policy that was evaluated');
    document.slides.push(readable.slides[0]);
    assert.ok(validatePresentation(document).valid);
    const diagnostics=[], options={textMeasurement:fonts.textMeasurement,onDiagnostic:value=>diagnostics.push(value)};
    const resolved=resolvePresentation(document,options);
    const layouts=resolved.slides.map(slide=>{
      const item=slide.geometry.items.find(item=>item.field==='quote');
      return {cell:item.box,parts:item.quoteLayout.parts};
    });
    const svgs=renderSvgDeck(document,options), bytes=await toPptx(document,options), hashes={};
    assert.ok(!diagnostics.some(value=>value.code==='text-overflow'),'Native cases must fit before comparing');
    const save=async(file,bytes)=>{await writeFile(path.join(output,file),bytes);hashes[file]=hash(bytes);};
    await save(id+'.pptx',bytes);
    await save(id+'.opf.json',JSON.stringify(document,null,2)+'\n');
    for(const [index,svg] of svgs.entries()) {
      assert.ok(svg.includes(`viewBox="0 0 ${dimensions.width} ${dimensions.height}"`),'Actual preview dimensions must match');
      await save(`${id}-renderer-${index+1}.png`,await svgToPng(svg,{fontFiles,useBundledFonts:false,loadSystemFonts:false}));
    }
    decks.push({id,...dimensions,slides:document.slides.length,hashes,layouts});
  }
  await write('generation.json',{node:process.version,runtime,fontHashes,fontSubstitutions:fonts.substitutions,decks,scope:'Local Calibri; twelve wide/portrait quotes: eight long bodies, two expanded sources, two persisted pagination readability floors. Intermediate weights resolve to regular/bold faces. Native character bounds and editable save/reimport are separate from pixel-containment/raster-equivalence claims.'});
  console.log('Generated twelve native quote cases with controlled local Calibri.');
} else {
  const generation=await json(path.join(output,'generation.json')),decks=generation.decks.filter(deck=>mode!=='compare-deck'||deck.id===selectedDeck),native={decks:[]};
  for(const deck of decks){const run=await json(path.join(output,`runs/${deck.id}/native.json`));assert.equal(run.generationSha256,hash(await readFile(path.join(output,'generation.json'))));assert.equal(run.decks.length,1);assert.equal(run.decks[0].id,deck.id);native.decks.push(...run.decks);}
  assert.deepEqual(generation.runtime,runtime,'Regenerate changed candidate evidence');
  const comparisons=[], imports=[], contacts=[],boundsOutliers=[];
  for(const record of decks) {
    assert.match(record.id,/^quote-\d+$/);
    for(const [file,digest] of Object.entries(record.hashes)){assert.equal(path.basename(file),file);assert.equal(hash(await readFile(path.join(output,file))),digest);}
    const observed=native.decks.find(item=>item.id===record.id);
    assert.equal(observed.sourceSha256,record.hashes[record.id+'.pptx']);
    assert.equal(observed.editsReopened,record.slides);
    for(const slide of observed.slides) {
      if(!(slide.bodyLines>=1 && slide.bodyBottom<=slide.footerTop && slide.glyphsInsideCell))boundsOutliers.push({deck:record.id,...slide});
      const nativeFile=`${record.id}-native-${slide.slide}.png`, previewFile=`${record.id}-renderer-${slide.slide}.png`;
      assert.equal(hash(await readFile(path.join(output,nativeFile))),slide.rasterSha256);
      const expected=await sharp(path.join(output,previewFile)).removeAlpha().raw().toBuffer({resolveWithObject:true});
      const actual=await sharp(path.join(output,nativeFile)).removeAlpha().raw().toBuffer({resolveWithObject:true});
      assert.deepEqual(actual.info,expected.info);
      let total=0;for(let i=0;i<actual.data.length;i++)total+=Math.abs(actual.data[i]-expected.data[i]);
      comparisons.push({id:record.id,slide:slide.slide,meanAbsoluteChannelDifference:total/actual.data.length});
    }
    for(const suffix of ['', '-native-saved','-native-edited']) {
      const file=record.id+suffix+'.pptx', bytes=await readFile(path.join(output,file));
      if(suffix)assert.equal(hash(bytes),suffix==='-native-saved'?observed.savedSha256:observed.editedSha256);
      const restored=await fromPptx(bytes);
      assert.ok(validatePresentation(restored).valid);assert.equal(restored.slides.length,record.slides);
      for(const [index,slide] of restored.slides.entries()) {
        const strings=value=>typeof value==='string'?[value]:value&&typeof value==='object'?Object.values(value).flatMap(strings):[];
        const restoredText=strings(slide).join(' ').replace(/\s+/g,' ');
        for (const line of record.layouts[index].parts.find(part=>part.role==='footer').fit.lines) assert.ok(restoredText.includes(line),'Every source line survives native save/reimport');
        if(suffix==='-native-edited')assert.ok(JSON.stringify(slide).includes(`Native edit ${record.id} slide ${index+1}`));
      }
      imports.push({file,slides:restored.slides.length,valid:true,footerPreserved:true,editsPreserved:suffix==='-native-edited'});
    }
    const images=[];
    for(let index=1;index<=record.slides;index++) for(const [column,kind] of ['renderer','native'].entries()) images.push({input:await sharp(path.join(output,`${record.id}-${kind}-${index}.png`)).resize(480,360,{fit:'contain',background:'#ffffff'}).png().toBuffer(),left:column*480,top:(index-1)*360});
    const file=record.id+'-contact.png';
    await sharp({create:{width:960,height:record.slides*360,channels:3,background:'#ffffff'}}).composite(images).png().toFile(path.join(output,file));
    contacts.push({file,sha256:hash(await readFile(path.join(output,file))),rows:[12,16,20,24,'expanded source','pagination floor 24'],columns:['renderer','native PowerPoint']});
  }
  assert.equal(comparisons.length,decks.reduce((sum,deck)=>sum+deck.slides,0));
  const passed=boundsOutliers.length===0;
  await write(mode==='compare-deck'?`runs/${selectedDeck}/comparison.json`:'comparison.json',{...generation,native,comparisons,imports,contacts,boundsOutliers,passed,partial:mode==='compare-deck'});
  assert.ok(passed,`${boundsOutliers.length} native quote character-bound/separation failures; raw results retained.`);
  console.log(`Native quote checks passed: ${comparisons.length} character-bound/separation observations and editable save/reopens, ${imports.length} valid deck imports with footer lines and native title edits retained. Raster differences are observations, not equivalence thresholds.`);
}
