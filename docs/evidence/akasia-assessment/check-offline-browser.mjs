import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {createFontRegistry} from '../../../../opf-render/dist/fonts.js';
import {renderSvgDeck} from '../../../../opf-render/dist/svg.js';
import {toPptx,fromPptx} from '../../../../opf-pptx/dist/index.js';
const require=createRequire(new URL('../../../../opf-render/package.json',import.meta.url)),{chromium}=require('playwright');
const [fontDirectory,auditFile,output]=process.argv.slice(2);assert.ok(fontDirectory&&auditFile&&output);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),audit=JSON.parse(await readFile(auditFile,'utf8'));
await mkdir(output,{recursive:true});
const faces=[];
for(const record of audit.records){const data=await readFile(path.join(fontDirectory,record.file));assert.equal(sha(data),record.sha256);faces.push({data,weight:record.weight,italic:record.italic,license:'OFL-1.1'});}
const registry=createFontRegistry(faces,{substitutionPolicy:'none'}),cases=[];
for(const record of audit.records)for(const sample of record.samples.filter(sample=>!sample.errorCode)) {
  const requested={fontFamily:'Akasia',fontWeight:record.weight,italic:record.italic},resolved=registry.textMeasurement.resolveStyle(requested);
  cases.push({file:record.file,name:sample.name,text:sample.text,resolved,expected:registry.textMeasurement.measure(sample.text,32,requested)});
}
const document={name:'Akasia open-file assessment',design:{fontScheme:{id:'roboto',heading:{family:'Akasia'},body:{family:'Akasia'},accent:{family:'Akasia'},code:{family:'Akasia'}}},slides:[
  {title:'Akasia open font candidate',subtitle:'Latin, Greek and Cyrillic specimens',text:'Office AVATAR Toffee affine 0123456789\nΚαλημέρα κόσμε Ελληνικά\nПривет мир Кириллица\nA\u0301 a\u0308 o\u0302\u0301 n\u0303\n∑ √ ∞ ≠ ≤ ≥'},
  {title:'Complete quote and source',quote:{text:'Open files make exact selection, independent inspection and offline rendering possible. Matching advances alone does not establish visual or native compatibility.',attribution:'OPF font evaluation',source:'Open-file browser specimen'}},
  {title:'Recorded scope',blocks:[{metric:{value:12,unit:'styles',label:'Open release files',description:'No Aptos equivalence claim'}},{table:{columns:['Test','Scope'],rows:[['Advances','Public upstream metric data'],['Scripts','Selected Latin / Greek / Cyrillic'],['Native Office','Still unverified']]}}]}
]};
const original=structuredClone(document),options={textMeasurement:registry.textMeasurement,embeddedFonts:registry.embeddedFonts};
const svg=renderSvgDeck(document,options),pptx=await toPptx(document,options),imported=await fromPptx(pptx);
assert.deepEqual(document,original);assert.equal(imported.slides.length,document.slides.length);
for(let i=0;i<document.slides.length;i++)assert.equal(imported.slides[i].title,document.slides[i].title);
await writeFile(path.join(output,'specimen.opf.json'),JSON.stringify(document,null,2)+'\n');
await writeFile(path.join(output,'specimen.pptx'),pptx);
const browser=await chromium.launch(),errors=[],requests=[],screenshots=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',error=>errors.push(error.message));
  await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
  await page.setContent('<style>body{margin:0}main{width:1280px}</style><main></main>');
  const observed=await page.evaluate(async({fonts,cases})=>{
    for(const face of fonts)document.fonts.add(await new FontFace(face.family,`url(${face.dataUrl})`,{weight:String(face.weight),style:face.italic?'italic':'normal'}).load());
    await document.fonts.ready;const observations=[];
    for(const sample of cases){
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width','1000');svg.setAttribute('height','90');
      const text=document.createElementNS(svg.namespaceURI,'text');text.textContent=sample.text;
      for(const [key,value]of Object.entries({x:'24',y:'50','font-family':sample.resolved.fontFamily,'font-weight':String(sample.resolved.fontWeight),'font-style':sample.resolved.italic?'italic':'normal','font-size':'32','text-rendering':'geometricPrecision'}))text.setAttribute(key,value);
      svg.append(text);document.querySelector('main').replaceChildren(svg);
      observations.push({...sample,actual:text.getComputedTextLength()});
    }
    return observations;
  },{fonts:registry.embeddedFonts,cases});
  for(let index=0;index<svg.length;index++) {
    await page.locator('main').evaluate((element,html)=>element.innerHTML=html,svg[index]);
    await page.evaluate(()=>document.fonts.ready);
    const file=`slide-${index+1}.png`,bytes=await page.locator('main').screenshot();await writeFile(path.join(output,file),bytes);screenshots.push({file,sha256:sha(bytes)});
  }
  const outliers=observed.filter(item=>Math.abs(item.actual-item.expected)>=.1);
  await writeFile(path.join(output,'browser.json'),JSON.stringify({node:process.version,browser:browser.version(),auditSha256:sha(await readFile(auditFile)),reviewerSha256:sha(await readFile(new URL(import.meta.url))),observed,outliers,errors,requests,screenshots,pptxSha256:sha(pptx),sourceUnchanged:true,titlesReimported:true,scope:'Actual offline browser advances for 60 supported script/style specimens and three complete slides using exact Akasia bytes. The three PPTX files slides remain editable with title recovery. No independent Aptos, complete language, native Office font selection or raster-equivalence claim.'},null,2)+'\n');
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);assert.deepEqual(outliers,[],'Browser shaping must match these Fontkit specimens within 0.1px');
  console.log(`${observed.length} offline Akasia script/style advances match; ${screenshots.length} complete slides captured and native-export titles reimported.`);
}finally{await browser.close();}
