import {tableRowBoundaries} from './table.js';
import { catalogs } from "./catalogs.js";
import { resolveFontFamilies, resolveCanvasDimensions, composeSlide, type ComposeSlideOptions, type LayoutDiagnostic, type TextMeasurement } from './composition.js';
import { assertValidPresentation } from './validator.js';

export interface PaginationOptions extends ComposeSlideOptions {
  /** Readability floor used while choosing page breaks. Default 24 reference pixels. */
  minFontSize?: number;
  /** All-or-nothing resource limit. Defaults to 100 output slides. */
  maxSlides?: number;
  /** Existing deck IDs to avoid when generating continuation IDs. */
  reservedIds?: string[];
}
export interface PaginationMapping {
  sourcePath: string;
  outputPath: string;
  /** Half-open offsets into the original leaf; text offsets use UTF-16. */
  range?: { unit: 'utf16' | 'items'; start: number; end: number };
}
export interface PaginatedPage {
  slideIndex: number;
  mappings: PaginationMapping[];
  /** Repeated headings/furniture and their metadata sources; separate from body slices. */
  repeatedMappings?: PaginationMapping[];
}
export interface PaginationResult { slides: Record<string, any>[]; pages: PaginatedPage[] }
export class OPFPaginationError extends Error {
  readonly code = 'pagination-unresolved';
  constructor(message: string, public readonly diagnostics: LayoutDiagnostic[] = []) {
    super(message); this.name = 'OPFPaginationError';
  }
}
const contentFields = new Set(['text','items','bullets','image','video','chart','table','code','metric','quote','timeline']);
const headingFields = new Set(['title','subtitle','tag']);
const isRecord = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = <T>(value: T): T => structuredClone(value);
const textOf = (value: any): string => typeof value === 'string' ? value : Array.isArray(value) ? value.map(textOf).join('') : value?.text ?? '';
const graphemes = new Intl.Segmenter('und', { granularity: 'grapheme' });

function sliceRichText(value: any, start: number, end: number): any {
  if (typeof value === 'string') return value.slice(start, end);
  let offset = 0;
  return value.flatMap((run: any) => {
    const text = textOf(run), left = Math.max(0, start - offset), right = Math.min(text.length, end - offset);
    offset += text.length;
    if (right <= left) return [];
    return [typeof run === 'string' ? text.slice(left, right) : { ...run, text: text.slice(left, right) }];
  });
}
interface Leaf {
  path: string; field: string; value: any;
  boundaries?: number[]; unit?: 'utf16' | 'items';
  slice?: (start: number, end: number) => any;
}
interface Portion { leaf: Leaf; start: number; end: number; value: any }
function leafFor(path: string, field: string, value: any): Leaf {
  const leaf: Leaf = { path, field, value };
  let text: string | undefined;
  if (field === 'text') { text = textOf(value); leaf.slice = (a,b) => sliceRichText(value,a,b); }
  if (field === 'code' || field === 'quote') {
    const key = field === 'code' ? 'source' : 'text';
    text = typeof value === 'string' ? value : value[key];
    leaf.slice = (a,b) => typeof value === 'string' ? value.slice(a,b) : { ...value, [key]: text!.slice(a,b) };
  }
  if (text !== undefined) {
    leaf.unit = 'utf16';
    leaf.boundaries = [0, ...Array.from(graphemes.segment(text), segment => segment.index + segment.segment.length)];
  } else if (field === 'items' || field === 'bullets') {
    leaf.unit = 'items'; leaf.boundaries = Array.from({length:value.length+1},(_,i)=>i);
    leaf.slice = (a,b) => value.slice(a,b);
  } else if (field === 'table' || field === 'timeline') {
    const key = field === 'table' ? 'rows' : 'events';
    const values = Array.isArray(value) ? value : value[key];
    if (Array.isArray(values)) {
      leaf.unit = 'items'; leaf.boundaries = field === 'table' ? tableRowBoundaries(value) : Array.from({length:values.length+1},(_,i)=>i);
      leaf.slice = (a,b) => Array.isArray(value) ? value.slice(a,b) : {...value,[key]:values.slice(a,b)};
    }
  }
  return leaf;
}

/** Explicit, lossless authoring transform. It never changes slide count during rendering. */
export function paginateSlide(input: unknown, options: PaginationOptions = {}): PaginationResult {
  assertValidPresentation({slides:[input]});
  let source = clone(input) as Record<string, any>;
  const maxSlides = options.maxSlides ?? 100;
  if (!Number.isInteger(maxSlides) || maxSlides < 1 || maxSlides > 10000) throw new RangeError('maxSlides must be an integer between 1 and 10000.');
  const minFontSize = options.minFontSize ?? 24;
  if (!Number.isFinite(minFontSize) || minFontSize < 8 || minFontSize > 32) throw new RangeError("Pagination minFontSize must be between 8 and 32.");
  const sourceIndex = options.slideIndex ?? 0, sourceBase = `slides.${sourceIndex}`;
  const withReadability = (slide: Record<string, any>, warn = false): Record<string, any> => {
    const result = clone(slide);
    const rootMinimum = Math.max(minFontSize,result.composition?.minFontSize ?? (options.layout?.composition as any)?.minFontSize ?? 16);
    result.composition = {...result.composition,minFontSize:rootMinimum};
    const visit = (node: Record<string, any>, inheritedMinimum: number) => {
      const minimum = Math.max(minFontSize,node.composition?.minFontSize ?? inheritedMinimum);
      if (node.composition) node.composition = { ...node.composition, minFontSize:minimum, ...(warn?{overflow:'warn'}:{}) };
      if (Array.isArray(node.blocks)) node.blocks.forEach(child=>{ visit(child,minimum); });
    };
    visit(result,rootMinimum);
    for (const [key,value] of Object.entries(result)) if (isRecord(value) && /^(top|middle|bottom|left|center|right)([+:]|$)/.test(key)) visit(value,rootMinimum);
    return result;
  };
  // Persist the evaluated readability policy in the ordinary returned slides. Otherwise a
  // footer measured at 24px during pagination would render at its old 17px nominal size.
  source = withReadability(source);
  let evaluations = 0;
  const geometry = (slide: Record<string, any>, pageIndex = 0) => {
    if (++evaluations > 20000) throw new OPFPaginationError('Pagination exceeded its layout evaluation limit. Split the input into smaller sections.');
    return composeSlide(withReadability(slide,true), {...options,slideNumber:(options.slideNumber??sourceIndex+1)+pageIndex});
  };
  const initial = geometry(source);
  const repeatedMappings = (pageIndex: number): PaginationMapping[] => {
    if(!initial.furniture)return [];
    const paths = new Set(initial.items.filter(item=>headingFields.has(item.field)).map(item=>item.path));
    for (const part of initial.furniture?.parts??[]) { paths.add(part.path); if(part.sourcePath) paths.add(part.sourcePath); }
    return [...paths].map(sourcePath=>({sourcePath,outputPath:sourcePath.startsWith(`${sourceBase}.`)?`slides.${sourceIndex+pageIndex}${sourcePath.slice(sourceBase.length)}`:sourcePath}));
  };
  if (!initial.diagnostics.length) return { slides:[source], pages:[{slideIndex:sourceIndex,mappings:initial.items.map(item=>({sourcePath:item.path,outputPath:item.path})),...(initial.furniture?{repeatedMappings:repeatedMappings(0)}:{})}] };
  const headerIssues = initial.diagnostics.filter(issue=>headingFields.has(issue.path.slice(sourceBase.length+1))||initial.furniture?.diagnostics.includes(issue));
  if (headerIssues.length) throw new OPFPaginationError('Repeated headings or header/footer content cannot fit or resolve. Change the repeated content or slide design before pagination.',headerIssues);
  const leaves = initial.items.filter(item=>!headingFields.has(item.field)).map(item=>leafFor(item.path,item.field,item.value));
  const leafPaths = new Set(leaves.map(leaf=>leaf.path));
  const slides: Record<string, any>[] = [], pages: PaginatedPage[] = [];
  let selected = new Map<string,Portion>();
  const reservedIds = new Set(options.reservedIds ?? []);
  if (typeof source.id === 'string') reservedIds.add(source.id);

  // Prune absent leaves, compact block arrays, and preserve every enclosing group.
  const project = (portions: Map<string,Portion>, pageIndex: number) => {
    const mappings: PaginationMapping[] = [];
    const visit = (node: Record<string,any>, path: string, out: string, root = false): Record<string,any> | undefined => {
      const result: Record<string,any> = {};
      let hasContent = false;
      for (const [key,value] of Object.entries(node)) {
        const childPath = `${path}.${key}`, outputPath = `${out}.${key}`;
        if (leafPaths.has(childPath)) {
          const portion = portions.get(childPath);
          if (portion) {
            result[key] = clone(portion.value); hasContent = true;
            mappings.push({sourcePath:childPath,outputPath,...(portion.leaf.unit ? {range:{unit:portion.leaf.unit,start:portion.start,end:portion.end}} : {})});
          }
        } else if (key === 'blocks' && Array.isArray(value)) {
          const children: Record<string,any>[] = [];
          value.forEach((child,index)=>{
            const projected = visit(child,`${childPath}.${index}`,`${outputPath}.${children.length}`);
            if (projected) children.push(projected);
          });
          if (children.length) { result.blocks = children; hasContent = true; }
        } else if (root && isRecord(value) && /^(top|middle|bottom|left|center|right)([+:]|$)/.test(key)) {
          const child = visit(value,childPath,outputPath);
          if (child) { result[key] = child; hasContent = true; }
        } else if (!contentFields.has(key)) result[key] = clone(value);
      }
      return root || hasContent ? result : undefined;
    };
    const slide = visit(source,sourceBase,`slides.${sourceIndex+pageIndex}`,true)!;
    if (pageIndex > 0) delete slide.notes;
    return {slide,mappings};
  };
  const diagnosticsFor = (portions: Map<string,Portion>) => geometry(project(portions,slides.length).slide,slides.length).diagnostics;
  const finish = () => {
    if (!selected.size) return;
    if (slides.length >= maxSlides) throw new OPFPaginationError(`Pagination needs more than ${maxSlides} slides. No partial result was returned.`);
    const {slide,mappings} = project(selected,slides.length);
    const issues = geometry(slide,slides.length).diagnostics;
    if (issues.length) throw new OPFPaginationError('A continuation page does not fit at its final page number. No partial result was returned.',issues);
    if (slides.length && typeof source.id === 'string') {
      let suffix = slides.length+1, id = `${source.id}--${suffix}`;
      while (reservedIds.has(id)) id = `${source.id}--${++suffix}`;
      slide.id = id; reservedIds.add(id);
    }
    assertValidPresentation({slides:[slide]});
    slides.push(slide); pages.push({slideIndex:sourceIndex+slides.length-1,mappings,...(initial.furniture?{repeatedMappings:repeatedMappings(slides.length-1)}:{})});
    selected = new Map();
  };
  for (const leaf of leaves) {
    const boundaries = leaf.boundaries ?? [0,1];
    const end = boundaries.at(-1)!;
    let start = 0;
    // Retry the same leaf after flushing an earlier page, even when its body range is
    // empty: a quote can still carry an attribution/source that must not disappear.
    while (true) {
      const make = (limit: number): Portion => ({leaf,start,end:limit,value:leaf.slice ? leaf.slice(start,limit) : leaf.value});
      let candidate = new Map(selected).set(leaf.path,make(end));
      let issues = diagnosticsFor(candidate);
      if (!issues.length) { selected = candidate; break; }
      let best = start;
      if (leaf.slice && end > start) {
        let low = boundaries.findIndex(value=>value>start), high = boundaries.length-2;
        while (low <= high) {
          const mid = Math.floor((low+high)/2), limit = boundaries[mid]!;
          candidate = new Map(selected).set(leaf.path,make(limit));
          if (!diagnosticsFor(candidate).length) {best=limit;low=mid+1;} else high=mid-1;
        }
        // Prefer a whitespace boundary when possible without changing source bytes.
        if (best>start && leaf.unit==='utf16' && leaf.field!=='code') {
          const text=textOf(leaf.field==='quote' ? (typeof leaf.value==='string'?leaf.value:leaf.value.text) : leaf.value);
          const prefix=text.slice(start,best);
          const sentences=[...prefix.matchAll(/[.!?][”"')]*\s+|\n\s*\n/gu)];
          const lastSentence=sentences.at(-1);
          const sentenceEnd=lastSentence ? start+lastSentence.index!+lastSentence[0].length : start;
          const match=/\s+\S*$/u.exec(prefix);
          const wordEnd=match ? start+match.index+match[0].length-match[0].trimStart().length : best;
          const preferred=sentenceEnd>start+(best-start)*0.6 ? sentenceEnd : wordEnd;
          if (preferred>start && boundaries.includes(preferred) && !diagnosticsFor(new Map(selected).set(leaf.path,make(preferred))).length) best=preferred;
        }
      }
      if (best>start) { selected.set(leaf.path,make(best)); finish(); start=best; }
      else if (selected.size) finish();
      else throw new OPFPaginationError(`Content at ${leaf.path} cannot fit on an otherwise empty slide. Change its layout or split an atomic item.`,issues);
    }
  }
  finish();
  if (!slides.length) throw new OPFPaginationError('No body content can be paginated.', initial.diagnostics);
  return {slides,pages};
}

export interface PresentationPaginationOptions {
  textMeasurement?: TextMeasurement;
  /** Unscaled reference-pixel clearance for supplied vector text outlines. */
  textRasterPadding?: number;
  minFontSize?: number;
  maxSlides?: number;
  /** Optional host-resolved layout/canvas overrides for each source slide. */
  slideOptions?: (slide: Record<string, any>, index: number) => ComposeSlideOptions;
}
export interface PresentationPaginationResult {
  presentation: Record<string, any>;
  pages: (PaginatedPage & { sourceSlideIndex: number })[];
}

/** Resolve local catalogs and paginate a complete presentation without mutating it. */
export function paginatePresentation(input: unknown, options: PresentationPaginationOptions = {}): PresentationPaginationResult {
  assertValidPresentation(input);
  const presentation = clone(input) as Record<string, any>;
  const maxSlides = options.maxSlides ?? 100;
  if (!Number.isInteger(maxSlides) || maxSlides < 1 || maxSlides > 10000) throw new RangeError('maxSlides must be an integer between 1 and 10000.');
  const output: Record<string, any>[] = [], pages: PresentationPaginationResult['pages'] = [];
  const reservedIds = presentation.slides.map((slide: any)=>slide.id).filter(Boolean);
  const resolve = (kind: 'layouts' | 'themes' | 'fontSchemes', id: string) => presentation.catalogs?.[kind]?.records?.find((record: any)=>record.id===id) ?? catalogs[kind].find(record=>record.id===id);
  presentation.slides.forEach((slide: Record<string,any>, index: number) => {
    const overrides = options.slideOptions?.(slide,index) ?? {};
    const layout = overrides.layout ?? (slide.layout ? resolve('layouts',slide.layout) : undefined);
    if (slide.layout && !layout) throw new OPFPaginationError(`Layout '${slide.layout}' must be supplied inline or resolved by the host before pagination.`);
    const design = {...presentation.design,...slide.design};
    const reference = design.theme ?? 'minimal';
    const theme = typeof reference==='string' ? resolve('themes',reference) : {...resolve('themes',reference.id),...reference};
    if (!theme) throw new OPFPaginationError(`Theme '${reference}' must be supplied inline before pagination.`);
    if (output.length>=maxSlides) throw new OPFPaginationError(`Pagination needs more than ${maxSlides} slides. No partial result was returned.`);
    const fontReference = design.fontScheme ?? theme.fontScheme ?? "roboto";
    const fontScheme = typeof fontReference === "string" ? resolve("fontSchemes",fontReference) : {...resolve("fontSchemes",fontReference.id),...fontReference};
    const fonts = resolveFontFamilies(fontScheme);
    const result = paginateSlide(slide,{...resolveCanvasDimensions(design.dimensions ?? theme.dimensions),layout,fonts,contentAlignment:design.contentAlignment,titleAlignment:design.titleAlignment,contentBox:design.contentBox,textMeasurement:options.textMeasurement,textRasterPadding:options.textRasterPadding,...overrides,presentation,slideIndex:index,slideNumber:output.length+1,maxSlides:maxSlides-output.length,minFontSize:options.minFontSize,reservedIds});
    const outputStart = output.length;
    result.pages.forEach((page,pageIndex)=>{
      const remap=(mapping:PaginationMapping)=>({...mapping,outputPath:mapping.outputPath.replace(/^slides\.\d+/,`slides.${outputStart+pageIndex}`)});
      pages.push({sourceSlideIndex:index,slideIndex:outputStart+pageIndex,mappings:page.mappings.map(remap),...(page.repeatedMappings?{repeatedMappings:page.repeatedMappings.map(remap)}:{})});
    });
    output.push(...result.slides);
    reservedIds.push(...result.slides.map(slide=>slide.id).filter(Boolean));
  });
  presentation.slides=output;
  assertValidPresentation(presentation);
  return {presentation,pages};
}
