// FF-19: script fonts in an offline browser. Chromium loads the same pinned
// Noto bytes, and each script run's natural advance is compared with the
// accepted (fontkit) advance the SVG pins with textLength. Arabic and Hebrew
// lines must display right to left.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
// The decks name gallery font schemes (meiryo, david, ...): render with the host catalog registered.
import {renderSlideSvg} from './catalog-harness.mjs';
import {loadFonts} from '../dist/fonts-node.js';

const prepared = await loadFonts({pack:'base',scripts:'all'}), {registry} = prepared;
const deck=(language,fontScheme,title)=>({$schema:'https://openpresentation.org/schema/opf/v1',name:`FF-19 ${language}`,language,design:{fontScheme},slides:[{title,text:'Body'}]});
const cases=[
  ['cyrillic','ru','roboto','Квартальный обзор 12%'],
  ['greek','el','roboto','Τριμηνιαία ανασκόπηση 12%'],
  ['ja','ja','meiryo','四半期レビュー 12%'],
  ['zh-Hans','zh-Hans','microsoft-yahei','季度回顾 12%'],
  ['zh-Hant','zh-Hant','microsoft-jhenghei','季度回顧 12%'],
  ['ko','ko','malgun-gothic','분기별 검토 12%'],
  ['ar','ar','arabic-typesetting','مراجعة ربع سنوية.'],
  ['he','he','david','סקירה רבעונית.'],
  ['hi','hi','mangal','तिमाही समीक्षा'],
  ['th','th','angsana-new','การทบทวนรายไตรมาส'],
  ['latin-ja','ja','roboto','Review 四半期 2026'],
  // Glyph fallback: the chosen CJK face lacks the character, so another loaded CJK face draws it (kanji beside Hangul; Simplified-only hanzi in a Japanese deck).
  ['kanji-hangul','en','roboto','Revenue 収益 성장 12%'],['hanzi-ja','ja','meiryo','季度回顾 变 12%'],
  // Further scripts of the language vocabulary (with gallery font schemes), held to the same gate.
  ['bn','bn','shonar-bangla','বাংলা'],['pa-Guru','pa-Guru','raavi','ਪੰਜਾਬੀ'],['gu','gu','shruti','ગુજરાતી'],
  ['or','or','kalinga','ଓଡ଼ିଆ'],['ta','ta','latha','தமிழ்'],['te','te','gautami','తెలుగు'],['kn','kn','tunga','ಕನ್ನಡ'],
  ['ml','ml','kartika','മലയാളം'],['km','km','daunpenh','ខ្មែរ'],['am','am','nyala','አማርኛ'],['hy','hy','sylfaen','հայերեն'],
  ['ka','ka','sylfaen','ქართული'],['fa','fa','arabic-typesetting','فارسی'],['ur','ur','arabic-typesetting','اردو'],['mr','mr','mangal','मराठी'],
  // Noto Sans Mongolian: fontkit cannot decode its GSUB type 8 lookup; the skipped lookup keeps Node advances equal to the browser's (FF-44).
  ['mn-Mong','mn','noto-sans-mongolian','ᠮᠣᠩᠭᠣᠯ ᠤᠯᠤᠰ'],
].map(([id,language,scheme,title])=>({id,language,title,svg:renderSlideSvg(deck(language,scheme,title), 0, {fonts: prepared})}));

// Serve every loaded face from a local route; nothing else may load.
const faces=registry.describeFaces(),files=prepared.fontFiles;
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
    // RR-38: an Arabic Typesetting title is drawn at 0.64 of the composed size (54 px), so its advance is checked at 34.5.
    const title=[...host.querySelectorAll('text')].find(text=>['54','34.5'].includes(text.getAttribute('font-size')));
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
