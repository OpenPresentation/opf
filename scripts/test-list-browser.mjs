import {createCanvasEditor} from '../../opf-editor/src/canvas.js';
import {createEditorSession} from '../../opf-editor/src/index.js';
import {loadBrowserFontRegistry} from '../../opf-render/src/fonts-browser.js';
const host=document.querySelector('#canvas'),out=document.querySelector('#results');let checks=0;
const check=(condition,message)=>{if(!condition)throw new Error(message);out.textContent+=`PASS ${message}\n`;checks++;};
const original={design:{fontScheme:'roboto'},slides:[{title:'Edit every list entry',composition:{mode:'row'},blocks:[{items:[
 {text:['A ',{text:'bold recommendation',bold:true},' with supporting context.'],description:['A ',{text:'linked explanation',link:'https://openpresentation.org',italic:true}]},
 {text:'Plain entry with enough words to wrap in this column.',description:'A plain description.',level:1},
 {text:[{text:'Deeper nesting',color:'#2563EB'}],level:4}
 ]},{type:'text',bullets:['Text-style bullets',{text:[{text:'Rich bullet',bold:true}],level:1}]}]}]};
const fonts=await loadBrowserFontRegistry((await fetch('./fonts.json').then(r=>r.json())).filter(f=>['Roboto','Roboto Mono'].includes(f.family)&&[400,700].includes(f.weight)).map(f=>({...f,data:Uint8Array.from(atob(f.dataUrl.split(',')[1]),c=>c.charCodeAt(0))})));
let errors=[];const editor=createEditorSession(original,{rejectInvalid:true});
const canvas=createCanvasEditor(host,{editor,renderOptions:{textMeasurement:fonts.textMeasurement},onError:error=>errors.push(error.message)});
const target=path=>host.querySelector(`[data-opf-path="${path}"]`),button=label=>[...host.querySelectorAll('button')].find(b=>b.textContent===label);
try {
 await canvas.ready;
 const rich='slides.0.blocks.0.items.0.text',description='slides.0.blocks.0.items.0.description',plain='slides.0.blocks.0.items.1.text';
 check(target(rich).hasAttribute('data-opf-rich-text'),'rich list text has its own editable target');
 check(target(description).hasAttribute('data-opf-rich-text'),'rich description has its own editable target');
 check(!target('slides.0.blocks.0.items').hasAttribute('data-opf-rich-text'),'list container is not mistaken for text runs');
 canvas.beginEdit(rich);check(window.getSelection().toString().includes('bold recommendation'),'list text can be selected directly');
 button('Italic').click();check(editor.get(rich).every(r=>r.italic),'list text formats without flattening');
 check(editor.get(rich).some(r=>r.bold),'format preserves existing emphasis');
 check(editor.get(description)[1].link==='https://openpresentation.org','body formatting preserves description link');
 editor.undo();check(JSON.stringify(editor.document)===JSON.stringify(original),'one undo restores rich list content');
 canvas.beginEdit(description);button('Underline').click();
 check(editor.get(description).every(r=>r.underline),'description formats on the slide');
 check(editor.get(description)[1].link==='https://openpresentation.org','description formatting preserves its link');editor.undo();
 canvas.beginEdit(plain);const input=host.querySelector('textarea');
 check(!!input,'plain list entry supports inline typing');
 const scale=host.querySelector('svg').getBoundingClientRect().width/host.querySelector('svg').viewBox.baseVal.width;
 check(Math.abs(parseFloat(input.style.width)-Number(target(plain).getAttribute('data-opf-box-width'))*scale)<1,'inline editor uses the full measured list width');
 input.value='Updated list entry';input.dispatchEvent(new Event('input',{bubbles:true}));canvas.commit();
 check(editor.get(plain)==='Updated list entry','plain entry commits at its exact source path');
 check(editor.get('slides.0.blocks.0.items.1.level')===1,'typing retains the nesting level');editor.undo();
 canvas.beginEdit('slides.0.blocks.0.items.1.description');button('Format text').click();button('Bold').click();
 check(editor.get('slides.0.blocks.0.items.1.description')[0].bold,'plain descriptions can become rich text');editor.undo();editor.undo();
 canvas.beginEdit('slides.0.blocks.0.items');check(!!host.querySelector('form[aria-label="Content properties"]'),'list container opens structural properties');canvas.cancel();
 canvas.beginEdit('slides.0.blocks.1.bullets.1.text');button('Italic').click();
 check(editor.get('slides.0.blocks.1.bullets.1.text')[0].italic,'explicit text-type bullets support rich editing');editor.undo();
 check(JSON.stringify(editor.document)===JSON.stringify(original),'all list edits undo without losing structure');
 check(errors.length===0,'no unexpected canvas errors');
 canvas.destroy();
 out.textContent+=`\n${checks} checks passed`;document.title=`PASS ${checks} list canvas checks`;
 await createCanvasEditor(host,{document:original,renderOptions:{textMeasurement:fonts.textMeasurement}}).ready;
}catch(error){out.textContent+=`FAIL ${error.stack}`;document.title='FAIL list canvas checks';throw error;}
