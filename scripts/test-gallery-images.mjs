// Actual source images, with no host resolver or corpus image substitution.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {examples} from '../packages/javascript/dist/examples.js';
import {renderSvgDeck} from '../../opf-render/dist/svg.js';
import {toPptx,fromPptx} from '../../opf-pptx/dist/index.js';
const requireRender=createRequire(new URL('../../opf-render/package.json',import.meta.url));
const {chromium}=requireRender('playwright');
const {unzipSync}=createRequire(new URL('../../opf-pptx/package.json',import.meta.url))('fflate');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const names=['brand-logo','brand-logo-light','brand-icon','cover-bg','watermark'];
const output=path.resolve(process.argv[2]??'artifacts/gallery-images.json');await mkdir(path.dirname(output),{recursive:true});
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined}),errors=[],externalRequests=[],results=[];
try{
 const page=await browser.newPage();await page.route(/^https?:/,route=>{externalRequests.push(route.request().url());return route.abort();});page.on('pageerror',error=>errors.push(error.message));await page.setContent('<main></main>');
 for(const {file,deck:source}of examples.filter(({file,deck})=>file.startsWith('examples/gallery/')&&deck.assets)){
  const assets=Object.fromEntries(names.map(name=>[name,source.assets[name]])),deck={assets,design:{imageFill:'fit'},slides:names.map(name=>({image:`asset:${name}`}))},before=structuredClone(deck),diagnostics=[];
  const expected=names.map(name=>hash(Buffer.from(assets[name].src.split(',')[1],'base64')));
  const svgs=renderSvgDeck(deck,{strictAssets:true,onDiagnostic:issue=>diagnostics.push(issue)});assert.equal(svgs.length,5);assert.deepEqual(diagnostics,[]);
  const decoded=[];
  for(const [index,svg]of svgs.entries()){
   const images=await page.evaluate(async svg=>{document.querySelector('main').innerHTML=svg;return Promise.all([...document.querySelectorAll('image')].map(async node=>{const image=new Image();image.src=node.getAttribute('href');await image.decode();return {src:image.src,width:image.naturalWidth,height:image.naturalHeight,description:node.getAttribute('aria-label')};}));},svg);
   assert.equal(images.length,1);assert.equal(hash(Buffer.from(images[0].src.split(',')[1],'base64')),expected[index]);assert.equal(images[0].description,assets[names[index]].alt);assert.ok(images[0].width&&images[0].height);
   decoded.push({name:names[index],width:images[0].width,height:images[0].height,description:images[0].description,svgSha256:hash(svg)});
  }
  const pptx=await toPptx(deck,{strictAssets:true}),zip=unzipSync(pptx);
  const media=Object.entries(zip).filter(([name])=>/^ppt\/media\//.test(name)&&!name.endsWith('/')).map(([name,bytes])=>({name,sha256:hash(bytes)}));
  assert.deepEqual(media.map(item=>item.sha256).sort(),[...new Set(expected)].sort(),`${file}: embedded media differs`);
  const imported=await fromPptx(pptx);assert.equal(imported.slides.length,5);
  const imageHashes=value=>{if(!value||typeof value!=='object')return [];return [...(typeof value.src==='string'&&value.src.startsWith('data:image/')?[hash(Buffer.from(value.src.split(',')[1],'base64'))]:[]),...Object.values(value).flatMap(imageHashes)];};
  for(const [index,slide]of imported.slides.entries())assert.deepEqual(imageHashes(slide),[expected[index]],`${file} #${index}: imported image bytes differ`);
  assert.deepEqual(deck,before);
  results.push({file,sourceSha256:hash(JSON.stringify(source)),images:decoded,media,pptxSha256:hash(pptx),sourcePreserved:true});
 }
 assert.equal(results.length,80);assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);
 const runtime={};for(const file of ['../packages/javascript/dist/examples.js','../../opf-render/dist/svg.js','../../opf-pptx/dist/index.js'])runtime[file]=hash(await readFile(new URL(file,import.meta.url)));
 await writeFile(output,JSON.stringify({node:process.version,browser:browser.version(),verifierSha256:hash(await readFile(new URL(import.meta.url))),runtime,results,errors,externalRequests,scope:'Each of the 400 embedded gallery artwork assets is isolated on a slide. Actual offline browser SVG decodes the exact image with its description; PPTX export embeds exact PNG bytes and imports them back on the corresponding slide. No imageResolver, local-file fallback or synthetic replacement is used. This does not verify native PowerPoint rendering, native edits, inherited regions/opacity, or complete galleries with unfinished photo/video/data resources.'},null,2)+'\n');
 console.log(`Gallery images passed: ${results.length*5} actual browser decodes, exact PPTX media embeddings and same-slide image-byte reimports; no resolver or substitutions.`);
}finally{await browser.close();}
