import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../opf-render/package.json',import.meta.url));
const {build}=require('esbuild'),{chromium}=require('playwright');
import {prepareNodeFonts} from '../../opf-render/dist/fonts-node.js';
const output=path.resolve(process.argv[2]??'artifacts/furniture-workflow');await mkdir(output,{recursive:true});
const {registry}=await prepareNodeFonts(),hash=value=>createHash('sha256').update(value).digest('hex');
const contents=`
 import {createEditorSession} from '../opf-editor/dist/index.js';
 import {createCanvasEditor} from '../opf-editor/dist/canvas.js';
 import {loadBrowserFontRegistry} from '../opf-render/dist/fonts-browser.js';
 window.mount=async({deck,faces,measured})=>{
  window.canvasEditor?.destroy();window.fonts?.dispose();window.failures=[];
  window.fonts=await loadBrowserFontRegistry(faces.map(face=>({...face,data:Uint8Array.from(atob(face.dataUrl.split(',')[1]),c=>c.charCodeAt(0))})),{substitutionPolicy:'visual',fallbackFamily:'Roboto'});
  window.editor=createEditorSession(deck,{rejectInvalid:true});window.renderOptions=measured?{textMeasurement:fonts.textMeasurement}:{};
  window.canvasEditor=createCanvasEditor(document.querySelector('#canvas'),{editor,renderOptions,onError:e=>failures.push(e.message)});await canvasEditor.ready;
  document.getElementById('undo').onclick=()=>editor.undo();document.getElementById('redo').onclick=()=>editor.redo();
 };`;
const built=await build({stdin:{resolveDir:process.cwd(),contents},bundle:true,platform:'browser',format:'iife',write:false});
const bundle=built.outputFiles[0].text,browser=await chromium.launch(),results=[],errors=[],requests=[];let activeCase;
try{
 const page=await browser.newPage({viewport:{width:1400,height:1100}});
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
 await page.setContent('<button id="undo">Undo</button><button id="redo">Redo</button><div id="canvas" style="width:900px"></div>');await page.addScriptTag({content:bundle});
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
  assert.deepEqual(await page.evaluate(()=>failures),[]);if(measured&&floor===32)await page.screenshot({path:path.join(output,`furniture-${width}-${local?'local':'inherited'}.png`),fullPage:true});
  results.push({measured,width,height,floor,local,path:fieldPath,original,accepted:edit,geometry});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 await writeFile(path.join(output,'report.json'),JSON.stringify({node:process.version,browser:browser.version(),verifierSha256:hash(await readFile(new URL(import.meta.url))),bundleSha256:hash(bundle),results,errors,requests,scope:'32 offline browser workflows verify readable shared furniture, actual source selection, no-op/edit/undo/redo, empty fields and literal dates. Generated values remain bound to metadata. No PPTX or native Office claim.'},null,2)+'\n');
 console.log('32 offline furniture workflows passed: geometry, readability, source editing, generated values, empty fields and undo/redo.');
}catch(error){await pageFailure(error);throw error;}finally{await browser.close();}
async function pageFailure(error){await writeFile(path.join(output,'failure.json'),JSON.stringify({activeCase,message:error.message,errors,requests},null,2)+'\n');}
