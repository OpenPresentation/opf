import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFile, realpath, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const mode=process.argv[2]??'packed';
assert.ok(['packed','registry','registry-libraries'].includes(mode),'Usage: node scripts/test-packed-browser.mjs [packed|registry|registry-libraries]');
const directory=path.join(root,'artifacts/editor');
const manifest=JSON.parse(await readFile(path.join(directory,'packed-browser-manifest.json'),'utf8'));
assert.equal(manifest.mode,mode,'Rebuild the requested installed-package harness before testing it');
const contained=(parent,file)=>{const relative=path.relative(parent,file);return relative!==''&&!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative);};
const consumer=await realpath(path.resolve(root,manifest.consumer));
assert.ok(contained(await realpath(path.join(root,'artifacts/npm')),consumer),'Consumer must stay inside npm artifacts');
assert.equal(JSON.parse(await readFile(path.join(consumer,'browser-build-id.json'),'utf8')),manifest.browserBuildId,'Browser assets are from a stale consumer build');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(await readFile(path.join(consumer,'package-lock.json'))),manifest.lockSha256,'Installed dependency lock changed after bundling');
// Serve only the verified in-memory bytes, so no other workspace files or stale
// replacement assets can be fetched during the browser run.
const assets=new Map();
for(const [name,expected] of Object.entries(manifest.files)){
  assert.equal(path.basename(name),name,'Browser manifest entries must be plain filenames');
  const bytes=await readFile(path.join(directory,name));
  assert.equal(hash(bytes),expected,`Browser asset changed after bundling: ${name}`);
  assets.set(`/${name}`,bytes);
}
const server=createServer((request,response)=>{
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405).end();return;}
  const pathname=new URL(request.url,'http://localhost').pathname;
  if(pathname==='/favicon.ico'){response.writeHead(204).end();return;}
  const bytes=assets.get(pathname);
  if(!bytes){response.writeHead(404).end();return;}
  response.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json'}[path.extname(pathname)]??'application/octet-stream'}).end(request.method==='HEAD'?undefined:bytes);
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin=`http://127.0.0.1:${server.address().port}`;
const {chromium}=createRequire(path.resolve(root,'../opf-render/package.json'))('playwright');
let browser;
const results=[];
const paint=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const click=async(page,name)=>{await page.getByRole('button',{name,exact:true}).click();await paint(page);assert.doesNotMatch(await page.locator('#results').innerText(),/FAIL/);};
async function drag(page,from,to){
  await page.mouse.move(from.x,from.y);await page.mouse.down();
  await page.mouse.move(to.x,to.y,{steps:12});await page.mouse.up();await paint(page);
}
try{
  browser=await chromium.launch({channel:process.env.OPF_BROWSER_CHANNEL??(process.platform==='win32'&&!process.env.CI?'msedge':undefined)});
  for(const suite of manifest.suites){
    const context=await browser.newContext({viewport:{width:1440,height:1200}}),errors=[],blocked=[];
    await context.route('**/*',async route=>{
      const request=route.request();
      if(new URL(request.url()).origin!==origin||request.method()!=='GET'){
        blocked.push({url:request.url(),method:request.method()});await route.abort();
      }else await route.continue();
    });
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    try{
      assert.equal((await page.goto(`${origin}/packed-${suite}-tests.html`)).status(),200);
      await page.waitForFunction(()=>/^(PASS|FAIL)/.test(document.title)||/READY|FAIL/.test(document.querySelector('#results')?.textContent??''),undefined,{timeout:60000});
      assert.doesNotMatch(await page.locator('#results').innerText(),/FAIL/);
      const interactions=[];
      if(suite==='layout'){
        for(const mode of ['normal','cancel','conflict','independent']){
          await page.locator('#pointer-mode').selectOption(mode);await click(page,'Reset');
          const bounds=await page.locator('[role="separator"][data-layout-path="slides.0"]').boundingBox();
          assert.ok(bounds,'Root divider must be visible');
          const from={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};
          await drag(page,from,{x:from.x+65,y:from.y});
          if(mode==='normal'||mode==='independent'){
            await click(page,'Verify');assert.match(await page.locator('#pointer-state').innerText(),/^PASS/);
          }else{
            assert.match(await page.locator('#results').innerText(),mode==='cancel'?/PASS cancelling a trusted drag discards its draft/:/PASS concurrent container edits cancel the trusted drag/);
            assert.doesNotMatch(await page.locator('#pointer-state').innerText(),/committed/);
          }
          interactions.push(`trusted divider drag: ${mode}`);
        }
      }
      if(suite==='block'){
        const first=await page.locator('[data-block-path="/slides/0/blocks/0"]').boundingBox();
        // Handles sit at the trailing edge of each block. A text glyph box can
        // occupy only the leading half, which would insert before that block.
        const target=await page.locator('[data-block-path="/slides/0/blocks/2"]').boundingBox();
        assert.ok(first&&target,'Block drag targets must be visible');
        await page.mouse.move(first.x+first.width/2,first.y+first.height/2);await page.mouse.down();
        await page.mouse.move(target.x+target.width/2,target.y+target.height+30,{steps:12});
        // HTML drag-and-drop needs a dragover after entering the destination.
        await page.mouse.move(target.x+target.width/2+1,target.y+target.height+30);
        await page.locator('[data-block-drop]').waitFor({state:'visible'});
        await page.mouse.up();await paint(page);
        await click(page,'Verify');assert.match(await page.locator('#drag-status').innerText(),/^PASS trusted block drag/);
        interactions.push('trusted block reorder and one-step undo');
      }
      if(suite==='styled-table'){
        const target=value=>page.locator(`[data-canvas-target][data-opf-path="slides.0.table.rows.${value}.value"]`);
        await target('0.0').dblclick();
        const rich=page.locator('textarea.opf-rich-input');
        await rich.press(process.platform==='darwin'?'Meta+ArrowDown':'Control+End');
        assert.ok(await rich.evaluate(input=>input.selectionStart===input.value.length&&input.selectionEnd===input.value.length),'Trusted keyboard navigation must collapse the selection at the text end before appending');
        await rich.pressSequentially('!');await rich.press('Control+Enter');
        await click(page,'Verify typed merge');await click(page,'Undo');await click(page,'Verify original');
        await click(page,'Redo');await click(page,'Verify typed merge');await click(page,'Undo');await click(page,'Verify original');
        await target('0.1').dblclick();await click(page,'Format text');
        const converted=JSON.parse(await page.locator('#state').innerText()).table;
        await click(page,'Bold');await click(page,'Verify formatting');await click(page,'Undo');
        assert.deepEqual(JSON.parse(await page.locator('#state').innerText()).table,converted,'One undo removes bold while retaining the earlier scalar-to-rich conversion');
        await click(page,'Undo');await click(page,'Verify original');
        await target('1.2').dblclick();
        await page.locator('textarea.opf-rich-input').pressSequentially('New cell');await page.locator('textarea.opf-rich-input').press('Control+Enter');
        await click(page,'Verify empty edit');await click(page,'Undo');await click(page,'Verify original');
        interactions.push('trusted merged rich-cell typing, redo and undo','trusted scalar-to-rich conversion and bold formatting, each with its own undo','trusted empty-cell typing and undo');
      }else assert.match(await page.title(),/^PASS/);
      const checks=await page.locator('#results').innerText();
      assert.doesNotMatch(checks,/FAIL/);assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
      results.push({suite,assertions:(checks.match(/^PASS /gm)??[]).length,interactions,checks:checks.trim().split('\n'),pageErrors:errors,blockedRequests:blocked});
      console.log(`PASS ${mode} ${suite}: ${results.at(-1).assertions} assertions; ${interactions.length} trusted interaction scenarios`);
    }catch(error){
      await page.screenshot({path:path.join(directory,`packed-browser-${mode}-${suite}-failure.png`),fullPage:true});
      console.error(`Suite ${suite}:`,await page.locator('#results').innerText().catch(()=>'(no results)'),errors);
      throw error;
    }finally{await context.close();}
  }
  await writeFile(path.join(directory,`packed-browser-${mode}-node${process.versions.node.split('.')[0]}-report.json`),JSON.stringify({
    checkedAt:new Date().toISOString(),browser:browser.version(),node:process.version,mode,manifest,results,
    boundary:'Installed-package browser assertions and trusted pointer/keyboard editing. Native export, source round-trip and pixel fidelity require separate evidence.',
  },null,2)+'\n');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
