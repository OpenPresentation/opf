import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {toPptx,fromPptx} from '../dist/index.js';
import {colorContrast} from '@openpresentation/opf/composition';
const [mode,directory='artifacts/native-chart-colors']=process.argv.slice(2);assert.ok(['generate','compare'].includes(mode));
const output=path.resolve(directory),hash=b=>createHash('sha256').update(b).digest('hex');await mkdir(output,{recursive:true});
const json=async file=>JSON.parse((await readFile(path.join(output,file),'utf8')).replace(/^\uFEFF/,''));
const write=(file,data)=>writeFile(path.join(output,file),JSON.stringify(data,null,2)+'\n');
const runtime={};
for(const name of ['@openpresentation/opf','@openpresentation/opf-pptx']){
 const root=path.dirname(fileURLToPath(import.meta.resolve(name+'/package.json'))),seen=new Set();
 const visit=async file=>{if(seen.has(file))return;seen.add(file);const bytes=await readFile(path.join(root,'dist',file));runtime[name+'/dist/'+file]=hash(bytes);for(const [,child]of bytes.toString().matchAll(/(?:from\s*|import\s*)['"](\.\/[^'"]+\.js)['"]/g))await visit(path.posix.join(path.posix.dirname(file),child));};
 for(const file of name==='@openpresentation/opf'?['composition.js','validator.js','catalogs.js']:(await readdir(path.join(root,'dist'))).filter(file=>file.endsWith('.js')).sort())await visit(file);
 runtime[name+'/package.json']=hash(await readFile(path.join(root,'package.json')));
}
for(const file of ['test/native-chart-colors.mjs','test/native-chart-colors.ps1','test/native-process.ps1','vendor/pptxgenjs/pptxgen.es.js','package-lock.json'])runtime[file]=hash(await readFile(new URL('../'+file,import.meta.url)));
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
 let imports=0;
 for(const [file,phase]of [['charts.pptx','original'],['charts-saved.pptx','saved'],['charts-edited.pptx','edited']]){
  const bytes=await readFile(path.join(output,file));assert.equal(hash(bytes),phase==='original'?generation.pptxSha256:native[phase+'Sha256']);
  const deck=await fromPptx(bytes);assert.equal(deck.slides.length,generation.expected.length);
  for(const [i,slide]of deck.slides.entries()){
   const chart=slide.chart??slide.blocks?.find(block=>block.chart)?.chart;assert.ok(chart);
   assert.deepEqual(chart.data,generation.expected[i][phase==='edited'&&native.editedSlides.includes(i+1)?'edited':'data'],`${phase} slide ${i+1}`);imports++;
  }
 }
 for(const phase of ['original','reopened']){assert.equal(native[phase].length,8);for(const [i,slide]of native[phase].entries()){
  const expected=generation.expected[i];assert.equal(slide.panelColor,expected.surface.slice(0,7));
  assert.ok(Math.abs(slide.panelTransparency-(expected.surface.length===9?1-128/255:0))<.0001);
  assert.equal(slide.pointColors.length,(expected.data.columns.length-1)*expected.data.rows.length);
  if(expected.surface.length===7)for(const color of slide.pointColors)assert.ok(colorContrast(color,expected.surface)>=3,`${phase} slide ${i+1} native point ${color}`);
  assert.equal(slide.legendColor,expected.labelColor);if(expected.type==='column'){assert.equal(slide.categoryColor,expected.labelColor);assert.equal(slide.valueColor,expected.labelColor);}
  assert.equal(slide.pngSha256,hash(await readFile(path.join(output,slide.png))));
 }
 }
 await write('comparison.json',{node:process.version,nativeSha256:hash(await readFile(path.join(output,'native.json'))),imports,slides:8,editedSlides:native.editedSlides,passed:true,scope:'Native editable chart panel/axis/legend colors and alpha across eight slides; original/saved data and one selected actual embedded Excel workbook edit preserve header, series names, categories and values. Full edit coverage requires separate successful runs for slides 1 through 8. No browser/native raster or advanced chart-layout parity claim.'});
 console.log(`Native chart checks passed: ${imports} data imports, one actually edited workbook (slide ${native.editedSlides[0]}).`);
}
