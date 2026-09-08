import {createCanvasEditor} from '../src/canvas.js';
import {createEditorSession} from '../src/index.js';
import {richTextContent} from '../src/rich-text.js';
import {loadBrowserFontRegistry} from '@openpresentation/opf-render/fonts-browser';
const output=document.querySelector('#results'),host=document.querySelector('#canvas');
const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
let checks=0;const check=(ok,message)=>{if(!ok)throw new Error(message);checks++;output.textContent+='PASS '+message+'\n';};
try{
 const faces=(await fetch('./fonts.json').then(r=>r.json())).filter(f=>['Roboto','Roboto Mono'].includes(f.family));
 // The browser loader fetches entry.url (including data URLs), parses the
 // resulting bytes and loads those same bytes through FontFace.
 const fonts=await loadBrowserFontRegistry(faces.map(f=>({...f,url:f.dataUrl})));
 check(faces.length>0&&fonts.embeddedFonts.length===faces.length&&fonts.textMeasurement.measure('Cell',16,{fontFamily:'Roboto',fontWeight:700})>0,'Data-URL fonts load and measure actual glyphs');
 const rich=['Mixed ',{text:'bold',bold:true,color:'#AA0000'},' and ',{text:'linked',link:'https://example.com',underline:true}];
 const editor=createEditorSession({design:{theme:'classic',fontScheme:'roboto'},slides:[{table:{columns:['Header',['Normal ',{text:'bold',bold:true}]],rows:[['Plain',rich],[[],12]]}}]});
 const canvas=createCanvasEditor(host,{editor,renderOptions:{textMeasurement:fonts.textMeasurement}});await canvas.ready;
 const prefix='slides.0.table.';
 // [] is a valid schema value; exercise it before editing normalizes runs.
 check(!!host.querySelector('[data-opf-path="slides.0.table.rows.1.0"][data-opf-rich-text="true"]'),'Run-less empty cell has a rich-text trace');
 canvas.beginEdit(prefix+'rows.0.0');
 const format=[...host.querySelectorAll('button')].find(b=>b.textContent==='Format text');check(!!format,'Scalar table text offers the existing formatting action');format.click();await paint();
 check(Array.isArray(editor.get(prefix+'rows.0.0')),'Formatting promotes the cell to canonical TextRun[]');editor.undo();await paint();check(editor.get(prefix+'rows.0.0')==='Plain','Promotion is undoable');
 canvas.beginEdit(prefix+'rows.0.1');let input=host.querySelector('textarea');check(!!input,'Mixed cell enters rich editing');
 input.value=richTextContent(rich)+'!';input.dispatchEvent(new Event('input',{bubbles:true}));await paint();check(canvas.commit(),'Mixed-cell draft commits');
 check(richTextContent(editor.get(prefix+'rows.0.1')).endsWith('!'),'Typed content is preserved');check(editor.get(prefix+'rows.0.1').some(r=>r.bold&&r.color==='#AA0000'),'Typing retains bold/color runs');editor.undo();await paint();check(JSON.stringify(editor.get(prefix+'rows.0.1'))===JSON.stringify(rich),'Typing undo restores the entire rich cell');
 canvas.beginEdit(prefix+'columns.0');check([...host.querySelectorAll('button')].some(b=>b.textContent==='Format text'),'Header labels support formatting');canvas.cancel();
 canvas.beginEdit(prefix+'rows.1.0');input=host.querySelector('textarea');check(!!input,'Empty rich cell enters editing');input.value='New cell';input.dispatchEvent(new Event('input',{bubbles:true}));await paint();check(canvas.commit(),'Empty-cell draft commits');check(richTextContent(editor.get(prefix+'rows.1.0'))==='New cell','Empty rich cell accepts text');editor.undo();await paint();
 window.richTable={editor,canvas};window.richTableResult={passed:true,checks};output.textContent+='PASS '+checks+' rich-table browser checks\n';
}catch(error){window.richTableResult={passed:false,error:String(error),stack:error.stack};output.textContent+='FAIL '+error.stack;}
