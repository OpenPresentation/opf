// Verify the standalone candidate's accepted segment positions with actual bundled font bytes.
// node scripts/test-code-layout-browser.mjs <registry-consumer> <geometry-report.json> [report.json] [renderer-checkout]
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {layoutCode} from '../packages/javascript/dist/composition.js';

assert.ok(!process.env.NODE_OPTIONS&&!process.execArgv.some(value=>/^(--import|--loader|--experimental-loader|--require|-r)(=|$)/.test(value)), 'Run without source aliases or preload/loader arguments.');
const [consumer,geometryFile,output,renderer='../opf-render']=process.argv.slice(2);
assert.ok(consumer&&geometryFile,'Provide the registry consumer and freshly generated candidate geometry report.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const geometryBytes=await readFile(geometryFile),geometry=JSON.parse(geometryBytes);
for (const item of [...geometry.sourceHashes,...geometry.runtimeHashes]) assert.equal(hash(await readFile(item.file)),item.sha256,`Stale candidate evidence: ${item.file}`);
const require=createRequire(path.resolve(consumer,'package.json'));
const browserRequire=createRequire(path.resolve(renderer,'package.json'));
const {loadOfficeFontRegistry}=await import(pathToFileURL(require.resolve('@openpresentation/opf-render/fonts-node')));
const registry=await loadOfficeFontRegistry();
const faces=registry.embeddedFonts.filter(face=>face.family==='Cousine'&&[400,700].includes(face.weight)&&!face.italic);
assert.equal(faces.length,2);
const fontHashes=faces.map(face=>({family:face.family,weight:face.weight,sha256:hash(Buffer.from(face.dataUrl.split(',')[1],'base64')),license:face.license}));
for (const face of fontHashes) assert.ok(geometry.fontHashes.some(item=>item.sha256===face.sha256),'Use the exact measured registry font bytes.');
const samples=['a\tb','aaaa\tb','\tconst value = "two  spaces";','  indentation  ','a\t','\t\t',' \t \tkeep  ']
  .map(source=>({source,role:'body'}));
samples.push({source:'src\tCaseSensitive.ts',role:'filename'});
const cases=samples.map(({source,role})=>{
  const value=role==='filename'?{source:'body',filename:source}:source;
  const part=layoutCode(value,{x:0,y:0,width:1000,height:500},{fonts:{code:'Cousine'},textMeasurement:registry.textMeasurement}).parts.find(part=>part.role===role);
  assert.ok(part?.fit&&!part.fit.overflow);assert.equal(part.fit.lines.length,1);
  return {source,role,fontSize:part.fit.fontSize,style:part.style,expected:part.fit.sourceLines[0].width,segments:part.fit.sourceLines[0].segments};
});
const browser=await browserRequire('playwright').chromium.launch({channel:process.platform==='win32'?'msedge':undefined});
const errors=[],externalRequests=[];
try {
  const page=await browser.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/^https?:/.test(request.url()))externalRequests.push(request.url());});
  await page.setContent('<svg id="probe" width="1000" height="600" xmlns="http://www.w3.org/2000/svg"></svg>');
  const results=await page.evaluate(async({faces,cases})=>{
    for (const face of faces) document.fonts.add(await new FontFace(face.family,`url(${face.dataUrl})`,{weight:String(face.weight)}).load());
    await document.fonts.ready;
    return cases.map((item,index)=>{
      const node=document.createElementNS('http://www.w3.org/2000/svg','text');
      node.setAttribute('x','0');node.setAttribute('y',String(30+index*60));node.setAttribute('font-family',item.style.fontFamily);
      node.setAttribute('font-size',String(item.fontSize));node.setAttribute('font-weight',String(item.style.fontWeight));
      node.setAttribute('xml:space','preserve');node.style.whiteSpace='pre';node.style.tabSize='4';node.textContent=item.source;
      document.querySelector('#probe').append(node);
      const cssOnlyAdvance=node.getComputedTextLength();
      node.textContent='';
      const positions=[];
      for (const segment of item.segments) {
        const span=document.createElementNS('http://www.w3.org/2000/svg','tspan');span.setAttribute('x',String(segment.x));
        if (segment.kind==='tab') {span.setAttribute('textLength',String(segment.width));span.setAttribute('lengthAdjust','spacingAndGlyphs');}
        span.textContent=item.source.slice(segment.start,segment.end);node.append(span);
        positions.push({kind:segment.kind,source:span.textContent,expectedX:segment.x,expectedEndX:segment.x+segment.width,
          actualX:span.getStartPositionOfChar(0).x,actualEndX:span.getEndPositionOfChar(span.getNumberOfChars()-1).x});
      }
      return {source:item.source,role:item.role,fontSize:item.fontSize,fontWeight:item.style.fontWeight,expectedAdvance:item.expected,
        cssOnlyAdvance,acceptedAdvance:node.getComputedTextLength(),bboxWidth:node.getBBox().width,domText:node.textContent,positions};
    });
  },{faces,cases});
  for (const item of results) {
    assert.equal(item.domText,item.source,'Literal tabs and whitespace must survive DOM text serialization.');
    assert.ok(Math.abs(item.acceptedAdvance-item.expectedAdvance)<=.1,`Accepted segment advance differs: ${JSON.stringify(item)}`);
    for (const segment of item.positions) {
      assert.ok(Math.abs(segment.actualX-segment.expectedX)<=.1,'Accepted segment start differs.');
      assert.ok(Math.abs(segment.actualEndX-segment.expectedEndX)<=.1,'Accepted segment end differs.');
    }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);
  const report={browser:browser.version(),geometryReportSha256:hash(geometryBytes),verifierSha256:hash(await readFile(new URL(import.meta.url))),
    fontHashes,toleranceReferencePixels:.1,results,externalRequests,errors,
    scope:'Standalone core code geometry rendered by this controlled SVG harness using exact Cousine regular/bold bytes. Eight cases preserve literal tabs/whitespace and match accepted advances and segment starts/ends within 0.1 reference pixel. CSS-only tab behavior is observed separately. This is not integrated OPF renderer output, native PowerPoint output, glyph-outline equivalence or broad font/script conformance.'};
  if (output) await writeFile(output,`${JSON.stringify(report,null,2)}\n`);
  console.log(`Verified ${results.length} accepted code segment cases in browser ${report.browser}; no external requests or page errors.`);
} finally {await browser.close();}
