import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const bundle=await build({stdin:{contents:`import {createEditorSession} from './src/index.js';import {createImageCropper} from './src/image-cropper.js';globalThis.cropApi={createEditorSession,createImageCropper};`,resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser'});
const browser=await chromium.launch(process.env.OPF_BROWSER_EXECUTABLE_PATH?{executablePath:process.env.OPF_BROWSER_EXECUTABLE_PATH}:{});
try {
 const page=await browser.newPage();await page.setContent('<main style="position:relative;width:600px;height:600px"></main>');await page.addScriptTag({content:bundle.outputFiles[0].text});
 const results=await page.evaluate(async()=>{
  const png=document.createElement('canvas');png.width=32;png.height=32;png.getContext('2d').fillRect(0,0,32,32);const src=png.toDataURL();
  const original=HTMLCanvasElement.prototype.toBlob;const results=[];
  try {for(const action of ['cancel','destroy','replace','before-apply','success']) {
   const root=document.querySelector('main');root.replaceChildren();
   const editor=cropApi.createEditorSession({slides:[{image:src}]});let finish;
   const cropper=cropApi.createImageCropper(root,root,{editor,fullscreen:false});
   await cropper.open('slides.0.image');
   const width=root.querySelector('input[aria-label="Width"]');width.value='16';width.dispatchEvent(new Event('change'));
   HTMLCanvasElement.prototype.toBlob=function(callback,...args){finish=()=>original.call(this,callback,...args);};
   if(action==='before-apply')editor.set('slides.0.image','replacement.png');
   const initial=editor.snapshot();
   root.querySelector('.opf-crop-apply').click();
   if(action==='before-apply'){results.push({action,sameSnapshot:editor.snapshot()===initial,assets:!!editor.get('assets'),error:root.querySelector('.opf-crop-error')?.textContent});cropper.destroy();continue;}
   if(!finish)throw new Error('Crop did not reach actual canvas encoding');
   if(action==='cancel')cropper.cancel();if(action==='destroy')cropper.destroy();if(action==='replace')editor.set('slides.0.image','replacement.png');
   const before=editor.snapshot();finish();
   await new Promise(resolve=>setTimeout(resolve,80));
   results.push({action,sameSnapshot:editor.snapshot()===before,image:editor.get('slides.0.image'),assets:!!editor.get('assets'),undo:editor.snapshot().undoDepth,error:root.querySelector('.opf-crop-error')?.textContent});
   cropper.destroy();
  }}finally{HTMLCanvasElement.prototype.toBlob=original;}
  return results;
 });
 for(const row of results)if(row.action==='success'){assert.equal(row.assets,true);assert.equal(row.undo,1);}else{assert.equal(row.sameSnapshot,true,row.action);assert.equal(row.assets,false,row.action);}
 console.log(JSON.stringify(results));
}finally{await browser.close();}
