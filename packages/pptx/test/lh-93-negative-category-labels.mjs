// LH-93 native acceptance follow-up: negative horizontal categories stay in the preview's left gutter, not at zero.
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {toPptx,fromPptx} from '../dist/index.js';
import {toSvg} from '@openpresentation/opf-render';
import {resolveSlideContext} from '@openpresentation/opf';
import {composeSlide} from '@openpresentation/opf/composition';
const data={columns:['Stage','Current','Expansion'],rows:[['Lead',-20,64],['Won',null,30]]};
const scenarios=[
 ['clustered', {type:'bar',data},'low'],
 ['stacked', {type:'stacked-bar',data},'low'],
 ['all-negative', {type:'bar',data:{columns:['Stage','Current'],rows:[['Lead',-20],['Won',-30]]}},'low'],
 ['authored-options',{type:'bar',axisTitles:{category:'Stage title',value:'Value title'},legend:'bottom',dataLabels:false,data},'low'],
 ['nonnegative',{type:'bar',data:{columns:['Stage','Current'],rows:[['Lead',20],['Won',30]]}},'nextTo'],
 ['percent',{type:'100pct-stacked-bar',data:{columns:['Stage','Current','Expansion'],rows:[['Lead',20,80],['Won',30,70]]}},'nextTo'],
 ['negative-column',{type:'column',data},'low'],
];
for(const[name,chart,position]of scenarios){
 const deck={name,design:{fontScheme:{major:'Arial',minor:'Arial'}},slides:[{title:'Requests by stage',chart}]},bytes=await toPptx(deck),parts=unzipSync(bytes),xml=strFromU8(parts['ppt/charts/chart1.xml']),axis=/<c:catAx>[\s\S]*?<\/c:catAx>/.exec(xml)?.[0];
 assert.ok(axis,name+': actual native category axis');assert.match(axis,new RegExp(`<c:tickLblPos val="${position}"/>`),name+': category label policy');
 assert.match(axis,/<c:crosses val="autoZero"\/>/,name+': axis itself still crosses at zero');
 if(name==='authored-options'){
  assert.match(xml,/<c:legendPos val="b"\/>/,'authored bottom legend retained');assert.ok(xml.includes('Stage title')&&xml.includes('Value title'),'authored axis titles retained');assert.ok(!xml.includes('<c:showVal val="1"/>')&&!xml.includes('<c:showCatName val="1"/>'),'authored labels false retained');
 }
 if(position==='low')assert.match(xml,/<c:valAx>[\s\S]*?<c:min val="-\d/,name+': same negative numeric bound');
 const back=await fromPptx(bytes),expected=structuredClone(chart);
 // The existing importer normalizes an unshown default label block to omission; native false semantics are asserted above.
 if(name==='authored-options')delete expected.dataLabels;
 assert.deepEqual(back.slides[0].chart,expected,name+': complete data, titles, legend and existing default normalization survive');
}
console.log('LH-93 negative category labels: clustered, stacked, all-negative, authored-option and ordinary/percent/column controls pass.');

// Horizontal bars keep a left category gutter in RTL too; only columns/lines/areas reverse their category slots.
for(const language of [{bcp47:'en-US',direction:'rtl'},{bcp47:'he-IL'}]){
 const deck={language,design:{fontScheme:{major:'Arial',minor:'Arial'}},slides:[{title:'Negative RTL categories',chart:{type:'stacked-bar',data}}]},context=resolveSlideContext(deck,0),geometry=composeSlide(context.slide,context.options),item=geometry.items.find(i=>i.field==='chart'),plot=item.chart.layer.plot;
 assert.equal(geometry.direction,'rtl');assert.ok(plot,'stacked plot is shared with renderer/export');
 const svg=toSvg(deck,1,{trace:true}),label=[...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].find(match=>match[1].includes('data-opf-path="slides.0.chart.data.rows.0.0"'));
 assert.ok(label,'actual rendered category text is traced');const x=Number(/\bx="([^"]+)"/.exec(label[1])?.[1]);assert.ok(x<item.box.x+plot.left,'RTL preview category anchor stays physically left of the plot');assert.ok(label[2].includes('Lead'));
 const parts=unzipSync(await toPptx(deck)),xml=strFromU8(parts['ppt/charts/chart1.xml']),cat=/<c:catAx>[\s\S]*?<\/c:catAx>/.exec(xml)[0],val=/<c:valAx>[\s\S]*?<\/c:valAx>/.exec(xml)[0];
 assert.match(cat,/<c:orientation val="maxMin"\/>/,'categories remain top-to-bottom');assert.match(cat,/<c:axPos val="l"\/>/,'category axis stays physically left');assert.match(cat,/<c:tickLblPos val="low"\/>/,'labels use the physical low-value edge');
 assert.match(val,/<c:orientation val="minMax"\/>/,'RTL does not reverse the horizontal numeric axis');assert.match(val,/<c:axPos val="b"\/>/,'numeric labels stay at the bottom');assert.match(cat,/<c:crosses val="autoZero"\/>/,'zero crossing is unchanged');
}
console.log('LH-93 RTL: rendered category anchors stay left; native category/value orientations, sides and zero crossing agree.');
