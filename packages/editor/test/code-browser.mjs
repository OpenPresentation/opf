import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {loadOfficeFontRegistry} from '@openpresentation/opf-render/fonts-node';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const faces=(await loadOfficeFontRegistry()).embeddedFonts.filter(face=>['Roboto','Roboto Mono'].includes(face.family)&&[400,700].includes(face.weight)&&!face.italic);
const bundled=await build({stdin:{resolveDir:fileURLToPath(new URL('../',import.meta.url)),contents:`
  import {createEditorSession} from './dist/index.js';
  import {createCanvasEditor} from './dist/canvas.js';
  import {loadBrowserFontRegistry} from '@openpresentation/opf-render/fonts-browser';
  import {toPptx,fromPptx} from '@openpresentation/opf-pptx';
  window.mountCode=async({deck,faces})=>{
    window.codeCanvas?.destroy();window.fonts?.dispose();window.failures=[];window.lastExport=null;window.lastImport=null;
    // Use the existing playground's explicit fallback policy; import currently
    // loses its original font scheme, which remains a separate fidelity gap.
    window.fonts=await loadBrowserFontRegistry(faces.map(face=>({...face,data:Uint8Array.from(atob(face.dataUrl.split(',')[1]),c=>c.charCodeAt(0))})),{substitutionPolicy:'visual',fallbackFamily:'Roboto'});
    window.editor=createEditorSession(deck,{rejectInvalid:true});
    window.codeCanvas=createCanvasEditor(document.querySelector('#canvas'),{editor,renderOptions:{textMeasurement:fonts.textMeasurement},onError:error=>failures.push(error.message)});
    await codeCanvas.ready;
    const action=(id,run)=>document.getElementById(id).onclick=async()=>{try{await run();}catch(error){failures.push(error.message);}};
    action('undo',()=>editor.undo());action('redo',()=>editor.redo());
    action('paginate',()=>{codeCanvas.commit();window.pagination=editor.paginateSlide(0,{minFontSize:24,textMeasurement:fonts.textMeasurement});});
    action('export',async()=>{codeCanvas.commit();window.accepted=editor.composeSlide(0,{textMeasurement:fonts.textMeasurement});window.lastExport=await toPptx(editor.document,{textMeasurement:fonts.textMeasurement});});
    action('import',async()=>{window.lastImport=await fromPptx(lastExport);editor.set('',lastImport,{rejectInvalid:true});});
  };`},bundle:true,platform:'browser',format:'iife',write:false,minify:true});
const bundle=bundled.outputFiles[0].text,browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined});
const errors=[],requests=[],results=[],blankTargets=[];
try {
  const page=await browser.newPage({viewport:{width:1440,height:1200}});page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
  await page.setContent('<button id="undo">Undo</button><button id="redo">Redo</button><button id="paginate">Paginate</button><button id="export">Export</button><button id="import">Import</button><div id="canvas" style="width:1000px"></div>');
  await page.addScriptTag({content:bundle});await page.context().setOffline(true);
  const document=()=>page.evaluate(()=>editor.document);
  const visibleSelection=async input=>{
    const state=await input.evaluate(node=>({color:getComputedStyle(node).color,selectionColor:getComputedStyle(node,'::selection').color,start:node.selectionStart,end:node.selectionEnd,length:node.value.length}));
    assert.equal(state.start,0);assert.equal(state.end,state.length);assert.ok(state.length>0);
    assert.notEqual(state.color,'rgba(0, 0, 0, 0)');assert.equal(state.selectionColor,state.color,'Selected code must stay visible while its canonical SVG is hidden');
    return state;
  };
  for(const dimensions of [{width:1280,height:720},{width:540,height:960}]) {
    const source='\tconst value = "two  spaces";  \r\n\r\nreturn value;\r\n';
    const deck={design:{fontScheme:'roboto',dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96}},slides:[{code:{source,filename:'src/CaseSensitive.ts',language:'TypeScript'}}]};
    await page.evaluate(args=>mountCode(args),{deck,faces});
    const body=page.locator('[data-canvas-target][data-opf-path="slides.0.code.source"]');
    await body.dblclick();let input=page.getByRole('textbox',{name:'Edit source inline',exact:true});
    const sourceSelection=await visibleSelection(input);
    await input.press('Control+Enter');assert.deepEqual(await document(),deck);assert.equal(await page.evaluate(()=>editor.canUndo),false,'Opening CRLF source must not create an edit');
    await body.dblclick();input=page.getByRole('textbox',{name:'Edit source inline',exact:true});
    const editedSource=source.replace('const value','const renamed');
    await input.fill(editedSource);await input.press('Control+Enter');assert.equal((await document()).slides[0].code.source,editedSource);
    await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await document(),deck);
    await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal((await document()).slides[0].code.source,editedSource);
    const filename=page.locator('[data-canvas-target][data-opf-path="slides.0.code.filename"]');await filename.dblclick();
    const filenameSelection=await visibleSelection(page.getByRole('textbox',{name:'Edit filename inline',exact:true}));
    await page.getByRole('textbox',{name:'Edit filename inline',exact:true}).fill('src/Renamed.ts');await page.getByRole('textbox',{name:'Edit filename inline',exact:true}).press('Control+Enter');
    assert.equal((await document()).slides[0].code.filename,'src/Renamed.ts');
    await body.dblclick();input=page.getByRole('textbox',{name:'Edit source inline',exact:true});await input.press('ArrowRight');await input.press('Tab');
    assert.ok((await input.inputValue()).endsWith('\t'),'Tab inserts a literal source tab');await input.press('Escape');assert.equal((await document()).slides[0].code.source,editedSource);
    const beforePagination=await document();await page.getByRole('button',{name:'Paginate',exact:true}).click();assert.equal((await document()).slides[0].composition.minFontSize,24);
    await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await document(),beforePagination);
    await page.getByRole('button',{name:'Redo',exact:true}).click();const accepted=await document();
    // Selecting source text must not expose invalid rich-formatting operations.
    for(const role of ['body','filename','language']){
      await page.evaluate(role=>{const node=[...document.querySelectorAll('text[data-opf-code-role="'+role+'"] tspan')].find(node=>/\S/.test(node.textContent));if(!node?.firstChild)throw Error('Missing code text span');const range=document.createRange();range.setStart(node.firstChild,0);range.setEnd(node.firstChild,node.textContent.length);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));},role);
      assert.equal(await page.getByRole('toolbar',{name:'Text formatting'}).isVisible(),false,role+' must stay plain when selecting its nested text node');
      assert.deepEqual(await document(),accepted);
    }
    await page.getByRole('button',{name:'Export',exact:true}).click();await page.waitForFunction(()=>lastExport||failures.length);assert.deepEqual(await page.evaluate(()=>failures),[]);
    const bytes=await page.evaluate(()=>Array.from(lastExport));assert.ok(bytes.length>1000);
    await page.getByRole('button',{name:'Import',exact:true}).click();await page.waitForFunction(()=>lastImport||failures.length);assert.deepEqual(await page.evaluate(()=>failures),[]);
    const imported=await document();assert.deepEqual(imported,await page.evaluate(()=>lastImport));
    const displayed=await page.evaluate(()=>accepted.items[0].codeLayout.parts.flatMap(part=>part.fit.lines));
    assert.deepEqual(imported.slides[0].blocks,[{type:'code',code:accepted.slides[0].code}],'Code semantics, metadata and every source newline round-trip exactly');
    await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await document(),accepted);
    assert.deepEqual(await page.evaluate(()=>failures),[]);
    results.push({dimensions,exportSha256:hash(new Uint8Array(bytes)),exportBytes:bytes.length,acceptedLines:displayed.length,exactCodeRoundTrip:true,selectionVisibility:{source:sourceSelection,filename:filenameSelection},substitutions:await page.evaluate(()=>fonts.substitutions)});
  }
  // A shorthand value targets its body; the generated "code" label is not an editable source line.
  await page.evaluate(args=>mountCode(args),{faces,deck:{design:{fontScheme:'roboto'},slides:[{code:'\tshorthand\r\n'}]}});
  const target=page.locator('[data-canvas-target][data-opf-path="slides.0.code"]');assert.equal(await target.count(),1);assert.equal(await target.getAttribute('data-opf-code-role'),'body');
  await target.dblclick();await page.getByRole('textbox',{name:'Edit code inline',exact:true}).press('Control+Enter');assert.equal(await page.evaluate(()=>editor.get('slides.0.code')),'\tshorthand\r\n');assert.equal(await page.evaluate(()=>editor.canUndo),false);
  for(const dimensions of [{width:1280,height:720},{width:540,height:960}]){
    const blank='\r\n\r\n\n',deck={design:{fontScheme:'roboto',dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96}},slides:[{code:blank}]};
    await page.evaluate(args=>mountCode(args),{faces,deck});
    const body=page.locator('[data-canvas-target][data-opf-path="slides.0.code"]');
    const accepted=await page.evaluate(()=>editor.composeSlide(0,{textMeasurement:fonts.textMeasurement}).items[0].codeLayout.parts.find(part=>part.role==='body'));
    const selection=body.locator(':scope > rect.opf-selection');
    assert.equal(Number(await selection.getAttribute('height')),accepted.box.height+8,'Entire blank code part must remain selectable');
    await body.dblclick();let input=page.getByRole('textbox',{name:'Edit code inline',exact:true});
    await input.press('Control+Enter');assert.deepEqual(await document(),deck);assert.equal(await page.evaluate(()=>editor.canUndo),false);
    await body.dblclick();input=page.getByRole('textbox',{name:'Edit code inline',exact:true});
    await input.fill('Visible code');await input.press('Control+Enter');assert.equal((await document()).slides[0].code,'Visible code');
    await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await document(),deck);
    blankTargets.push({dimensions,acceptedHeight:accepted.box.height,selectableHeight:accepted.box.height+8,noOpPreserved:true,editUndoPreserved:true});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  const report={browser:browser.version(),platform:process.platform,bundleSha256:hash(bundle),verifierSha256:hash(await readFile(new URL(import.meta.url))),fontHashes:faces.map(face=>({family:face.family,weight:face.weight,italic:face.italic,sha256:hash(Buffer.from(face.dataUrl.split(',')[1],'base64'))})),results,blankTargets,errors,externalRequests:requests,
    scope:'Offline candidate canvas: real pointer/keyboard code and filename edits, CRLF no-op/preservation, tab insertion/cancel, undo/redo, one-page pagination/readability undo, browser native export and undoable exact code/metadata/source-boundary reimport. Native formatting, positioning and font scheme are not reconstructed; font fallback uses the existing playground policy and is recorded. No native PowerPoint or raster equivalence claim.'};
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
  console.log('Code canvas: wide/portrait source editing, metadata, CRLF, tabs, pagination, undo, offline export and bounded reimport checks pass.');
} finally {await browser.close();}
