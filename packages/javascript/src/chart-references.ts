// Explicit chart references. Document properties alone determine values, axes, styles and placement.
import {chartAxisFraction, chartTextSize, type ChartValueAxis} from './chart-axis.js';
import {chartNumber,type ResolvedChartData} from './chart-data.js';
import {chartBarGeometry,chartBarSeriesOffset} from './chart-layer.js';
import type {ChartPlotGeometry} from './chart-plot.js';
import {CHART_REFERENCE_TYPES} from './chart-reference-types.js';

export {CHART_REFERENCE_TYPES};
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
  /** RR-105: the label could not avoid a mark at either end, so it stands on a plate of the chart's surface color. */
  labelPlate?: boolean;
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
/**
 * A chart with explicit references keeps its series names at regular weight even where the slide's texts focus a series: the focus
 * then only repaints the chart (its mark colors). A bold name is wider, so it would change the name gutter and with it the plot; this way
 * a title can never move a plot, and so never a reference line. No extra font face is measured or drawn.
 */
export const stableNameWidths=(chart:unknown):boolean=>chartReferences(chart).length>0;
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
  // RR-105: the marks a label must not sit on: each bar of a column, bar or combo chart (core's bar geometry, as both engines draw it) and
  // each point of an area as the column from the axis to its value (the outline is in `segments`).
  const marks:Box[]=[];
  const barSeries=data.columns.slice(1).flatMap((_,series)=>data.combo?(data.combo[series]?.role==='bar'?[series]:[]):['column','bar'].includes(geometry.chartType??'')?[series]:[]);
  if(barSeries.length){
    const axis=axes.value,band=(horizontal?plot.height:plot.width)/count,bar=chartBarGeometry(band,barSeries.length,'clustered');
    const at=(value:number)=>horizontal?plot.x+chartAxisFraction(value,axis)*plot.width:plot.y+chartAxisFraction(value,axis,true)*plot.height;
    const base=at(Math.min(axis.max,Math.max(axis.min,0)));
    barSeries.forEach((series,j)=>{data.rows.forEach((row,index)=>{
      const value=chartNumber(row[series+1]);if(value===null)return;
      const slot=chartBarSeriesOffset(bar,j,barSeries.length,!horizontal&&rtl),end=at(Math.min(axis.max,Math.max(axis.min,value)));
      const start=(horizontal?plot.y:plot.x)+(horizontal||!rtl?index:count-1-index)*band+bar.offset+slot;
      marks.push(horizontal?{x:Math.min(base,end),y:start,width:Math.abs(end-base),height:bar.width}:{x:start,y:Math.min(base,end),width:bar.width,height:Math.abs(end-base)});
    });});
  }
  if(!horizontal&&!data.combo&&geometry.chartType==='area'){
    const axis=axes.value,base=plot.y+chartAxisFraction(Math.min(axis.max,Math.max(axis.min,0)),axis,true)*plot.height;
    data.columns.slice(1).forEach((_,series)=>{data.rows.forEach((row,index)=>{
      const value=chartNumber(row[series+1]);if(value===null)return;
      const x=plot.x+((rtl?count-1-index:index)+.5)*plot.width/count,y=plot.y+chartAxisFraction(Math.min(axis.max,Math.max(axis.min,value)),axis,true)*plot.height;
      marks.push({x,y:Math.min(y,base),width:0.01,height:Math.abs(base-y)});
    });});
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
    const endpointOf=(end:'start'|'end')=>end==='start'?0:Math.max(0,count-1);
    const line:ChartReferenceLine={...ref,index,x1:horizontal?position:a,y1:horizontal?plot.y:position,x2:horizontal?position:b,y2:horizontal?plot.y+plot.height:position,strokeWidth:ref.stroke.width*geometry.scale,native,endpoint:endpointOf(ref.labelPosition)};
    if(ref.label!==undefined){
      const clearance=gap+line.strokeWidth/2;
      const parts=ref.label.split(/\r\n|\r|\n/u),width=Math.max(...parts.map(text=>geometry.measure(text,font)))+font*0.5,height=lineHeight*parts.length;
      // RR-105: the label's four places, in order: beside the line at the authored end (above, then below; right, then left of a bar
      // chart's line), then the same two at the other end. The first free one wins: inside the chart, off every mark, data line and earlier label.
      const place=(end:'start'|'end',other:boolean)=>{
        const startSide=(end==='start')!==rtl,endpointX=startSide?a:b,endpointY=end==='start'?plot.y:plot.y+plot.height;
        const labelX=native?endpointX-width/2:startSide?endpointX:endpointX-width;
        const first:Box=horizontal?{x:position+clearance,y:end==='start'?endpointY:endpointY-height,width,height}:{x:labelX,y:position-clearance-height,width,height};
        const spot:Box=!other?first:horizontal?{...first,x:position-clearance-width}:{...first,y:position+clearance};
        return {end,box:spot,side:(horizontal?(other?'left':'right'):(other?'below':'above')) as NonNullable<ChartReferenceLine['labelSide']>,align:(!horizontal&&!native?(startSide?'left':'right'):'center') as NonNullable<ChartReferenceLine['labelAlign']>};
      };
      const otherEnd=ref.labelPosition==='start'?'end':'start';
      const candidates=[place(ref.labelPosition,false),place(ref.labelPosition,true),place(otherEnd,false),place(otherEnd,true)];
      const onMark=(candidate:Box)=>marks.some(mark=>overlap(candidate,mark));
      const fits=(candidate:Box)=>inside(candidate,box)&&boxes.every(other=>!overlap(candidate,other))&&segments.every(segment=>!crosses(segment,candidate))&&!onMark(candidate);
      const chosen=candidates.find(candidate=>fits(candidate.box))??candidates[0]!,labelBox=chosen.box;
      line.labelBox=labelBox;line.labelSide=chosen.side;line.labelAlign=chosen.align;line.endpoint=endpointOf(chosen.end);boxes.push(labelBox);
      // A label that has to stay on a bar or an area stands on a plate of the chart's surface, so it reads against what is behind it.
      if(onMark(labelBox))line.labelPlate=true;
      if(!inside(labelBox,box))diagnostics.push({index,code:'chart-reference-label-overflow',message:'The explicit reference label extends beyond its chart; enlarge the chart or use a shorter label. Its value and text are retained.'});
      if(boxes.slice(0,-1).some(other=>overlap(labelBox,other))||segments.some(segment=>crosses(segment,labelBox))||onMark(labelBox))diagnostics.push({index,code:'chart-reference-label-collision',message:'The explicit reference label collides with another label, a data line or a mark at both ends of its line, above and below; its preferred position, text and value are retained, and it stands on a plate of the chart background.'});
    }
    lines.push(line);
  });
  return lines.length?{lines,diagnostics}:undefined;
}
