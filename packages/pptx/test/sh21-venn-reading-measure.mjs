import assert from'node:assert/strict';
import{test}from'node:test';
import{unzipSync,strFromU8}from'fflate';
import{toPptx,fromPptx}from'../dist/index.js';
import{loadFonts}from'@openpresentation/opf-render/fonts-node';
import{resolveSlideContext,paginate}from'@openpresentation/opf';
import{composeSlide,measureTextOutline}from'@openpresentation/opf/composition';
import{gallery}from'@openpresentation/gallery';
const medium='Planning and operational support for participants across several teams';
const long=medium+' with regular training reviews and shared measurement of progress during the pilot. ';
const document=text=>({language:'en-US',catalogs:{custom:{fontSchemes:{'source-sans-3':{name:'Source Sans 3',major:'Source Sans 3',minor:'Source Sans 3',type:'sans-serif'}}}},design:{dimensions:'16:9',fontScheme:'source-sans-3'},slides:[{layout:'venn',title:'Readable Venn fallback',items:Array.from({length:7},(_,i)=>'Set '+(i+1)+': '+text)}]});
const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:document(medium)});
const compose=(doc,index=0)=>{const context=resolveSlideContext(doc,index,{catalogs:[gallery],fonts});return composeSlide(context.slide,context.options)};
const details=g=>{const item=g.items.find(i=>i.field==='items'),texts=item.listColumns?.map(c=>c.text)??[item.text];return{item,size:Math.min(...texts.map(t=>t.fontSize)),texts,lines:texts.flatMap(t=>t.listEntries.flatMap(e=>e.text.richLines.map(l=>l.fragments.map(f=>f.text).join('').trim())))}};
const fallbackOverflow = diagnostic => diagnostic.code === 'text-overflow' && diagnostic.path === 'slides.0.items';
const assertFallbackRefusal = diagnostics => {
 assert.ok(Array.isArray(diagnostics), 'composition exposes its public diagnostics');
 const matches = diagnostics.filter(fallbackOverflow);
 assert.equal(matches.length, 1, 'one text-overflow finding identifies the complete source list');
 assert.match(matches[0].message, /complete diagram fallback/i);
 assert.match(matches[0].message, /whole words to 70 characters per line/);
 assert.match(matches[0].message, /retained type size/);
 assert.match(matches[0].message, /Paginate/);
};
const assertCompleteFallback = (doc, geometry) => {
 const before = details(geometry);
 assert.equal(geometry.arrangements?.length ?? 0, 0, 'the whole diagram falls back, with no partial Venn left');
 assert.deepEqual(before.item.value, doc.slides[0].items, 'the complete authored list stays in source order');
 assert.deepEqual(before.texts.flatMap(text => text.listEntries.map(entry => entry.index)), doc.slides[0].items.map((_, index) => index));
 assert.equal(before.item.text.overflow, true, 'the unfit fallback remains explicitly overflowing');
 assertFallbackRefusal(geometry.diagnostics);
};
const assertStrictRefusal = doc => {
 const strict = structuredClone(doc); strict.slides[0].composition = {overflow: 'error'};
 assert.throws(() => compose(strict), error => {
  assert.equal(error.name, 'OPFCompositionError');
  assertFallbackRefusal(error.diagnostics);
  return true;
 });
};
// A multi-column item's outer box is the union, not the width of its physical text columns.
const boundedPhysicalColumns = (after, before, measurement) => {
 const columns = after.item.listColumns ?? [];
 for (const column of columns) {
  const box = column.box, outer = after.item.box;
  assert.ok([box.x, box.y, box.width, box.height].every(Number.isFinite) && box.width > 0 && box.height > 0, 'physical columns have positive finite boxes');
  assert.ok(box.x >= outer.x - 1e-6 && box.y >= outer.y - 1e-6 && box.x + box.width <= outer.x + outer.width + 1e-6 && box.y + box.height <= outer.y + outer.height + 1e-6, 'each physical column stays inside the list frame');
  for (const entry of column.text.listEntries) {
   const text = entry.textBox;
   assert.ok(text.width > 0 && text.x >= box.x - 1e-6 && text.x + text.width <= box.x + box.width + 1e-6, 'each entry text width stays inside its own column');
   for (const line of entry.text.richLines) {
    // RR17: canonical line.width excludes hanging blanks; a raw fragment advance includes them.
    assert.ok(Number.isFinite(line.width) && line.width >= 0 && text.x + line.width <= box.x + box.width + 1e-6, 'canonical measured line width stays inside its own column');
    for (const fragment of line.fragments) if (/\S/u.test(fragment.text)) {
     const ink = measureTextOutline(fragment.text, fragment.fontSize, fragment.style, measurement);
     assert.ok(ink, 'the same resolved font supplies visible outline bounds');
     assert.ok(text.x + fragment.x + ink.x >= box.x - 1e-6 && text.x + fragment.x + ink.x + ink.width <= box.x + box.width + 1e-6, 'visible glyphs stay inside their physical column');
    }
   }
  }
 }
 for (let left = 0; left < columns.length; left++) for (let right = left + 1; right < columns.length; right++) {
  const a = columns[left].box, b = columns[right].box;
  assert.ok(Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) <= 1e-6 || Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) <= 1e-6, 'physical columns do not overlap');
 }
 return columns.length > 1 && columns.every(column => column.box.width < before.item.box.width);
};
const assertWholeWords = (after, sourceItems) => {
 for (const text of after.texts) for (const entry of text.listEntries) {
  const source = sourceItems[entry.index], lines = entry.text.richLines.map(line => line.fragments.map(fragment => fragment.text).join(''));
  assert.equal(entry.value, source, 'the complete source entry, including spaces, stays exact');
  let cursor = 0, previousLine = -1;
  for (const [lineIndex, line] of entry.text.richLines.entries()) for (const fragment of line.fragments) {
   assert.equal(fragment.runIndex, 0, 'the authored fixture is one exact source run');
   assert.equal(fragment.run.text, source, 'the full authored run retains every source codepoint');
   assert.ok(Number.isInteger(fragment.start) && Number.isInteger(fragment.end) && fragment.start >= cursor && fragment.end >= fragment.start && fragment.end <= source.length);
   if (fragment.start > cursor) assert.ok(previousLine >= 0 && lineIndex > previousLine && /^ +$/u.test(source.slice(cursor, fragment.start)), 'only original ASCII-space gaps may occur at real soft line boundaries');
   assert.equal(fragment.text, source.slice(fragment.start, fragment.end), 'every drawn fragment equals its exact source slice');
   cursor = fragment.end; previousLine = lineIndex;
  }
  assert.equal(cursor, source.length, 'the drawn source ranges reach the original run end');
  assert.deepEqual(lines.flatMap(line => line.trim().split(/\s+/u).filter(Boolean)), source.trim().split(/\s+/u), 'line boundaries never split or change a whole word');
 }
};
for(const[name,text,oldSize]of[['medium',medium,104/3],['long',long,80/3]])test('SH21: actual-font '+name+' Venn fallback refuses long measures and paginates losslessly without smaller type',async()=>{
 const doc=document(text),source=structuredClone(doc),g=compose(doc),before=details(g);assert.ok(Math.abs(before.size-oldSize)<1e-6);assert.ok(before.lines.some(line=>line.length>70));assertCompleteFallback(doc,g);assert.deepEqual(doc,source);
 assertStrictRefusal(doc);
 // Composition/pagination floors are bounded at32 by the existing schema. Check observed sizes as well as that supported floor.
 const paged=paginate(doc,{catalogs:[gallery],fonts,minFontSize:Math.min(32,before.size)}).presentation;assert.equal(paged.slides.length,2);assert.deepEqual(paged.slides.flatMap(slide=>slide.items),doc.slides[0].items);
 let boundedWrap=false;for(let index=0;index<paged.slides.length;index++){
  const page=compose(paged,index),after=details(page);assert.ok(after.size>=before.size-1e-6);assert.ok(after.lines.every(line=>line.length<=70));assert.ok(after.texts.every(t=>!t.overflow));assert.ok(!page.diagnostics.some(d=>d.code==='text-overflow'));assertWholeWords(after,paged.slides[index].items);const measurement=resolveSlideContext(paged,index,{catalogs:[gallery],fonts}).options.textMeasurement??fonts.textMeasurement;const physicalWrap=boundedPhysicalColumns(after,before,measurement);
  if(name==='medium'&&index===0){
   const missing=structuredClone(after),fragment=missing.texts[0].listEntries[0].text.richLines[1].fragments[0];fragment.start++;fragment.text=fragment.text.slice(1);
   assert.throws(()=>assertWholeWords(missing,paged.slides[index].items),/only original ASCII-space gaps/,'an actual nonspace source gap is refused');
   const lost=structuredClone(after);lost.texts[0].listEntries[0].text.richLines[0].fragments[0].text=lost.texts[0].listEntries[0].text.richLines[0].fragments[0].text.replace('Planning','');
   assert.throws(()=>assertWholeWords(lost,paged.slides[index].items),/exact source slice/,'a lost source token is refused');
  }
  if(name==='long'&&index===0){
   const outside=structuredClone(after);outside.item.listColumns[0].text.listEntries[0].text.richLines[0].fragments[0].text='W'.repeat(90);
   assert.throws(()=>boundedPhysicalColumns(outside,before,measurement),/visible glyphs stay inside/,'visible ink overflow is refused even when stored line width and physical boxes look valid');
  }
  boundedWrap||=!page.arrangements?.length&&(after.item.box.width<before.item.box.width||physicalWrap);
 }
 if(name==='long')assert.ok(boundedWrap,'the full-word bounded-width success path is exercised, not just the refusal');
 const bytes=new Uint8Array(await toPptx(paged,{catalogs:[gallery],fonts})),parts=unzipSync(bytes);assert.ok(!Object.keys(parts).some(file=>file.startsWith('ppt/diagrams/')));for(const[file,part]of Object.entries(parts))if(/^ppt\/slides\/slide\d+\.xml$/.test(file))assert.ok(!/<a:(?:normAutofit|spAutoFit)\b/.test(strFromU8(part)));
 const imported=await fromPptx(bytes);assert.deepEqual(imported.slides.flatMap(slide=>slide.items??slide.blocks?.find(block=>block.items)?.items??[]),doc.slides[0].items);
 const plain=structuredClone(gallery.layouts.venn);for(const region of plain.regions)delete region.arrangement;const generic=structuredClone(doc);generic.catalogs.custom.layouts={plain};generic.slides[0].layout='custom:plain';const genericFit=compose(generic);assert.ok(details(genericFit).lines.some(line=>line.length>70));assert.ok(!genericFit.diagnostics.some(d=>fallbackOverflow(d)&&/complete diagram fallback/i.test(d.message)),'generic lists retain their existing policy');assert.deepEqual(doc,source);
});

test('SH21: an unbreakable Venn label is explicitly refused instead of silently splitting a word',()=>{
 const doc=document('W'.repeat(90)),source=structuredClone(doc),g=compose(doc);assertCompleteFallback(doc,g);assertStrictRefusal(doc);assert.throws(()=>paginate(doc,{catalogs:[gallery],fonts,minFontSize:32}),error=>error.code==='pagination-unresolved');assert.deepEqual(doc,source);
});
