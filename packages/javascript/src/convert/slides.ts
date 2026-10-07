// Slide-level conversions: split a slide into several (by blocks, or where it overflows through the existing
// pagination), merge consecutive slides, and put paginated slides back together. They take a presentation and
// return the replacement slides, the range they replace and the new presentation. Pure; every result is
// validated as OPF. Internal module.
import { visitContentPayloads } from "../content-walk.js";
import { OPFPaginationError, type PaginatedPage, type PresentationPaginationOptions, paginate } from "../pagination.js";
import { CONTENT_KEYS, type ConversionReport, type Json, Loss, type Obj, assertValidOutput, clone, concatText, contentKeysOf, isRecord, refuse, report, same } from "./shared.js";
import { isRegionKey, regionKeysOf, sortRegionKeys } from "./structure.js";

export interface SlideEdit extends ConversionReport {
  /** The presentation after the change. */
  presentation: Obj;
  /** The slides that replace `range`. */
  slides: Obj[];
  /** The slides of the old presentation that were replaced: `deleteCount` slides from `start`. */
  range: { start: number; deleteCount: number };
  /** False when the slide already fits or nothing needed to change (then `slides` is the original). */
  changed: boolean;
}

const HEADINGS = ["title", "subtitle", "tag"] as const;
const BODY_KEYS = new Set<string>([...CONTENT_KEYS, "type", "blocks"]);

function slideAt(presentation: unknown, index: number): Obj {
  const slides = (presentation as Obj)?.slides;
  if (!Array.isArray(slides) || !Number.isInteger(index) || index < 0 || index >= slides.length) throw refuse("Choose a slide that exists.", { slideIndex: index });
  return slides[index];
}
const slideIds = (slide: Obj): string[] => {
  const ids = typeof slide.id === "string" ? [slide.id] : [];
  visitContentPayloads(slide, "", (payload) => {
    if (typeof payload.id === "string") ids.push(payload.id);
  });
  return ids;
};
/** Every id in the document, for picking ids that cannot collide. */
const documentIds = (presentation: Obj): Set<string> => new Set((presentation.slides as Obj[]).flatMap(slideIds));
function replaceSlides(presentation: Obj, start: number, deleteCount: number, slides: Obj[]): Obj {
  const next = clone(presentation);
  next.slides.splice(start, deleteCount, ...clone(slides));
  return next;
}

/** The blocks of a slide for splitting: its `blocks`, its inline content fields, or its regions in reading order. */
function splittableBlocks(slide: Obj, loss: Loss): Obj[] {
  const regions = sortRegionKeys(regionKeysOf(slide));
  if (regions.length) {
    loss.note("region placement");
    return regions.map((key) => slide[key]);
  }
  if (Array.isArray(slide.blocks)) return slide.blocks;
  const keys = contentKeysOf(slide);
  return keys.map((key) => ({ ...(keys.length === 1 && slide.type ? { type: slide.type } : {}), [key]: slide[key] }));
}

export interface SplitSlideOptions {
  /** Block indexes where a new slide starts, for example `[2]` puts blocks 0 and 1 on the first slide and the rest on the second. */
  at?: number[];
  /** One block per slide (alternative to `at`). */
  each?: boolean;
  /** Repeat the title, subtitle and tag on every new slide (default true, the way pagination repeats headings). */
  repeatHeadings?: boolean;
}

/**
 * Split one slide into several by its blocks. The slide's design, layout, composition, section and other slide
 * fields are copied to each part, its first part keeps its `id` and notes, later parts get ids ending `--2`,
 * `--3`, ... that no other slide uses, and every block (with its own id) moves to exactly one part. A slide that
 * uses named regions is split region by region and loses the regions' placement (reported).
 */
export function splitSlide(presentation: unknown, slideIndex: number, options: SplitSlideOptions = {}): SlideEdit {
  const source = slideAt(presentation, slideIndex);
  const loss = new Loss();
  const blocks = splittableBlocks(clone(source), loss);
  if (blocks.length < 2) throw refuse("This slide has one block, so there is nothing to split. Add or move content first, or split it where it overflows.");
  let starts: number[];
  if (options.each) starts = blocks.map((_, index) => index).slice(1);
  else {
    starts = [...new Set(options.at ?? [])].sort((a, b) => a - b);
    if (!starts.length) throw refuse("Choose where to split: block indexes at which a new slide starts, or one block per slide.");
    if (starts.some((index) => !Number.isInteger(index) || index < 1 || index >= blocks.length)) throw refuse(`Choose split points between blocks 1 and ${blocks.length - 1}.`, { at: options.at });
  }
  const bounds = [0, ...starts, blocks.length];
  const base: Obj = {};
  for (const [key, value] of Object.entries(source)) if (!BODY_KEYS.has(key) && !isRegionKey(key)) base[key] = clone(value);
  const taken = documentIds(presentation as Obj);
  const slides = bounds.slice(0, -1).map((from, part) => {
    const slide: Obj = {};
    for (const [key, value] of Object.entries(base)) {
      if (part > 0 && (key === "notes" || (options.repeatHeadings === false && (HEADINGS as readonly string[]).includes(key)))) continue;
      if (part > 0 && key === "id") continue;
      slide[key] = clone(value);
    }
    if (part > 0 && typeof base.id === "string") {
      let suffix = part + 1;
      while (taken.has(`${base.id}--${suffix}`)) suffix++;
      slide.id = `${base.id}--${suffix}`;
      taken.add(slide.id);
    }
    slide.blocks = clone(blocks.slice(from, bounds[part + 1]));
    return slide;
  });
  assertValidOutput(slides, "slides", presentation as Obj);
  return { presentation: replaceSlides(presentation as Obj, slideIndex, 1, slides), slides, range: { start: slideIndex, deleteCount: 1 }, changed: true, ...report(loss.list) };
}

// --- split where a slide overflows -------------------------------------------------------------

export interface SplitOverflowResult extends SlideEdit {
  /** The pagination mapping of the new slides, with paths for the returned presentation; pass it to `unpaginate` to undo the split. */
  pages: (PaginatedPage & { sourceSlideIndex: number })[];
}

const remapPath = (path: string, from: number, to: number): string => path.replace(new RegExp(`^slides\\.${from}(?=\\.|$)`), `slides.${to}`);

/**
 * Split a slide that does not fit into continuation slides with the existing pagination (`paginate`):
 * text, lists, tables and timelines break at item or sentence boundaries, headings are repeated and nothing is
 * dropped. The slide is paginated on its own, as slide 1 of 1, with the host's `options` (fonts, text
 * measurement); a slide that already fits is returned unchanged. Throws `not-convertible` when pagination
 * cannot resolve it (for example one item that cannot fit a slide).
 */
export function splitSlideOnOverflow(presentation: unknown, slideIndex: number, options: PresentationPaginationOptions = {}): SplitOverflowResult {
  const source = slideAt(presentation, slideIndex);
  const whole = presentation as Obj;
  let result: ReturnType<typeof paginate>;
  try {
    result = paginate({ ...clone(whole), slides: [clone(source)] }, options);
  } catch (error) {
    if (error instanceof OPFPaginationError) throw refuse(error.message, { diagnostics: error.diagnostics });
    throw error;
  }
  const paginated: Obj[] = result.presentation.slides;
  if (paginated.length === 1) {
    // Pagination persists the readability floor in the slide it returns; one page is not a split.
    return { presentation: clone(whole), slides: [clone(source)], range: { start: slideIndex, deleteCount: 1 }, changed: false, pages: [], ...report([]) };
  }
  // Continuation ids are unique inside the one-slide document; make them unique inside the real one.
  const others = new Set((whole.slides as Obj[]).flatMap((slide, index) => (index === slideIndex ? [] : slideIds(slide))));
  const used = new Set<string>(others);
  const rename = (node: Obj): void => {
    if (typeof node.id !== "string") return;
    let id = node.id;
    for (let suffix = 2; used.has(id); suffix++) id = `${node.id}-${suffix}`;
    node.id = id;
    used.add(id);
  };
  for (const slide of paginated) {
    rename(slide);
    visitContentPayloads(slide, "", (payload) => rename(payload as Obj));
  }
  const pages = result.pages.map((page) => ({
    ...page,
    sourceSlideIndex: slideIndex,
    slideIndex: slideIndex + (page.slideIndex as number),
    mappings: page.mappings.map((mapping) => ({ ...mapping, sourcePath: remapPath(mapping.sourcePath, 0, slideIndex), outputPath: remapPath(mapping.outputPath, 0, slideIndex + (page.slideIndex as number)) })),
    ...(page.repeatedMappings ? { repeatedMappings: page.repeatedMappings.map((mapping) => ({ ...mapping, sourcePath: remapPath(mapping.sourcePath, 0, slideIndex), outputPath: remapPath(mapping.outputPath, 0, slideIndex + (page.slideIndex as number)) })) } : {}),
  }));
  assertValidOutput(paginated, "slides", presentation as Obj);
  return { presentation: replaceSlides(whole, slideIndex, 1, paginated), slides: paginated, range: { start: slideIndex, deleteCount: 1 }, changed: true, pages, ...report([]) };
}

// --- merge -------------------------------------------------------------------------------------

/**
 * Merge `count` consecutive slides starting at `start` into one. The first slide's `id`, title, layout, design
 * and other slide fields win; where a later slide differs, what is dropped is reported. The blocks of all the
 * slides follow each other in one `blocks` list (a slide's inline content becomes blocks) and speaker notes are
 * joined with a blank line. Slides that use named regions cannot be merged.
 */
export function mergeSlides(presentation: unknown, start: number, count = 2): SlideEdit {
  if (!Number.isInteger(count) || count < 2) throw refuse("Choose at least two slides to merge.");
  const slides: Obj[] = [];
  for (let offset = 0; offset < count; offset++) {
    if (!isRecord((presentation as Obj)?.slides?.[start + offset])) throw refuse("Choose consecutive slides that exist.", { start, count });
    slides.push(clone(slideAt(presentation, start + offset)));
  }
  const loss = new Loss();
  if (slides.some((slide) => regionKeysOf(slide).length)) throw refuse("Slides that place content in named regions cannot be merged. Convert the regions to blocks first.");
  const [first, ...others] = slides as [Obj, ...Obj[]];
  const merged: Obj = {};
  for (const [key, value] of Object.entries(first)) if (!BODY_KEYS.has(key) && key !== "notes") merged[key] = value;
  others.forEach((slide, index) => {
    const number = start + index + 2;
    for (const [key, value] of Object.entries(slide)) {
      if (BODY_KEYS.has(key) || key === "notes") continue;
      if (key === "id") loss.note(`slide id "${String(value)}"`);
      else if (!same(first[key], value)) loss.note(`${key} of slide ${number}`);
    }
  });
  const blocks = slides.flatMap((slide) => splittableBlocks(slide, loss));
  if (blocks.length) merged.blocks = blocks;
  const notes = slides.map((slide) => slide.notes).filter((note): note is string => typeof note === "string" && note !== "");
  if (notes.length) merged.notes = notes.join("\n\n");
  assertValidOutput(merged, "slide", presentation as Obj);
  return { presentation: replaceSlides(presentation as Obj, start, count, [merged]), slides: [merged], range: { start, deleteCount: count }, changed: true, ...report(loss.list) };
}

// --- un-paginate -------------------------------------------------------------------------------

const segments = (path: string): string[] => path.split(".");
const valueAt = (root: Json, path: string[]): Json => path.reduce((value, part) => value?.[part], root);

/** Join the slices of one leaf, in page order, into the leaf they were cut from. */
function joinSlices(field: string, slices: Json[]): Json {
  const [first] = slices;
  if (slices.length === 1) return clone(first);
  switch (field) {
    case "text":
      return slices.slice(1).reduce((joined, slice) => concatText(joined, slice), clone(first));
    case "items":
    case "bullets":
      return slices.flatMap((slice) => clone(slice));
    case "code":
    case "quote": {
      const key = field === "code" ? "source" : "text";
      const parts = slices.map((slice) => (typeof slice === "string" ? slice : slice[key]) as Json);
      // A quote text may be TextRun[] (FA-10): the pieces join like body text, keeping each run's formatting.
      const text = field === "quote" ? parts.slice(1).reduce((joined, part) => concatText(joined, part), clone(parts[0]!)) : (parts as string[]).join("");
      return typeof first === "string" ? text : { ...clone(first), [key]: text };
    }
    case "table":
      return { ...clone(first), rows: slices.flatMap((slice) => clone(slice.rows)) };
    case "timeline":
      return Array.isArray(first) ? slices.flatMap((slice) => clone(slice)) : { ...clone(first), events: slices.flatMap((slice) => clone(slice.events)) };
    default:
      return clone(first);
  }
}

export interface UnpaginateOptions {
  /** Only put back the slides cut from this source slide (an index into the pagination's source presentation). Default: every one. */
  sourceSlideIndex?: number;
}

/**
 * The inverse of `paginate` for slides still as it returned them: given its `pages` mapping, join the
 * slices of each source slide back into the original leaves (text, list items, table rows, timeline events, code
 * lines) and replace the continuation slides by one slide. The first slide's id, headings and design are kept; the
 * slides must not have been edited or reordered since (a gap between two slices is refused). The readability floor
 * pagination wrote into `composition.minFontSize` stays, because the original value is not recorded.
 */
export function unpaginate(presentation: unknown, pages: readonly (PaginatedPage & { sourceSlideIndex: number })[], options: UnpaginateOptions = {}): SlideEdit {
  const groups = new Map<number, (PaginatedPage & { sourceSlideIndex: number })[]>();
  for (const page of pages) {
    if (options.sourceSlideIndex !== undefined && page.sourceSlideIndex !== options.sourceSlideIndex) continue;
    groups.set(page.sourceSlideIndex, [...(groups.get(page.sourceSlideIndex) ?? []), page]);
  }
  const todo = [...groups.values()].filter((group) => group.length > 1);
  if (!todo.length) throw refuse("Those slides were not split by pagination, or only one page was kept.");
  let current = clone(presentation as Obj);
  let first = Number.POSITIVE_INFINITY;
  let end = 0;
  let removed = 0;
  // Replace from the end so earlier indexes stay valid.
  for (const group of todo.sort((a, b) => b[0]!.slideIndex - a[0]!.slideIndex)) {
    const indexes = group.map((page) => page.slideIndex);
    if (indexes.some((index, position) => index !== indexes[0]! + position)) throw refuse("The pages of this slide are no longer next to each other.", { slides: indexes });
    const rebuilt = rebuild(current, group);
    current = replaceSlides(current, indexes[0]!, indexes.length, [rebuilt]);
    first = Math.min(first, indexes[0]!);
    end = Math.max(end, indexes[0]! + indexes.length);
    removed += indexes.length - 1;
  }
  assertValidOutput(current.slides, "slides", presentation as Obj);
  // The old slides from the first page of the first split slide to the last page of the last one are replaced as one range.
  const deleteCount = end - first;
  return { presentation: current, slides: current.slides.slice(first, first + deleteCount - removed), range: { start: first, deleteCount }, changed: true, ...report([]) };
}

function rebuild(presentation: Obj, group: readonly (PaginatedPage & { sourceSlideIndex: number })[]): Obj {
  const firstPage = group[0]!;
  const skeleton = clone(valueAt(presentation, ["slides", String(firstPage.slideIndex)])) as Obj;
  const root: Obj = {};
  for (const [key, value] of Object.entries(skeleton)) if (!BODY_KEYS.has(key) && !isRegionKey(key)) root[key] = value;
  interface Slice {
    page: number;
    value: Json;
    range?: { unit: string; start: number; end: number };
    outputSegments: string[];
  }
  const leaves = new Map<string, Slice[]>();
  const order: string[] = [];
  group.forEach((page, pageNumber) => {
    for (const mapping of page.mappings) {
      const outputSegments = segments(mapping.outputPath).slice(2);
      const value = valueAt(presentation, ["slides", String(page.slideIndex), ...outputSegments]);
      if (value === undefined) throw refuse(`The slide no longer has the content at ${mapping.outputPath}.`, { path: mapping.outputPath });
      const key = segments(mapping.sourcePath).slice(2).join(".");
      if (!leaves.has(key)) {
        leaves.set(key, []);
        order.push(key);
      }
      leaves.get(key)!.push({ page: pageNumber, value, ...(mapping.range ? { range: mapping.range } : {}), outputSegments });
    }
  });
  const place = (sourceSegments: string[], containerOf: (depth: number) => Obj | undefined, value: Json): void => {
    let cursor: Obj = root;
    for (let depth = 0; depth < sourceSegments.length - 1; depth++) {
      const part = sourceSegments[depth]!;
      if (part === "blocks") {
        cursor.blocks ??= [];
        continue;
      }
      const slot = Array.isArray(cursor.blocks) && /^\d+$/.test(part) ? cursor.blocks : cursor;
      const key = Array.isArray(cursor.blocks) && /^\d+$/.test(part) ? Number(part) : part;
      if (!isRecord(slot[key as never])) {
        const model = containerOf(depth);
        const copy: Obj = {};
        for (const [name, entry] of Object.entries(model ?? {})) if (!BODY_KEYS.has(name) && !isRegionKey(name)) copy[name] = clone(entry);
        (slot as Json)[key] = copy;
      }
      cursor = (slot as Json)[key];
    }
    cursor[sourceSegments.at(-1)!] = value;
  };
  for (const key of order) {
    const slices = leaves.get(key)!;
    for (let index = 1; index < slices.length; index++) {
      const previous = slices[index - 1]!.range;
      const next = slices[index]!.range;
      if (!previous || !next || previous.end !== next.start) throw refuse("The slices of this slide are not consecutive any more, so they cannot be put back together.", { path: key });
    }
    const sourceSegments = key.split(".");
    const field = sourceSegments.at(-1)!;
    const model = slices[0]!;
    const containerOf = (depth: number): Obj | undefined => valueAt(presentation, ["slides", String(group[model.page]!.slideIndex), ...model.outputSegments.slice(0, depth + 1)]);
    place(sourceSegments, containerOf, joinSlices(field, slices.map((slice) => slice.value)));
  }
  const compact = (node: Obj): void => {
    if (Array.isArray(node.blocks)) {
      node.blocks = node.blocks.filter((block: Json) => block !== undefined);
      for (const block of node.blocks) compact(block);
    }
    for (const key of Object.keys(node)) if (isRegionKey(key) && isRecord(node[key])) compact(node[key]);
  };
  compact(root);
  if (skeleton.type !== undefined && CONTENT_KEYS.some((key) => root[key] !== undefined)) root.type = skeleton.type;
  return root;
}
