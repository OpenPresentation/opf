import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(new URL('../../opf-render/package.json',import.meta.url));
const {build}=require('esbuild'),{chromium}=require('playwright');
import {prepareNodeFonts} from '../../opf-render/dist/fonts-node.js';
const output=path.resolve(process.argv[2]??'artifacts/furniture-workflow');await mkdir(output,{recursive:true});
const installed=process.argv[3]==='installed',consumer=path.resolve('artifacts/npm/consumer');
const installedRequire=installed?createRequire(path.join(consumer,'package.json')):null;
const prepare=installed?(await import(pathToFileURL(installedRequire.resolve('@openpresentation/opf-render/fonts-node')).href)).prepareNodeFonts:prepareNodeFonts;
const {registry}=await prepare(),hash=value=>createHash('sha256').update(value).digest('hex');
let contents=`
 import {createEditorSession} from '../opf-editor/dist/index.js';
 import {createCanvasEditor} from '../opf-editor/dist/canvas.js';
 import {loadBrowserFontRegistry} from '../opf-render/dist/fonts-browser.js';
 import {toPptx,fromPptx} from '../opf-pptx/dist/index.js';
 window.mount=async({deck,faces,measured})=>{
  window.canvasEditor?.destroy();window.fonts?.dispose();window.failures=[];window.lastExport=null;window.lastImport=null;
  window.fonts=await loadBrowserFontRegistry(faces.map(face=>({...face,data:Uint8Array.from(atob(face.dataUrl.split(',')[1]),c=>c.charCodeAt(0))})),{substitutionPolicy:'visual',fallbackFamily:'Roboto'});
  window.editor=createEditorSession(deck,{rejectInvalid:true});window.renderOptions=measured?{textMeasurement:fonts.textMeasurement}:{};
  window.canvasEditor=createCanvasEditor(document.querySelector('#canvas'),{editor,renderOptions,onError:e=>failures.push(e.message)});await canvasEditor.ready;
  document.getElementById('undo').onclick=()=>editor.undo();document.getElementById('redo').onclick=()=>editor.redo();
  document.getElementById('export').onclick=async()=>{try{canvasEditor.commit();window.lastExport=await toPptx(editor.document,renderOptions);window.lastImport=await fromPptx(lastExport);}catch(e){failures.push(e.message);}};
 };`;
if(installed)contents=contents.replaceAll('../opf-editor/dist/index.js','@openpresentation/opf-editor').replaceAll('../opf-editor/dist/canvas.js','@openpresentation/opf-editor/canvas').replaceAll('../opf-render/dist/fonts-browser.js','@openpresentation/opf-render/fonts-browser').replaceAll('../opf-pptx/dist/index.js','@openpresentation/opf-pptx');
const built=await build({stdin:{resolveDir:installed?consumer:process.cwd(),contents},bundle:true,platform:'browser',format:'iife',write:false,metafile:true});
const bundleInputs={};
if(installed){
 const modules=await realpath(path.join(consumer,'node_modules'));
 for(const input of Object.keys(built.metafile.inputs)){
  if(input==='<stdin>')continue;
  if(input.startsWith('(disabled):')){bundleInputs[input]={disabled:true};continue;}
  const actual=await realpath(path.resolve(input));assert.ok(actual.startsWith(modules+path.sep),`Browser runtime is outside the installed consumer: ${input}`);bundleInputs[input]=hash(await readFile(actual));
 }
}
const bundle=built.outputFiles[0].text,browser=await chromium.launch(),results=[],errors=[],requests=[];let activeCase;
try{
 const page=await browser.newPage({viewport:{width:1400,height:1100}});
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
 await page.setContent('<button id="undo">Undo</button><button id="redo">Redo</button><button id="export">Export</button><div id="canvas" style="width:900px"></div>');await page.addScriptTag({content:bundle});
 for(const measured of [false,true])for(const [width,height]of [[1280,720],[720,1280]])for(const floor of [16,32])for(const local of [false,true]){
  const original=local?'':'  A  B\tC\u00a0D\r\n\r\ntrail  \r';
  const header={left:{text:original},center:{organization:true},right:{section:true}},footer={left:{date:' 2026-09-10 '},right:{slideNumber:true}};
  const deck={organization:{id:'openpresentation',name:'OpenPresentation'},design:{fontScheme:'roboto',dimensions:{widthInches:width/96,heightInches:height/96},header,footer},slides:[{title:'Shared furniture',section:'Review',text:'Body content keeps its own space.',composition:{minFontSize:floor,overflow:'error'},...(local?{design:{header}}:{})}]};
  const fieldPath=local?'slides.0.design.header.left.text':'design.header.left.text';activeCase={measured,width,height,floor,local,deck};
  await page.evaluate(args=>mount(args),{deck,faces:registry.embeddedFonts,measured});
  const geometry=await page.evaluate(async()=>{
   await document.fonts.ready;const geometry=editor.composeSlide(0,renderOptions),context=document.createElement('canvas').getContext('2d');
   return {...geometry,actual:geometry.furniture.parts.filter(part=>part.type==='text').map(part=>{
    const node=[...document.querySelectorAll('[data-opf-source-text]')].find(node=>node.getAttribute('data-opf-path')===part.path);
    return {path:part.path,selectable:node.hasAttribute('data-canvas-target'),lines:[...node.querySelectorAll('text')].map(line=>{
     const style=getComputedStyle(line);context.font=style.fontStyle+' '+style.fontWeight+' '+style.fontSize+' '+style.fontFamily;
     const segments=line.children.length?[...line.children]:[line];
     const ink=segments.filter(segment=>segment.textContent.trim()).map(segment=>{
      const metrics=context.measureText(segment.textContent),width=segment.hasAttribute('textLength')?Number(segment.getAttribute('textLength')):metrics.width,ratio=metrics.width?width/metrics.width:1;
      const anchor=line.getAttribute('text-anchor'),factor=anchor==='middle'?.5:anchor==='end'?1:0,x=Number(segment.getAttribute('x'))-width*factor,baseline=Number(line.getAttribute('y'));
      return {x:x-metrics.actualBoundingBoxLeft*ratio,y:baseline-metrics.actualBoundingBoxAscent,width:(metrics.actualBoundingBoxLeft+metrics.actualBoundingBoxRight)*ratio,height:metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent};
     });
     return {text:line.textContent,size:parseFloat(style.fontSize),ink,start:Number(line.getAttribute('data-opf-source-start')),end:Number(line.getAttribute('data-opf-source-end'))};
    })};
   })};
  });
  assert.deepEqual(geometry.diagnostics,[]);assert.ok(geometry.contentBox.y>=geometry.furniture.headerBottom);assert.ok(geometry.contentBox.y+geometry.contentBox.height<=geometry.furniture.footerTop);
  for(const actual of geometry.actual){
   const part=geometry.furniture.parts.find(part=>part.path===actual.path);assert.equal(actual.selectable,!part.generated);assert.equal(actual.lines.length,part.fit.sourceLines.length);
   for(const [index,line]of actual.lines.entries()){
    assert.equal(line.text,part.text.slice(line.start,line.end));assert.equal(line.start,part.fit.sourceLines[index].start);assert.equal(line.end,part.fit.sourceLines[index].end);assert.ok(line.size>=floor);
    if(measured)for(const ink of line.ink){const box=part.box;assert.ok(ink.x>=box.x-.05&&ink.y>=box.y-.05&&ink.x+ink.width<=box.x+box.width+.05&&ink.y+ink.height<=box.y+box.height+.05,JSON.stringify({activeCase,path:part.path,line,box}));}
   }
  }
  const target=page.locator(`[data-canvas-target][data-opf-path="${fieldPath}"]`);assert.equal(await target.count(),1);
  if(!original){const part=geometry.furniture.parts.find(part=>part.path===fieldPath),selection=await target.locator(':scope > rect.opf-selection').evaluate(node=>({x:+node.getAttribute('x'),y:+node.getAttribute('y'),width:+node.getAttribute('width'),height:+node.getAttribute('height')}));assert.deepEqual(selection,{x:part.box.x-4,y:part.box.y-4,width:part.box.width+8,height:part.box.height+8});}
  await target.dblclick();let input=page.getByRole('textbox',{name:'Edit text inline',exact:true});await input.press('Control+Enter');assert.equal(await page.evaluate(path=>editor.get(path),fieldPath),original);assert.equal(await page.evaluate(()=>editor.canUndo),false);
  await target.dblclick();input=page.getByRole('textbox',{name:'Edit text inline',exact:true});
  const edit=original?original.replace('A','Edited'):'  New\tlabel  ';await input.fill(edit);await input.press('Control+Enter');const accepted=await page.evaluate(()=>editor.document);assert.equal(await page.evaluate(path=>editor.get(path),fieldPath),edit);
  await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await page.evaluate(()=>editor.document),deck);await page.getByRole('button',{name:'Redo',exact:true}).click();assert.deepEqual(await page.evaluate(()=>editor.document),accepted);
  const date=page.locator('[data-canvas-target][data-opf-path="design.footer.left.date"]');await date.dblclick();input=page.getByRole('textbox',{name:'Edit date inline',exact:true});await input.fill('Literal date');await input.press('Control+Enter');assert.equal(await page.evaluate(()=>editor.document.design.footer.left.date),'Literal date');await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await page.evaluate(()=>editor.document),accepted);
  await page.getByRole('button',{name:'Export',exact:true}).click();await page.waitForFunction(()=>lastImport!==null||failures.length>0);
  assert.deepEqual(await page.evaluate(()=>failures),[]);
  const exported=await page.evaluate(()=>({bytes:Array.from(lastExport),imported:lastImport,source:editor.document}));
  assert.deepEqual(exported.source,accepted);
  const imported=exported.imported,importedHeader=imported.slides[0].design?.header??imported.design?.header,importedFooter=imported.slides[0].design?.footer??imported.design?.footer;
  assert.equal(importedHeader.left.text,edit);assert.equal(importedHeader.center.organization,true);assert.equal(importedHeader.right.section,true);
  assert.deepEqual(imported.organization,deck.organization);assert.equal(imported.slides[0].section,'Review');
  assert.equal(importedFooter.left.date,deck.design.footer.left.date);assert.equal(importedFooter.right.slideNumber,true);
  assert.deepEqual(await page.evaluate(()=>failures),[]);if(measured&&floor===32)await page.screenshot({path:path.join(output,`furniture-${width}-${local?'local':'inherited'}.png`),fullPage:true});
  results.push({measured,width,height,floor,local,path:fieldPath,original,accepted:edit,geometry,imported,pptxSha256:hash(new Uint8Array(exported.bytes))});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 await writeFile(path.join(output,'report.json'),JSON.stringify({node:process.version,mode:installed?'installed':'source',...(installed?{lockSha256:hash(await readFile(path.join(consumer,'package-lock.json'))),bundleInputs}:{}),browser:browser.version(),verifierSha256:hash(await readFile(new URL(import.meta.url))),bundleSha256:hash(bundle),results,errors,requests,scope:`${results.length} offline browser workflows verify readable shared furniture, actual source selection, no-op/edit/undo/redo, empty fields, literal dates and current-content PPTX reimport. Generated values remain bound to metadata. Native Office, full corpus visual review and release acceptance remain separate.`},null,2)+'\n');
 console.log(`${results.length} offline ${installed?'installed':'source'} furniture workflows passed: geometry, readability, source editing, generated values, empty fields, undo/redo and PPTX reimport.`);
}catch(error){await pageFailure(error);throw error;}finally{await browser.close();}
async function pageFailure(error){await writeFile(path.join(output,'failure.json'),JSON.stringify({activeCase,message:error.message,errors,requests},null,2)+'\n');}
