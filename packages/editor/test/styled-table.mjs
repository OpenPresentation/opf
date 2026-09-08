import assert from 'node:assert/strict';
import {createEditorSession} from '../dist/index.js';
import {getEditableFields,createCanvasDraft} from '../dist/canvas-fields.js';
import {formatRichTextRange,updateRichTextInput,richTextContent} from '../dist/rich-text.js';

const rich=['A ',{text:'bold',bold:true,color:'#123456'}];
const source={slides:[{table:{columns:['A','B','C'],rows:[
 [{value:rich,colSpan:2,rowSpan:2,style:{fill:'#DBEAFE',align:'center'}},null,'C'],
 [null,null,'D'],['E','F',{value:[],style:{fill:'#FFFFFF'}}]
]}}]};
const before=structuredClone(source),editor=createEditorSession(source,{rejectInvalid:true});
const path='slides.0.table.rows.0.0',valuePath=path+'.value';
editor.set(valuePath,updateRichTextInput(rich,'A bold!'));
assert.equal(richTextContent(editor.get(valuePath)),'A bold!');
assert.deepEqual(editor.get(path+'.style'),source.slides[0].table.rows[0][0].style);
assert.equal(editor.get(path+'.rowSpan'),2);assert.equal(editor.get(path+'.colSpan'),2);
editor.undo();assert.deepEqual(editor.document,before);
editor.set(valuePath,formatRichTextRange(rich,0,1,{italic:true}));
assert.equal(editor.get(valuePath)[0].italic,true);assert.equal(editor.get(valuePath).find(run=>typeof run==='object'&&run.bold)?.color,'#123456');
editor.undo();assert.deepEqual(editor.document,before);
editor.set(path+'.style.fill','#12345680');assert.equal(editor.get(path+'.style.fill'),'#12345680');
editor.undo();assert.deepEqual(editor.document,before);

const fields=getEditableFields(source.slides[0].table,'slides.0.table').fields;
for(const expected of ['/slides/0/table/rows/0/0/value/1/text','/slides/0/table/rows/0/0/style/fill','/slides/0/table/rows/0/0/rowSpan'])assert.ok(fields.some(field=>field.path===expected),expected);
assert.equal(fields.find(field=>field.path==='/slides/0/table/rows/1/0').type,'null');
for(const edit of [
 ()=>editor.set('slides.0.table.rows.1.0','Would hide content'),
 ()=>editor.set(path+'.rowSpan',99),
 ()=>editor.set(path+'.style.fill','not-a-color'),
 ()=>editor.applyPatch([{op:'remove',path:'/slides/0/table/rows/1'}]),
 ()=>createCanvasDraft(editor.document,'slides.0.table.rows.1.0','Would hide content'),
]){
 assert.throws(edit);assert.deepEqual(editor.document,before);assert.equal(editor.canUndo,false,'Rejected edits do not consume history');
}
editor.applyPatch([{op:'replace',path:'/slides/0/table/rows/0/0/rowSpan',value:1},{op:'remove',path:'/slides/0/table/rows/1'}]);
assert.equal(editor.get('slides.0.table.rows').length,2);assert.equal(editor.canUndo,true);
editor.undo();assert.deepEqual(editor.document,before,'A valid structural change is one undo operation');
editor.set('slides.0.table.rows.2.2.value',updateRichTextInput([],'New text'));
assert.equal(richTextContent(editor.get('slides.0.table.rows.2.2.value')),'New text');
assert.equal(editor.get('slides.0.table.rows.2.2.style.fill'),'#FFFFFF');
editor.undo();assert.deepEqual(editor.document,before);assert.deepEqual(source,before);
console.log('Styled table editor model passed: value-path typing/formatting, styles/spans, empty cells, properties, guarded structural edits and atomic undo.');
