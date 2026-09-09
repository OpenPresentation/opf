import {tableGrid,type TableCellStyle} from './table.js';
export {tableGrid,tableRowBoundaries,type TableCellStyle,type TableBorder,type TableGrid,type TableGridCell,type TableGridIssue} from './table.js';
/** Portable layout geometry. No fonts, DOM, renderer, or network dependencies. */
export interface Composition {
  mode?: "auto" | "grid" | "row" | "column";
  columns?: number;
  gap?: number;
  padding?: number;
  weights?: number[];
  minFontSize?: number;
  overflow?: "warn" | "error";
}
export const MAX_COMPOSITION_DEPTH = 32;
export interface LayoutBox { x: number; y: number; width: number; height: number }
export interface LayoutDiagnostic {
  code: "text-overflow" | "small-cell";
  path: string;
  message: string;
}
export interface TextStyle { fontFamily: string; fontWeight: number; italic?: boolean; path?: string }
export interface FontFamilies { heading: string; body: string; code: string }
export function resolveFontFamilies(input: unknown): FontFamilies {
  const scheme = record(input);
  const family = (value: unknown) => typeof value === "string" ? value : record(value).family;
  return {
    heading: family(scheme.heading) ?? scheme.major ?? scheme.minor ?? "Roboto",
    body: family(scheme.body) ?? scheme.minor ?? scheme.major ?? "Roboto",
    code: family(scheme.code) ?? "Roboto Mono",
  };
}
export interface TextMeasurement {
  measure: (text: string, fontSize: number, style: TextStyle) => number;
  resolveStyle?: (style: TextStyle) => TextStyle;
}
export type MeasureTextWidth = (text: string, fontSize: number) => number;
export function resolveTextStyle(style: TextStyle, measurement?: TextMeasurement): TextStyle {
  return measurement?.resolveStyle ? measurement.resolveStyle(style) : style;
}
export function textWidthMeasurer(style: TextStyle, measurement?: TextMeasurement): MeasureTextWidth {
  if (!measurement) return measureText;
  return (text, size) => {
    const width = measurement.measure(text, size, style);
    if (!Number.isFinite(width) || width < 0) throw new RangeError('Text measurement must return a finite, nonnegative width.');
    return width;
  };
}
export interface TextFit { lines: string[]; fontSize: number; lineHeight: number; overflow: boolean }
export interface ComposedItem {
  path: string;
  field: string;
  type: string;
  value: unknown;
  payload: Record<string, unknown>;
  box: LayoutBox;
  text?: TextFit | RichTextFit | ListFit;
  textStyle?: TextStyle;
  /** Effective container settings, including inherited readability constraints. */
  composition: Composition;
}
export interface ComposedGroup { path: string; box: LayoutBox; contentBox: LayoutBox; composition: Composition }
export interface CompositionTrack { offset: number; size: number }
/** Resolved flow geometry, including empty reserved slots. Promoted regions are not flows. */
export interface ComposedFlow {
  path: string;
  box: LayoutBox;
  composition: Composition;
  columns: CompositionTrack[];
  rows: CompositionTrack[];
  gap: number;
  itemCount: number;
  slotCount: number;
}
/** Additive penalties in grid-score-v1; lower is preferred. These are not quality percentages. */
export interface CompositionPenalties {
  cellProportions: number;
  fontReduction: number;
  textOverflow: number;
  tableOverflow: number;
  smallCells: number;
  emptySlots: number;
}
export interface CompositionCandidate {
  columns: number;
  rows: number;
  score: number;
  penalties: CompositionPenalties;
}
export interface CompositionDecision {
  path: string;
  mode: NonNullable<Composition['mode']> | 'regions';
  reason: 'lowest-score' | 'configured-mode' | 'promoted-regions';
  selectedColumns?: number;
  /** Only candidates actually evaluated by automatic selection, in tie-break order. */
  candidates: CompositionCandidate[];
}
export interface CompositionExplanation {
  algorithm: 'grid-score-v1';
  /** Provided widths do not establish shaping, glyph coverage or native fidelity. */
  textMeasurement: 'estimated' | 'provided';
  decisions: CompositionDecision[];
  /** Payloads whose complete internal fit is not covered by this scoring model. */
  unmeasuredPayloads: string[];
}
export interface SlideComposition {
  width: number;
  height: number;
  contentBox: LayoutBox;
  items: ComposedItem[];
  groups: ComposedGroup[];
  flows: ComposedFlow[];
  diagnostics: LayoutDiagnostic[];
  composition: Composition;
  explanation?: CompositionExplanation;
}
export interface ComposeSlideOptions {
  fonts?: Partial<FontFamilies>;
  textMeasurement?: TextMeasurement;
  width?: number;
  height?: number;
  slideIndex?: number;
  layout?: Record<string, unknown>;
  /** Return candidate scores and coverage without changing the selected geometry. */
  explain?: boolean;
}
export class OPFCompositionError extends Error {
  readonly code = "layout-overflow";
  readonly explanation?: CompositionExplanation;
  constructor(public readonly diagnostics: LayoutDiagnostic[], explanation?: CompositionExplanation) {
    super("Slide content does not fit its composition.");
    this.name = "OPFCompositionError";
    if (explanation) this.explanation = explanation;
  }
}
const fields = ["text", "items", "bullets", "image", "video", "chart", "table", "code", "metric", "quote", "timeline"];
const headings = new Set(["title", "subtitle", "tag"]);
const rows = ["top", "middle", "bottom"];
const columns = ["left", "center", "right"];
const record = (value: unknown): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const kind = (field: string) => field === "items" || field === "bullets" ? "list" : field;
const round = (value: number) => Math.round(value * 1e6) / 1e6 || value;

const textSegments = new Intl.Segmenter("und", { granularity: "grapheme" });

/** Deterministic estimate, not a font shaping engine. Preserves explicit line breaks. */
export function measureText(text: string, fontSize: number): number {
  let units = 0;
  for (const character of text) {
    if (/\p{Mark}|\u200d|\ufe0f/u.test(character)) continue;
    units += character === " " ? 0.32 : /[A-Z0-9]/.test(character) ? 0.62 : character.codePointAt(0)! > 0x2e80 ? 1 : 0.54;
  }
  return units * fontSize;
}
export function wrapText(text: string, width: number, fontSize: number, measure: MeasureTextWidth = measureText): string[] {
  const result: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/u).filter(Boolean)) {
      if (line && measure(`${line} ${word}`, fontSize) > width) { result.push(line); line = ""; }
      if (measure(word, fontSize) <= width) { line += (line ? " " : "") + word; continue; }
      // Keep combining marks and emoji sequences intact when breaking long tokens.
      for (const { segment: character } of textSegments.segment(word)) {
        if (line && measure(line + character, fontSize) > width) { result.push(line); line = ""; }
        line += character;
      }
    }
    result.push(line);
  }
  return result;
}
export function fitText(text: string, box: LayoutBox, requestedSize = 25, minFontSize = 16, measure: MeasureTextWidth = measureText): TextFit {
  if (![box.width, box.height, requestedSize, minFontSize].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || requestedSize <= 0 || minFontSize <= 0) {
    throw new RangeError("Text dimensions and font sizes must be finite and positive.");
  }
  const minimum = Math.min(minFontSize, requestedSize);
  let fontSize = requestedSize;
  let lines = wrapText(text, box.width, fontSize, measure);
  while (fontSize > minimum && (lines.length * fontSize * 1.22 > box.height || lines.some(line => measure(line, fontSize) > box.width))) {
    fontSize = Math.max(minimum, fontSize - 1);
    lines = wrapText(text, box.width, fontSize, measure);
  }
  return { lines, fontSize, lineHeight: fontSize * 1.22, overflow: lines.length * fontSize * 1.22 > box.height + 0.01 || lines.some(line => measure(line, fontSize) > box.width + 0.01) };
}
export interface RichTextRun {
  text: string; bold?: boolean; italic?: boolean; underline?: boolean; strikethrough?: boolean;
  color?: string; fontSize?: number; fontFamily?: string; link?: string; superscript?: boolean; subscript?: boolean;
}
export interface RichTextFragment {
  text: string; runIndex: number; start: number; end: number;
  x: number; width: number; fontSize: number; baselineShift: number;
  style: TextStyle; run: RichTextRun;
}
export interface RichTextLine { fragments: RichTextFragment[]; width: number; y: number; baseline: number; height: number }
export interface RichTextFit extends TextFit { richLines: RichTextLine[]; height: number }
export interface RichTextOptions {
  style: TextStyle;
  textMeasurement?: TextMeasurement;
  /** Use one measured line advance for every line, as native table cells do. */
  uniformLineHeight?: boolean;
}

/** Fit mixed styles without flattening font metrics. Run fontSize is in points. */
export function fitRichText(input: readonly (string | RichTextRun)[], box: LayoutBox, requestedSize = 25, minFontSize = 16, options: RichTextOptions = {style:{fontFamily:'sans-serif',fontWeight:400}}): RichTextFit {
  if (![box.width,box.height,requestedSize,minFontSize].every(value=>Number.isFinite(value)&&value>0)) throw new RangeError('Rich text dimensions and font sizes must be finite and positive.');
  const layout=richTextLayouter(input,box,requestedSize,options),minimum=Math.min(requestedSize,minFontSize);
  let size=requestedSize,result=layout(size);
  while(result.overflow&&size>minimum){size=Math.max(minimum,size-1);result=layout(size);}
  return result;
}
function richTextLayouter(input: readonly (string | RichTextRun)[], box: LayoutBox, requestedSize: number, options: RichTextOptions): (fontSize:number)=>RichTextFit {
  let offset=0;
  const source=input.map((value,runIndex)=>{
    const run:RichTextRun=typeof value==='string'?{text:value}:value;
    if(typeof run?.text!=='string'||(run.fontSize!==undefined&&(!Number.isFinite(run.fontSize)||run.fontSize<=0))) throw new RangeError('Rich text runs need text and a positive finite font size.');
    const start=offset;offset+=run.text.length;
    const style=resolveTextStyle({...options.style,fontFamily:run.fontFamily??options.style.fontFamily,fontWeight:run.bold===undefined?options.style.fontWeight:run.bold?700:400,italic:run.italic??options.style.italic,path:options.style.path?`${options.style.path}.${runIndex}`:undefined},options.textMeasurement);
    return {run,runIndex,start,end:offset,style};
  });
  const whole=source.map(entry=>entry.run.text).join('');
  const layout=(fontSize:number):RichTextFit=>{
    const ratio=fontSize/requestedSize;
    const fragments=(start:number,end:number):RichTextFragment[]=>{
      let x=0;const result:RichTextFragment[]=[];
      for(const entry of source){
        const a=Math.max(start,entry.start),b=Math.min(end,entry.end);if(b<=a)continue;
        const text=whole.slice(a,b),normalSize=(entry.run.fontSize!==undefined?entry.run.fontSize*4/3:requestedSize)*ratio;
        const script=entry.run.superscript||entry.run.subscript;
        const size=normalSize*(script?0.7:1),baselineShift=entry.run.superscript?-normalSize*.35:entry.run.subscript?normalSize*.2:0;
        const width=textWidthMeasurer(entry.style,options.textMeasurement)(text,size);
        result.push({text,runIndex:entry.runIndex,start:a-entry.start,end:b-entry.start,x,width,fontSize:size,baselineShift,style:entry.style,run:entry.run});x+=width;
      }return result;
    };
    const width=(start:number,end:number)=>fragments(start,end).reduce((sum,fragment)=>sum+fragment.width,0);
    const ranges:{start:number;end:number}[]=[];
    let lineStart=0,lineEnd=0;
    const push=(end:number)=>{ranges.push({start:lineStart,end});lineStart=end;lineEnd=end;};
    for(const match of whole.matchAll(/\r\n|\r|\n|[^\S\r\n]+|[^\s]+/gu)){
      const start=match.index!,end=start+match[0].length;
      if(/^[\r\n]/.test(match[0])){push(start);lineStart=end;lineEnd=end;continue;}
      if(width(lineStart,end)<=box.width){lineEnd=end;continue;}
      // Wrap at word boundaries; retain whitespace in the source ranges.
      if(lineEnd>lineStart)push(start);
      if(width(start,end)<=box.width){lineEnd=end;continue;}
      for(const {segment,index}of textSegments.segment(match[0])){
        const next=start+index+segment.length;
        if(lineEnd>lineStart&&width(lineStart,next)>box.width)push(start+index);
        lineEnd=next;
      }
    }
    ranges.push({start:lineStart,end:lineEnd});
    let y=0;
    const richLines=ranges.map(range=>{
      const parts=fragments(range.start,range.end),ascent=Math.max(fontSize,...parts.map(part=>part.fontSize-part.baselineShift)),descent=Math.max(fontSize*.22,...parts.map(part=>part.fontSize*.22+part.baselineShift));
      const height=ascent+descent,line={fragments:parts,width:parts.reduce((sum,p)=>sum+p.width,0),y,baseline:y+ascent,height};y+=height;return line;
    });
    if (options.uniformLineHeight) {
      const height = Math.max(...richLines.map(line => line.height));
      y = 0;
      for (const line of richLines) {
        line.baseline += y - line.y;
        line.y = y;
        line.height = height;
        y += height;
      }
    }
    return {lines:ranges.map(range=>whole.slice(range.start,range.end)),fontSize,lineHeight:Math.max(fontSize*1.22,...richLines.map(line=>line.height)),richLines,height:y,overflow:y>box.height+.01||richLines.some(line=>line.width>box.width+.01)};
  };
  return layout;
}

export type ListText = string | readonly (string | RichTextRun)[];
export type ListValue = ListText | {text:ListText; description?:ListText; level?:number};
export interface ListEntryLayout {
  index:number; level:number; textPath?:string; descriptionPath?:string;
  value:ListText; descriptionValue?:ListText;
  text:RichTextFit; description?:RichTextFit;
  textBox:LayoutBox; descriptionBox?:LayoutBox;
  marker:{text:string;x:number;y:number;fontSize:number;style:TextStyle;indent:number};
}
export interface ListFit extends TextFit { listEntries:ListEntryLayout[]; height:number }

/** Shared hanging indents, mixed-run fitting and description spacing for list payloads. */
export function fitList(input:readonly ListValue[],box:LayoutBox,requestedSize=25,minFontSize=16,options:RichTextOptions={style:{fontFamily:'sans-serif',fontWeight:400}}):ListFit {
  if(!Array.isArray(input)||![box.width,box.height,requestedSize,minFontSize].every(value=>Number.isFinite(value)&&value>0))throw new RangeError('List content, dimensions and font sizes must be valid.');
  const source=input.map((value,index)=>{
    const object=typeof value==='object'&&!Array.isArray(value)?value as {text:ListText;description?:ListText;level?:number}:undefined;
    const text=object?object.text:value as ListText,description=object?.description,level=object?.level??0;
    if(!Number.isInteger(level)||level<0)throw new RangeError('List levels must be nonnegative integers.');
    const runs=(value:ListText)=>typeof value==='string'?[value]:value;
    if(!Array.isArray(runs(text))||(description!==undefined&&!Array.isArray(runs(description))))throw new TypeError('List text and descriptions must be strings or text runs.');
    const base=options.style.path?`${options.style.path}.${index}`:undefined;
    return {index,level,value:text,descriptionValue:description,textPath:base?base+(object?'.text':''):undefined,descriptionPath:base?base+'.description':undefined,runs:runs(text),descriptionRuns:description===undefined?undefined:runs(description)};
  });
  const layout=(fontSize:number):ListFit=>{
    let y=box.y,overflow=false;const entries:ListEntryLayout[]=[],lines:string[]=[];
    for(const item of source){
      const indent=fontSize*1.1,offset=Math.min(box.width,item.level*indent),x=box.x+offset+indent,width=Math.max(1,box.x+box.width-x);
      if(offset+indent>=box.width)overflow=true;
      const textBox={x,y,width,height:box.height};
      const style={...options.style,path:item.textPath};
      const text=richTextLayouter(item.runs,textBox,requestedSize,{...options,style})(fontSize);
      textBox.height=text.height;lines.push(...text.lines);y+=text.height;
      let description:RichTextFit|undefined,descriptionBox:LayoutBox|undefined;
      if(item.descriptionRuns!==undefined){
        y+=fontSize*.12;descriptionBox={x,y,width,height:box.height};
        description=richTextLayouter(item.descriptionRuns,descriptionBox,requestedSize*.82,{...options,style:{...options.style,path:item.descriptionPath}})(fontSize*.82);
        descriptionBox.height=description.height;lines.push(...description.lines);y+=description.height;
      }
      overflow ||= text.overflow||!!description?.overflow;
      entries.push({index:item.index,level:item.level,value:item.value,descriptionValue:item.descriptionValue,textPath:item.textPath,descriptionPath:item.descriptionPath,text,textBox,description,descriptionBox,
        marker:{text:['•','◦','▪'][item.level%3]!,x:box.x+offset,y:textBox.y+(text.richLines[0]?.baseline??fontSize),fontSize,style:resolveTextStyle(style,options.textMeasurement),indent}});
      if(item.index<source.length-1)y+=fontSize*.28;
    }
    const height=y-box.y;
    return {listEntries:entries,lines,fontSize,lineHeight:fontSize*1.22,height,overflow:overflow||height>box.height+.01};
  };
  const minimum=Math.min(requestedSize,minFontSize);let size=requestedSize,result=layout(size);
  while(result.overflow&&size>minimum){size=Math.max(minimum,size-1);result=layout(size);}
  return result;
}

function contentText(field: string, value: unknown): string | undefined {
  if (field === "text" || headings.has(field)) return flatten(value);
  if (field === "items" || field === "bullets") return (Array.isArray(value) ? value : [value]).map(item => {
    const entry = record(item);
    return `• ${flatten(item)}${entry.description ? `\n${flatten(entry.description)}` : ""}`;
  }).join("\n");
  if (field === "code") return flatten(record(value).source ?? value);
  if (field === "quote") return flatten(record(value).text ?? value);
  return undefined;
}
export interface TableLayoutOptions {
  scale?: number;
  minFontSize?: number;
  fontFamily?: string;
  textMeasurement?: TextMeasurement;
  path?: string;
}
export interface TableCellLayout {
  value: unknown;
  input: unknown;
  sourcePath: string;
  style: TableCellStyle;
  row: number; column: number; rowSpan: number; colSpan: number;
  path: string;
  header: boolean;
  rich: boolean;
  box: LayoutBox;
  textBox: LayoutBox;
  textStyle: TextStyle;
  fit: TextFit | RichTextFit;
}
export interface TableRowLayout { box: LayoutBox; cells: TableCellLayout[] }
export interface TableLayout { rows: TableRowLayout[]; columnCount: number; height: number; overflow: boolean }

/** Shared cell geometry and font fitting for SVG, native PPTX and pagination.
 * Short rows retain their 54px preferred height. Multiline rows use the space
 * their text needs; constrained tables consume row padding before readable text.
 * All dimensions are canvas pixels; minFontSize is an unscaled canvas size.
 */
export function layoutTable(value: unknown, box: LayoutBox, options: TableLayoutOptions = {}): TableLayout {
  const scale = options.scale ?? 1, requested = 15 * scale, minimum = (options.minFontSize ?? 16) * scale;
  if (![box.x,box.y,box.width,box.height,scale,minimum].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || scale <= 0 || minimum <= 0) throw new RangeError('Table dimensions, scale and font sizes must be finite and positive.');
  const grid = tableGrid(value,options.path ?? 'table');
  if(grid.issues.length) throw new RangeError(`${grid.issues[0]!.path}: ${grid.issues[0]!.message}`);
  const columnCount=grid.columnCount,cellWidth=box.width/columnCount;
  const cells=grid.rows.flat().map(cell=>{
    const padding={top:8,right:10,bottom:4,left:10,...cell.style.padding};
    const width=cellWidth*cell.colSpan-(padding.left+padding.right)*scale;
    const style={fontFamily:options.fontFamily??'sans-serif',fontWeight:cell.header?700:400,italic:false,path:cell.valuePath};
    return {...cell,padding,width,textStyle:style};
  });
  const fitCell=(cell:typeof cells[number],height:number,min:number):TextFit|RichTextFit=>{
    const textBox={x:0,y:0,width:Math.max(scale,cell.width),height:Math.max(scale,height)};
    return Array.isArray(cell.value)
      ? fitRichText(cell.value,textBox,requested,min,{style:cell.textStyle,textMeasurement:options.textMeasurement,uniformLineHeight:true})
      : fitText(flatten(cell.value),textBox,requested,min,textWidthMeasurer(resolveTextStyle(cell.textStyle,options.textMeasurement),options.textMeasurement));
  };
  const textHeight=(fit:TextFit|RichTextFit)=>'height' in fit?fit.height:fit.lines.length*fit.lineHeight;
  const required=(cell:typeof cells[number],size:number)=>textHeight(fitCell(cell,scale,size))+(cell.padding.top+cell.padding.bottom)*scale;
  const natural=Array(grid.rowCount).fill(0) as number[],needed=Array(grid.rowCount).fill(0) as number[];
  for(const cell of cells)if(cell.rowSpan===1){natural[cell.row]=Math.max(natural[cell.row]!,required(cell,requested));needed[cell.row]=Math.max(needed[cell.row]!,required(cell,minimum));}
  // Satisfy every spanning cell over its full rectangle. Added height can only
  // help previously processed constraints; no text is duplicated into covered rows.
  for(const cell of cells)if(cell.rowSpan>1)for(const [heights,size] of [[natural,requested],[needed,minimum]] as const){
    const current=heights.slice(cell.row,cell.row+cell.rowSpan).reduce((a,b)=>a+b,0);
    const extra=Math.max(0,required(cell,size)-current)/cell.rowSpan;
    for(let r=cell.row;r<cell.row+cell.rowSpan;r++)heights[r]!+=extra;
  }
  const preferred=natural.map(height=>Math.max(54*scale,height));
  for(let r=0;r<needed.length;r++)needed[r]=Math.min(preferred[r]!,needed[r]!);
  const sum=(values:number[])=>values.reduce((a,b)=>a+b,0);
  const preferredTotal=sum(preferred),naturalTotal=sum(natural),neededTotal=sum(needed);
  const heights=preferred.map((height,r)=>preferredTotal<=box.height?height:naturalTotal<=box.height
    ? natural[r]!+(height-natural[r]!)*(box.height-naturalTotal)/Math.max(Number.EPSILON,preferredTotal-naturalTotal)
    : neededTotal<=box.height
    ? needed[r]!+(natural[r]!-needed[r]!)*(box.height-neededTotal)/Math.max(Number.EPSILON,naturalTotal-neededTotal)
    : needed[r]!*box.height/neededTotal);
  const ys=[box.y];for(const height of heights)ys.push(ys.at(-1)!+height);
  let overflow=false;
  const rows:TableRowLayout[]=heights.map((height,r)=>({box:{x:box.x,y:ys[r]!,width:box.width,height},cells:[]}));
  for(const cell of cells){
    const cellBox={x:box.x+cell.column*cellWidth,y:ys[cell.row]!,width:cell.colSpan*cellWidth,height:ys[cell.row+cell.rowSpan]!-ys[cell.row]!};
    const available=cellBox.height-(cell.padding.top+cell.padding.bottom)*scale;
    const fit=fitCell(cell,available,minimum),height=textHeight(fit);
    const offset=cell.style.verticalAlign==='bottom'?Math.max(0,available-height):cell.style.verticalAlign==='middle'?Math.max(0,(available-height)/2):0;
    const textBox={x:cellBox.x+cell.padding.left*scale,y:cellBox.y+cell.padding.top*scale+offset,width:Math.max(scale,cell.width),height:Math.max(scale,available-offset)};
    overflow ||= cell.width<=0||available<=0||fit.overflow;
    rows[cell.row]!.cells.push({value:cell.value,input:cell.input,path:cell.valuePath,sourcePath:cell.path,style:cell.style,row:cell.row,column:cell.column,rowSpan:cell.rowSpan,colSpan:cell.colSpan,header:cell.header,rich:Array.isArray(cell.value),box:cellBox,textBox,textStyle:resolveTextStyle(cell.textStyle,options.textMeasurement),fit});
  }
  return {rows,columnCount,height:sum(heights),overflow};
}
function tableOverflows(value: unknown, box: LayoutBox, scale: number, settings: Composition, options: ComposeSlideOptions, path?: string): boolean {
  return box.width <= 0 || box.height <= 0 || layoutTable(value,box,{scale,minFontSize:settings.minFontSize,fontFamily:options.fonts?.body,textMeasurement:options.textMeasurement,path}).overflow;
}
function flatten(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return value.map(flatten).join("");
  const item = record(value);
  return flatten(item.text ?? item.value ?? item.source ?? JSON.stringify(value));
}
function regionParts(key: string): [number[], number[]] | undefined {
  const span = (part: string, order: string[]) => {
    const indices = part.split("+").map(value => order.indexOf(value));
    return indices.every(index => index >= 0) ? indices : undefined;
  };
  const parts = key.split(":");
  if (parts.length === 2) {
    const r = span(parts[0]!, rows), c = span(parts[1]!, columns);
    if (r && c) return [r, c];
  } else if (parts.length === 1) {
    const r = span(key, rows), c = span(key, columns);
    if (r) return [r, [0, 1, 2]];
    if (c) return [[0, 1, 2], c];
  }
  return undefined;
}
function regionBox(parts: [number[], number[]], area: LayoutBox, requestedGap: number): LayoutBox {
  const gap = Math.min(requestedGap, area.width / 6, area.height / 6);
  const cw = (area.width - gap * 2) / 3, ch = (area.height - gap * 2) / 3;
  const [r, c] = parts;
  return { x: area.x + Math.min(...c) * (cw + gap), y: area.y + Math.min(...r) * (ch + gap), width: (Math.max(...c) - Math.min(...c) + 1) * (cw + gap) - gap, height: (Math.max(...r) - Math.min(...r) + 1) * (ch + gap) - gap };
}
function gridGeometry(count: number, area: LayoutBox, cols: number, gap: number, weights: number[], vertical: boolean) {
  const rowCount = Math.ceil(count / cols);
  gap = Math.min(gap, area.width / (cols * 2), area.height / (rowCount * 2));
  const tracks = (length: number, total: number, weighted: boolean) => {
    const values = Array.from({ length }, (_, i) => weighted ? weights[i] ?? 1 : 1);
    const sum = values.reduce((a, b) => a + b, 0);
    let cursor = 0;
    return values.map(weight => { const size = (total - gap * (length - 1)) * weight / sum; const track = { offset: cursor, size }; cursor += size + gap; return track; });
  };
  const xs = tracks(cols, area.width, !vertical), ys = tracks(rowCount, area.height, vertical);
  const boxes = Array.from({ length: count }, (_, i) => ({ x: area.x + xs[i % cols]!.offset, y: area.y + ys[Math.floor(i / cols)]!.offset, width: xs[i % cols]!.size, height: ys[Math.floor(i / cols)]!.size }));
  return {boxes, columns: xs, rows: ys, gap};
}
function gridBoxes(count: number, area: LayoutBox, cols: number, gap: number, weights: number[], vertical: boolean): LayoutBox[] {
  return gridGeometry(count, area, cols, gap, weights, vertical).boxes;
}
function assertComposition(value: Composition) {
  if (value.mode !== undefined && !["auto", "grid", "row", "column"].includes(value.mode)) throw new RangeError("Unknown composition mode.");
  for (const [key, min, max] of [["gap", 0, 0.1], ["padding", 0, 0.2], ["minFontSize", 8, 32], ["columns", 1, 12]] as const) {
    const number = value[key];
    if (number !== undefined && (!Number.isFinite(number) || number < min || number > max || key === "columns" && !Number.isInteger(number))) throw new RangeError(`Invalid composition.${key}.`);
  }
  if (value.weights !== undefined && (!Array.isArray(value.weights) || !value.weights.length || value.weights.length > 12 || value.weights.some(weight => !Number.isFinite(weight) || weight <= 0 || weight > 100))) throw new RangeError("Invalid composition.weights.");
  if (value.overflow !== undefined && !["warn", "error"].includes(value.overflow)) throw new RangeError("Invalid composition.overflow.");
}
/** Compose a validated Slide. Layout resolution remains the caller's responsibility. */
export function composeSlide(input: unknown, options: ComposeSlideOptions = {}): SlideComposition {
  const slide = record(input), layout = record(options.layout);
  const width = options.width ?? 1280, height = options.height ?? 720;
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw new RangeError("Canvas dimensions must be finite and positive.");
  const scale = Math.min(width, height) / 720;
  const composition: Composition = { ...record(layout.composition), ...record(slide.composition) };
  assertComposition(composition);
  const padding = (composition.padding ?? 0.08) * Math.min(width, height);
  const gap = (composition.gap ?? 1 / 30) * Math.min(width, height);
  const minSize = (composition.minFontSize ?? 16) * scale;
  const styleFor = (field: string, path: string): TextStyle => resolveTextStyle({
    fontFamily: (field === "title" ? options.fonts?.heading : field === "code" ? options.fonts?.code : options.fonts?.body) ?? (field === "code" ? "monospace" : "sans-serif"),
    fontWeight: field === "title" ? 700 : 400, path,
  }, options.textMeasurement);
  const widthFor = (field: string, path: string) => textWidthMeasurer(styleFor(field,path),options.textMeasurement);
  const fitContent = (field:string,value:unknown,text:string,box:LayoutBox,size:number,minimum:number,path:string) => field === 'text' && Array.isArray(value)
    ? fitRichText(value,box,size,minimum,{style:styleFor(field,path),textMeasurement:options.textMeasurement})
    : (field==='items'||field==='bullets') ? fitList(value as ListValue[],box,size,minimum,{style:styleFor(field,path),textMeasurement:options.textMeasurement})
    : fitText(text,box,size,minimum,widthFor(field,path));
  const path = `slides.${options.slideIndex ?? 0}`;
  const items: ComposedItem[] = [], diagnostics: LayoutDiagnostic[] = [];
  let y = padding;
  for (const field of ["tag", "title", "subtitle"]) {
    if (!slide[field]) continue;
    const requested = (field === "title" ? 54 : field === "tag" ? 16 : 25) * scale;
    const maxHeight = height * (field === "title" ? 0.26 : field === "subtitle" ? 0.12 : 0.045);
    const box = { x: padding, y, width: width - padding * 2, height: maxHeight };
    const text = fitText(String(slide[field]), box, requested, minSize, widthFor(field,`${path}.${field}`));
    box.height = Math.min(maxHeight, text.lines.length * text.lineHeight);
    items.push({ path: `${path}.${field}`, field, type: "text", value: slide[field], payload: { text: slide[field] }, box, text, textStyle: styleFor(field,`${path}.${field}`), composition });
    y += box.height + gap * 0.5;
  }
  if (items.length) y += gap * 0.5;
  const contentBox = { x: padding, y, width: width - padding * 2, height: Math.max(scale, height - padding - y) };
  type Pending = { field: string; type: string; value: unknown; path: string; payload: Record<string, unknown>; children?: Pending[]; composition?: Composition; region?: [number[], number[]] };
  const collect = (host: Record<string, any>, basePath: string, depth = 0, ancestors: unknown[] = []): Pending[] => {
    if (Array.isArray(host.blocks)) {
      if (depth >= MAX_COMPOSITION_DEPTH || ancestors.includes(host)) throw new RangeError(`Content groups must be acyclic and nest at most ${MAX_COMPOSITION_DEPTH} levels.`);
      const settings = record(host.composition) as Composition;
      assertComposition(settings);
      return [{ field: "blocks", type: "group", value: host.blocks, path: basePath, payload: host, composition: settings,
        children: host.blocks.flatMap((block: unknown, index: number) => collect(record(block), `${basePath}.blocks.${index}`, depth + 1, [...ancestors, host])) }];
    }
    return fields.filter(field => host[field] !== undefined).map(field => ({ field, type: host.type ?? kind(field), value: host[field], path: `${basePath}.${field}`, payload: { type: host.type ?? kind(field), [field]: host[field] } }));
  };
  // Valid documents choose exactly one of regions, blocks, or root payloads.
  const regions = Object.keys(slide).filter(key => regionParts(key)).sort();
  const pending: Pending[] = regions.length
    ? regions.flatMap(key => collect(record(slide[key]), `${path}.${key}`).map(item => ({ ...item, region: regionParts(key) })))
    : Array.isArray(slide.blocks) ? slide.blocks.flatMap((block: unknown, index: number) => collect(record(block), `${path}.blocks.${index}`)) : collect(slide, path);
  const groups: ComposedGroup[] = [], flows: ComposedFlow[] = [];
  const decisions: CompositionDecision[] | undefined = options.explain ? [] : undefined;
  const inheritedSettings = (parent: Composition, own: Composition = {}): Composition => ({
    minFontSize: parent.minFontSize,
    ...own,
    overflow: parent.overflow === "error" ? "error" : own.overflow ?? parent.overflow,
  });
  const inset = (box: LayoutBox, settings: Composition): LayoutBox => {
    const amount = (settings.padding ?? 0) * Math.min(box.width, box.height);
    return { x: box.x + amount, y: box.y + amount, width: box.width - amount * 2, height: box.height - amount * 2 };
  };
  const leafScore = (node: Pending, box: LayoutBox, settings: Composition, penalties?: CompositionPenalties): number => {
    const text = contentText(node.field, node.value);
    let score = Math.abs(Math.log(box.width / box.height / 1.6));
    if (penalties) penalties.cellProportions += score;
    if (text) {
      const fit = fitContent(node.field,node.value,text,box,25*scale,(settings.minFontSize??16)*scale,node.path);
      const reduction = (25 * scale - fit.fontSize) / scale;
      score += reduction + (fit.overflow ? 1000 : 0);
      if (penalties) { penalties.fontReduction += reduction; penalties.textOverflow += fit.overflow ? 1000 : 0; }
    }
    if (node.field === "table" && tableOverflows(node.value, box, scale, settings, options, node.path)) {
      score += 1000;
      if (penalties) penalties.tableOverflow += 1000;
    }
    if (box.width < 100 * scale || box.height < 60 * scale) {
      score += 100;
      if (penalties) penalties.smallCells += 100;
    }
    return score;
  };
  const modeFor = (settings: Composition) => settings.mode ?? "auto";
  const defaultColumns = (count: number, area: LayoutBox, settings: Composition) => {
    const mode = modeFor(settings);
    return mode === "column" ? 1 : mode === "row" ? Math.max(1, count) : settings.columns ?? Math.max(1, Math.min(count, Math.ceil(Math.sqrt(count * area.width / area.height / 1.6))));
  };
  // Candidate scoring walks descendants using their explicit tracks or geometric auto
  // seed. Only the selected candidate optimizes child autos. This bounds work by
  // O(nodes * nesting depth * candidate columns), rather than exponential search.
  const scoreNode = (node: Pending, box: LayoutBox, settings: Composition, penalties?: CompositionPenalties): number => {
    if (!node.children) return leafScore(node, box, settings, penalties);
    const own = inheritedSettings(settings, node.composition), area = inset(box, own);
    const cols = defaultColumns(node.children.length, area, own);
    const boxes = gridBoxes(node.children.length, area, cols, (own.gap ?? 1 / 30) * Math.min(box.width, box.height), own.weights ?? [], modeFor(own) === "column");
    return node.children.reduce((score, child, index) => score + scoreNode(child, boxes[index]!, own, penalties), 0);
  };
  const arrange = (nodes: Pending[], area: LayoutBox, settings: Composition, reserved = 0, gapOverride?: number, containerPath = path): void => {
    const count = Math.max(nodes.length, reserved);
    if (!count) return;
    const mode = modeFor(settings), localGap = (settings.gap ?? 1 / 30) * Math.min(area.width, area.height);
    // Root gap retains the canvas-based contract; group gaps use their container.
    const actualGap = gapOverride ?? (settings === rootSettings ? gap : localGap);
    let cols = defaultColumns(count, area, settings);
    const hasRegions = nodes.some(node => node.region);
    const candidates: CompositionCandidate[] | undefined = decisions ? [] : undefined;
    if (mode === "auto" && !hasRegions) {
      let best = Infinity;
      for (let candidate = 1; candidate <= Math.min(count, settings.columns ?? 6); candidate++) {
        const boxes = gridBoxes(count, area, candidate, actualGap, settings.weights ?? [], false);
        const emptySlots = (Math.ceil(count / candidate) * candidate - count) * 2;
        const penalties: CompositionPenalties | undefined = candidates ? {cellProportions:0,fontReduction:0,textOverflow:0,tableOverflow:0,smallCells:0,emptySlots} : undefined;
        const score = nodes.reduce((sum, node, i) => sum + scoreNode(node, boxes[i]!, settings, penalties), 0) + emptySlots;
        if (penalties && candidates) candidates.push({columns:candidate,rows:Math.ceil(count/candidate),score,penalties});
        if (score < best) { best = score; cols = candidate; }
      }
    }
    decisions?.push({path:containerPath,mode:hasRegions?'regions':mode,
      reason:hasRegions?'promoted-regions':mode==='auto'?'lowest-score':'configured-mode',
      ...(hasRegions?{}:{selectedColumns:cols}),candidates:candidates ?? []});
    const grid = gridGeometry(count, area, cols, actualGap, settings.weights ?? [], mode === "column");
    const boxes = grid.boxes;
    if (!nodes.some(node => node.region)) flows.push({path: containerPath, box: {...area}, composition: {...settings}, columns: grid.columns, rows: grid.rows, gap: grid.gap, itemCount: nodes.length, slotCount: count});
    nodes.forEach((node, index) => {
      const box = node.region ? regionBox(node.region, area, actualGap) : boxes[index]!;
      if (node.children) {
        const own = inheritedSettings(settings, node.composition), inner = inset(box, own);
        groups.push({ path: node.path, box, contentBox: inner, composition: own });
        arrange(node.children, inner, own, 0, (own.gap ?? 1 / 30) * Math.min(box.width, box.height), node.path);
      } else {
        const textValue = contentText(node.field, node.value);
        const text = textValue !== undefined ? fitContent(node.field,node.value,textValue,box,25*scale,(settings.minFontSize??16)*scale,node.path) : undefined;
        items.push({ path: node.path, field: node.field, type: node.type, value: node.value, payload: node.payload, box, text, textStyle: styleFor(node.field,node.path), composition: settings });
        if (box.width < 100 * scale || box.height < 60 * scale) diagnostics.push({ code: "small-cell", path: node.path, message: "Content cell is too small for comfortable reading; use fewer blocks or a different composition." });
      }
    });
  };
  const placeholders = Array.isArray(layout.placeholders) ? layout.placeholders.filter((p: any) => !headings.has(p.type)) : [];
  const rootSettings: Composition = { ...composition, mode: composition.mode ?? (layout.slideLayoutDirection === "Vertical" ? "column" : layout.slideLayoutDirection === "Horizontal" ? "row" : "auto") };
  arrange(pending, contentBox, rootSettings, composition.mode ? 0 : placeholders.length);

  for (const item of items) {
    for (const key of ["x", "y", "width", "height"] as const) item.box[key] = round(item.box[key]);
    if (item.field === "table" && tableOverflows(item.value,item.box,scale,item.composition,options,item.path)) diagnostics.push({ code: "text-overflow", path: item.path, message: "Table cells do not fit; use fewer rows, fewer columns, or split the table across slides." });
    if (item.text?.overflow) diagnostics.push({ code: "text-overflow", path: item.path, message: "Text exceeds its cell at the minimum font size; shorten it, increase its space, or split the slide." });
  }
  for (const group of groups) for (const box of [group.box, group.contentBox]) for (const key of ["x", "y", "width", "height"] as const) box[key] = round(box[key]);
  const strictPaths = new Set(items.filter(item => item.composition.overflow === "error").map(item => item.path));
  const failures = diagnostics.filter(diagnostic => strictPaths.has(diagnostic.path));
  const explanation: CompositionExplanation | undefined = decisions ? {
    algorithm:'grid-score-v1',textMeasurement:options.textMeasurement?'provided':'estimated',decisions,
    unmeasuredPayloads:items.filter(item=>!headings.has(item.field)&&!['text','items','bullets','code','table'].includes(item.field)).map(item=>item.path),
  } : undefined;
  if (failures.length) throw new OPFCompositionError(failures, explanation);
  return { width, height, contentBox, items, groups, flows, diagnostics, composition, ...(explanation?{explanation}:{}) };
}

/** Canonical physical slide size, converted to reference pixels at 96 pixels/inch. */
export function resolveCanvasDimensions(input: unknown): { width: number; height: number } {
  const presets: Record<string, [number, number]> = {
    widescreen: [40 / 3, 7.5], '16:9': [40 / 3, 7.5], standard: [10, 7.5],
    '4:3': [10, 7.5], '16:10': [10, 6.25], letter: [11, 8.5], a4: [11.69, 8.27],
  };
  const value = record(input);
  const preset = presets[typeof input === 'string' ? input : value.preset] ?? presets.widescreen!;
  const width = (value.widthInches ?? preset[0]) * 96;
  const height = (value.heightInches ?? preset[1]) * 96;
  if (![width, height].every(n => Number.isFinite(n) && n > 0)) throw new RangeError('Canvas dimensions must be finite and positive.');
  return { width, height };
}
