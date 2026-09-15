import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.resolve(process.argv[2]??path.join(root,'artifacts/rich-input-browser.json'));
const mode=process.argv[3]??'measured';assert.ok(['measured','estimated','painted'].includes(mode));
const consumer=process.argv[4]?await realpath(process.argv[4]):null;
const runtimeRoot=consumer??root,resolveRuntime=createRequire(path.join(runtimeRoot,'package.json'));
const within=(parent,file)=>{const relative=path.relative(parent,file);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);};
assert.ok(!process.env.NODE_OPTIONS&&!process.execArgv.some(arg=>/^(--import|--loader|--experimental-loader|--require|-r)(=|$)/.test(arg)),'No runtime aliases in browser verification');
const modules=consumer?await realpath(path.join(consumer,'node_modules')):null;
if(consumer)assert.ok(within(consumer,modules));
const fontModule=await realpath(resolveRuntime.resolve('@openpresentation/opf-render/fonts-node'));
if(modules)assert.ok(within(modules,fontModule),'Font preparation must use the installed renderer');
const {loadOfficeFontRegistry}=await import(pathToFileURL(fontModule).href);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const nodeFonts=await loadOfficeFontRegistry();
const faces=nodeFonts.embeddedFonts.filter(face=>face.family==='Arimo'&&[400,700].includes(face.weight));
nodeFonts.dispose?.();
const bundled=await build({stdin:{resolveDir:runtimeRoot,contents:`
  import {createEditorSession} from '@openpresentation/opf-editor';
  import {createCanvasEditor} from '@openpresentation/opf-editor/canvas';
  import {loadBrowserFontRegistry} from '@openpresentation/opf-render/fonts-browser';
  ${mode==='painted'?"import {loadHarfBuzzShaper} from '@openpresentation/opf-render/font-shaping-browser';":''}
  window.mountRich=async({deck,faces})=>{
    window.canvas?.destroy();window.fonts?.dispose();window.failures=[];
    window.fonts=await loadBrowserFontRegistry(faces.map(face=>({...face,data:Uint8Array.from(atob(face.dataUrl.split(',')[1]),c=>c.charCodeAt(0))})),
      ${mode==='painted'?'{fontShaper:await loadHarfBuzzShaper()}':'{}'});
    ${mode==='painted'?"if(!fonts.textPainting)throw Error('Prepared painting is required in painted mode');":''}
    window.editor=createEditorSession(deck,{rejectInvalid:true});
    window.canvas=createCanvasEditor(document.querySelector('#host'),{editor,
      renderOptions:${mode==='estimated'?'{}':mode==='painted'?'{textMeasurement:fonts.textMeasurement,textPainting:fonts.textPainting,embeddedFonts:fonts.embeddedFonts}':'{textMeasurement:fonts.textMeasurement}'},
      onError:error=>failures.push(error.message)});
    await canvas.ready;
  };`},bundle:true,platform:'browser',format:'esm',write:false,minify:true,metafile:true});
const bundle=bundled.outputFiles[0].text,inputs={};
for(const [file,metadata] of Object.entries(bundled.metafile.inputs))if(file!=='<stdin>'){
  if(file.startsWith('(disabled):')){assert.equal(metadata.bytes,0);assert.deepEqual(metadata.imports,[]);continue;}
  const actual=await realpath(path.resolve(file));
  if(modules)assert.ok(within(modules,actual),'Browser runtime must come from installed packages: '+file);
  inputs[actual]=hash(await readFile(actual));
}
const wasm=mode==='painted'?await readFile(resolveRuntime.resolve('@openpresentation/opf-render/harfbuzz.wasm')):null;
const lockBytes=consumer?await readFile(path.join(consumer,'package-lock.json')):null;
const packages={};
for(const name of ['opf','opf-render','opf-editor']){
  const file=await realpath(resolveRuntime.resolve('@openpresentation/'+name+'/package.json'));
  if(modules)assert.ok(within(modules,file),'No linked source packages');
  const manifest=JSON.parse(await readFile(file,'utf8'));packages[manifest.name]={version:manifest.version,manifestSha256:hash(await readFile(file))};
}
const browser=await chromium.launch();
const report={node:process.version,browser:browser.version(),platform:process.platform,mode,status:'running',
  bundleSha256:hash(bundle),verifierSha256:hash(await readFile(new URL(import.meta.url))),inputs,
  runtime:consumer?'installed':'checkout',packages,fontModuleSha256:hash(await readFile(fontModule)),...(lockBytes?{lockSha256:hash(lockBytes)}:{}),
  fonts:faces.map(face=>({family:face.family,weight:face.weight,italic:face.italic,sha256:hash(Buffer.from(face.dataUrl.split(',')[1],'base64'))})),
  ...(wasm?{wasmSha256:hash(wasm)}:{}),checks:[],errors:[],externalRequests:[],
  scope:'Actual offline Chromium keyboard and pointer editing with loaded fonts, original source traces, mixed line endings, formatting, draft/session undo, concurrency, cancellation and simulated composition. Caret positions are compared to logical SVG DOM ranges. This does not establish real operating-system IME, bidi, glyph-paint/caret equivalence or native PowerPoint fidelity.'};
let page;
try{
  page=await browser.newPage({viewport:{width:1400,height:1000}});
  page.on('pageerror',error=>report.errors.push(error.message));
  await page.route('**/*',route=>{
    const url=route.request().url();
    if(url==='https://opf-rich.test/')return route.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}#host{width:1100px}</style><div id="host"></div>'});
    if(url==='https://opf-rich.test/harfbuzz.wasm'&&wasm)return route.fulfill({contentType:'application/wasm',body:wasm});
    report.externalRequests.push(url);return route.abort();
  });
  await page.goto('https://opf-rich.test/');await page.addScriptTag({type:'module',content:bundle});
  const paint=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const original=[{text:'First\r\n',bold:true,link:'https://example.org',fontSize:24},{text:'Second\rThird',italic:true,fontSize:24}];
  const deckFor=text=>({name:'Keep deck metadata',design:{fontScheme:{id:'roboto',heading:{family:'Arimo'},body:{family:'Arimo'},code:{family:'Arimo'}}},slides:[{id:'rich',text,notes:'Keep notes'}],extensions:{keep:{value:42}}});
  const deck=deckFor(original),document=()=>page.evaluate(()=>editor.document);
  const text=()=>page.evaluate(()=>editor.get('slides.0.text'));
  const input=()=>page.getByRole('textbox',{name:'Edit rich text inline',exact:true});
  const mount=async value=>{await page.evaluate(args=>mountRich(args),{deck:value,faces});await paint();};
  const begin=async()=>{await page.locator('[data-canvas-target][data-opf-path="slides.0.text"]').dblclick();await paint();assert.equal(await input().count(),1);};
  const select=async(start,end=start)=>{await input().evaluate((node,{start,end})=>{node.setSelectionRange(start,end);node.dispatchEvent(new Event('select'));},{start,end});await paint();};
  const commit=async()=>{await input().press('Control+Enter');await paint();assert.equal(await input().count(),0);};
  const passed=async(name,details={})=>{assert.deepEqual(await page.evaluate(()=>failures),[],name);report.checks.push({name,...details});};
  const assertTrace=async source=>{
    const fragments=await page.locator('.opf-canvas-preview text[data-opf-text-start],.opf-canvas-preview tspan[data-opf-text-start]').evaluateAll(nodes=>nodes.map(node=>({text:node.textContent,start:Number(node.dataset.opfTextStart),end:Number(node.dataset.opfTextEnd),top:node.getBoundingClientRect().top})));
    assert.ok(fragments.length);for(const part of fragments)assert.equal(part.text,source.slice(part.start,part.end),'SVG trace must use original source offsets');
    return fragments;
  };
  const point=offset=>page.evaluate(offset=>{
    const node=[...document.querySelectorAll('.opf-canvas-preview text[data-opf-text-start],.opf-canvas-preview tspan[data-opf-text-start]')].find(n=>Number(n.dataset.opfTextStart)<=offset&&Number(n.dataset.opfTextEnd)>offset);
    if(!node?.firstChild)throw Error('No source fragment at '+offset);
    const start=offset-Number(node.dataset.opfTextStart),range=document.createRange();range.setStart(node.firstChild,start);range.setEnd(node.firstChild,start+1);
    const box=range.getBoundingClientRect();return {x:box.left,y:box.top+box.height/2,top:box.top};
  },offset);
  const caretAt=async(sourceOffset,nativeOffset)=>{
    await select(nativeOffset);const expected=await point(sourceOffset),actual=await page.locator('.opf-rich-caret').boundingBox();
    assert.ok(actual);assert.ok(Math.abs(actual.x-expected.x)<1&&Math.abs(actual.y-expected.top)<1,'Caret must follow the source fragment after a normalized newline');
    return {sourceOffset,nativeOffset,dx:actual.x-expected.x,dy:actual.y-expected.top};
  };

  await mount(deck);await begin();assert.equal(await input().inputValue(),'First\nSecond\nThird');await commit();
  assert.deepEqual(await document(),deck);assert.equal(await page.evaluate(()=>editor.canUndo),false);await passed('Opening normalized native input is an exact source no-op');
  await begin();await select(18);await input().pressSequentially('!');await paint();
  assert.deepEqual(await document(),deck);await assertTrace('First\r\nSecond\rThird!');
  await input().press('Control+z');await paint();assert.equal(await input().inputValue(),'First\nSecond\nThird');
  await input().press('Control+Shift+z');await paint();assert.equal(await input().inputValue(),'First\nSecond\nThird!');
  await page.evaluate(()=>editor.set('slides.0.notes','Concurrent notes'));await commit();
  assert.deepEqual(await document(),{...deck,slides:[{...deck.slides[0],notes:'Concurrent notes',text:[original[0],{...original[1],text:'Second\rThird!'}]}]});
  await page.evaluate(()=>editor.undo());assert.deepEqual(await text(),original);assert.equal((await document()).slides[0].notes,'Concurrent notes');
  await passed('Typing preserves runs and metadata, live drafts, draft undo/redo and one session undo');

  await mount(deck);await begin();await select(5,6);await input().press('Backspace');await commit();
  assert.deepEqual(await text(),[{...original[0],text:'First'},original[1]]);await passed('Deleting one native newline removes the complete source CRLF');
  await mount(deck);await begin();await select(18);await input().press('Enter');await input().pressSequentially('Tail');await commit();
  assert.deepEqual(await text(),[original[0],{...original[1],text:'Second\rThird\r\nTail'}]);await passed('New native line breaks use the source ending without rewriting earlier CR');

  await mount(deck);await begin();const carets=[await caretAt(7,6),await caretAt(14,13)];
  const start=await point(7);
  await page.mouse.click(start.x,start.y);assert.equal(await input().evaluate(node=>node.selectionStart),6);
  const third=await point(16);await page.keyboard.down('Shift');await page.mouse.click(third.x,third.y);await page.keyboard.up('Shift');
  assert.deepEqual(await input().evaluate(node=>[node.selectionStart,node.selectionEnd]),[6,15]);
  await page.mouse.move(third.x,third.y);await page.mouse.down();await page.mouse.move(start.x,start.y,{steps:8});await page.mouse.up();
  assert.deepEqual(await input().evaluate(node=>[node.selectionStart,node.selectionEnd,node.selectionDirection]),[6,15,'backward']);
  await passed('Forward and reverse pointer selection maps original source to native offsets',{carets});
  await select(6,12);await page.getByRole('button',{name:'Format selection',exact:true}).click();await paint();
  assert.equal(await page.getByRole('textbox',{name:'Selected text',exact:true}).inputValue(),'Second');
  await page.getByRole('button',{name:'Bold',exact:true}).click();await paint();
  assert.deepEqual(await text(),[original[0],{...original[1],text:'Second',bold:true},{...original[1],text:'\rThird'}]);
  await page.evaluate(()=>editor.undo());assert.deepEqual(await document(),deck);await passed('Formatting after CRLF changes precisely the selected source range and undoes exactly');

  const paragraph='AVATAR office affine o\u0302\u0301 with mixed styles and wrapping. '.repeat(4);
  const wrapped=[{text:'Heading\r\n',bold:true,fontSize:24},{text:paragraph,italic:true,fontSize:24},{text:'\rLast  line  ',underline:true,fontSize:24,link:'https://example.org/last'}];
  await mount(deckFor(wrapped));await begin();const source=wrapped.map(run=>run.text).join(''),parts=await assertTrace(source);
  assert.ok(new Set(parts.map(part=>part.top)).size>=4,'Fixture must actually wrap');
  const wrappedCaret=await caretAt(parts.find(part=>part.start>9&&part.text.trim()).start,source.slice(0,parts.find(part=>part.start>9&&part.text.trim()).start).replace(/\r\n|\r/g,'\n').length);
  await select((await input().inputValue()).length);await input().pressSequentially('!');await commit();
  assert.deepEqual(await text(),[wrapped[0],wrapped[1],{...wrapped[2],text:'\rLast  line  !'}]);
  await page.evaluate(()=>editor.undo());assert.deepEqual(await text(),wrapped);
  await begin();await select(8,14);await input().pressSequentially('cancel');await input().press('Escape');assert.deepEqual(await text(),wrapped);
  await passed('Wrapped mixed styles, ligature words, decomposed marks, trailing spaces, cancellation and undo preserve source',{fragmentCount:parts.length,wrappedCaret});

  const composed=[original[0],{text:'cafe\u0301',italic:true,fontSize:24}];await mount(deckFor(composed));await begin();
  await input().evaluate(node=>{
    node.setSelectionRange(6,11);node.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
    node.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'insertCompositionText',data:'café'}));
    node.setRangeText('café',6,11,'end');node.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',data:'café'}));
  });await paint();assert.equal(await page.evaluate(()=>canvas.commit()),false);
  await input().evaluate(node=>node.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'café'})));await commit();
  assert.deepEqual(await text(),[original[0],{...composed[1],text:'café'}]);await page.evaluate(()=>editor.undo());assert.deepEqual(await text(),composed);
  await passed('Simulated composition cannot commit midway and retains original source across undo');
  const split=[{text:'A\r',bold:true,fontSize:24},{text:'\nB',italic:true,fontSize:24}];await mount(deckFor(split));await begin();
  await select(3);await input().pressSequentially('!');await commit();assert.deepEqual(await text(),[split[0],{...split[1],text:'\nB!'}]);
  await page.evaluate(()=>editor.undo());assert.deepEqual(await text(),split);await passed('CRLF split across styled runs remains intact through actual typing and undo');
  await mount(deck);await begin();await select(18);await input().press('Enter');await input().press('Enter');await paint();
  const blankCaret=await page.evaluate(()=>{
    const target=document.querySelector('[data-opf-rich-lines]'),line=JSON.parse(target.dataset.opfRichLines).at(-1);
    if(line.start!==line.end)throw Error('Expected trailing blank source line');
    const expected=new DOMPoint(line.x,line.y).matrixTransform(target.getScreenCTM()),actual=document.querySelector('.opf-rich-caret').getBoundingClientRect();
    return {sourceOffset:line.start,dx:actual.left-expected.x,dy:actual.top-expected.y};
  });assert.equal(blankCaret.sourceOffset,23);assert.ok(Math.abs(blankCaret.dx)<1&&Math.abs(blankCaret.dy)<1);
  await commit();assert.deepEqual(await text(),[original[0],{...original[1],text:'Second\rThird\r\n\r\n'}]);
  await page.evaluate(()=>editor.undo());assert.deepEqual(await text(),original);await passed('Trailing blank lines keep their source offset and insertion caret',{blankCaret});
  await page.evaluate(()=>{canvas.destroy();fonts.dispose();});assert.equal(await page.locator('#host > *').count(),0);
  assert.equal(await page.evaluate(()=>document.fonts.size),0);assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);
  for(const [file,digest] of Object.entries(inputs))assert.equal(hash(await readFile(file)),digest,'Browser verification must not rebuild runtime files');
  if(lockBytes)assert.equal(hash(await readFile(path.join(consumer,'package-lock.json'))),hash(lockBytes));
  report.status='passed';console.log(`${mode}: ${report.checks.length} rich input browser workflows passed.`);
}catch(error){report.status='failed';report.failure=error.stack;throw error;}
finally{
  await mkdir(path.dirname(output),{recursive:true});
  if(report.status==='failed'&&page)await page.screenshot({path:output.replace(/\.json$/,'.failure.png')}).catch(()=>{});
  await browser.close();await writeFile(output,JSON.stringify(report,null,2)+'\n');
}
