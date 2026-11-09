// Complete localized references pass through the maintained SVG/PPTX file API with one prepared font provider.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {convert, resolveSlideContext, validate} from '@openpresentation/opf';
import {composeSlide} from '@openpresentation/opf/composition';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {fromPptx} from '@openpresentation/opf-pptx';
const document=JSON.parse(fs.readFileSync(new URL('../../../examples/technical/localized-chart-references.opf.json',import.meta.url),'utf8'));
test('LH-110: standalone seven-language example uses the same located reference geometry in SVG and native PPTX',async()=>{
 const validation=validate(document,{catalogs:[]});assert.equal(validation.schemaValid,true);assert.ok(!validation.findings.some(f=>f.code==='unresolved-reference'),'standalone catalog records are complete');
 const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:document});
 const svg=await convert(document,{format:'svg',fonts,catalogs:[],date:'2026-11-08'}),native=await convert(document,{format:'pptx',fonts,catalogs:[],date:'2026-11-08'});
 assert.equal(svg.files.length,7);assert.equal(native.files.length,1);
 const imported=await fromPptx(native.files[0].bytes,{signals:true,catalogs:[]});assert.equal(imported.presentation.slides.length,7);
 for(const[index,source]of document.slides.entries()){
  const context=resolveSlideContext(document,index,{fonts,catalogs:[]}),geometry=composeSlide(context.slide,context.options),refs=geometry.items.find(item=>item.field==='chart').chart.layer.references;
  assert.equal(refs.lines.length,1,source.language);assert.equal(refs.lines[0].value,.92);assert.equal(refs.lines[0].text,'92%');assert.deepEqual(refs.bands.map(b=>b.row),[2]);
  const text=new TextDecoder().decode(svg.files[index].bytes);assert.ok(text.includes('92%'),'SVG draws target label');
  const shapes=imported.signals.slides[index].shapes,band=shapes.filter(s=>/ mark under \d+ band$/.test(s.name)),line=shapes.filter(s=>/ mark over \d+ reference$/.test(s.name)),labels=shapes.filter(s=>/ mark over \d+ reference-label$/.test(s.name));
  assert.equal(band.length,1);assert.equal(line.length,1);assert.equal(labels.length,1);
  const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<.0002,`${source.language}: ${label}: ${actual} vs ${expected}`);
  for(const[key,field]of [['x','x'],['y','y'],['w','width'],['h','height']])near(band[0].box.emu[key]/9525,refs.bands[0].box[field],`band ${key}`);
  near(line[0].box.emu.x/9525,refs.lines[0].x1,'line start');near(line[0].box.emu.y/9525,refs.lines[0].y,'line height');near(line[0].box.emu.w/9525,refs.lines[0].x2-refs.lines[0].x1,'line width');
  assert.deepEqual(labels[0].text.paragraphs.flatMap(p=>p.runs.map(r=>r.text)).join(''),'92%');
  assert.deepEqual(imported.presentation.slides[index].chart.data,source.chart.data,'all original chart values/columns survive');
 }
});
