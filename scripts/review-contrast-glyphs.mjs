// Refine an existing rectangle audit without changing any authored content.
// Independent opposite-polarity glyph masks include invisible source text.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {renderSvg} from '../../opf-render/dist/index.js';
import {loadBundledFontRegistry} from '../../opf-render/dist/fonts-node.js';
const require=createRequire(new URL('../../opf-render/package.json',import.meta.url));
const sharp=require('sharp'),{chromium}=require('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const auditPath=path.resolve(process.argv[2]??path.join(root,'docs/evidence/gallery-artwork-images/contrast-current.json'));
const output=path.resolve(process.argv[3]??path.join(root,'artifacts/contrast-glyphs'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const auditBytes=await readFile(auditPath),audit=JSON.parse(auditBytes),fonts=await loadBundledFontRegistry();
// An explicit prior glyph report rechecks its actual glyph failures after layout changes.
// Source bytes, leaf text/path, fonts and browser remain guarded; every matching
// current leaf is tested when repeated text makes old/new leaf identity ambiguous.
// only the measured leaf geometry/font size and generated SVG may differ.
const previous=process.argv[4]?JSON.parse(await readFile(path.resolve(process.argv[4]),'utf8')):null;
if(previous){assert.equal(previous.auditSha256,hash(auditBytes));assert.equal(previous.results.length,audit.failures.length);}
const fontHashes=fonts.embeddedFonts.map(face=>({family:face.family,weight:face.weight,italic:face.italic,sha256:hash(Buffer.from(face.dataUrl.split(',')[1],'base64'))}));
assert.deepEqual(fontHashes,audit.installedFonts,'Use the same font bytes and descriptors as the rectangle audit.');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined}),errors=[],requests=[],results=[],controls=[];
const luminance=rgb=>{const c=rgb.map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
const contrast=(fg,bg)=>{const a=luminance(fg),b=luminance(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
try{
 assert.equal(browser.version(),audit.browser,'The review must use the audited browser version.');
 const page=await browser.newPage({deviceScaleFactor:1});
 await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<style>body{margin:0;background:white}</style><main></main>');
 await page.evaluate(async faces=>{for(const face of faces)document.fonts.add(await new FontFace(face.family,`url(${face.dataUrl})`,{weight:String(face.weight),style:face.italic?'italic':'normal'}).load());await document.fonts.ready;},fonts.embeddedFonts);
 const decode=async png=>sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 async function inspect(svg,expected,id){
  await page.locator('main').evaluate((element,svg)=>{element.innerHTML=svg;},svg);
  const size=await page.locator('svg').evaluate(svg=>({width:Math.ceil(Number(svg.getAttribute('width'))),height:Math.ceil(Number(svg.getAttribute('height')))}));
  await page.setViewportSize(size);
  const measured=await page.evaluate(expected=>{
   const svg=document.querySelector('svg'),origin=svg.getBoundingClientRect();
   const leaves=[...svg.querySelectorAll('text,tspan')].filter(node=>!node.querySelector('text,tspan')&&node.textContent.trim());
   const candidates=leaves.map(node=>{
    const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
    return {node,path:node.closest('[data-opf-path]')?.getAttribute('data-opf-path')??null,text:node.textContent,fill:style.fill,fontFamily:style.fontFamily,fontSize:parseFloat(style.fontSize),fontWeight:Number(style.fontWeight),fontStyle:style.fontStyle,box:{x:rect.x-origin.x,y:rect.y-origin.y,width:rect.width,height:rect.height}};
   }).filter(record=>expected?record.path===expected.path&&record.text===expected.text&&(!expected.box||Object.keys(record.box).every(key=>Math.abs(record.box[key]-expected.box[key])<.05)):true);
   if(candidates.length!==(expected?.leafCount??1))throw Error(`Expected ${expected?.leafCount??1} matching audited leaves, got ${candidates.length}`);
   const {node,...record}=candidates[expected?.leafOrdinal??0];node.setAttribute('data-glyph-probe','target');
   const chain=[];for(let parent=node;parent&&parent!==svg.parentElement;parent=parent.parentElement){const style=getComputedStyle(parent);chain.push({tag:parent.tagName,opacity:Number(style.opacity),fillOpacity:Number(style.fillOpacity),filter:style.filter,mixBlendMode:style.mixBlendMode,clipPath:style.clipPath,mask:style.mask});}
   return {...record,chain};
  },expected);
  if(expected){assert.equal(measured.fill,expected.fill);assert.equal(measured.fontFamily,expected.fontFamily);if(!previous)assert.equal(measured.fontSize,expected.fontSize);}
  assert.ok(measured.chain.every(item=>item.opacity===1&&item.fillOpacity===1&&item.filter==='none'&&item.mixBlendMode==='normal'&&item.mask==='none'),'This verifier is scoped to opaque unfiltered text; do not certify unsupported compositing.');
  const rgb=measured.fill.match(/^rgb\((\d+), (\d+), (\d+)\)$/)?.slice(1).map(Number);assert.ok(rgb,'Opaque sRGB foreground required');
  const threshold=(!previous&&expected?.threshold)||(measured.fontSize>=24||(measured.fontWeight>=700&&measured.fontSize>=56/3)?3:4.5);
  const full=await page.locator('svg').screenshot();
  await page.evaluate(()=>{for(const text of document.querySelectorAll('svg text'))text.style.visibility='hidden';});
  const background=await page.locator('svg').screenshot();
  await page.evaluate(()=>{document.querySelector('[data-glyph-probe]').style.visibility='visible';});
  const isolated=await page.locator('svg').screenshot();
  await page.evaluate(()=>{
   const svg=document.querySelector('svg'),target=svg.querySelector('[data-glyph-probe]');
   for(const element of svg.querySelectorAll('rect,path,line,circle,ellipse,polygon,polyline,image,use,foreignObject'))if(!element.closest('defs,clipPath,mask,pattern,marker'))element.style.visibility='hidden';
   svg.style.background='#000000';target.style.fill='#FFFFFF';
  });
  const mask=await page.locator('svg').screenshot();
  await page.evaluate(()=>{document.querySelector('svg').style.background='#FFFFFF';document.querySelector('[data-glyph-probe]').style.fill='#000000';});
  const inverseMask=await page.locator('svg').screenshot();
  const bg=await decode(background),fg=await decode(isolated),ink=await decode(mask),inverse=await decode(inverseMask);assert.deepEqual(bg.info,fg.info);assert.deepEqual(bg.info,ink.info);assert.deepEqual(bg.info,inverse.info);assert.deepEqual([bg.info.width,bg.info.height],[size.width,size.height]);
  const artifacts=[];for(const [kind,png]of Object.entries({full,background,isolated,mask,inverseMask})){const file=`${id}-${kind}.png`;await writeFile(path.join(output,file),png);artifacts.push({file,bytes:png.length,sha256:hash(png)});}
  const coverage=at=>Math.max(ink.data[at],ink.data[at+1],ink.data[at+2],255-inverse.data[at],255-inverse.data[at+1],255-inverse.data[at+2]);
  let support=0,visible=0,unsupportedPaint=0,minimum=Infinity,worst=null,below=0;const outsideTextDifferences=[];
  const bounds={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};
  for(let y=0;y<bg.info.height;y++)for(let x=0;x<bg.info.width;x++){
   const at=(y*bg.info.width+x)*4,changed=!fg.data.subarray(at,at+4).equals(bg.data.subarray(at,at+4));
   const painted=coverage(at)>0;
   if(changed)visible++;
   if(changed&&!painted){
    const box=measured.box;
    if(x>=Math.floor(box.x)-1&&x<=Math.ceil(box.x+box.width)+1&&y>=Math.floor(box.y)-1&&y<=Math.ceil(box.y+box.height)+1)unsupportedPaint++;
    else outsideTextDifferences.push({x,y,background:[...bg.data.subarray(at,at+3)],isolated:[...fg.data.subarray(at,at+3)]});
   }
   if(!painted)continue;
   support++;bounds.left=Math.min(bounds.left,x);bounds.top=Math.min(bounds.top,y);bounds.right=Math.max(bounds.right,x);bounds.bottom=Math.max(bounds.bottom,y);
   const backdrop=[...bg.data.subarray(at,at+3)],ratio=contrast(rgb,backdrop);
   if(ratio<minimum){minimum=ratio;worst={x,y,background:backdrop,maskCoverage:coverage(at)/255};}
   if(ratio<threshold)below++;
  }
  assert.ok(support>0,'Missing glyph support must not produce a vacuous contrast pass');assert.equal(unsupportedPaint,0,'Paint within the text geometry is missing from the independent glyph masks');
  let auditedMinimumTouchesInk=null;
  if(expected?.location){const at=(expected.location.y*size.width+expected.location.x)*4;auditedMinimumTouchesInk=coverage(at)>0;}
  return {id,measured,threshold,rectangleMinimum:expected?.minimumRatio??null,glyphMinimum:minimum,supportPixels:support,visiblePixels:visible,pixelsBelowThreshold:below,unsupportedPaint,outsideTextDifferences,inkBounds:bounds,worst,auditedMinimumTouchesInk,passed:minimum>=threshold,artifacts};
 }
 for(const [name,foreground,background,shouldPass]of [['black-on-white','#000000','#FFFFFF',true],['invisible-white','#FFFFFF','#FFFFFF',false],['invisible-black','#000000','#000000',false]]){
  const deck={design:{background,fontScheme:'roboto'},slides:[{text:[{text:'Visible glyph support even when source text disappears',color:foreground}]}]};
  const result=await inspect(renderSvg(deck,{trace:true}),null,`control-${name}`);assert.equal(result.passed,shouldPass);if(!shouldPass){assert.equal(result.glyphMinimum,1);assert.equal(result.visiblePixels,0);}
  controls.push(result);
 }
 const visited=new Set();
 for(const [index,record]of audit.failures.entries()){
  if(previous&&previous.results[index].passed)continue;
  const identity=JSON.stringify([record.file,record.slide,record.path,record.text]);
  if(previous&&visited.has(identity))continue;
  visited.add(identity);
  const source=await readFile(path.join(root,record.file)),deck=JSON.parse(source),before=JSON.stringify(deck),svg=renderSvg(deck,{slideIndex:record.slide,trace:true});
  const auditedSlide=audit.decks.find(item=>item.file===record.file)?.slides.find(item=>item.slide===record.slide);assert.ok(auditedSlide);
  let expected=record,leafCount=1,previousFindingIndices=[];
  if(previous){
    assert.equal(hash(source),previous.results[index].sourceSha256,'Layout regression checks cannot silently change authored source.');
    previousFindingIndices=audit.failures.flatMap((item,i)=>!previous.results[i].passed&&item.file===record.file&&item.slide===record.slide&&item.path===record.path&&item.text===record.text?[i]:[]);
    await page.locator('main').evaluate((element,svg)=>{element.innerHTML=svg;},svg);
    leafCount=await page.evaluate(record=>[...document.querySelectorAll('svg text,svg tspan')].filter(node=>!node.querySelector('text,tspan')&&node.textContent===record.text&&node.closest('[data-opf-path]')?.getAttribute('data-opf-path')===record.path).length,record);
    assert.ok(leafCount>=previousFindingIndices.length,'A source leaf disappeared or its text changed; do not silently skip it.');
    expected={...record,box:null,location:null,leafCount};
  }else assert.equal(hash(svg),auditedSlide.svgSha256);
  for(let ordinal=0;ordinal<leafCount;ordinal++){
    const result=await inspect(svg,{...expected,leafOrdinal:ordinal},`finding-${String(index).padStart(2,'0')}${previous?`-leaf-${ordinal}`:''}`);assert.equal(JSON.stringify(deck),before);
    results.push({...result,...(previous?{previousFindingIndices}:{}),file:record.file,slide:record.slide,path:record.path,text:record.text,sourceSha256:hash(source),svgSha256:hash(svg)});
  }
 }
 if(previous)assert.equal(new Set(results.flatMap(item=>item.previousFindingIndices)).size,previous.results.filter(item=>!item.passed).length);
 else assert.equal(results.length,audit.failures.length);
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 const runtime={};for(const [name,directory]of [['opf',path.join(root,'packages/javascript')],['opf-render',path.resolve(root,'../opf-render')]])for(const file of (await readdir(path.join(directory,'dist'))).filter(file=>file.endsWith('.js')).sort())runtime[`${name}/dist/${file}`]=hash(await readFile(path.join(directory,'dist',file)));
 const report={node:process.version,browser:browser.version(),os:{platform:os.platform(),release:os.release(),version:os.version()},auditSha256:hash(auditBytes),harnessSha256:hash(await readFile(new URL(import.meta.url))),runtime,fontHashes,controls,results,errors,requests,scope:'All findings from the exact recorded SVG/browser/font audit, each isolated at its exact leaf/path/text/bounds. The union of white-on-black and black-on-white glyph-only masks retains polarity-dependent antialiasing and fully invisible source text, verified by two failing invisible controls and one passing control. Every isolated visible pixel within the measured text geometry plus a one-pixel guard must fall within that independent union. Redraw differences outside both the complete text geometry and its glyph masks are reported separately; they do not become text support. Contrast uses declared opaque sRGB foreground and actual background at every mask pixel, including antialiased-edge support. Other text is hidden while backgrounds, region borders and image geometry stay intact. Reports do not alter source, certify glyph coverage/system fallback, screen-reader access, other rasterizers or native output. Original rectangle findings remain recorded; only this finite audited set is refined.'};
 if(previous){report.scope=report.scope.replace('All findings from the exact recorded SVG/browser/font audit, each isolated at its exact leaf/path/text/bounds.','Targeted updated-layout regression of every actual glyph failure from the prior glyph report, preserving exact source bytes and path/text cohorts. Every currently matching leaf is tested when duplicates prevent a unique old/new mapping; the current count may not fall below the prior failing count. Current geometry, SVG and font size are measured again. Prior glyph passes and other current text require separate audit evidence.');report.previousGlyphReportSha256=hash(await readFile(path.resolve(process.argv[4])));}
 await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({findings:results.length,glyphPasses:results.filter(item=>item.passed).length,glyphFailures:results.filter(item=>!item.passed).length,invisibleControls:2,output}));
 process.exitCode=results.some(item=>!item.passed)?1:0;
}finally{await browser.close();}
