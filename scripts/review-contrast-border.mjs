import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {renderSvg} from '../../opf-render/dist/index.js';
import {loadBundledFontRegistry} from '../../opf-render/dist/fonts-node.js';
import {colorContrast} from '../packages/javascript/dist/index.js';
const require=createRequire(new URL('../../opf-render/package.json',import.meta.url));
const sharp=require('sharp'),{chromium}=require('playwright'),hash=b=>createHash('sha256').update(b).digest('hex');
const root=new URL('../artifacts/contrast-border/',import.meta.url);
await mkdir(root,{recursive:true});
const auditPath=new URL('../artifacts/gallery-contrast-current.json',import.meta.url);
const audit=JSON.parse(await readFile(auditPath,'utf8'));
const file='examples/gallery/business-functions/compliance-readiness-review.opf.json',slide=5;
const record=audit.failures.find(row=>row.file===file&&row.slide===slide&&row.role==='value');assert.ok(record);
const deck=JSON.parse(await readFile(new URL('../'+file,import.meta.url),'utf8')),svg=renderSvg(deck,{slideIndex:slide,trace:true});
assert.equal(hash(svg),audit.decks.find(row=>row.file===file).slides[slide].svgSha256);
const browser=await chromium.launch({channel:'msedge'}),errors=[],requests=[];
try{
 assert.equal(browser.version(),audit.browser);
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>body{margin:0;background:white}</style><main></main>');
 const fonts=await loadBundledFontRegistry();
 await page.evaluate(async faces=>{for(const face of faces)document.fonts.add(await new FontFace(face.family,`url(${face.dataUrl})`,{weight:String(face.weight),style:face.italic?'italic':'normal'}).load());},fonts.embeddedFonts);
 await page.evaluate(async svg=>{document.querySelector('main').innerHTML=svg;await document.fonts.ready;},svg);
 const foreground=await page.locator('svg').screenshot();
 await page.evaluate(()=>{for(const text of document.querySelectorAll('text'))text.style.visibility='hidden';});
 const background=await page.locator('svg').screenshot();
 const a=await sharp(foreground).ensureAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(background).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual(a.info,b.info);
 const box=record.box,toHex=rgb=>'#'+rgb.map(n=>n.toString(16).padStart(2,'0')).join('');
 let inkPixels=0,min=Infinity;
 for(let y=Math.max(0,Math.floor(box.y));y<Math.min(a.info.height,Math.ceil(box.y+box.height));y++)for(let x=Math.max(0,Math.floor(box.x));x<Math.min(a.info.width,Math.ceil(box.x+box.width));x++){
  const index=(y*a.info.width+x)*4;
  if(a.data.subarray(index,index+4).equals(b.data.subarray(index,index+4)))continue;
  inkPixels++;
  min=Math.min(min,colorContrast(toHex(record.rgba.slice(0,3)),toHex([...b.data.subarray(index,index+3)])));
 }
 assert.ok(inkPixels>0);assert.ok(min>=record.threshold);
 const at=(record.location.y*a.info.width+record.location.x)*4;
 assert.ok(a.data.subarray(at,at+4).equals(b.data.subarray(at,at+4)),'Reported minimum pixel contains no text ink');
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 await writeFile(new URL('metric-border-browser.png',root),foreground);
 await writeFile(new URL('metric-border-browser-no-text.png',root),background);
 await writeFile(new URL('metric-border-browser.json',root),JSON.stringify({node:process.version,browser:browser.version(),harnessSha256:hash(await readFile(new URL(import.meta.url))),auditSha256:hash(await readFile(auditPath)),file,slide,path:record.path,svgSha256:hash(svg),rectangleMinimumRatio:record.minimumRatio,glyphMaskMinimumRatio:min,inkPixels,threshold:record.threshold,reportedMinimumContainsText:false,foregroundSha256:hash(foreground),backgroundSha256:hash(background),errors,requests,scope:'One isolated metric-value rectangle: exact browser screenshots with/without text identify its ink support. Contrast uses the declared foreground and background screenshot, never anti-aliased glyph colors. Confirms this rectangle finding is caused by a panel border outside the glyphs; does not dismiss other audit findings or establish browser/native equivalence.'},null,2)+'\n');
 console.log(JSON.stringify({inkPixels,glyphMaskMinimumRatio:min,rectangleMinimumRatio:record.minimumRatio}));
}finally{await browser.close();}
