import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolveSlideContext} from '../../../packages/javascript/dist/index.js';
import {composeSlide} from '../../../packages/javascript/dist/composition.js';
import {gallery} from '../../../packages/gallery/dist/index.js';
import {loadFonts} from '../../../packages/render/dist/fonts-node.js';
import {toSvg} from '../../../packages/render/dist/index.js';
const root=fileURLToPath(new URL('./',import.meta.url)),before=process.argv[2],after=process.argv[3],native=process.argv[4];assert.ok(before&&after&&native);
const copy=async(a,b)=>{await fs.mkdir(path.dirname(b),{recursive:true});await fs.copyFile(a,b);},hash=bytes=>createHash('sha256').update(bytes).digest('hex'),report=JSON.parse(await fs.readFile(path.join(after,'manifest.json'),'utf8'));
for(const[a,b]of [[path.join(after,'manifest.json'),'cli-comparison.json'],[after+'.log','cli-comparison.log'],[before+'.log','cli-before.log'],['C:/opf-work/lh93-negative-focused.log','focused-native-rtl.log'],['C:/opf-work/lh93-negative-siblings.log','focused-siblings.log'],['C:/opf-work/lh93-negative-options.log','focused-options.log']])await copy(a,path.join(root,b));
const build={revision:report.candidate,opfVersion:'0.34.0-preparation',route:report.route,decks:[]};
for(const row of report.cases){
 const input=path.join(before,'inputs',row.id+'.opf.json'),raw=await fs.readFile(input);assert.equal(hash(raw),row.inputSha256);await copy(input,path.join(root,'inputs',row.id+'.opf.json'));
 for(const label of ['before','after'])for(const ext of ['pptx','png']){const file=row[label][ext].file;assert.equal(hash(await fs.readFile(file)),row[label][ext].sha256);await copy(file,path.join(root,label,row.id+'.'+ext));await copy(file+'.log',path.join(root,label,row.id+'.'+ext+'.log'));}
 if(!row.native)continue;
 const pptx='pptx/'+row.id+'.pptx',preview='preview/'+row.id+'/slide-1.png';await copy(row.after.pptx.file,path.join(native,pptx));await copy(row.after.png.file,path.join(native,preview));build.decks.push({id:row.id,source:path.join(root,'after',row.id+'.pptx'),sourceCommit:report.candidate,previewOk:true,previewSlides:1,width:1280,height:720,previewDirectory:'preview/'+row.id,previews:[{slide:1,path:preview,sha256:row.after.png.sha256,width:row.after.png.width,height:row.after.png.height}],variants:[{name:'default',pptx,ok:true,sha256:row.after.pptx.sha256}]});
 if(row.id==='negative-rtl'){
  const document=JSON.parse(raw),fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:document}),context=resolveSlideContext(document,0,{fonts,catalogs:[gallery]}),geometry=composeSlide(context.slide,context.options),item=geometry.items.find(i=>i.field==='chart'),svg=toSvg(document,1,{trace:true,fonts,catalogs:[gallery],date:'2026-11-08'}),label=[...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].find(m=>m[1].includes('data-opf-path="slides.0.blocks.0.chart.data.rows.0.0"'));
  assert.ok(label);const labelX=Number(/\bx="([^"]+)"/.exec(label[1])?.[1]),plotLeft=item.box.x+item.chart.layer.plot.left;assert.equal(geometry.direction,'rtl');assert.ok(labelX<plotLeft);await fs.writeFile(path.join(root,'rtl-trace.svg'),svg);await fs.writeFile(path.join(root,'rtl-physical-edge.json'),JSON.stringify({direction:geometry.direction,categoryText:'Lead',categoryAnchorX:labelX,sharedPlotLeft:plotLeft,physicalCategoryEdge:'left',native:{categoryOrientation:'maxMin',categorySide:'l',categoryCrossing:'autoZero',categoryTickLabel:'low',valueOrientation:'minMax',valueSide:'b'},route:'Actual traced preview with the matching prepared office/visual/scripts:auto handle; native qualification itself uses the exact CLI PNG/PPTX'},null,2)+'\n');
 }
}
assert.equal(build.decks.length,3);for(const deck of build.decks){assert.equal(hash(await fs.readFile(path.join(native,deck.variants[0].pptx))),deck.variants[0].sha256);assert.equal(hash(await fs.readFile(path.join(native,deck.previews[0].path))),deck.previews[0].sha256);}
const bytes=JSON.stringify(build,null,2)+'\n';await fs.writeFile(path.join(native,'build.json'),bytes);await fs.writeFile(path.join(root,'native-build.json'),bytes);console.log(JSON.stringify({files:build.decks.length,manifestSha256:hash(bytes),allFivePreviewsByteIdentical:report.proof.every(row=>row.previewByteIdentical),unaffectedNativeArchivesByteIdentical:report.proof.filter(row=>!row.onlyCatAxisTickLabelLow).every(row=>row.nativeByteIdentical)}));
