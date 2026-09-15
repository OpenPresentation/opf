import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url)),consumer=process.argv[3],resolveDir=consumer?path.resolve(consumer):root;
const editorImport=consumer?'@openpresentation/opf-editor/json-editor':'./dist/json-editor.js';
const bundle=await build({stdin:{resolveDir,contents:`
  import {mountJsonCodeEditor} from ${JSON.stringify(editorImport)};
  window.changes=[];window.failures=[];
  window.mount=(code,catalogs={})=>{
    window.control?.destroy();window.changes=[];
    window.control=mountJsonCodeEditor(document.querySelector('#editor'),{code,label:'OPF JSON',lineNumbers:true,catalogs,onChange:source=>changes.push(source),onError:error=>failures.push(error.message)});
  };`},bundle:true,platform:'browser',format:'iife',write:false,metafile:true});
if(consumer){
  const installed=await realpath(path.join(resolveDir,'node_modules'));
  for(const input of Object.keys(bundle.metafile.inputs).filter(input=>!input.startsWith('<'))){
    assert.ok((await realpath(path.resolve(input))).startsWith(installed+path.sep),`Installed browser bundle escapes consumer: ${input}`);
  }
}
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined});
const errors=[],requests=[],checks=[],mod=process.platform==='darwin'?'Meta':'Control';
let page;
try{
  page=await browser.newPage({viewport:{width:1000,height:800}});
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
  await page.setContent('<style>#editor{width:700px;height:650px}.cm-editor{height:100%}.cm-scroller{overflow:auto}</style><div id="editor"></div><button>After editor</button>');
  await page.addScriptTag({content:bundle.outputFiles[0].text});await page.context().setOffline(true);
  const source=page.getByRole('textbox',{name:'OPF JSON',exact:true});
  const read=()=>page.evaluate(()=>control.api.getValue());
  const select=async(from,to=from)=>page.evaluate(([from,to])=>{control.api.focus();control.api.setSelection(from,to);},[from,to]);
  const at=async(text,offset=0)=>select((await read()).indexOf(text)+offset);
  await page.evaluate(()=>mount(''));await source.press('{');assert.equal(await read(),'{}');
  await source.press('Enter');assert.equal(await read(),'{\n  \n}');await source.press('"');await page.keyboard.insertText('slides');await source.press('"');await source.press(':');await source.press('Space');await source.press('[');await source.press('Enter');
  assert.equal(await read(),'{\n  "slides": [\n    \n  ]\n}');await source.press('Tab');assert.ok((await read()).includes('\n      \n'));await source.press('Shift+Tab');
  await source.press('{');await source.press('Backspace');const paired=await read();await source.press(`${mod}+z`);assert.notEqual(await read(),paired);await source.press(`${mod}+Shift+z`);assert.equal(await read(),paired);
  checks.push('Paired delimiters, nested indentation, Tab/outdent and keyboard undo/redo');

  const original='{\r\n\t"slides": [{\r\t\t"title": "Keep  spacing",\n\t\t"items": [\r\n\t\t\t"First",\r\t\t\t"Final"\n\t\t]\r\n\t}]\n}';
  await page.evaluate(code=>mount(code),original);assert.equal(await read(),original);assert.deepEqual(await page.evaluate(()=>changes),[]);
  await at('"First",','"First",'.length);await source.press('Enter');await page.keyboard.insertText('Next');await source.press('"');await source.press(',');
  assert.equal(await read(),original.replace('"First",','"First",\r\n\t\t\t"Next",'));
  await at('Final',3);await page.keyboard.insertText('!');assert.equal((await read()).includes('Fin!al'),true);
  await source.press(`${mod}+z`);assert.equal((await read()).includes('Fin!al'),false);
  checks.push('Bullet continuation supplies commas/quotes and retains tabs, mixed line endings and unrelated content');

  await page.evaluate(code=>mount(code),original);await select(original.indexOf('\r\n')+2);await source.press('Backspace');const removed=original.replace('\r\n','');assert.equal(await read(),removed);
  const external=' '+removed;await page.evaluate(code=>control.update(code),external);await source.press(`${mod}+z`);assert.equal(await read(),' '+original);await source.press(`${mod}+Shift+z`);assert.equal(await read(),external);
  assert.equal(await page.evaluate(()=>{try{control.api.replace(control.api.getValue().indexOf('\r\n')+1,control.api.getValue().indexOf('\r\n')+1,'!');return false;}catch{return true;}}),true);
  checks.push('Native deletion/undo preserves original CRLF and unrelated external updates; split-CRLF replacement rejected');

  await select(0,(await read()).length);const paste='{\r\n"slides": []\r}\n';
  await source.evaluate((node,text)=>{const clipboardData=new DataTransfer();clipboardData.setData('text/plain',text);node.dispatchEvent(new ClipboardEvent('paste',{clipboardData,bubbles:true,cancelable:true}));},paste);
  assert.equal(await read(),paste);await source.press(`${mod}+z`);assert.equal(await read(),external);await source.press(`${mod}+Shift+z`);assert.equal(await read(),paste);
  checks.push('Dispatched clipboard event preserves observed mixed endings through undo/redo (OS clipboard not claimed)');

  const deck='{\r\n  "slides": [{"layout":"text-1x","title":"Keep title","text":"Keep  text"}]\n}';
  await page.evaluate(code=>mount(code,{layouts:[{id:'partner-detail',name:'Partner detail',placeholders:[{type:'title'},{type:'text'}]}]}),deck);
  await at('"layout"',1);await source.press('Control+Space');const menu=page.getByRole('dialog',{name:'layout options',exact:true});await menu.waitFor();
  await menu.getByRole('combobox').fill('partner-detail');assert.equal(await menu.getByRole('option').count(),1);await menu.getByRole('combobox').press('Enter');assert.equal(await read(),deck.replace('text-1x','partner-detail'));
  await source.press(`${mod}+z`);assert.equal(await read(),deck);
  // A real click on the highlighted key opens the same menu.
  await page.locator('[data-field="slides[0].layout"]').click();await menu.waitFor();
  await page.evaluate(()=>control.update(control.api.getValue().replace('Keep title','External title')));assert.equal(await menu.count(),0);
  await at('"layout"',1);await source.press('Control+Space');await menu.waitFor();await page.evaluate(()=>control.setCatalogs({}));assert.equal(await menu.count(),0);
  checks.push('Keyboard and pointer catalog menus, filtering, one-token replacement, undo and stale context dismissal');

  await page.evaluate(()=>mount('{"slides":['));await select(5);await source.press('Control+Space');await page.evaluate(()=>control.openOptions());assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.evaluate(()=>control.api.format()),false);assert.equal(await read(),'{"slides":[');
  const compact='{"name":"Keep  spaces","slides":[],"x-value":1.2300}';await page.evaluate(code=>mount(code),compact);await source.press(`${mod}+f`);await page.locator('.cm-search').waitFor();await page.locator('.cm-search input[name="search"]').fill('Keep');await page.locator('.cm-search input[name="search"]').press('Escape');await source.press(`${mod}+Shift+f`);
  assert.deepEqual(JSON.parse(await read()),JSON.parse(compact));assert.ok((await read()).includes('1.2300'));await source.press(`${mod}+z`);assert.equal(await read(),compact);
  checks.push('Invalid drafts retained, search panel and explicit formatting preserve JSON values and numeric lexemes');

  await page.evaluate(code=>mount(code),deck);await at('"layout"',1);await page.evaluate(async()=>{const pending=control.openOptions();control.destroy();await pending;});assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await source.count(),0);
  await page.evaluate(()=>mount('{"slides":[]}'));assert.equal(await source.count(),1);await page.evaluate(()=>control.destroy());assert.equal(await source.count(),0);
  checks.push('Destroy cancels pending menus and remount creates one editor');
  assert.deepEqual(await page.evaluate(()=>failures),[]);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  const report={status:'passed',runtime:consumer?'installed':'checkout',node:process.version,browser:browser.version(),platform:process.platform,checks,errors,externalRequests:requests,verifierSha256:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),bundleSha256:createHash('sha256').update(bundle.outputFiles[0].text).digest('hex')};
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
  console.log(`JSON editor: ${checks.length} offline browser workflows pass (${report.runtime}).`);
}catch(error){
  const failures=await page?.evaluate(()=>window.failures??[]).catch(()=>[]);
  const report={status:'failed',node:process.version,checks,errors,externalRequests:requests,failures,message:error.message};
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
  console.error(report);throw error;
}finally{await browser.close();}
