import assert from 'node:assert/strict';
import {chartHeader,resolveChartData} from '../dist/composition.js';
const measure=(text,size)=>text.length*size*.55;
let checks=0;
for(const width of [280,640])for(const names of [['Current','Expansion'],['Current','Expansion','Forecast','Target']]){
 const data={columns:['Stage',...names],rows:[['Lead',...names.map((_,i)=>i+1)]]},chart={type:'column',axisTitles:{value:'Requests'},data},geometry={box:{x:75,y:90,width,height:380},scale:1,measure},ltr=chartHeader(chart,resolveChartData(chart),geometry),rtl=chartHeader(chart,resolveChartData(chart),{...geometry,direction:'rtl'});
 assert.ok(ltr.legend&&rtl.legend,'both directions retain the full header legend');
 assert.equal(rtl.legend.box.x,geometry.box.x+geometry.box.width-(ltr.legend.box.x-geometry.box.x)-ltr.legend.box.width,'overall legend box mirrors');
 assert.equal(rtl.caption.box.x,geometry.box.x+geometry.box.width-(ltr.caption.box.x-geometry.box.x)-ltr.caption.box.width,'caption remains RTL');
 assert.deepEqual(rtl.legend.entries.map(e=>e.name),names,'authored series identity/order stays complete');
 for(let i=0;i<names.length;i++){
  const a=ltr.legend.entries[i],b=rtl.legend.entries[i];
  assert.ok(Math.abs((b.box.x-rtl.legend.box.x)-(a.box.x-ltr.legend.box.x))<1e-6,'native legend retains physical source-order offsets inside mirrored box');
  assert.deepEqual({...b.box,x:0},{...a.box,x:0},'same size and row: no text shrinking or new wrap');
 }
 checks++;
}
console.log(`LH-93 RTL header legends: ${checks} source-order/translation/wrapped/size controls pass.`);
