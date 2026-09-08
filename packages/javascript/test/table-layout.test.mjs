import assert from 'node:assert/strict';
import test from 'node:test';
import {layoutTable,composeSlide} from '../dist/composition.js';
import {paginateSlide} from '../dist/pagination.js';
const measurement={measure:(text,size,style)=>[...text].length*size*(style.fontWeight>=600?.6:.5)};
const box={x:10,y:20,width:640,height:500};

test('short table rows preserve baseline geometry and missing cells',()=>{
 const table={columns:['A','B'],rows:[[1,true],[null]]};
 const geometry=layoutTable(table,box,{path:'slides.0.table',textMeasurement:measurement});
 assert.equal(geometry.overflow,false);
 assert.deepEqual(geometry.rows.map(row=>row.box.height),[54,54,54]);
 assert.equal(geometry.height,162);
 assert.deepEqual(geometry.rows[2].cells[1].textBox,{x:340,y:136,width:300,height:42});
 assert.equal(geometry.rows[0].cells[1].path,'slides.0.table.columns.1');
 assert.equal(geometry.rows[2].cells[1].path,'slides.0.table.rows.1.1');
});

test('wrapped and rich multiline rows grow into available space',()=>{
 const table={columns:['A','B'],rows:[['Short','one'],[['\nStart\n',{text:'\nEnd\n',bold:true}],[]],['word '.repeat(24),'wrapped']]};
 const before=structuredClone(table),geometry=layoutTable(table,box,{textMeasurement:measurement});
 assert.equal(geometry.overflow,false);
 assert.equal(geometry.rows[0].box.height,54);
 assert.equal(geometry.rows[1].box.height,54);
 assert.ok(geometry.rows[2].box.height>100);
 assert.ok(geometry.rows[3].box.height>54);
 assert.ok(geometry.height<=box.height);
 for(const row of geometry.rows) for(const cell of row.cells){
  const height='height' in cell.fit?cell.fit.height:cell.fit.lines.length*cell.fit.lineHeight;
  assert.ok(height<=cell.textBox.height+.01);
  assert.ok(cell.textBox.y+height<=row.box.y+row.box.height+.01);
 }
 assert.deepEqual(table,before);
 assert.ok(!composeSlide({table},{textMeasurement:measurement}).diagnostics.some(d=>d.code==='text-overflow'));
});

test('constrained tables consume spare row height before reporting real overflow',()=>{
 const table={rows:[['short'],[['a\nb\nc\nd\ne']]]};
 const geometry=layoutTable(table,{...box,height:150},{textMeasurement:measurement});
 assert.equal(geometry.overflow,false);
 assert.ok(geometry.rows[0].box.height<54);
 assert.ok(geometry.rows[1].box.height>90);
 assert.ok(Math.abs(geometry.height-150)<.001);
 assert.equal(layoutTable(table,{...box,height:50},{textMeasurement:measurement}).overflow,true);
 const scaled=layoutTable(table,{x:5,y:10,width:320,height:250},{scale:.5,textMeasurement:measurement});
 const full=layoutTable(table,box,{textMeasurement:measurement});
 assert.deepEqual(scaled.rows.map(row=>row.box.height*2),full.rows.map(row=>row.box.height));
});

test('readability settings and mixed-font metrics govern row fitting',()=>{
 const table={rows:[[[{text:'LARGE\nTEXT',fontSize:36,fontFamily:'Wide'}]],['short']]};
 const fontMetrics={measure:(text,size,style)=>text.length*size*(style.fontFamily==='Wide'?1:.4)};
 const large=layoutTable(table,box,{textMeasurement:fontMetrics});
 assert.ok(large.rows[0].box.height>100);
 assert.equal(large.overflow,false);
 const constrained=layoutTable(table,{...box,height:110},{minFontSize:8,textMeasurement:fontMetrics});
 assert.equal(constrained.overflow,false);
 assert.ok(constrained.rows[0].cells[0].fit.fontSize<15);
 assert.equal(layoutTable(table,{...box,height:110},{minFontSize:15,textMeasurement:fontMetrics}).overflow,true);
});

test('pagination retains complete multiline rows and repeated headers',()=>{
 const table={columns:[['Rich ',{text:'header',bold:true}],'Index'],rows:Array.from({length:30},(_,i)=>[[{text:`Row ${i}\nDetail\nMore`,bold:true}],i])};
 const result=paginateSlide({table},{textMeasurement:measurement});
 assert.ok(result.slides.length>1);
 assert.deepEqual(result.slides.flatMap(slide=>slide.table.rows),table.rows);
 for(const slide of result.slides){assert.deepEqual(slide.table.columns,table.columns);assert.equal(composeSlide(slide,{textMeasurement:measurement}).diagnostics.length,0);}
});

test('mixed-size table paragraphs reserve the native uniform line spacing',()=>{
 const table={rows:[[[{text:'Large\n',fontSize:30},'small\nsmall']]]};
 const cell=layoutTable(table,box,{textMeasurement:measurement}).rows[0].cells[0];
 assert.ok('richLines' in cell.fit);
 assert.equal(new Set(cell.fit.richLines.map(line=>line.height)).size,1);
 assert.ok(Math.abs(cell.fit.height-cell.fit.lines.length*cell.fit.lineHeight)<.001);
 assert.ok(cell.fit.height<=cell.textBox.height);
});
