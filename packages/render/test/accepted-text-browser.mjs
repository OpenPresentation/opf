// Exact-font browser observations; source/accepted geometry and glyph advances are separate gates.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {renderSvg,resolvePresentation} from '../dist/svg.js';
import {loadOfficeFontRegistry} from '../dist/fonts-node.js';
import {acceptedTextFixtures} from './accepted-text-fixtures.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fonts=await loadOfficeFontRegistry({substitutionPolicy:'visual'});
const fixtures=acceptedTextFixtures(),out=process.argv[2];
if(out)await mkdir(out,{recursive:true});
const cases=fixtures.map(({id,deck})=>{
  const options={trace:true,textMeasurement:fonts.textMeasurement},bound=resolvePresentation(deck,options).slides[0];
  const svg=renderSvg(deck,options);
  const expected=bound.geometry.items.flatMap(item=>{
    const fit=item.text,align=item.field==='title'?bound.design.titleAlignment:bound.design.contentAlignment;
    return fit.richLines?fit.richLines.flatMap(line=>line.fragments.map(fragment=>({
      text:fragment.text,path:item.path,box:item.box,style:fragment.style,size:fragment.fontSize,
      x:item.box.x+(align==='right'?item.box.width-line.width:align==='center'?(item.box.width-line.width)/2:0)+fragment.x,
      y:item.box.y+line.baseline+fragment.baselineShift,width:fragment.width,
    }))):fit.lines.map((text,index)=>{
      const width=fonts.textMeasurement.measure(text,fit.fontSize,item.textStyle);
      return {text,path:item.path,box:item.box,style:item.textStyle,size:fit.fontSize,
        x:item.box.x+(align==='right'?item.box.width-width:align==='center'?(item.box.width-width)/2:0),
        y:item.box.y+fit.fontSize+index*fit.lineHeight,width};
    });
  });
  return {id,svg,svgSha256:hash(svg),sourceSha256:hash(JSON.stringify(deck)),expected};
});
const faces=fonts.embeddedFonts.filter(face=>face.family==='Carlito');
assert.equal(faces.length,4);
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined});
const errors=[],requests=[];
try {
  const page=await browser.newPage({viewport:{width:1400,height:1050}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://**',route=>{requests.push(route.request().url());return route.abort();});
  await page.route('https://**',route=>{requests.push(route.request().url());return route.abort();});
  await page.setContent('<style>body{margin:0}</style><main></main>');
  await page.evaluate(async faces=>{
    for(const face of faces)document.fonts.add(await new FontFace(face.family,`url(${face.dataUrl})`,{weight:String(face.weight),style:face.italic?'italic':'normal'}).load());
    await document.fonts.ready;
  },faces);
  const results=[];
  for(const item of cases) {
    const result=await page.evaluate(async item=>{
      document.querySelector('main').innerHTML=item.svg;await document.fonts.ready;
      const nodes=[...document.querySelectorAll('svg text')],failures=[],observations=[],textRectangleFindings=[];
      if(nodes.length!==item.expected.length)failures.push('Unexpected text count');
      item.expected.forEach((expected,index)=>{
        const node=nodes[index];if(!node){failures.push('Missing text');return;}
        const actualWidth=node.getComputedTextLength(),bbox=node.getBBox(),first=node.getNumberOfChars()?node.getStartPositionOfChar(0):null;
        const family=getComputedStyle(node).fontFamily;
        if(node.textContent!==expected.text)failures.push(`Source changed: ${expected.path}`);
        if(!family.startsWith('Carlito'))failures.push(`Unexpected font: ${family}`);
        if(Math.abs(actualWidth-expected.width)>.1)failures.push(`Advance differs: ${expected.path} ${JSON.stringify(expected.text)} ${actualWidth-expected.width}`);
        if(first&&(Math.abs(first.x-expected.x)>.1||Math.abs(first.y-expected.y)>.1))failures.push(`Origin differs: ${expected.path}`);
        if(expected.text.trim()&&(bbox.x<expected.box.x-.1||bbox.y<expected.box.y-.1||bbox.x+bbox.width>expected.box.x+expected.box.width+.1||bbox.y+bbox.height>expected.box.y+expected.box.height+.1))textRectangleFindings.push({path:expected.path,index});
        observations.push({path:expected.path,text:expected.text,expectedWidth:expected.width,actualWidth,advanceDifference:actualWidth-expected.width,
          expectedX:expected.x,expectedY:expected.y,actualX:first?.x,actualY:first?.y,bbox:{x:bbox.x,y:bbox.y,width:bbox.width,height:bbox.height}});
      });
      return {id:item.id,svgSha256:item.svgSha256,sourceSha256:item.sourceSha256,observations,textRectangleFindings,failures};
    },item);
    results.push(result);
    if(out&&['wide-card-left-rich','portrait-card-right-rich'].includes(item.id))await page.locator('svg').screenshot({path:path.join(out,item.id+'.png')});
    result.ink=[];
    for(const [sourcePath,box] of new Map(item.expected.map(line=>[line.path,line.box]))) {
      // Use exactly the already-painted text elements. getBBox includes font-wide
      // ascent/descent and bearings; independent raster masks test actual paint.
      await page.evaluate(({svg,sourcePath})=>{
        const main=document.querySelector('main');main.innerHTML=svg;
        const original=main.querySelector('svg'),mask=original.cloneNode(false);
        mask.style.background='#000';mask.style.color='#fff';
        for(const text of original.querySelectorAll('text'))if(text.closest('[data-opf-path]')?.getAttribute('data-opf-path')===sourcePath){
          const clone=text.cloneNode(true);clone.style.fill='#fff';clone.style.color='#fff';mask.append(clone);
        }
        main.replaceChildren(mask);
      },{svg:item.svg,sourcePath});
      const png=await page.locator('svg').screenshot(),{data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
      const bounds={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};let pixels=0;const outside=[];
      for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++) {
        const at=(y*info.width+x)*info.channels,coverage=Math.max(data[at],data[at+1],data[at+2]);if(!coverage)continue;
        pixels++;bounds.left=Math.min(bounds.left,x);bounds.top=Math.min(bounds.top,y);bounds.right=Math.max(bounds.right,x);bounds.bottom=Math.max(bounds.bottom,y);
        // Compare the difference so an exact 0.1 boundary is not rejected by
        // binary addition (for example 57.6 + 1164.8 + 0.1).
        if(Math.max(box.x-(x+.5),box.y-(y+.5),x+.5-(box.x+box.width),y+.5-(box.y+box.height))>.1+1e-9)outside.push({x,y,coverage});
      }
      assert.ok(pixels>0,`${item.id}: the nonblank ${sourcePath} mask must contain paint`);
      if(out)await writeFile(path.join(out,`${item.id}-${sourcePath}.mask.png`),png);
      result.ink.push({path:sourcePath,box,pixels,bounds,maskSha256:hash(png),outside});
      if(outside.length)result.failures.push(`Paint leaves cell: ${sourcePath} (${outside.length} pixels)`);
    }
  }
  const report={node:process.version,browser:browser.version(),platform:process.platform,
    verifierSha256:hash(await readFile(new URL(import.meta.url))),rendererSha256:hash(await readFile(new URL('../dist/svg.js',import.meta.url))),
    fontHashes:faces.map(face=>({family:face.family,weight:face.weight,italic:face.italic,sha256:hash(Buffer.from(face.dataUrl.split(',')[1],'base64'))})),
    results,errors,requests,scope:'24 actual SVG cases. Exact Carlito regular/bold/italic/bold-italic bytes. Accepted-line source, 0.1 reference-pixel advance/origin tolerance. Font text rectangles are recorded separately from actual white-on-black text paint; all nonzero mask pixel centers must be within cells plus 0.1 pixel. Plain core fitting still normalizes whitespace. Aptos is an explicitly selected visual substitute; no Aptos equivalence, native export, shaping/bidi or raster equivalence claim.'};
  if(out)await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  const failures=results.flatMap(result=>result.failures.map(failure=>`${result.id}: ${failure}`));
  assert.deepEqual(failures,[]);
  console.log(`Accepted text browser: ${results.length} offline cases preserve source, accepted origins, natural advances and glyph containment.`);
}finally{await browser.close();}
