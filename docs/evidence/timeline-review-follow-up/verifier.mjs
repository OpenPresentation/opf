import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire('/Users/michael/Source/opf-render/package.json');
const {build}=require('esbuild'),{chromium}=require('playwright');
import {prepareNodeFonts} from '/Users/michael/Source/opf-render/dist/fonts-node.js';
const output=path.resolve(process.argv[2]??'artifacts/timeline-workflow');await mkdir(output,{recursive:true});
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
const bundle=built.outputFiles[0].text,browser=await chromium.launch(),results=[],errors=[],requests=[];let activeCase;
try {
 const page=await browser.newPage({viewport:{width:1400,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
 await page.setContent('<button id="undo">Undo</button><button id="redo">Redo</button><button id="export">Export</button><div id="canvas" style="width:900px"></div>');await page.addScriptTag({content:bundle});
 for(const measured of [false,true])for(const [width,height]of [[1280,720],[720,1280]])for(const fixture of [0,1,2,3]) {
  const original=fixture===2?'':'  A  B\tC\u00a0D\r\n\r\ntrail  \r';
  let fieldPath,timeline,slide;
  if(fixture===0){timeline=[{when:' Q1 ',what:original,description:'Keep this context.'},{what:'Next milestone'}];fieldPath='slides.0.timeline.0.what';slide={timeline};}
  if(fixture===1){timeline={name:'Plan',description:original,events:[{when:'Q1',what:'Pilot'},{what:'Expand'}]};fieldPath='slides.0.timeline.description';slide={timeline};}
  if(fixture===2){timeline={events:[{when:original,what:'Existing label',description:'Blank labels remain editable.'}]};fieldPath='slides.0.blocks.0.blocks.0.timeline.events.0.when';slide={blocks:[{blocks:[{timeline}]},{text:'Keep this neighboring source.'}],composition:{mode:'row',weights:[2,1]}};}
  if(fixture===3){timeline={events:[{when:'Q1',what:'Pilot',description:'Keep all source detail and enough readable space for this milestone.'},{when:'Q2',what:'Expand',description:'Keep all source detail and enough readable space for this milestone.'}]};fieldPath='slides.0.blocks.0.timeline.events.0.what';slide={blocks:[{timeline},{text:'Keep this neighboring source.'}],composition:{mode:'row',weights:[1,4]}};}
  const actualOriginal=fixture===3?'Pilot':original;
  slide={title:'Timeline editing',...slide,composition:{...slide.composition,minFontSize:24,overflow:'error'}};
  const deck={design:{fontScheme:'roboto',dimensions:{widthInches:width/96,heightInches:height/96}},slides:[slide]};
  activeCase={measured,width,height,fixture,deck};
  await page.evaluate(args=>mount(args),{deck,faces:registry.embeddedFonts,measured});
  const geometry=await page.evaluate(async()=>{
   await document.fonts.ready;
   const context=document.createElement('canvas').getContext('2d');
   return editor.composeSlide(0,renderOptions).items.filter(item=>item.timelineLayout).map(item=>({cell:item.box,layout:item.timelineLayout,parts:item.timelineLayout.parts.map(part=>{
    const group=[...document.querySelectorAll('[data-opf-source-text]')].find(node=>node.getAttribute('data-opf-path')===part.path);
    return {path:part.path,lines:[...group.querySelectorAll('text')].map(node=>{
     const box=node.getBBox(),style=getComputedStyle(node),segments=node.children.length?[...node.children]:[node];
     context.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
     const ink=segments.filter(segment=>segment.textContent.trim()).map(segment=>{
      const metrics=context.measureText(segment.textContent),width=segment.hasAttribute('textLength')?Number(segment.getAttribute('textLength')):metrics.width,ratio=metrics.width?width/metrics.width:1;
      const anchor=node.getAttribute('text-anchor'),factor=anchor==='middle'?.5:anchor==='end'?1:0,x=Number(segment.getAttribute('x'))-width*factor,baseline=Number(node.getAttribute('y'));
      return {x:x-metrics.actualBoundingBoxLeft*ratio,y:baseline-metrics.actualBoundingBoxAscent,width:(metrics.actualBoundingBoxLeft+metrics.actualBoundingBoxRight)*ratio,height:metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent};
     });
     return {text:node.textContent,size:parseFloat(style.fontSize),x:box.x,y:box.y,width:box.width,height:box.height,ink,start:Number(node.getAttribute('data-opf-source-start')),end:Number(node.getAttribute('data-opf-source-end'))};
    })};
   })}));
  });
  for(const item of geometry){
   assert.deepEqual(item.layout.diagnostics,[]);assert.ok(item.layout.attempts<=50);
   for(const actual of item.parts){const part=item.layout.parts.find(part=>part.path===actual.path);assert.equal(actual.lines.length,part.fit.sourceLines.length);
    for(const [index,line]of actual.lines.entries()){
     assert.equal(line.text,part.text.slice(line.start,line.end));assert.equal(line.start,part.fit.sourceLines[index].start);assert.equal(line.end,part.fit.sourceLines[index].end);assert.ok(line.size+1e-4>=24);
     // SVG getBBox includes font line extents beyond painted glyphs. Independently
     // check browser actual glyph metrics with SVG positions/length adjustments;
     // this is neither a raster comparison nor proof of native font identity.
     if(measured)for(const ink of line.ink){const b=part.box;assert.ok(ink.x>=b.x-.05&&ink.y>=b.y-.05&&ink.x+ink.width<=b.x+b.width+.05&&ink.y+ink.height<=b.y+b.height+.05,JSON.stringify({measured,width,height,fixture,path:part.path,line,box:b}));}
    }
   }
  }
  const target=page.locator(`[data-canvas-target][data-opf-path="${fieldPath}"]`);assert.equal(await target.count(),1);
  const selected=await page.evaluate(path=>{const layout=editor.composeSlide(0,renderOptions).items.find(item=>item.timelineLayout?.parts.some(part=>part.path===path)).timelineLayout;return {arrangement:layout.arrangement,part:layout.parts.find(part=>part.path===path)};},fieldPath);
  if(!actualOriginal){const selection=await target.locator(':scope > rect.opf-selection').evaluate(n=>({x:+n.getAttribute('x'),y:+n.getAttribute('y'),width:+n.getAttribute('width'),height:+n.getAttribute('height')}));assert.equal(selection.x,selected.part.box.x-4);assert.equal(selection.y,selected.part.box.y-4);assert.equal(selection.width,selected.part.box.width+8);assert.equal(selection.height,selected.part.box.height+8);}
  await target.dblclick();let input=page.getByRole('textbox',{name:`Edit ${fieldPath.split('.').at(-1)} inline`,exact:true});await input.press('Control+Enter');assert.equal(await page.evaluate(path=>editor.get(path),fieldPath),actualOriginal);assert.equal(await page.evaluate(()=>editor.canUndo),false);
  await target.dblclick();input=page.getByRole('textbox',{name:`Edit ${fieldPath.split('.').at(-1)} inline`,exact:true});
  const edit=fixture===3?'Edited pilot':actualOriginal?actualOriginal.replace('A','Edited'):'  New\tlabel  \r\n';await input.fill(edit);await input.press('Control+Enter');
  const accepted=await page.evaluate(()=>editor.document),expected=actualOriginal?edit:edit.replace(/\r\n/g,'\n');assert.equal(await page.evaluate(path=>editor.get(path),fieldPath),expected);
  await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await page.evaluate(()=>editor.document),deck);await page.getByRole('button',{name:'Redo',exact:true}).click();assert.deepEqual(await page.evaluate(()=>editor.document),accepted);
  await page.getByRole('button',{name:'Export',exact:true}).click();await page.waitForFunction(()=>lastImport||failures.length);assert.deepEqual(await page.evaluate(()=>failures),[]);
  const imported=await page.evaluate(()=>lastImport),findTimeline=value=>value.timeline??value.blocks?.map(findTimeline).find(Boolean);
  assert.deepEqual(findTimeline(imported.slides[0]),findTimeline(accepted.slides[0]));assert.equal(imported.slides[0].title,accepted.slides[0].title);
  if(fixture===0){await target.dblclick();input=page.getByRole('textbox',{name:'Edit what inline',exact:true});await input.evaluate(n=>n.setSelectionRange(n.value.length,n.value.length));await input.pressSequentially(' added');await input.press('Control+Enter');assert.equal(await page.evaluate(path=>editor.get(path),fieldPath),expected+' added');await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await page.evaluate(()=>editor.document),accepted);}
  if(measured&&(fixture===0||fixture===3))await page.screenshot({path:path.join(output,`fixture-${fixture}-${width}.png`),fullPage:true});
  results.push({measured,width,height,fixture,path:fieldPath,original:actualOriginal,accepted:expected,arrangement:selected.arrangement,part:selected.part,geometry,exportSha256:hash(new Uint8Array(await page.evaluate(()=>Array.from(lastExport))))});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 await writeFile(path.join(output,'report.json'),JSON.stringify({node:process.version,browser:browser.version(),installed,lockSha256:installed?hash(await readFile(path.join(consumer,'package-lock.json'))):undefined,verifierSha256:hash(await readFile(new URL(import.meta.url))),bundleSha256:hash(bundle),results,errors,requests,scope:'16 offline timeline workflows: actual array/object/nested source selection, no-op, editing, undo/redo and semantic PPTX reimport, with mixed source boundaries and four additional keyboard controls. Native formatting/geometry are not reconstructed. No native Office execution.'},null,2)+'\n');
 console.log('16 offline timeline workflows preserve source fields through selection, editing, undo/redo and semantic PPTX reimport.');
}catch(error){await writeFile(path.join(output,'failure.json'),JSON.stringify({activeCase,message:error.message,errors,requests},null,2)+'\n');throw error;}finally{await browser.close();}
