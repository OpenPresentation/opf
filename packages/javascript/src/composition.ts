import {tableGrid,type TableCellStyle} from './table.js';
export {tableGrid,tableRowBoundaries,type TableCellStyle,type TableBorder,type TableGrid,type TableGridCell,type TableGridIssue} from './table.js';
export {colorContrast, textColorForFill, chartColorForFill} from './color.js';
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
/** Physical legacy-family selection supplied by a font provider, independently of its numeric weight. */
export interface FontFaceSelection { family: string; bold: boolean; italic: boolean }
export interface TextStyle { fontFamily: string; fontWeight: number; italic?: boolean; path?: string; fontFace?: FontFaceSelection }
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
  /** Shaped vector ink relative to the left baseline origin (positive y down).
   * Null means no outline. These are not hinted/antialiased raster bounds. */
  outlineBounds?: (text: string, fontSize: number, style: TextStyle) => LayoutBox | null;
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
/** Validate an optional host outline measurement without inventing raster coverage. */
export function measureTextOutline(text: string, fontSize: number, style: TextStyle, measurement?: TextMeasurement): LayoutBox | null | undefined {
  if (measurement?.outlineBounds === undefined) return undefined;
  if (typeof measurement.outlineBounds !== 'function') throw new TypeError('Text outline provider must be a function.');
  const bounds = measurement.outlineBounds(text, fontSize, style);
  if (bounds === null) return null;
  if (!bounds || ![bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite) || bounds.width < 0 || bounds.height < 0) {
    throw new RangeError('Text outline measurement must return null or finite bounds with nonnegative dimensions.');
  }
  return {x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height};
}
export interface TextLineInk { width: number; y: number; baseline: number; height: number; outline: LayoutBox | null }
export interface TextPlacementLine { x: number; y: number; baseline: number; height: number; width: number; outline: LayoutBox | null }
export interface TextPlacement {
  alignment: 'left' | 'center' | 'right';
  /** Reference-pixel clearance around vector outlines; not a universal raster guarantee. */
  rasterPadding: number;
  lines: TextPlacementLine[];
  height: number;
  overflow: boolean;
}
export interface TextFit { lines: string[]; fontSize: number; lineHeight: number; overflow: boolean; placement?: TextPlacement }
/** Place complete measured lines, preserving alignment where it leaves room for ink.
 * Move following baselines together when outlines need more vertical separation. */
export function placeTextLines(lines: readonly TextLineInk[], box: LayoutBox, alignment: TextPlacement['alignment']='left', rasterPadding=0): TextPlacement {
  if (!Array.isArray(lines)||!box||![box.x,box.y,box.width,box.height,rasterPadding].every(Number.isFinite)||box.width<=0||box.height<=0||rasterPadding<0||!['left','center','right'].includes(alignment)) throw new RangeError('Text placement requires lines, finite positive dimensions, nonnegative padding and a valid alignment.');
  const factor=alignment==='right'?1:alignment==='center'?.5:0,placed:TextPlacementLine[]=[];
  let shift=0,bottom=box.y,height=0,overflow=false;
  for(const line of lines) {
    if(!line||![line.width,line.y,line.baseline,line.height].every(Number.isFinite)||line.width<0||line.height<=0||line.y<0||line.baseline<line.y) throw new RangeError('Text lines require finite coordinates, nonnegative advances and a baseline at or below their top.');
    const ink=line.outline;
    if(ink!==null&&(!ink||![ink.x,ink.y,ink.width,ink.height].every(Number.isFinite)||ink.width<0||ink.height<0)) throw new RangeError('Text outlines must be null or finite coordinates with nonnegative dimensions.');
    let x=box.x+(box.width-line.width)*factor;
    if(ink) {
      const low=box.x+rasterPadding-ink.x,high=box.x+box.width-rasterPadding-ink.x-ink.width;
      if(low>high+.01)overflow=true;else x=Math.max(low,Math.min(x,high));
      shift+=Math.max(0,bottom+rasterPadding-(box.y+line.baseline+shift+ink.y));
    }
    const y=box.y+line.y+shift,baseline=box.y+line.baseline+shift;
    const outline=ink?{...ink,x:x+ink.x,y:baseline+ink.y}:null;
    if(outline)bottom=outline.y+outline.height+rasterPadding;
    height=Math.max(height,y+line.height-box.y,outline?bottom-box.y:0);
    if(line.width>box.width+.01||height>box.height+.01)overflow=true;
    placed.push({x,y,baseline,height:line.height,width:line.width,outline});
  }
  return {alignment,rasterPadding,lines:placed,height,overflow};
}
export interface ComposedItem {
  path: string;
  field: string;
  type: string;
  value: unknown;
  payload: Record<string, unknown>;
  box: LayoutBox;
  /** Optional visible card allocation; box and all accepted internals occupy its padded interior. */
  frameBox?: LayoutBox;
  text?: TextFit | RichTextFit | ListFit | CodeTextFit;
  textStyle?: TextStyle;
  /** Complete accepted quote internals; consumers must reuse these fits and styles. */
  quoteLayout?: QuoteLayout;
  /** Complete accepted code internals, including source lines and literal tab positions. */
  codeLayout?: CodeLayout;
  /** Complete shared metric geometry, including its unit, label and metadata. */
  metricLayout?: MetricLayout;
  /** Complete timeline fields, markers and connector accepted by composition. */
  timelineLayout?: TimelineLayout;
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
/** Additive penalties in grid-score-v8; lower is preferred. These are not quality percentages. */
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
  algorithm: 'grid-score-v8';
  /** Provided widths do not establish shaping, glyph coverage or native fidelity. */
  textMeasurement: 'estimated' | 'provided';
  /** Optional vector coverage for headings and scalar/rich text, not every payload. */
  textOutlines: 'provided' | 'unavailable';
  /** Effective canvas reference pixels; not a universal raster tolerance. */
  textRasterPadding: number;
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
  /** Host-resolved alignment for shared content; slide design can override it. */
  contentAlignment?: 'left' | 'center' | 'right';
  titleAlignment?: 'left' | 'center' | 'right';
  /** Unscaled reference pixels around provided vector outlines; defaults to 1. */
  textRasterPadding?: number;
  /** Host-resolved body cards. A slide's explicit design.contentBox overrides this value. */
  contentBox?: boolean;
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
  return fitSourceText(text,{x:0,y:0,width,height:Number.MAX_VALUE},fontSize,fontSize,1,measure,true).lines;
}
export function fitText(text: string, box: LayoutBox, requestedSize = 25, minFontSize = 16, measure: MeasureTextWidth = measureText): SourceTextFit {
  if (![box.width, box.height, requestedSize, minFontSize].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || requestedSize <= 0 || minFontSize <= 0) {
    throw new RangeError("Text dimensions and font sizes must be finite and positive.");
  }
  return fitSourceText(text,box,Math.max(requestedSize,minFontSize),minFontSize,1,measure,true);
}

/** At most 65 layout trials, including the floor even for unusually large requests. */
function fitAtSizes<T extends {overflow:boolean}>(layout:(size:number)=>T,requested:number,minimum:number,step=1):T {
  const start=Math.max(requested,minimum);
  if(![start,minimum,step].every(value=>Number.isFinite(value)&&value>0))throw new RangeError('Readable font sizes and fitting steps must be finite and positive.');
  for(let trial=0;trial<=64;trial++) {
    const size=trial===64?minimum:Math.max(minimum,start-trial*step),result=layout(size);
    if(!result.overflow||size===minimum)return result;
  }
  throw new Error('Text fitting did not evaluate its bounded floor trial.');
}
export interface QuoteContent { text: string; attribution?: string; source?: string }
/** Source and displayed-text ranges are half-open UTF-16 offsets. Added punctuation has no source range. */
export interface QuoteTextSource {
  path: string;
  start: number;
  end: number;
  outputStart: number;
  outputEnd: number;
}
export interface QuoteTextPart {
  role: 'body' | 'footer';
  path: string;
  text: string;
  sources: QuoteTextSource[];
  /** Available space, before fitting. Invalid dimensions remain visible in failed results. */
  box: LayoutBox;
  requestedFontSize: number;
  minFontSize: number;
  requestedStyle: TextStyle;
  style: TextStyle;
  /** Absent when the available box is invalid; never fit against an invented one-pixel box. */
  fit?: TextFit;
}
export interface QuoteLayoutDiagnostic extends LayoutDiagnostic {
  reason: 'invalid-part-box' | 'part-outside-cell' | 'text-fit' | 'part-overlap';
  parts: QuoteTextPart['role'][];
}
export interface QuoteLayout {
  algorithm: 'quote-flow-v1';
  textMeasurement: 'estimated' | 'provided';
  parts: QuoteTextPart[];
  diagnostics: QuoteLayoutDiagnostic[];
  overflow: boolean;
}
export interface QuoteLayoutOptions {
  /** Canvas short edge divided by 720. Insets retain the current 18 reference-pixel contract. */
  scale?: number;
  fonts?: Partial<FontFamilies>;
  /** Readability floor in reference pixels, before canvas scaling. */
  minFontSize?: number;
  overflow?: Composition['overflow'];
  path?: string;
  textMeasurement?: TextMeasurement;
}
/**
 * Allocate and measure quote body/footer space for composition, rendering and export. Callers must
 * check overflow before accepting the parts. Line boxes are not shaped glyph or native raster bounds.
 */
export function layoutQuote(value: string | QuoteContent, box: LayoutBox, options: QuoteLayoutOptions = {}): QuoteLayout {
  const shorthand = typeof value === 'string';
  const quote = shorthand ? {text:value} : value;
  if (!quote || Array.isArray(quote) || typeof quote.text !== 'string' ||
    [quote.attribution, quote.source].some(field => field !== undefined && typeof field !== 'string')) {
    throw new TypeError('Quote content must be a string or a text object with optional string attribution/source.');
  }
  const scale = options.scale ?? 1, minimum = (options.minFontSize ?? 16) * scale;
  if (![box.x,box.y,box.width,box.height,scale,minimum].every(Number.isFinite) ||
    box.width <= 0 || box.height <= 0 || scale <= 0 || minimum <= 0) {
    throw new RangeError('Quote dimensions, scale and minimum font size must be finite and positive.');
  }
  if (options.overflow !== undefined && !['warn','error'].includes(options.overflow)) throw new RangeError('Invalid quote overflow policy.');
  const path = options.path ?? 'quote';
  const diagnostics: QuoteLayoutDiagnostic[] = [], parts: QuoteTextPart[] = [];
  const report = (reason: QuoteLayoutDiagnostic['reason'], diagnosticPath: string, roles: QuoteTextPart['role'][], message: string) =>
    diagnostics.push({code:'text-overflow',reason,path:diagnosticPath,parts:roles,message});
  const source = (sourcePath:string, text:string, outputStart:number):QuoteTextSource =>
    ({path:sourcePath,start:0,end:text.length,outputStart,outputEnd:outputStart+text.length});
  const add = (role:QuoteTextPart['role'], text:string, sources:QuoteTextSource[], area:LayoutBox, fontSize:number, fontFamily:string, fontWeight:number, partPath:string) => {
    const requestedStyle:TextStyle = {fontFamily,fontWeight,italic:false,path:partPath};
    const style = resolveTextStyle({...requestedStyle}, options.textMeasurement);
    // An explicit readability floor can raise the nominal size.
    const requestedFontSize = Math.max(fontSize * scale, minimum);
    const part:QuoteTextPart = {role,path:partPath,text,sources,box:area,requestedFontSize,minFontSize:minimum,requestedStyle,style};
    parts.push(part);
    return part;
  };
  let footer = '';
  const footerSources:QuoteTextSource[] = [];
  for (const field of ['attribution','source'] as const) {
    const text = quote[field];
    if (!text) continue;
    if (footer) footer += ' - ';
    footerSources.push(source(`${path}.${field}`,text,footer.length));
    footer += text;
  }
  const bodyPath = shorthand ? path : `${path}.text`;
  const body = add('body',`"${quote.text}"`,[source(bodyPath,quote.text,1)],
    {x:box.x+18,y:box.y+18,width:box.width-36,height:box.height-(footer?94:36)},
    28,options.fonts?.heading??'sans-serif',600,bodyPath);
  const attribution = footer ? add('footer',footer,footerSources,
    {x:box.x+18,y:box.y+box.height-58,width:box.width-36,height:40},
    17,options.fonts?.body??'sans-serif',500,path) : undefined;
  const usable = (area:LayoutBox) => [area.x,area.y,area.width,area.height].every(Number.isFinite) && area.width>0 && area.height>0;
  const fit = (part:QuoteTextPart,area:LayoutBox,size=part.requestedFontSize,floor=minimum) => usable(area)
    ? fitText(part.text,area,size,floor,textWidthMeasurer(part.style,options.textMeasurement)) : undefined;
  const inner = {x:box.x+18,y:box.y+18,width:box.width-36,height:box.height-36};
  if (!attribution) body.fit=fit(body,body.box);
  else if (usable(inner) && inner.height>18) {
    const available=inner.height-18;
    const preferredBody=fit(body,inner,body.requestedFontSize,body.requestedFontSize)!;
    const minimumBody=body.requestedFontSize===minimum ? preferredBody : fit(body,inner,minimum,minimum)!;
    const preferredBodyHeight=preferredBody.lines.length*preferredBody.lineHeight;
    const minimumBodyHeight=minimumBody.lines.length*minimumBody.lineHeight;
    let selected:{bodyBox:LayoutBox;footerBox:LayoutBox;bodyFit?:TextFit;footerFit?:TextFit;score:number;overflow:boolean}|undefined;
    // At most two footer sizes: its nominal request and the readability floor. Retain
    // the fitting pair with the least total font reduction. A 40px footer is only a
    // whitespace preference; it must not cause unnecessary shrinking or grid movement.
    for (const size of new Set([attribution.requestedFontSize,minimum])) {
      const natural=fit(attribution,inner,size,size)!;
      const naturalHeight=natural.lines.length*natural.lineHeight;
      const preferredHeight=Math.max(40,naturalHeight);
      const bodyReservation=Math.min(minimumBodyHeight,Math.max(minimumBody.lineHeight,available-natural.lineHeight));
      const footerHeight=preferredBodyHeight+preferredHeight<=available+.01 ? preferredHeight
        : Math.min(naturalHeight,Math.max(0,available-bodyReservation));
      const bodyBox={...inner,height:available-footerHeight};
      const footerBox={...inner,y:inner.y+inner.height-footerHeight,height:footerHeight};
      const bodyFit=fit(body,bodyBox);
      const footerFit=usable(footerBox) ? {...natural,overflow:natural.overflow||naturalHeight>footerHeight+.01} : undefined;
      const overflow=!bodyFit||!footerFit||bodyFit.overflow||footerFit.overflow;
      const score=(body.requestedFontSize-(bodyFit?.fontSize??minimum)+attribution.requestedFontSize-size)/scale;
      // When neither size fits, retain the floor-size trial so failure diagnostics
      // describe the irreducible result, not a rejected larger-font attempt.
      if (!selected || !overflow && (selected.overflow||score<selected.score) || overflow && selected.overflow) {
        selected={bodyBox,footerBox,bodyFit,footerFit,score,overflow};
      }
    }
    if (selected) {
      body.box=selected.bodyBox;body.fit=selected.bodyFit;
      attribution.box=selected.footerBox;attribution.fit=selected.footerFit;
    }
  }
  for (const part of parts) {
    const area=part.box;
    if (!part.fit) {
      report('invalid-part-box',part.path,[part.role],`Quote ${part.role} has no usable space after its insets; increase the cell size or change the arrangement.`);
    } else if (part.fit.overflow) {
      report('text-fit',part.path,[part.role],`Quote ${part.role} exceeds its available space at the readability floor; increase its space or change the arrangement.`);
    }
    if (usable(area) && (area.x<box.x || area.y<box.y || area.x+area.width>box.x+box.width+.01 || area.y+area.height>box.y+box.height+.01)) {
      report('part-outside-cell',part.path,[part.role],`Quote ${part.role} extends outside its cell; increase the cell size or change the arrangement.`);
    }
  }
  // Conservative occupied line rectangles, not actual glyph outlines. Reserved boxes alone
  // are insufficient: an overflowing body's rendered lines can reach an otherwise fitting footer.
  if (body?.fit && attribution?.fit && body.box.y+body.fit.lines.length*body.fit.lineHeight > attribution.box.y+.01 &&
    attribution.box.y+attribution.fit.lines.length*attribution.fit.lineHeight > body.box.y+.01) {
    report('part-overlap',path,['body','footer'],'Quote body and footer line boxes overlap; do not accept this layout without more space.');
  }
  if (diagnostics.length && options.overflow === 'error') throw new OPFCompositionError(diagnostics);
  return {algorithm:'quote-flow-v1',textMeasurement:options.textMeasurement?'provided':'estimated',parts,diagnostics,overflow:diagnostics.length>0};
}

export interface MetricContent {
  value: string | number;
  label?: string;
  description?: string;
  unit?: string;
  delta?: string | number;
  trend?: 'up' | 'down' | 'flat';
}
/** Ranges address String(sourceValue), not the numeric token spelling in serialized JSON. */
export interface MetricTextSource { path: string; value: string | number; start: number; end: number }
export interface MetricTextPart {
  role: keyof MetricContent;
  path: string;
  text: string;
  sources: MetricTextSource[];
  /** Empty optional fields retain their source mapping but occupy no visible space. */
  visible: boolean;
  /** Accepted absolute origin/baseline for each fit.sourceLines entry, including blank lines. */
  linePositions: {x:number;baseline:number}[];
  box: LayoutBox;
  requestedFontSize: number;
  minFontSize: number;
  requestedStyle: TextStyle;
  style: TextStyle;
  /** Source-preserving line/segment representation shared with code, with proportional fonts. */
  fit?: CodeTextFit;
}
export interface MetricLayoutDiagnostic extends LayoutDiagnostic {
  reason: 'invalid-part-box' | 'part-outside-cell' | 'text-fit' | 'part-overlap';
  parts: MetricTextPart['role'][];
}
export interface MetricLayout {
  algorithm: 'metric-flow-v1';
  alignment: 'left' | 'center' | 'right';
  textMeasurement: 'estimated' | 'provided';
  arrangement: 'inline-unit' | 'stacked';
  /** At most 48 arrangements; value fitting is bounded by 77 reference-size trials per arrangement. */
  attempts: number;
  parts: MetricTextPart[];
  diagnostics: MetricLayoutDiagnostic[];
  overflow: boolean;
}
export interface MetricLayoutOptions extends QuoteLayoutOptions {
  align?: 'left' | 'center' | 'right';
  /** Unscaled clearance around available vector outlines; defaults to one reference pixel. */
  textRasterPadding?: number;
}

/**
 * Measure every metric field before accepting geometry. Short single-line values and units can
 * share a baseline; longer values or units stack. No locale formatting, trend icons or rewritten
 * source text are invented. Consumers must reuse these accepted parts and source ranges.
 */
export function layoutMetric(value: string | number | MetricContent, box: LayoutBox, options: MetricLayoutOptions = {}): MetricLayout {
  const scalar = typeof value === 'string' || typeof value === 'number';
  const metric = scalar ? {value} : value;
  const isValue = (input: unknown) => typeof input === 'string' || typeof input === 'number' && Number.isFinite(input);
  if (!metric || Array.isArray(metric) || !isValue(metric.value) ||
      [metric.label,metric.description,metric.unit].some(field=>field!==undefined&&typeof field!=='string') ||
      metric.delta!==undefined&&!isValue(metric.delta) ||
      metric.trend!==undefined&&!['up','down','flat'].includes(metric.trend)) {
    throw new TypeError('Metric content requires a finite numeric or string value and schema-valid display metadata.');
  }
  const scale=options.scale??1,minimum=(options.minFontSize??16)*scale;
  const rasterPadding=(options.textRasterPadding??1)*scale,hasOutlines=options.textMeasurement?.outlineBounds!==undefined;
  if (![box.x,box.y,box.width,box.height,box.x+box.width,box.y+box.height,scale,minimum,Math.max(76*scale,minimum)*1.22].every(Number.isFinite) ||
      box.width<=0||box.height<=0||scale<=0||minimum<=0) {
    throw new RangeError('Metric dimensions, scale and minimum font size must be finite and positive.');
  }
  if(!Number.isFinite(rasterPadding)||rasterPadding<0)throw new RangeError('Metric raster padding must be finite and nonnegative.');
  if (options.overflow!==undefined&&!['warn','error'].includes(options.overflow)) throw new RangeError('Invalid metric overflow policy.');
  const alignment=options.align??'left';
  if (!['left','center','right'].includes(alignment)) throw new RangeError('Invalid metric alignment.');
  const sourcePath=options.path??'metric',parts:MetricTextPart[]=[],diagnostics:MetricLayoutDiagnostic[]=[];
  for (const role of ['value','unit','label','description','delta','trend'] as const) {
    const sourceValue=metric[role];
    if (sourceValue===undefined) continue;
    const text=String(sourceValue),path=scalar?sourcePath:`${sourcePath}.${role}`;
    const nominal=role==='value'?Math.min(76*scale,box.height*.28):(role==='description'?20:role==='trend'?18:23)*scale;
    const requestedStyle:TextStyle={fontFamily:(role==='value'?options.fonts?.heading:options.fonts?.body)??'sans-serif',fontWeight:role==='value'?800:role==='description'?400:500,italic:false,path};
    const part:MetricTextPart={role,path,text,sources:[{path,value:sourceValue,start:0,end:text.length}],visible:role==='value'||text.length>0,linePositions:[],
      box:{...box,height:0},requestedFontSize:Math.max(nominal,minimum),minFontSize:minimum,requestedStyle,style:resolveTextStyle({...requestedStyle},options.textMeasurement)};
    if (!part.visible) part.fit={lines:[],sourceLines:[],fontSize:part.requestedFontSize,lineHeight:part.requestedFontSize*1.22,tabSize:4,tabWidth:0,overflow:false};
    parts.push(part);
  }
  const primary=parts[0]!,metadata=parts.filter(part=>part!==primary&&part.visible),unit=metadata.find(part=>part.role==='unit');
  const usable=(area:LayoutBox)=>[area.x,area.y,area.width,area.height,area.x+area.width,area.y+area.height].every(Number.isFinite)&&area.width>0&&area.height>0;
  const occupied=(fit:CodeTextFit)=>fit.placement?.height??fit.lines.length*fit.lineHeight;
  const gap=8*scale,primaryGap=12*scale;
  const lineInk=(part:MetricTextPart,fit:CodeTextFit):TextLineInk[]=>fit.sourceLines.map((line,index)=>{
    let outline:LayoutBox|null=null;
    for(const segment of line.segments) {
      if(segment.kind!=='text')continue;
      const bounds=measureTextOutline(part.text.slice(segment.start,segment.end),fit.fontSize,part.style,options.textMeasurement);
      if(!bounds)continue;
      const next={...bounds,x:segment.x+bounds.x};
      if(!outline)outline=next;else{
        const right=Math.max(outline.x+outline.width,next.x+next.width),bottom=Math.max(outline.y+outline.height,next.y+next.height);
        outline.x=Math.min(outline.x,next.x);outline.y=Math.min(outline.y,next.y);outline.width=right-outline.x;outline.height=bottom-outline.y;
      }
    }
    return {width:line.width,y:index*fit.lineHeight,baseline:fit.fontSize+index*fit.lineHeight,height:fit.lineHeight,outline};
  });
  const place=(part:MetricTextPart,fit:CodeTextFit,width:number):CodeTextFit=>{
    if(!hasOutlines)return fit;
    const placement=placeTextLines(lineInk(part,fit),{x:0,y:0,width,height:Number.MAX_VALUE},alignment,rasterPadding);
    return {...fit,placement,overflow:placement.overflow};
  };
  const naturalWidth=(part:MetricTextPart,fit:CodeTextFit)=>{
    if(!hasOutlines)return Math.max(...fit.sourceLines.map(line=>line.width));
    const width=Math.max(...lineInk(part,fit).map(line=>Math.max(line.width,line.outline?line.outline.x+line.outline.width:0)-Math.min(0,line.outline?.x??0)));
    // An empty primary value retains its nominal editor target, not a padding-only sliver.
    return width>0?width+2*rasterPadding:0;
  };
  const cache=new Map<string,CodeTextFit>();
  const measure=(part:MetricTextPart,size:number,width:number)=>{
    const key=JSON.stringify([part.role,size,width]);
    let fit=cache.get(key);
    if (!fit) {
      fit=fitCodeText(part.text,{...box,width:hasOutlines?Math.max(Number.MIN_VALUE,width-2*rasterPadding):width},size,size,scale,textWidthMeasurer(part.style,options.textMeasurement));
      fit=place(part,fit,width);
      if (!Number.isFinite(occupied(fit))) throw new RangeError('Metric text layout exceeds finite coordinates.');
      cache.set(key,fit);
    }
    return fit;
  };
  const fitValue=(area:LayoutBox,singleLine:boolean)=>{
    if (!usable(area)) return undefined;
    // Derive sizes from the requested size: repeated subtraction accumulates rounding
    // error and can add an extra trial at very small floors.
    for (let step=0;step<=76;step++) {
      const size=Math.max(minimum,primary.requestedFontSize-step*scale);
      const natural=measure(primary,size,area.width);
      const fit={...natural,overflow:!!natural.placement?.overflow||singleLine&&natural.lines.length!==1||occupied(natural)>area.height+.01||natural.sourceLines.some(line=>line.width>area.width+.01)};
      if (!fit.overflow||size===minimum) return fit;
    }
  };
  type Allocation={part:MetricTextPart;box:LayoutBox;fit:CodeTextFit|undefined};
  type Candidate={arrangement:MetricLayout['arrangement'];allocations:Allocation[];score:number;overflow:boolean};
  let selected:Candidate|undefined,attempts=0;
  const reductions=Math.min(23,Math.ceil(Math.max(0,...metadata.map(part=>(part.requestedFontSize-minimum)/scale))));
  for (let reduction=0;reduction<=reductions;reduction++) {
    const measured=new Map(metadata.map(part=>[part,measure(part,Math.max(minimum,part.requestedFontSize-reduction*scale),box.width)]));
    const measuredUnit=unit?measured.get(unit):undefined;
    const unitWidth=unit&&measuredUnit?naturalWidth(unit,measuredUnit):0;
    const unitFit=unit&&measuredUnit&&unitWidth>0?place(unit,measuredUnit,unitWidth):measuredUnit;
    const inline=unitFit?.lines.length===1&&unitWidth>0&&unitWidth<=box.width*.35&&unitWidth+gap<box.width;
    for (const arrangement of (inline?['inline-unit','stacked']:['stacked']) as MetricLayout['arrangement'][]) {
      attempts++;
      const tail=metadata.filter(part=>arrangement!=='inline-unit'||part!==unit);
      const tailHeight=tail.reduce((sum,part)=>sum+occupied(measured.get(part)!),0)+Math.max(0,tail.length-1)*gap;
      if (!Number.isFinite(tailHeight)) throw new RangeError('Metric metadata exceeds finite coordinates.');
      const area={...box,width:arrangement==='inline-unit'?box.width-unitWidth-gap:box.width,height:box.height-tailHeight-(tail.length?primaryGap:0)};
      const valueFit=fitValue(area,arrangement==='inline-unit'),valueHeight=valueFit?occupied(valueFit):0;
      const allocations:Allocation[]=[];
      let primaryHeight=valueHeight;
      if (arrangement==='inline-unit'&&unit&&unitFit&&valueFit) {
        const valueBaseline=valueFit.placement?.lines.at(-1)?.baseline??valueHeight-valueFit.lineHeight+valueFit.fontSize;
        const unitBaseline=unitFit.placement?.lines.at(-1)?.baseline??occupied(unitFit)-unitFit.lineHeight+unitFit.fontSize;
        const valueY=box.y+Math.max(0,unitBaseline-valueBaseline),unitY=box.y+Math.max(0,valueBaseline-unitBaseline);
        const measuredWidth=naturalWidth(primary,valueFit);
        const valueWidth=Math.min(area.width,measuredWidth||valueFit.fontSize);
        allocations.push({part:primary,box:{...area,y:valueY,width:valueWidth,height:valueHeight},fit:place(primary,valueFit,valueWidth)});
        allocations.push({part:unit,box:{x:box.x+valueWidth+gap,y:unitY,width:unitWidth,height:occupied(unitFit)},fit:{...unitFit,overflow:!!unitFit.placement?.overflow}});
        primaryHeight=Math.max(valueY-box.y+valueHeight,unitY-box.y+occupied(unitFit));
      } else allocations.push({part:primary,box:valueFit?{...area,height:valueHeight}:area,fit:valueFit});
      // Keep related fields together. An arbitrary percentage gap disconnects a stacked unit
      // from its value on tall cells and wastes space needed by longer labels.
      let y=box.y+primaryHeight+(tail.length?primaryGap:0);
      for (const part of tail) {
        const natural=measured.get(part)!,height=occupied(natural);
        allocations.push({part,box:{...box,y,height},fit:{...natural,overflow:!!natural.placement?.overflow||natural.sourceLines.some(line=>line.width>box.width+.01)}});
        y+=height+gap;
      }
      const overflow=!valueFit||valueFit.overflow||arrangement==='inline-unit'&&valueFit.lines.length!==1||primaryHeight>area.height+.01||allocations.some(({box:area,fit})=>!fit||fit.overflow||!usable(area)||area.y+area.height>box.y+box.height+.01);
      const score=allocations.reduce((sum,{part,fit})=>sum+(part.requestedFontSize-(fit?.fontSize??minimum))/scale,0);
      const candidate={arrangement,allocations,score,overflow};
      if (!selected||!overflow&&(selected.overflow||score<selected.score)||overflow&&selected.overflow) selected=candidate;
    }
    if (selected&&!selected.overflow&&selected.score===0) break;
  }
  for (const allocation of selected!.allocations) {allocation.part.box=allocation.box;allocation.part.fit=allocation.fit;}
  const alignmentFactor=alignment==='center'?.5:alignment==='right'?1:0;
  if (selected!.arrangement==='inline-unit'&&unit) {
    const offset=(box.width-(unit.box.x+unit.box.width-box.x))*alignmentFactor;
    primary.box.x+=offset;unit.box.x+=offset;
  }
  for (const part of parts) if (part.fit) {
    if(part.fit.placement) {
      part.fit={...part.fit,placement:{...part.fit.placement,lines:part.fit.placement.lines.map(line=>({...line,x:line.x+part.box.x,y:line.y+part.box.y,baseline:line.baseline+part.box.y,outline:line.outline?{...line.outline,x:line.outline.x+part.box.x,y:line.outline.y+part.box.y}:null}))}};
      part.linePositions=part.fit.placement!.lines.map(({x,baseline})=>({x,baseline}));
    } else part.linePositions=part.fit.sourceLines.map((line,index)=>({
      x:part.box.x+(part.box.width-line.width)*alignmentFactor,baseline:part.box.y+part.fit!.fontSize+index*part.fit!.lineHeight,
    }));
  }
  const report=(reason:MetricLayoutDiagnostic['reason'],part:MetricTextPart,roles:MetricTextPart['role'][],message:string)=>
    diagnostics.push({code:'text-overflow',reason,path:part.path,parts:roles,message});
  for (const part of parts.filter(part=>part.visible)) {
    if (!part.fit||!usable(part.box)) report('invalid-part-box',part,[part.role],`Metric ${part.role} has no usable space after metadata; increase the cell or change the arrangement.`);
    else if (part.fit.overflow) report('text-fit',part,[part.role],`Metric ${part.role} exceeds its space at the readability floor; increase the cell or change the arrangement.`);
    if (usable(part.box)&&(part.box.x<box.x||part.box.y<box.y||part.box.x+part.box.width>box.x+box.width+.01||part.box.y+part.box.height>box.y+box.height+.01)) {
      report('part-outside-cell',part,[part.role],`Metric ${part.role} extends outside its cell; increase the cell or change the arrangement.`);
    }
  }
  const visible=parts.filter(part=>part.visible&&part.fit);
  for (const [index,first] of visible.entries()) for (const second of visible.slice(index+1)) {
    if (first.box.x<second.box.x+second.box.width-.01&&second.box.x<first.box.x+first.box.width-.01&&
        first.box.y<second.box.y+occupied(second.fit!)-.01&&second.box.y<first.box.y+occupied(first.fit!)-.01) {
      report('part-overlap',first,[first.role,second.role],'Metric part line boxes overlap; do not accept this layout without more space.');
    }
  }
  if (diagnostics.length&&options.overflow==='error') throw new OPFCompositionError(diagnostics);
  return {algorithm:'metric-flow-v1',alignment,textMeasurement:options.textMeasurement?'provided':'estimated',arrangement:selected!.arrangement,attempts,parts,diagnostics,overflow:diagnostics.length>0};
}

export interface TimelineEvent { when?: string; what: string; description?: string }
export interface TimelineContent { name?: string; description?: string; events: TimelineEvent[] }
export interface TimelineTextPart {
  role: 'name' | 'description' | 'when' | 'what' | 'event-description';
  eventIndex?: number;
  path: string;
  text: string;
  sources: {path:string;start:number;end:number}[];
  box: LayoutBox;
  alignment: 'left' | 'center';
  requestedFontSize: number;
  minFontSize: number;
  requestedStyle: TextStyle;
  style: TextStyle;
  fit?: SourceTextFit;
}
export interface TimelineLayoutDiagnostic extends LayoutDiagnostic {
  reason: 'text-fit' | 'part-outside-cell' | 'event-space';
}
export interface TimelineLayout {
  algorithm: 'timeline-flow-v1';
  arrangement: 'alternating' | 'vertical';
  attempts: number;
  textMeasurement: 'provided' | 'estimated';
  textOutlines: 'provided' | 'unavailable';
  parts: TimelineTextPart[];
  markers: {path:string;eventIndex:number;x:number;y:number;radius:number}[];
  connector: {x1:number;y1:number;x2:number;y2:number};
  diagnostics: TimelineLayoutDiagnostic[];
  overflow: boolean;
}
export interface TimelineLayoutOptions extends QuoteLayoutOptions { textRasterPadding?: number }

/** Preserve event order and field boundaries while trying at most 50 readable arrangements. */
export function layoutTimeline(value: readonly TimelineEvent[] | TimelineContent, box: LayoutBox, options: TimelineLayoutOptions = {}): TimelineLayout {
  const shorthand=Array.isArray(value),timeline=(shorthand?{events:value}:value) as TimelineContent;
  if(!timeline||!Array.isArray(timeline.events)||!timeline.events.length||
    [timeline.name,timeline.description].some(field=>field!==undefined&&typeof field!=='string')||
    timeline.events.some(event=>!event||typeof event.what!=='string'||[event.when,event.description].some(field=>field!==undefined&&typeof field!=='string'))) {
    throw new TypeError('Timeline content requires ordered events with string labels and optional string metadata.');
  }
  const scale=options.scale??1,minimum=(options.minFontSize??16)*scale,padding=(options.textRasterPadding??1)*scale;
  if(![box.x,box.y,box.width,box.height,scale,minimum,padding].every(Number.isFinite)||box.width<=0||box.height<=0||scale<=0||minimum<=0||padding<0)throw new RangeError('Timeline dimensions, scale and minimum must be positive, with finite nonnegative raster padding.');
  if(options.overflow!==undefined&&!['warn','error'].includes(options.overflow))throw new RangeError('Invalid timeline overflow policy.');
  const outlines=options.textMeasurement?.outlineBounds!==undefined;
  if(outlines&&typeof options.textMeasurement?.outlineBounds!=='function')throw new TypeError('Text outline provider must be a function.');
  const path=options.path??'timeline',eventPath=(index:number)=>shorthand?`${path}.${index}`:`${path}.events.${index}`;
  const fonts=resolveFontFamilies(options.fonts),source:TimelineTextPart[]=[];
  const add=(role:TimelineTextPart['role'],text:string|undefined,partPath:string,size:number,weight:number,eventIndex?:number)=>{
    if(text===undefined)return;
    const requestedStyle:TextStyle={fontFamily:fonts.body,fontWeight:weight,italic:false,path:partPath};
    source.push({role,eventIndex,path:partPath,text,sources:[{path:partPath,start:0,end:text.length}],box:{...box},alignment:'center',requestedFontSize:Math.max(size*scale,minimum),minFontSize:minimum,requestedStyle,style:resolveTextStyle({...requestedStyle},options.textMeasurement)});
  };
  add('name',timeline.name,`${path}.name`,24,700);add('description',timeline.description,`${path}.description`,18,400);
  timeline.events.forEach((event,index)=>{add('when',event.when,`${eventPath(index)}.when`,16,500,index);add('what',event.what,`${eventPath(index)}.what`,16,500,index);add('event-description',event.description,`${eventPath(index)}.description`,16,500,index);});
  const metadata:TimelineTextPart[]=[],events:TimelineTextPart[][]=timeline.events.map(()=>[]);
  for(const part of source)if(part.eventIndex===undefined)metadata.push(part);else events[part.eventIndex]!.push(part);
  const cache=new Map<string,{fit:SourceTextFit;ink:TextLineInk[];height:number}>();
  const measure=(part:TimelineTextPart,size:number,width:number,alignment:TimelineTextPart['alignment'])=>{
    const key=JSON.stringify([part.path,size,width,alignment]);let measured=cache.get(key);
    if(measured)return measured;
    const fit=fitText(part.text,{x:0,y:0,width:Math.max(Number.MIN_VALUE,width-(outlines?2*padding:0)),height:Number.MAX_VALUE},size,size,textWidthMeasurer(part.style,options.textMeasurement));
    const ink:TextLineInk[]=fit.sourceLines.map((line,index)=>{
      let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity,hasInk=false;
      if(outlines)for(const segment of line.segments)if(segment.kind==='text'){
        const outline=measureTextOutline(part.text.slice(segment.start,segment.end),size,part.style,options.textMeasurement);
        if(outline){hasInk=true;left=Math.min(left,outline.x+segment.x);top=Math.min(top,outline.y);right=Math.max(right,outline.x+segment.x+outline.width);bottom=Math.max(bottom,outline.y+outline.height);}
      }
      return {width:line.width,y:index*fit.lineHeight,baseline:size+index*fit.lineHeight,height:fit.lineHeight,outline:hasInk?{x:left,y:top,width:right-left,height:bottom-top}:null};
    });
    const placement=outlines?placeTextLines(ink,{x:0,y:0,width,height:Number.MAX_VALUE},alignment,padding):undefined;
    const height=placement?.height??fit.sourceLines.length*fit.lineHeight;
    if(!Number.isFinite(height))throw new RangeError('Timeline text exceeds finite layout coordinates.');
    measured={fit,ink,height};cache.set(key,measured);return measured;
  };
  type Candidate={arrangement:TimelineLayout['arrangement'];parts:TimelineTextPart[];markers:TimelineLayout['markers'];connector:TimelineLayout['connector'];diagnostics:TimelineLayoutDiagnostic[];score:number};
  let selected:Candidate|undefined,attempts=0;
  let reductionLimit=0;
  for(const part of source)reductionLimit=Math.max(reductionLimit,(part.requestedFontSize-minimum)/scale);
  const reductions=Math.min(24,Math.ceil(reductionLimit));
  for(let reduction=0;reduction<=reductions;reduction++){
    for(const arrangement of ['alternating','vertical'] as const){
      attempts++;
      const parts:TimelineTextPart[]=[],markers:TimelineLayout['markers']=[],diagnostics:TimelineLayoutDiagnostic[]=[];
      let score=0;
      const report=(part:TimelineTextPart,reason:TimelineLayoutDiagnostic['reason'],message:string,excess=1)=>{diagnostics.push({code:'text-overflow',reason,path:part.path,message});score+=Math.max(1,excess);};
      const place=(part:TimelineTextPart,x:number,y:number,width:number,alignment:TimelineTextPart['alignment'])=>{
        const measured=measure(part,Math.max(minimum,part.requestedFontSize-reduction*scale),Math.max(scale,width),alignment);
        const area={x,y,width:Math.max(scale,width),height:Math.max(scale,measured.height)},placement=outlines?placeTextLines(measured.ink,area,alignment,padding):undefined;
        const fit={...measured.fit,...(placement?{placement}:{}),overflow:measured.fit.overflow||!!placement?.overflow};
        const accepted={...part,box:area,alignment,fit};parts.push(accepted);
        if(fit.overflow)report(accepted,'text-fit','Timeline field exceeds its readable width; increase its space or split the timeline.');
        if(area.x<box.x-.01||area.y<box.y-.01||area.x+area.width>box.x+box.width+.01||area.y+area.height>box.y+box.height+.01)report(accepted,'part-outside-cell','Timeline field extends outside its cell; increase the cell or paginate events.',Math.max(area.x+area.width-box.x-box.width,area.y+area.height-box.y-box.height));
        return accepted;
      };
      let y=box.y;
      for(const part of metadata){const placed=place(part,box.x,y,box.width,'center');y+=placed.box.height+8*scale;}
      const available=box.y+box.height-y,count=events.length,radius=Math.min(9*scale,box.width/Math.max(2,count)/5,Math.max(scale,available)*.04);
      if(arrangement==='alternating'){
        const width=box.width/Math.max(2,count),step=(box.width-width)/Math.max(1,count-1),start=count===1?box.x+box.width/2:box.x+width/2;
        const lineY=y+Math.max(scale,available)*.46;
        events.forEach((fields,index)=>{
          const x=start+index*step,top=index%2===0?y:lineY+24*scale,bottom=index%2===0?lineY-24*scale:box.y+box.height;
          markers.push({path:eventPath(index),eventIndex:index,x,y:lineY,radius});let cursor=top;
          for(const part of fields){const placed=place(part,x-width/2,cursor,width,'center');cursor+=placed.box.height;if(cursor>bottom+.01)report(placed,'event-space','Timeline event labels exceed their side of the connector; change the arrangement or paginate events.',cursor-bottom);}
        });
      }else{
        const x=box.x+radius,textX=box.x+24*scale,width=box.width-24*scale;
        events.forEach((fields,index)=>{
          const top=y;let first:TimelineTextPart|undefined;
          for(const part of fields){const placed=place(part,textX,y,width,'left');first??=placed;y+=placed.box.height;}
          markers.push({path:eventPath(index),eventIndex:index,x,y:top+Math.min(first?.box.height??2*radius,2*radius)/2,radius});
          y+=16*scale;
        });
      }
      for(const marker of markers)if(marker.x-marker.radius<box.x-.01||marker.y-marker.radius<box.y-.01||marker.x+marker.radius>box.x+box.width+.01||marker.y+marker.radius>box.y+box.height+.01){diagnostics.push({code:'text-overflow',reason:'event-space',path:marker.path,message:'Timeline marker has no usable space; increase the cell or paginate events.'});score+=1;}
      const first=markers[0]!,last=markers.at(-1)!,connector={x1:first.x,y1:first.y,x2:last.x,y2:last.y};
      const candidate={arrangement,parts,markers,connector,diagnostics,score};
      if(!selected||score<selected.score)selected=candidate;
      if(!diagnostics.length)break;
    }
    if(!selected!.diagnostics.length)break;
  }
  const {score,...result}=selected!;
  if(result.diagnostics.length&&options.overflow==='error')throw new OPFCompositionError(result.diagnostics);
  return {algorithm:'timeline-flow-v1',attempts,textMeasurement:options.textMeasurement?'provided':'estimated',textOutlines:outlines?'provided':'unavailable',...result,overflow:result.diagnostics.length>0};
}

export interface CodeContent { source: string; language?: string; filename?: string }
export interface TextLineSegment {
  kind: 'text' | 'tab';
  start: number;
  end: number;
  /** Measured position relative to this displayed line's origin, in reference pixels. */
  x: number;
  width: number;
}
/** Exact half-open UTF-16 offsets into the part text, including consumed hard line breaks. */
export interface TextLineSource {
  start: number;
  end: number;
  nextStart: number;
  boundary: 'soft' | 'hard' | 'end';
  width: number;
  /** Explicit tab placement is required in SVG; CSS tab-size alone does not implement it. */
  segments: TextLineSegment[];
}
export interface SourceTextFit extends TextFit {
  sourceLines: TextLineSource[];
  /** Tabs advance to the next multiple of four measured spaces from each displayed line's origin. */
  tabSize: 4;
  tabWidth: number;
}
/** Compatibility names for the shared source-preserving line contract. */
export type CodeLineSegment = TextLineSegment;
export type CodeLineSource = TextLineSource;
export interface CodeTextFit extends SourceTextFit {}
export interface CodeTextPart {
  role: 'filename' | 'language' | 'body';
  path: string;
  /** Original text, without case conversion, whitespace normalization or discarded newlines. */
  text: string;
  sources: {path:string;start:number;end:number}[];
  generated: boolean;
  box: LayoutBox;
  requestedFontSize: number;
  minFontSize: number;
  requestedStyle: TextStyle;
  style: TextStyle;
  fit?: CodeTextFit;
}
export interface CodeLayoutDiagnostic extends LayoutDiagnostic {
  reason: 'invalid-part-box' | 'part-outside-cell' | 'text-fit' | 'part-overlap';
  parts: CodeTextPart['role'][];
}
export interface CodeLayout {
  algorithm: 'code-flow-v1';
  textMeasurement: 'estimated' | 'provided';
  parts: CodeTextPart[];
  diagnostics: CodeLayoutDiagnostic[];
  overflow: boolean;
}
export interface CodeLayoutOptions extends QuoteLayoutOptions {}

/** Fit code without using prose whitespace normalization. The source remains reconstructable. */
function fitCodeText(text:string,box:LayoutBox,size:number,minimum:number,step:number,measure:MeasureTextWidth):CodeTextFit {
  return fitSourceText(text,box,size,minimum,step,measure);
}

/** Retain exact source ranges and position tabs without passing control characters to a font shaper. */
function fitSourceText(text:string,box:LayoutBox,size:number,minimum:number,step:number,measure:MeasureTextWidth,prose=false):SourceTextFit {
  const layout=(fontSize:number):CodeTextFit=>{
    const tabWidth=measure(' ',fontSize)*4;
    if (!Number.isFinite(tabWidth)||text.includes('\t')&&tabWidth<=0) throw new RangeError('Text tabs require a positive finite measured space advance.');
    const measureLine=(start:number,end:number,record=false)=>{
      let x=0,offset=start;
      const segments:CodeLineSegment[]=[];
      for (const [index,segment] of text.slice(start,end).split('\t').entries()) {
        if (index) {
          const next=(Math.floor(x/tabWidth+1e-9)+1)*tabWidth;
          if (record) segments.push({kind:'tab',start:offset,end:offset+1,x,width:next-x});
          x=next;offset++;
        }
        if (segment) {
          const advance=measure(segment,fontSize);
          if (record) segments.push({kind:'text',start:offset,end:offset+segment.length,x,width:advance});
          x+=advance;offset+=segment.length;
        }
      }
      return {width:x,segments};
    };
    const width=(start:number,end:number)=>measureLine(start,end).width;
    const sourceLines:CodeLineSource[]=[];
    let start=0,end=0;
    const push=(last:number,nextStart:number,boundary:CodeLineSource['boundary'])=>{
      sourceLines.push({start,end:last,nextStart,boundary,...measureLine(start,last,true)});
      start=nextStart;end=nextStart;
    };
    const tokens=prose?/\r\n|\r|\n|[^\S\r\n\u00a0\u202f\ufeff]+|(?:[^\s]|\u00a0|\u202f|\ufeff)+/gu:/\r\n|\r|\n|[^\S\r\n]+|[^\s]+/gu;
    for (const token of text.matchAll(tokens)) {
      if (token.index===undefined) throw new Error('Missing code token source offset.');
      const a=token.index,b=a+token[0].length;
      if (/^[\r\n]/.test(token[0])) {push(a,b,'hard');continue;}
      if (width(start,b)<=box.width+.01) {end=b;continue;}
      // Prefer a word boundary. Keep indentation with a following token's
      // fitting prefix instead of eagerly placing it on a separate line.
      if (end>start && /\S/u.test(text.slice(start,end))) push(a,a,'soft');
      if (width(start,b)<=box.width+.01) {end=b;continue;}
      // Nonbreaking spaces and word joiners carry an explicit author constraint.
      // Keep the protected token intact and report overflow at the chosen floor.
      if (prose&&/[\u00a0\u202f\u2060\ufeff]/u.test(token[0])) {end=b;continue;}
      for (const segment of textSegments.segment(token[0])) {
        const next=a+segment.index+segment.segment.length;
        if (end>start && width(start,next)>box.width+.01) push(a+segment.index,a+segment.index,'soft');
        end=next;
      }
    }
    push(end,end,'end');
    const lineHeight=fontSize*1.22;
    return {lines:sourceLines.map(line=>text.slice(line.start,line.end)),sourceLines,fontSize,lineHeight,tabSize:4,tabWidth,
      overflow:sourceLines.length*lineHeight>box.height+.01||sourceLines.some(line=>line.width>box.width+.01)};
  };
  return fitAtSizes(layout,size,minimum,step);
}

/** Shared filename/language/body allocation. Consumers must reuse the accepted fits and styles. */
export function layoutCode(value:string|CodeContent,box:LayoutBox,options:CodeLayoutOptions={}):CodeLayout {
  const shorthand=typeof value==='string',code=shorthand?{source:value}:value;
  if (!code||Array.isArray(code)||typeof code.source!=='string'||[code.language,code.filename].some(field=>field!==undefined&&typeof field!=='string')) {
    throw new TypeError('Code content must be a string or source object with optional string language/filename.');
  }
  const scale=options.scale??1,minimum=(options.minFontSize??16)*scale;
  if (![box.x,box.y,box.width,box.height,box.x+box.width,box.y+box.height,scale,minimum,Math.max(18*scale,minimum)*1.22].every(Number.isFinite)||box.width<=0||box.height<=0||scale<=0||minimum<=0) {
    throw new RangeError('Code dimensions, scale and minimum font size must be finite and positive.');
  }
  if (options.overflow!==undefined&&!['warn','error'].includes(options.overflow)) throw new RangeError('Invalid code overflow policy.');
  const path=options.path??'code',inner={x:box.x+18,y:box.y+18,width:box.width-36,height:box.height-36};
  const parts:CodeTextPart[]=[],diagnostics:CodeLayoutDiagnostic[]=[];
  const add=(role:CodeTextPart['role'],text:string,partPath:string,generated=false)=>{
    const requestedStyle:TextStyle={fontFamily:options.fonts?.code??'monospace',fontWeight:role==='body'?400:700,italic:false,path:partPath};
    const part:CodeTextPart={role,path:partPath,text,sources:generated?[]:[{path:partPath,start:0,end:text.length}],generated,box:{...inner},
      requestedFontSize:Math.max((role==='body'?18:14)*scale,minimum),minFontSize:minimum,requestedStyle,
      style:resolveTextStyle({...requestedStyle},options.textMeasurement)};
    parts.push(part);return part;
  };
  if (code.filename) add('filename',code.filename,`${path}.filename`);
  if (code.language) add('language',code.language,`${path}.language`);
  if (!parts.length) add('language','code',path,true);
  const body=add('body',code.source,shorthand?path:`${path}.source`),headers=parts.filter(part=>part!==body);
  const usable=(area:LayoutBox)=>[area.x,area.y,area.width,area.height].every(Number.isFinite)&&area.width>0&&area.height>0;
  const fit=(part:CodeTextPart,area:LayoutBox,size=part.requestedFontSize,floor=minimum)=>usable(area)
    ?fitCodeText(part.text,area,size,floor,scale,textWidthMeasurer(part.style,options.textMeasurement)):undefined;
  if (usable(inner)) {
    // There are at most two metadata parts and four nominal/floor combinations.
    const combinations=headers.reduce<{part:CodeTextPart;size:number}[][]>((choices,part)=>
      choices.flatMap(choice=>[...new Set([part.requestedFontSize,minimum])].map(size=>[...choice,{part,size}])),[[]]);
    type Allocation={part:CodeTextPart;box:LayoutBox;fit:CodeTextFit|undefined};
    let selected:{allocations:Allocation[];score:number;overflow:boolean}|undefined;
    for (const combination of combinations) {
      let y=inner.y;
      const allocations:Allocation[]=[];
      for (const [index,{part,size}] of combination.entries()) {
        const measured=fitCodeText(part.text,inner,size,size,scale,textWidthMeasurer(part.style,options.textMeasurement));
        const area={...inner,y,height:measured.lines.length*measured.lineHeight};
        allocations.push({part,box:area,fit:usable(area)?{...measured,overflow:measured.sourceLines.some(line=>line.width>area.width+.01)}:undefined});
        y+=area.height+(index<headers.length-1?8:12);
      }
      const area={...inner,y,height:inner.y+inner.height-y};
      allocations.push({part:body,box:area,fit:fit(body,area)});
      const overflow=allocations.some(({box,fit})=>!fit||fit.overflow||!usable(box)||box.y+box.height>inner.y+inner.height+.01);
      const score=allocations.reduce((sum,{part,fit})=>sum+(part.requestedFontSize-(fit?.fontSize??minimum))/scale,0);
      if (!selected||!overflow&&(selected.overflow||score<selected.score)||overflow&&selected.overflow) selected={allocations,score,overflow};
    }
    if (selected) for (const {part,box,fit} of selected.allocations) {part.box=box;part.fit=fit;}
  }
  const report=(reason:CodeLayoutDiagnostic['reason'],part:CodeTextPart,roles:CodeTextPart['role'][],message:string)=>
    diagnostics.push({code:'text-overflow',reason,path:part.path,parts:roles,message});
  for (const part of parts) {
    if (!part.fit) report('invalid-part-box',part,[part.role],`Code ${part.role} has no usable space after metadata and insets; increase the cell or change the arrangement.`);
    else if (part.fit.overflow) report('text-fit',part,[part.role],`Code ${part.role} exceeds its space at the readability floor; increase its space or change the arrangement.`);
    const area=part.box;
    if (usable(area)&&(area.x<box.x||area.y<box.y||area.x+area.width>box.x+box.width+.01||area.y+area.height>box.y+box.height+.01)) {
      report('part-outside-cell',part,[part.role],`Code ${part.role} extends outside its cell; increase the cell or change the arrangement.`);
    }
  }
  for (const [index,first] of parts.entries()) {
    const second=parts[index+1];
    if (first.fit&&second?.fit&&first.box.y+first.fit.lines.length*first.fit.lineHeight>second.box.y+.01) {
      report('part-overlap',first,[first.role,second.role],'Code part line boxes overlap; do not accept this layout without more space.');
    }
  }
  if (diagnostics.length&&options.overflow==='error') throw new OPFCompositionError(diagnostics);
  return {algorithm:'code-flow-v1',textMeasurement:options.textMeasurement?'provided':'estimated',parts,diagnostics,overflow:diagnostics.length>0};
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
  const layout=richTextLayouter(input,box,requestedSize,options);
  return fitAtSizes(layout,requestedSize,richMinimum(input,requestedSize,minFontSize));
}
/** Retain the existing relative shrink limit and enforce the floor on painted glyph sizes. */
function richMinimum(input:readonly (string|RichTextRun)[],requested:number,minimum:number):number {
  let floor=Math.min(requested,minimum),visible=false;
  for(const value of input) {
    const run=typeof value==='string'?{text:value}:value;
    if(!run.text)continue;
    const ratio=(run.fontSize===undefined?1:run.fontSize*4/3/requested)*(run.superscript||run.subscript?0.7:1);
    floor=Math.max(floor,minimum/ratio);visible=true;
  }
  return visible?floor:minimum;
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
  let minimum=minFontSize;
  for(const item of source) {
    minimum=Math.max(minimum,richMinimum(item.runs,requestedSize,minFontSize));
    if(item.descriptionRuns!==undefined)minimum=Math.max(minimum,richMinimum(item.descriptionRuns,requestedSize*.82,minFontSize)/.82);
  }
  return fitAtSizes(layout,requestedSize,minimum);
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
  const scale = options.scale ?? 1, minimum = (options.minFontSize ?? 16) * scale, requested = Math.max(15 * scale,minimum);
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
  const cellMinimum=(cell:typeof cells[number])=>Array.isArray(cell.value)?richMinimum(cell.value,requested,minimum):minimum;
  const fitCell=(cell:typeof cells[number],height:number,min:number):TextFit|RichTextFit=>{
    const textBox={x:0,y:0,width:Math.max(scale,cell.width),height:Math.max(scale,height)};
    return Array.isArray(cell.value)
      ? fitRichText(cell.value,textBox,requested,min,{style:cell.textStyle,textMeasurement:options.textMeasurement,uniformLineHeight:true})
      : fitText(flatten(cell.value),textBox,requested,min,textWidthMeasurer(resolveTextStyle(cell.textStyle,options.textMeasurement),options.textMeasurement));
  };
  const textHeight=(fit:TextFit|RichTextFit)=>'height' in fit?fit.height:fit.lines.length*fit.lineHeight;
  const required=(cell:typeof cells[number],natural:boolean)=>{
    const floor=cellMinimum(cell),size=natural?Math.max(requested,floor):floor;
    const textBox={x:0,y:0,width:Math.max(scale,cell.width),height:scale};
    const fit=Array.isArray(cell.value)
      ?richTextLayouter(cell.value,textBox,requested,{style:cell.textStyle,textMeasurement:options.textMeasurement,uniformLineHeight:true})(size)
      :fitText(flatten(cell.value),textBox,size,size,textWidthMeasurer(resolveTextStyle(cell.textStyle,options.textMeasurement),options.textMeasurement));
    return textHeight(fit)+(cell.padding.top+cell.padding.bottom)*scale;
  };
  const natural=Array(grid.rowCount).fill(0) as number[],needed=Array(grid.rowCount).fill(0) as number[];
  for(const cell of cells)if(cell.rowSpan===1){natural[cell.row]=Math.max(natural[cell.row]!,required(cell,true));needed[cell.row]=Math.max(needed[cell.row]!,required(cell,false));}
  // Satisfy every spanning cell over its full rectangle. Added height can only
  // help previously processed constraints; no text is duplicated into covered rows.
  for(const cell of cells)if(cell.rowSpan>1)for(const [heights,preferredSize] of [[natural,true],[needed,false]] as const){
    const current=heights.slice(cell.row,cell.row+cell.rowSpan).reduce((a,b)=>a+b,0);
    const extra=Math.max(0,required(cell,preferredSize)-current)/cell.rowSpan;
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
  const hasCards = record(slide.design).contentBox ?? options.contentBox ?? false;
  const composition: Composition = { ...record(layout.composition), ...record(slide.composition) };
  assertComposition(composition);
  const padding = (composition.padding ?? 0.08) * Math.min(width, height);
  const gap = (composition.gap ?? 1 / 30) * Math.min(width, height);
  const minSize = (composition.minFontSize ?? 16) * scale;
  const rasterPadding=(options.textRasterPadding??1)*scale;
  if(!Number.isFinite(rasterPadding)||rasterPadding<0)throw new RangeError('Text raster padding must be finite and nonnegative.');
  const styleFor = (field: string, path: string): TextStyle => resolveTextStyle({
    fontFamily: (field === "title" ? options.fonts?.heading : field === "code" ? options.fonts?.code : options.fonts?.body) ?? (field === "code" ? "monospace" : "sans-serif"),
    fontWeight: field === "title" ? 700 : 400, path,
  }, options.textMeasurement);
  const widthFor = (field: string, path: string) => textWidthMeasurer(styleFor(field,path),options.textMeasurement);
  const fitPlacedText = (field:string,value:unknown,text:string,box:LayoutBox,size:number,minimum:number,path:string):TextFit|RichTextFit => {
    const style=styleFor(field,path),rich=field==='text'&&Array.isArray(value);
    if(!options.textMeasurement?.outlineBounds)return rich?fitRichText(value,box,size,minimum,{style,textMeasurement:options.textMeasurement}):fitText(text,box,size,minimum,textWidthMeasurer(style,options.textMeasurement));
    const alignment=(field==='title'?record(slide.design).titleAlignment??options.titleAlignment:record(slide.design).contentAlignment??options.contentAlignment)??'left';
    const richLayout=rich?richTextLayouter(value,box,size,{style,textMeasurement:options.textMeasurement}):undefined;
    const measure=textWidthMeasurer(style,options.textMeasurement),floor=rich?richMinimum(value,size,minimum):minimum,start=Math.max(size,floor);
    // The nominal heading/body range fits within 64 reference-pixel steps; the
    // last trial always evaluates the explicit floor even with unusual callers.
    for(let trial=0;trial<=64;trial++) {
      const fontSize=trial===64?floor:Math.max(floor,start-trial*scale);
      const fit=richLayout?richLayout(fontSize):fitText(text,box,fontSize,fontSize,measure);
      const richLines='richLines' in fit?(fit as RichTextFit).richLines:undefined;
      const lines:TextLineInk[]=richLines?richLines.map(line=>{
        let outline:LayoutBox|null=null;
        for(const fragment of line.fragments) {
          const bounds=measureTextOutline(fragment.text,fragment.fontSize,fragment.style,options.textMeasurement);
          if(!bounds)continue;
          const next={...bounds,x:fragment.x+bounds.x,y:fragment.baselineShift+bounds.y};
          if(!outline)outline=next;else{const right=Math.max(outline.x+outline.width,next.x+next.width),bottom=Math.max(outline.y+outline.height,next.y+next.height);outline.x=Math.min(outline.x,next.x);outline.y=Math.min(outline.y,next.y);outline.width=right-outline.x;outline.height=bottom-outline.y;}
        }
        return {width:line.width,y:line.y,baseline:line.baseline,height:line.height,outline};
      }):(fit as SourceTextFit).sourceLines.map((line,index)=>{
        let outline:LayoutBox|null=null;
        for(const segment of line.segments) {
          if(segment.kind==='tab')continue;
          const bounds=measureTextOutline(text.slice(segment.start,segment.end),fontSize,style,options.textMeasurement);
          if(!bounds)continue;
          const next={...bounds,x:segment.x+bounds.x};
          if(!outline)outline=next;else{const right=Math.max(outline.x+outline.width,next.x+next.width),bottom=Math.max(outline.y+outline.height,next.y+next.height);outline.x=Math.min(outline.x,next.x);outline.y=Math.min(outline.y,next.y);outline.width=right-outline.x;outline.height=bottom-outline.y;}
        }
        return {width:line.width,y:index*fit.lineHeight,baseline:fontSize+index*fit.lineHeight,height:fit.lineHeight,outline};
      });
      const placement=placeTextLines(lines,box,alignment,rasterPadding),result={...fit,placement,overflow:fit.overflow||placement.overflow};
      if(!result.overflow||fontSize===floor)return result;
    }
    throw new Error('Text placement did not evaluate its bounded floor trial.');
  };
  const fitContent = (field:string,value:unknown,text:string,box:LayoutBox,size:number,minimum:number,path:string) => field === 'text'
    ? fitPlacedText(field,value,text,box,size,minimum,path)
    : (field==='items'||field==='bullets') ? fitList(value as ListValue[],box,size,minimum,{style:styleFor(field,path),textMeasurement:options.textMeasurement})
    : fitText(text,box,size,minimum,widthFor(field,path));
  const path = `slides.${options.slideIndex ?? 0}`;
  const items: ComposedItem[] = [], diagnostics: LayoutDiagnostic[] = [];
  let y = padding;
  for (const field of ["tag", "title", "subtitle"]) {
    if (!slide[field]) continue;
    const requested = (field === "title" ? 54 : field === "tag" ? 16 : 25) * scale;
    const maxHeight = Math.max(height * (field === "title" ? 0.26 : field === "subtitle" ? 0.12 : 0.045),minSize*1.22+2*rasterPadding);
    const box = { x: padding, y, width: width - padding * 2, height: maxHeight };
    const text = fitPlacedText(field,slide[field],String(slide[field]),box,requested,minSize,`${path}.${field}`);
    box.height = Math.min(maxHeight, Math.max(text.lines.length * text.lineHeight,text.placement?.height??0));
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
  const acceptedBox = (box: LayoutBox): LayoutBox => ({x:round(box.x),y:round(box.y),width:round(box.width),height:round(box.height)});
  // Keep the allocation/explicit region intact. All scoring and final measurement
  // use the same rounded interior, including strict overflow and pagination.
  const payloadBox = (box: LayoutBox): LayoutBox => {
    if (!hasCards) return box;
    const frame = acceptedBox(box), padding = Math.min(12 * scale, frame.width / 4, frame.height / 4);
    return acceptedBox({x:frame.x+padding,y:frame.y+padding,width:frame.width-2*padding,height:frame.height-2*padding});
  };
  const measureQuote = (node: Pending, box: LayoutBox, settings: Composition) => layoutQuote(node.value as string | QuoteContent, acceptedBox(box), {
    fonts:options.fonts,textMeasurement:options.textMeasurement,scale,minFontSize:settings.minFontSize,path:node.path,
  });
  const measureCode = (node: Pending, box: LayoutBox, settings: Composition) => layoutCode(node.value as string | CodeContent, acceptedBox(box), {
    fonts:options.fonts,textMeasurement:options.textMeasurement,scale,minFontSize:settings.minFontSize,path:node.path,
  });
  const measureMetric = (node: Pending, box: LayoutBox, settings: Composition) => layoutMetric(node.value as string | number | MetricContent, acceptedBox(box), {
    fonts:options.fonts,textMeasurement:options.textMeasurement,scale,minFontSize:settings.minFontSize,path:node.path,
    textRasterPadding:options.textRasterPadding,
    align:record(slide.design).contentAlignment??options.contentAlignment,
  });
  const measureTimeline = (node: Pending, box: LayoutBox, settings: Composition) => layoutTimeline(node.value as TimelineContent, acceptedBox(box), {
    fonts:options.fonts,textMeasurement:options.textMeasurement,scale,minFontSize:settings.minFontSize,path:node.path,textRasterPadding:options.textRasterPadding,
  });
  const leafScore = (node: Pending, box: LayoutBox, settings: Composition, penalties?: CompositionPenalties): number => {
    box = payloadBox(box);
    const text = contentText(node.field, node.value);
    let score = Math.abs(Math.log(box.width / box.height / 1.6));
    if (penalties) penalties.cellProportions += score;
    if (node.field === 'quote' || node.field === 'code' || node.field === 'metric' || node.field === 'timeline') {
      const internal = node.field === 'quote' ? measureQuote(node,box,settings) : node.field === 'code' ? measureCode(node,box,settings) : node.field === 'metric' ? measureMetric(node,box,settings) : measureTimeline(node,box,settings);
      const reduction = internal.parts.reduce((sum,part)=>sum+(part.fit ? (part.requestedFontSize-part.fit.fontSize)/scale : 0),0);
      score += reduction + (internal.overflow ? 1000 : 0);
      if (penalties) { penalties.fontReduction += reduction; penalties.textOverflow += internal.overflow ? 1000 : 0; }
    } else if (text) {
      const fit = fitContent(node.field,node.value,text,box,25*scale,(settings.minFontSize??16)*scale,node.path);
      const reduction = Math.max(0,25 * scale - fit.fontSize) / scale;
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
      let box = node.region ? regionBox(node.region, area, actualGap) : boxes[index]!;
      if (node.children) {
        const own = inheritedSettings(settings, node.composition), inner = inset(box, own);
        groups.push({ path: node.path, box, contentBox: inner, composition: own });
        arrange(node.children, inner, own, 0, (own.gap ?? 1 / 30) * Math.min(box.width, box.height), node.path);
      } else {
        const frameBox = hasCards ? acceptedBox(box) : undefined;
        box = payloadBox(box);
        const textValue = contentText(node.field, node.value);
        const quoteLayout = node.field === 'quote' ? measureQuote(node,box,settings) : undefined;
        const codeLayout = node.field === 'code' ? measureCode(node,box,settings) : undefined;
        const metricLayout = node.field === 'metric' ? measureMetric(node,box,settings) : undefined;
        const timelineLayout = node.field === 'timeline' ? measureTimeline(node,box,settings) : undefined;
        const internal = quoteLayout ?? codeLayout ?? metricLayout ?? timelineLayout, body = internal?.parts.find(part=>part.role==='body'||part.role==='value');
        const text = internal ? body?.fit : textValue !== undefined ? fitContent(node.field,node.value,textValue,box,25*scale,(settings.minFontSize??16)*scale,node.path) : undefined;
        items.push({ path: node.path, field: node.field, type: node.type, value: node.value, payload: node.payload, box:internal?acceptedBox(box):box,
          ...(frameBox ? {frameBox} : {}),
          text, textStyle: body?.style ?? styleFor(node.field,node.path), composition: settings, ...(quoteLayout?{quoteLayout}:{}), ...(codeLayout?{codeLayout}:{}), ...(metricLayout?{metricLayout}:{}), ...(timelineLayout?{timelineLayout}:{}) });
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
    if (item.quoteLayout) diagnostics.push(...item.quoteLayout.diagnostics);
    else if (item.codeLayout) diagnostics.push(...item.codeLayout.diagnostics);
    else if (item.metricLayout) diagnostics.push(...item.metricLayout.diagnostics);
    else if (item.timelineLayout) diagnostics.push(...item.timelineLayout.diagnostics);
    else if (item.text?.overflow) diagnostics.push({ code: "text-overflow", path: item.path, message: "Text exceeds its cell at the minimum font size; shorten it, increase its space, or split the slide." });
  }
  for (const group of groups) for (const box of [group.box, group.contentBox]) for (const key of ["x", "y", "width", "height"] as const) box[key] = round(box[key]);
  const strictPaths = new Set(items.filter(item => item.composition.overflow === "error").map(item => item.path));
  const failures = diagnostics.filter(diagnostic => {
    let path = diagnostic.path;
    while (path) {
      if (strictPaths.has(path)) return true;
      const boundary = path.lastIndexOf('.');
      if (boundary < 0) break;
      path = path.slice(0,boundary);
    }
    return false;
  });
  const explanation: CompositionExplanation | undefined = decisions ? {
    algorithm:'grid-score-v8',textMeasurement:options.textMeasurement?'provided':'estimated',textOutlines:options.textMeasurement?.outlineBounds?'provided':'unavailable',textRasterPadding:rasterPadding,decisions,
    unmeasuredPayloads:items.filter(item=>!headings.has(item.field)&&!item.quoteLayout&&!item.codeLayout&&!item.metricLayout&&!item.timelineLayout&&!['text','items','bullets','table'].includes(item.field)).map(item=>item.path),
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
