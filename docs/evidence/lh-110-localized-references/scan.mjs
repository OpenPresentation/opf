// Pure reference inference for every structurally discovered corpus/public chart; only changed references can affect this feature.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)),baseline=process.argv[2],out=process.argv[3];assert.ok(baseline&&out);await fs.mkdir(path.join(out,'cases'),{recursive:true});
const load=(base,file)=>import(pathToFileURL(path.join(base,file)).href),[current,old,api,{gallery},{examples},{loadFonts}]=await Promise.all([load(root,'packages/javascript/dist/composition.js'),load(baseline,'packages/javascript/dist/composition.js'),load(root,'packages/javascript/dist/index.js'),load(root,'packages/gallery/dist/index.js'),load(root,'packages/javascript/dist/examples.js'),load(root,'packages/render/dist/fonts-node.js')]);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),sources=[];
for(const name of (await fs.readdir('C:/opf-work/harvest/corpus')).filter(name=>/^batch-\d+$/.test(name)).sort()){
 const file='C:/opf-work/harvest/corpus/'+name+'/deck.opf.json',raw=await fs.readFile(file),deck=JSON.parse(raw);delete deck.catalogs;sources.push({name,file,sha256:hash(raw),deck});
}
for(const {file,deck}of examples)sources.push({name:path.basename(file,'.opf.json'),file,sha256:hash(JSON.stringify(deck)),deck});
const exampleFile=path.join(root,'examples/technical/localized-chart-references.opf.json'),example=JSON.parse(await fs.readFile(exampleFile,'utf8'));
if(!sources.some(source=>source.name==='localized-chart-references'))sources.push({name:'localized-chart-references',file:exampleFile,sha256:hash(await fs.readFile(exampleFile)),deck:example});
const report={baselineCommit:execFileSync('git',['-C',baseline,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceCommit:execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'All slide structures; pure shared reference inference for every chart. Matched real font geometry checks for all changed references and the English witness control.',inputSlides:0,charts:0,changed:[],witnesses:[],regressions:[],sources:sources.map(({deck,...row})=>({...row,slides:deck.slides.length}))};
const flat=value=>typeof value==='string'?value:Array.isArray(value)?value.map(flat).join(''):value&&typeof value==='object'&&typeof value.text==='string'?value.text:'';
for(const source of sources){report.inputSlides+=source.deck.slides.length;for(const[index,slide]of source.deck.slides.entries()){
 const language=current.resolveScriptFonts(source.deck,{slideIndex:index}).bcp47,text=[flat(slide.title),flat(slide.subtitle)].filter(Boolean).join(' '),charts=[];
 const walk=(node,at)=>{if(!node||typeof node!=='object')return;for(const[key,value]of Object.entries(node)){if(key==='chart'&&value&&typeof value==='object')charts.push({value,path:at+'.chart'});else if(value&&typeof value==='object')walk(value,at+'.'+key);}};walk(slide,'slides.'+index);
 for(const chart of charts){report.charts++;const data=current.resolveChartData(chart.value,source.deck),before=old.chartTitleReferences(chart.value,data,{text,language}),after=current.chartTitleReferences(chart.value,data,{text,language});if(JSON.stringify(before)===JSON.stringify(after))continue;report.changed.push({id:source.name+'-'+(slide.id??'s'+(index+1)),file:source.file,slide:index+1,path:chart.path,language,title:slide.title,before,after});}
 if(source.name==='localized-chart-references'){
  const id='localized-chart-references-'+slide.id,input={...source.deck,name:id,slides:[slide]},embedded=api.embed(input,{catalogs:[gallery]});assert.deepEqual(embedded.unresolved,[]);await fs.writeFile(path.join(out,'cases',id+'.opf.json'),JSON.stringify(embedded.document,null,2)+'\n');report.witnesses.push({id});
  const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:input}),ctx=api.resolveSlideContext(input,0,{fonts,catalogs:[]}),before=old.composeSlide(ctx.slide,ctx.options),after=current.composeSlide(ctx.slide,ctx.options);
  const sizes=g=>g.items.filter(i=>i.field!=='chart').map(i=>({path:i.path,fontSize:i.text?.fontSize,box:i.box}));assert.deepEqual(sizes(after),sizes(before),id+': exact authored nonchart layout/sizes');assert.deepEqual(after.diagnostics,before.diagnostics);assert.deepEqual(after.items.map(i=>({path:i.path,value:i.value})),before.items.map(i=>({path:i.path,value:i.value})));assert.equal(after.items.find(i=>i.field==='chart').chart.fontSize,before.items.find(i=>i.field==='chart').chart.fontSize);
 }
}}
assert.equal(report.changed.length,6,'only six new localized example references change');assert.ok(report.changed.every(row=>row.id.startsWith('localized-chart-references-')&&row.after.lines[0]?.value===.92&&row.after.rows[0]===2));assert.equal(report.witnesses.length,7);
await fs.writeFile(path.join(out,'scan.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({inputSlides:report.inputSlides,charts:report.charts,changed:report.changed.map(row=>row.id),witnesses:report.witnesses.length,regressions:report.regressions}));
