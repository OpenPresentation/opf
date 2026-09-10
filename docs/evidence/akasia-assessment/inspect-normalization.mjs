import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(new URL('../../../../opf-render/package.json',import.meta.url)),fontkit=require('fontkit'),{chromium}=require('playwright');
const [fontFile,output]=process.argv.slice(2);assert.ok(fontFile&&output);
const bytes=await readFile(fontFile),font=fontkit.create(bytes),sha=value=>createHash('sha256').update(value).digest('hex');
assert.equal(font.postscriptName,'Akasia-BlackItalic');
const cases=[];
for(const source of ['A\u0301','a\u0308','o\u0302\u0301','n\u0303','A\u0301 a\u0308 o\u0302\u0301 n\u0303'])for(const normalization of ['source','NFC']) {
  const text=normalization==='source'?source:source.normalize('NFC'),run=font.layout(text);
  cases.push({source,text,normalization,fontkitAt32:run.advanceWidth*32/font.unitsPerEm,glyphs:run.glyphs.map(glyph=>({id:glyph.id,name:glyph.name})),positions:run.positions});
}
const browser=await chromium.launch();
try {
  const page=await browser.newPage();await page.route(/^https?:/,route=>route.abort());await page.setContent('<main></main>');
  const observed=await page.evaluate(async({data,cases})=>{
    document.fonts.add(await new FontFace('Akasia probe',`url(data:font/ttf;base64,${data})`,{weight:'900',style:'italic'}).load());await document.fonts.ready;
    return cases.map(value=>{
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),text=document.createElementNS(svg.namespaceURI,'text');
      text.textContent=value.text;for(const [key,v]of Object.entries({'font-family':'Akasia probe','font-weight':'900','font-style':'italic','font-size':'32','text-rendering':'geometricPrecision'}))text.setAttribute(key,v);
      svg.append(text);document.querySelector('main').replaceChildren(svg);return {...value,browserAt32:text.getComputedTextLength(),domText:text.textContent};
    });
  },{data:bytes.toString('base64'),cases});
  for(const value of observed)assert.equal(value.text,value.domText);
  await writeFile(output,JSON.stringify({node:process.version,browser:browser.version(),fontSha256:sha(bytes),reviewerSha256:sha(await readFile(new URL(import.meta.url))),observed,scope:'Diagnostic control comparing literal decomposed source and NFC specimens in Fontkit and offline Chromium with one exact Akasia Black Italic file. Normalization is applied only to the explicitly labeled control strings; no product source or measurement behavior changes.'},null,2)+'\n');
  console.log('Recorded source/NFC browser and Fontkit cluster controls.');
}finally{await browser.close();}
