import {createCanvasEditor} from '../../opf-editor/src/canvas.js';
import {createEditorSession} from '../../opf-editor/src/index.js';
import {renderSvg} from '../../opf-render/src/svg.js';
const host=document.querySelector('#canvas'),out=document.querySelector('#results');let checks=0;
const check=(value,message)=>{if(!value)throw new Error(message);checks++;out.textContent+=`PASS ${message}\n`;};
const original={name:'Keep deck metadata',slides:[{title:'Build a slide directly',notes:'Retain notes',text:[{text:'Original recommendation',bold:true}]}]};
const editor=createEditorSession(original,{rejectInvalid:true});let errors=[],commits=0;
const canvas=createCanvasEditor(host,{editor,layoutEditing:true,onError:error=>errors.push(error.message),onCommit:()=>commits++});
const dialog=()=>host.querySelector('[role="dialog"]');
const button=name=>[...dialog().querySelectorAll('button')].find(b=>b.textContent===name);
const change=(label,value)=>{const node=dialog().querySelector(`[aria-label="${label}"]`);node.value=value;node.dispatchEvent(new Event('change'));};
const add=()=>host.querySelector('[data-block-add]').click();
const reset=value=>editor.applyPatch([{op:'replace',path:'',value}]);
try{
 await canvas.ready;
 check(!!host.querySelector('[data-block-add]'),'implicit slides expose Add content in Arrange mode');
 canvas.openInsertMenu('slides.0',99);check(!dialog()&&errors.pop()?.includes('index'),'invalid insertion position is rejected');
 add();check(dialog().getAttribute('aria-label')==='Add content','Add opens an accessible palette');
 check(getComputedStyle(dialog().querySelector('[aria-label="Media URL or asset reference"]').parentElement).display==='none','text content hides media-only controls');
 change('Content type','chart');button('Add').click();
 check(editor.get('slides.0.blocks.1.chart.type')==='column','palette inserts a schema-valid chart');
 check(editor.get('slides.0.blocks.0.text.0.bold')===true,'implicit conversion retains rich formatting');
 check(editor.get('slides.0.title')===original.slides[0].title&&editor.get('slides.0.notes')==='Retain notes','insertion preserves heading and notes');
 check(commits===1,'insertion is one transaction');editor.undo();
 check(JSON.stringify(editor.document)===JSON.stringify(original),'one undo restores exact implicit content');
 for(const kind of ['text','list','table','metric','quote','code','timeline','group']){
  add();change('Content type',kind);button('Add').click();check(editor.get('slides.0.blocks').length===2,`${kind} starter renders and inserts`);editor.undo();
 }
 add();change('Content type','image');button('Add').click();
 check(getComputedStyle(dialog().querySelector('input[type="file"]').parentElement).display==='block','image content shows file controls');
 check(errors.pop()?.includes('source')&&!editor.get('slides.0.blocks'),'missing media source leaves the document unchanged');
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9V3iWggAAAAASUVORK5CYII=';
 const transfer=new DataTransfer();transfer.items.add(new File([Uint8Array.from(atob(png),c=>c.charCodeAt(0))],'pixel.png',{type:'image/png'}));
 const upload=dialog().querySelector('input[type="file"]');upload.files=transfer.files;upload.dispatchEvent(new Event('change'));
 await new Promise((resolve,reject)=>{let frames=0;const tick=()=>{if(!button('Add').disabled)return resolve();if(++frames>300)return reject(new Error('Image read timed out'));requestAnimationFrame(tick);};tick();});
 button('Add').click();check(editor.get('slides.0.blocks.1.image')===`data:image/png;base64,${png}`,'local image file embeds exact bytes');
 check(host.querySelector('svg image')?.getAttribute('href')?.startsWith('data:image/png'),'inserted image appears in the shared preview');editor.undo();
 add();change('Content type','image');
 const NativeReader=window.FileReader,pending=[];
 try{
  window.FileReader=class {readAsDataURL(){pending.push(this);}};
  const chooser=dialog().querySelector('input[type="file"]');chooser.files=transfer.files;chooser.dispatchEvent(new Event('change'));
  const source=dialog().querySelector('[aria-label="Media URL or asset reference"]');source.value=`data:image/png;base64,${png}`;source.dispatchEvent(new Event('input'));
  pending[0].result='Stale file bytes';pending[0].onload();
  check(source.value===`data:image/png;base64,${png}`&&!button('Add').disabled,'typed media source wins over an older file read');
  const nextFile=new DataTransfer();nextFile.items.add(new File([new Uint8Array([1])],'next.png',{type:'image/png'}));chooser.files=nextFile.files;chooser.dispatchEvent(new Event('change'));button('Cancel').click();pending[1].result='Late bytes';pending[1].onload();
  check(!dialog()&&JSON.stringify(editor.document)===JSON.stringify(original),'closed palette ignores pending image reads');
 }finally{window.FileReader=NativeReader;}

 add();editor.set('name','Changed elsewhere');check(!dialog(),'external edits dismiss stale insertion forms');editor.undo();
 add();dialog().dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));check(!dialog(),'Escape closes the palette without mutation');
 canvas.beginEdit('slides.0.text');canvas.openInsertMenu();check(!!dialog(),'opening insertion finishes an active rich edit');button('Cancel').click();
 const grouped={slides:[{title:'Group operations',composition:{mode:'row'},blocks:[{blocks:[{text:'Only child'}]},{text:'Keep this'}]}]};reset(grouped);
 canvas.openBlockMenu('slides.0.blocks.0');button('Duplicate').click();
 check(editor.get('slides.0.blocks.1.blocks.0.text')==='Only child','duplicate preserves an entire nested group');editor.undo();
 canvas.openBlockMenu('slides.0.blocks.0');button('Add inside').click();change('Content type','list');button('Add').click();
 check(editor.get('slides.0.blocks.0.blocks.1.items').length===2,'Add inside targets the selected group');editor.undo();
 canvas.openBlockMenu('slides.0.blocks.0');button('Add after').click();button('Add').click();
 check(editor.get('slides.0.blocks.1.text')==='Add your text'&&editor.get('slides.0.blocks.2.text')==='Keep this','Add after honors the selected position');editor.undo();
 canvas.openBlockMenu('slides.0.blocks.0.blocks.0');button('Delete').click();
 check(editor.get('slides.0.blocks').length===1&&editor.get('slides.0.blocks.0.text')==='Keep this','deleting the last child prunes its empty group');editor.undo();
 check(JSON.stringify(editor.document)===JSON.stringify(grouped),'delete undo restores the complete hierarchy');
 reset({slides:[{title:'Blank after deletion',blocks:[{text:'Only'}]}]});canvas.openBlockMenu('slides.0.blocks.0');button('Delete').click();
 check(editor.get('slides.0.blocks').length===0&&!!host.querySelector('[data-block-add]'),'last root block can be deleted and replaced');check(document.activeElement===host.querySelector('[data-block-add]'),'deleting the last block restores focus to Add content');add();button('Add').click();check(editor.get('slides.0.blocks.0.text')==='Add your text','empty slides accept new content');
 reset({slides:[{title:'Regions',left:{text:'Original left'},right:{text:'Keep right'}}]});canvas.openInsertMenu('slides.0.left');button('Add').click();
 check(editor.get('slides.0.left.blocks.0.text')==='Original left'&&editor.get('slides.0.right.text')==='Keep right','named-region insertion preserves neighboring regions');
 const expected=document.createElement('div');expected.innerHTML=renderSvg(editor.document);
 const glyphs=root=>[...root.querySelectorAll('svg text')].map(n=>[n.textContent,n.getAttribute('x'),n.getAttribute('y')]);
 check(JSON.stringify(glyphs(host))===JSON.stringify(glyphs(expected)),'created canvas content uses standalone renderer geometry');
 reset({slides:[{composition:{mode:'row',weights:[4,1],overflow:'error'},blocks:[{text:'Long content. '.repeat(60)},{text:'Short'}]}]});
 const before=JSON.stringify(editor.document);canvas.openBlockMenu('slides.0.blocks.0');button('Duplicate').click();
 check(JSON.stringify(editor.document)===before&&errors.pop()?.includes('fit'),'strict overflowing duplication is rejected before mutation');canvas.cancel();
 canvas.setLayoutEditing(false);check(!host.querySelector('[data-block-add]'),'leaving Arrange hides content controls');
 check(!errors.length,'no unexpected insertion errors');canvas.destroy();check(!host.children.length,'destroy disposes creation controls');
 out.textContent+=`\n${checks} checks passed`;document.title=`PASS ${checks} content creation checks`;
 await createCanvasEditor(host,{document:original,layoutEditing:true}).ready;
}catch(error){out.textContent+=`FAIL ${error.stack}`;document.title='FAIL content creation checks';throw error;}
