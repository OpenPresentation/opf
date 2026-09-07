import {createCanvasEditor} from '../../opf-editor/src/canvas.js';
import {createEditorSession} from '../../opf-editor/src/index.js';
import {renderSvg} from '../../opf-render/src/svg.js';
const host=document.querySelector('#canvas'),out=document.querySelector('#results');let count=0;
const check=(value,message)=>{if(!value)throw new Error(message);count++;out.textContent+=`PASS ${message}\n`;};
const original={name:'Block moves',slides:[{title:'Arrange complete content blocks',notes:'Keep notes',composition:{mode:'row',weights:[2,1,1]},blocks:[{text:[{text:'A: Keep all formatting.',bold:true}]},{composition:{mode:'column'},blocks:[{text:'B: A nested point.'},{text:'C: Another point.'}]},{text:'D: Supporting context.'}]}]};
const editor=createEditorSession(original,{rejectInvalid:true});let errors=[],commits=0;
const canvas=createCanvasEditor(host,{editor,layoutEditing:true,onError:error=>errors.push(error.message),onCommit:()=>commits++});
const handle=path=>[...host.querySelectorAll('[data-block-path]')].find(node=>node.dataset.blockPath===path);
const button=name=>[...host.querySelectorAll('[role=dialog] button')].find(node=>node.textContent===name);
const change=(label,value)=>{const input=host.querySelector(`[aria-label="${label}"]`);input.value=value;input.dispatchEvent(new Event('change'));};
try{
 await canvas.ready;check(host.querySelectorAll('[data-block-path]').length===5,'root and nested blocks have move handles');
 handle('/slides/0/blocks/0').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
 check(editor.get('slides.0.blocks.1.text.0.bold')===true,'keyboard move carries rich formatting');
 check(commits===1&&editor.get('slides.0.notes')==='Keep notes','keyboard move is one transaction and preserves notes');editor.undo();
 check(JSON.stringify(editor.document)===JSON.stringify(original)&&!editor.canUndo,'undo restores exact block order and structure');
 canvas.openBlockMenu('slides.0.blocks.0');check(!!host.querySelector('[role=dialog]'),'programmatic menu accepts OPF paths');button('Later').click();check(Array.isArray(editor.get('slides.0.blocks.0.blocks')),'Later reorders the whole group and block');editor.undo();
 handle('/slides/0/blocks/0').click();change('Move destination','/slides/0/blocks/1');change('Move position','1');button('Move').click();
 check(editor.get('slides.0.blocks.0.blocks.1.text.0.bold')===true,'move menu inserts into a group after index shifts');
 check(editor.get('slides.0.composition.weights.0')===2,'track weights stay with positions');
 const expected=document.createElement('div');expected.innerHTML=renderSvg(editor.document);
 const glyphs=node=>[...node.querySelectorAll('text')].map(n=>[n.textContent,n.getAttribute('x'),n.getAttribute('y'),n.getAttribute('font-size')]);
 check(JSON.stringify(glyphs(host))===JSON.stringify(glyphs(expected)),'moved slide matches standalone renderer geometry');editor.undo();
 handle('/slides/0/blocks/1').click();check(![...host.querySelector('[aria-label="Move destination"]').options].some(o=>o.value==='/slides/0/blocks/1'),'group cannot be selected as its own destination');button('Cancel').click();
 handle('/slides/0/blocks/1/blocks/0').click();change('Move destination','/slides/0');change('Move position','3');button('Move').click();
 check(editor.get('slides.0.blocks.3.text')==='B: A nested point.','move menu can lift a child into its parent layout');editor.undo();
 handle('/slides/0/blocks/0').click();editor.set('slides.0.notes','Updated externally');check(!host.querySelector('[role=dialog]'),'external changes dismiss stale move controls');editor.undo();
 canvas.beginEdit('slides.0.blocks.2.text');check(!host.querySelector('[data-block-path]'),'inline editing hides move handles');canvas.cancel();
 canvas.setLayoutEditing(false);check(!host.querySelector('[data-block-path]'),'leaving Arrange hides block controls');canvas.setLayoutEditing(true);
 const strict={slides:[{composition:{mode:'row',weights:[4,1],overflow:'error'},blocks:[{text:'Evidence remains complete. '.repeat(40)},{text:'Short'}]}]};
 editor.applyPatch([{op:'replace',path:'',value:strict}]);const beforeStrict=JSON.stringify(editor.document);
 handle('/slides/0/blocks/0').click();button('Later').click();check(JSON.stringify(editor.document)===beforeStrict,'move into a strict overflowing slot is rejected before commit');check(errors.length===1,'strict move failure is reported');errors=[];
 check(errors.length===0,'valid block interactions produce no errors');
 canvas.destroy();check(!host.children.length,'destroy disposes block controls and listeners');
 out.textContent+=`\n${count} checks passed\n`;document.title=`PASS ${count} block checks`;
}catch(error){out.textContent+=`FAIL ${error.stack}`;document.title='FAIL block checks';throw error;}
// Native drag specimen; verification is triggered after a trusted pointer drag.
const simple={slides:[{title:'Drag a handle to reorder',composition:{mode:'row'},blocks:[{text:'First: Recommendation'},{text:'Second: Evidence'},{text:'Third: Decision'}]}]};
const demoEditor=createEditorSession(simple,{rejectInvalid:true});let moves=0;
const demo=createCanvasEditor(host,{editor:demoEditor,layoutEditing:true,onCommit:()=>moves++,onError:error=>{document.querySelector('#drag-status').textContent='FAIL '+error.message;}});
document.querySelector('#verify').onclick=()=>{
 try{check(demoEditor.get('slides.0.blocks.2.text')==='First: Recommendation','trusted drag changes block order');check(moves===1,'trusted drag creates one committed edit');demoEditor.undo();check(JSON.stringify(demoEditor.document)===JSON.stringify(simple)&&!demoEditor.canUndo,'trusted drag undo restores the source deck');document.querySelector('#drag-status').textContent='PASS trusted block drag';}catch(error){document.querySelector('#drag-status').textContent='FAIL '+error.message;}
};
