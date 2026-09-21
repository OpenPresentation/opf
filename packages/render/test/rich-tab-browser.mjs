import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {renderSvg,resolvePresentation} from '../dist/index.js';
import {layoutTable} from '@openpresentation/opf/composition';
import {prepareNodeFonts} from '../src/fonts-node.js';

const hash=value=>createHash('sha256').update(value).digest('hex');
const fixtureRuns=[{text:'Lead\t',fontSize:18},{text:'Large evidence phrase ',fontSize:30,bold:true},{text:'continues in smaller text across the same editable table cell so natural layout must wrap this sentence without authored line breaks or inserted offsets. ',fontSize:18},{text:'Second large phrase ',fontSize:30},{text:'finishes the control with exact source runs.',fontSize:18}];
const deck={design:{fontScheme:{major:'Carlito',minor:'Carlito',type:'sans-serif',heading:{family:'Carlito'},body:{family:'Carlito'},accent:{family:'Carlito'},code:{family:'Cousine'}}},slides:[{table:{rows:[[fixtureRuns]]}}]};
const sourceBytes=Buffer.from(JSON.stringify(deck)),sourceText=fixtureRuns.map(run=>run.text).join('');
const prepared=await prepareNodeFonts({pack:'office'}),options={trace:true,...prepared.options};
const bound=resolvePresentation(deck,options).slides[0],item=bound.geometry.items.find(value=>value.field==='table');
const scale=Math.min(bound.design.dimensions.width,bound.design.dimensions.height)/720;
const layout=layoutTable(item.value,item.box,{scale,minFontSize:(bound.composition??bound.geometry.composition).minFontSize,fontFamily:bound.design.fonts.body,textMeasurement:options.textMeasurement,path:item.path});
const cell=layout.rows[0].cells[0],fragments=cell.fit.richLines.flatMap(line=>line.fragments),tab=fragments.find(fragment=>fragment.kind==='tab'),following=fragments[fragments.indexOf(tab)+1];
assert.ok(tab&&following);
const expected={tabX:cell.textBox.x+tab.x,tabWidth:tab.width,followingX:cell.textBox.x+following.x};
const svg=renderSvg(deck,options),browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined});
const errors=[],requests=[];let actual;
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
  await page.setContent(`<main>${svg}</main>`);await page.evaluate(()=>document.fonts.ready);
  actual=await page.evaluate(source=>{
    const tab=document.querySelector('[data-opf-segment="tab"]'),following=document.querySelector('[data-opf-text-start="5"]');
    if(!tab||!following)throw Error('Missing tab or following fragment');
    const selection=getSelection(),range=document.createRange();range.selectNodeContents(tab);selection.removeAllRanges();selection.addRange(range);
    const selected=selection.toString();selection.removeAllRanges();
    const nodes=[...document.querySelectorAll('[data-opf-text-start]')],spans=nodes.map(node=>({start:+node.dataset.opfTextStart,end:+node.dataset.opfTextEnd,text:node.textContent,segment:node.dataset.opfSegment??null}));
    const start=tab.getStartPositionOfChar(0),end=tab.getEndPositionOfChar(0),next=following.getStartPositionOfChar(0);
    return {tabText:tab.textContent,tabSource:source.slice(+tab.dataset.opfTextStart,+tab.dataset.opfTextEnd),tabChars:tab.getNumberOfChars(),selected,
      x:start.x,endX:end.x,computedLength:tab.getComputedTextLength(),followingX:next.x,fontFamily:getComputedStyle(tab).fontFamily,
      textLength:+tab.getAttribute('textLength'),lengthAdjust:tab.getAttribute('lengthAdjust'),spacing:tab.closest('[data-opf-rich-spacing]').dataset.opfRichSpacing,spans};
  },sourceText);
} finally {await browser.close();}

assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
assert.equal(actual.tabText,'\t');assert.equal(actual.tabSource,'\t');assert.equal(actual.selected,' ');assert.equal(actual.tabChars,1);
assert.equal(actual.lengthAdjust,'spacingAndGlyphs');assert.equal(actual.spacing,'measured');assert.ok(actual.fontFamily.startsWith('Carlito'));
for(const [label,value,wanted] of [['tab x',actual.x,expected.tabX],['tab end',actual.endX,expected.tabX+expected.tabWidth],['tab computed advance',actual.computedLength,expected.tabWidth],['tab textLength',actual.textLength,expected.tabWidth],['following x',actual.followingX,expected.followingX],['tab/following continuity',actual.followingX,expected.tabX+expected.tabWidth]])assert.ok(Math.abs(value-wanted)<.1,`${label}: ${value-wanted}`);
assert.equal(actual.spans.map(span=>span.text).join(''),sourceText);
for(const span of actual.spans)assert.equal(sourceText.slice(span.start,span.end),span.text);
assert.deepEqual(actual.spans.filter(span=>span.segment==='tab').map(({start,end,text})=>({start,end,text})),[{start:4,end:5,text:'\t'}]);

const report={kind:'rich-tab-candidate-browser',node:process.version,browser:browser.version(),platform:process.platform,officeOrFontRegistrationCalls:0,toleranceReferencePixels:.1,sourceSha256:hash(sourceBytes),rendererSha256:hash(await readFile(new URL('../dist/svg.js',import.meta.url))),sourceDomPreservesTab:actual.tabText==='\t'&&actual.tabSource==='\t',selectionNormalizesTabToSpace:actual.selected===' ',expected,actual,errors,requests,scope:'One measured Carlito rich-table tab. The DOM text and traced source span retain U+0009; Chromium Selection serializes the rendered whitespace as U+0020. Browser glyph count, accepted tab advance/origin and following-fragment continuity are checked. No native Office, PPTX, bidi/shaping or pixel-equivalence claim.'};
console.log(JSON.stringify({passed:true,node:report.node,browser:report.browser,toleranceReferencePixels:.1,sourceDomPreservesTab:report.sourceDomPreservesTab,selectionNormalizesTabToSpace:report.selectionNormalizesTabToSpace,expected,actual:{x:actual.x,endX:actual.endX,computedLength:actual.computedLength,followingX:actual.followingX,selected:actual.selected,fontFamily:actual.fontFamily},errors,requests}));
