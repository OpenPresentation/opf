// Explicit reference lines pass through the maintained SVG/PPTX file API with one prepared font provider, in seven languages.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {convert, resolveSlideContext, validate} from '@openpresentation/opf';
import {composeSlide} from '@openpresentation/opf/composition';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {fromPptx} from '@openpresentation/opf-pptx';
const document=JSON.parse(fs.readFileSync(new URL('../../../examples/technical/localized-chart-references.opf.json',import.meta.url),'utf8'));
const referencesOf=(deck,index,options)=>{const context=resolveSlideContext(deck,index,options);return composeSlide(context.slide,context.options).items.find(item=>item.field==='chart').chart.layer?.references;};
test('LH-110: the seven-language example draws only its explicit references, the same in SVG and native PPTX',async()=>{
 const validation=validate(document,{catalogs:[]});assert.equal(validation.schemaValid,true);assert.ok(!validation.findings.some(f=>f.code==='unresolved-reference'),'standalone catalog records are complete');
 // The whole pack: the document-demand provider (presentation: document) does not prepare the bold title face these wrapped titles are measured with in the PPTX export on this branch's base; that is its own defect, not a reference-line one.
 const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual'});
 const svg=await convert(document,{format:'svg',fonts,catalogs:[],date:'2026-11-08'}),native=await convert(document,{format:'pptx',fonts,catalogs:[],date:'2026-11-08'});
 assert.equal(svg.files.length,7);assert.equal(native.files.length,1);
 const imported=await fromPptx(native.files[0].bytes,{signals:true,catalogs:[]});assert.equal(imported.presentation.slides.length,7);
 for(const[index,source]of document.slides.entries()){
  const authored=source.chart.referenceLines,refs=referencesOf(document,index,{fonts,catalogs:[]});
  // One line, at the authored value, labeled with the authored words and nothing read from the title.
  assert.equal(refs.lines.length,authored.length,source.language);assert.equal(refs.lines[0].value,authored[0].value);assert.equal(refs.lines[0].label,authored[0].label);assert.equal(refs.bands,undefined);
  const text=new TextDecoder().decode(svg.files[index].bytes);assert.ok(text.includes(authored[0].label),`${source.language}: SVG draws the authored label`);
  // An unchanged export imports the references as the document wrote them, beside the untouched data.
  assert.deepEqual(imported.presentation.slides[index].chart.referenceLines,authored,source.language);
  assert.deepEqual(imported.presentation.slides[index].chart.data,source.chart.data,'all original chart values/columns survive');
 }
});
test('LH-110: the titles of the example decide nothing: without referenceLines no line is drawn, and other words move none',()=>{
 for(const[index,source]of document.slides.entries()){
  const without={...document,slides:document.slides.map(slide=>({...slide,chart:(({referenceLines:_lines,...chart})=>chart)(slide.chart)}))};
  assert.equal(referencesOf(without,index,{catalogs:[]}),undefined,`${source.language}: a title alone draws no reference`);
  const retitled={...document,slides:document.slides.map(slide=>({...slide,title:'x'.repeat(String(slide.title).length)}))};
  const before=referencesOf(document,index,{catalogs:[]}),after=referencesOf(retitled,index,{catalogs:[]});
  assert.deepEqual(after.lines.map(({x1,x2,y1,y2,value})=>({x1,x2,y1,y2,value})),before.lines.map(({x1,x2,y1,y2,value})=>({x1,x2,y1,y2,value})),`${source.language}: other title words leave the line where it is`);
 }
});
