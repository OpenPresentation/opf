import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {toPptx,fromPptx} from '../dist/index.js';
import {toSvg} from '@openpresentation/opf-render';
const data={columns:['Stage','Current','Expansion'],rows:[['Lead',-20,64],['Won',null,30]]};
for(const language of [{bcp47:'en-US',direction:'rtl'},{bcp47:'he-IL'}]){
 const deck={language,design:{fontScheme:{major:'Arial',minor:'Arial'}},slides:[{title:'Requests by stage',chart:{type:'stacked-bar',data}}]};
 const svg=toSvg(deck,1,{trace:true});
 const labels=[...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].filter(m=>/data-opf-path="slides\.0\.chart\.data\.columns\.[12]"/.test(m[1]));
 assert.equal(labels.length,2,'both legend names are actual traced text');
 const x=(name)=>{const m=labels.find(m=>m[2].includes(name));assert.ok(m,name+' retained');return Number(/\bx="([^"]+)"/.exec(m[1])[1]);};
 assert.ok(x('Current')<x('Expansion'),'physical preview order agrees with native authored series order inside RTL legend box');
 const bytes=await toPptx(deck),parts=unzipSync(bytes),xml=strFromU8(parts['ppt/charts/chart1.xml']);
 const names=[...xml.matchAll(/<c:ser>[\s\S]*?<c:tx>[\s\S]*?<c:v>([^<]+)<\/c:v>[\s\S]*?<\/c:ser>/g)].map(m=>m[1]);
 assert.deepEqual(names,['Current','Expansion'],'native series/data order is unchanged');
 assert.deepEqual((await fromPptx(bytes)).slides[0].chart,{type:'stacked-bar',data},'complete negative/missing values and series names import exactly');
 assert.match(xml,/<c:tickLblPos val="low"\/>/,'accepted negative category gutter is unchanged');
}
console.log('LH-93 RTL legend export: traced physical source order, native data/series order, negative gutter and saved semantic import pass.');
