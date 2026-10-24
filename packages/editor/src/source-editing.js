// Editing rules of the YAML and Markdown source (artifacts/source-editor/SPEC.md, sections 6.1 to 6.6): Enter indents the way the text is built (one
// level in after `key:`, aligned under the key after `- key: value`, a list item continued, an empty one ended), Tab nests a Markdown list item, Backspace
// takes a list marker away, Cmd/Ctrl+/ comments a line, and the characters that pair or wrap a selection. Commands over a CodeMirror view; no network.
// They read the text line by line, so they need no parser and work on half-typed text; the main bundle carries them (a few kilobytes).
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { foldService } from "@codemirror/language";
import { indentMore } from "@codemirror/commands";
import { flowDepth, readEntry, readMarkers } from "./source-yaml.js";

const UNIT = "  ";
const BLOCK_HEADER = /^[|>][+-]?\d*[+-]?\s*(?:#.*)?$/;
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])([ \t]+)(.*)$/;
const LIST_EMPTY = /^(\s*)([-*+]|\d{1,9}[.)])[ \t]*$/;
const QUOTE = /^(\s{0,3})>([ \t]?)(.*)$/;

// ---- language data -----------------------------------------------------------------------------------------------------------------
/** Pairs per language (SPEC 6.3): YAML pairs quotes and flow brackets, Markdown pairs `(`, `[`, `{` and backticks (not `"` or `<`), JSON keeps its own. */
export function languageDataFor(name) {
  if (name === "yaml") return EditorState.languageData.of(() => [{ closeBrackets: { brackets: ["[", "{", '"', "'"] } }]);
  if (name === "markdown") return EditorState.languageData.of(() => [{ closeBrackets: { brackets: ["(", "[", "{", "`"] }, commentTokens: { block: { open: "<!--", close: "-->" } } }]);
  return [];
}

// ---- what a line of Markdown is in -------------------------------------------------------------------------------------------------
/**
 * Where line `number` (1-based) of a Markdown text is: "front" (inside the front matter), "fence" (inside a code fence), "yaml-fence" (inside an
 * `opf-slide` or `opf-block` fence) or "body". Scans from the top, which is cheap next to a key press.
 */
export function markdownLineKind(doc, number) {
  let front = false;
  let fence = null;
  for (let index = 1; index < number; index++) {
    const text = doc.line(index).text;
    if (index === 1 && /^---\s*$/.test(text)) { front = true; continue; }
    if (front) { if (/^(---|\.\.\.)\s*$/.test(text)) front = false; continue; }
    if (fence) {
      if (new RegExp(`^ {0,3}${fence.char}{${fence.length},}\\s*$`).test(text)) fence = null;
      continue;
    }
    const open = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
    if (open && !(open[1][0] === "`" && open[2].includes("`"))) fence = { char: open[1][0], length: open[1].length, yaml: /^\s*opf-(?:slide|block)\b/.test(open[2]) };
  }
  const here = doc.line(number).text;
  if (front) return /^(---|\.\.\.)\s*$/.test(here) ? "body" : "front";
  if (fence) return new RegExp(`^ {0,3}${fence.char}{${fence.length},}\\s*$`).test(here) ? "body" : fence.yaml ? "yaml-fence" : "fence";
  return "body";
}

// ---- Enter -------------------------------------------------------------------------------------------------------------------------
/** The indentation (columns) of the new line after `before`, the text of the line up to the caret, in YAML; `"leave"` for an empty list item. */
export function yamlNewlineIndent(before) {
  const parsed = readMarkers(before);
  if (parsed.markers.length && parsed.rest.trim() === "") return "leave";
  const entry = readEntry(parsed.rest);
  const content = parsed.markers.length ? parsed.restStart : parsed.indent;
  if (!entry) return content;
  const value = parsed.rest.slice(entry.valueStart).replace(/\s+#.*$/, "").trim();
  if (value === "" || BLOCK_HEADER.test(value)) return parsed.restStart + entry.keyStart + UNIT.length;
  // An unclosed flow collection continues one level in.
  let depth = 0;
  for (const character of value) depth += character === "[" || character === "{" ? 1 : character === "]" || character === "}" ? -1 : 0;
  return depth > 0 ? parsed.restStart + entry.keyStart + UNIT.length : parsed.markers.length || entry.keyStart > 0 ? parsed.restStart + entry.keyStart : content;
}

// Replace each selection range with a line break and what `decide` says goes after it: `{ indent }` columns, `{ insert }` text, or `{ clear, text }` to
// replace the whole line (an empty list item loses its marker) instead of breaking it.
function newline(view, decide) {
  const { state } = view;
  if (state.readOnly) return false;
  const update = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from);
    const result = decide(line.text.slice(0, range.from - line.from), line.text, line);
    if (result.clear) return { changes: { from: line.from, to: Math.max(range.to, line.to), insert: result.text }, range: EditorSelection.cursor(line.from + result.text.length) };
    const insert = `\n${result.insert ?? " ".repeat(result.indent ?? 0)}`;
    return { changes: { from: range.from, to: range.to, insert }, range: EditorSelection.cursor(range.from + insert.length) };
  });
  view.dispatch(state.update(update, { scrollIntoView: true, userEvent: "input" }));
  return true;
}

// The YAML rules for the line before the caret: `{ indent }` of the new line, or `{ clear, text }` for an empty list item.
function yamlDecision(before, lists = true) {
  // A line with only spaces before the caret keeps them: the new line gets the same indentation.
  if (before.trim() === "") return { indent: before.length };
  const indent = yamlNewlineIndent(before);
  if (indent === "leave") return { clear: true, text: " ".repeat(Math.max(0, readMarkers(before).markers[0] - UNIT.length)) };
  // After a list item that is a value (`- board`) the list goes on with the next dash; after `- key: value` the new line aligns under the key.
  const parsed = readMarkers(before);
  if (!lists && parsed.markers.length && !readEntry(parsed.rest)) return { indent: parsed.indent };
  if (lists && parsed.markers.length && !readEntry(parsed.rest)) {
    const value = parsed.rest.replace(/\s+#.*$/, "").trim();
    if (value !== "" && !BLOCK_HEADER.test(value) && !/^[&*!]/.test(value) && flowDepth(value) === 0) return { insert: `${" ".repeat(parsed.markers.at(-1))}- ` };
  }
  return { indent };
}

/** Enter in YAML (SPEC 6.2). */
export function yamlEnter(view, { lists = true } = {}) {
  return newline(view, (before) => yamlDecision(before, lists));
}

/**
 * Enter in Markdown (SPEC 6.2): lists and quotes continue, an empty marker ends them, a fence keeps its indentation, front matter follows YAML.
 * `lists: false` (the `smartListEnter` option) keeps only the indentation.
 */
export function markdownEnter(view, { lists = true } = {}) {
  const { state } = view;
  return newline(view, (before, full, line) => {
    const kind = markdownLineKind(state.doc, line.number);
    if (kind === "front" || kind === "yaml-fence") return yamlDecision(before, lists);
    const lead = /^\s*/.exec(before)[0];
    if (kind === "fence" || !lists) return { indent: lead.length };
    const atEnd = before.length === full.length;
    // An empty item ends the list: a nested one moves out one level, a top-level one becomes an empty line.
    const empty = LIST_EMPTY.exec(before);
    if (empty && atEnd) return { clear: true, text: empty[1].length >= UNIT.length ? `${" ".repeat(empty[1].length - UNIT.length)}${empty[2]} ` : "" };
    const item = LIST_ITEM.exec(before);
    // Inside the marker itself the line just breaks.
    if (item && before.length >= item[1].length + item[2].length + item[3].length) {
      const marker = /^\d/.test(item[2]) ? `${Number.parseInt(item[2], 10) + 1}${item[2].slice(-1)}` : item[2];
      return { insert: `${item[1]}${marker} ` };
    }
    const quote = QUOTE.exec(before);
    if (quote) {
      if (quote[3].trim() === "" && atEnd) return { clear: true, text: "" };
      return { insert: `${quote[1]}> ` };
    }
    return { indent: lead.length };
  });
}

// ---- Tab and Backspace in Markdown lists -------------------------------------------------------------------------------------------
/** Tab on a list item nests it one level (two spaces); false elsewhere. */
export function markdownTab(view) {
  const { state } = view;
  if (state.readOnly || state.selection.ranges.some((range) => !range.empty)) return false;
  if (!state.selection.ranges.every((range) => LIST_ITEM.test(state.doc.lineAt(range.head).text) || LIST_EMPTY.test(state.doc.lineAt(range.head).text))) return false;
  if (state.selection.ranges.some((range) => markdownLineKind(state.doc, state.doc.lineAt(range.head).number) !== "body")) return false;
  return indentMore(view);
}

/** Backspace right after a list marker takes the marker away (`- |one` becomes `|one`); false elsewhere. */
export function markdownBackspace(view) {
  const { state } = view;
  if (state.readOnly || state.selection.ranges.length !== 1 || !state.selection.main.empty) return false;
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  if (markdownLineKind(state.doc, line.number) !== "body") return false;
  const item = LIST_ITEM.exec(line.text);
  const empty = LIST_EMPTY.exec(line.text);
  const markerEnd = item ? item[1].length + item[2].length + item[3].length : empty ? line.text.length : -1;
  if (markerEnd < 0 || head - line.from !== markerEnd) return false;
  const start = line.from + (item ? item[1].length : empty[1].length);
  view.dispatch({ changes: { from: start, to: head }, selection: { anchor: start }, userEvent: "delete.backward", scrollIntoView: true });
  return true;
}

// ---- Comments ----------------------------------------------------------------------------------------------------------------------
/**
 * Cmd/Ctrl+/ in Markdown: front matter and YAML fences toggle `# `; a line of the body is wrapped in `<!-- -->` or unwrapped; an options comment
 * says it already is one. `say` announces what could not be done.
 */
export function markdownToggleComment(view, say) {
  const { state } = view;
  if (state.readOnly) return false;
  const lines = [];
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    let last = state.doc.lineAt(range.to).number;
    if (!range.empty && range.to === state.doc.line(last).from && last > first) last--;
    for (let number = first; number <= last; number++) if (!lines.includes(number)) lines.push(number);
  }
  const kinds = lines.map((number) => markdownLineKind(state.doc, number));
  const texts = lines.map((number) => state.doc.line(number).text);
  if (kinds.some((kind) => kind === "fence")) { say?.("Code in a fence has no comment syntax."); return true; }
  if (texts.some((text) => /^\s*<!--\s*(slide|block)\b/.test(text)) && texts.length === 1) { say?.("Slide options are already a comment. Delete the line to remove them."); return true; }
  const changes = [];
  const yamlStyle = kinds.every((kind) => kind === "front" || kind === "yaml-fence");
  const blank = (text) => text.trim() === "";
  const real = lines.filter((number, index) => !blank(texts[index]));
  if (!real.length) return true;
  if (yamlStyle) {
    const all = real.every((number) => /^\s*#/.test(state.doc.line(number).text));
    const column = Math.min(...real.map((number) => /^\s*/.exec(state.doc.line(number).text)[0].length));
    for (const number of real) {
      const line = state.doc.line(number);
      if (all) {
        const match = /^(\s*)# ?/.exec(line.text);
        changes.push({ from: line.from + match[1].length, to: line.from + match[0].length });
      } else changes.push({ from: line.from + column, insert: "# " });
    }
  } else {
    const all = real.every((number) => /^\s*<!--.*-->\s*$/.test(state.doc.line(number).text));
    for (const number of real) {
      const line = state.doc.line(number);
      if (all) {
        const match = /^(\s*)<!-- ?(.*?) ?-->(\s*)$/.exec(line.text);
        changes.push({ from: line.from + match[1].length, to: line.to, insert: match[2] });
      } else {
        const lead = /^\s*/.exec(line.text)[0].length;
        changes.push({ from: line.from + lead, insert: "<!-- " }, { from: line.to, insert: " -->" });
      }
    }
  }
  // The selection takes in the comment marks that were added or removed at its ends.
  const set = state.changes(changes);
  const selection = EditorSelection.create(state.selection.ranges.map((range) => EditorSelection.range(set.mapPos(range.anchor, 1), set.mapPos(range.head, 1))), state.selection.mainIndex);
  view.dispatch(state.update({ changes: set, selection, userEvent: "input.comment", scrollIntoView: true }));
  return true;
}

// ---- Typing over a selection in Markdown -------------------------------------------------------------------------------------------
const WRAPPERS = { "*": "*", _: "_", "~": "~", '"': '"' };

/** Typing `*`, `_`, `~` or `"` over a selection wraps it (typing `*` twice makes bold); the selection stays on the text. */
export const markdownWrapSelection = EditorView.inputHandler.of((view, _from, _to, text) => {
  if (text.length !== 1 || !(text in WRAPPERS) || view.state.readOnly) return false;
  const { selection } = view.state;
  if (selection.ranges.every((range) => range.empty)) return false;
  const closer = WRAPPERS[text];
  const changes = view.state.changes(selection.ranges.filter((range) => !range.empty).flatMap((range) => [{ from: range.from, insert: text }, { from: range.to, insert: closer }]));
  view.dispatch({ changes, selection: selection.map(changes), userEvent: "input.type", scrollIntoView: true });
  return true;
});

// ---- Folding in Markdown -----------------------------------------------------------------------------------------------------------
const SEPARATOR = /^-{3,}[ \t]*$/;

const FRONT_END = /^(---|\.\.\.)\s*$/;
const foldIndexes = new WeakMap();

/**
 * Every foldable range of a Markdown text, by the number of the line it starts on, from one pass over the lines (SPEC 6.8): the front matter (from its
 * opening line), a fenced block (from its opening fence) and a slide (from its first line to the last line before the next `---`). A `---` inside a
 * fence or the front matter is not a separator. A fence that is also the first line of a slide folds as the fence.
 */
export function markdownFoldIndex(doc) {
  const cached = foldIndexes.get(doc);
  if (cached) return cached;
  const index = new Map();
  const range = (line, endLine) => ({ from: doc.line(line).to, to: doc.line(endLine).to });
  let front = false, fence = null, previous = null, slide = null, frontEnd = 0;
  const closeSlide = () => { if (slide && slide.last > slide.start) index.set(slide.start, range(slide.start, slide.last)); slide = null; };
  for (let number = 1; number <= doc.lines; number++) {
    const text = doc.line(number).text;
    // What this line is, from the state before it (as markdownLineKind): the opening line of the front matter is body.
    let kind = "body";
    if (front) kind = FRONT_END.test(text) ? "body" : "front";
    else if (fence) kind = new RegExp(`^ {0,3}${fence.char}{${fence.length},}\\s*$`).test(text) ? "body" : fence.yaml ? "yaml-fence" : "fence";
    const blank = text.trim() === "";
    if (kind === "body" && !blank) {
      if (SEPARATOR.test(text)) closeSlide();
      else {
        const startsSlide = !previous || ((SEPARATOR.test(previous.text) || /^\.\.\.\s*$/.test(previous.text)) && previous.kind === "body");
        if (!slide && startsSlide) slide = { start: number, last: number };
      }
    }
    if (slide && !blank && !(kind === "body" && SEPARATOR.test(text))) slide.last = number;
    if (!blank) previous = { text, kind };
    // The state after this line.
    if (number === 1 && /^---\s*$/.test(text)) {
      front = true;
      for (let at = 2; at <= doc.lines; at++) if (FRONT_END.test(doc.line(at).text)) { frontEnd = at; break; }
      if (frontEnd > 2) index.set(1, range(1, frontEnd - 1));
    } else if (front) {
      if (FRONT_END.test(text)) front = false;
    } else if (fence) {
      if (new RegExp(`^ {0,3}${fence.char}{${fence.length},}\\s*$`).test(text)) {
        if (number > fence.start + 1) index.set(fence.start, range(fence.start, number - 1));
        fence = null;
      }
    } else {
      const open = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(text);
      if (open && !(open[2][0] === "`" && open[3].includes("`"))) fence = { char: open[2][0], length: open[2].length, yaml: /^\s*opf-(?:slide|block)\b/.test(open[3]), start: number };
    }
  }
  // A fence never closed folds to the end of the text.
  if (fence && fence.start < doc.lines) index.set(fence.start, range(fence.start, doc.lines));
  closeSlide();
  foldIndexes.set(doc, index);
  return index;
}

export const markdownFolding = foldService.of((state, lineStart) => markdownFoldIndex(state.doc).get(state.doc.lineAt(lineStart).number) ?? null);
