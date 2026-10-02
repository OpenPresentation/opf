// FF-45: symbol-encoded families in an offline browser. Chromium loads the same pinned Noto symbol bytes, and for every
// code of every family the browser's natural advance of the mapped glyph in the chosen open face is compared with the
// accepted (fontkit) advance within 0.1 px, so the preview's natural widths (the ones the SVG compresses to the verified
// symbol font's advance, never stretches) agree between Node and a browser. The deck's SVG then displays each symbol tspan
// at the verified advance, and no font request leaves the page.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {renderSvg} from '../dist/index.js';
import {prepareNodeFonts} from '../dist/fonts-node.js';
import {SYMBOL_ENCODINGS,SYMBOL_SCRIPT,createScriptFonts,mapSymbolText} from '../dist/fonts.js';

const {registry,options}=await prepareNodeFonts({pack:'office',substitutionPolicy:'visual',scripts:[SYMBOL_SCRIPT]});
const SIZE=40;
// Every code of every family: the glyph the planner draws, its face and the accepted natural advance.
const scripts=createScriptFonts({},registry.textMeasurement);
const glyphs=[];
for(const entry of SYMBOL_ENCODINGS){
  const style=registry.textMeasurement.resolveStyle({fontFamily:entry.family,fontWeight:400});
  for(let code=0x20;code<=0xFF;code++){
    const [run]=scripts.plan(String.fromCharCode(0xF000+code),style);
    if(!run.text)continue;
    glyphs.push({family:entry.family,code:code.toString(16).toUpperCase().padStart(2,'0'),text:run.text,face:run.family,natural:scripts.runWidths([run],SIZE,style,{natural:true})[0],accepted:scripts.runWidths([run],SIZE,style)[0],placeholder:!!run.symbol.placeholder});
  }
}
const deck={$schema:'https://openpresentation.org/schema/opf/v1',name:'FF-45 browser',slides:[{id:'a',title:'Symbols',text:[{text:'Check: '},{text:' l',fontFamily:'Wingdings'},{text:' alpha '},{text:'abg ∑',fontFamily:'Symbol'},{text:' web '},{text:'',fontFamily:'Webdings'}]}]};
const svg=renderSvg(deck,options);
const expectedAdvances=mapSymbolText('Wingdings',' l').map(item=>item.advance);

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
  await page.setContent('<main></main><svg id="probe" xmlns="http://www.w3.org/2000/svg" width="400" height="100"></svg>');
  await page.evaluate(async faces=>{
    for(const [url,face] of faces)document.fonts.add(await new FontFace(face.family,`url(${url})`,{weight:String(face.weight),style:face.italic?'italic':'normal'}).load());
    await document.fonts.ready;
  },[...served].map(([url,face])=>[url,{family:face.family,weight:face.weight,italic:face.italic}]));
  const observed=await page.evaluate(({glyphs,size})=>{
    const probe=document.getElementById('probe');
    const loaded=family=>[...document.fonts].some(face=>face.family.replace(/^"|"$/g,'')===family&&face.status==='loaded');
    return glyphs.map(glyph=>{
      // The renderer's placed text is geometricPrecision (unhinted advances), so the probe is too.
      // Quoted, as the renderer writes a name with a digit-leading word ("Noto Sans Symbols 2"): unquoted it is invalid CSS and ignored.
      probe.innerHTML=`<text x="10" y="60" font-size="${size}" font-family="'${glyph.face}'" text-rendering="geometricPrecision" xml:space="preserve">${glyph.text.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>`;
      const text=probe.querySelector('text');
      return {...glyph,browser:text.getComputedTextLength(),loaded:loaded(glyph.face)};
    });
  },{glyphs,size:SIZE});
  const placed=await page.evaluate(svg=>{
    const host=document.querySelector('main');host.innerHTML=svg;
    const text=[...host.querySelectorAll('text')].find(element=>(element.getAttribute('font-family')??'').includes('Noto Sans Symbols 2')&&element.textContent.includes('✓'));
    const spans=[...text.querySelectorAll('tspan')];
    return {size:Number(text.getAttribute('font-size')),xs:spans.map(span=>Number(span.getAttribute('x'))),texts:spans.map(span=>span.textContent),starts:spans.map((span,index)=>text.getStartPositionOfChar(spans.slice(0,index).reduce((total,item)=>total+item.textContent.length,0)).x)};
  },svg);
  const output=path.resolve(process.argv[2]??'artifacts/symbol-fonts-browser.json');
  await mkdir(path.dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify({node:process.version,browser:browser.version(),glyphs:observed.length,placed,errors,requests,observed,scope:'Offline browser advances of the pinned Noto symbol faces for every mapped symbol code against accepted fontkit advances; the Wingdings run displayed at the verified advances. Native PowerPoint rendering remains separate (FF-46).'},null,2)+'\n');
  const residuals=[];
  for(const glyph of observed){
    assert.ok(glyph.loaded,`${glyph.family} 0x${glyph.code}: ${glyph.face} is loaded`);
    residuals.push(Math.abs(glyph.browser-glyph.natural));
    assert.ok(Math.abs(glyph.browser-glyph.natural)<0.1,`${glyph.family} 0x${glyph.code} (${glyph.text} in ${glyph.face}): browser advance ${glyph.browser} differs from accepted ${glyph.natural}`);
  }
  assert.deepEqual(placed.texts,['✓','⚫',' ','⚫']);
  for(let index=1;index<placed.xs.length;index++){
    assert.ok(Math.abs(placed.xs[index]-placed.xs[index-1]-expectedAdvances[index-1]*placed.size)<0.01,`tspan ${index} is written at the verified advance`);
    assert.ok(Math.abs(placed.starts[index]-placed.xs[index])<0.05,`tspan ${index} is displayed where it is written (${placed.starts[index]} vs ${placed.xs[index]})`);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  const drawn=observed.filter(glyph=>!glyph.placeholder).length;
  console.log(`Symbol fonts browser: ${observed.length} glyphs (${drawn} mapped, ${observed.length-drawn} placeholders) within 0.1 px of accepted advances (max ${Math.max(...residuals).toFixed(4)} px); the Wingdings run displays at the verified advances.`);
}finally{await browser.close();}
