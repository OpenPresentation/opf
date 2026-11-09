import {chartValueAxis,chartComboAxes,chartReferences,placeReferences,resolveChartData,composeSlide} from 'file:///C:/opf-work/chart-ref-impl/packages/javascript/dist/composition.js';
const max=Number.MAX_VALUE,geometry={width:900,height:500,scale:1},box={x:100,y:50,width:900,height:500},inset={left:80,top:50,right:40,bottom:60};
const results=[];
for(const type of ['column','bar','line','area','combo'])for(const [name,values]of [['max',[max]],['min',[-max]],['both',[-max,max]]]){
 const c={type,data:{columns:['Q','Actual',...(type==='combo'?['Rate']:[])],rows:[['Q1',1,...(type==='combo'?[.2]:[])],['Q2',2,...(type==='combo'?[.3]:[])]]},...(type==='combo'?{line:['Rate'],secondaryAxis:['Rate']}:{}),referenceLines:values.map(value=>({value,label:'Target'}))};
 const data=resolveChartData(c),axis=chartValueAxis(c,data,geometry),secondary=chartComboAxes(c,data,geometry)?.secondary;
 let placement,error;
 try{placement=axis?placeReferences(chartReferences(c),data,{value:axis,secondary},box,inset,{scale:1,measure:(t,s)=>t.length*s*.5,horizontal:type==='bar',chartType:type}):undefined;}catch(e){error=e.message;}
 const numeric=[...Object.values(axis??{}),...Object.values(secondary??{}),...(placement?.lines??[]).flatMap(l=>[l.x1,l.y1,l.x2,l.y2,l.strokeWidth,...Object.values(l.labelBox??{})])];
 results.push({type,name,axis,secondary,lines:placement?.lines.length??0,allFinite:numeric.every(n=>typeof n!=='number'||Number.isFinite(n)),error});
}
for(const values of [[max],[-max],[-max,max]]){let item,error;try{item=composeSlide({chart:{type:'line',data:{columns:['Q','Actual'],rows:[['Q1',1],['Q2',2]]},referenceLines:values.map(value=>({value,label:'Target'}))}},{width:1280,height:720}).items.find(i=>i.field==='chart');}catch(e){error=e.message;}results.push({compose:true,values,axis:item?.chart?.valueAxis,lines:item?.chart?.layer?.references?.lines.length??0,error});}
console.log(JSON.stringify(results,(_k,v)=>typeof v==='number'&&!Number.isFinite(v)?String(v):v,2));
