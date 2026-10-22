import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright';

const bundle = await build({stdin:{contents:`import {createEditorSession} from './src/index.js'; import {createDesignControls} from './src/design-controls.js'; globalThis.uploadApi={createEditorSession,createDesignControls};`,resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser'});
const browser = await chromium.launch(process.env.OPF_BROWSER_EXECUTABLE_PATH ? {executablePath:process.env.OPF_BROWSER_EXECUTABLE_PATH} : {});
try {
  const page = await browser.newPage();
  await page.setContent('<main></main>');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const results = await page.evaluate(async () => {
    const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
    const results=[];
    for (const action of ['navigate','replace','edit','form-input','form-change','destroy','new-upload','embedded','host-asset']) {
      const root=document.querySelector('main');root.replaceChildren();
      const editor=uploadApi.createEditorSession({slides:[{title:'Original'},{title:'Other'}]});
      let slide=0,finish,entered,terminal;
      const began=new Promise(resolve=>entered=resolve),done=new Promise(resolve=>terminal=resolve);
      const statuses=[];
      const panel=uploadApi.createDesignControls(root,{editor,sections:['background'],scope:'slide',getSlideIndex:()=>slide,
        onStatus:(message,details)=>{statuses.push({message,...details});terminal();},
        ...(action==='embedded'?{}:{onAddAsset:async()=>{entered();await new Promise(resolve=>finish=resolve);if(action==='host-asset'){editor.set('assets',{host:{src:'data:image/png;base64,'+btoa(String.fromCharCode(...bytes)),mediaType:'image/png'}});return 'asset:host';}return 'https://example.invalid/uploaded.png';}})});
      const file=()=>new File([bytes],'image.png',{type:'image/png'});
      const input=panel.element.querySelector('input[type=file]');
      const start=(selected)=>{Object.defineProperty(input,'files',{value:[selected],configurable:true});input.dispatchEvent(new Event('change',{bubbles:true}));};
      start(file());
      if(action!=='embedded')await began;
      if(action==='navigate'){slide=1;panel.refresh();}
      if(action==='replace')editor.set('slides.0',{title:'Replacement'});
      if(action==='edit')editor.set('slides.1.title','Unrelated edit');
      if(action==='form-input'||action==='form-change'){
        const fit=panel.element.querySelector('select[id*="-bg-fit-"]');fit.value='contain';fit.dispatchEvent(new Event(action==='form-input'?'input':'change',{bubbles:true}));
      }
      if(action==='destroy')panel.destroy();
      const before=editor.snapshot();
      if(action==='new-upload'){
        // A newer invalid file still cancels the previous target before its read finishes.
        start(new File(['bad'],'bad.png',{type:'image/png'}));await done;
      }
      if(action!=='embedded')finish();
      if(action==='destroy'||action==='new-upload'){
        // Drain the known resolved host continuation (no timers used to make a race pass).
        await new Promise(resolve=>setTimeout(resolve,0));
      }else await done;
      const after=editor.snapshot();
      const success=action==='embedded'||action==='host-asset';
      let undo;
      if(success){editor.undo();undo=editor.presentation;editor.redo();}
      results.push({action,sameSnapshot:before===after,presentation:editor.presentation,depth:after.undoDepth,statuses,undo});
      panel.destroy();
    }
    return results;
  });
  console.log(JSON.stringify(results));
  for(const row of results){
    if(row.action==='embedded'||row.action==='host-asset'){
      assert.equal(row.presentation.slides[0].design.background.src,row.action==='embedded'?'asset:image':'asset:host',row.action);
      assert.equal(row.presentation.slides[1].design?.background,undefined);
      assert.equal(row.presentation.slides[0].design.background.fit,'cover');
      assert.equal(row.depth,row.action==='embedded'?1:2);
      assert.equal(row.undo.slides[0].design?.background,undefined);
      assert.equal(!!row.undo.assets,row.action==='host-asset','host-owned registration remains a separate edit');
      assert.equal(row.statuses.at(-1).error,false);
    }else{
      assert.equal(row.sameSnapshot,true,row.action);
      assert.equal(row.presentation.assets,undefined,row.action);
      assert.ok(row.presentation.slides.every(slide=>!slide.design?.background),row.action);
      if(row.action!=='destroy')assert.equal(row.statuses.at(-1).error,true,row.action);
      else assert.deepEqual(row.statuses,[]);
    }
  }
} finally {await browser.close();}
