import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {resolveInstalledImport} from 'file:///C:/opf-work/rr-20-e1-current-after/scripts/e1-current-after.mjs';
const modules='C:/opf-work/core033-office-consumer-01/node_modules';
const get=s=>import(pathToFileURL(resolveInstalledImport(modules,s)));
const opf=await get('@openpresentation/opf');
const {composeSlide}=await get('@openpresentation/opf/composition');
const {gallery}=await get('@openpresentation/gallery');
const {loadFonts}=await get('@openpresentation/opf-render/fonts-node');
const rows=[];
for (const [deck,ids] of [['overview',['layout-code','dynamic-code-text']],['pilot',['layout-code','dynamic-code-text']],['batch-02',['s30','s34']],['batch-03',['s12']]]) {
 const file=`C:/opf-work/e1-033-after-02/decks/${deck}/current-gallery.opf.json`;
 const raw=fs.readFileSync(file), source=JSON.parse(raw);
 const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:source,faces:[]});
 for (const id of ids) {
  const index=source.slides.findIndex(s=>s.id===id);
  const context=opf.resolveSlideContext(source,index,{fonts,catalogs:[gallery],date:'2026-11-08'});
  const geometry=composeSlide(context.slide,{...context.options,textMeasurement:fonts.textMeasurement});
  rows.push({deck,id,ordinal:index+1,sourceSha256:createHash('sha256').update(raw).digest('hex'),authored:source.slides[index],canvas:{width:geometry.width,height:geometry.height},contentBox:geometry.contentBox,diagnostics:geometry.diagnostics,items:geometry.items.filter(i=>i.type==='code'||i.field==='text').map(i=>({path:i.path,type:i.type,box:i.box,fontFamily:i.textStyle?.fontFamily,fontSize:i.text?.fontSize,lineHeight:i.text?.lineHeight,lines:i.text?.lines,overflow:i.text?.overflow,textHeight:i.text?.lines?.length*i.text?.lineHeight,textHeightToBoxHeight:i.text?.lines?.length*i.text?.lineHeight/i.box.height,codePlanKeys:i.code?Object.keys(i.code):undefined}))});
 }
}
const report={scope:'Advisory measured composition only; no render or source mutation. Primary visual judgments use immutable after02 PNGs. Latin code/text, published 0.33 office/visual/auto fonts and declared public APIs.',consumer:'C:/opf-work/core033-office-consumer-01',release:'0.33.0',scaleOfActualImages:0.5,rows};
fs.writeFileSync(new URL('./measured-code.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(rows.map(x=>({deck:x.deck,id:x.id,items:x.items.map(i=>({type:i.type,fontSize:i.fontSize,lines:i.lines?.length,textHeightToBoxHeight:i.textHeightToBoxHeight}))})),null,2));
