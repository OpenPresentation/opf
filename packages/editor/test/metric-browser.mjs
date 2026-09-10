import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {loadOfficeFontRegistry} from '@openpresentation/opf-render/fonts-node';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fingerprint=async()=>{
  const runtime={};
  for(const name of ['@openpresentation/opf','@openpresentation/opf-render','@openpresentation/opf-pptx','@openpresentation/opf-editor']){
    const root=path.dirname(fileURLToPath(import.meta.resolve(name+'/package.json')));
    const files=['package.json',...(await readdir(path.join(root,'dist'))).filter(file=>file.endsWith('.js')).sort().map(file=>'dist/'+file)];
    for(const file of files)runtime[name+'/'+file]=hash(await readFile(path.join(root,file)));
  }
  return runtime;
};
const runtime=await fingerprint();
const faces=(await loadOfficeFontRegistry()).embeddedFonts.filter(face=>/^Roboto(?: Medium| SemiBold| ExtraBold)?$/.test(face.family)&&!face.italic);
assert.deepEqual(faces.map(face=>face.weight).sort((a,b)=>a-b),[400,500,600,700,800]);
const bundled=await build({stdin:{resolveDir:fileURLToPath(new URL('../',import.meta.url)),contents:`
  import {createEditorSession} from './dist/index.js';
  import {createCanvasEditor} from './dist/canvas.js';
  import {loadBrowserFontRegistry} from '@openpresentation/opf-render/fonts-browser';
  import {toPptx,fromPptx} from '@openpresentation/opf-pptx';
  window.mountMetric=async({deck,faces})=>{
    window.metricCanvas?.destroy();window.fonts?.dispose();window.failures=[];window.lastExport=null;window.lastImport=null;window.diagnostics=[];
    window.fonts=await loadBrowserFontRegistry(faces.map(face=>({...face,data:Uint8Array.from(atob(face.dataUrl.split(',')[1]),c=>c.charCodeAt(0))})),{substitutionPolicy:'visual',fallbackFamily:'Roboto'});
    window.editor=createEditorSession(deck,{rejectInvalid:true});
    window.metricCanvas=createCanvasEditor(document.querySelector('#canvas'),{editor,renderOptions:{textMeasurement:fonts.textMeasurement},onError:error=>failures.push(error.message)});
    await metricCanvas.ready;
    const action=(id,run)=>document.getElementById(id).onclick=async()=>{try{await run();}catch(error){failures.push(error.message);}};
    action('undo',()=>editor.undo());action('redo',()=>editor.redo());
    action('paginate',()=>{metricCanvas.commit();window.pagination=editor.paginateSlide(0,{minFontSize:24,textMeasurement:fonts.textMeasurement});});
    action('export',async()=>{metricCanvas.commit();window.accepted=editor.composeSlide(0,{textMeasurement:fonts.textMeasurement});window.lastExport=await toPptx(editor.document,{textMeasurement:fonts.textMeasurement});});
    action('import',async()=>{window.lastImport=await fromPptx(lastExport,{onDiagnostic:d=>diagnostics.push(d)});editor.set('',lastImport,{rejectInvalid:true});});
  };`},bundle:true,platform:'browser',format:'iife',write:false,minify:true});
const bundle=bundled.outputFiles[0].text;
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined});
const errors=[],requests=[],results=[],scalarResults=[],invalidResults=[];
try {
  const page=await browser.newPage({viewport:{width:1440,height:1600}});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
  await page.setContent('<button id="undo">Undo</button><button id="redo">Redo</button><button id="paginate">Paginate</button><button id="export">Export</button><button id="import">Import</button><div id="canvas" style="width:800px"></div>');
  await page.addScriptTag({content:bundle});await page.context().setOffline(true);
  const document=()=>page.evaluate(()=>editor.document);
  const target=path=>page.locator(`[data-canvas-target][data-opf-path="${path}"]`);
  const edit=async(path,value)=>{
    await target(path).dblclick();
    const input=page.getByRole('textbox',{name:`Edit ${path.split('.').at(-1)} inline`,exact:true});
    if(value!==undefined)await input.fill(value);
    await input.press('Control+Enter');
  };
  for(const dimensions of [{width:1280,height:720},{width:540,height:960}])for(const alignment of ['left','center','right']){
    const metric={value:42,unit:'ms',label:'Left\tRight  ',description:'Exact\r\n\r\ncontext',delta:0,trend:'flat'};
    const deck={design:{fontScheme:'roboto',contentAlignment:alignment,dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96}},slides:[{metric}]};
    await page.evaluate(args=>mountMetric(args),{deck,faces});
    const geometry=await page.evaluate(()=>editor.composeSlide(0,{textMeasurement:fonts.textMeasurement}).items[0].metricLayout);
    assert.equal(geometry.alignment,alignment);
    for(const part of geometry.parts){
      assert.equal(await target(part.path).count(),1);
      const origins=await target(part.path).locator('text').evaluateAll(nodes=>nodes.map(node=>({x:Number(node.getAttribute('x')),baseline:Number(node.getAttribute('y'))})));
      assert.equal(origins.length,part.linePositions.length);
      for(const [i,origin] of origins.entries())for(const key of ['x','baseline'])assert.ok(Math.abs(origin[key]-part.linePositions[i][key])<=.00051,'SVG serializes accepted positions to three decimal places');
      await edit(part.path);assert.deepEqual(await document(),deck);
      assert.equal(await page.evaluate(()=>editor.canUndo),false,'Opening any metric field must preserve source and scalar types');
    }
    await target('slides.0.metric.description').dblclick();
    const input=page.getByRole('textbox',{name:'Edit description inline',exact:true});
    const selection=await input.evaluate(node=>{
      const style=getComputedStyle(node),svg=document.querySelector('#canvas svg');
      return {color:style.color,selectionColor:getComputedStyle(node,'::selection').color,start:node.selectionStart,end:node.selectionEnd,length:node.value.length,alignment:style.textAlign,lineHeight:parseFloat(style.lineHeight),width:parseFloat(style.width),scale:svg.getBoundingClientRect().width/svg.viewBox.baseVal.width};
    });
    assert.equal(selection.start,0);assert.equal(selection.end,selection.length);
    assert.notEqual(selection.color,'rgba(0, 0, 0, 0)');assert.equal(selection.color,selection.selectionColor);
    assert.equal(selection.alignment,alignment);
    const part=geometry.parts.find(p=>p.role==='description');
    assert.ok(Math.abs(selection.lineHeight/selection.scale-part.fit.lineHeight)<.01);
    assert.ok(Math.abs(selection.width/selection.scale-part.box.width)<.01);
    if(process.argv[2]&&alignment==='center')await page.locator('#canvas').screenshot({path:process.argv[2]+`.${dimensions.width}-selection.png`});
    const changed='Edited\r\n\r\ncontext';await input.fill(changed);await input.press('Control+Enter');
    assert.equal((await document()).slides[0].metric.description,changed);
    await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await document(),deck);
    await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal((await document()).slides[0].metric.description,changed);
    await edit('slides.0.metric.value','43');assert.equal((await document()).slides[0].metric.value,43);
    await edit('slides.0.metric.delta','1');assert.equal((await document()).slides[0].metric.delta,1);
    await edit('slides.0.metric.trend','down');assert.equal((await document()).slides[0].metric.trend,'down');
    await edit('slides.0.metric.unit','seconds');await edit('slides.0.metric.label','New\tLabel  ');
    const beforePagination=await document();
    await page.getByRole('button',{name:'Paginate',exact:true}).click();assert.equal((await document()).slides[0].composition.minFontSize,24);
    await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await document(),beforePagination);
    await page.getByRole('button',{name:'Redo',exact:true}).click();const accepted=await document();
    await page.getByRole('button',{name:'Export',exact:true}).click();await page.waitForFunction(()=>lastExport||failures.length);
    assert.deepEqual(await page.evaluate(()=>failures),[]);
    const bytes=await page.evaluate(()=>Array.from(lastExport));assert.ok(bytes.length>1000);
    await page.getByRole('button',{name:'Import',exact:true}).click();await page.waitForFunction(()=>lastImport||failures.length);
    assert.deepEqual((await document()).slides[0].blocks,[{type:'metric',metric:accepted.slides[0].metric}]);
    assert.ok((await page.evaluate(()=>diagnostics)).some(d=>d.code==='metric-import-reflow'));
    await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await document(),accepted);
    assert.deepEqual(await page.evaluate(()=>failures),[]);
    if(process.argv[2]&&alignment==='center')await page.locator('#canvas').screenshot({path:process.argv[2]+`.${dimensions.width}-accepted.png`});
    results.push({dimensions,alignment,selection,parts:geometry.parts.length,exactMetricRoundTrip:true,exportSha256:hash(new Uint8Array(bytes)),exportBytes:bytes.length,substitutions:await page.evaluate(()=>fonts.substitutions)});
  }
  for(const dimensions of [{width:1280,height:720},{width:540,height:960}])for(const metric of [0,'','\r\n\r\n\n','0.00']){
    const deck={design:{fontScheme:'roboto',contentAlignment:'right',dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96}},slides:[{metric}]};
    await page.evaluate(args=>mountMetric(args),{deck,faces});
    const body=target('slides.0.metric');assert.equal(await body.count(),1);assert.equal(await body.getAttribute('data-opf-metric-role'),'value');
    const part=await page.evaluate(()=>editor.composeSlide(0,{textMeasurement:fonts.textMeasurement}).items[0].metricLayout.parts[0]);
    if(typeof metric==='string'&&!metric.trim())assert.equal(Number(await body.locator(':scope > rect.opf-selection').getAttribute('height')),part.box.height+8);
    await edit('slides.0.metric');assert.deepEqual(await document(),deck);assert.equal(await page.evaluate(()=>editor.canUndo),false);
    await edit('slides.0.metric',typeof metric==='number'?'1':'Visible metric');
    assert.equal((await document()).slides[0].metric,typeof metric==='number'?1:'Visible metric');
    await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await document(),deck);
    scalarResults.push({dimensions,source:metric,type:typeof metric,noOpPreserved:true,editUndoPreserved:true});
  }
  for(const [field,value,invalid] of [['value',42,'not a number'],['trend','flat','sideways']]){
    const deck={design:{fontScheme:'roboto'},slides:[{metric:{value:42,trend:'flat'}}]};
    await page.evaluate(args=>mountMetric(args),{deck,faces});
    await target(`slides.0.metric.${field}`).dblclick();const input=page.getByRole('textbox',{name:`Edit ${field} inline`,exact:true});
    await input.fill(invalid);await input.press('Control+Enter');assert.deepEqual(await document(),deck);
    assert.ok(await input.isVisible());assert.equal(await page.evaluate(()=>editor.canUndo),false);
    assert.ok((await page.evaluate(()=>failures)).length>0);await input.press('Escape');assert.deepEqual(await document(),deck);
    invalidResults.push({field,original:value,rejected:invalid,cancelPreserved:true});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  assert.deepEqual(await fingerprint(),runtime,'Resolved package sources changed during browser verification');
  const report={mode:'resolved-package-browser',node:process.version,browser:browser.version(),platform:process.platform,runtime,bundleSha256:hash(bundle),verifierSha256:hash(await readFile(new URL(import.meta.url))),fontHashes:faces.map(face=>({family:face.family,weight:face.weight,italic:face.italic,sha256:hash(Buffer.from(face.dataUrl.split(',')[1],'base64'))})),results,scalarResults,invalidResults,errors,externalRequests:requests,
    scope:'Offline canvas with resolved dependencies: six wide/portrait/alignment metric workflows; exact accepted SVG origins and inline style, every metadata field, source/type/CRLF/tab/no-op preservation, readable selection, numeric/trend validation, atomic pagination undo, export and undoable metric reimport. Eight scalar/blank workflows and two rejected edits. Dependency mode must be bound by the caller; this report alone is not registry evidence. Native formatting, position/font recovery and native PowerPoint raster equivalence are not established.'};
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
  console.log(`Metric canvas: ${results.length} aligned workflows, ${scalarResults.length} scalar/blank edits and ${invalidResults.length} guarded rejections pass offline.`);
}finally{await browser.close();}
