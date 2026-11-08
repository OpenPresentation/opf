import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {resolveInstalledImport} from 'file:///C:/opf-work/rr-20-e1-current-after/scripts/e1-current-after.mjs';
const consumer='C:/opf-work/core033-office-consumer-01';
const get=s=>import(pathToFileURL(resolveInstalledImport(consumer+'/node_modules',s)));
const opf=await get('@openpresentation/opf'),{composeSlide}=await get('@openpresentation/opf/composition'),{gallery}=await get('@openpresentation/gallery'),{loadFonts}=await get('@openpresentation/opf-render/fonts-node');
const rows=[];
for(const [deck,ids]of [['batch-11',['s07','s13','s41']],['batch-12',['s03','s19','s30']]]){
 const file='C:/opf-work/e1-033-after-02/decks/'+deck+'/current-gallery.opf.json',raw=fs.readFileSync(file),source=JSON.parse(raw);
 const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:source,faces:[]});
 for(const id of ids){const index=source.slides.findIndex(x=>x.id===id),context=opf.resolveSlideContext(source,index,{fonts,catalogs:[gallery],date:'2026-11-08'}),geometry=composeSlide(context.slide,{...context.options,textMeasurement:fonts.textMeasurement});
 const items=geometry.items.filter(i=>i.field==='text'||i.type==='chart').map(i=>({path:i.path,type:i.type,box:i.box,textStyle:i.textStyle,text:i.text,chart:i.chart,chartKeys:i.chart?Object.keys(i.chart):undefined}));
 rows.push({deck,id,ordinal:index+1,sourceSha256:createHash('sha256').update(raw).digest('hex'),authored:source.slides[index],canvas:{width:geometry.width,height:geometry.height},contentBox:geometry.contentBox,diagnostics:geometry.diagnostics,items});
 }
}
fs.writeFileSync(new URL('./measured-observations.json',import.meta.url),JSON.stringify({scope:'Advisory published033 composition only; actual visual judgments use immutable after02 PNGs. No render or source/runtime mutation.',consumer,release:'0.33.0',fontPolicy:'office/visual/auto',rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({deck:r.deck,id:r.id,items:r.items.map(i=>({path:i.path,type:i.type,box:i.box,font:i.text?.fontSize,lines:i.text?.lines?.length,lineHeight:i.text?.lineHeight,chartKeys:i.chartKeys}))})),null,2));
