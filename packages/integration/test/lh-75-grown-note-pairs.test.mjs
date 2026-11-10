// LH-75: actual shipped-route fonts grow both retained b15 pairs, preserving complete words/data and native note sizes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {convert, resolveSlideContext} from '@openpresentation/opf';
import {composeSlide, layoutTable} from '@openpresentation/opf/composition';
import {gallery} from '@openpresentation/gallery';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {fromPptx} from '@openpresentation/opf-pptx';
const original=JSON.parse(fs.readFileSync(new URL('./fixtures/lh-75-grown-note-pairs.opf.json',import.meta.url),'utf8'));
const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:original});
for(const source of original.slides)test('LH-75 '+source.id+': larger whole-word cells, readable note and matching native conversion',async()=>{
 const document={...original,slides:[source]},context=resolveSlideContext(document,0,{catalogs:[gallery],fonts}),geometry=composeSlide(context.slide,context.options),table=geometry.items.find(item=>item.field==='table'),note=geometry.items.find(item=>item.field==='text');
 assert.equal(note.text.fontSize,32,'original 28px note advances one type step');
 assert.ok(table.tableGrowth>1.14,'cells grow with the note');
 assert.ok(note.frameBox && table.box.x+table.box.width<=note.frameBox.x+1,'pair stays side by side');
 assert.ok(note.frameBox.height<=.75*geometry.contentBox.height+.001,'grown row keeps the remaining quarter of the body free');
 assert.ok(note.text.lines.every(line=>line.trim().length<=70),'note keeps its measure');
 const layout=layoutTable(table.value,table.box,{fontFamily:context.options.fontFamilies.body,textMeasurement:context.options.textMeasurement,growth:table.tableGrowth,minFontSize:table.composition.minFontSize});
 assert.equal(Math.max(...layout.rows.flatMap(row=>row.cells.map(cell=>cell.fit.lines.length))),3,'three whole-word lines permit larger type');
 assert.ok(!layout.overflow && !layout.splitsWords);
 assert.ok(layout.rows.every(row=>row.cells.every(cell=>cell.fit.fontSize>28.7)),'every table cell exceeds the original 25px role');
 for(const[rowIndex,row]of layout.rows.entries())for(const[column,cell]of row.cells.entries()){
  const expected=rowIndex===0?source.blocks[0].table.columns[column]:source.blocks[0].table.rows[rowIndex-1][column];
  assert.equal(cell.fit.lines.join('').trim(),String(expected),'every cell word remains whole and complete');
 }
 const capped=composeSlide({...context.slide,composition:{maxFontSize:28}},context.options),cappedNote=capped.items.find(item=>item.field==='text');
 assert.equal(cappedNote.text.fontSize,28,'authored maximum still caps the note; tables intentionally keep their own sizes');
 assert.deepEqual(geometry.diagnostics,[]);
 const svg=await convert(document,{format:'svg',fonts,catalogs:[gallery],date:'2026-11-08'}),pptx=await convert(document,{format:'pptx',fonts,catalogs:[gallery],date:'2026-11-08'});
 assert.equal(svg.files.length,1);assert.equal(pptx.files.length,1);
 assert.ok(![...svg.findings,...pptx.findings].some(finding=>finding.severity==='error'));
 const imported=await fromPptx(pptx.files[0].bytes,{signals:true,catalogs:[gallery]});
 assert.deepEqual(imported.presentation.slides[0].blocks,source.blocks,'all table data and note text survive native import');
 const runs=imported.signals.slides[0].shapes.filter(shape=>shape.opf?.path?.startsWith('slides.0.blocks.1')||shape.name?.includes('slides.0.blocks.1.text')).flatMap(shape=>shape.text?.paragraphs.flatMap(paragraph=>paragraph.runs)??[]);
 assert.ok(runs.length>0,'native note runs are inspected');assert.ok(runs.every(run=>run.size===24),'native note remains 24pt = 32px, no shrink');
});
