// Windows reference-font compatibility fixture. Reference font bytes stay local.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {createFontRegistry} from '@openpresentation/opf-render/fonts';
import {renderSvgDeck,resolvePresentation,svgToPng} from '@openpresentation/opf-render';
import {validatePresentation} from '@openpresentation/opf';
import {toPptx,fromPptx} from '../dist/index.js';
const [mode,directory='artifacts/native-metric',selectedId]=process.argv.slice(2);
assert.ok(['generate','compare','compare-deck'].includes(mode));
if(mode==='compare-deck')assert.match(selectedId??'',/^metric-(1280|540)-(left|center|right)$/);
const output=path.resolve(directory),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const write=(name,value)=>writeFile(path.join(output,name),JSON.stringify(value,null,2)+'\n');
const json=async name=>JSON.parse((await readFile(path.join(output,name),'utf8')).replace(/^\uFEFF/,''));
await mkdir(output,{recursive:true});
const runtime={};
for(const name of ['@openpresentation/opf','@openpresentation/opf-render','@openpresentation/opf-pptx']){
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
for(const file of ['test/native-metric.mjs','test/native-metric.ps1','test/native-process.ps1','vendor/pptxgenjs/pptxgen.es.js','package-lock.json'])runtime[file]=hash(await readFile(new URL('../'+file,import.meta.url)));
if(mode==='generate'){
  assert.equal(process.platform,'win32');
  const faces=[],fontHashes={},fontFiles=[];
  for(const [file,weight] of [['calibri.ttf',400],['calibrib.ttf',700]]){
    const fontPath=path.join(process.env.WINDIR??'C:/Windows','Fonts',file),data=await readFile(fontPath);fontFiles.push(fontPath);
    faces.push({data,family:'Calibri',weight,italic:false});fontHashes[file]=hash(data);
  }
  const fonts=createFontRegistry(faces,{substitutionPolicy:'none'}),decks=[];
  for(const dimensions of [{width:1280,height:720},{width:540,height:960}])for(const alignment of ['left','center','right']){
    const id=`metric-${dimensions.width}-${alignment}`,values=[0,'',
      {value:42,unit:'ms',label:'Left\tRight  ',description:'Exact\r\n\r\ncontext',delta:0,trend:'flat'},
      {value:'42\r\n-0.5',unit:'milliseconds across all completed production requests',label:'Latency'},
      {value:'',unit:'',label:'',description:'',delta:'',trend:'up'},
      {value:1,unit:'%',label:'Completion'},
      {value:'\t1\t%',unit:'ms',label:'\tBefore\tAfter  ',description:'\t'},
      {value:'\r\n\r\n\n',label:'\t  ',description:'\n'}];
    const family={family:'Calibri'};
    const document={design:{dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96},contentAlignment:alignment,fontScheme:{id:'calibri',heading:family,body:family,code:family}},slides:values.map(metric=>({composition:{minFontSize:24},metric}))};
    const options={textMeasurement:fonts.textMeasurement},bound=resolvePresentation(document,options);
    for(const slide of bound.slides)assert.deepEqual(slide.geometry.diagnostics,[]);
    const pptx=await toPptx(document,options),svgs=renderSvgDeck(document,{...options,embeddedFonts:fonts.embeddedFonts});
    await writeFile(path.join(output,id+'.pptx'),pptx);const rasters=[];
    for(const [index,svg] of svgs.entries()){
      const png=await svgToPng(svg,{fontFiles,useBundledFonts:false,loadSystemFonts:false});await writeFile(path.join(output,`${id}-svg-${index+1}.png`),png);rasters.push(hash(png));
    }
    decks.push({id,...dimensions,alignment,document,pptxSha256:hash(pptx),svgRasterSha256:rasters,layouts:bound.slides.map(slide=>({cell:slide.geometry.items[0].box,...slide.geometry.items[0].metricLayout}))});
  }
  await write('generation.json',{mode:'resolved-source-packages',node:process.version,runtime,fontHashes,substitutions:fonts.substitutions,decks,scope:'Actual metric source-package export with local Calibri reference bytes; resolved 400/700 styles, not synthetic 500/800. Separate SVG and PowerPoint observations; neither registry installation nor substitute-font/pixel equivalence is established.'});
  console.log(`Generated ${decks.reduce((n,deck)=>n+deck.document.slides.length,0)} wide/portrait aligned native metric slides.`);
}else{
  const generation=await json('generation.json'),generationSha256=hash(await readFile(path.join(output,'generation.json')));
  const selectedDecks=mode==='compare-deck'?generation.decks.filter(deck=>deck.id===selectedId):generation.decks;
  assert.equal(selectedDecks.length,mode==='compare-deck'?1:6);
  const native={decks:[],runs:[]};
  for(const deck of selectedDecks){
    const file=`runs/${deck.id}/native.json`,observed=await json(file),worker=await json(`runs/${deck.id}/worker.json`);
    assert.equal(worker.timedOut,false);assert.equal(worker.exitCode,0);assert.equal(observed.generationSha256,generationSha256);
    assert.equal(observed.decks.length,1);assert.equal(observed.decks[0].id,deck.id);
    native.decks.push(...observed.decks);native.runs.push({file,sha256:hash(await readFile(path.join(output,file))),workerSha256:hash(await readFile(path.join(output,`runs/${deck.id}/worker.json`)))});
  }
  assert.deepEqual(runtime,generation.runtime,'Native evidence requires unchanged runtimes and verifiers');
  const imports=[],rasters=[],advanceDifferences=[],rasterOutliers=[],tabOutliers=[],partInk=[],partCollisions=[],maskCoverageOutliers=[];
  const readInk=async bytes=>{
    const {data,info}=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const mask=new Uint8Array(info.width*info.height);
    let left=info.width,top=info.height,right=-1,bottom=-1;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
      const i=(y*info.width+x)*info.channels;
      if([0,1,2].some(c=>Math.abs(data[i+c]-data[c])>2)){mask[y*info.width+x]=1;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    }
    return {mask,width:info.width,height:info.height,bounds:right<0?null:{left,top,right,bottom}};
  };
  for(const deck of selectedDecks){
    const record=native.decks.find(item=>item.id===deck.id);
    assert.equal(record.slides.length,deck.layouts.length);
    for(const [index,slide] of record.slides.entries()){
      const cell=deck.layouts[index].cell;
      for(const line of slide.lines)if(!line.characterBoundsInsideCell)advanceDifferences.push({id:deck.id,slide:index+1,role:line.role,text:line.text,rightOverhangPoints:line.left+line.width-(cell.x+cell.width)*.75});
      for(const line of slide.lines)for(const tab of line.tabTargets)if(tab.errorPoints>.02)tabOutliers.push({id:deck.id,slide:index+1,role:line.role,text:line.text,...tab});
      const nativeBytes=await readFile(path.join(output,`${deck.id}-native-${index+1}.png`)),svgBytes=await readFile(path.join(output,`${deck.id}-svg-${index+1}.png`));
      assert.equal(hash(nativeBytes),slide.rasterSha256);assert.equal(hash(svgBytes),deck.svgRasterSha256[index]);
      const nativePixels=await readInk(nativeBytes),nativeInk=nativePixels.bounds,svgInk=(await readInk(svgBytes)).bounds;
      assert.deepEqual(slide.partRasters.map(part=>part.role),deck.layouts[index].parts.filter(part=>part.visible).map(part=>part.role));
      const masks=[],combinedMask=new Uint8Array(nativePixels.mask.length);
      for(const part of slide.partRasters){
        assert.equal(part.file,`${deck.id}-native-${index+1}-${part.role}.png`);
        const bytes=await readFile(path.join(output,part.file));assert.equal(hash(bytes),part.sha256);
        const ink=await readInk(bytes);assert.equal(ink.width,deck.width);assert.equal(ink.height,deck.height);
        const acceptedPart=deck.layouts[index].parts.find(item=>item.role===part.role);
        assert.equal(Boolean(ink.bounds),Boolean(acceptedPart.text.trim()),'Isolated field ink must cover each nonblank fixture field: '+part.file);
        const insideCell=!ink.bounds||(ink.bounds.left>=Math.floor(cell.x)&&ink.bounds.top>=Math.floor(cell.y)&&ink.bounds.right<Math.ceil(cell.x+cell.width)&&ink.bounds.bottom<Math.ceil(cell.y+cell.height));
        partInk.push({id:deck.id,slide:index+1,role:part.role,sha256:part.sha256,bounds:ink.bounds,insideCell});
        for(let p=0;p<ink.mask.length;p++)combinedMask[p]|=ink.mask[p];
        for(const previous of masks){
          let pixels=0,firstPixel;
          for(let p=0;p<ink.mask.length;p++)if(ink.mask[p]&&previous.mask[p]){pixels++;firstPixel??={x:p%ink.width,y:Math.floor(p/ink.width)};}
          if(pixels)partCollisions.push({id:deck.id,slide:index+1,roles:[previous.role,part.role],pixels,firstPixel});
        }
        masks.push({role:part.role,mask:ink.mask});
      }
      let missingPixels=0,extraPixels=0;
      for(let p=0;p<combinedMask.length;p++)if(combinedMask[p]!==nativePixels.mask[p]){if(nativePixels.mask[p])missingPixels++;else extraPixels++;}
      if(missingPixels||extraPixels)maskCoverageOutliers.push({id:deck.id,slide:index+1,missingPixels,extraPixels});
      let visibleInkInsideCell=true;
      for(const [engine,ink] of [['native',nativeInk],['svg',svgInk]])if(ink){
        if(!(ink.left>=Math.floor(cell.x)&&ink.top>=Math.floor(cell.y)&&ink.right<Math.ceil(cell.x+cell.width)&&ink.bottom<Math.ceil(cell.y+cell.height))){
          visibleInkInsideCell=false;rasterOutliers.push({id:deck.id,slide:index+1,engine,ink,cell});
        }
      }
      rasters.push({id:deck.id,slide:index+1,nativeSha256:hash(nativeBytes),svgSha256:hash(svgBytes),nativeInk,svgInk,visibleInkInsideCell});
    }
  }
  for(const deck of selectedDecks)for(const state of ['original','saved','edited']){
    const filename=deck.id+(state==='original'?'':`-${state}`)+'.pptx',bytes=await readFile(path.join(output,filename)),record=native.decks.find(item=>item.id===deck.id);
    assert.equal(hash(bytes),state==='original'?deck.pptxSha256:record[state+'Sha256']);
    const diagnostics=[],result=await fromPptx(bytes,{onDiagnostic:issue=>diagnostics.push(issue)});
    assert.equal(validatePresentation(result).valid,true);assert.equal(result.slides.length,deck.document.slides.length);
    for(const [index,slide] of result.slides.entries()){
      let metric=structuredClone(deck.document.slides[index].metric);
      if(state==='edited'){
        if(typeof metric==='number')metric=7;
        else if(typeof metric==='string')metric='NATIVE '+metric;
        else{
          metric.value=typeof metric.value==='number'?7:'NATIVE '+metric.value;
          for(const [key,prefix] of [['unit','Native '],['label','Saved '],['description','Edited ']])if(metric[key])metric[key]=prefix+metric[key];
          if(metric.delta!==undefined&&String(metric.delta)!=='')metric.delta=typeof metric.delta==='number'?1:'Delta '+metric.delta;
          if(metric.trend)metric.trend='down';
        }
      }
      assert.deepEqual(slide.blocks,[{type:'metric',metric}],filename+' slide '+(index+1));
    }
    assert.ok(diagnostics.every(issue=>issue.code==='metric-import-reflow'));
    imports.push({filename,sha256:hash(bytes),slides:result.slides.length,exactMetricFieldsSourceAndTypes:true,diagnostics});
  }
  const importedSlides=imports.reduce((n,item)=>n+item.slides,0);
  const gates={visibleInk:rasterOutliers.length===0,characterBounds:advanceDifferences.length===0,tabPositions:tabOutliers.length===0,interPartInk:partCollisions.length===0,isolatedMaskCoverage:maskCoverageOutliers.length===0};
  await write(mode==='compare-deck'?`comparison-${selectedId}.json`:'comparison.json',{node:process.version,runtime,generationSha256,nativeRuns:native.runs,completeMatrix:mode==='compare',imports,rasters,advanceDifferences,rasterOutliers,tabOutliers,partInk,partCollisions,maskCoverageOutliers,gates,scope:`${importedSlides} original/native-saved/native-edited metric slide imports preserve tested scalar types and exact source/metadata, including CRLF, leading tabs, whitespace-only parts and soft wraps. Visible SVG/native raster ink is tested against accepted cell integer pixel boundaries. Native parts are independently rasterized with other generated shapes temporarily hidden and their original visibility restored before saving; pixel-mask intersections above a 2/255 RGB background difference test inter-part ink collisions at these fixture dimensions. Each nonblank fixture field must produce ink, and the isolated masks' union must reproduce every full-slide ink pixel. Per-part bounds identify any field outside its cell. Character ranges retain a 0.1-point cell tolerance and tab positions a 0.02-point tolerance. Any failed gate exits nonzero after writing all results. These finite raster observations do not prove vector-outline, alternate-resolution or arbitrary native fidelity. Native geometry/formatting/font theme are deliberately not reconstructed; no pixel equivalence is established.`});
  console.log(`All ${importedSlides} original/saved/edited metric slide imports preserve source and types.`);
  console.log(JSON.stringify({gates,advanceOutliers:advanceDifferences.length,rasterOutliers:rasterOutliers.length,tabOutliers:tabOutliers.length,interPartCollisions:partCollisions.length}));
  assert.ok(Object.values(gates).every(Boolean),'Native metric fidelity gates remain open; see comparison.json. Source recovery passing does not close these gates.');
}
