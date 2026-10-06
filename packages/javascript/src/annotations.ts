import type { LayoutBox, LayoutDiagnostic, RichTextFit, RichTextRun, TextFit, TextStyle } from './composition.js';

/**
 * Footnotes, citations and captions (RR-34).
 *
 * - A TextRun may `cite` one or more ids of the deck's top-level `references`, or carry an inline
 *   `footnote`. Markers are numbered per deck in reading order of first use (slides: the heading group tag, title, subtitle, then regions,
 *   blocks and runs); the same reference id keeps its number, every footnote takes a new one. A run's
 *   marker is a superscript fragment drawn directly after the run (`1`, or `1,2` for several ids);
 *   `richTextLayouter` emits it from `RichTextOptions.citationMarker`, so it wraps with its word and
 *   never shifts run indexes or source offsets.
 * - A slide that carries markers gets a footnote area directly above the footer band: `layoutFootnotes`
 *   lists `<n> <text>` for the slide's markers in number order, and `composeSlide` shrinks the content
 *   area by exactly its height. Slides without markers are unchanged.
 * - `caption` on an image, chart, table or video payload reserves a caption band inside the block's
 *   region (`layoutCaption`): the media keeps the rest. Captions use the body family at the caption size
 *   (0.6 of the body size, clamped to the readable floor) in the muted text colour.
 *
 * Geometry is shared: renderers and exporters only draw what these functions return.
 */

export type CaptionPosition = 'below' | 'above';
export type CaptionAlignment = 'left' | 'center' | 'right';
export type RichText = string | readonly (string | RichTextRun)[];
export interface CaptionObject { text: RichText; position?: CaptionPosition; align?: CaptionAlignment }
export type Caption = RichText | CaptionObject;
export interface Reference { id: string; text: RichText; url?: string }
export interface CaptionSettings { text: RichText; position: CaptionPosition; align: CaptionAlignment }

/**
 * A marker is exported as a superscript run at the marked run's own size with DrawingML `baseline="30000"`, the way a user ticks
 * Superscript. PowerPoint then draws the glyph at 2/3 of that nominal size and raises it by baseline x nominal size. Measured in
 * PowerPoint 365 on Windows on 2026-10-01 with probe-superscript.pptx (Roboto and Aptos, 10 to 44 pt, digit ink height of a
 * superscript run against a plain run of the same size): ratio 0.655 to 0.69, mean 0.667, independent of face and size; raise
 * 0.30 of the nominal size at every size (baseline 30000). An explicit smaller sz on top is reduced again (0.7 x sz drew at about
 * 0.47 of the run), which is why the exporter does not write one. The preview composes the same glyph size and raise.
 *
 * The drawn marker glyph is this fraction of the nominal size (the marked run's size), snapped to the 0.01 pt grid.
 */
export const CITATION_MARKER_SCALE = 2 / 3;
/** The raise as a fraction of the NOMINAL size (the marked run's size): DrawingML `baseline="30000"`. */
export const CITATION_MARKER_RAISE = 0.3;
/** Caption text size as a fraction of the body size, before the readable floor. */
export const CAPTION_FONT_RATIO = 0.6;
/** A caption band takes at most this fraction of its block region. */
export const CAPTION_MAX_RATIO = 0.35;
/** A footnote area takes at most this fraction of the span between heading top and footer band. */
export const FOOTNOTE_MAX_RATIO = 0.35;
/** Payload fields whose blocks may carry a caption. */
export const CAPTIONABLE_FIELDS: readonly string[] = Object.freeze(['image', 'chart', 'table', 'video']);

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const round = (value: number) => Math.round(value * 1e6) / 1e6 || value;
const regionKey = /^(top|middle|bottom|left|center|right)([+:]|$)/;
const TEXT_FIELDS = ['text', 'items', 'bullets'] as const;
/** Heading fields in reading order (the order composeSlide stacks them); each may be a string or TextRun[]. */
const HEADING_FIELDS = ['tag', 'title', 'subtitle'] as const;

/** Flatten a string or TextRun[] to its plain text. */
export function annotationText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(run => typeof run === 'string' ? run : record(run).text ?? '').join('');
  if (isRecord(value) && value.text !== undefined) return annotationText(value.text);
  return value === undefined || value === null ? '' : String(value);
}

/** Normalize a Caption value to its text, position and alignment. */
export function captionSettings(value: unknown): CaptionSettings | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' || Array.isArray(value)) return { text: value as RichText, position: 'below', align: 'left' };
  if (!isRecord(value) || value.text === undefined) return undefined;
  return { text: value.text as RichText, position: value.position === 'above' ? 'above' : 'below', align: value.align === 'center' || value.align === 'right' ? value.align : 'left' };
}

/** A run that cites or carries a footnote, with its dotted OPF path (`slides.0.blocks.1.text.2`). */
export interface AnnotatedRun { path: string; run: RichTextRun; cite: string[]; footnote?: RichText }

/**
 * Visit every rich-text run of a slide that can carry a citation (the slide tag, title and subtitle, then
 * text, bullets, list item and quote runs), in reading order: the heading group first (tag, title, subtitle),
 * then promoted regions (sorted keys), then blocks (recursively), then the root payload.
 * `basePath` is the slide's dotted path (`slides.3`).
 */
export function walkCitationRuns(slide: unknown, basePath: string, visit: (entry: AnnotatedRun) => void): void {
  const runs = (value: unknown, path: string) => {
    if (!Array.isArray(value)) return;
    value.forEach((run, index) => {
      if (!isRecord(run) || typeof run.text !== 'string') return;
      const cite = run.cite === undefined ? [] : Array.isArray(run.cite) ? run.cite.filter((id: unknown): id is string => typeof id === 'string') : typeof run.cite === 'string' ? [run.cite] : [];
      const footnote = typeof run.footnote === 'string' || Array.isArray(run.footnote) ? run.footnote as RichText : undefined;
      if (!cite.length && footnote === undefined) return;
      visit({ path: `${path}.${index}`, run: run as unknown as RichTextRun, cite, footnote });
    });
  };
  const list = (items: unknown, path: string) => {
    if (!Array.isArray(items)) return;
    items.forEach((item, index) => {
      if (Array.isArray(item)) runs(item, `${path}.${index}`);
      else if (isRecord(item)) { runs(item.text, `${path}.${index}.text`); runs(item.description, `${path}.${index}.description`); }
    });
  };
  const host = (node: unknown, path: string, depth: number): void => {
    const payload = record(node);
    if (Array.isArray(payload.blocks)) {
      if (depth > 32) return;
      payload.blocks.forEach((block: unknown, index: number) => { host(block, `${path}.blocks.${index}`, depth + 1); });
      return;
    }
    for (const field of TEXT_FIELDS) {
      if (payload[field] === undefined) continue;
      if (field === 'text') runs(payload.text, `${path}.text`); else list(payload[field], `${path}.${field}`);
    }
    if (isRecord(payload.quote)) runs(payload.quote.text, `${path}.quote.text`);
  };
  const value = record(slide);
  // The heading group reads first: tag, title, then subtitle (the order composeSlide lays them out), before any body run.
  for (const field of HEADING_FIELDS) runs(value[field], `${basePath}.${field}`);
  const regions = Object.keys(value).filter(key => regionKey.test(key)).sort();
  if (regions.length) { for (const key of regions) host(value[key], `${basePath}.${key}`, 0); return; }
  if (Array.isArray(value.blocks)) { value.blocks.forEach((block: unknown, index: number) => { host(block, `${basePath}.blocks.${index}`, 0); }); return; }
  host(value, basePath, 0);
}

/** One numbered note: a cited reference (by id) or an inline footnote. */
export interface CitationNote {
  number: number;
  kind: 'reference' | 'footnote';
  /** Reference id for `kind: 'reference'`. */
  id?: string;
  /** Note text: the reference text (its id when the references list does not resolve it) or the footnote. */
  text: RichText;
  /** `references.N` for a reference, the marked run's path for a footnote. */
  sourcePath: string;
  url?: string;
  /** False when a cited id has no references entry. */
  resolved: boolean;
}
/** A marked run on a slide and the numbers its marker shows. */
export interface CitationMarker { path: string; numbers: number[]; text: string }
export interface SlideCitations {
  /** Marker text by run path, in reading order. */
  markers: Map<string, string>;
  /** Every marked run on the slide, in reading order. */
  marked: CitationMarker[];
  /** The notes the slide's markers use, in number order (each number once). */
  notes: CitationNote[];
}
export interface DeckCitations {
  /** Every note of the deck in number order. */
  notes: CitationNote[];
  /** Cited references in number order (inline footnotes excluded). */
  references: CitationNote[];
  /** Per slide index. Slides without markers are absent. */
  slides: Map<number, SlideCitations>;
  /** Reference ids no run cites, in references order. */
  unused: string[];
}

/** Marker text for a set of numbers: `1`, or `1,2` for several ids. */
export const citationMarkerText = (numbers: readonly number[]): string => numbers.join(',');

interface Numbering { notes: CitationNote[]; byId: Map<string, CitationNote> }

function referenceList(presentation: unknown): Reference[] {
  const list = record(presentation).references;
  return Array.isArray(list) ? list.filter((item): item is Reference => isRecord(item) && typeof item.id === 'string') : [];
}

function numberSlide(slide: unknown, slideIndex: number, references: readonly Reference[], numbering: Numbering): SlideCitations | undefined {
  const markers = new Map<string, string>(), marked: CitationMarker[] = [], used = new Map<number, CitationNote>();
  walkCitationRuns(slide, `slides.${slideIndex}`, entry => {
    const numbers: number[] = [];
    for (const id of entry.cite) {
      let note = numbering.byId.get(id);
      if (!note) {
        const index = references.findIndex(item => item.id === id), reference = references[index];
        note = { number: numbering.notes.length + 1, kind: 'reference', id, text: reference?.text ?? id, sourcePath: index >= 0 ? `references.${index}` : entry.path, resolved: !!reference, ...(typeof reference?.url === 'string' ? { url: reference.url } : {}) };
        numbering.notes.push(note); numbering.byId.set(id, note);
      }
      if (!numbers.includes(note.number)) numbers.push(note.number);
      used.set(note.number, note);
    }
    if (entry.footnote !== undefined) {
      const note: CitationNote = { number: numbering.notes.length + 1, kind: 'footnote', text: entry.footnote, sourcePath: entry.path, resolved: true };
      numbering.notes.push(note); numbers.push(note.number); used.set(note.number, note);
    }
    const text = citationMarkerText(numbers);
    markers.set(entry.path, text); marked.push({ path: entry.path, numbers, text });
  });
  if (!marked.length) return undefined;
  return { markers, marked, notes: [...used.values()].sort((a, b) => a.number - b.number) };
}

/**
 * Number every marker of a deck in reading order. Slides are read from `presentation.slides`; a
 * hidden slide still takes part so numbers do not change when it is shown.
 */
export function collectCitations(presentation: unknown): DeckCitations {
  const references = referenceList(presentation), numbering: Numbering = { notes: [], byId: new Map() }, slides = new Map<number, SlideCitations>();
  const list = record(presentation).slides;
  if (Array.isArray(list)) list.forEach((slide, index) => { const result = numberSlide(slide, index, references, numbering); if (result) slides.set(index, result); });
  const cited = new Set(numbering.notes.filter(note => note.kind === 'reference').map(note => note.id));
  return { notes: numbering.notes, references: numbering.notes.filter(note => note.kind === 'reference'), slides, unused: references.map(item => item.id).filter(id => !cited.has(id)) };
}

/**
 * Citations of one slide with the deck's numbering: the markers of `presentation.slides[0..slideIndex-1]`
 * are counted first, then the runs of `slide` itself (which may be a paginated page or a copy of the
 * document's slide). Without a presentation the slide's own markers start at 1 and reference texts
 * cannot be resolved (`resolved: false`).
 */
export function slideCitations(slide: unknown, slideIndex: number, presentation?: unknown): SlideCitations | undefined {
  const references = referenceList(presentation), numbering: Numbering = { notes: [], byId: new Map() };
  const list = record(presentation).slides;
  if (Array.isArray(list)) for (let index = 0; index < Math.min(slideIndex, list.length); index += 1) numberSlide(list[index], index, references, numbering);
  return numberSlide(slide, slideIndex, references, numbering);
}

/** Fits a string or TextRun[] into a box at a requested size (composeSlide supplies its placed fitter). */
export type AnnotationFitter = (value: RichText, box: LayoutBox, requestedSize: number, minFontSize: number, path: string, alignment: CaptionAlignment) => TextFit | RichTextFit;
export interface AnnotationLayoutOptions {
  scale: number;
  minFontSize: number;
  fit: AnnotationFitter;
  textStyle: (path: string) => TextStyle;
}

/** A composed caption band inside a block region. */
export interface ComposedCaption {
  /** Dotted path of the caption field (`slides.0.blocks.1.caption`). */
  path: string;
  value: Caption;
  text: RichText;
  position: CaptionPosition;
  alignment: CaptionAlignment;
  /** The caption band. */
  box: LayoutBox;
  /** The media box after the band is reserved; `ComposedItem.box` equals it. */
  mediaBox: LayoutBox;
  fit: TextFit | RichTextFit;
  textStyle: TextStyle;
  fontSize: number;
  overflow: boolean;
  diagnostics: LayoutDiagnostic[];
}

const fitHeight = (fit: TextFit | RichTextFit): number => Math.max(fit.placement?.height ?? 0, 'richLines' in fit ? (fit as RichTextFit).height : fit.lines.length * fit.lineHeight);

/** Reserve a caption band in `box` (the payload box) and return the band and the media box. */
export function layoutCaption(value: unknown, box: LayoutBox, path: string, options: AnnotationLayoutOptions): ComposedCaption | undefined {
  const settings = captionSettings(value);
  if (!settings) return undefined;
  const fontSize = Math.max(options.minFontSize, CAPTION_FONT_RATIO * 25 * options.scale), gap = fontSize * 0.4;
  const maxHeight = Math.max(fontSize * 1.22, box.height * CAPTION_MAX_RATIO);
  const diagnostics: LayoutDiagnostic[] = [];
  const probe = options.fit(settings.text, { x: box.x, y: box.y, width: box.width, height: maxHeight }, fontSize, fontSize, path, settings.align);
  const height = Math.min(maxHeight, Math.max(fontSize * 1.22, fitHeight(probe)));
  const captionBox = { x: box.x, y: settings.position === 'above' ? box.y : box.y + box.height - height, width: box.width, height };
  const fit = options.fit(settings.text, captionBox, fontSize, fontSize, path, settings.align);
  const overflow = fit.overflow || fitHeight(fit) > height + .01;
  if (overflow) diagnostics.push({ code: 'text-overflow', path, message: 'The caption does not fit its band at the minimum font size; shorten it or give the block more space.' });
  const mediaHeight = Math.max(options.scale, box.height - height - gap);
  const mediaBox = { x: box.x, y: settings.position === 'above' ? box.y + height + gap : box.y, width: box.width, height: mediaHeight };
  for (const target of [captionBox, mediaBox]) for (const key of ['x', 'y', 'width', 'height'] as const) target[key] = round(target[key]);
  return { path, value: value as Caption, text: settings.text, position: settings.position, alignment: settings.align, box: captionBox, mediaBox, fit, textStyle: options.textStyle(path), fontSize, overflow, diagnostics };
}

/** One listed note in a slide's footnote area. */
export interface ComposedFootnoteEntry {
  number: number;
  kind: 'reference' | 'footnote';
  id?: string;
  /** `references.N` or the marked run's path. */
  sourcePath: string;
  /** The listed value: `<n> <text>` as a string, or runs starting with the number. */
  value: RichText;
  text: RichText;
  box: LayoutBox;
  fit: TextFit | RichTextFit;
  textStyle: TextStyle;
  url?: string;
  overflow: boolean;
}
/** The footnote area of a slide: a rule, then the slide's notes in number order. */
export interface ComposedFootnotes {
  algorithm: 'footnote-area-v1';
  /** Dotted slide path (`slides.3`). */
  path: string;
  box: LayoutBox;
  /** Thin rule along the top of the area. */
  rule: { x: number; y: number; width: number; thickness: number };
  entries: ComposedFootnoteEntry[];
  /** Marked runs of the slide with their marker text. */
  markers: CitationMarker[];
  fontSize: number;
  overflow: boolean;
  diagnostics: LayoutDiagnostic[];
}
export interface FootnoteLayoutOptions extends AnnotationLayoutOptions {
  /** Left edge and width of the content area. */
  x: number;
  width: number;
  /** The area's bottom edge (the top of the footer band gap). */
  bottom: number;
  /** Largest height the area may take. */
  maxHeight: number;
  /** Slide path for the area (`slides.3`). */
  path: string;
}

/** List a slide's notes in a footnote area whose bottom sits at `options.bottom`. */
export function layoutFootnotes(citations: SlideCitations, options: FootnoteLayoutOptions): ComposedFootnotes {
  const fontSize = Math.max(options.minFontSize, 13 * options.scale), thickness = Math.max(1, round(options.scale));
  const gap = fontSize * 0.5, spacing = fontSize * 0.25, diagnostics: LayoutDiagnostic[] = [];
  const width = Math.max(options.scale, options.width);
  type Measured = { note: CitationNote; value: RichText; height: number };
  const measured: Measured[] = citations.notes.map(note => {
    const value: RichText = typeof note.text === 'string' ? `${note.number} ${note.text}` : [`${note.number} `, ...note.text];
    const probe = options.fit(value, { x: options.x, y: 0, width, height: Number.MAX_SAFE_INTEGER }, fontSize, fontSize, note.sourcePath, 'left');
    return { note, value, height: Math.max(fontSize * 1.22, fitHeight(probe)) };
  });
  const total = thickness + gap + measured.reduce((sum, item) => sum + item.height, 0) + spacing * Math.max(0, measured.length - 1);
  const height = round(Math.min(total, Math.max(fontSize * 1.22 + thickness + gap, options.maxHeight)));
  const top = round(options.bottom - height), box = { x: round(options.x), y: top, width: round(width), height };
  let cursor = top + thickness + gap, overflow = false;
  const entries: ComposedFootnoteEntry[] = measured.map((item, index) => {
    const entryBox = { x: box.x, y: round(cursor), width: box.width, height: round(item.height) };
    const fit = options.fit(item.value, entryBox, fontSize, fontSize, item.note.sourcePath, 'left');
    const exceeds = fit.overflow || entryBox.y + entryBox.height > options.bottom + .01;
    if (exceeds) { overflow = true; diagnostics.push({ code: 'text-overflow', path: item.note.sourcePath, message: `Footnote ${item.note.number} does not fit the slide's footnote area; shorten the note or split the slide.` }); }
    cursor += item.height + (index < measured.length - 1 ? spacing : 0);
    return { number: item.note.number, kind: item.note.kind, ...(item.note.id !== undefined ? { id: item.note.id } : {}), sourcePath: item.note.sourcePath, value: item.value, text: item.note.text, box: entryBox, fit, textStyle: options.textStyle(item.note.sourcePath), ...(item.note.url !== undefined ? { url: item.note.url } : {}), overflow: exceeds };
  });
  for (const note of citations.notes) if (!note.resolved) diagnostics.push({ code: 'unresolved-content', path: note.sourcePath, message: `Reference '${note.id}' is not in the presentation's references list; its id is listed instead.` });
  return { algorithm: 'footnote-area-v1', path: options.path, box, rule: { x: box.x, y: top, width: box.width, thickness }, entries, markers: citations.marked, fontSize, overflow, diagnostics };
}

export interface ReferencesSlideOptions { title?: string }
/**
 * An ordinary list slide of the deck's cited references in marker order (`n. text`, linked to the
 * reference url when there is one). Inline footnotes are not listed. A deck that cites nothing gets
 * a slide with the title only.
 */
export function referencesSlide(presentation: unknown, options: ReferencesSlideOptions = {}): Record<string, unknown> {
  const title = options.title ?? 'References';
  const { references } = collectCitations(presentation);
  if (!references.length) return { title };
  const items = references.map(note => {
    const label = `${note.number}. `;
    if (typeof note.text === 'string' && note.url === undefined) return `${label}${note.text}`;
    const runs: (string | RichTextRun)[] = [label, ...(typeof note.text === 'string' ? [note.text] : note.text)];
    if (note.url !== undefined) runs.push(' ', { text: note.url, link: note.url });
    return runs;
  });
  return { title, items };
}
