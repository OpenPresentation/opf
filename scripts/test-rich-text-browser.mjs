import {createCanvasEditor} from '../../opf-editor/src/canvas.js';
import {createEditorSession} from '../../opf-editor/src/index.js';
import {loadBrowserFontRegistry} from '../../opf-render/src/fonts-browser.js';
import {richTextContent} from '../../opf-editor/src/rich-text.js';
const out=document.querySelector('#results'),host=document.querySelector('#canvas');let checks=0;
const check=(condition,message)=>{if(!condition)throw new Error(message);out.textContent+=`PASS ${message}\n`;checks++;};
const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const text=[{text:'Select these words to format them. ',fontSize:30}, {text:'Keep this link',bold:true,link:'https://example.org',fontSize:30},' and the final sentence.'];
const original={design:{fontScheme:'roboto'},slides:[{title:'Rich text, on the slide',text,notes:'Keep these notes'}]};
const fonts=await loadBrowserFontRegistry((await fetch('./fonts.json').then(r=>r.json())).filter(f=>['Roboto','Roboto Mono'].includes(f.family)&&[400,700].includes(f.weight)).map(f=>({...f,data:Uint8Array.from(atob(f.dataUrl.split(',')[1]),c=>c.charCodeAt(0))})));
const editor=createEditorSession(original,{rejectInvalid:true});let errors=[], commits=0;
const canvas=createCanvasEditor(host,{editor,renderOptions:{textMeasurement:fonts.textMeasurement},onCommit:()=>commits++,onError:error=>errors.push(error.message)});
const button=name=>[...host.querySelectorAll('.opf-rich-toolbar button')].find(b=>b.textContent===name);
const input=name=>host.querySelector(`.opf-rich-toolbar input[aria-label="${name}"]`);
const nodes=()=>[...host.querySelectorAll('text[data-opf-text-start]')];
async function select(start,end,reverse=false) {
 const a=nodes().find(n=>+n.dataset.opfTextStart<=start&&+n.dataset.opfTextEnd>start),b=nodes().findLast(n=>+n.dataset.opfTextStart<end&&+n.dataset.opfTextEnd>=end);
 const selection=window.getSelection();selection.removeAllRanges();
 if(reverse)selection.setBaseAndExtent(b.firstChild,end-Number(b.dataset.opfTextStart),a.firstChild,start-Number(a.dataset.opfTextStart));
 else{const range=document.createRange();range.setStart(a.firstChild,start-Number(a.dataset.opfTextStart));range.setEnd(b.firstChild,end-Number(b.dataset.opfTextStart));selection.addRange(range);}
 await paint();
}
function change(name,value){const node=input(name);node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));}
try {
 await canvas.ready;
 check(nodes().length>2,'rich fragments expose source offsets');
 for(const node of nodes())check(node.textContent===richTextContent(text).slice(+node.dataset.opfTextStart,+node.dataset.opfTextEnd),'fragment trace matches source text');
 await select(7,18);check(button('Bold')&&host.querySelector('.opf-rich-toolbar').style.display==='flex','native SVG selection opens formatting controls');
 button('Bold').click();check(editor.get('slides.0.text').some(r=>r.text==='these words'&&r.bold),'selection formatting splits the selected run');
 check(editor.get('slides.0.text').some(r=>r.link==='https://example.org'&&r.bold),'formatting preserves the other linked run');
 check(window.getSelection().toString()==='these words','selection restored after the shared renderer reflows');
 check(editor.get('slides.0.notes')==='Keep these notes','unrelated metadata preserved');
 button('Italic').click();check(editor.get('slides.0.text').some(r=>r.text==='these words'&&r.bold&&r.italic),'repeated style changes retain the same range');
 editor.undo();check(editor.get('slides.0.text').some(r=>r.text==='these words'&&r.bold&&!r.italic),'one undo removes one formatting action');
 editor.undo();check(JSON.stringify(editor.get('slides.0.text'))===JSON.stringify(text),'undo restores original run boundaries');
 await select(7,40,true);change('Text color','#2563eb');check(nodes().filter(n=>+n.dataset.opfTextStart>=7&&+n.dataset.opfTextEnd<=40).every(n=>n.getAttribute('fill')==='#2563eb'),'reverse cross-run selection colors only the range');
 change('Font size (pt)','24');check(editor.get('slides.0.text').filter(r=>r.color==='#2563eb').every(r=>r.fontSize===24),'point size applies to all selected runs');
 change('Link URL','javascript:alert(1)');check(errors.at(-1)?.includes('HTTP'),'unsafe link entry rejected');errors=[];
 const beforeMissingFont=JSON.stringify(editor.document);change('Font family','Definitely Missing OPF Test Font');check(JSON.stringify(editor.document)===beforeMissingFont&&errors.at(-1)?.includes('font'),'missing font fails before changing the document');errors=[];
 change('Link URL','https://openpresentation.org');check(editor.get('slides.0.text').some(r=>r.link==='https://openpresentation.org'),'safe hyperlink stored');
 input('Selected text').value='replacement';button('Replace text').click();check(richTextContent(editor.get('slides.0.text'))===richTextContent(text).slice(0,7)+'replacement'+richTextContent(text).slice(40),'selected text replacement preserves the suffix');
 button('Superscript').click();check(editor.get('slides.0.text').some(r=>r.text==='replacement'&&r.superscript&&!r.subscript),'superscript uses exclusive script state');
 button('Subscript').click();check(editor.get('slides.0.text').some(r=>r.text==='replacement'&&r.subscript&&!r.superscript),'subscript clears superscript');
 button('Reset style').click();check(editor.get('slides.0.text').some(r=>r.text==='replacement'&&!r.fontSize&&!r.link&&!r.subscript),'reset removes selected overrides');
 editor.set('slides.0.text',text);canvas.beginEdit('slides.0.text');check(window.getSelection().toString().replace(/\n/g,'')===richTextContent(text),'keyboard entry selects all rich text');
 button('Edit runs').click();check(!!host.querySelector('form[aria-label="Content properties"]'),'structured run editor remains accessible');canvas.cancel();
 await select(0,6);editor.set('slides.0.text',['External edit']);check(host.querySelector('.opf-rich-toolbar').style.display==='none','external edits invalidate stale formatting selection');
 editor.set('slides.0.text','Plain text');canvas.beginEdit('slides.0.text');
 const format=[...host.querySelectorAll('button')].find(b=>b.textContent==='Format text');check(!!format,'plain text exposes the formatting entry');format.click();button('Bold').click();
 check(editor.get('slides.0.text').some(r=>r.text==='Plain text'&&r.bold),'plain text can become formatted runs on the canvas');
 canvas.beginEdit('slides.0.title');check(![...host.querySelectorAll('button')].some(b=>b.textContent==='Format text'),'scalar-only title does not offer an invalid rich conversion');canvas.cancel();
 check(commits>0,'formatting notifies canvas commit callbacks');check(host.querySelector('[role="status"]').hidden,'successful edits clear prior formatting errors');
 check(errors.length===0,'no unexpected canvas errors');
 canvas.destroy();check(!host.children.length,'destroy cleans up canvas and toolbar');
 out.textContent+=`\n${checks} checks passed`;document.title=`PASS ${checks} rich text canvas checks`;
 // Leave an interactive specimen after verification.
 const demo=createCanvasEditor(host,{document:original,renderOptions:{textMeasurement:fonts.textMeasurement}});await demo.ready;
}catch(error){out.textContent+=`FAIL ${error.stack}`;document.title='FAIL rich text canvas checks';throw error;}
