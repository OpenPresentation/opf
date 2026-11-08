// Inspect all inputs structurally; compare only two-note majority-grid candidates that can reach the changed rule, with identical real fonts.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../../',import.meta.url)),baseline=process.argv[2],out=process.argv[3];assert.ok(baseline&&out);await fs.mkdir(out,{recursive:true});await fs.mkdir(path.join(out,'cases'),{recursive:true});
const load=(base,file)=>import(pathToFileURL(path.join(base,file)).href);
const [current,old,{composeSlide},{composeSlide:composeBefore},{gallery},{loadFonts},{examples}]=await Promise.all([
 load(root,'packages/javascript/dist/index.js'),load(baseline,'packages/javascript/dist/index.js'),load(root,'packages/javascript/dist/composition.js'),load(baseline,'packages/javascript/dist/composition.js'),load(root,'packages/gallery/dist/index.js'),load(root,'packages/render/dist/fonts-node.js'),load(root,'packages/javascript/dist/examples.js')]);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),sources=[];
for(const batch of (await fs.readdir('C:/opf-work/harvest/corpus')).filter(name=>/^batch-\d+$/.test(name)).sort()){
 const file='C:/opf-work/harvest/corpus/'+batch+'/deck.opf.json',raw=await fs.readFile(file),deck=JSON.parse(raw);if(deck.catalogs&&Object.keys(deck.catalogs).some(key=>key!=='default'))throw Error('Unexpected custom corpus catalog: '+batch);delete deck.catalogs;sources.push({name:batch,file,sha256:hash(raw),deck,corpus:true});
}
for(const {file,deck}of examples)sources.push({name:path.basename(file,'.opf.json'),file,sha256:hash(JSON.stringify(deck)),deck,corpus:false});
const report={baselineCommit:execFileSync('git',['-C',baseline,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceCommit:execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),fontProfile:'office / visual / scripts:auto; same prepared handle for both engines',sources:sources.map(({deck,...row})=>({...row,slides:deck.slides.length})),inputSlides:sources.reduce((sum,source)=>sum+source.deck.slides.length,0),candidateSlides:0,slides:0,changed:[],regressions:[]};
const sizes=geometry=>{const result=new Map();const walk=(value,prefix)=>{if(!value||typeof value!=='object')return;for(const[key,child]of Object.entries(value)){if(key==='fontSize'&&typeof child==='number')result.set(prefix+'.fontSize',child);else if(child&&typeof child==='object')walk(child,prefix+'.'+key);}};for(const item of geometry.items)walk(item,item.path);return result;};
const summary=g=>({notes:g.items.filter(item=>item.field==='text').map(item=>({path:item.path,box:item.box,fontSize:item.text?.fontSize,lines:item.text?.lines})),regions:g.regions?.map(region=>({name:region.name,box:region.box,arrangement:region.arrangement})),diagnostics:g.diagnostics});
const eligible=slide=>Array.isArray(slide.blocks)&&slide.blocks.filter(block=>block&&typeof block==='object'&&block.text!==undefined&&!block.blocks).length===2&&slide.blocks.filter(block=>block&&typeof block==='object'&&['metric','chart','table','image','diagram','video','code'].some(key=>block[key]!==undefined)).length>=3;
for(const source of sources){
 const candidates=source.deck.slides.filter(eligible);if(!candidates.length)continue;report.candidateSlides+=candidates.length;console.log(source.name+': '+candidates.length+' bounded candidate(s)');
 const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:source.deck});
 for(const [index,slide]of source.deck.slides.entries()){
  if(!eligible(slide))continue;report.slides++;const opts={catalogs:[gallery],fonts},a=old.resolveSlideContext(source.deck,index,opts),b=current.resolveSlideContext(source.deck,index,opts),before=composeBefore(a.slide,a.options),after=composeSlide(b.slide,b.options);
  if(JSON.stringify(before)===JSON.stringify(after))continue;
  const id=source.name+'-'+(slide.id??'s'+(index+1)),beforeSizes=sizes(before),afterSizes=sizes(after),drops=[];
  for(const[key,size]of beforeSizes){const next=afterSizes.get(key);if(next!==undefined&&next<size-.01)drops.push({key,before:size,after:next});}
  const diags=new Set(before.diagnostics.map(item=>item.code+'|'+item.path)),added=after.diagnostics.filter(item=>!diags.has(item.code+'|'+item.path));
  const beforeValues=before.items.map(item=>({path:item.path,field:item.field,value:item.value})),afterValues=after.items.map(item=>({path:item.path,field:item.field,value:item.value})),sameSource=JSON.stringify(beforeValues)===JSON.stringify(afterValues);
  const record={id,file:source.file,slide:index+1,corpus:source.corpus,title:slide.title,before:summary(before),after:summary(after),fontDrops:drops,newDiagnostics:added,sourceItemsIdentical:sameSource};report.changed.push(record);
  if(drops.length||added.length||!sameSource)report.regressions.push({id,fontDrops:drops,newDiagnostics:added,sourceItemsIdentical:sameSource});
  const input={...source.deck,name:id,slides:[slide]},embedded=current.embed(input,{catalogs:[gallery]});assert.deepEqual(embedded.unresolved,[],id+': standalone witness');await fs.writeFile(path.join(out,'cases',id+'.opf.json'),JSON.stringify(embedded.document,null,2)+'\n');
 }
}
await fs.writeFile(path.join(out,'scan.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({inputSlides:report.inputSlides,candidateSlides:report.candidateSlides,slides:report.slides,changed:report.changed.map(row=>row.id),regressions:report.regressions}));assert.deepEqual(report.regressions,[],'no smaller text, added diagnostic or source-item loss');
