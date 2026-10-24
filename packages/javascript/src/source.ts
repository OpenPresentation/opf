/**
 * `@openpresentation/opf/source`: reading a deck's source text the way an editor does. Browser-safe.
 *
 * - `locate(text, format, pointer, { part })`: the text range of a JSON Pointer, for squiggles and "go to problem".
 * - `pathAt(text, format, offset)`: the document path under a caret.
 * - `analyzeJsonSyntax(text, { limit })`: the root cause of each JSON syntax error, in plain words, with its fixes. The same
 *   analyzer produces the `opf/json-syntax` findings of `validate(text)`.
 *
 * - `scanMarkdown(text)`: the regions of a Markdown deck (front matter, slides, option comments, fences, notes) with the converter's rules,
 *   and the dialect's vocabulary (`SLIDE_OPTION_KEYS`, `BLOCK_OPTION_KEYS`, `FENCE_KINDS`, `METRIC_KEYS`, ...), so an editor never copies them.
 *
 * `locate` and `pathAt` read JSON, YAML and Markdown.
 */
export { type AnalyzeOptions, type SyntaxFix, type SyntaxProblem, type SyntaxProblemCode, analyzeJsonSyntax } from "./json-syntax.js";
export { type LocateOptions, type LocatePart, type PathAtResult, locate, pathAt } from "./source-locate.js";
export { BLOCK_AS_VALUES, BLOCK_OPTION_KEYS, FENCE_ATTRIBUTES, FENCE_KINDS, LINE_KEYWORDS, METRIC_KEYS, SLIDE_OPTION_KEYS, SPAN_FLAGS, SPAN_VALUES } from "./markdown/dialect.js";
export type { MarkdownCommentScan, MarkdownFenceScan, MarkdownFrontMatter, MarkdownNotesScan, MarkdownScan, MarkdownSlideScan, ScanMarkdownOptions, ScanRange } from "./source-markdown.js";
export { scanMarkdown } from "./source-markdown.js";
export { type SourceFormat, type TextEdit, type TextRange, applyTextEdits } from "./source-text.js";
