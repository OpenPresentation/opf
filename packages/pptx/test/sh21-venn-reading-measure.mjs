import assert from'node:assert/strict';
import{test}from'node:test';
import{unzipSync,strFromU8}from'fflate';
import{toPptx,fromPptx}from'../dist/index.js';
import{loadFonts}from'@openpresentation/opf-render/fonts-node';
import{resolveSlideContext,paginate}from'@openpresentation/opf';
import{composeSlide}from'@openpresentation/opf/composition';
import{gallery}from'@openpresentation/gallery';
const medium='Planning and operational support for participants across several teams';
const long=medium+' with regular training reviews and shared measurement of progress during the pilot. ';
const document=text=>({language:'en-US',catalogs:{custom:{fontSchemes:{'source-sans-3':{name:'Source Sans 3',major:'Source Sans 3',minor:'Source Sans 3',type:'sans-serif'}}}},design:{dimensions:'16:9',fontScheme:'source-sans-3'},slides:[{layout:'venn',title:'Readable Venn fallback',items:Array.from({length:7},(_,i)=>'Set '+(i+1)+': '+text)}]});
const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:document(medium)});
const compose=(doc,index=0)=>{const context=resolveSlideContext(doc,index,{catalogs:[gallery],fonts});return composeSlide(context.slide,context.options)};
const details=g=>{const item=g.items.find(i=>i.field==='items'),texts=item.listColumns?.map(c=>c.text)??[item.text];return{item,size:Math.min(...texts.map(t=>t.fontSize)),texts,lines:texts.flatMap(t=>t.listEntries.flatMap(e=>e.text.richLines.map(l=>l.fragments.map(f=>f.text).join('').trim())))}};
for(const[name,text,oldSize]of[['medium',medium,104/3],['long',long,80/3]])test('SH21: actual-font '+name+' Venn fallback refuses long measures and paginates losslessly without smaller type',async()=>{
 const doc=document(text),source=structuredClone(doc),g=compose(doc),before=details(g);assert.ok(Math.abs(before.size-oldSize)<1e-6);assert.ok(before.lines.some(line=>line.length>70));assert.ok(g.diagnostics.some(d=>d.code==='text-overflow'&&/Venn fallback/.test(d.message)));assert.deepEqual(doc,source);
 const strict=structuredClone(doc);strict.slides[0].composition={overflow:'error'};assert.throws(()=>compose(strict),error=>error.diagnostics.some(d=>d.code==='text-overflow'&&/Venn fallback/.test(d.message)));
 // Composition/pagination floors are bounded at32 by the existing schema. Check observed sizes as well as that supported floor.
 const paged=paginate(doc,{catalogs:[gallery],fonts,minFontSize:Math.min(32,before.size)}).presentation;assert.equal(paged.slides.length,2);assert.deepEqual(paged.slides.flatMap(slide=>slide.items),doc.slides[0].items);
 let boundedWrap=false;for(let index=0;index<paged.slides.length;index++){
  const page=compose(paged,index),after=details(page);assert.ok(after.size>=before.size-1e-6);assert.ok(after.lines.every(line=>line.length<=70));assert.ok(after.texts.every(t=>!t.overflow));assert.ok(!page.diagnostics.some(d=>d.code==='text-overflow'));boundedWrap||=!page.arrangements?.length&&after.item.box.width<before.item.box.width;
 }
 if(name==='long')assert.ok(boundedWrap,'the full-word bounded-width success path is exercised, not just the refusal');
 const bytes=new Uint8Array(await toPptx(paged,{catalogs:[gallery],fonts})),parts=unzipSync(bytes);assert.ok(!Object.keys(parts).some(file=>file.startsWith('ppt/diagrams/')));for(const[file,part]of Object.entries(parts))if(/^ppt\/slides\/slide\d+\.xml$/.test(file))assert.ok(!/<a:(?:normAutofit|spAutoFit)\b/.test(strFromU8(part)));
 const imported=await fromPptx(bytes);assert.deepEqual(imported.slides.flatMap(slide=>slide.items??slide.blocks?.find(block=>block.items)?.items??[]),doc.slides[0].items);
 const plain=structuredClone(gallery.layouts.venn);for(const region of plain.regions)delete region.arrangement;const generic=structuredClone(doc);generic.catalogs.custom.layouts={plain};generic.slides[0].layout='custom:plain';const genericFit=compose(generic);assert.ok(details(genericFit).lines.some(line=>line.length>70));assert.ok(!genericFit.diagnostics.some(d=>d.code==='text-overflow'&&/Venn fallback/.test(d.message)),'generic lists retain their existing policy');assert.deepEqual(doc,source);
});

test('SH21: an unbreakable Venn label is explicitly refused instead of silently splitting a word',()=>{
 const doc=document('W'.repeat(90)),source=structuredClone(doc),g=compose(doc);assert.ok(g.diagnostics.some(d=>d.code==='text-overflow'&&/Venn fallback/.test(d.message)));assert.throws(()=>paginate(doc,{catalogs:[gallery],fonts,minFontSize:32}),error=>error.code==='pagination-unresolved');assert.deepEqual(doc,source);
});
