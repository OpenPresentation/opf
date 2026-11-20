import assert from 'node:assert/strict';
import test from 'node:test';
import {composeSlide} from '../dist/composition.js';
const input=(type)=>({blocks:[{id:'chart',chart:{type,data:{columns:['Stage','First','Second','Third'],rows:[['A',20,30,15],['B',12,22,18],['C',10,25,14]]}}}],shapes:[0,1,2].flatMap(series=>[0,2].map(point=>({shape:'ellipse',fill:'none',at:{block:'chart',point,series,edge:'center',width:24,height:24}})))});
const point=(result,series,row)=>result.overlayShapes.find(shape=>shape.attachedTo.chartPoint.series===series&&shape.attachedTo.chartPoint.row===row).attachedTo.chartPoint;
for(const direction of ['ltr','rtl'])for(const factor of [.75,1,1.5])test('clustered columns keep native series order with '+direction+' categories at '+factor,()=>{
 const result=composeSlide(input('column'),{width:1280*factor,height:720*factor,direction}),a=point(result,0,0),b=point(result,1,0),c=point(result,2,0),last=point(result,0,2);
 assert.ok(direction==='rtl'?a.position.x>b.position.x&&b.position.x>c.position.x:a.position.x<b.position.x&&b.position.x<c.position.x,'series offsets must follow the native reversed category axis');
 assert.ok(direction==='rtl'?a.position.x>last.position.x:a.position.x<last.position.x,'category reversal remains intact');
 assert.ok(Math.abs(Math.abs(a.position.x-b.position.x)-a.box.width)<1e-6,'one source series step is exactly one native bar width');
 assert.deepEqual([a.series,b.series,c.series],[0,1,2]);assert.deepEqual([a.column,b.column,c.column],[1,2,3]);
});
for(const type of ['stacked-column','100pct-stacked-column','bar','stacked-bar','100pct-stacked-bar'])test(type+' preserves its physical series positions in RTL',()=>{
 const result=composeSlide(input(type),{width:1280,height:720,direction:'rtl'}),a=point(result,0,0),b=point(result,1,0);
 if(type==='bar')assert.ok(a.position.y<b.position.y,'horizontal bar series stay top to bottom');
 else if(type.includes('column'))assert.equal(a.position.x,b.position.x,'stacked columns share one category center');
 else assert.equal(a.position.y,b.position.y,'stacked bars share one category center');
});
