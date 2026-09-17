import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadOfficeFontRegistry} from '../../opf-render/dist/fonts-node.js';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(new URL('../../opf-render/package.json',import.meta.url));
const {build}=require('esbuild'),{chromium}=require('playwright'),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const output=path.resolve(process.argv[2]);await mkdir(output,{recursive:true});
const mode=process.argv[3]??'measured';assert.ok(['measured','estimated'].includes(mode));
const pageUrl='http://opf-fixture.local/'+(mode==='estimated'?'?estimated':'');
const bundled=await build({absWorkingDir:root,entryPoints:['scripts/test-rich-text-browser.mjs'],bundle:true,platform:'browser',format:'esm',write:false,minify:true,metafile:true});
const bundle=bundled.outputFiles[0].text,fonts=JSON.stringify((await loadOfficeFontRegistry()).embeddedFonts);
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined}),errors=[],unexpectedRequests=[];
try {
  const page=await browser.newPage({viewport:{width:1400,height:1000}});page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
    const url=route.request().url();
    if(url===pageUrl)return route.fulfill({contentType:'text/html',body:'<!doctype html><div id="canvas" style="max-width:1100px"></div><pre id="results"></pre>'});
    if(url==='http://opf-fixture.local/fonts.json')return route.fulfill({contentType:'application/json',body:fonts});
    unexpectedRequests.push(url);return route.abort();
  });
  await page.goto(pageUrl);await page.addScriptTag({type:'module',content:bundle});
  await page.waitForFunction(()=>/^(PASS|FAIL)/.test(document.title),{},{timeout:30000});
  const title=await page.title(),text=await page.locator('#results').innerText();
  await writeFile(path.join(output,'bundle.js'),bundle);await writeFile(path.join(output,'results.txt'),text+'\n');
  await page.screenshot({path:path.join(output,'rich-canvas.png')});
  const inputs={};for(const file of Object.keys(bundled.metafile.inputs))inputs[file]=hash(await readFile(path.resolve(root,file)));
  const report={node:process.version,browser:browser.version(),mode,title,errors,unexpectedRequests,bundleSha256:hash(bundle),fontsSha256:hash(fonts),inputs,
    scope:'Rich-text canvas harness executed in actual Chromium with bundled font bytes and intercepted local fixture requests. DOM selection/input/composition events test formatting, typing, draft undo/redo, session undo, cancellation, concurrency, IME guards and caret geometry. Estimated mode omits the measurement provider and its missing-font guard; it does not certify measurement fidelity. This is linked-source browser behavior, not native IME or PowerPoint fidelity.'};
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  assert.match(title,/^PASS/);assert.deepEqual(errors,[]);assert.deepEqual(unexpectedRequests,[]);console.log(title);
}finally{await browser.close();}
