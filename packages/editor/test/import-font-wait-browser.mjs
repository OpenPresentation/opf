import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const bundle=await build({stdin:{contents:`import {createEditorSession} from './src/index.js';import {installTransferControls} from './examples/transfer-controls.js';globalThis.importApi={createEditorSession,installTransferControls};`,resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser'});
const html=(await readFile(new URL('../examples/playground.html',import.meta.url),'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
const browser=await chromium.launch(process.env.OPF_BROWSER_EXECUTABLE_PATH?{executablePath:process.env.OPF_BROWSER_EXECUTABLE_PATH}:{});
try {
 const results=[];
 for(const action of ['source','transfer','action','slide','path','close','destroy','fast','async','error']) {
  const page=await browser.newPage();await page.route('**/*',r=>r.abort());await page.setContent(html);await page.addScriptTag({content:bundle.outputFiles[0].text});
  const row=await page.evaluate(async(action)=>{
   const editor=importApi.createEditorSession({slides:[{title:'Original'},{title:'Other'}]});let pending=false,slide=0,path,selected=0;
   const waiters=[],statuses=[];
   const fonts={pending:()=>pending?['fixture-face']:[],ensure:()=>new Promise((resolve,reject)=>waiters.push({resolve,reject}))};
   const ui=importApi.installTransferControls({editor,getCanvas:()=>undefined,getSlideIndex:()=>slide,getSelectedPath:()=>path,setSlideIndex:value=>{selected++;slide=value;},status:value=>statuses.push(value),galleries:[],fonts});
   ui.openImport('paste',JSON.stringify({slides:[{title:'Imported'}]}));
   const apply=document.getElementById('import-apply'),dialog=document.getElementById('import-dialog');
   if(apply.disabled)throw new Error('Real import preview did not become ready');
   pending=action!=='fast';apply.click();
   if(action!=='fast'&&waiters.length!==1)throw new Error('Apply did not enter font wait');
   if(action==='source')editor.set('slides.0.title','Concurrent edit');
   if(action==='transfer'){const input=document.getElementById('import-text');input.value=JSON.stringify({slides:[{title:'New transfer'}]});input.dispatchEvent(new Event('input'));}
   if(action==='action'){const field=document.getElementById('import-action');field.value='replace';field.dispatchEvent(new Event('change'));}
   if(action==='slide')slide=1;
   if(action==='path')path='slides.0.title';
   if(action==='close')dialog.close();
   if(action==='destroy')dialog.remove();
   const before=editor.snapshot();pending=false;
   for(const [index,w]of waiters.entries())if(action==='error'&&index===0)w.reject(new Error('fixture font failure'));else w.resolve();
   await new Promise(resolve=>setTimeout(resolve,0)); // Drain only the already-released host continuations.
   const after=editor.snapshot();let undo,redo;
   if(action==='fast'||action==='async'){editor.undo();undo=editor.presentation;editor.redo();redo=editor.presentation;}
   return {action,sameSnapshot:before===after,presentation:after.presentation,depth:after.undoDepth,selected,statuses,error:document.getElementById('import-error')?.textContent,undo,redo};
  },action);
  results.push(row);await page.close();
 }
 for(const row of results){
  if(row.action==='fast'||row.action==='async'){
   assert.equal(row.depth,1);assert.equal(row.selected,1);assert.equal(row.presentation.slides[1].title,'Imported');
   assert.deepEqual(row.undo,{slides:[{title:'Original'},{title:'Other'}]});assert.deepEqual(row.redo,row.presentation);assert.match(row.statuses[0],/^OPF imported/);
  }else{assert.equal(row.sameSnapshot,true,row.action);assert.equal(row.selected,0,row.action);assert.equal(row.statuses.length,0,row.action);if(row.action==='error')assert.match(row.error,/fixture font failure/);}
 }
 console.log(JSON.stringify(results));
}finally{await browser.close();}
