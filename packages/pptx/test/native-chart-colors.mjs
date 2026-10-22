import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {unzipSync} from 'fflate';
import {readChartCache} from './native-chart-cache.mjs';
import {toPptx,fromPptx} from '../dist/index.js';
import {colorContrast} from '@openpresentation/opf/composition';
const [mode,directory='artifacts/native-chart-colors']=process.argv.slice(2);assert.ok(['generate','compare'].includes(mode));
const output=path.resolve(directory),hash=b=>createHash('sha256').update(b).digest('hex');await mkdir(output,{recursive:true});
const json=async file=>JSON.parse((await readFile(path.join(output,file),'utf8')).replace(/^\uFEFF/,''));
const write=(file,data)=>writeFile(path.join(output,file),JSON.stringify(data,null,2)+'\n');
const expectedSeries=data=>data.columns.slice(1).map((name,index)=>({name,categories:data.rows.map(row=>row[0]),values:data.rows.map(row=>row[index+1])}));
const runtime={};
for(const name of ['@openpresentation/opf','@openpresentation/opf-pptx']){
 const root=path.dirname(fileURLToPath(import.meta.resolve(name+'/package.json'))),seen=new Set();
 const visit=async file=>{if(seen.has(file))return;seen.add(file);const bytes=await readFile(path.join(root,'dist',file));runtime[name+'/dist/'+file]=hash(bytes);for(const [,child]of bytes.toString().matchAll(/(?:from\s*|import\s*)['"](\.\/[^'"]+\.js)['"]/g))await visit(path.posix.join(path.posix.dirname(file),child));};
 for(const file of name==='@openpresentation/opf'?['composition.js','validator.js','catalogs.js']:(await readdir(path.join(root,'dist'))).filter(file=>file.endsWith('.js')).sort())await visit(file);
 runtime[name+'/package.json']=hash(await readFile(path.join(root,'package.json')));
}
for(const file of ['test/native-chart-colors.mjs','test/native-chart-colors.ps1','test/native-chart-cache.mjs','test/native-process.ps1','vendor/pptxgenjs/pptxgen.es.js','package-lock.json'])runtime[file]=hash(await readFile(new URL('../'+file,import.meta.url)));
if(mode==='generate'){
 const slides=[],expected=[];
 for(const [background,surface,labelColor]of [['#000000','#334155','#FFFFFF'],['#000000','#F8FAFC','#000000'],['#FFFFFF','#0F172A','#FFFFFF'],['#000000','#FFFFFF80','#FFFFFF']])for(const type of ['column','pie']){
  const data={columns:type==='pie'?['Quarter & phase Ω','Current']:['Quarter & phase Ω','Current','Baseline'],rows:type==='pie'?[['Q1',2],['Q2',3]]:[['Q1',2,1],['Q2',3,2]]};
  const text=background==='#000000'?'#FFFFFF':'#000000';
  slides.push({design:{background,colorScheme:{id:'cool-horizon',dark1:text,light1:text,text,dark2:surface,light2:surface}},chart:{type,data}});
  const edited=structuredClone(data);edited.columns[0]='Native quarter Ω';edited.columns[1]='Native Current';edited.rows[0][0]='Edited Q1';edited.rows[0][1]=42;
  expected.push({type,surface,labelColor,data,edited});
 }
 const document={design:{fontScheme:'roboto'},slides},original=structuredClone(document),bytes=await toPptx(document);assert.deepEqual(document,original);
 await writeFile(path.join(output,'charts.pptx'),bytes);await write('generation.json',{node:process.version,runtime,pptxSha256:hash(bytes),expected});
 console.log('Generated eight editable native charts, including alpha and contrasting panel themes.');
}else{
 const generation=await json('generation.json'),native=await json('native.json');assert.deepEqual(runtime,generation.runtime);assert.equal(native.generationSha256,hash(await readFile(path.join(output,'generation.json'))));
 assert.equal(native.editedSlides.length,1);assert.ok(Number.isInteger(native.editedSlides[0])&&native.editedSlides[0]>=1&&native.editedSlides[0]<=8);
 assert.deepEqual(native.editedLive,expectedSeries(generation.expected[native.editedSlides[0]-1].edited),'Actual edited series while embedded data is active');
 const unavailableObservations=[];
 let imports=0;
 for(const [file,phase]of [['charts.pptx','original'],['charts-saved.pptx','saved'],['charts-edited.pptx','edited']]){
  const bytes=await readFile(path.join(output,file));assert.equal(hash(bytes),phase==='original'?generation.pptxSha256:native[phase+'Sha256']);
  const deck=await fromPptx(bytes);assert.equal(deck.slides.length,generation.expected.length);
  const archive=unzipSync(bytes);
  for(const [i,slide]of deck.slides.entries()){
   const chart=slide.chart??slide.blocks?.find(block=>block.chart)?.chart;assert.ok(chart);
   const expected=generation.expected[i][phase==='edited'&&native.editedSlides.includes(i+1)?'edited':'data'];
   assert.deepEqual(chart.data,expected,`${phase} slide ${i+1}`);
   assert.deepEqual(readChartCache(archive,i),expectedSeries(expected),`${phase} slide ${i+1}: independent persisted chart cache`);imports++;
  }
 }
 for(const phase of ['original','reopened','edited']){assert.equal(native[phase].length,8);for(const [i,slide]of native[phase].entries()){
  const expected=generation.expected[i];assert.equal(slide.panelColor,expected.surface.slice(0,7));
  const data=expected[phase==='edited'&&native.editedSlides.includes(i+1)?'edited':'data'];
  const wanted=expectedSeries(data);assert.equal(slide.seriesData.length,wanted.length);
  for(const [index,series]of slide.seriesData.entries()){
   assert.deepEqual({name:series.name,values:series.values},{name:wanted[index].name,values:wanted[index].values},`${phase} slide ${i+1}: actual native series data`);
   if(expected.type==='pie'&&series.categories.length===wanted[index].categories.length&&series.categories.every(value=>value===null)){
    // A PowerPoint-created control also loses XValues on reopening. Preserve the
    // unavailable observation; require exact live edit data and persisted caches.
    unavailableObservations.push({phase,slide:i+1,series:index+1,property:'Series.XValues',observed:series.categories,reason:'Pie category getter returned null elements after loading. Native-created control reproduces this; live edited categories and independently parsed saved caches are required separately.'});
   }else assert.deepEqual(series.categories,wanted[index].categories,`${phase} slide ${i+1}: available native categories`);
  }
  assert.ok(Math.abs(slide.panelTransparency-(expected.surface.length===9?1-128/255:0))<.0001);
  assert.equal(slide.pointColors.length,(expected.data.columns.length-1)*expected.data.rows.length);
  if(expected.surface.length===7)for(const color of slide.pointColors)assert.ok(colorContrast(color,expected.surface)>=3,`${phase} slide ${i+1} native point ${color}`);
  assert.equal(slide.legendColor,expected.labelColor);if(expected.type==='column'){assert.equal(slide.categoryColor,expected.labelColor);assert.equal(slide.valueColor,expected.labelColor);}
  assert.equal(slide.pngSha256,hash(await readFile(path.join(output,slide.png))));
 }
 }
 for(let i=0;i<8;i++){
  assert.equal(native.original[i].pngSha256,native.reopened[i].pngSha256,`slide ${i+1}: native save/reopen raster`);
  if(native.editedSlides.includes(i+1))assert.notEqual(native.edited[i].pngSha256,native.reopened[i].pngSha256,`slide ${i+1}: edited native raster must change`);
  else assert.equal(native.edited[i].pngSha256,native.reopened[i].pngSha256,`slide ${i+1}: unedited native raster`);
 }
 await write('comparison.json',{node:process.version,nativeSha256:hash(await readFile(path.join(output,'native.json'))),imports,independentCacheComparisons:imports,slides:8,editedSlides:native.editedSlides,liveEditedSeries:true,unavailableObservations,passed:true,scope:'Native editable chart panel/axis/legend colors and alpha across eight slides; original/saved/edited imports and independent chart-cache reads preserve series, categories and values; one selected actual embedded Excel workbook edit additionally preserves the header and is observed live through COM before closing its data. Pie Series.XValues after loading is unavailable on this Office build, also reproduced by an Office-created control; nulls are recorded rather than called matching categories. Exact live categories and persisted native caches remain required. Full edit coverage requires separate successful runs for slides 1 through 8. No browser/native raster, per-glyph font or advanced chart-layout parity claim.'});
 console.log(`Native chart checks passed: ${imports} data imports, one actually edited workbook (slide ${native.editedSlides[0]}).`);
}
