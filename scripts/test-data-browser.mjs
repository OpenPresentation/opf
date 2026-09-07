import {installDataControls} from '../../opf-editor/examples/data-controls.js';
import {createEditorSession} from '../../opf-editor/src/index.js';
const results=document.querySelector('#results');let count=0;
const check=(condition,message)=>{if(!condition)throw new Error(message);count++;};
const base={slides:[{id:'start',title:'Existing',notes:'Keep me',table:{columns:['A','B'],rows:[['original',1]]}}]};
const editor=createEditorSession(base);let slideIndex=0,path='slides.0.table.rows.0.0';
const controls=installDataControls({editor,getCanvas:()=>null,getSlideIndex:()=>slideIndex,getSelectedPath:()=>path,setSlideIndex:value=>{slideIndex=value;},status:()=>{},renderOptions:{}});
const $=id=>document.getElementById(id),change=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new Event(id==='data-text'?'input':'change'));};
try{
 $('import-data').click();change('data-text','Q,R,C\nA,12,3\nB,18,4');
 check(!$('data-apply').disabled,'CSV table preview failed');check($('data-grid').textContent.includes('12'),'Preview missing values');
 $('data-apply').click();check(editor.document.slides.length===2,'Table insert failed');check(editor.document.slides[1].table.rows[0][1]==='12','Table text not preserved');
 editor.undo();slideIndex=0;check(JSON.stringify(editor.document)===JSON.stringify(base),'Undo failed');
 $('import-data').click();change('data-as','chart');check($('data-preview').textContent.includes('C'),'Second series missing');$('data-apply').click();
 check(editor.document.slides[1].chart.data.rows[0][1]===12,'Chart numeric conversion failed');editor.undo();slideIndex=0;
 $('import-data').click();change('data-text','Q,R\nA,not-a-number');check($('data-apply').disabled,'Invalid chart enabled');check($('data-error').textContent.includes('numeric'),'Missing data error');
 change('data-as','table');change('data-format','json');change('data-text','[{"Region":"West","Amount":32}]');change('data-destination','selection');$('data-apply').click();
 check(editor.document.slides[0].table.rows[0][1]===32,'JSON table replacement failed');check(editor.document.slides[0].notes==='Keep me','Metadata lost');editor.undo();
 $('import-data').click();change('data-destination','insert');
 const transfer=new DataTransfer();transfer.items.add(new File(['Q,V\nA,5'],'upload.csv',{type:'text/csv'}));$('data-file').files=transfer.files;await $('data-file').onchange();
 check($('data-format').value==='csv','File format not detected');check($('data-text').value.includes('A,5'),'File contents not loaded');$('data-apply').click();check(editor.document.slides[1].table.rows[0][1]==='5','File import failed');
 controls.destroy();check(!$('data-dialog'),'Controls not disposed');results.textContent=`PASS: ${count} browser data-import checks`;
}catch(error){results.textContent='FAIL: '+error.stack;throw error;}
