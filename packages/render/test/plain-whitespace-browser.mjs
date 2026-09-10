import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {chromium} from 'playwright';
import {renderSvg,resolvePresentation} from '../dist/svg.js';
import {prepareNodeFonts} from '../dist/fonts-node.js';
const {registry,options:fontOptions}=await prepareNodeFonts(),output=path.resolve(process.argv[2]??'artifacts/plain-whitespace-browser');
await mkdir(output,{recursive:true});
const fixtures=['  Keep  repeated spaces and a nonbreaking pair A\u00a0B.  \r\n\r\nFinal e\u0301 accent  \r','\tLeading tab\tsecond tab  \n  After blank\r\n\r\nTail\t'];
const browser=await chromium.launch({channel:process.platform==='win32'&&!process.env.CI?'msedge':undefined}),errors=[],requests=[],results=[];
try {
 const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});await page.setContent('<style>body{margin:0}</style><main></main>');
 await page.evaluate(async faces=>{for(const face of faces)document.fonts.add(await new FontFace(face.family,`url(${face.dataUrl})`,{weight:String(face.weight),style:face.italic?'italic':'normal'}).load());await document.fonts.ready;},registry.embeddedFonts);
 for(const mode of ['estimated','measured'])for(const align of ['left','center','right'])for(const [width,height]of [[1280,720],[720,1280]])for(const [fixture,text]of fixtures.entries()) {
  const document={design:{fontScheme:'roboto',dimensions:{widthInches:width/96,heightInches:height/96},contentAlignment:align,titleAlignment:align},slides:[{title:'  Exact  title\tend  ',text}]},before=structuredClone(document),options={trace:true,...(mode==='measured'?{textMeasurement:fontOptions.textMeasurement}:{})};
  const bound=resolvePresentation(document,options).slides[0],svg=renderSvg(document,options);assert.deepEqual(document,before);assert.deepEqual(bound.geometry.diagnostics,[]);
  await page.setViewportSize({width,height});
  const actual=await page.evaluate(async({svg,items,mode,align})=>{
   document.querySelector('main').innerHTML=svg;await document.fonts.ready;
   return items.map(item=>{
    const lines=[...document.querySelectorAll(`text[data-opf-path="${item.path}"]`)];if(lines.length!==item.text.lines.length)throw Error('Missing source line');
    let restored='';const observations=[];
    for(const [index,node]of lines.entries()) {
     const expected=item.text.sourceLines[index],source=item.value;if(node.textContent!==source.slice(expected.start,expected.end))throw Error('Visible whitespace changed');
     for(const [key,value]of [['opfSourceStart',expected.start],['opfSourceEnd',expected.end],['opfSourceNextStart',expected.nextStart]])if(+node.dataset[key]!==value)throw Error('Source range changed');
     if(node.dataset.opfLineBoundary!==expected.boundary||getComputedStyle(node).whiteSpace!=='pre')throw Error('Line boundary or whitespace policy changed');
     restored+=node.textContent+source.slice(expected.end,expected.nextStart);
     const placed=item.text.placement?.lines[index],segments=[...node.querySelectorAll('tspan')],factor=align==='right'?1:align==='center'?.5:0,origin=placed?.x??item.box.x+(item.box.width-expected.width)*factor;
     const observed={sourceStart:expected.start,sourceEnd:expected.end,tabDifferences:[],advanceDifference:null,intrinsicCorrection:null};
     for(const [i,span]of segments.entries()) {
      const segment=expected.segments[i];if(span.textContent!==source.slice(segment.start,segment.end))throw Error('Segment source changed');
      const start=span.getStartPositionOfChar(0).x;observed.tabDifferences.push(start-(origin+segment.x));
      if(mode==='measured')observed.tabDifferences.push(span.getComputedTextLength()-segment.width);
     }
     if(placed&&node.textContent&&!segments.length) {
      observed.advanceDifference=node.getComputedTextLength()-placed.width;
      const clone=node.cloneNode(true);clone.removeAttribute('textLength');clone.removeAttribute('lengthAdjust');clone.style.visibility='hidden';node.parentNode.append(clone);observed.intrinsicCorrection=clone.getComputedTextLength()-placed.width;clone.remove();
      if(Math.abs(observed.intrinsicCorrection)>.001*placed.width+1/64)throw Error('Accepted scalar advance correction exceeds fixture bound');
     }
     observations.push(observed);
    }
    if(restored!==item.value)throw Error('Source reconstruction differs');return {path:item.path,lines:observations,restored};
   });
  },{svg,items:bound.geometry.items,mode,align});
  results.push({mode,align,width,height,fixture,items:actual});
  if(align==='right'&&fixture===1){await writeFile(path.join(output,`${mode}-${width}.svg`),svg);await page.screenshot({path:path.join(output,`${mode}-${width}.png`)});}
 }
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 await writeFile(path.join(output,'report.json'),JSON.stringify({node:process.version,browser:browser.version(),verifierSha256:hash(await readFile(new URL(import.meta.url))),rendererSha256:hash(await readFile(new URL('../dist/svg.js',import.meta.url))),results,errors,requests,scope:'24 offline presentation cases / 48 scalar fields, each with title and body; exact source ranges and CR/LF/CRLF reconstruction, explicit tab positions, measured advances and bounded intrinsic corrections. Estimated wrapping remains approximate; no native Office claim.'},null,2)+'\n');
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 for(const result of results)for(const item of result.items)for(const line of item.lines){for(const delta of line.tabDifferences)assert.ok(Math.abs(delta)<.1,JSON.stringify({result:{...result,items:undefined},line}));assert.ok(Math.abs(line.advanceDifference??0)<.1);}
 console.log('24 offline presentation cases / 48 scalar fields preserve exact source, hard breaks and explicit tab positions.');
}finally{await browser.close();}
