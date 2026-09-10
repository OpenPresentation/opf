// Actual renderer SVG, exact bundled font bytes and browser glyph/segment checks.
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {renderSvg,resolvePresentation} from '../dist/svg.js';
import {loadOfficeFontRegistry} from '../dist/fonts-node.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fonts=await loadOfficeFontRegistry(),faces=fonts.embeddedFonts.filter(face=>face.family==='Cousine'&&[400,700].includes(face.weight)&&!face.italic);
assert.equal(faces.length,2);
const cases=[];
for (const dimensions of [{width:1280,height:720},{width:540,height:960}]) for (const [name,code] of Object.entries({
  shorthand:'\tconst value = "two  spaces";  \r\n\r\nlast\n',
  blank:'\r\n\r\n\n',
  metadata:{source:'a\tb\naaaa\tb\n\t\t\n \t \tkeep  ',filename:'src\tCaseSensitive.ts',language:'TypeScript'},
  language:{source:'Keep body',language:'Long-language-label-'.repeat(20)},
  filename:{source:'<&> "two  spaces"',filename:'a-long-file-path/'.repeat(15)},
  wrapped:{source:'  meaningful indentation '+ 'longtoken'.repeat(30)+'\r\n\treturn value;  \n',language:'ts'},
})) {
  const deck={design:{dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96},fontScheme:{id:'calibri',code:{family:'Courier New'}}},slides:[{composition:{minFontSize:24},code}]};
  const options={trace:true,textMeasurement:fonts.textMeasurement},bound=resolvePresentation(deck,options).slides[0];
  assert.deepEqual(bound.geometry.diagnostics,[]);
  const svg=renderSvg(deck,options),item=bound.geometry.items[0];
  assert.ok(item.codeLayout.parts.every(part=>part.style.fontFamily==='Cousine'));
  cases.push({id:name+'-'+dimensions.width,...dimensions,svg,svgSha256:hash(svg),cell:item.box,parts:item.codeLayout.parts});
}
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined}),errors=[],externalRequests=[];
try {
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))externalRequests.push(request.url());});
  await page.setContent('<main></main>');
  const results=await page.evaluate(async({faces,cases})=>{
    for(const face of faces) document.fonts.add(await new FontFace(face.family,`url(${face.dataUrl})`,{weight:String(face.weight)}).load());
    await document.fonts.ready;
    const fail=message=>{throw new Error(message);},results=[];
    for(const item of cases) {
      document.querySelector('main').innerHTML=item.svg;await document.fonts.ready;
      const nodes=[...document.querySelectorAll('text[data-opf-code-role]')];let cursor=0;
      const groups=[...document.querySelectorAll('g[data-opf-code-role]')];if(groups.length!==item.parts.length)fail('Missing code part targets');
      const parts=[];
      for(const part of item.parts) {
        const group=groups[parts.length],tracedBox=Object.fromEntries(['x','y','width','height'].map(dimension=>[dimension,Number(group.getAttribute('data-opf-box-'+dimension))]));
        for(const dimension of ['x','y','width','height'])if(tracedBox[dimension]!==part.box[dimension])fail(`Accepted edit target differs: ${item.id} ${part.role} ${dimension}`);
        const lines=[];let reconstructed='';
        for(const [index,line] of part.fit.sourceLines.entries()) {
          const node=nodes[cursor++];if(!node||node.textContent!==part.text.slice(line.start,line.end)) fail(`Source changed: ${item.id} ${part.role} ${index}`);
          if(Number(node.dataset.opfTextStart)!==line.start||Number(node.dataset.opfTextEnd)!==line.end||Number(node.dataset.opfTextNextStart)!==line.nextStart)fail('Source offsets differ');
          reconstructed+=node.textContent+part.text.slice(line.end,line.nextStart);
          const bbox=node.getBBox();
          if(node.textContent&& (bbox.x<item.cell.x-.1||bbox.y<item.cell.y-.1||bbox.x+bbox.width>item.cell.x+item.cell.width+.1||bbox.y+bbox.height>item.cell.y+item.cell.height+.1)) fail(`Glyphs leave code cell: ${item.id} ${part.role}`);
          const segments=[...node.children].map((span,i)=>{
            const expected=line.segments[i];if(span.textContent!==part.text.slice(expected.start,expected.end)) fail('Segment text differs');
            const start=span.getStartPositionOfChar(0).x,expectedX=part.box.x+expected.x;
            if(Math.abs(start-expectedX)>.1)fail('Accepted segment start differs');
            return {kind:expected.kind,expectedX,start,expectedWidth:expected.width,actualAdvance:span.getComputedTextLength()};
          });
          const actualAdvance=node.getComputedTextLength();
          lines.push({expectedWidth:line.width,actualAdvance,advanceDifference:actualAdvance-line.width,bbox:{x:bbox.x,y:bbox.y,width:bbox.width,height:bbox.height},segments});
        }
        if(reconstructed!==part.text)fail('Source reconstruction failed');
        parts.push({role:part.role,sourcePreserved:true,box:part.box,tracedBox,lines});
      }
      if(cursor!==nodes.length)fail('Unexpected code text nodes');
      for(let i=1;i<parts.length;i++) {
        const before=parts[i-1].lines.filter(line=>line.bbox.width>0),after=parts[i].lines.filter(line=>line.bbox.width>0);
        if(before.length&&after.length&&Math.max(...before.map(line=>line.bbox.y+line.bbox.height))>Math.min(...after.map(line=>line.bbox.y))) fail(`Code parts overlap: ${item.id}`);
      }
      results.push({id:item.id,svgSha256:item.svgSha256,parts});
    }
    return results;
  },{faces,cases});
  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);
  const report={browser:browser.version(),platform:process.platform,verifierSha256:hash(await readFile(new URL(import.meta.url))),rendererSha256:hash(await readFile(new URL('../dist/svg.js',import.meta.url))),
    fontHashes:faces.map(face=>({family:face.family,weight:face.weight,sha256:hash(Buffer.from(face.dataUrl.split(',')[1],'base64'))})),results,errors,externalRequests,
    scope:'Twelve actual SVG outputs with exact Cousine regular/bold bytes: source/offset preservation, accepted complete edit-target boxes including blank multiline source, accepted segment starts within 0.1 reference pixel, glyph cell containment and separate metadata/body glyphs. Natural browser advance differences are recorded. This is not native export, shaping/bidi conformance or raster equivalence.'};
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
  console.log(`Actual shared code browser: ${results.length} wide/portrait cases with source preservation, accepted tab positions and contained glyphs.`);
} finally {await browser.close();}
