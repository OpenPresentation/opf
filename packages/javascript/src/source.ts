/**
 * `@openpresentation/opf/source`: reading a deck's source text the way an editor does. Browser-safe.
 *
 * - `locate(text, format, pointer, { part })`: the text range of a JSON Pointer, for squiggles and "go to problem".
 * - `pathAt(text, format, offset)`: the document path under a caret.
 * - `analyzeJsonSyntax(text, { limit })`: the root cause of each JSON syntax error, in plain words, with its fixes. The same
 *   analyzer produces the `opf/json-syntax` findings of `validate(text)`.
 *
 * Phase 1 covers JSON. YAML and Markdown addressing (`locate`, `pathAt`) is phase 2 and returns `undefined` until then.
 */
export { type AnalyzeOptions, type SyntaxFix, type SyntaxProblem, type SyntaxProblemCode, analyzeJsonSyntax } from "./json-syntax.js";
export { type LocateOptions, type LocatePart, type PathAtResult, locate, pathAt } from "./source-locate.js";
export { type SourceFormat, type TextEdit, type TextRange, applyTextEdits } from "./source-text.js";
