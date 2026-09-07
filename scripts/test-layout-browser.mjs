import {createCanvasEditor} from '../../opf-editor/src/canvas.js';
import {createEditorSession} from '../../opf-editor/src/index.js';
import {renderSvg} from '../../opf-render/src/svg.js';
const out=document.querySelector('#results'),host=document.querySelector('#canvas');let checks=0;
const check=(truth,message)=>{if(!truth)throw new Error(message);checks++;out.textContent+=`PASS ${message}\n`;};
const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const original={name:'Layout demo',slides:[{title:'Give the main idea room',composition:{mode:'row',weights:[2,1]},blocks:[{composition:{mode:'column'},blocks:[{text:'Recommendation: fund the next milestone.'},{text:'The implementation stays shared across browser preview and PowerPoint export.'}]},{text:'Context, constraints, and the next decision.'}]}]};
const editor=createEditorSession(original,{rejectInvalid:true});let errors=[],drafts=[],commits=0;
const canvas=createCanvasEditor(host,{editor,layoutEditing:true,onError:error=>errors.push(error.message),onDraft:value=>drafts.push(value),onCommit:()=>commits++});
const handle=(path='slides.0',boundary=0)=>[...host.querySelectorAll('[role=separator]')].find(node=>node.dataset.layoutPath===path&&node.dataset.layoutBoundary===String(boundary));
const key=(node,name,shift=false)=>node.dispatchEvent(new KeyboardEvent('keydown',{key:name,shiftKey:shift,bubbles:true}));
try{
 await canvas.ready;check(canvas.layoutEditing,'layout editing can start enabled');
 check(host.querySelectorAll('[role=separator]').length===2,'root and nested dividers are represented');
 check(handle().getAttribute('aria-orientation')==='vertical'&&handle('slides.0.blocks.0').getAttribute('aria-orientation')==='horizontal','divider orientation matches row and column flow');
 const title=editor.get('slides.0.title');key(handle(),'ArrowRight');
 check(editor.get('slides.0.composition.weights.0')>2,'arrow key widens the leading track');
 check(editor.get('slides.0.title')===title&&JSON.stringify(editor.get('slides.0.blocks'))===JSON.stringify(original.slides[0].blocks),'resizing preserves all content');
 check(drafts.length===1&&commits===1,'keyboard resize previews and commits once');
 const reference=document.createElement('div');reference.innerHTML=renderSvg(editor.document,{trace:true});
 const glyphs=container=>[...container.querySelectorAll('text')].map(n=>[n.textContent,n.getAttribute('x'),n.getAttribute('y'),n.getAttribute('font-size')]);
 check(JSON.stringify(glyphs(host))===JSON.stringify(glyphs(reference)),'resized canvas uses standalone renderer geometry');
 editor.undo();check(JSON.stringify(editor.document)===JSON.stringify(original)&&!editor.canUndo,'one undo restores the resize');
 key(handle('slides.0.blocks.0'),'ArrowDown',true);check(editor.get('slides.0.blocks.0.composition.weights.0')===1.1,'nested row sizing uses its own container');
 check(JSON.stringify(editor.get('slides.0.composition'))===JSON.stringify(original.slides[0].composition),'nested resize preserves parent weights');editor.undo();
 const auto={slides:[{composition:{mode:'auto'},blocks:[{text:'A'},{text:'B'},{text:'C'},{text:'D'}]}]};editor.applyPatch([{op:'replace',path:'',value:auto}]);
 check(!!handle(),'automatic flow exposes its chosen column boundary');key(handle(),'ArrowRight');check(editor.get('slides.0.composition.mode')==='grid','resizing automatic flow freezes a grid');editor.undo();
 editor.applyPatch([{op:'replace',path:'',value:original}]);
 canvas.beginEdit('slides.0.blocks.1.text');check(host.querySelectorAll('[role=separator]').length===0,'inline typing hides layout handles');canvas.cancel();
 check(host.querySelectorAll('[role=separator]').length===2,'leaving inline editing restores layout handles');
 check(canvas.setLayoutEditing(false)&&!host.querySelector('[role=separator]'),'layout handles can be hidden');canvas.setLayoutEditing(true);
 const strict=structuredClone(original);strict.slides[0].composition.overflow='error';editor.applyPatch([{op:'replace',path:'',value:strict}]);
 const beforeInvalid=JSON.stringify(editor.document);key(handle(),'End');check(JSON.stringify(editor.document)===beforeInvalid,'strict overflow rejects a resize without changing the document');check(errors.length===1,'strict overflow reports why the resize failed');errors=[];
 canvas.destroy();check(!host.children.length,'destroy removes layout controls');check(errors.length===0,'keyboard layout interactions have no errors');
 document.title=`PASS ${checks} layout browser checks`;out.textContent+=`\n${checks} checks passed\n`;
}catch(error){out.textContent+=`FAIL ${error.stack}`;document.title='FAIL layout browser checks';throw error;}
// Interactive, trusted-pointer specimen. Its controls verify the actual CUA drag separately.
let demoEditor, demo, pointerDrafts, before, triggered=false;
const reset=()=>{
 demo?.destroy();pointerDrafts=[];triggered=false;demoEditor=createEditorSession(original,{rejectInvalid:true});before=JSON.stringify(demoEditor.document);
 demo=createCanvasEditor(host,{editor:demoEditor,layoutEditing:true,onDraft:event=>{pointerDrafts.push(event);document.querySelector('#pointer-state').textContent=JSON.stringify({phase:'draft',unchanged:JSON.stringify(demoEditor.document)===before,weights:event.value.weights});
  if(!triggered){triggered=true;const mode=document.querySelector('#pointer-mode').value;
   if(mode==='cancel'){demo.cancel();check(JSON.stringify(demoEditor.document)===before&&!demoEditor.canUndo,'cancelling a trusted drag discards its draft');document.querySelector('#pointer-state').textContent='PASS cancelled pointer draft';}
   if(mode==='conflict'){demoEditor.set('slides.0.title','Newer external title');check(demoEditor.get('slides.0.title')==='Newer external title'&&JSON.stringify(demoEditor.get('slides.0.composition.weights'))==='[2,1]','concurrent container edits cancel the trusted drag');}
   if(mode==='independent')demoEditor.set('name','Independent edit');
  }
 },onCommit:()=>{document.querySelector('#pointer-state').textContent=JSON.stringify({phase:'committed',weights:demoEditor.get('slides.0.composition.weights')});},onCancel:()=>{document.querySelector('#pointer-state').textContent='cancelled';},onError:error=>{document.querySelector('#pointer-state').textContent=error.message;}});
};
reset();document.querySelector('#reset').onclick=reset;
document.querySelector('#verify').onclick=()=>{
 try{if(document.querySelector('#pointer-mode').value==='independent'){check(demoEditor.get('name')==='Independent edit'&&demoEditor.get('slides.0.composition.weights.0')!==2,'unrelated edits survive a trusted drag');demoEditor.undo();check(demoEditor.get('name')==='Independent edit'&&JSON.stringify(demoEditor.get('slides.0.composition.weights'))==='[2,1]','undo only reverts the resize after an unrelated edit');document.querySelector('#pointer-state').textContent='PASS independent update';return;}
 check(pointerDrafts.length>0,'trusted pointer movement created live drafts');check(JSON.stringify(demoEditor.document)!==before,'trusted pointer drag committed a resize');demoEditor.undo();check(JSON.stringify(demoEditor.document)===before&&!demoEditor.canUndo,'entire trusted pointer drag is one undo step');document.querySelector('#pointer-state').textContent='PASS trusted pointer resize';}catch(error){document.querySelector('#pointer-state').textContent='FAIL '+error.message;}
};
document.querySelector('#external').onclick=()=>demoEditor.set('slides.0.title','Newer external title');
document.querySelector('#independent').onclick=()=>demoEditor.set('name','Independent edit');
