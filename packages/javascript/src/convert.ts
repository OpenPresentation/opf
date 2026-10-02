/**
 * Pure, deterministic content conversions: change the kind of a block (text, list, quote, metric, code, timeline,
 * chart, table, a set of metrics), edit a list's nesting levels, restructure a slide (group, ungroup, regions, image
 * to design) and split or merge slides. Every conversion keeps the user's own content, never invents any, reports
 * what the result cannot carry in `loss`, refuses with a reason when the content does not fit, and validates its
 * output as OPF. No renderer, fonts, DOM, network or model calls.
 */
export { OPFConversionError } from "./convert/shared.js";
export type { ConversionReport } from "./convert/shared.js";

export { CONTENT_CONVERSIONS, CONTENT_KIND_LABELS, contentConversionTargets, convertContent, readContent } from "./convert/content.js";
export type { ContentConversionTarget, ContentInfo, ContentKind, ConvertedContent, ConvertOptions } from "./convert/content.js";
export type { TableOptions } from "./convert/tables.js";

export { convertListForm, demoteListItems, promoteListItems, shiftListLevels } from "./convert/list.js";
export type { ListFormChange, ListLevelChange, ListLevelOptions } from "./convert/list.js";

export { blocksToRegions, demoteImage, moveRegion, promoteImage, regionsToBlocks, unwrapGroup, wrapBlocks } from "./convert/structure.js";
export type { ImageTarget, PromoteImageOptions, SlidePath, StructureChange } from "./convert/structure.js";

export { mergeSlides, splitSlide, splitSlideOnOverflow, unpaginate } from "./convert/slides.js";
export type { SlideEdit, SplitOverflowResult, SplitSlideOptions, UnpaginateOptions } from "./convert/slides.js";
