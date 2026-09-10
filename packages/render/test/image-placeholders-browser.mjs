import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {chromium} from 'playwright';
import {renderSvg} from '../dist/svg.js';
import {loadBundledFontRegistry} from '../dist/fonts-node.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fonts=await loadBundledFontRegistry(),fixtures=[];
for(const [width,height]of [[1280,720],[540,960],[96,96]])for(const dark of [false,true]){
 const description='Complete image description & <literal markup> '.repeat(width===96?4:1);
 const deck={design:{dimensions:{widthInches:width/96,heightInches:height/96},fontScheme:'roboto',background:dark?'#000000':'#FFFFFF',colorScheme:{id:'cool-horizon',dark1:dark?'#FFFFFF':'#000000',light1:dark?'#FFFFFF':'#000000',dark2:dark?'#334155':'#F8FAFC',light2:dark?'#334155':'#F8FAFC'},header:{right:{image:{src:'asset:icon',alt:description}}},watermark:{src:'asset:icon',opacity:.06}},assets:{icon:{src:'./missing.png',alt:description}},slides:[{image:'asset:icon'}]};
 const original=structuredClone(deck),diagnostics=[];
 const svg=renderSvg(deck,{trace:true,textMeasurement:fonts.textMeasurement,onDiagnostic:issue=>diagnostics.push(issue)});
 assert.deepEqual(deck,original);assert.equal(diagnostics.filter(issue=>issue.code==='unresolved-asset').length,3);
 fixtures.push({id:`${width}-${height}-${dark?'dark':'light'}`,width,height,description,svg,svgSha256:hash(svg),diagnostics});
}
const output=process.argv[2]?path.resolve(process.argv[2]):null;
if(output)await mkdir(path.dirname(output),{recursive:true});
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined}),errors=[],externalRequests=[];
try{
 const page=await browser.newPage({viewport:{width:1400,height:1100}});
 await page.route(/^https?:/,route=>{externalRequests.push(route.request().url());return route.abort();});page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<style>body{margin:0;background:#ddd}svg{display:block}</style><main></main>');
 await page.evaluate(async faces=>{for(const face of faces)document.fonts.add(await new FontFace(face.family,`url(${face.dataUrl})`,{weight:String(face.weight),style:face.italic?'italic':'normal'}).load());await document.fonts.ready;},fonts.embeddedFonts);
 const results=[];
 for(const fixture of fixtures){
  await page.locator('main').evaluate((element,svg)=>{element.innerHTML=svg;},fixture.svg);
  const groups=await page.evaluate(()=>[...document.querySelectorAll('[data-opf-asset-status="unresolved"]')].map(group=>{
   const panel=group.querySelector(':scope > rect'),box=panel.getBBox();
   const content=[...group.querySelectorAll('text,path')].map(node=>{const b=node.getBBox();return {tag:node.tagName,text:node.textContent,box:{x:b.x,y:b.y,width:b.width,height:b.height},fontSize:node.tagName==='text'?Number(node.getAttribute('font-size')):null};});
   let opacity=1;for(let element=group;element;element=element.parentElement)opacity*=Number(getComputedStyle(element).opacity);
   return {path:group.getAttribute('data-opf-path'),role:group.getAttribute('role'),description:group.getAttribute('aria-label'),opacity,panel:{x:box.x,y:box.y,width:box.width,height:box.height},content};
  }));
  assert.equal(groups.length,3);
  for(const group of groups){
   assert.equal(group.role,'img');assert.equal(group.description,`Image unavailable: ${fixture.description}`);assert.ok(group.content.length);
   for(const child of group.content){const b=child.box,p=group.panel;assert.ok(b.x>=p.x-.1&&b.y>=p.y-.1&&b.x+b.width<=p.x+p.width+.1&&b.y+b.height<=p.y+p.height+.1,`${fixture.id} ${group.path}: ${JSON.stringify(child)} escapes ${JSON.stringify(p)}`);if(child.fontSize!==null)assert.ok(child.fontSize>=16*Math.min(fixture.width,fixture.height)/720-.001);}
  }
  assert.equal(groups.filter(group=>group.opacity===.06).length,1);
  const named=page.getByRole('img',{name:`Image unavailable: ${fixture.description}`,exact:true});assert.equal(await named.count(),3);
  let screenshot;
  if(output){const png=await page.locator('svg').screenshot();screenshot={file:`placeholder-${fixture.id}.png`,sha256:hash(png)};await writeFile(path.join(path.dirname(output),screenshot.file),png);}
  results.push({id:fixture.id,svgSha256:fixture.svgSha256,diagnostics:fixture.diagnostics,groups,screenshot});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);
 const report={node:process.version,browser:browser.version(),rendererSha256:hash(await readFile(new URL('../dist/svg.js',import.meta.url))),verifierSha256:hash(await readFile(new URL(import.meta.url))),fontHashes:fonts.embeddedFonts.map(face=>({family:face.family,weight:face.weight,italic:face.italic,sha256:hash(Buffer.from(face.dataUrl.split(',')[1],'base64'))})),results,errors,externalRequests,scope:'Six actual SVG outputs in offline Edge with exact bundled font bytes: all 18 label/icon bounds within panels (0.1 reference pixel), full accessible descriptions queryable by role, readability floor and authored watermark opacity preserved. This verifies browser DOM/font bounds, not screen-reader speech, final opacity contrast, individual glyph pixels, arbitrary fonts or native export.'};
 if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n');
 console.log(`Image placeholder browser passed: ${results.length} wide/portrait/tiny light/dark cases and ${results.length*3} bounded accessible statuses.`);
}finally{await browser.close();}
