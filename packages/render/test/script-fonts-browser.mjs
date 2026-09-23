// FF-19: script fonts in an offline browser. Chromium loads the same pinned
// Noto bytes, and each script run's natural advance is compared with the
// accepted (fontkit) advance the SVG pins with textLength. Arabic and Hebrew
// lines must display right to left.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {renderSvg} from '../dist/index.js';
import {prepareNodeFonts} from '../dist/fonts-node.js';

const {registry,options}=await prepareNodeFonts({pack:'base',scripts:'all'});
const deck=(language,fontScheme,title)=>({$schema:'https://openpresentation.org/schema/opf/v1',name:`FF-19 ${language}`,language,design:{fontScheme},slides:[{title,text:'Body'}]});
const cases=[
  ['cyrillic','russian','roboto','Квартальный обзор 12%'],
  ['greek','greek','roboto','Τριμηνιαία ανασκόπηση 12%'],
  ['ja','japanese','meiryo','四半期レビュー 12%'],
  ['zh-Hans','chinese-simplified','microsoft-yahei','季度回顾 12%'],
  ['zh-Hant','chinese-traditional','microsoft-jhenghei','季度回顧 12%'],
  ['ko','korean','malgun-gothic','분기별 검토 12%'],
  ['ar','arabic','arabic-typesetting','مراجعة ربع سنوية.'],
  ['he','hebrew','david','סקירה רבעונית.'],
  ['hi','hindi','mangal','तिमाही समीक्षा'],
  ['th','thai','angsana-new','การทบทวนรายไตรมาส'],
  ['latin-ja','japanese','roboto','Review 四半期 2026'],
  // Further catalog scripts (gallery native names), held to the same gate.
  ['bn','bengali','shonar-bangla','বাংলা'],['pa-Guru','punjabi-gurmukhi','raavi','ਪੰਜਾਬੀ'],['gu','gujarati','shruti','ગુજરાતી'],
  ['or','odia','kalinga','ଓଡ଼ିଆ'],['ta','tamil','latha','தமிழ்'],['te','telugu','gautami','తెలుగు'],['kn','kannada','tunga','ಕನ್ನಡ'],
  ['ml','malayalam','kartika','മലയാളം'],['km','khmer','daunpenh','ខ្មែរ'],['am','amharic','nyala','አማርኛ'],['hy','armenian','sylfaen','հայերեն'],
  ['ka','georgian','sylfaen','ქართული'],['fa','persian','arabic-typesetting','فارسی'],['ur','urdu','arabic-typesetting','اردو'],['mr','marathi','mangal','मराठी'],
].map(([id,language,scheme,title])=>({id,language,title,svg:renderSvg(deck(language,scheme,title),options)}));

// Serve every loaded face from a local route; nothing else may load.
const faces=registry.describeFaces(),files=options.fontFiles;
assert.equal(faces.length,files.length);
const served=new Map(faces.map((face,index)=>[`https://fonts.test/${index}.ttf`,{...face,file:files[index]}]));
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined}),errors=[],requests=[];
try{
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.route(/^https?:/,async route=>{
    const face=served.get(route.request().url());
    if(!face){requests.push(route.request().url());return route.abort();}
    return route.fulfill({status:200,contentType:'font/ttf',body:await readFile(face.file)});
  });
  await page.setContent('<main></main>');
  await page.evaluate(async faces=>{
    for(const [url,face] of faces)document.fonts.add(await new FontFace(face.family,`url(${url})`,{weight:String(face.weight),style:face.italic?'italic':'normal'}).load());
    await document.fonts.ready;
  },[...served].map(([url,face])=>[url,{family:face.family,weight:face.weight,italic:face.italic}]));
  const observed=await page.evaluate(cases=>cases.map(value=>{
    const host=document.querySelector('main');host.innerHTML=value.svg;
    const title=[...host.querySelectorAll('text')].find(text=>text.getAttribute('font-size')==='54');
    const spans=[...title.querySelectorAll('tspan[textLength]')];
    const elements=spans.length?spans:[title];
    const runs=elements.map(element=>{
      const accepted=Number(element.getAttribute('textLength'));
      const family=(element.getAttribute('font-family')??title.getAttribute('font-family')).split(',')[0].trim();
      element.removeAttribute('textLength');
      const natural=element.getComputedTextLength?element.getComputedTextLength():title.getComputedTextLength();
      // document.fonts.check() also consults system fonts (the Linux Playwright image
      // has a system Roboto), so require a pinned FontFace of this family, loaded.
      const loaded=[...document.fonts].some(face=>face.family.replace(/^"|"$/g,'')===family&&face.status==='loaded');
      return {text:element.textContent,family,accepted,natural,loaded};
    });
    // Visual order: the final full stop of an RTL title is painted left of its first letter.
    const content=title.textContent,stop=content.lastIndexOf('.'),first=content.search(/[\u0590-\u08FF]/);
    const order=stop>=0&&first>=0?{stop:title.getStartPositionOfChar(stop).x,first:title.getStartPositionOfChar(first).x}:undefined;
    return {id:value.id,lang:host.querySelector('svg').getAttribute('lang'),runs,order};
  }),cases.map(({id,svg})=>({id,svg})));
  const output=path.resolve(process.argv[2]??'artifacts/script-fonts-browser.json');
  await mkdir(path.dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify({node:process.version,browser:browser.version(),observed,errors,requests,scope:'Offline browser advances of pinned Noto script faces against accepted fontkit advances. Native PowerPoint rendering and HarfBuzz/fontkit shaping parity beyond these samples remain separate.'},null,2)+'\n');
  const residuals=[];
  for(const value of observed){
    for(const run of value.runs){
      assert.ok(run.loaded,`${value.id}: ${run.family} is loaded for ${run.text}`);
      residuals.push(Math.abs(run.natural-run.accepted));
      assert.ok(Math.abs(run.natural-run.accepted)<0.1,`${value.id}: ${run.family} advance ${run.natural} differs from accepted ${run.accepted}`);
    }
    if(value.id==='ar'||value.id==='he'){assert.ok(value.order&&value.order.stop<value.order.first,`${value.id} displays right to left`);}
  }
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log(`Script fonts browser: ${observed.length} scripts, ${residuals.length} runs within 0.1 px of accepted advances (max ${Math.max(...residuals).toFixed(4)} px); Arabic and Hebrew display right to left.`);
}finally{await browser.close();}
