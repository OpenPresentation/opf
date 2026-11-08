// RR-105: numeric chart axes shared by composition, preview and native PPTX.
import {CHART_MAX_INTERVALS, chartIntervalsFor, chartTextSize, niceScale, waterfallSteps, type ChartValueAxis} from './chart-axis.js';
import {chartNumber, type ResolvedChartData} from './chart-data.js';
import {chartOptionTarget, resolveChartOptions} from './chart-options.js';
import {groupsDataRange} from './number-grouping.js';
import {valueLabel, type ChartLayer, type ChartLayerGeometry} from './chart-layer.js';

export interface ChartNumericAxes {
  value: ChartValueAxis;
  /** A scatter chart's horizontal numeric axis (PowerPoint calls it the category axis). */
  category?: ChartValueAxis;
}
const axis = (values: number[], length: number, label: number, scale: number): ChartValueAxis => {
  const fitted = niceScale(values.length ? Math.min(...values) : 0, values.length ? Math.max(...values) : 1, chartIntervalsFor(Math.max(1, length), label, scale));
  return {min: fitted.min, max: fitted.max, majorUnit: fitted.step};
};
const finiteAxis = (value: ChartValueAxis): boolean => [value.min, value.max, value.majorUnit, value.max - value.min].every(Number.isFinite) && value.majorUnit > 0 && value.max > value.min;
const ticks = (value: ChartValueAxis): number[] => Array.from({length: Math.floor((value.max - value.min) / value.majorUnit + 1e-9) + 1}, (_, n) => Number((value.min + n * value.majorUnit).toPrecision(12)));

/** The same chart-text size, padding, legend and axis-title bands the preview reserves. */
export function chartNumericAxes(chart: unknown, data: ResolvedChartData, geometry: ChartLayerGeometry, layer?: ChartLayer): ChartNumericAxes | undefined {
  if (!chart || typeof chart !== 'object' || !data.ok || data.combo) return undefined;
  const target = chartOptionTarget((chart as {type?: unknown}).type);
  if (target?.kind === 'waterfall') return waterfallAxis(chart, data, geometry, layer);
  if (target?.kind !== 'scatter' && target?.kind !== 'box') return undefined;
  const {box, scale, language} = geometry;
  const fontPx = chartTextSize({width: box.width, height: box.height, scale, minFontSize: geometry.minFontSize}) * scale;
  const pad = 10 * scale, lineHeight = fontPx * 1.5;
  const measure = (text: string) => geometry.measure(text, fontPx, 400);
  const options = resolveChartOptions(chart, target);
  const first = target.kind === 'scatter' ? data.hasX ? 2 : 1 : data.columns.length > 1 ? 1 : 0;
  const names = data.columns.slice(first).map(String);
  const widthOfLegend = () => Math.min(box.width * .45, fontPx * 1.5 + Math.max(0, ...names.map(measure))) + pad;
  let width = box.width, height = box.height, sideLegend = 0;
  if (options.legend === 'left' || options.legend === 'right') width -= widthOfLegend();
  else if (options.legend === 'top' || options.legend === 'bottom') height -= lineHeight + pad;
  else if (options.legend === undefined && names.length > 1) sideLegend = widthOfLegend();
  if (options.axisTitles.category) height -= lineHeight;
  if (options.axisTitles.value) width -= lineHeight;
  const yValues: number[] = [], xValues: number[] = [];
  data.rows.forEach((row, index) => {
    const x = data.hasX ? chartNumber(row[1]) : index + 1;
    for (let column = first; column < data.columns.length; column++) {
      const y = chartNumber(row[column]);
      if (y === null || (target.kind === 'scatter' && x === null)) continue;
      yValues.push(y);
      if (target.kind === 'scatter') xValues.push(x as number);
    }
  });
  const length = Math.max(1, height - 2 * pad - 1.5 * lineHeight);
  const value = axis(yValues, length, lineHeight * 1.2, scale);
  if (!finiteAxis(value)) return undefined;
  if (target.kind === 'box') return {value};
  const yFormat = data.formats[first], xFormat = data.hasX ? data.formats[1] : undefined;
  const yGroup = yFormat === undefined && groupsDataRange(yValues, {zeroBased: false});
  const xGroup = xFormat === undefined && data.hasX && groupsDataRange(xValues, {zeroBased: false, minRange: 1000});
  const label = (number: number, format: string | undefined, group: boolean) => valueLabel(number, format, group ? {language} : undefined);
  const tickWidth = Math.max(...ticks(value).map(tick => measure(label(tick, yFormat, yGroup)))) + fontPx * .5;
  const minX = xValues.length ? Math.min(...xValues) : 0, maxX = xValues.length ? Math.max(...xValues) : 1;
  const xLabel = Math.max(measure(label(minX, xFormat, xGroup)), measure(label(maxX, xFormat, xGroup))) + fontPx;
  let x = pad + tickWidth, plotWidth = Math.max(1, width - pad - sideLegend - fontPx - x);
  let category = axis(xValues, plotWidth, xLabel, scale);
  if (!finiteAxis(category)) return undefined;
  // Formatted end tick labels stay inside the chart, including long currency codes.
  if (xFormat !== undefined) for (let pass = 0; pass < 3; pass++) {
    const end = ticks(category), left = measure(label(end[0]!, xFormat, false)) / 2, right = measure(label(end.at(-1)!, xFormat, false)) / 2;
    const nextX = Math.max(x, pad + left), nextWidth = Math.max(1, Math.min(x + plotWidth, width - pad - right) - nextX);
    if (nextX === x && nextWidth === plotWidth) break;
    x = nextX; plotWidth = nextWidth; category = axis(xValues, plotWidth, xLabel, scale);
    if (!finiteAxis(category)) return undefined;
  }
  return {value, category};
}

// Waterfall category labels reserve the same one/two-line or rotated band as the preview.
// Only the reserve is needed here; the preview keeps its existing text drawing and source paths.
function waterfallLabelReserve(names: string[], widthOf: (text: string) => number, plot: {x: number; width: number}, font: number, scale: number, maximum: number): {n: number; reserve: number} {
  const line=font*1.5, textHeight=font*1.22, gap=font*.1, band=plot.width/Math.max(1,names.length);
  const minX=plot.x-font*.5, maxX=plot.x+plot.width+font*.5, rotatedMinX=10*scale;
  const limit=Math.max(1,maxX-minX), allowTwo=maximum>=line+textHeight-.01;
  const labels=names.map(text=>({text:text.replace(/[\r\n]+/g,' '),width:widthOf(text.replace(/[\r\n]+/g,' '))}));
  if(!labels.length)return {n:1,reserve:line};
  const ellipsis=(text:string)=>{const chars=Array.from(text);let low=0,high=chars.length;while(low<high){const mid=Math.ceil((low+high)/2);if(widthOf(chars.slice(0,mid).join('').trimEnd()+'…')<=limit)low=mid;else high=mid-1;}return widthOf(chars.slice(0,low).join('').trimEnd()+'…');};
  const two=(text:string)=>{const words=text.split(/[^\S  ﻿]+/u).filter(Boolean);let best=Infinity;for(let split=1;split<words.length;split++)best=Math.min(best,Math.max(widthOf(words.slice(0,split).join(' ')),widthOf(words.slice(split).join(' '))));return best;};
  const horizontal=(n:number)=>{let prev=-Infinity,rows=1;const slot=n*band-gap;for(let i=0;i<labels.length;i+=n){let width=labels[i]!.width,lines=1;if(width>slot&&allowTwo){const split=two(labels[i]!.text);if(split<=slot){width=split;lines=2;}}if(width>limit){width=ellipsis(labels[i]!.text);lines=1;}const cx=plot.x+(i+.5)*band,left=Math.min(Math.max(cx-width/2,minX),maxX-width);if(left<prev+gap-1e-6)return undefined;prev=left+width;rows=Math.max(rows,lines);}return {n,reserve:line+(rows-1)*textHeight};};
  let plain: {n:number;reserve:number}|undefined;
  for(let n=1;n<=labels.length&&!plain;n++)plain=horizontal(n);
  plain??={n:labels.length,reserve:line};
  const rotated=(angle:number)=>{const sin=angle===90?1:Math.SQRT1_2,cos=angle===90?0:Math.SQRT1_2,n=Math.max(1,Math.ceil(textHeight/sin/band-1e-9));let extent=0;for(let i=0;i<labels.length;i+=n){const width=labels[i]!.width,cx=plot.x+(i+.5)*band;if(cx-width*cos-textHeight*sin/2<rotatedMinX-1e-6)return undefined;extent=Math.max(extent,width*sin+textHeight*cos);}const reserve=Math.max(line,font*.25+extent);return reserve>maximum+1e-6?undefined:{n,reserve};};
  const options=[plain,rotated(45),rotated(90)].filter((value):value is {n:number;reserve:number}=>value!==undefined);
  return options.find(option=>option.n===1)??options.reduce((best,option)=>option.n<best.n?option:best);
}
function waterfallAxis(chart: unknown, data: ResolvedChartData, geometry: ChartLayerGeometry, layer?: ChartLayer): ChartNumericAxes | undefined {
  if(!data.ok)return undefined;
  const {box,scale,language}=geometry;
  if(![box.width,box.height,scale].every(Number.isFinite)||box.width<=0||box.height<=0||scale<=0)return undefined;
  const target=chartOptionTarget('waterfall')!,options=resolveChartOptions(chart,target);
  const font=chartTextSize({width:box.width,height:box.height,scale,minFontSize:geometry.minFontSize})*scale,line=font*1.5,pad=10*scale;
  const column=data.columns.length>1?1:0,values=data.rows.map(row=>chartNumber(row[column]));
  let extents: number[];
  try{extents=waterfallSteps(values).flatMap(step=>[step.from,step.to]);}catch{return undefined;}
  const min=extents.length?Math.min(0,...extents):0,max=extents.length?Math.max(0,...extents):1;
  const hidden=layer?.waterfall?.valueAxis===false;
  const width=Math.max(1,box.width-(options.axisTitles.value?line:0)),height=Math.max(1,box.height-(layer?.header?.height??0)-(options.axisTitles.category?line:0));
  const measure=(text:string)=>geometry.measure(text,font,400),format=data.formats[column];
  const group=format===undefined&&groupsDataRange(extents,{zeroBased:true});
  const probes=hidden?[]:[...new Set(Array.from({length:CHART_MAX_INTERVALS},(_,i)=>niceScale(min,max,i+1).ticks).flat())];
  const tickWidth=Math.max(0,...probes.map(tick=>measure(valueLabel(tick,format,group?{language}:undefined))))+font*.5;
  const x=pad+tickWidth,right=width-pad-font/2,plot={x,width:Math.max(1,right-x)};
  const names=data.rows.map((row,i)=>data.columns.length>1?row[0]===null||row[0]===undefined?'':String(row[0]):String(i+1));
  const cap=Math.max(line+font*1.22,height*.4);
  let reserve=line,plan=waterfallLabelReserve(names,measure,plot,font,scale,cap);
  for(let pass=0;pass<3&&plan.reserve>reserve+.5;pass++){reserve=plan.reserve;plan=waterfallLabelReserve(names,measure,plot,font,scale,cap);}
  if(plan.reserve>reserve+.5)plan=waterfallLabelReserve(names,measure,plot,font,scale,reserve);
  const length=Math.max(1,height-2*pad-(hidden?line:line/2)-reserve);
  const fitted=niceScale(min,max,chartIntervalsFor(length,line*1.2,scale));
  const value={min:fitted.min,max:fitted.max,majorUnit:fitted.step};
  return finiteAxis(value)?{value}:undefined;
}
