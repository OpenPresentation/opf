import assert from 'node:assert/strict';
import fs from 'node:fs';
import {strFromU8,unzipSync} from 'fflate';
import {resolveSlideContext} from '@openpresentation/opf';
import {composeSlide} from '@openpresentation/opf/composition';
import {gallery} from '@openpresentation/gallery';
import {toPptx} from '../dist/index.js';
const freight=JSON.parse(fs.readFileSync(new URL('../../../scripts/native-acceptance/qualification/decks/layout-harvest.opf.json',import.meta.url),'utf8'));
freight.slides=[freight.slides[18]];
const charts=[{values:[8,null,-3,null,5]},{values:[-3,1,-1,-3]},{values:[3,-7,6,2]},{values:[null,null]},{values:[8,-3,5],options:{dataLabels:false,axisTitles:{category:'Stage',value:'Cost'}}}];
const decks=[freight,...charts.map(({values,options})=>({slides:[{title:'Waterfall scalar control',chart:{type:'waterfall',data:{columns:['Stage','Cost'],rows:values.map((v,i)=>['Stage '+i,v])},...options}}]}))];
for(const [index,deck]of decks.entries()){
 const context=resolveSlideContext(deck,0,{catalogs:[gallery]});
 const expected=composeSlide(context.slide,context.options).items.find(item=>item.field==='chart').chart.layer.numericAxes.value;
 const zip=unzipSync(new Uint8Array(await toPptx(deck,{catalogs:[gallery]})));
 const xml=Object.entries(zip).filter(([p])=>/^ppt\/charts\/chartEx\d+\.xml$/.test(p)).map(([,b])=>strFromU8(b)).find(xml=>xml.includes('layoutId="waterfall"'));
 const axis=xml.match(/<cx:axis id="1"([^>]*)>([\s\S]*?)<\/cx:axis>/);
 const scaling=axis[2].match(/^<cx:valScaling max="([^"]+)" min="([^"]+)" majorUnit="([^"]+)"\/>/);
 assert.ok(scaling,'waterfall '+index+' explicitly scales even a hidden axis');
 assert.deepEqual({min:Number(scaling[2]),max:Number(scaling[1]),majorUnit:Number(scaling[3])},expected);
 if(index===0){assert.match(axis[1],/hidden="1"/);assert.deepEqual(expected,{min:0,max:10000000,majorUnit:2000000});}
 if(index===decks.length-1)assert.ok(!axis[1].includes('hidden="1"'),'a titled value axis stays visible');
}
console.log('RR-105: native waterfall scales equal the shared running-total plan, hidden or visible.');
