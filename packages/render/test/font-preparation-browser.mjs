import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {prepareNodeFonts} from '../dist/fonts-node.js';
const prepared=await prepareNodeFonts(),text='Office AVATAR 0123 — typography';
const cases=prepared.options.embeddedFonts.map(face=>({
  ...face,expected:prepared.registry.textMeasurement.measure(text,42,{fontFamily:face.family,fontWeight:face.weight,italic:face.italic}),
  fontSha256:createHash('sha256').update(Buffer.from(face.dataUrl.split(',')[1],'base64')).digest('hex'),
}));
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined}),errors=[],requests=[];
try{
  const page=await browser.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
  await page.setContent('<main></main>');
  const observations=await page.evaluate(async({cases,text})=>{
    for(const face of cases)document.fonts.add(await new FontFace(face.family,`url(${face.dataUrl})`,{weight:String(face.weight),style:face.italic?'italic':'normal'}).load());
    await document.fonts.ready;
    const results=[];
    for(const face of cases){
      const node=document.createElementNS('http://www.w3.org/2000/svg','svg');
      node.setAttribute('width','900');node.setAttribute('height','120');
      const run=document.createElementNS(node.namespaceURI,'text');
      for(const [key,value]of Object.entries({x:'30',y:'75','font-family':face.family,'font-size':'42','font-weight':String(face.weight),'font-style':face.italic?'italic':'normal','text-rendering':'geometricPrecision'}))run.setAttribute(key,value);
      run.textContent=text;node.append(run);document.querySelector('main').replaceChildren(node);
      results.push({family:face.family,weight:face.weight,italic:face.italic,fontSha256:face.fontSha256,expected:face.expected,actual:run.getComputedTextLength(),text:run.textContent});
    }
    return results;
  },{cases,text});
  const report={node:process.version,browser:browser.version(),observations,errors,requests,scope:'Nine exact bundled faces, actual offline SVG font loading and shaped advances. Raster and native fidelity remain separate.'};
  if(process.argv[2]){await mkdir(path.dirname(path.resolve(process.argv[2])),{recursive:true});await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');}
  for(const observation of observations){assert.equal(observation.text,text);assert.ok(Math.abs(observation.actual-observation.expected)<.1,`${observation.family}/${observation.weight}/${observation.italic}: browser advance differs`);}
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log('Nine exact base font faces passed actual offline browser loading and 0.1-pixel advance checks.');
}finally{await browser.close();}
