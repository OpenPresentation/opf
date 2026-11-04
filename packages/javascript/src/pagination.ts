import { codeHighlightSlice } from './code-highlight.js';
import {tableRowBoundaries} from './table.js';
import { composeSlide, OPFCompositionError, type ComposeSlideOptions, type Fonts, type LayoutDiagnostic, type SlideComposition } from './composition.js';
import { checkCatalogsOption, type Catalog, type CatalogOptions } from './catalog-refs.js';
import { resolveSlideContext, type SlideContextDiagnostic } from './slide-context.js';
import { resolveDrawnFontFamilies } from './drawn-font-families.js';
import { resolveSlideScriptMeasurement } from './script-measurement.js';
import { visitContentPayloads } from './content-walk.js';
import { assertValid } from './validator.js';
import { sliceNumberedItems } from './numbering.js';
import { regionAccepts } from './bind-regions.js';
import { resolveSlideVariables, slideTokenSpans, usesSlideBuiltin } from './slide-variables.js';

export interface PaginationOptions extends Omit<ComposeSlideOptions, 'textMeasurement'> {
  /**
   * The fonts handle: page breaks are chosen with its `textMeasurement`. Without it core uses its portable estimate. With
   * `presentation`, a measurement that plans scripts (`forScripts`) measures each script run in the slide's script fonts,
   * as the engines do.
   */
  fonts?: Fonts;
  /** Registered catalogs, for resolving the slide's script fonts when `presentation` is given. `paginate` passes its own. */
  catalogs?: readonly Catalog[];
  /**
   * Readability floor used while choosing page breaks. Default 24 reference pixels; with `wholeBlocks`, the slide's own floor
   * (its `composition.minFontSize`, its layout's, else 16), and the pages keep the slide's composition as authored.
   */
  minFontSize?: number;
  /**
   * LH-90: break only between the slide's block units (`blockUnits`: a lead block and the blocks that follow it; each root block
   * alone when the slide has none), never inside one, over the fewest pages that hold them, with the units spread evenly over
   * those pages when every page still fits (eight timelines that fit five to a page are four and four, not five and three).
   * The slide is composed first as the engines draw it: a strict (`overflow: "error"`) composition throws its
   * `OPFCompositionError`, and a slide with no `text-overflow` or `small-cell` is returned unchanged. A unit that overflows on a
   * page of its own throws `OPFPaginationError`.
   */
  wholeBlocks?: boolean;
  /** All-or-nothing resource limit. Defaults to 100 output slides. */
  maxSlides?: number;
  /** Existing slide and content payload IDs to avoid when generating continuation IDs. */
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
/** Every id a slide contributes to the document namespace: its own and its payloads'. */
const slideIds = (slide: Record<string, unknown>): string[] => {
  const ids = typeof slide.id === 'string' ? [slide.id] : [];
  visitContentPayloads(slide, '', payload => { if (typeof payload.id === 'string') ids.push(payload.id); });
  return ids;
};
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
/**
 * LH-128: the offsets just after each sentence end of a text (a stop, question or exclamation mark with any closing quote or bracket
 * and the space after it, or a blank line). A list marker at the start of a sentence ("2. ", "b. ") is not a sentence of its own.
 */
function sentenceEnds(text: string): number[] {
  const ends: number[] = [];
  let from = 0;
  for (const match of text.matchAll(/[.!?][”"')]*\s+|\n\s*\n/gu)) {
    if (/^(\d{1,3}|\p{L})$/u.test(text.slice(from, match.index).trim())) continue;
    ends.push(match.index + match[0].length);
    from = match.index + match[0].length;
  }
  return ends;
}
/** The deck-level fields a single slide needs to validate: the references it cites and the datasets it plots. */
const deckContext = (presentation: unknown): Record<string, unknown> => {
  const deck = isRecord(presentation) ? presentation : {};
  return {...(Array.isArray(deck.references)?{references:deck.references}:{}),...(isRecord(deck.datasets)?{datasets:deck.datasets}:{})};
};
interface Leaf {
  path: string; field: string; value: any;
  boundaries?: number[]; unit?: 'utf16' | 'items';
  slice?: (start: number, end: number) => any;
}
interface Portion { leaf: Leaf; start: number; end: number; value: any }
/** Drop text boundaries that fall inside a slide-scoped token, so a page break never cuts `{{slide.number}}`. */
function keepTokensWhole(boundaries: number[], text: string): number[] {
  const spans = slideTokenSpans(text);
  return spans.length ? boundaries.filter(boundary => !spans.some(([start,end]) => boundary > start && boundary < end)) : boundaries;
}
function leafFor(path: string, field: string, value: any): Leaf {
  const leaf: Leaf = { path, field, value };
  let text: string | undefined;
  if (field === 'text') { text = textOf(value); leaf.slice = (a,b) => sliceRichText(value,a,b); }
  if (field === 'code' || field === 'quote') {
    const key = field === 'code' ? 'source' : 'text';
    // A quote text may be TextRun[] (FA-10): it slices like body text, keeping each run's formatting.
    text = typeof value === 'string' ? value : field === 'quote' ? textOf(value[key]) : value[key];
    leaf.slice = (a,b) => {
      if (typeof value === 'string') return value.slice(a,b);
      const piece: Record<string, any> = { ...value, [key]: field === 'quote' ? sliceRichText(value[key],a,b) : text!.slice(a,b) };
      // code.highlight lines are numbered per code block: a page keeps the marked lines it holds, renumbered from 1.
      if (field === 'code' && value.highlight !== undefined) {
        const highlight = codeHighlightSlice(value.highlight, text!, a, b);
        if (highlight) piece.highlight = highlight; else delete piece.highlight;
      }
      return piece;
    };
  }
  if (text !== undefined) {
    leaf.unit = 'utf16';
    leaf.boundaries = keepTokensWhole([0, ...Array.from(graphemes.segment(text), segment => segment.index + segment.segment.length)], text);
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

/**
 * LH-144: the largest size a composed slide draws for each kind of body block, in reference pixels: a paragraph's or list's text
 * (`text`, `list`), a quote's, metric's or timeline's largest part. Tables, code and charts are not capped (composition.maxFontSize).
 */
function bodySizes(composed: SlideComposition): Map<string, number> {
  const scale = Math.min(composed.width, composed.height) / 720, sizes = new Map<string, number>();
  const add = (kind: string, size: number | undefined) => { if (size !== undefined && Number.isFinite(size) && size > 0) sizes.set(kind, Math.max(sizes.get(kind) ?? 0, Math.round(size / scale * 100) / 100)); };
  for (const item of composed.items) {
    if (headingFields.has(item.field) || item.eyebrow) continue;
    const layout = item.quoteLayout ?? item.metricLayout ?? item.timelineLayout;
    if (layout) add(item.field, Math.max(0, ...(layout.parts as readonly { fit?: { fontSize: number }; visible?: boolean }[]).flatMap(part => part.visible === false || !part.fit ? [] : [part.fit.fontSize])));
    else if (item.text && !item.codeLayout && (item.field === 'text' || item.field === 'items' || item.field === 'bullets')) add(item.field === 'text' ? 'text' : 'list', item.text.fontSize);
  }
  return sizes;
}

/** Explicit, lossless authoring transform. It never changes slide count during rendering. */
export function paginateSlide(input: unknown, options: PaginationOptions = {}): PaginationResult {
  // RR-34: a slide that cites references validates only with the deck's references list (RR-54: and its datasets).
  assertValid({...deckContext(options.presentation),slides:[input]}, { only: ['format'] });
  let source = clone(input) as Record<string, any>;
  const maxSlides = options.maxSlides ?? 100;
  if (!Number.isInteger(maxSlides) || maxSlides < 1 || maxSlides > 10000) throw new RangeError('maxSlides must be an integer between 1 and 10000.');
  const minFontSize = options.minFontSize ?? (options.wholeBlocks ? undefined : 24);
  if (minFontSize !== undefined && (!Number.isFinite(minFontSize) || minFontSize < 8 || minFontSize > 32)) throw new RangeError("Pagination minFontSize must be between 8 and 32.");
  const sourceIndex = options.slideIndex ?? 0, sourceBase = `slides.${sourceIndex}`;
  const withReadability = (slide: Record<string, any>, warn = false): Record<string, any> => {
    const result = clone(slide);
    const rootMinimum = Math.max(minFontSize ?? 0,result.composition?.minFontSize ?? (options.layout?.composition as any)?.minFontSize ?? 16);
    result.composition = {...result.composition,minFontSize:rootMinimum};
    const visit = (node: Record<string, any>, inheritedMinimum: number) => {
      const minimum = Math.max(minFontSize ?? 0,node.composition?.minFontSize ?? inheritedMinimum);
      if (node.composition) node.composition = { ...node.composition, minFontSize:minimum, ...(warn?{overflow:'warn'}:{}) };
      if (Array.isArray(node.blocks)) node.blocks.forEach(child=>{ visit(child,minimum); });
    };
    visit(result,rootMinimum);
    for (const [key,value] of Object.entries(result)) if (isRecord(value) && /^(top|middle|bottom|left|center|right)([+:]|$)/.test(key)) visit(value,rootMinimum);
    return result;
  };
  // Persist the evaluated readability policy in the ordinary returned slides. Otherwise a
  // footer measured at 24px during pagination would render at its old 17px nominal size. At the slide's own floor
  // (`wholeBlocks` without `minFontSize`) the pages are drawn as the slide was, so they keep its composition as authored.
  if (minFontSize !== undefined) source = withReadability(source);
  let evaluations = 0;
  const {fonts,catalogs,minFontSize:_minFontSize,maxSlides:_maxSlides,reservedIds:_reservedIds,...engineOptions} = options;
  // opf#485: measure script runs in the slide's script fonts, as the renderer and the exporter do.
  const textMeasurement = fonts?.textMeasurement && options.presentation !== undefined ? resolveSlideScriptMeasurement(options.presentation, sourceIndex, fonts.textMeasurement, {...(catalogs!==undefined?{catalogs}:{}),...(options.fontFamilies?{fontFamilies:options.fontFamilies}:{})}) : fonts?.textMeasurement;
  // WI-1 (P24): the role families the renderer draws, so pages break where the drawn slide overflows.
  const composeOptions: ComposeSlideOptions = {...engineOptions,...(textMeasurement?{textMeasurement}:{}),...(textMeasurement&&engineOptions.fontFamilies?{fontFamilies:resolveDrawnFontFamilies(engineOptions.fontFamilies,textMeasurement)}:{})};
  // FA-31: pages are measured with the slide-scoped built-ins substituted for their final number and the deck's slide
  // count, but returned with the tokens kept, so the output stays a source document.
  const presentationSlides = options.presentation?.slides;
  const slideCount = options.slideCount ?? (Array.isArray(presentationSlides) && presentationSlides.length ? presentationSlides.length : undefined);
  // RR-71: logo references in the slide resolve for its background, as the engines draw them.
  const logoContext = options.presentation !== undefined ? {presentation: options.presentation, darkBackground: options.darkBackground === true} : {};
  const geometry = (slide: Record<string, any>, pageIndex = 0) => {
    if (++evaluations > 20000) throw new OPFPaginationError('Pagination exceeded its layout evaluation limit. Split the input into smaller sections.');
    const slideNumber = (options.slideNumber??sourceIndex+1)+pageIndex;
    return composeSlide(resolveSlideVariables(withReadability(slide,true),{slideNumber,...(slideCount!==undefined?{slideCount}:{}),...logoContext}), {...composeOptions,slideNumber});
  };
  // LH-90: a whole-block split acts only on a slide the engines draw overflowing; a strict composition fails here as it does there.
  if (options.wholeBlocks) {
    const slideNumber = options.slideNumber ?? sourceIndex+1;
    const drawn = composeSlide(resolveSlideVariables(source,{slideNumber,...(slideCount!==undefined?{slideCount}:{}),...logoContext}), {...composeOptions,slideNumber});
    if (!drawn.diagnostics.some(issue => issue.code === 'text-overflow' || issue.code === 'small-cell')) return {slides:[source],pages:[{slideIndex:sourceIndex,mappings:drawn.items.map(item=>({sourcePath:item.path,outputPath:item.path}))}]};
  }
  const initial = geometry(source);
  // Only fit diagnostics (and anything from the repeated furniture) drive pagination. Design-level
  // notices such as unresolved-content for listBullet: "image" without a logo, or an unsupported
  // image treatment, never clear by splitting content; hosts report them from their own
  // composition and the pages keep the source design.
  // OPF 0.19: a block no region had room for (layout-unplaced) moves to a continuation slide, where a region of the same
  // layout can take it. A block that no region of the layout accepts and that has no overflow region to go to is drawn
  // below the grid on every page, so it never drives a split.
  const movable = (issue: LayoutDiagnostic): boolean => {
    if (issue.region !== undefined) return true;
    const match = /^slides\.\d+\.blocks\.(\d+)$/.exec(issue.path);
    const block = match && Array.isArray(source.blocks) ? source.blocks[Number(match[1])] : undefined;
    return block !== undefined && (initial.regions ?? []).some(region => regionAccepts(region, block));
  };
  const fit = (diagnostics: LayoutDiagnostic[]) => diagnostics.filter(issue => issue.code === 'text-overflow' || issue.code === 'small-cell' || (issue.code === 'layout-unplaced' && movable(issue)) || !!initial.furniture?.diagnostics.includes(issue));
  // The region each root block of a template slide was drawn in, by block index: a moved block keeps it as a pin.
  const regionOfBlock = new Map<number, { name: string; accepts: readonly string[] }>();
  for (const region of initial.regions ?? []) for (const content of [...region.content, ...(region.overflow ?? [])]) {
    const match = /\.blocks\.(\d+)$/.exec(content);
    if (match) regionOfBlock.set(Number(match[1]), { name: region.name, accepts: region.accepts });
  }
  const repeatedMappings = (pageIndex: number): PaginationMapping[] => {
    if(!initial.furniture)return [];
    const paths = new Set(initial.items.filter(item=>headingFields.has(item.field)).map(item=>item.path));
    for (const part of initial.furniture?.parts??[]) { paths.add(part.path); if(part.sourcePath) paths.add(part.sourcePath); }
    return [...paths].map(sourcePath=>({sourcePath,outputPath:sourcePath.startsWith(`${sourceBase}.`)?`slides.${sourceIndex+pageIndex}${sourcePath.slice(sourceBase.length)}`:sourcePath}));
  };
  if (!fit(initial.diagnostics).length) return { slides:[source], pages:[{slideIndex:sourceIndex,mappings:initial.items.map(item=>({sourcePath:item.path,outputPath:item.path})),...(initial.furniture?{repeatedMappings:repeatedMappings(0)}:{})}] };
  const headerIssues = initial.diagnostics.filter(issue=>headingFields.has(issue.path.slice(sourceBase.length+1))||initial.furniture?.diagnostics.includes(issue));
  if (headerIssues.length) throw new OPFPaginationError('Repeated headings or header/footer content cannot fit or resolve. Change the repeated content or slide design before pagination.',headerIssues);
  // A slide with slide-scoped tokens is measured substituted: split its own (token) values, so pages keep the tokens.
  const tokens = resolveSlideVariables(source,{slideNumber:1,slideCount:1,...logoContext}) !== source;
  const sourceValue = (path: string, fallback: unknown): unknown => {
    if (!tokens || !path.startsWith(`${sourceBase}.`)) return fallback;
    let node: unknown = source;
    for (const key of path.slice(sourceBase.length+1).split('.')) node = isRecord(node) || Array.isArray(node) ? (node as any)[key] : undefined;
    return node === undefined ? fallback : node;
  };
  // A template slide draws its regions in reading order; its blocks still move to continuations in source order.
  const blockIndex = (path: string) => { const match = /^slides\.\d+\.blocks\.(\d+)/.exec(path); return match ? Number(match[1]) : -1; };
  const bodyItems = initial.items.filter(item=>!headingFields.has(item.field));
  if (initial.regions) bodyItems.sort((a,b)=>blockIndex(a.path)-blockIndex(b.path));
  const leaves = bodyItems.map(item=>leafFor(item.path,item.field,sourceValue(item.path,item.value)));
  const leafPaths = new Set(leaves.map(leaf=>leaf.path));
  const slides: Record<string, any>[] = [], pages: PaginatedPage[] = [];
  let selected = new Map<string,Portion>();
  const reservedIds = new Set(options.reservedIds ?? []);
  for (const id of slideIds(source)) reservedIds.add(id);
  // Slide and payload ids share one document namespace, so a projected page
  // keeps an id the first time it emits it and takes a unique '--N' suffix for
  // every repeat. Otherwise a continuation page would clone the ids of page 1.
  const emittedIds = new Set<string>();
  const pageId = (base: string, pageIndex: number): string => {
    if (!emittedIds.has(base)) { emittedIds.add(base); return base; }
    let suffix = pageIndex+1, id = `${base}--${suffix}`;
    while (reservedIds.has(id)) id = `${base}--${++suffix}`;
    reservedIds.add(id); emittedIds.add(id); return id;
  };
  const assignPageIds = (slide: Record<string,unknown>, pageIndex: number) => {
    const assign = (node: Record<string,unknown>) => { if (typeof node.id === 'string') node.id = pageId(node.id,pageIndex); };
    assign(slide);
    visitContentPayloads(slide,'',assign);
  };

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
            // A continuation of a numbered list keeps the numbers of the whole list.
            result[key] = clone(portion.leaf.unit === 'items' && portion.start > 0 && (key === 'items' || key === 'bullets') && node.numbering !== undefined
              ? sliceNumberedItems(portion.leaf.value, node.numbering, portion.start, portion.end) : portion.value);
            hasContent = true;
            mappings.push({sourcePath:childPath,outputPath,...(portion.leaf.unit ? {range:{unit:portion.leaf.unit,start:portion.start,end:portion.end}} : {})});
          }
        } else if (key === 'blocks' && Array.isArray(value)) {
          const children: Record<string,any>[] = [];
          value.forEach((child,index)=>{
            const projected = visit(child,`${childPath}.${index}`,`${outputPath}.${children.length}`);
            if (!projected) return;
            // OPF 0.19: a root block moved to a continuation slide keeps the region it was drawn in, as a pin. A whole-block page (LH-90)
            // is bound by the layout as the first page is, so every page composes alike (a pin would also keep it from recomposing).
            const region = root && pageIndex > 0 && !options.wholeBlocks && projected.region === undefined ? regionOfBlock.get(index) : undefined;
            if (region && regionAccepts(region, projected)) projected.region = region.name;
            children.push(projected);
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
  const diagnosticsFor = (portions: Map<string,Portion>) => fit(geometry(project(portions,slides.length).slide,slides.length).diagnostics);
  // LH-144: the largest body size the first page draws for each kind of block (reference pixels). A later page is capped at the largest of
  // these for the kinds it holds (composition.maxFontSize), so a last page with one timeline, list or paragraph does not read larger than
  // the pages before it. A cap only lowers sizes, so a page that fits without it fits with it; breaks are chosen without it.
  let firstSizes: Map<string, number> | undefined;
  const kindOf = (field: string) => field === 'items' || field === 'bullets' ? 'list' : field;
  const finish = () => {
    if (!selected.size) return;
    if (slides.length >= maxSlides) throw new OPFPaginationError(`Pagination needs more than ${maxSlides} slides. No partial result was returned.`);
    const {slide,mappings} = project(selected,slides.length);
    const cap = firstSizes && Math.max(0, ...[...selected.values()].map(portion => firstSizes!.get(kindOf(portion.leaf.field)) ?? 0));
    if (cap) slide.composition = {...slide.composition, maxFontSize: Math.min(Math.max(8, cap), 200, slide.composition?.maxFontSize ?? Infinity)};
    const drawn = geometry(slide,slides.length), issues = fit(drawn.diagnostics);
    if (!firstSizes) firstSizes = bodySizes(drawn);
    if (issues.length) throw new OPFPaginationError('A continuation page does not fit at its final page number. No partial result was returned.',issues);
    assignPageIds(slide,slides.length);
    // RR-34: a page that cites references validates only with the deck's references list (RR-54: and its datasets).
    assertValid({...deckContext(options.presentation),slides:[slide]}, { only: ['format'] });
    slides.push(slide); pages.push({slideIndex:sourceIndex+slides.length-1,mappings,...(initial.furniture?{repeatedMappings:repeatedMappings(slides.length-1)}:{})});
    selected = new Map();
  };
  if (options.wholeBlocks) {
    // LH-90: a page holds a run of whole units, each with all of its leaves: the slide's block units (a lead block and the
    // blocks that follow it, `blockUnits`), else each root block alone.
    const unitOf = new Map<number, number>();
    for (const [unit,indices] of (blockUnits(source)?.units ?? []).entries()) for (const index of indices) unitOf.set(index,unit);
    const units: Leaf[][] = [];
    let previous: number | undefined;
    for (const leaf of leaves) {
      const index = blockIndex(leaf.path);
      if (index < 0) throw new OPFPaginationError(`Content at ${leaf.path} is not in a root block; a whole-block split moves root blocks only.`, initial.diagnostics);
      const unit = unitOf.get(index) ?? -1-index;
      if (units.length && unit === previous) units.at(-1)!.push(leaf); else units.push([leaf]);
      previous = unit;
    }
    const portions = (from: number, to: number) => new Map(units.slice(from,to).flat().map(leaf=>[leaf.path,{leaf,start:0,end:(leaf.boundaries ?? [0,1]).at(-1)!,value:leaf.value} as Portion]));
    const issuesOf = (from: number, to: number, pageIndex: number) => fit(geometry(project(portions(from,to),pageIndex).slide,pageIndex).diagnostics);
    // The fewest pages: each page takes as many of the next blocks as fit.
    const greedy: [number,number][] = [];
    for (let start = 0; start < units.length;) {
      const alone = issuesOf(start,start+1,greedy.length);
      if (alone.length) throw new OPFPaginationError(`The block at ${units[start]![0]!.path} cannot fit on an otherwise empty slide.`,alone);
      let end = start+1;
      while (end < units.length && !issuesOf(start,end+1,greedy.length).length) end++;
      greedy.push([start,end]); start = end;
    }
    // The same number of pages with the blocks spread evenly (the earlier pages take the remainder), when every page fits.
    const count = greedy.length, base = Math.floor(units.length/count), extra = units.length%count;
    const balanced = Array.from({length:count},(_,page)=>{ const start = page*base+Math.min(page,extra); return [start,start+base+(page<extra?1:0)] as [number,number]; });
    const ranges = balanced.every(([from,to],page)=>!issuesOf(from,to,page).length) ? balanced : greedy;
    for (const [from,to] of ranges) { selected = portions(from,to); finish(); }
    return {slides,pages};
  }
  for (const leaf of leaves) {
    const boundaries = leaf.boundaries ?? [0,1];
    const end = boundaries.at(-1)!;
    let start = 0;
    // Retry the same leaf after flushing an earlier page, even when its body range is
    // empty: a quote can still carry an attribution/source that must not disappear.
    while (true) {
      const make = (limit: number): Portion => ({leaf,start,end:limit,value:leaf.slice ? leaf.slice(start,limit) : leaf.value});
      let candidate = new Map(selected).set(leaf.path,make(end));
      const issues = diagnosticsFor(candidate);
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
          const ends=sentenceEnds(text), sentenceEnd=ends.filter(offset=>offset>start&&offset<=best).at(-1) ?? start;
          const match=/\s+\S*$/u.exec(prefix);
          const wordEnd=match ? start+match.index+match[0].length-match[0].trimStart().length : best;
          // LH-128: a page ends at the last sentence end that fits, wherever it falls: a page that ends inside a sentence leaves the rest of
          // it to the next page as a fragment ("twenty."). When not even the first sentence fits beside what the page holds, it moves whole
          // to the next page if it fits a page alone; it is split inside only when no page can hold it.
          const stop=ends.find(offset=>offset>start) ?? end;
          if (sentenceEnd<=start && selected.size && boundaries.includes(stop) && !diagnosticsFor(new Map().set(leaf.path,make(stop))).length) best=start;
          else {
            const preferred=sentenceEnd>start ? sentenceEnd : wordEnd;
            if (preferred>start && boundaries.includes(preferred) && !diagnosticsFor(new Map(selected).set(leaf.path,make(preferred))).length) best=preferred;
          }
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

export interface PresentationPaginationOptions extends CatalogOptions {
  /** The fonts handle: page breaks are chosen with its `textMeasurement`. Without it core uses its portable estimate. */
  fonts?: Fonts;
  /** Unscaled reference-pixel clearance for supplied vector text outlines. */
  textRasterPadding?: number;
  minFontSize?: number;
  maxSlides?: number;
  /** Host-supplied current calendar date (ISO YYYY-MM-DD) for `date: true` header/footer fields. */
  date?: string;
  /** Throw OPFUnresolvedReferenceError for a reference that resolves nowhere, instead of falling back (strict export). */
  strictReferences?: boolean;
  /** Receives each `unresolved-reference` diagnostic once per reference path; pagination continues with the fallback. */
  onDiagnostic?: (diagnostic: SlideContextDiagnostic) => void;
}
export interface PresentationPaginationResult {
  presentation: Record<string, any>;
  pages: (PaginatedPage & { sourceSlideIndex: number })[];
  /** How the page breaks were chosen: `measured` with the `fonts` handle's text measurement, `estimated` with core's portable estimate (no `fonts`). */
  layout: 'measured' | 'estimated';
}


/** Resolve the slides' references (the document's catalogs groups, then the registered catalogs) and paginate a complete presentation without mutating it. */
export function paginate(input: unknown, options: PresentationPaginationOptions = {}): PresentationPaginationResult {
  const {presentation,pages} = paginateSlides(input,options,'paginate',options.maxSlides ?? 100,(slide,slideOptions)=>paginateSlide(slide,slideOptions));
  return {presentation,pages,layout:options.fonts?'measured':'estimated'};
}

/** LH-90: one slide that `continueOverfull` continues on further slides. */
export interface ContinuedSlide {
  /** The slide's index in the input presentation. */
  sourceSlideIndex: number;
  /** The index of each of its pages in the output presentation, in order. */
  slideIndices: number[];
  /** The lead kind of its block units (`blockUnits`): `timeline`, `table`, `text`, ... */
  kind: string;
  /** The input indices of the root blocks each page holds, in order. */
  blocks: number[][];
  /** How many block units (lead blocks) each page holds. */
  units: number[];
  /** Each page's mapping, as `paginate` returns it, with output paths. */
  pages: (PaginatedPage & { sourceSlideIndex: number })[];
}
export interface ContinuationResult {
  /** The presentation to draw: the input with each continued slide replaced by its pages. */
  presentation: Record<string, any>;
  /** The slides that were continued, in order; empty when the slide count did not change. */
  continued: ContinuedSlide[];
  /** How the breaks were chosen, as in `paginate`. */
  layout: 'measured' | 'estimated';
}

const promotedKey = /^(top|middle|bottom|left|center|right)([+:]|$)/;
/**
 * LH-90: the root blocks of a slide as the units a whole-block split keeps together, or undefined. Every root block must be one
 * payload (no nested group) and the slide must hold nothing else to move (no root payload, no promoted region). A unit starts at
 * each block of the first block's kind (`kind`, the lead kind) and takes the blocks after it up to the next one, so eight
 * timelines are eight units and a timeline keeps the note that follows it. A slide needs two or more units.
 */
export function blockUnits(slide: unknown): { kind: string; units: number[][] } | undefined {
  if (!isRecord(slide) || !Array.isArray(slide.blocks) || slide.blocks.length < 2) return undefined;
  if (Object.keys(slide).some(key => contentFields.has(key) || promotedKey.test(key))) return undefined;
  const kinds: string[] = [];
  for (const block of slide.blocks) {
    const fields = isRecord(block) && !Array.isArray(block.blocks) ? Object.keys(block).filter(key => contentFields.has(key)) : [];
    if (fields.length !== 1) return undefined;
    kinds.push(fields[0]!);
  }
  const kind = kinds[0]!, units: number[][] = [];
  kinds.forEach((blockKind,index)=>{ if (blockKind === kind) units.push([index]); else units.at(-1)!.push(index); });
  return units.length >= 2 ? {kind,units} : undefined;
}

/**
 * LH-90: the deck an export draws. A slide of two or more block units (`blockUnits`: sibling blocks of one kind, each with the
 * blocks that follow it) that the engines draw overflowing (`text-overflow` or `small-cell` at its own readability floor)
 * continues on further slides, split between whole units (`paginateSlide` with `wholeBlocks`): the fewest pages that fit, the blocks spread evenly, each page with the slide's
 * headings, layout and design (pagination's convention), speaker notes on the first. Every other slide is kept as it is, and so
 * is a slide whose blocks do not fit even one to a page, or whose composition is strict (`overflow: "error"`), which the engines
 * still refuse. Content is never dropped, and `continued` lists every slide the split changed, so a host can report the new
 * slide count.
 */
export function continueOverfull(input: unknown, options: PresentationPaginationOptions = {}): ContinuationResult {
  const layout = options.fonts ? 'measured' : 'estimated';
  const found = new Map<number, { kind: string; units: number[][] }>();
  let result: ReturnType<typeof paginateSlides>;
  try {
    result = paginateSlides(input,options,'continueOverfull',options.maxSlides ?? 10000,(slide,slideOptions,index)=>{
      const units = blockUnits(slide);
      if (!units) return undefined;
      try {
        const split = paginateSlide(slide,{...slideOptions,wholeBlocks:true,minFontSize:options.minFontSize});
        if (split.slides.length < 2) return undefined;
        found.set(index,units);
        return split;
      } catch (error) {
        if (error instanceof OPFPaginationError || error instanceof OPFCompositionError) return undefined;
        throw error;
      }
    });
  } catch (error) {
    // A slide count that does not settle ({{deck.slideCount}} moves the breaks it counts) keeps the deck as written.
    if (error instanceof OPFPaginationError) return {presentation:clone(input) as Record<string, any>,continued:[],layout};
    throw error;
  }
  const continued: ContinuedSlide[] = result.splits.map(({sourceSlideIndex,outputStart,count})=>{
    const pages = result.pages.filter(page=>page.sourceSlideIndex===sourceSlideIndex);
    const blocks = pages.map(page=>[...new Set(page.mappings.map(mapping=>/^slides\.\d+\.blocks\.(\d+)/.exec(mapping.sourcePath)?.[1]).filter((value): value is string=>value!==undefined).map(Number))]);
    const {kind,units} = found.get(sourceSlideIndex)!;
    return {sourceSlideIndex,slideIndices:Array.from({length:count},(_,page)=>outputStart+page),kind,blocks,units:blocks.map(page=>units.filter(unit=>page.includes(unit[0]!)).length),pages};
  });
  return {presentation:result.presentation,continued,layout};
}

/**
 * LH-99: the pages of every source slide in a `continueOverfull` result, for hosts that draw slide by slide (the player, `<opf-deck>`,
 * the editor). `pages[i]` lists the output indices that draw source slide `i`, in order: one for a slide kept as written, two or more
 * for a continued one. A host keeps addressing source slides (numbers, links, selection, `goto`) and steps through a slide's pages
 * as sub-steps, so a continuation never shifts a source index.
 */
export function continuationPages(result: Pick<ContinuationResult, 'continued'>, slideCount: number): number[][] {
  if (!Number.isInteger(slideCount) || slideCount < 0) throw new RangeError('slideCount must be a whole number of source slides.');
  const bySource = new Map(result.continued.map(entry=>[entry.sourceSlideIndex,entry.slideIndices]));
  const pages: number[][] = [];
  // A kept slide moves down by the pages the continued slides before it added.
  let output = 0;
  for (let index = 0; index < slideCount; index++) {
    const indices = bySource.get(index) ?? [output];
    pages.push([...indices]);
    output = indices.at(-1)! + 1;
  }
  return pages;
}

/**
 * The deck loop `paginate` and `continueOverfull` share: each slide is resolved in its context (references, final slide number,
 * the deck's slide count) and passed to `split`, whose pages replace it; `undefined` keeps the slide as it is. `paginate` passes
 * `paginateSlide` itself.
 */
function paginateSlides(input: unknown, options: PresentationPaginationOptions, name: 'paginate' | 'continueOverfull', maxSlides: number, split: (slide: Record<string, any>, slideOptions: PaginationOptions, index: number) => PaginationResult | undefined) {
  checkCatalogsOption(options.catalogs, name);
  assertValid(input, { only: ['format'] });
  const presentation = clone(input) as Record<string, any>;
  if (!Number.isInteger(maxSlides) || maxSlides < 1 || maxSlides > 10000) throw new RangeError('maxSlides must be an integer between 1 and 10000.');
  // Reserve every id already in the document — slide and payload alike — so a
  // generated continuation id can never collide with one an author chose.
  const authoredIds: string[] = presentation.slides.flatMap((slide: Record<string,unknown>)=>slideIds(slide));
  // Outside run(): a slide-count retry must not repeat diagnostics.
  const reported = new Set<string>();
  const run = (slideCount: number) => {
    const output: Record<string, any>[] = [], pages: PresentationPaginationResult['pages'] = [], reservedIds = [...authoredIds];
    const splits: { sourceSlideIndex: number; outputStart: number; count: number }[] = [];
    presentation.slides.forEach((slide: Record<string,any>, index: number) => {
      const context = resolveSlideContext(presentation,index,{slideNumber:output.length+1,slideCount,date:options.date,...(options.catalogs?{catalogs:options.catalogs}:{}),...(options.strictReferences?{strictReferences:true}:{})});
      for (const diagnostic of context.diagnostics) {
        // An unresolved reference falls back (automatic composition, or the engine default record) and is reported once per path.
        const key = `${diagnostic.code}:${diagnostic.path}`;
        if (!reported.has(key)) { reported.add(key); options.onDiagnostic?.(diagnostic); }
      }
      if (output.length>=maxSlides) throw new OPFPaginationError(`Pagination needs more than ${maxSlides} slides. No partial result was returned.`);
      const slideOptions = {...context.options,textRasterPadding:options.textRasterPadding,fonts:options.fonts,...(options.catalogs?{catalogs:options.catalogs}:{}),presentation,slideIndex:index,slideNumber:output.length+1,slideCount,date:options.date,maxSlides:maxSlides-output.length,minFontSize:options.minFontSize,reservedIds} as PaginationOptions;
      const result = split(slide,slideOptions,index);
      if (!result) { output.push(slide); return; }
      const outputStart = output.length;
      if (result.slides.length > 1) splits.push({sourceSlideIndex:index,outputStart,count:result.slides.length});
      result.pages.forEach((page,pageIndex)=>{
        const remap=(mapping:PaginationMapping)=>({...mapping,outputPath:mapping.outputPath.replace(/^slides\.\d+/,`slides.${outputStart+pageIndex}`)});
        pages.push({sourceSlideIndex:index,slideIndex:outputStart+pageIndex,mappings:page.mappings.map(remap),...(page.repeatedMappings?{repeatedMappings:page.repeatedMappings.map(remap)}:{})});
      });
      output.push(...result.slides);
      reservedIds.push(...result.slides.flatMap(slide=>slideIds(slide)));
    });
    return {output,pages,splits};
  };
  // {{deck.slideCount}} anywhere in the deck depends on the final page count, which can in
  // turn depend on the width of that value. Iterate to a bounded fixed point.
  const usesSlideCount = usesSlideBuiltin(presentation, 'deck.slideCount');
  let slideCount = presentation.slides.length, result = run(slideCount);
  for (let attempt = 0; usesSlideCount && result.output.length !== slideCount; attempt++) {
    if (attempt >= 3) throw new OPFPaginationError('The slide count did not converge. Change the text around {{deck.slideCount}} or split the input.');
    slideCount = result.output.length; result = run(slideCount);
  }
  const {output,pages,splits} = result;
  presentation.slides=output;
  assertValid(presentation, { only: ['format'] });
  return {presentation,pages,splits};
}
