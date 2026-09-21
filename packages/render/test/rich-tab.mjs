import assert from 'node:assert/strict';
import {renderSvg,resolvePresentation} from '../dist/index.js';
import {layoutTable} from '@openpresentation/opf/composition';
import {prepareNodeFonts} from '../src/fonts-node.js';

const fixtureRuns=[{text:'Lead\t',fontSize:18},{text:'Large evidence phrase ',fontSize:30,bold:true},{text:'continues in smaller text across the same editable table cell so natural layout must wrap this sentence without authored line breaks or inserted offsets. ',fontSize:18},{text:'Second large phrase ',fontSize:30},{text:'finishes the control with exact source runs.',fontSize:18}];
const deck={design:{fontScheme:{major:'Carlito',minor:'Carlito',type:'sans-serif',heading:{family:'Carlito'},body:{family:'Carlito'},accent:{family:'Carlito'},code:{family:'Cousine'}}},slides:[{table:{rows:[[fixtureRuns]]}}]};
const source=JSON.stringify(deck),sourceText=deck.slides[0].table.rows[0][0].map(run=>run.text).join('');
const prepared=await prepareNodeFonts({pack:'office'}),base=prepared.options.textMeasurement;
let measureCalls=0,outlineCalls=0;
const textMeasurement={
  resolveStyle:style=>base.resolveStyle(style),
  measure(text,...args){assert.ok(!/[\t\r\n]/u.test(text));measureCalls++;return base.measure(text,...args);},
  outlineBounds(text,...args){assert.ok(!/[\t\r\n]/u.test(text));outlineCalls++;return base.outlineBounds(text,...args);},
};
const renderOptions={trace:true,textMeasurement,embeddedFonts:prepared.options.embeddedFonts};
const bound=resolvePresentation(deck,renderOptions).slides[0],item=bound.geometry.items.find(value=>value.field==='table');
assert.ok(item);
const scale=Math.min(bound.design.dimensions.width,bound.design.dimensions.height)/720;
const layout=layoutTable(item.value,item.box,{scale,minFontSize:(bound.composition??bound.geometry.composition).minFontSize,fontFamily:bound.design.fonts.body,textMeasurement,path:item.path});
const cell=layout.rows[0].cells[0],fragments=cell.fit.richLines.flatMap(line=>line.fragments),tab=fragments.find(fragment=>fragment.kind==='tab');
assert.ok(tab);
assert.equal(cell.fit.lines.join(''),sourceText);
assert.deepEqual(fragments.filter(fragment=>fragment.kind==='tab').map(({runIndex,start,end,text})=>({runIndex,start,end,text})),[{runIndex:0,start:4,end:5,text:'\t'}]);
for(const [runIndex,run] of deck.slides[0].table.rows[0][0].entries())assert.equal(fragments.filter(fragment=>fragment.runIndex===runIndex).map(fragment=>fragment.text).join(''),run.text);

const svg=renderSvg(deck,renderOptions);
assert.equal(JSON.stringify(deck),source);
assert.match(svg,/data-opf-rich-spacing="measured"/);
const tabTag=[...svg.matchAll(/<text\b([^>]*)>(\t)<\/text>/g)].find(match=>/data-opf-segment="tab"/.test(match[1]));
assert.ok(tabTag,'missing fixed-advance tab text');
const attr=(attrs,name)=>new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
assert.equal(Number(attr(tabTag[1],'data-opf-text-start')),4);
assert.equal(Number(attr(tabTag[1],'data-opf-text-end')),5);
assert.equal(attr(tabTag[1],'lengthAdjust'),'spacingAndGlyphs');
assert.ok(Math.abs(Number(attr(tabTag[1],'x'))-(cell.textBox.x+tab.x))<.1);
assert.ok(Math.abs(Number(attr(tabTag[1],'textLength'))-tab.width)<.1);
const following=fragments[fragments.indexOf(tab)+1],followingTag=[...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].find(match=>Number(attr(match[1],'data-opf-text-start'))===5);
assert.ok(followingTag);
assert.ok(Math.abs(Number(attr(followingTag[1],'x'))-(cell.textBox.x+following.x))<.1);
assert.ok(Math.abs(Number(attr(followingTag[1],'x'))-(Number(attr(tabTag[1],'x'))+Number(attr(tabTag[1],'textLength'))))<.1);

const estimatedSvg=renderSvg(deck,{trace:true});
assert.match(estimatedSvg,/data-opf-rich-spacing="mixed-estimated-tabs"/);
const estimatedLineTrace=JSON.parse(attr(/<g\b([^>]*)data-opf-rich-spacing="mixed-estimated-tabs"[^>]*>/.exec(estimatedSvg)[1],'data-opf-rich-lines').replaceAll('&quot;','"'));
assert.ok(estimatedLineTrace.some(line=>line.spacing==='natural-chunks-estimated-tabs'));
assert.match(estimatedSvg,/data-opf-segment="tab"/);

// The shared rich-outline consumer must skip the layout control while retaining
// glyph outlines on both sides. A strict registry would reject U+0009 here.
const outlineDeck={design:{fontScheme:{major:'Carlito',minor:'Carlito',type:'sans-serif',heading:{family:'Carlito'},body:{family:'Carlito'},accent:{family:'Carlito'},code:{family:'Cousine'}}},slides:[{text:[{text:'Before\t',fontFamily:'Carlito'},{text:'After',fontFamily:'Carlito',bold:true}]}]};
assert.doesNotThrow(()=>renderSvg(outlineDeck,renderOptions));
assert.ok(measureCalls>0);
assert.ok(outlineCalls>0);

console.log(JSON.stringify({passed:true,node:process.version,officeOrFontRegistrationCalls:0,sourceLength:sourceText.length,nativeOrPptxClaims:0,tab:{x:tab.x,width:tab.width,start:4,end:5},measureCalls,outlineCalls,measuredSvgBytes:Buffer.byteLength(svg),estimatedTrace:'mixed-estimated-tabs'}));
