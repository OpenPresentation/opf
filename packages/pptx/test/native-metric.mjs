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
const [mode,directory='artifacts/native-metric']=process.argv.slice(2);
assert.ok(['generate','compare'].includes(mode));
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
for(const file of ['test/native-metric.mjs','test/native-metric.ps1','vendor/pptxgenjs/pptxgen.es.js','package-lock.json'])runtime[file]=hash(await readFile(new URL('../'+file,import.meta.url)));
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
      {value:1,unit:'%',label:'Completion'}];
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
  console.log('Generated 36 wide/portrait aligned native metric slides.');
}else{
  const generation=await json('generation.json'),native=await json('native.json');
  assert.deepEqual(runtime,generation.runtime,'Native evidence requires unchanged runtimes and verifiers');
  assert.equal(native.generationSha256,hash(await readFile(path.join(output,'generation.json'))));
  const imports=[],rasters=[],advanceDifferences=[],rasterOutliers=[];
  const inkBounds=async bytes=>{
    const {data,info}=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});
    let left=info.width,top=info.height,right=-1,bottom=-1;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
      const i=(y*info.width+x)*info.channels;
      if([0,1,2].some(c=>Math.abs(data[i+c]-data[c])>2)){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    }
    return right<0?null:{left,top,right,bottom};
  };
  for(const deck of generation.decks){
    const record=native.decks.find(item=>item.id===deck.id);
    for(const [index,slide] of record.slides.entries()){
      const cell=deck.layouts[index].cell;
      for(const line of slide.lines)if(!line.characterBoundsInsideCell)advanceDifferences.push({id:deck.id,slide:index+1,role:line.role,text:line.text,rightOverhangPoints:line.left+line.width-(cell.x+cell.width)*.75});
      const nativeBytes=await readFile(path.join(output,`${deck.id}-native-${index+1}.png`)),svgBytes=await readFile(path.join(output,`${deck.id}-svg-${index+1}.png`));
      assert.equal(hash(nativeBytes),slide.rasterSha256);assert.equal(hash(svgBytes),deck.svgRasterSha256[index]);
      const nativeInk=await inkBounds(nativeBytes),svgInk=await inkBounds(svgBytes);
      let visibleInkInsideCell=true;
      for(const [engine,ink] of [['native',nativeInk],['svg',svgInk]])if(ink){
        if(!(ink.left>=Math.floor(cell.x)&&ink.top>=Math.floor(cell.y)&&ink.right<Math.ceil(cell.x+cell.width)&&ink.bottom<Math.ceil(cell.y+cell.height))){
          visibleInkInsideCell=false;rasterOutliers.push({id:deck.id,slide:index+1,engine,ink,cell});
        }
      }
      rasters.push({id:deck.id,slide:index+1,nativeSha256:hash(nativeBytes),svgSha256:hash(svgBytes),nativeInk,svgInk,visibleInkInsideCell});
    }
  }
  for(const deck of generation.decks)for(const state of ['original','saved','edited']){
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
  await write('comparison.json',{runtime,imports,rasters,advanceDifferences,rasterOutliers,visibleInkGatePassed:rasterOutliers.length===0,scope:'108 original/native-saved/native-edited metric slide imports preserve tested scalar types and exact source/metadata, including CRLF, blank lines and soft wraps. Visible SVG/native raster ink is tested against accepted cell integer pixel boundaries; outliers keep the raster gate failing. Character advances, including trailing whitespace, have separately recorded differences beyond 0.1 point; this is not exact advance equivalence or inter-part glyph collision proof. Native geometry/formatting/font theme are deliberately not reconstructed; no pixel equivalence is established.'});
  console.log('All 108 original/saved/edited metric slide imports preserve source and types.');
  assert.equal(rasterOutliers.length,0,'Visible native/SVG raster ink leaves accepted cells; see comparison.json. Source recovery passing does not close the native raster gate.');
}
