import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {prepareNodeFonts} from '../dist/fonts-node.js';
const {registry,options}=await prepareNodeFonts(),sample='Office AVATAR 0123 — typography';
const cases=options.embeddedFonts.map(face=>{
  const fontFamily=face.family.startsWith('Roboto ')&&face.family!=='Roboto Mono'?'Roboto':face.family;
  const requested={fontFamily,fontWeight:face.weight,italic:!!face.italic};
  const resolved=registry.textMeasurement.resolveStyle(requested);
  assert.equal(resolved.fontFamily,face.family);assert.equal(resolved.fontWeight,face.weight);
  return {requested,resolved,expected:registry.textMeasurement.measure(sample,42,requested)};
});
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined}),errors=[],requests=[];
try{
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
  await page.setContent('<main></main>');
  const observed=await page.evaluate(async({fonts,cases,sample})=>{
    for(const face of fonts)document.fonts.add(await new FontFace(face.family,`url(${face.dataUrl})`,{weight:String(face.weight),style:face.italic?'italic':'normal'}).load());
    await document.fonts.ready;const observations=[];
    for(const value of cases){
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width','900');svg.setAttribute('height','120');
      const text=document.createElementNS(svg.namespaceURI,'text');text.textContent=sample;
      for(const [key,val]of Object.entries({x:'30',y:'75','font-family':value.resolved.fontFamily,'font-weight':String(value.resolved.fontWeight),'font-style':value.resolved.italic?'italic':'normal','font-size':'42','text-rendering':'geometricPrecision'}))text.setAttribute(key,val);
      svg.append(text);document.querySelector('main').replaceChildren(svg);
      observations.push({...value,actual:text.getComputedTextLength(),text:text.textContent});
    }
    return observations;
  },{fonts:options.embeddedFonts,cases,sample});
  const output=path.resolve(process.argv[2]??'artifacts/font-variants-browser.json');
  await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify({node:process.version,browser:browser.version(),observed,errors,requests,scope:'Actual offline browser painting selects all nine resolved physical styles; native paint and other scripts remain separate.'},null,2)+'\n');
  for(const value of observed){assert.equal(value.text,sample);assert.ok(Math.abs(value.actual-value.expected)<.1,`Resolved ${value.resolved.fontFamily} advance differs`);}
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log('All nine grouped font selections pass actual offline browser advances within 0.1 pixels.');
}finally{await browser.close();}
