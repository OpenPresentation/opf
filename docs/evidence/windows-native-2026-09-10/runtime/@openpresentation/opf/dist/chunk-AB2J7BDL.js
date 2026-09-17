import { assertValidPresentation } from './chunk-4BX4YX5C.js';
import { resolveFontFamilies, resolveCanvasDimensions, composeSlide, tableRowBoundaries } from './chunk-PA4UHUYO.js';
import { catalogs } from './chunk-TWMRZ43O.js';

// src/pagination.ts
var OPFPaginationError = class extends Error {
  constructor(message, diagnostics = []) {
    super(message);
    this.diagnostics = diagnostics;
    this.name = "OPFPaginationError";
  }
  diagnostics;
  code = "pagination-unresolved";
};
var contentFields = /* @__PURE__ */ new Set(["text", "items", "bullets", "image", "video", "chart", "table", "code", "metric", "quote", "timeline"]);
var headingFields = /* @__PURE__ */ new Set(["title", "subtitle", "tag"]);
var isRecord = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var clone = (value) => structuredClone(value);
var textOf = (value) => typeof value === "string" ? value : Array.isArray(value) ? value.map(textOf).join("") : value?.text ?? "";
var graphemes = new Intl.Segmenter("und", { granularity: "grapheme" });
function sliceRichText(value, start, end) {
  if (typeof value === "string") return value.slice(start, end);
  let offset = 0;
  return value.flatMap((run) => {
    const text = textOf(run), left = Math.max(0, start - offset), right = Math.min(text.length, end - offset);
    offset += text.length;
    if (right <= left) return [];
    return [typeof run === "string" ? text.slice(left, right) : { ...run, text: text.slice(left, right) }];
  });
}
function leafFor(path, field, value) {
  const leaf = { path, field, value };
  let text;
  if (field === "text") {
    text = textOf(value);
    leaf.slice = (a, b) => sliceRichText(value, a, b);
  }
  if (field === "code" || field === "quote") {
    const key = field === "code" ? "source" : "text";
    text = typeof value === "string" ? value : value[key];
    leaf.slice = (a, b) => typeof value === "string" ? value.slice(a, b) : { ...value, [key]: text.slice(a, b) };
  }
  if (text !== void 0) {
    leaf.unit = "utf16";
    leaf.boundaries = [0, ...Array.from(graphemes.segment(text), (segment) => segment.index + segment.segment.length)];
  } else if (field === "items" || field === "bullets") {
    leaf.unit = "items";
    leaf.boundaries = Array.from({ length: value.length + 1 }, (_, i) => i);
    leaf.slice = (a, b) => value.slice(a, b);
  } else if (field === "table" || field === "timeline") {
    const key = field === "table" ? "rows" : "events";
    const values = Array.isArray(value) ? value : value[key];
    if (Array.isArray(values)) {
      leaf.unit = "items";
      leaf.boundaries = field === "table" ? tableRowBoundaries(value) : Array.from({ length: values.length + 1 }, (_, i) => i);
      leaf.slice = (a, b) => Array.isArray(value) ? value.slice(a, b) : { ...value, [key]: values.slice(a, b) };
    }
  }
  return leaf;
}
function paginateSlide(input, options = {}) {
  assertValidPresentation({ slides: [input] });
  let source = clone(input);
  const maxSlides = options.maxSlides ?? 100;
  if (!Number.isInteger(maxSlides) || maxSlides < 1 || maxSlides > 1e4) throw new RangeError("maxSlides must be an integer between 1 and 10000.");
  const minFontSize = options.minFontSize ?? 24;
  if (!Number.isFinite(minFontSize) || minFontSize < 8 || minFontSize > 32) throw new RangeError("Pagination minFontSize must be between 8 and 32.");
  const sourceIndex = options.slideIndex ?? 0, sourceBase = `slides.${sourceIndex}`;
  const withReadability = (slide, warn = false) => {
    const result = clone(slide);
    const rootMinimum = Math.max(minFontSize, result.composition?.minFontSize ?? options.layout?.composition?.minFontSize ?? 16);
    result.composition = { ...result.composition, minFontSize: rootMinimum };
    const visit = (node, inheritedMinimum) => {
      const minimum = Math.max(minFontSize, node.composition?.minFontSize ?? inheritedMinimum);
      if (node.composition) node.composition = { ...node.composition, minFontSize: minimum, ...warn ? { overflow: "warn" } : {} };
      if (Array.isArray(node.blocks)) node.blocks.forEach((child) => {
        visit(child, minimum);
      });
    };
    visit(result, rootMinimum);
    for (const [key, value] of Object.entries(result)) if (isRecord(value) && /^(top|middle|bottom|left|center|right)([+:]|$)/.test(key)) visit(value, rootMinimum);
    return result;
  };
  source = withReadability(source);
  let evaluations = 0;
  const geometry = (slide) => {
    if (++evaluations > 2e4) throw new OPFPaginationError("Pagination exceeded its layout evaluation limit. Split the input into smaller sections.");
    return composeSlide(withReadability(slide, true), options);
  };
  const initial = geometry(source);
  if (!initial.diagnostics.length) return { slides: [source], pages: [{ slideIndex: sourceIndex, mappings: initial.items.map((item) => ({ sourcePath: item.path, outputPath: item.path })) }] };
  const headerIssues = initial.diagnostics.filter((issue) => headingFields.has(issue.path.slice(sourceBase.length + 1)));
  if (headerIssues.length) throw new OPFPaginationError("The repeated heading does not fit. Shorten it or change the slide design before pagination.", headerIssues);
  const leaves = initial.items.filter((item) => !headingFields.has(item.field)).map((item) => leafFor(item.path, item.field, item.value));
  const leafPaths = new Set(leaves.map((leaf) => leaf.path));
  const slides = [], pages = [];
  let selected = /* @__PURE__ */ new Map();
  const reservedIds = new Set(options.reservedIds ?? []);
  if (typeof source.id === "string") reservedIds.add(source.id);
  const project = (portions, pageIndex) => {
    const mappings = [];
    const visit = (node, path, out, root = false) => {
      const result = {};
      let hasContent = false;
      for (const [key, value] of Object.entries(node)) {
        const childPath = `${path}.${key}`, outputPath = `${out}.${key}`;
        if (leafPaths.has(childPath)) {
          const portion = portions.get(childPath);
          if (portion) {
            result[key] = clone(portion.value);
            hasContent = true;
            mappings.push({ sourcePath: childPath, outputPath, ...portion.leaf.unit ? { range: { unit: portion.leaf.unit, start: portion.start, end: portion.end } } : {} });
          }
        } else if (key === "blocks" && Array.isArray(value)) {
          const children = [];
          value.forEach((child, index) => {
            const projected = visit(child, `${childPath}.${index}`, `${outputPath}.${children.length}`);
            if (projected) children.push(projected);
          });
          if (children.length) {
            result.blocks = children;
            hasContent = true;
          }
        } else if (root && isRecord(value) && /^(top|middle|bottom|left|center|right)([+:]|$)/.test(key)) {
          const child = visit(value, childPath, outputPath);
          if (child) {
            result[key] = child;
            hasContent = true;
          }
        } else if (!contentFields.has(key)) result[key] = clone(value);
      }
      return root || hasContent ? result : void 0;
    };
    const slide = visit(source, sourceBase, `slides.${sourceIndex + pageIndex}`, true);
    if (pageIndex > 0) delete slide.notes;
    return { slide, mappings };
  };
  const diagnosticsFor = (portions) => geometry(project(portions, slides.length).slide).diagnostics;
  const finish = () => {
    if (!selected.size) return;
    if (slides.length >= maxSlides) throw new OPFPaginationError(`Pagination needs more than ${maxSlides} slides. No partial result was returned.`);
    const { slide, mappings } = project(selected, slides.length);
    if (slides.length && typeof source.id === "string") {
      let suffix = slides.length + 1, id = `${source.id}--${suffix}`;
      while (reservedIds.has(id)) id = `${source.id}--${++suffix}`;
      slide.id = id;
      reservedIds.add(id);
    }
    assertValidPresentation({ slides: [slide] });
    slides.push(slide);
    pages.push({ slideIndex: sourceIndex + slides.length - 1, mappings });
    selected = /* @__PURE__ */ new Map();
  };
  for (const leaf of leaves) {
    const boundaries = leaf.boundaries ?? [0, 1];
    const end = boundaries.at(-1);
    let start = 0;
    while (true) {
      const make = (limit) => ({ leaf, start, end: limit, value: leaf.slice ? leaf.slice(start, limit) : leaf.value });
      let candidate = new Map(selected).set(leaf.path, make(end));
      let issues = diagnosticsFor(candidate);
      if (!issues.length) {
        selected = candidate;
        break;
      }
      let best = start;
      if (leaf.slice && end > start) {
        let low = boundaries.findIndex((value) => value > start), high = boundaries.length - 2;
        while (low <= high) {
          const mid = Math.floor((low + high) / 2), limit = boundaries[mid];
          candidate = new Map(selected).set(leaf.path, make(limit));
          if (!diagnosticsFor(candidate).length) {
            best = limit;
            low = mid + 1;
          } else high = mid - 1;
        }
        if (best > start && leaf.unit === "utf16" && leaf.field !== "code") {
          const text = textOf(leaf.field === "quote" ? typeof leaf.value === "string" ? leaf.value : leaf.value.text : leaf.value);
          const prefix = text.slice(start, best);
          const sentences = [...prefix.matchAll(/[.!?][”"')]*\s+|\n\s*\n/gu)];
          const lastSentence = sentences.at(-1);
          const sentenceEnd = lastSentence ? start + lastSentence.index + lastSentence[0].length : start;
          const match = /\s+\S*$/u.exec(prefix);
          const wordEnd = match ? start + match.index + match[0].length - match[0].trimStart().length : best;
          const preferred = sentenceEnd > start + (best - start) * 0.6 ? sentenceEnd : wordEnd;
          if (preferred > start && boundaries.includes(preferred) && !diagnosticsFor(new Map(selected).set(leaf.path, make(preferred))).length) best = preferred;
        }
      }
      if (best > start) {
        selected.set(leaf.path, make(best));
        finish();
        start = best;
      } else if (selected.size) finish();
      else throw new OPFPaginationError(`Content at ${leaf.path} cannot fit on an otherwise empty slide. Change its layout or split an atomic item.`, issues);
    }
  }
  finish();
  if (!slides.length) throw new OPFPaginationError("No body content can be paginated.", initial.diagnostics);
  return { slides, pages };
}
function paginatePresentation(input, options = {}) {
  assertValidPresentation(input);
  const presentation = clone(input);
  const maxSlides = options.maxSlides ?? 100;
  if (!Number.isInteger(maxSlides) || maxSlides < 1 || maxSlides > 1e4) throw new RangeError("maxSlides must be an integer between 1 and 10000.");
  const output = [], pages = [];
  const reservedIds = presentation.slides.map((slide) => slide.id).filter(Boolean);
  const resolve = (kind, id) => presentation.catalogs?.[kind]?.records?.find((record) => record.id === id) ?? catalogs[kind].find((record) => record.id === id);
  presentation.slides.forEach((slide, index) => {
    const overrides = options.slideOptions?.(slide, index) ?? {};
    const layout = overrides.layout ?? (slide.layout ? resolve("layouts", slide.layout) : void 0);
    if (slide.layout && !layout) throw new OPFPaginationError(`Layout '${slide.layout}' must be supplied inline or resolved by the host before pagination.`);
    const design = { ...presentation.design, ...slide.design };
    const reference = design.theme ?? "minimal";
    const theme = typeof reference === "string" ? resolve("themes", reference) : { ...resolve("themes", reference.id), ...reference };
    if (!theme) throw new OPFPaginationError(`Theme '${reference}' must be supplied inline before pagination.`);
    if (output.length >= maxSlides) throw new OPFPaginationError(`Pagination needs more than ${maxSlides} slides. No partial result was returned.`);
    const fontReference = design.fontScheme ?? theme.fontScheme ?? "roboto";
    const fontScheme = typeof fontReference === "string" ? resolve("fontSchemes", fontReference) : { ...resolve("fontSchemes", fontReference.id), ...fontReference };
    const fonts = resolveFontFamilies(fontScheme);
    const result = paginateSlide(slide, { ...resolveCanvasDimensions(design.dimensions ?? theme.dimensions), layout, fonts, contentAlignment: design.contentAlignment, titleAlignment: design.titleAlignment, contentBox: design.contentBox, textMeasurement: options.textMeasurement, textRasterPadding: options.textRasterPadding, ...overrides, slideIndex: index, maxSlides: maxSlides - output.length, minFontSize: options.minFontSize, reservedIds });
    const outputStart = output.length;
    result.pages.forEach((page, pageIndex) => {
      pages.push({ sourceSlideIndex: index, slideIndex: outputStart + pageIndex, mappings: page.mappings.map((mapping) => ({ ...mapping, outputPath: mapping.outputPath.replace(/^slides\.\d+/, `slides.${outputStart + pageIndex}`) })) });
    });
    output.push(...result.slides);
    reservedIds.push(...result.slides.map((slide2) => slide2.id).filter(Boolean));
  });
  presentation.slides = output;
  assertValidPresentation(presentation);
  return { presentation, pages };
}

export { OPFPaginationError, paginatePresentation, paginateSlide };
