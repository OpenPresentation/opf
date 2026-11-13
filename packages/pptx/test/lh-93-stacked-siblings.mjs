// LH-93: native stacked horizontal siblings serialize the final shared plot and freshly fitted values/names.
import assert from 'node:assert/strict';
import {unzipSync, strFromU8} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
const chart=(key,small=30,names=['Current','Expansion'],type='stacked-bar')=>({chart:{type,data:{columns:['Stage',...names],rows:[[key,small,100-small],['Won',small,100-small]]}}});
const scenarios=[
  ['named',chart('Lead',50),chart('Partner sourced accounts with review',50)],
  ['legend',chart('Lead',30,['AAAA','BBBB']),chart('Partner sourced accounts with review',30,['AAAA','BBBB'])],
  ['axis',chart('Lead',5,['X','Y']),chart('Partner sourced accounts with review',5,['X','Y'])],
  ['percent',chart('Lead',50,undefined,'100pct-stacked-bar'),chart('Partner sourced accounts with review',50,undefined,'100pct-stacked-bar')]
];
const deck={slides:scenarios.map(([name,a,b])=>({title:'Pipeline by stage',blocks:[a,b]}))},bytes=await toPptx(deck),parts=unzipSync(bytes),back=await fromPptx(bytes);
for(const[index,[name]]of scenarios.entries()){
 const slide=strFromU8(parts['ppt/slides/slide'+(index+1)+'.xml']);
 const frames=[...slide.matchAll(/<p:graphicFrame>[\s\S]*?<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>[\s\S]*?<c:chart r:id="(rId\d+)"/g)].map(m=>({x:+m[1],y:+m[2],w:+m[3],h:+m[4]}));
 assert.equal(frames.length,2);
 const plots=frames.map((frame,j)=>{
  const xml=strFromU8(parts['ppt/charts/chart'+(index*2+j+1)+'.xml']);
  const layout=/<c:plotArea><c:layout><c:manualLayout><c:layoutTarget val="inner"\/><c:xMode val="edge"\/><c:yMode val="edge"\/><c:x val="([\d.]+)"\/><c:y val="([\d.]+)"\/><c:w val="([\d.]+)"\/><c:h val="([\d.]+)"\/>/.exec(xml);
  assert.ok(layout,name+': explicit native inner plot');
  if(name==='axis'){
   assert.match(xml,/<c:valAx>(?:(?!<\/c:valAx>)[\s\S])*<c:delete val="0"\/>/, 'numeric axis restored');
   assert.match(xml,/<c:dLbl><c:idx val="0"\/><c:delete val="1"\/><\/c:dLbl>/,'small segment label no longer overlaps');
   assert.ok(xml.includes('<c:v>5</c:v>') && xml.includes('<c:v>95</c:v>'),'all numeric values retained');
  }
  return{w:Number(layout[3])*frame.w,h:Number(layout[4])*frame.h,y:frame.y+Number(layout[2])*frame.h};
 });
 for(const key of ['w','h','y'])assert.ok(Math.abs(plots[0][key]-plots[1][key])<9525*1.5,name+': common '+key+' after four-decimal native layout fractions');
 if(name==='named')assert.match(slide,/stack-name/,'series names stay direct');
 if(name==='legend')assert.ok(!/stack-name/.test(slide),'contracted series use their original legend');
 const imported=back.slides[index].blocks.filter(block=>block.chart);
 for(const[j,block]of imported.entries())assert.deepEqual(block.chart.data.rows,deck.slides[index].blocks[j].chart.data.rows,'current chart values survive import');
}
console.log('LH-93 native: shared stacked/percent plots, refitted names, restored legends/axes, deleted crowded labels and current data import pass.');
