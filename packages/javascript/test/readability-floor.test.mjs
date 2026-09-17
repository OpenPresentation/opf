import assert from 'node:assert/strict';
import test from 'node:test';
import {fitText,fitRichText,fitList,layoutTable,composeSlide} from '../dist/composition.js';
import {paginateSlide} from '../dist/pagination.js';
const box={x:10,y:20,width:1000,height:1800},style={fontFamily:'Test',fontWeight:400};
const measurement={measure:(text,size)=>[...text].length*size*.5};
const outline={...measurement,outlineBounds:(text,size)=>text.trim()?{x:0,y:-size,width:measurement.measure(text,size),height:size}:null};
const glyphs=fit=>fit.richLines.flatMap(line=>line.fragments);
const readable=(size,floor)=>assert.ok(size+1e-9>=floor,`${size} is below selected floor ${floor}`);

test('plain, rich, list description, marker and table glyphs honor selected floors',()=>{
  const rich=['Normal ',{text:'small',fontSize:9,bold:true},' x',{text:'2',superscript:true}];
  const items=[{text:rich,description:['Description ',{text:'small',fontSize:8,italic:true}],level:1}];
  const table={rows:[['Plain cell',rich]]};
  const source=structuredClone({rich,items,table});
  for(const floor of [8,16,24,32]) {
    const plain=fitText('Plain text',box,25,floor,measurement.measure);assert.equal(plain.overflow,false);readable(plain.fontSize,floor);
    const formatted=fitRichText(rich,box,25,floor,{style,textMeasurement:measurement});assert.equal(formatted.overflow,false);
    for(const part of glyphs(formatted))readable(part.fontSize,floor);
    const list=fitList(items,box,25,floor,{style,textMeasurement:measurement});assert.equal(list.overflow,false);
    for(const entry of list.listEntries){readable(entry.marker.fontSize,floor);for(const fit of [entry.text,entry.description])for(const part of glyphs(fit))readable(part.fontSize,floor);}
    const cells=layoutTable(table,box,{minFontSize:floor,textMeasurement:measurement});assert.equal(cells.overflow,false);
    for(const cell of cells.rows.flatMap(row=>row.cells))if(cell.rich){for(const part of glyphs(cell.fit))readable(part.fontSize,floor);}else readable(cell.fit.fontSize,floor);
    const scripts=glyphs(formatted);assert.ok(scripts.find(p=>p.run.superscript).baselineShift<0);
    const normal=scripts.find(p=>p.text==='Normal '),small=scripts.find(p=>p.run.fontSize===9);
    assert.ok(Math.abs(small.fontSize/normal.fontSize-12/25)<1e-12,'Fitting preserves authored size ratios');
  }
  const alreadyReadable=layoutTable({rows:[[[{text:'Explicit 18pt',fontSize:18},' normal']]]},box,{minFontSize:16,textMeasurement:measurement});
  assert.equal(glyphs(alreadyReadable.rows[0].cells[0].fit)[0].fontSize,24,'Resolving the implicit table base floor must not enlarge an already readable point size');
  assert.deepEqual({rich,items,table},source);
});

test('short headings and nested content use the scaled floor with or without outlines',()=>{
  const source={tag:'Tag',title:'Title',composition:{minFontSize:32,overflow:'error'},blocks:[{composition:{mode:'column'},blocks:[{text:'Short body'}]}]};
  for(const textMeasurement of [undefined,measurement,outline])for(const [width,height]of [[1280,720],[720,1280],[640,360]]) {
    const fit=composeSlide(source,{width,height,textMeasurement});assert.deepEqual(fit.diagnostics,[]);
    for(const item of fit.items)readable(item.text.fontSize,32*Math.min(width,height)/720);
    assert.ok(fit.items[0].box.height>=fit.items[0].text.lineHeight);
  }
  assert.equal(source.blocks[0].composition.minFontSize,undefined,'Inherited policy must not mutate source');
});

test('irreducible content reports overflow and bounded fitting always evaluates the floor',()=>{
  for(const kind of ['plain','rich','list']) {
    const sizes=new Set(),measure=(text,size)=>{sizes.add(size);assert.ok(sizes.size<=65,'Fitting exceeded 65 trials');return [...text].length*size;};
    const small={x:0,y:0,width:1,height:1},options={style,textMeasurement:{measure}};
    const fit=kind==='plain'?fitText('x',small,1000,32,measure):kind==='rich'?fitRichText(['x'],small,1000,32,options):fitList(['x'],small,1000,32,options);
    assert.equal(fit.overflow,true);assert.equal(fit.fontSize,32);assert.ok(sizes.has(32));
  }
  assert.throws(()=>composeSlide({composition:{minFontSize:32,overflow:'error'},text:'Too much source. '.repeat(800)}),{code:'layout-overflow'});
});

test('pagination retains source and enforces the selected floor on table cells and descriptions',()=>{
  const items=Array.from({length:20},(_,i)=>({text:`Item ${i}`,description:'Every word survives.'}));
  const result=paginateSlide({items},{minFontSize:32,textMeasurement:measurement});
  assert.deepEqual(result.slides.flatMap(slide=>slide.items),items);
  for(const slide of result.slides)for(const entry of composeSlide(slide,{textMeasurement:measurement}).items[0].text.listEntries)
    for(const part of [...glyphs(entry.text),...glyphs(entry.description)])readable(part.fontSize,32);
  const table={columns:['Header'],rows:Array.from({length:25},(_,i)=>[`Row ${i}`])};
  const tables=paginateSlide({table},{minFontSize:32,textMeasurement:measurement});
  assert.deepEqual(tables.slides.flatMap(slide=>slide.table.rows),table.rows);
  for(const slide of tables.slides) {
    const geometry=composeSlide(slide,{textMeasurement:measurement}),item=geometry.items[0];assert.deepEqual(geometry.diagnostics,[]);
    for(const cell of layoutTable(item.value,item.box,{minFontSize:32,textMeasurement:measurement}).rows.flatMap(row=>row.cells))readable(cell.fit.fontSize,32);
  }
});
