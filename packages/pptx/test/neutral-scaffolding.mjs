import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {gallery as defaultCatalog} from '@openpresentation/gallery';
import {toPptx} from '../dist/index.js';
import {colorHex} from './helpers/scheme-colors.mjs';
const design={theme:'classic',fontScheme:'roboto',colorScheme:'cool-horizon'};
const exportXml=async doc=>Object.fromEntries(Object.entries(unzipSync(await toPptx(doc,{catalogs:[defaultCatalog]}))).filter(([n])=>n.endsWith('.xml')).map(([n,b])=>[n,strFromU8(b)]));
const doc={design,slides:[{table:{columns:['Team','Amount'],rows:[['A',5.8],['B',6.7]]}}]};const before=structuredClone(doc);
const parts=await exportXml(doc);assert.deepEqual(doc,before);const xml=parts['ppt/slides/slide1.xml'];const cells=[...xml.matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g)].map(m=>m[0]);
assert.match(cells[1],/<a:pPr[^>]*algn="r"/,'numeric-column header follows numeric edge');
assert.match(cells[3],/<a:pPr[^>]*algn="r"/);assert.match(cells[2],/<a:pPr[^>]*algn="l"/);// RR-96: the table rule is the derived neutral (tx1 at 20% over bg1: black on white is CCCCCC), written as a scheme colour.
assert.match(cells[3],/<a:lnL[^>]*><a:solidFill><a:schemeClr val="tx1"><a:lumMod val="20000"\/><a:lumOff val="80000"\/><\/a:schemeClr>/);
assert.equal(colorHex({'a:schemeClr':{val:'tx1','a:lumMod':{val:'20000'},'a:lumOff':{val:'80000'}}},{dk1:'000000',lt1:'FFFFFF'}),'CCCCCC','the rule neutral resolves to CCCCCC on this black-on-white deck');
assert.doesNotMatch(cells[3],/<a:schemeClr val="accent5"/);
const explicit=structuredClone(doc);explicit.slides[0].table.rows[0][1]={value:5.8,style:{align:'center',borders:{bottom:{color:'accent5',width:2}}}};const styled=(await exportXml(explicit))['ppt/slides/slide1.xml'];assert.match(styled,/<a:pPr[^>]*algn="ctr"/);assert.match(styled,/<a:schemeClr val="accent5"/);
const left=structuredClone(doc);left.design.contentAlignment='left';const leftCells=[...(await exportXml(left))['ppt/slides/slide1.xml'].matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g)].map(m=>m[0]);assert.match(leftCells[3],/<a:pPr[^>]*algn="l"/,'explicit design beats numeric default');
for(const type of ['column','bar','area'])for(const values of [[5.8,6.7],[-5.8,-6.7],[-2,3]]){
 const input={design,slides:[{chart:{type,data:{columns:['Category','Value'],rows:values.map((v,i)=>[String(i),v])}}}]};const all=await exportXml(input);const chart=Object.entries(all).find(([n])=>/^ppt\/charts\/chart\d+\.xml$/.test(n))[1];
 if(values.every(v=>v>=0))assert.match(chart,/<c:min val="0"/);else if(values.every(v=>v<=0))assert.match(chart,/<c:max val="0"/);else {assert.doesNotMatch(chart,/<c:min val="[1-9]/);assert.doesNotMatch(chart,/<c:max val="-/);}
 for(const v of values)assert.ok(chart.includes(`<c:v>${v}</c:v>`),'exact source value cache preserved');// RR-96: the gridlines are a derived neutral (tx1 at 15% over bg1: D9D9D9 here), a scheme colour rather than a literal grey.
 assert.match(chart.match(/<c:majorGridlines>[\s\S]*?<\/c:majorGridlines>/)[0],/<a:schemeClr val="tx1"><a:lumMod val="15000"\/><a:lumOff val="85000"\/><\/a:schemeClr>/);
 assert.doesNotMatch(chart,/<a:srgbClr/,'no literal colour in a chart of theme colours');
}
console.log('Neutral native table/chart rules, alignment overrides and zero-bound magnitude axes passed; no native Office claim.');

const line=await exportXml({design,slides:[{chart:{type:'line',data:{columns:['Category','Value'],rows:[['A',5.8],['B',6.7]]}}}]});const lineXml=Object.entries(line).find(([n])=>/^ppt\/charts\/chart\d+\.xml$/.test(n))[1];assert.doesNotMatch(lineXml,/<c:min val="0"/,'line retains native automatic domain');
