// The vocabulary of the OPF Markdown dialect, in one place for the converter and for editors (`scanMarkdown`, completion). Internal module;
// `@openpresentation/opf/source` re-exports it as `markdownDialect`.

/** Keys of `<!-- slide: ... -->`. */
export const SLIDE_OPTION_KEYS = ["id", "type", "layout", "section", "tag", "hidden", "beat"] as const;
/** Keys of `<!-- block: ... -->`. */
export const BLOCK_OPTION_KEYS = ["id", "type", "as", "region"] as const;
/** Values of `as=` in a block options comment. */
export const BLOCK_AS_VALUES = ["bullets", "video"] as const;
/** The first word of a fence info string that is not code: `chart`, `metric`, `timeline` and the two YAML escape hatches. */
export const FENCE_KINDS = ["chart", "metric", "timeline", "opf-block", "opf-slide"] as const;
/** Lines of a ```metric fence: `key: value`. */
export const METRIC_KEYS = ["value", "label", "description", "unit", "delta", "trend", "sentiment"] as const;
/** Attributes after the info word: `chart` takes `alt`, `timeline` `name` and `description`, a code fence `title`. */
export const FENCE_ATTRIBUTES = { chart: ["alt"], timeline: ["name", "description"], code: ["title"] } as const;
/** Flags of an inline span `[text]{bold italic}` (the converter also reads `strikethrough`, `superscript` and `subscript`). */
export const SPAN_FLAGS = ["bold", "italic", "underline", "strike", "sup", "sub"] as const;
/** Attributes of an inline span that take a value: `[text]{color=#B42318 size=24 font="Open Sans" lang=fr}`. */
export const SPAN_VALUES = ["color", "size", "font", "lang"] as const;
/** Keywords a line of a slide can start with. */
export const LINE_KEYWORDS = ["Note:", "Notes:"] as const;

export type FenceKind = (typeof FENCE_KINDS)[number];
