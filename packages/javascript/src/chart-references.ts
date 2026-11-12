// Explicit chart references. Document properties alone determine values, axes, styles and placement.
import {chartAxisFraction, chartTextSize, type ChartValueAxis} from './chart-axis.js';
import {chartNumber,type ResolvedChartData} from './chart-data.js';
import type {ChartPlotGeometry} from './chart-plot.js';

export const CHART_REFERENCE_TYPES: ReadonlySet<string> = new Set(['column','bar','line','line-with-markers','area','combo']);
export interface ChartReference {
  value: number;
  axis: 'value' | 'secondary';
  label?: string;
  labelPosition: 'start' | 'end';
  stroke: {color?: unknown; width: number; dash: 'solid' | 'dash' | 'dot'};
  /** Original authored stroke, retained only while native paint is unchanged. */
  authoredStroke?: unknown;
}
interface Box {x: number; y: number; width: number; height: number}
export interface ChartReferenceLine extends ChartReference {
  index: number;
  x1: number; y1: number; x2: number; y2: number;
  /** Slide pixels, without changing the authored reference-pixel width. */
  strokeWidth: number;
  native: boolean;
  endpoint: number;
  labelBox?: Box;
  labelSide?: 'above' | 'below' | 'left' | 'right';
  labelAlign?: 'left' | 'right' | 'center';
}
export interface ChartReferenceDiagnostic {index: number; code: 'chart-reference-label-overflow' | 'chart-reference-label-collision'; message: string}
export interface ChartLayerReferences {lines: ChartReferenceLine[]; diagnostics: ChartReferenceDiagnostic[]}
const record=(v: unknown): v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
/** Read only explicit properties; never parse text, suppress duplicates or impose a line cap. */
export function chartReferences(chart: unknown): ChartReference[] {
  if(!record(chart)||typeof chart.type!=='string'||!CHART_REFERENCE_TYPES.has(chart.type)||!Array.isArray(chart.referenceLines))return [];
  return chart.referenceLines.flatMap((entry):ChartReference[]=>{
    if(!record(entry)||typeof entry.value!=='number'||!Number.isFinite(entry.value))return [];
    const stroke=entry.stroke==='none'?{width:0}:record(entry.stroke)?entry.stroke:{};
    return [{value:entry.value,axis:entry.axis==='secondary'?'secondary':'value',...(typeof entry.label==='string'&&entry.label.trim()?{label:entry.label}:{}),labelPosition:entry.labelPosition==='start'?'start':'end',stroke:{...(stroke.color!==undefined?{color:stroke.color}:{}),width:typeof stroke.width==='number'&&Number.isFinite(stroke.width)?stroke.width:4/3,dash:stroke.dash==='solid'||stroke.dash==='dot'?stroke.dash:'dash'},...(entry.stroke!==undefined?{authoredStroke:entry.stroke}:{})}];
  });
}
/** The authored position (`referenceLines.<n>`) of each reference chartReferences keeps, in its order: an entry without a finite value is skipped. */
export function chartReferenceSources(chart: unknown): number[] {
  if(!record(chart)||typeof chart.type!=='string'||!CHART_REFERENCE_TYPES.has(chart.type)||!Array.isArray(chart.referenceLines))return [];
  return chart.referenceLines.flatMap((entry,index)=>record(entry)&&typeof entry.value==='number'&&Number.isFinite(entry.value)?[index]:[]);
}
const overlap=(a:Box,b:Box)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const inside=(a:Box,b:Box)=>a.x>=b.x-0.01&&a.y>=b.y-0.01&&a.x+a.width<=b.x+b.width+0.01&&a.y+a.height<=b.y+b.height+0.01;
/** The same category-center span for SVG and native helpers; bars and singleton categories use full-plot overlays. */
export function placeReferences(refs:readonly ChartReference[],data:ResolvedChartData,axes:{value:ChartValueAxis;secondary?:ChartValueAxis},box:Box,inset:{left:number;top:number;right:number;bottom:number},geometry:Omit<ChartPlotGeometry,'box'>&{horizontal?:boolean;chartType?:string}):ChartLayerReferences|undefined {
  if(!data.ok||!refs.length)return undefined;
  const plot={x:box.x+inset.left,y:box.y+inset.top,width:box.width-inset.left-inset.right,height:box.height-inset.top-inset.bottom};
  if(!(plot.width>1&&plot.height>1))return undefined;
  const horizontal=geometry.horizontal===true,rtl=geometry.direction==='rtl',count=data.rows.length,native=!horizontal&&count>=2;
  const font=chartTextSize({...box,scale:geometry.scale,minFontSize:geometry.minFontSize})*geometry.scale,lineHeight=font*1.5,gap=font*0.1;
  // A label can use either adjacent side. Test actual ordinary line/marker ink as well as earlier labels.
  const segments:{x1:number;y1:number;x2:number;y2:number;pad:number}[]=[];
  if(!horizontal&&(data.combo||geometry.chartType===undefined||['line','line-with-markers','area'].includes(geometry.chartType))){
    data.columns.slice(1).forEach((_,series)=>{
      const role=data.combo?.[series];if(role&&role.role!=='line')return;
      const axis=role?.axis==='secondary'?axes.secondary:axes.value;if(!axis)return;
      let previous:{x:number;y:number}|undefined;
      data.rows.forEach((row,index)=>{
        const value=chartNumber(row[series+1]);if(value===null){previous=undefined;return;}
        const point={x:plot.x+((rtl?count-1-index:index)+.5)*plot.width/count,y:plot.y+chartAxisFraction(value,axis,true)*plot.height};
        if(previous)segments.push({x1:previous.x,y1:previous.y,x2:point.x,y2:point.y,pad:4/3*geometry.scale});
        if(role||geometry.chartType==='line-with-markers')segments.push({x1:point.x,y1:point.y,x2:point.x,y2:point.y,pad:4*geometry.scale});
        previous=point;
      });
    });
  }
  const crosses=(segment:typeof segments[number],label:Box):boolean=>{
    const dx=segment.x2-segment.x1,dy=segment.y2-segment.y1,pad=segment.pad;
    let from=0,to=1;
    const bounds:[number,number][]=[[-dx,segment.x1-label.x+pad],[dx,label.x+label.width-segment.x1+pad],[-dy,segment.y1-label.y+pad],[dy,label.y+label.height-segment.y1+pad]];
    for(const [p,q]of bounds){
      if(p===0){if(q<0)return false;continue;}
      const t=q/p;
      if(p<0)from=Math.max(from,t);else to=Math.min(to,t);
      if(from>to)return false;
    }
    return true;
  };
  const boxes:Box[]=[],diagnostics:ChartReferenceDiagnostic[]=[],lines:ChartReferenceLine[]=[];
  refs.forEach((ref,index)=>{
    const axis=ref.axis==='secondary'?axes.secondary:axes.value;
    if(!axis||!(axis.max>axis.min))return;
    const f=chartAxisFraction(ref.value,axis,!horizontal),position=horizontal?plot.x+f*plot.width:plot.y+f*plot.height;
    const a=native?plot.x+plot.width/(2*count):plot.x,b=native?plot.x+plot.width*(1-1/(2*count)):plot.x+plot.width;
    const endpoint=ref.labelPosition==='start'?0:Math.max(0,count-1);
    const line:ChartReferenceLine={...ref,index,x1:horizontal?position:a,y1:horizontal?plot.y:position,x2:horizontal?position:b,y2:horizontal?plot.y+plot.height:position,strokeWidth:ref.stroke.width*geometry.scale,native,endpoint};
    if(ref.label!==undefined){
      const clearance=gap+line.strokeWidth/2;
      const parts=ref.label.split(/\r\n|\r|\n/u),width=Math.max(...parts.map(text=>geometry.measure(text,font)))+font*0.5,height=lineHeight*parts.length;
      const endpointX=(ref.labelPosition==='start')!==rtl?a:b,endpointY=ref.labelPosition==='start'?plot.y:plot.y+plot.height;
      const startSide=(ref.labelPosition==='start')!==rtl;
      const labelX=native?endpointX-width/2:startSide?endpointX:endpointX-width;
      const preferred:Box=horizontal?{x:position+clearance,y:ref.labelPosition==='start'?endpointY:endpointY-height,width,height}:{x:labelX,y:position-clearance-height,width,height};
      const alternate:Box=horizontal?{...preferred,x:position-clearance-width}:{...preferred,y:position+clearance};
      const fits=(candidate:Box)=>inside(candidate,box)&&boxes.every(other=>!overlap(candidate,other))&&segments.every(segment=>!crosses(segment,candidate));
      const alternative=!fits(preferred)&&fits(alternate),labelBox=alternative?alternate:preferred;
      line.labelBox=labelBox;line.labelSide=horizontal?(alternative?'left':'right'):(alternative?'below':'above');line.labelAlign=!horizontal&&!native?(startSide?'left':'right'):'center';boxes.push(labelBox);
      if(!inside(labelBox,box))diagnostics.push({index,code:'chart-reference-label-overflow',message:'The explicit reference label extends beyond its chart; enlarge the chart or use a shorter label. Its value and text are retained.'});
      if(boxes.slice(0,-1).some(other=>overlap(labelBox,other))||segments.some(segment=>crosses(segment,labelBox)))diagnostics.push({index,code:'chart-reference-label-collision',message:'The explicit reference label collides with another label or a data line after both adjacent placements; its preferred position, text and value are retained.'});
    }
    lines.push(line);
  });
  return lines.length?{lines,diagnostics}:undefined;
}
