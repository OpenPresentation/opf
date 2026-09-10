// Controlled comparison: identical source and Carlito bytes, estimated vs measured layout.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {examples} from '@openpresentation/opf/examples';
import {renderSvg,resolvePresentation} from '../dist/svg.js';
import {loadOfficeFontRegistry} from '../dist/fonts-node.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),out=process.argv[2]??'artifacts/rich-spacing-browser';
if(out)await mkdir(out,{recursive:true});
const fonts=await loadOfficeFontRegistry({substitutionPolicy:'visual'}),faces=fonts.embeddedFonts.filter(face=>face.family==='Carlito');
assert.equal(faces.length,4);
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined}),errors=[],requests=[],results=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
  await page.setContent('<style>body{margin:0}</style><main></main>');
  await page.evaluate(async faces=>{
    for(const face of faces)for(const alias of ['Carlito','Aptos','Aptos Display'])document.fonts.add(await new FontFace(alias,`url(${face.dataUrl})`,{weight:String(face.weight),style:face.italic?'italic':'normal'}).load());
    await document.fonts.ready;
  },faces);
  for(const name of ['compliance-readiness-review','water-utility-capital-plan']) {
    const fixture=examples.find(example=>example.file.endsWith('/'+name+'.opf.json'));assert.ok(fixture);
    const source=JSON.stringify(fixture.deck),slideIndex=5;
    if(out)await writeFile(path.join(out,name+'.opf.json'),source+'\n');
    for(const mode of ['estimated','measured']) {
      const options={trace:true,slideIndex,...(mode==='measured'?{textMeasurement:fonts.textMeasurement}:{})};
      const bound=resolvePresentation(fixture.deck,options).slides[slideIndex],svg=renderSvg(fixture.deck,options);
      assert.equal(JSON.stringify(fixture.deck),source);
      const items=bound.geometry.items.filter(item=>item.field==='text'&&item.text?.richLines);assert.ok(items.length);
      const expected=items.map(item=>({path:item.path,source:item.value,lines:item.text.richLines}));
      const result=await page.evaluate(async({svg,expected})=>{
        document.querySelector('main').innerHTML=svg;await document.fonts.ready;
        const parts=[];
        for(const item of expected) {
          const group=[...document.querySelectorAll('g[data-opf-path]')].find(node=>node.getAttribute('data-opf-path')===item.path);
          if(!group)throw Error('Missing rich edit target');
          const nodes=[...group.querySelectorAll('text[data-opf-text-start],tspan[data-opf-text-start]')],fragments=[];let cursor=0;
          for(const [lineIndex,line]of item.lines.entries()) {
            let previous;
            for(const fragment of line.fragments) {
              const node=nodes[cursor++];if(node?.textContent!==fragment.text)throw Error('Accepted rich text changed');
              const start=Number(node.dataset.opfTextStart),end=Number(node.dataset.opfTextEnd),source=item.source.map(run=>typeof run==='string'?run:run.text).join('');
              if(source.slice(start,end)!==node.textContent)throw Error('Source mapping changed');
              const x=node.getStartPositionOfChar(0).x,advance=node.getComputedTextLength();
              const gap=previous?x-previous.end:null;
              fragments.push({lineIndex,text:fragment.text,start,end,expectedWidth:fragment.width,actualWidth:advance,widthDifference:advance-fragment.width,
                gapAfterPreviousFragment:gap,fontFamily:getComputedStyle(node).fontFamily});
              previous={end:x+advance};
            }
          }
          if(cursor!==nodes.length)throw Error('Unexpected rich text');
          parts.push({path:item.path,fragments});
        }
        return {parts};
      },{svg,expected});
      const fragments=result.parts.flatMap(part=>part.fragments);
      const maxAdvanceDifference=Math.max(...fragments.map(fragment=>Math.abs(fragment.widthDifference)));
      const maxBoundaryGap=Math.max(...fragments.map(fragment=>Math.abs(fragment.gapAfterPreviousFragment??0)));
      results.push({name,mode,sourceSha256:hash(source),svgSha256:hash(svg),...result,maxAdvanceDifference,maxBoundaryGap});
      if(out){await writeFile(path.join(out,`${name}-${mode}.svg`),svg);await page.locator('svg').screenshot({path:path.join(out,`${name}-${mode}.png`)});}

    }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  const report={node:process.version,browser:browser.version(),verifierSha256:hash(await readFile(new URL(import.meta.url))),rendererSha256:hash(await readFile(new URL('../dist/svg.js',import.meta.url))),
    fonts:faces.map(face=>({family:face.family,weight:face.weight,italic:face.italic,sha256:hash(Buffer.from(face.dataUrl.split(',')[1],'base64'))})),results,errors,requests,
    scope:'Two unchanged gallery slides with exact Carlito bytes in both modes; estimated control registers those bytes under the authored Aptos names to isolate measurement differences. Measured mode explicitly resolves Aptos to Carlito as a visual substitute. Rich source mapping, advances and fragment spacing are checked, not font compatibility, all-slide visual quality, native export or pixel equivalence.'};
  if(out)await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(results.map(({name,mode,maxAdvanceDifference,maxBoundaryGap})=>({name,mode,maxAdvanceDifference,maxBoundaryGap})),null,2));
  for(const result of results){assert.ok(result.maxBoundaryGap<.1,`${result.name}: ${result.mode} run spacing differs by ${result.maxBoundaryGap}px`);if(result.mode==='measured')assert.ok(result.maxAdvanceDifference<.1,`${result.name}: measured width differs by ${result.maxAdvanceDifference}px`);}
}finally{await browser.close();}
