// FF-19: script faces load lazily in a real browser. A page bundles the browser font loader and the SVG
// renderer, serves the pinned Noto files from local routes and nothing else, and checks which files each
// document fetches, that the drawn advances equal the accepted (fontkit) advances, and paints Japanese and
// Arabic previews to PNG. Offline: every other request is aborted.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {loadFonts,scriptFontPackages} from '../dist/fonts-node.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const outputDirectory=path.resolve(root,process.argv[2]??'artifacts/script-fonts-auto');
await mkdir(outputDirectory,{recursive:true});

// One entry: the loader (with the lazy script API) and the renderer, bundled for the browser.
const bundle=await build({
  stdin:{contents:`import {loadFonts as loadBrowserFonts} from './dist/fonts-browser.js';import {renderSlideSvg} from './dist/svg.js';window.opf={loadBrowserFonts,renderSlideSvg};`,resolveDir:root,sourcefile:'page.js'},
  bundle:true,platform:'browser',format:'iife',write:false,minify:true,metafile:true,
});
const script=bundle.outputFiles[0].text;
assert.ok(!Object.keys(bundle.metafile.inputs).some(input=>/sharp|raster|resvg|fonts-node/.test(input)),'the browser bundle must not pull in native raster or Node font modules');

const roboto=((await loadFonts({pack: 'base'})).registry).selectEmbeddedFonts(face=>face.family==='Roboto'&&face.weight===400&&!face.italic);
const robotoBytes=Buffer.from(roboto[0].dataUrl.split(',')[1],'base64');
const packRoot=path.join(root,'node_modules/@expo-google-fonts');
const ORIGIN='https://app.test',PACK=`${ORIGIN}/pack/`;

const deck=(language,scheme,title,text)=>({$schema:'https://openpresentation.org/schema/opf/v1',name:`Auto ${language}`,...(language?{language}:{}),design:{fontScheme:scheme},slides:[{title,text}]});
const decks={
  latin:deck(undefined,'roboto','Quarterly review 12%','Body'),
  ja:deck('ja','meiryo','四半期レビュー 12%','売上は前年同期比で12%増加しました。次の四半期に向けて計画を確認します。'),
  ar:deck('ar','arabic-typesetting','مراجعة ربع سنوية.','ارتفعت المبيعات بنسبة 12% مقارنة بالفترة نفسها من العام الماضي.'),
  mixed:deck('ja','roboto','Review 四半期レビュー 2026','日本語です and English together'),
};

const browser=await chromium.launch({channel:process.platform==='win32'&&!process.env.CI?'msedge':undefined});
const errors=[],requests=[],unexpected=[];
try{
  const page=await browser.newPage({viewport:{width:1300,height:760}});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.route(/^https?:/,async route=>{
    const url=route.request().url();
    if(url===`${ORIGIN}/`)return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><main></main>'});
    if(url===`${ORIGIN}/roboto.ttf`)return route.fulfill({status:200,contentType:'font/ttf',body:robotoBytes});
    if(url.startsWith(PACK)){
      requests.push(url.slice(PACK.length));
      try{return await route.fulfill({status:200,contentType:'font/ttf',body:await readFile(path.join(packRoot,url.slice(PACK.length)))});}catch{return route.fulfill({status:404});}
    }
    unexpected.push(url);return route.abort();
  });
  await page.goto(`${ORIGIN}/`);
  await page.addScriptTag({content:script});

  const step=async(name,source)=>{
    const before=requests.length;
    const result=await page.evaluate(async ({name,source,packRoot})=>{
      const {loadBrowserFonts,renderSlideSvg}=window.opf;
      if(name==='latin'||!window.registry){
        if(window.registry)window.registry.dispose();
        const data=new Uint8Array(await (await fetch('/roboto.ttf')).arrayBuffer());
        window.registry=(await loadBrowserFonts({faces: [{data,family:'Roboto'}], substitutionPolicy:'visual',fallbackFamily:'Roboto',scriptBaseUrl:packRoot,scripts:'auto',presentation:source.latin})).registry;
      }
      const registry=window.registry;
      const document=source[name];
      const ensured=await registry.ensureScripts(document);
      const diagnostics=[];
      const svg=renderSlideSvg(document, 0,{ fonts: {textMeasurement:registry.textMeasurement},onDiagnostic:value=>diagnostics.push(value.code)});
      const host=window.document.querySelector('main');host.innerHTML=svg;
      await window.document.fonts.ready;
      // RR-38: an Arabic Typesetting title is drawn at 0.64 of the composed size (54 px), so its advance is checked at 34.5.
      const title=[...host.querySelectorAll('text')].find(text=>['54','34.5'].includes(text.getAttribute('font-size')));
      const spans=[...title.querySelectorAll('tspan[textLength]')];
      const elements=spans.length?spans:[title];
      const runs=elements.map(element=>{
        const accepted=Number(element.getAttribute('textLength')||title.getAttribute('textLength'));
        const family=(element.getAttribute('font-family')??title.getAttribute('font-family')).split(',')[0].trim().replace(/^"|"$/g,'');
        const natural=element.getComputedTextLength?element.getComputedTextLength():title.getComputedTextLength();
        const loaded=[...window.document.fonts].some(face=>face.family.replace(/^"|"$/g,'')===family&&face.status==='loaded');
        return {text:element.textContent,family,accepted,natural,loaded};
      });
      return {loaded:ensured.loaded,detected:ensured.detected,unavailable:ensured.unavailable,packages:registry.loadedScriptPackages,runs,diagnostics,
        faces:[...window.document.fonts].map(face=>face.family.replace(/^"|"$/g,'')),lang:host.querySelector('svg').getAttribute('lang')};
    },{name,source:decks,packRoot:PACK});
    result.fetched=requests.slice(before);
    return result;
  };
  const shoot=async name=>{const file=path.join(outputDirectory,`${name}.png`);await page.locator('main svg').screenshot({path:file});return file;};

  const report={};
  // 1. A Latin-only deck fetches no script file.
  report.latin=await step('latin');
  assert.deepEqual(report.latin.fetched,[]);assert.deepEqual(report.latin.packages,[]);assert.deepEqual(report.latin.detected,[]);
  await shoot('latin');
  // 2. A Japanese deck fetches exactly the Japanese package, and the drawn run matches the accepted advance.
  report.ja=await step('ja');
  assert.deepEqual(report.ja.fetched.sort(),['noto-sans-jp/400Regular/NotoSansJP_400Regular.ttf','noto-sans-jp/700Bold/NotoSansJP_700Bold.ttf']);
  assert.deepEqual(report.ja.detected,['Jpan']);
  assert.ok(report.ja.faces.includes('Noto Sans JP'));
  await shoot('ja');
  // 3. Rendering it again is free; an Arabic deck adds only the Arabic packages.
  const again=await step('ja');
  assert.deepEqual(again.fetched,[]);
  report.ar=await step('ar');
  assert.deepEqual([...new Set(report.ar.fetched.map(file=>file.split('/')[0]))].sort(),['noto-naskh-arabic','noto-nastaliq-urdu','noto-sans-arabic']);
  assert.deepEqual(report.ar.detected,['Arab']);
  await shoot('ar');
  // 4. Latin text with a CJK phrase needs the Japanese face (already loaded: no new request) and draws with it.
  report.mixed=await step('mixed');
  assert.deepEqual(report.mixed.fetched,[]);
  assert.ok(report.mixed.runs.some(run=>run.family==='Noto Sans JP'),'the CJK run uses the Japanese face');
  await shoot('mixed');

  for(const name of ['ja','ar','mixed']){
    const value=report[name];
    assert.deepEqual(value.diagnostics.filter(code=>!/^language-preview|^paragraph-direction/.test(code)),[],`${name} diagnostics`);
    for(const run of value.runs){
      assert.ok(run.loaded,`${name}: ${run.family} is loaded for ${run.text}`);
      assert.ok(Math.abs(run.natural-run.accepted)<0.1,`${name}: ${run.family} advance ${run.natural} differs from accepted ${run.accepted}`);
    }
  }
  assert.ok(report.ja.runs.every(run=>/Noto Sans JP|Meiryo/.test(run.family)||run.family==='Roboto'));
  assert.deepEqual(unexpected,[],'no request may leave the local routes');
  assert.deepEqual(errors,[]);

  const packages=scriptFontPackages('all');
  const summary={
    node:process.version,browser:browser.version(),
    bundle:{bytes:script.length,note:'minified page bundle: browser font loader plus SVG renderer (core included)'},
    fetchedFiles:requests.length,unexpected,errors,
    steps:Object.fromEntries(Object.entries(report).map(([key,value])=>[key,{detected:value.detected,fetched:value.fetched,packages:value.packages.map(name=>name.replace('@expo-google-fonts/','')),runs:value.runs}])),
    allScriptFaces:packages.reduce((total,item)=>total+item.faces.length,0),
  };
  await writeFile(path.join(outputDirectory,'report.json'),JSON.stringify(summary,null,2)+'\n');
  console.log(`Auto script fonts browser: Latin fetched 0 files; ja fetched ${report.ja.fetched.length}; ar fetched ${report.ar.fetched.length}; mixed fetched 0; all runs within 0.1 px of accepted advances.`);
}finally{await browser.close();}
