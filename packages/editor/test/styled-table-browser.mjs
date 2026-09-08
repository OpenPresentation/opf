import {createCanvasEditor} from '../src/canvas.js';
import {createEditorSession} from '../src/index.js';
import {richTextContent} from '../src/rich-text.js';
import {loadBrowserFontRegistry} from '@openpresentation/opf-render/fonts-browser';
const host=document.querySelector('#canvas'),output=document.querySelector('#results');
const controls=document.createElement('div'),state=document.createElement('pre');
state.id='state';host.after(controls,state);
const rich=['Mixed ',{text:'bold',bold:true,color:'#AA0000'},' text'];
const source={design:{theme:'classic',fontScheme:'roboto'},slides:[{title:'Styled table editing',table:{columns:['Team','Stage','Status'],rows:[
 [{value:rich,rowSpan:2,style:{fill:'#DBEAFE',verticalAlign:'middle',borders:{bottom:{color:'#445566',width:2,dash:'dot'}}}},{value:'Preview',style:{fill:'#E5E7EB',align:'center'}},{value:'Ready',style:{fill:'#DCFCE7',color:'#166534'}}],
 [null,{value:'Editing',style:{fill:'#FEF3C7'}},{value:[],style:{fill:'#F3E8FF'}}]
]}}]};
const valuePath='slides.0.table.rows.0.0.value',scalarPath='slides.0.table.rows.0.1.value',emptyPath='slides.0.table.rows.1.2.value';
let editor,canvas,checks=0;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function check(ok,message){if(!ok)throw new Error(message);checks++;output.textContent+=`PASS ${message}\n`;}
function show(){state.textContent=JSON.stringify({selectedPath:host.querySelector('[data-canvas-selected]')?.getAttribute('data-opf-path'),editingPath:canvas?.editingPath,canUndo:editor?.canUndo,canRedo:editor?.canRedo,table:editor?.document.slides[0].table},null,2);}
function structural(){const table=editor.document.slides[0].table;check(table.rows[0][0].rowSpan===2&&table.rows[1][0]===null,'Typing preserves merge ownership');for(let r=0;r<2;r++)for(let c=0;c<3;c++)if(source.slides[0].table.rows[r][c])check(same(table.rows[r][c].style,source.slides[0].table.rows[r][c].style),`Cell ${r},${c} keeps its styles`);}
function button(label,action){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{try{action();show();}catch(error){output.textContent+='FAIL '+error.stack;}};controls.append(b);}
try{
 const faces=(await fetch('./fonts.json').then(r=>r.json())).filter(face=>['Roboto','Roboto Mono'].includes(face.family));
 const fonts=await loadBrowserFontRegistry(faces.map(face=>({...face,url:face.dataUrl})));
 check(faces.length>0&&fonts.embeddedFonts.length===faces.length,'Actual Roboto font bytes are loaded and measured');
 editor=createEditorSession(source,{rejectInvalid:true});
 canvas=createCanvasEditor(host,{editor,renderOptions:{textMeasurement:fonts.textMeasurement},onRender:show,onCommit:show,onCancel:show});await canvas.ready;
 const rect=host.querySelector('rect[data-opf-path="slides.0.table.rows.0.0"]');
 check(!!rect,'Merged anchor has a visible rectangle');
 check(!host.querySelector('[data-canvas-target][data-opf-path="slides.0.table.rows.1.0"]'),'Covered grid position is not an editable target');
 for(const path of [valuePath,scalarPath,emptyPath])check(!!host.querySelector(`[data-canvas-target][data-opf-path="${path}"]`),`${path} is a keyboard/pointer target`);
 for(const text of host.querySelectorAll(`[data-opf-path="${valuePath}"] text`)){const t=text.getBBox(),r=rect.getBBox();check(t.x>=r.x-1&&t.y>=r.y-1&&t.x+t.width<=r.x+r.width+1&&t.y+t.height<=r.y+r.height+1,'Merged-cell glyphs stay inside the anchor');}
 editor.subscribe(show);
 for(const event of ['click','dblclick','keydown','input'])host.addEventListener(event,()=>requestAnimationFrame(show));
 button('Undo',()=>editor.undo());button('Redo',()=>editor.redo());
 button('Verify typed merge',()=>{check(richTextContent(editor.get(valuePath))==='Mixed bold text!','Pointer edit commits rich text');check(editor.get(valuePath).some(run=>typeof run==='object'&&run.bold&&run.color==='#AA0000'),'Typing retains existing bold/color');structural();});
 button('Verify original',()=>check(same(editor.document,source),'Undo restores the complete source document'));
 button('Verify formatting',()=>{check(richTextContent(editor.get(scalarPath))==='Preview','Formatting preserves scalar text');check(editor.get(scalarPath).every(run=>typeof run==='object'&&run.bold),'Formatting applies bold to the styled value');structural();});
 button('Verify empty edit',()=>{check(richTextContent(editor.get(emptyPath))==='New cell','Empty styled value accepts keyboard input');structural();});
 show();output.textContent+='READY for pointer, keyboard, formatting and undo checks\n';
}catch(error){output.textContent+='FAIL '+error.stack;}
