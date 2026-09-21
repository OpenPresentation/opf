import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {renderSvg} from '../dist/index.js';
import {prepareNodeFonts} from '../src/fonts-node.js';

const runs=[{text:'A',fontSize:18},{text:'B',fontSize:30,bold:true},{text:'\t',fontSize:18},{text:'C',fontSize:18},{text:'D',fontSize:30,italic:true}];
const deck={design:{fontScheme:{major:'Carlito',minor:'Carlito',type:'sans-serif',heading:{family:'Carlito'},body:{family:'Carlito'},accent:{family:'Carlito'},code:{family:'Cousine'}}},slides:[{table:{rows:[[runs]]}}]};
const prepared=await prepareNodeFonts({pack:'office'}),options={trace:true,embeddedFonts:prepared.options.embeddedFonts};
assert.equal(options.textMeasurement,undefined);
const svg=renderSvg(deck,options),browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined});
const errors=[],requests=[];let actual;
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
  await page.setContent(svg);await page.evaluate(()=>document.fonts.ready);
  actual=await page.evaluate(()=>{
    const group=document.querySelector('[data-opf-rich-spacing="mixed-estimated-tabs"]'),at=start=>group?.querySelector(`[data-opf-text-start="${start}"]`);
    const [a,b,tab,c,d]=[0,1,2,3,4].map(at);if([a,b,tab,c,d].some(value=>!value))throw Error('missing traced body fragment');
    const start=node=>node.getStartPositionOfChar(0).x,end=node=>node.getEndPositionOfChar(node.getNumberOfChars()-1).x;
    return {tags:[a,b,tab,c,d].map(node=>node.tagName),beforeNaturalChunk:a.parentElement===b.parentElement&&a.parentElement.tagName.toLowerCase()==='text',afterNaturalChunk:c.parentElement===d.parentElement&&c.parentElement.tagName.toLowerCase()==='text',beforeGap:start(b)-end(a),afterGap:start(d)-end(c),tabToFollowing:start(c)-end(tab),tabText:tab.textContent,spacing:group.dataset.opfRichSpacing,lineTrace:JSON.parse(group.dataset.opfRichLines)};
  });
} finally {await browser.close();}

assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
assert.deepEqual(actual.tags,['tspan','tspan','text','tspan','tspan']);
assert.equal(actual.beforeNaturalChunk,true);assert.equal(actual.afterNaturalChunk,true);
assert.equal(actual.tabText,'\t');assert.equal(actual.spacing,'mixed-estimated-tabs');
assert.equal(actual.lineTrace[0].spacing,'natural-chunks-estimated-tabs');
assert.ok(Math.abs(actual.beforeGap)<.1);assert.ok(Math.abs(actual.afterGap)<.1);assert.ok(Math.abs(actual.tabToFollowing)<.1);
console.log(JSON.stringify({passed:true,node:process.version,browser:browser.version(),toleranceReferencePixels:.1,officeOrFontRegistrationCalls:0,actual,errors,requests,scope:'Unmeasured mixed-size browser flow is natural inside text chunks and fixed only at the estimated tab boundary; no measured/native equivalence claim.'}));
