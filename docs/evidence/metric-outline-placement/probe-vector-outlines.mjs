import {writeFile} from 'node:fs/promises';
import {layoutMetric} from '../../../packages/javascript/dist/composition.js';
import {prepareNodeFonts} from '../../../../opf-render/dist/fonts-node.js';
const {options}=await prepareNodeFonts({pack:'office'}),records=[];
function observe(metric,cell,config){
  const layout=layoutMetric(metric,cell,config),bounds=[];
  for(const part of layout.parts)if(part.visible&&part.fit)for(const [index,line]of part.fit.sourceLines.entries())for(const segment of line.segments)if(segment.kind==='text'){
    const text=part.text.slice(segment.start,segment.end),local=config.textMeasurement.outlineBounds(text,part.fit.fontSize,part.style);if(!local)continue;
    const position=part.linePositions[index],ink={x:position.x+segment.x+local.x,y:position.baseline+local.y,width:local.width,height:local.height};
    if(ink.x<cell.x||ink.y<cell.y||ink.x+ink.width>cell.x+cell.width||ink.y+ink.height>cell.y+cell.height)bounds.push({role:part.role,text,ink});
  }
  records.push({family:config.fonts.body,alignment:config.align,metric,cell,accepted:!layout.overflow,outlineOutliers:bounds});
}
for(const family of ['Roboto','Carlito'])for(const align of ['left','center','right'])for(const width of [453.6,1164.8])for(const metric of [
  {value:123,unit:'ms',label:'Latency'},
  {value:'42\n123',label:'First\nSecond'},
  {value:'\t1\t%',unit:'ms',label:'\tBefore\tAfter  '},
])observe(metric,{x:43.2,y:43.2,width,height:873.6},{fonts:{heading:family,body:family},align,textMeasurement:options.textMeasurement});
for(const align of ['left','right'])observe({value:'f',label:'Tall label'},{x:10,y:10,width:250,height:180},{fonts:{heading:'adversarial-outline-control',body:'adversarial-outline-control'},align,textMeasurement:{measure:(text,size)=>text.length*size*.5,outlineBounds:(text,size)=>text.trim()?{x:-3,y:-size*1.15,width:text.length*size*.5+6,height:size*1.6}:null}});
await writeFile(process.argv[2]??'artifacts/metric-outline-vector-probe.json',JSON.stringify({node:process.version,records,scope:'Measured vector outlines only, including adversarial provider controls; no native paint or raster equivalence claim.'},null,2)+'\n');
console.log(JSON.stringify({cases:records.length,acceptedWithOutsideInk:records.filter(r=>r.accepted&&r.outlineOutliers.length).map(r=>({family:r.family,alignment:r.alignment,width:r.cell.width,outliers:r.outlineOutliers}))},null,2));
