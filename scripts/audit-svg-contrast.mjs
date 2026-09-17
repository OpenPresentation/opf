// Conservative color audit of rendered text rectangles, not a WCAG certification.
// All source colors are preserved. Background samples come from the actual SVG
// with text hidden, composited onto a documented white viewer matte.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {examples} from '../packages/javascript/dist/examples.js';
import {renderSvgDeck} from '../../opf-render/dist/index.js';
import {loadBundledFontRegistry} from '../../opf-render/dist/fonts-node.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(new URL('../../opf-render/package.json',import.meta.url));
const output=path.resolve(process.argv[2]??path.join(root,'artifacts/svg-contrast.json'));
const filter=process.argv[3]??'examples/gallery/';
const hash=b=>createHash('sha256').update(b).digest('hex');
const registry=await loadBundledFontRegistry();
const runtime={};
for(const [name,directory]of [['opf',path.join(root,'packages/javascript')],['opf-render',path.resolve(root,'../opf-render')]]){
 for(const file of (await readdir(path.join(directory,'dist'))).filter(file=>file.endsWith('.js')).sort())runtime[`${name}/dist/${file}`]=hash(await readFile(path.join(directory,'dist',file)));
 runtime[`${name}/package.json`]=hash(await readFile(path.join(directory,'package.json')));
}
const installedFonts=registry.embeddedFonts.map(face=>({family:face.family,weight:face.weight,italic:face.italic,sha256:hash(Buffer.from(face.dataUrl.split(',')[1],'base64'))}));
const browser=await require('playwright').chromium.launch({channel:process.platform==='win32'?'msedge':undefined});
const errors=[],externalRequests=[],decks=[],failures=[],unmeasured=[];
let textRuns=0,slides=0;
try{
 const page=await browser.newPage();
 await page.route(/^https?:/,route=>{externalRequests.push(route.request().url());return route.abort();});
 page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<style>body{margin:0;background:white}</style><main></main>');
 await page.evaluate(async faces=>{for(const face of faces)document.fonts.add(await new FontFace(face.family,`url(${face.dataUrl})`,{weight:String(face.weight),style:face.italic?'italic':'normal'}).load());await document.fonts.ready;},registry.embeddedFonts);
 for(const {file,deck}of examples.filter(item=>item.file.startsWith(filter))){
  const svgs=renderSvgDeck(deck,{trace:true}),results=[];
  for(const [slide,svg]of svgs.entries()){
   const result=await page.evaluate(async svg=>{
    document.querySelector('main').innerHTML=svg;
    await document.fonts.ready;
    const root=document.querySelector('svg'),width=Math.ceil(Number(root.getAttribute('width'))),height=Math.ceil(Number(root.getAttribute('height')));
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    const colorCanvas=document.createElement('canvas');colorCanvas.width=1;colorCanvas.height=1;
    const colorContext=colorCanvas.getContext('2d',{willReadFrequently:true});
    const samples=[];
    for(const element of root.querySelectorAll('text,tspan')){
     if(element.querySelector('text,tspan')||!element.textContent.trim())continue;
     const style=getComputedStyle(element),box=element.getBoundingClientRect(),svgBox=root.getBoundingClientRect();
     let opacity=Number(style.fillOpacity),supported=!style.fill.startsWith('url(');
     for(let parent=element;parent&&parent!==root.parentElement;parent=parent.parentElement){const s=getComputedStyle(parent);opacity*=Number(s.opacity);if(s.filter!=='none'||s.mixBlendMode!=='normal')supported=false;}
     if(style.visibility==='hidden'||style.display==='none'||!opacity||!box.width||!box.height)continue;
     colorContext.clearRect(0,0,1,1);colorContext.fillStyle=style.fill;colorContext.fillRect(0,0,1,1);
     const rgba=Array.from(colorContext.getImageData(0,0,1,1).data);rgba[3]=rgba[3]/255*opacity;
     const fontSize=parseFloat(style.fontSize),weight=Number(style.fontWeight);
     samples.push({path:element.closest('[data-opf-path]')?.getAttribute('data-opf-path')??null,role:element.closest('[data-opf-metric-role]')?.getAttribute('data-opf-metric-role')??null,text:element.textContent,fill:style.fill,rgba,fontFamily:style.fontFamily,fontStyle:style.fontStyle,fontSize,weight,threshold:fontSize>=24||(weight>=700&&fontSize>=56/3)?3:4.5,supported,box:{x:box.x-svgBox.x,y:box.y-svgBox.y,width:box.width,height:box.height}});
    }
    for(const text of root.querySelectorAll('text'))text.style.visibility='hidden';
    const image=new Image();
    image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(root));
    await image.decode();context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(image,0,0);
    const pixels=context.getImageData(0,0,width,height).data;
    const luminance=rgb=>{const c=rgb.map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
    const results=samples.map(sample=>{
     let min=Infinity,background,location;
     const {box,rgba}=sample;
     const x0=Math.max(0,Math.floor(box.x)),x1=Math.min(width,Math.ceil(box.x+box.width)),y0=Math.max(0,Math.floor(box.y)),y1=Math.min(height,Math.ceil(box.y+box.height));
     for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const at=(y*width+x)*4,bg=[pixels[at],pixels[at+1],pixels[at+2]],fg=bg.map((value,i)=>rgba[i]*rgba[3]+value*(1-rgba[3]));
      const a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      if(ratio<min){min=ratio;background=bg;location={x,y};}
     }
     return {...sample,minimumRatio:Number.isFinite(min)?min:null,background,location,passed:sample.supported&&min>=sample.threshold&&Number.isFinite(min)};
    });
    return {width,height,results};
   },svg);
   slides++;textRuns+=result.results.length;
   for(const text of result.results)if(!text.supported||text.minimumRatio===null)unmeasured.push({file,slide,...text});else if(!text.passed)failures.push({file,slide,...text});
   results.push({slide,svgSha256:hash(svg),textRuns:result.results.length,failures:result.results.filter(text=>!text.passed).length});
  }
  decks.push({file,sourceSha256:hash(JSON.stringify(deck)),slides:results});
 }
 assert.equal(externalRequests.length,0);assert.deepEqual(errors,[]);assert.ok(textRuns>0);
 await mkdir(path.dirname(output),{recursive:true});
 await writeFile(output,JSON.stringify({node:process.version,browser:browser.version(),os:{platform:os.platform(),release:os.release(),version:os.version()},runtime,installedFonts,fontPolicy:'Default SVG layout and requested CSS font stacks. Bundled faces are loaded, but available system fonts and browser fallback may resolve other requests; per-glyph font files are not certified. This environment-specific rectangle audit is separate from the system-font-disabled PNG corpus.',harnessSha256:hash(await readFile(fileURLToPath(import.meta.url))),decks,slides,textRuns,failures,unmeasured,externalRequests,errors,criterion:'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',scope:'Conservative text-rectangle background sampling of rendered SVG on a white viewer matte. Uses declared foreground/opacity and sampled backgrounds; no anti-aliased text colors enter the ratio. 3:1 for displayed >=24px or bold >=18.6667px, otherwise 4.5:1, without rounding. Rectangles include spaces and font ascenders/descenders, so unrelated border pixels can trigger findings. Opacity shared with other painted elements is approximate. Unknown filters/blending are unmeasured, not passing. Does not certify WCAG, exact glyph/background intersection, glyph coverage, reading order, screen-reader access, native PowerPoint, other viewer mattes, responsive scaling or text contrast outside these rendered examples. No document colors are changed.'},null,2)+'\n');
 console.log(JSON.stringify({decks:decks.length,slides,textRuns,contrastFailures:failures.length,unmeasured:unmeasured.length,output}));
 process.exitCode=failures.length||unmeasured.length?1:0;
}finally{await browser.close();}
