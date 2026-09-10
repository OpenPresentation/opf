import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(new URL('../../opf-render/package.json',import.meta.url));
const {build}=require('esbuild'),{chromium}=require('playwright');
import {prepareNodeFonts} from '../../opf-render/dist/fonts-node.js';
const output=path.resolve(process.argv[2]??'artifacts/plain-whitespace-workflow');await mkdir(output,{recursive:true});
const installed=process.argv[3]==='installed',consumer=path.resolve('artifacts/npm/consumer');
const installedRequire=installed?createRequire(path.join(consumer,'package.json')):null;
const prepare=installed?(await import(pathToFileURL(installedRequire.resolve('@openpresentation/opf-render/fonts-node')).href)).prepareNodeFonts:prepareNodeFonts;
const {registry}=await prepare(),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let contents=`
 import {createEditorSession} from '../opf-editor/dist/index.js';
 import {createCanvasEditor} from '../opf-editor/dist/canvas.js';
 import {loadBrowserFontRegistry} from '../opf-render/dist/fonts-browser.js';
 import {toPptx,fromPptx} from '../opf-pptx/dist/index.js';
 window.mount=async({deck,faces,measured})=>{
  window.plainCanvas?.destroy();window.fonts?.dispose();window.failures=[];window.lastExport=null;window.lastImport=null;
  window.fonts=await loadBrowserFontRegistry(faces.map(face=>({...face,data:Uint8Array.from(atob(face.dataUrl.split(',')[1]),c=>c.charCodeAt(0))})),{substitutionPolicy:'visual',fallbackFamily:'Roboto'});
  window.editor=createEditorSession(deck,{rejectInvalid:true});window.renderOptions=measured?{textMeasurement:fonts.textMeasurement}:{};
  window.plainCanvas=createCanvasEditor(document.querySelector('#canvas'),{editor,renderOptions,onError:e=>failures.push(e.message)});await plainCanvas.ready;
  const action=(id,run)=>document.getElementById(id).onclick=async()=>{try{await run();}catch(e){failures.push(e.message);}};
  action('undo',()=>editor.undo());action('redo',()=>editor.redo());
  action('export',async()=>{plainCanvas.commit();window.accepted=editor.document;window.lastExport=await toPptx(accepted,renderOptions);window.lastImport=await fromPptx(lastExport);});
 };`;
if(installed)contents=contents.replaceAll('../opf-editor/dist/index.js','@openpresentation/opf-editor').replaceAll('../opf-editor/dist/canvas.js','@openpresentation/opf-editor/canvas').replaceAll('../opf-render/dist/fonts-browser.js','@openpresentation/opf-render/fonts-browser').replaceAll('../opf-pptx/dist/index.js','@openpresentation/opf-pptx');
const built=await build({stdin:{resolveDir:installed?consumer:process.cwd(),contents},bundle:true,platform:'browser',format:'iife',write:false});
const bundle=built.outputFiles[0].text,browser=await chromium.launch(),results=[],errors=[],requests=[];
try {
 const page=await browser.newPage({viewport:{width:1400,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
 await page.setContent('<button id="undo">Undo</button><button id="redo">Redo</button><button id="export">Export</button><div id="canvas" style="width:900px"></div>');await page.addScriptTag({content:bundle});
 for(const measured of [false,true])for(const [width,height]of [[1280,720],[720,1280]])for(const original of ['  A  B\tC\u00a0D\r\n\r\ntrail  \r','\r\n\r\n','']) {
  const deck={design:{fontScheme:'roboto',dimensions:{widthInches:width/96,heightInches:height/96}},slides:[{title:'Whitespace editing',text:original}]};
  await page.evaluate(args=>mount(args),{deck,faces:registry.embeddedFonts,measured});
  const target=page.locator('[data-canvas-target][data-opf-path="slides.0.text"]');assert.equal(await target.count(),1);
  const geometry=await page.evaluate(()=>editor.composeSlide(0,renderOptions).items.find(item=>item.field==='text'));
  const selection=await target.locator(':scope > rect.opf-selection').evaluate(n=>({x:+n.getAttribute('x'),y:+n.getAttribute('y'),width:+n.getAttribute('width'),height:+n.getAttribute('height')}));
  if(!original.trim()){assert.equal(selection.x,geometry.box.x-4);assert.equal(selection.y,geometry.box.y-4);assert.equal(selection.width,geometry.box.width+8);assert.equal(selection.height,geometry.box.height+8);}
  await target.dblclick();let input=page.getByRole('textbox',{name:'Edit text inline',exact:true});await input.press('Control+Enter');assert.equal(await page.evaluate(()=>editor.get('slides.0.text')),original);assert.equal(await page.evaluate(()=>editor.canUndo),false);
  await target.dblclick();input=page.getByRole('textbox',{name:'Edit text inline',exact:true});const edit=original.trim()?original.replace('A','Edited'):original?'\tend  '+original:'  New\ttext  \r\n';await input.fill(edit);await input.press('Control+Enter');const accepted=await page.evaluate(()=>editor.document);const expected=original?edit:edit.replace(/\r\n/g,'\n');assert.equal(accepted.slides[0].text,expected);
  await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await page.evaluate(()=>editor.document),deck);await page.getByRole('button',{name:'Redo',exact:true}).click();assert.deepEqual(await page.evaluate(()=>editor.document),accepted);
  await page.getByRole('button',{name:'Export',exact:true}).click();await page.waitForFunction(()=>lastImport||failures.length);assert.deepEqual(await page.evaluate(()=>failures),[]);const imported=await page.evaluate(()=>lastImport);assert.equal(imported.slides[0].title,accepted.slides[0].title);assert.deepEqual(imported.slides[0].blocks,[{type:'text',text:expected}]);
  if(original.includes('A')) {
   await target.dblclick();input=page.getByRole('textbox',{name:'Edit text inline',exact:true});
   await input.evaluate(n=>n.setSelectionRange(n.value.length,n.value.length));await input.pressSequentially(' added');
   await input.evaluate(n=>n.setSelectionRange(2,8));await input.pressSequentially('Again');await input.press('Control+Enter');
   assert.equal(await page.evaluate(()=>editor.get('slides.0.text')),expected.replace('Edited','Again')+' added','Separate native input events must retain untouched mixed line endings between edits');
   await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await page.evaluate(()=>editor.document),accepted);
  }
  const bytes=new Uint8Array(await page.evaluate(()=>Array.from(lastExport)));results.push({measured,width,height,original,accepted:expected,selection,exportSha256:hash(bytes)});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 await writeFile(path.join(output,'report.json'),JSON.stringify({node:process.version,browser:browser.version(),installed,lockSha256:installed?hash(await readFile(path.join(consumer,'package-lock.json'))):undefined,verifierSha256:hash(await readFile(new URL(import.meta.url))),bundleSha256:hash(bundle),results,errors,requests,scope:'12 actual offline browser workflows: source-preserving no-op, scalar edit, undo/redo, blank source targeting and PPTX reimport; four additional separate-keyboard-edit controls retain untouched mixed endings. Trusted pointer/keyboard actions use Playwright; fill supplies normalized textarea text. Wholesale replacement uses the existing newline policy inside its replacement range. No native Office execution.'},null,2)+'\n');
 console.log('12 plain text browser workflows preserve source through edit, undo/redo, export and reimport.');
}finally{await browser.close();}
