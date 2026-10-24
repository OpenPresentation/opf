import { Annotation, ChangeSet, Compartment, EditorSelection, EditorState, Prec, StateEffect, StateField, Transaction, countColumn } from "@codemirror/state";
import { Decoration, EditorView, crosshairCursor, drawSelection, keymap, lineNumbers, rectangularSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentLess, indentMore, insertNewlineAndIndent, isolateHistory, redo, undo, undoDepth } from "@codemirror/commands";
import { HighlightStyle, StreamLanguage, bracketMatching, codeFolding, foldKeymap, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { acceptCompletion, autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, completionStatus, moveCompletionSelection, startCompletion } from "@codemirror/autocomplete";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { linter } from "@codemirror/lint";
import { tags } from "@lezer/highlight";
import { findNodeAtOffset, getNodePath, parseTree } from "jsonc-parser";
import {jsonSource,jsonSourceHistory,setJsonSource} from './json-source.js';
import {textInputMap} from './text-input.js';
import {detectIndent,formatJsonSource,whitespaceEdits} from './json-format.js';
const external = Annotation.define();
const hoverField = StateEffect.define();
const activeField = StateField.define({ create: () => null, update: (value, tr) => tr.effects.reduce((value2, effect) => effect.is(hoverField) ? effect.value : value2, value) });
const highlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, class: "tok-key" },
  { tag: tags.string, class: "tok-str" },
  { tag: [tags.number, tags.bool, tags.null], class: "tok-num" },
  { tag: tags.punctuation, class: "tok-punct" },
  { tag: tags.bracket, class: "tok-brace" },
  { tag: tags.comment, class: "tok-comment" },
  { tag: tags.heading, class: "tok-head" },
  { tag: [tags.meta, tags.keyword, tags.operator], class: "tok-meta" }
]);
// OPF Markdown: front matter, "---" slide rules, headings, fences, lists and HTML comments. A small stream tokenizer
// keeps the bundle free of the full Markdown grammar (and of the HTML, CSS and JavaScript grammars it embeds).
const markdownLanguage = StreamLanguage.define({
  name: "opf-markdown",
  startState: () => ({ line: 0, front: 0, fence: null, comment: false }),
  token(stream, state) {
    if (state.comment) {
      if (stream.match(/^.*?-->/)) state.comment = false; else stream.skipToEnd();
      return "comment";
    }
    if (stream.sol()) {
      state.line++;
      if (state.fence) {
        if (stream.match(/^(```|~~~)\s*$/)) { state.fence = null; return "meta"; }
        stream.skipToEnd();
        return "string";
      }
      if (stream.match(/^---\s*$/)) {
        if (state.front === 1) state.front = 2; else if (state.line === 1) state.front = 1;
        return "meta";
      }
      if (stream.match(/^(```|~~~)/)) { state.fence = "fence"; stream.skipToEnd(); return "meta"; }
      if (state.front === 1) {
        if (stream.match(/^\s*[\w$.-]+(?=:)/)) return "property";
        stream.next();
        return null;
      }
      if (stream.match(/^#{1,6}\s.*$/)) return "heading";
      if (stream.match(/^\s*([-*+]|\d+\.)\s/)) return "operator";
      if (stream.match(/^Notes?:/)) return "keyword";
      if (stream.match(/^>\s?/)) return "operator";
    }
    if (stream.match("<!--")) {
      if (!stream.match(/^.*?-->/)) { stream.skipToEnd(); state.comment = true; }
      return "comment";
    }
    if (stream.match(/^`[^`]*`/)) return "string";
    stream.next();
    return null;
  }
});
function languageExtension(name, completions) {
  if (name === "yaml") return yaml();
  if (name === "markdown") return markdownLanguage;
  return [json(), linter(jsonParseLinter(), { delay: 500 }), fieldDecorations, completions ?? []];
}
// Tab or Enter pressed right after a keystroke can arrive before the completion query that keystroke started has answered (with the data
// loaded it answers within a task or two). Accepting then waits for the answer instead of inserting whitespace or a line over a list that is
// about to open; when no list comes, `fallback` does what the key does without a list.
function acceptOrFallBack(isReady, fallback) {
  return (view) => {
    if (acceptCompletion(view)) return true;
    if (completionStatus(view.state) !== "pending" || !isReady()) return false;
    let tries = 0;
    const settle = () => {
      if (!view.dom.isConnected) return;
      if (completionStatus(view.state) === "pending" && ++tries < 50) { setTimeout(settle, 2); return; }
      if (!acceptCompletion(view)) fallback(view);
    };
    setTimeout(settle, 0);
    return true;
  };
}
// Completion keys, as in VS Code: Tab and Enter accept the selected suggestion, Escape closes the list, Ctrl+Space (and Cmd+I on macOS) opens it
// wherever the schema has something to offer, and the arrows, the Page keys and Ctrl+N and Ctrl+P (macOS) move the selection. Without a list,
// none of them is taken: Tab then inserts whitespace and Enter inserts a line.
function completionKeys(isReady) {
  return Prec.highest(keymap.of([
    ...completionKeymap.filter((binding) => binding.key !== "Enter"),
    { key: "Enter", run: acceptOrFallBack(isReady, (view) => nextStringItem(view) || insertNewlineAndIndent(view)) },
    { key: "Tab", run: acceptOrFallBack(isReady, tabCommand) },
    { mac: "Mod-i", run: startCompletion },
    { mac: "Ctrl-n", run: moveCompletionSelection(true) },
    { mac: "Ctrl-p", run: moveCompletionSelection(false) },
  ]));
}
// Accept a completion by rewriting its whole token (quotes included), so a string key, a bare word and a changed value type all land
// as valid JSON. A key adds ": " when none follows and then offers the values of that key. The quotes are read from the text when the
// completion is applied, because the list is reused while the author keeps typing the same token.
function completionApply(found, option) {
  return (view, completion, from, to) => {
    const { state } = view;
    const start = found.quoted && state.sliceDoc(from - 1, from) === '"' ? from - 1 : from;
    const end = found.quoted && state.sliceDoc(to, to + 1) === '"' ? to + 1 : to;
    let insert = JSON.stringify(option.value);
    const chain = found.kind === "key" && !/^\s*:/.test(state.sliceDoc(end, Math.min(state.doc.length, end + 200)));
    if (chain) insert += ": ";
    view.dispatch({ changes: { from: start, to: end, insert }, selection: { anchor: start + insert.length }, userEvent: "input.complete", scrollIntoView: true });
    if (chain) setTimeout(() => startCompletion(view), 0);
  };
}
// A quoted token keeps its list for any text between the quotes; a bare word for word characters only.
const QUOTED_TEXT = /^[^"\\\n\r]*$/;
const WORD_TEXT = /^[A-Za-z0-9_.-]*$/;
const DEFAULT_INDENT = "  ";
const tabWidth = (unit) => (unit === "\t" ? 4 : unit.length);
// Tab without a completion list (VS Code's `tab`): whitespace goes in at the caret, up to the next tab stop, and replaces a selection inside
// one line; a selection over several lines, or one line in full, is indented line by line. Every selection range does the same.
function tabCommand(view) {
  const { state } = view;
  if (state.readOnly) return false;
  const unit = state.facet(indentUnit), size = state.tabSize;
  const lineWise = state.selection.ranges.some((range) => {
    if (range.empty) return false;
    const first = state.doc.lineAt(range.from), last = state.doc.lineAt(range.to);
    return first.number !== last.number || (range.from === first.from && range.to === first.to && first.length > 0);
  });
  if (lineWise) {
    // Indent the lines; a selection that began at the start of its line still does, so it keeps covering whole lines.
    const wholeStart = state.selection.ranges.map((range) => !range.empty && range.from === state.doc.lineAt(range.from).from);
    if (!indentMore(view)) return false;
    const after = view.state.selection;
    view.dispatch({ selection: EditorSelection.create(after.ranges.map((range, index) => (wholeStart[index] ? EditorSelection.range(view.state.doc.lineAt(range.from).from, range.to) : range)), after.mainIndex) });
    return true;
  }
  const change = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from);
    const column = countColumn(state.sliceDoc(line.from, range.from), size);
    const insert = unit === "\t" ? "\t" : " ".repeat(unit.length - (column % unit.length));
    return { changes: { from: range.from, to: range.to, insert }, range: EditorSelection.cursor(range.from + insert.length) };
  });
  view.dispatch(state.update(change, { scrollIntoView: true, userEvent: "input" }));
  return true;
}
function sourceDecorations(state) {
  const ranges = [];
  const lines = /* @__PURE__ */ new Set();
  const active = state.field(activeField);
  function visit(node) {
    if (node.type === "property" && node.children?.[1]) {
      const key = node.children[0], path = getNodePath(node.children[1]);
      const field = path.map((part, i) => typeof part === "number" ? `[${part}]` : `${i ? "." : ""}${part}`).join("");
      ranges.push(Decoration.mark({ class: `code-key${field === active ? " is-active" : ""}`, attributes: { "data-field": field } }).range(key.offset, key.offset + key.length));
      if (active && (field === active || field.startsWith(`${active}.`) || field.startsWith(`${active}[`))) {
        const last = state.doc.lineAt(node.offset + node.length).number;
        for (let line = state.doc.lineAt(key.offset).number; line <= last; line++) lines.add(state.doc.line(line).from);
      }
    }
    node.children?.forEach(visit);
  }
  const root = parseTree(state.doc.toString());
  if (root) visit(root);
  for (const from of lines) ranges.push(Decoration.line({ class: "is-hover" }).range(from));
  return Decoration.set(ranges, true);
}
const fieldDecorations = StateField.define({
  create: sourceDecorations,
  update: (value, tr) => tr.docChanged || tr.effects.some((effect) => effect.is(hoverField)) ? sourceDecorations(tr.state) : value,
  provide: (field) => EditorView.decorations.from(field)
});
function nextStringItem(view) {
  const { state } = view, { from, to } = state.selection.main;
  if (from !== to || state.selection.ranges.length !== 1) return false;
  const source = state.doc.toString();
  try {
    JSON.parse(source);
  } catch {
    return false;
  }
  const root = parseTree(source);
  let node = findNodeAtOffset(root, Math.max(0, from - 1), true);
  if (node?.type !== "string") {
    node = findNodeAtOffset(root, Math.max(0, from - 2), true);
  }
  if (node?.type !== "string" || node.parent?.type !== "array" || !node.value) return false;
  const end = node.offset + node.length;
  if (from !== end - 1 && from !== end && !(from === end + 1 && source[end] === ",")) return false;
  const siblings = node.parent.children ?? [], hasNext = siblings.indexOf(node) < siblings.length - 1;
  const comma = /^\s*,/.exec(source.slice(end));
  if (hasNext && !comma) return false;
  const replaceTo = hasNext ? end + comma[0].length : end;
  const line = state.doc.lineAt(node.offset);
  const existingIndent = /^\s*/.exec(line.text)[0];
  const parentLine = state.doc.lineAt(node.parent.offset);
  const indent = line.number === parentLine.number ? /^\s*/.exec(parentLine.text)[0] + state.facet(indentUnit) : existingIndent;
  const inserted = `,
${indent}""${hasNext ? "," : ""}`;
  view.dispatch({
    changes: { from: end, to: replaceTo, insert: inserted },
    selection: { anchor: end + inserted.length - (hasNext ? 2 : 1) },
    annotations: [Transaction.userEvent.of("input.complete"), isolateHistory.of("full")],
    scrollIntoView: true
  });
  return true;
}
function skipDelimiter(view, delimiter) {
  const { from, empty } = view.state.selection.main;
  if (!empty || view.state.selection.ranges.length !== 1) return false;
  const source = view.state.doc.toString();
  if (source[from] !== delimiter) return false;
  try {
    JSON.parse(source);
  } catch {
    return false;
  }
  const node = findNodeAtOffset(parseTree(source), from, true);
  if (delimiter === '"' && (node?.type !== "string" || from !== node.offset + node.length - 1)) return false;
  if (delimiter === "," && node?.type === "string" && from < node.offset + node.length) return false;
  view.dispatch({ selection: { anchor: from + 1 }, scrollIntoView: true });
  return true;
}
function mountJsonCodeEditor(parent, options) {
  const attributes = new Compartment(), indent = new Compartment(), language = new Compartment(), editable = new Compartment(), historyField = new Compartment();
  const editableExtension = (readOnly) => [EditorState.readOnly.of(Boolean(readOnly)), EditorView.editable.of(!readOnly)];
  let languageName = options.language ?? "json";
  let disposed=false, menu=null, catalogs=options.catalogs??[], generation=0;
  // The indentation unit belongs to the document, not to the text as it is edited: JSON reads it once when a document is opened (here,
  // and when the host replaces the text), YAML and Markdown always use two spaces. Typing never changes it.
  let jsonIndent = detectIndent(options.code) ?? DEFAULT_INDENT;
  const unitOf = (name) => (name === "json" ? jsonIndent : DEFAULT_INDENT);
  const indentExtension = (name) => [indentUnit.of(unitOf(name)), EditorState.tabSize.of(tabWidth(unitOf(name)))];
  function closeOptions(){generation++;menu?.destroy();menu=null;}
  async function openOptions(left,top){
    closeOptions();
    if(disposed||languageName!=="json")return;
    if(options.onOptions){options.onOptions(left,top);return;}
    const revision=generation,source=api.getValue(),selection=api.getSelection();
    try{
      const {mountJsonFieldMenu}=await import('./json-menu.js');
      if(disposed||revision!==generation||source!==api.getValue()||selection.some((value,index)=>value!==api.getSelection()[index])||!api.hasFocus())return;
      menu=mountJsonFieldMenu(parent,api,catalogs,left,top,()=>{menu=null;});
    }catch(error){options.onError?.(error);}
  }
  // Live completions (JSON only, `completions: true`): property names and values at the cursor's JSON path, from the same data as the field
  // menu. The data loads with the field menu's chunk, at the first focus or the first query; once loaded, a query answers at once (no
  // promise), and the list stays valid while the author types within the same token (`validFor`), so typing only refilters it.
  let optionsModule = null, optionsLoading = null;
  const loadOptions = () => (optionsLoading ??= import('./json-options.js').then((module) => (optionsModule = module), (error) => { optionsLoading = null; throw error; }));
  function completionResult(context) {
    const found = optionsModule.getJsonCompletions(context.state.doc.toString(), context.pos, catalogs, { explicit: context.explicit });
    if (!found) return null;
    return { from: found.from, to: found.to, filter: true, validFor: found.quoted ? QUOTED_TEXT : WORD_TEXT, options: found.options.map((option) => ({
      label: option.label, detail: option.detail, info: option.info, boost: option.boost, type: found.kind === "key" ? "property" : "enum", apply: completionApply(found, option),
    })) };
  }
  function completionSource(context) {
    // One list for one cursor: with several, Tab and Enter keep their plain meaning at every cursor instead of completing at the main one only.
    if (disposed || languageName !== "json" || context.state.selection.ranges.length > 1) return null;
    if (optionsModule) return completionResult(context);
    return loadOptions().then(() => (disposed || context.aborted ? null : completionResult(context)), (error) => { options.onError?.(error); return null; });
  }
  // Undo and Redo run CodeMirror's history first. When it has nothing left, the host's fallback may step further (the source pane routes a whole-document replace to the session); a fallback answers true when it did something.
  const undoCommand = (target) => undo(target) || Boolean(options.historyFallback?.undo?.());
  const redoCommand = (target) => redo(target) || Boolean(options.historyFallback?.redo?.());
  const historyBindings = historyKeymap.map((binding) => binding.run === undo ? { ...binding, run: undoCommand } : binding.run === redo ? { ...binding, run: redoCommand } : binding);
  // Accept with no minimum delay: the list is already valid for the typed text, so Tab or Enter right after a keystroke accepts (VS Code does).
  const completionExtension = options.completions ? [autocompletion({ override: [completionSource], defaultKeymap: false, icons: false, maxRenderedOptions: 60, interactionDelay: 0, activateOnTypingDelay: 0 }), completionKeys(() => optionsModule !== null)] : null;
  const contentAttributes = (invalid = options.invalid, describedBy = options.describedBy) => EditorView.contentAttributes.of({
    "aria-label": options.label,
    "aria-invalid": String(Boolean(invalid)),
    "aria-describedby": describedBy ?? "",
    "aria-keyshortcuts": options.completions ? "Control+Space" : "Control+Space Alt+Shift+O",
    spellcheck: "false",
    autocapitalize: "off",
    autocorrect: "off"
  });
  // Format the document: the host's command (the source pane formats every language) or, standalone, the JSON formatter.
  const runFormat = () => { if (options.onFormat) options.onFormat(); else api.format(); return true; };
  // These chords are read from the event, not from CodeMirror's keymap: Alt changes the character a key produces on macOS, so the physical key counts.
  const letter = (event, name) => event.code === `Key${name.toUpperCase()}` || event.key.toLowerCase() === name;
  // Cmd/Ctrl+Shift+F (kept from earlier versions) and VS Code's Shift+Alt+F.
  const isFormatKey = (event) => event.shiftKey && !((event.metaKey || event.ctrlKey) && event.altKey) && (event.metaKey || event.ctrlKey || event.altKey) && letter(event, "f");
  // The field menu: Alt+Shift+O, a chord VS Code does not use.
  const isOptionsKey = (event) => event.altKey && event.shiftKey && !event.metaKey && !event.ctrlKey && letter(event, "o");
  const view = new EditorView({ parent, state: EditorState.create({ doc: options.code, extensions: [
    language.of(languageExtension(languageName, completionExtension)),
    editable.of(editableExtension(options.readOnly)),
    jsonSource.init(()=>options.code),jsonSourceHistory,
    indent.of(indentExtension(languageName)),
    indentOnInput(),
    historyField.of(history()),
    drawSelection(),
    // Multiple cursors, as in VS Code: Cmd/Ctrl+D, Cmd/Ctrl+Shift+L, Cmd/Ctrl+Alt+Up and Down, Alt+click (and Cmd/Ctrl+click), and Shift+Alt+drag for a column.
    EditorState.allowMultipleSelections.of(true),
    EditorView.clickAddsSelectionRange.of((event) => event.altKey || (/Mac|iPhone|iPad/.test(navigator.platform) ? event.metaKey : event.ctrlKey)),
    rectangularSelection({ eventFilter: (event) => event.altKey && event.shiftKey && event.button === 0 }),
    crosshairCursor(),
    bracketMatching(),
    closeBrackets(),
    codeFolding(),
    search({ top: true }),
    highlightSelectionMatches(),
    syntaxHighlighting(highlightStyle),
    activeField,
    attributes.of(contentAttributes()),
    options.lineNumbers ? lineNumbers() : [],
    EditorView.lineWrapping,
    // Some platforms report a lowercase key even with Shift held. Handle
    // formatting before the standard Mod-f search binding normalizes the key.
    Prec.high(EditorView.domEventHandlers({ keydown(event) {
      // A lowercase "z" with Shift can match CodeMirror's unshifted undo
      // binding first. Resolve redo before that fallback, even with older
      // undo steps still available (otherwise it silently performs undo).
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        redoCommand(view);
        return true;
      }
      if (isFormatKey(event)) {
        event.preventDefault();
        runFormat();
        return true;
      }
      if (languageName === "json" && isOptionsKey(event)) {
        event.preventDefault();
        void openOptions();
        return true;
      }
      return false;
    } })),
    keymap.of([
      { key: "Enter", run: nextStringItem },
      { key: '"', run: (view2) => skipDelimiter(view2, '"') },
      { key: ",", run: (view2) => skipDelimiter(view2, ",") },
      // The field menu (a searchable dialog of the choices of one field) is on Alt+Shift+O, a chord VS Code does not use. With completions off
      // it is also on Ctrl+Space, because the list is not there to take that key.
      ...(options.completions ? [] : [{ key: "Ctrl-Space", run: () => languageName === "json" && (void openOptions(), true) }, { key: "Mod-Space", run: () => languageName === "json" && (void openOptions(), true) }]),
      { key: "Tab", run: tabCommand, shift: indentLess },
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyBindings,
      ...searchKeymap,
      ...foldKeymap
    ]),
    EditorView.domEventHandlers({
      paste(event){
        if(!event.clipboardData||view.state.selection.ranges.length!==1)return false;
        const text=event.clipboardData.getData('text/plain');
        if(!text)return false;
        event.preventDefault();api.replace(...api.getSelection(),text,{userEvent:'input.paste'});return true;
      },
      focus() {
        if (options.completions) void loadOptions().catch(() => {});
        options.onFocus?.();
      },
      mousemove(event) {
        options.onHoverField?.(event.target.closest("[data-field]")?.dataset.field ?? null);
      },
      mouseleave() {
        options.onHoverField?.(null);
      }
    }),
    EditorView.updateListener.of((update) => {
      if(update.docChanged||update.selectionSet)closeOptions();
      // Tests and hosts wait on this: a completion query is still running.
      const busy = completionStatus(update.state) === "pending", dom = update.view.dom;
      if (busy !== (dom.dataset.opfBusy === "1")) { if (busy) dom.dataset.opfBusy = "1"; else delete dom.dataset.opfBusy; }
      if (update.docChanged && !update.transactions.every((tr) => tr.annotation(external))) options.onChange(update.state.field(jsonSource));
    })
  ] }) });
  const api = {
    getValue: () => view.state.field(jsonSource),
    getSelection: () => {const map=textInputMap(api.getValue());return [map.toSource(view.state.selection.main.from),map.toSource(view.state.selection.main.to)];},
    hasFocus: () => view.hasFocus,
    focus: () => view.focus(),
    setSelection: (from, to=from) => {const map=textInputMap(api.getValue());view.dispatch({ selection: EditorSelection.single(map.toInput(from),map.toInput(to)), scrollIntoView: true });},
    // `keepSelection` leaves the cursor where the edit maps it (a format keeps it on the same token) instead of moving it to the end of the new text.
    // `userEvent` names the edit; the default is not "input.complete" or "input.type", which would run indentOnInput over the inserted lines and make
    // the text differ from the source the edit declares (a pasted block ending in "}" was dropped that way).
    replace: (from, to, text, { keepSelection = false, userEvent = "input.replace" } = {}) => {
      const source=api.getValue(),map=textInputMap(source),a=map.toInput(from),b=map.toInput(to);
      if(to<from||map.toSource(a)!==from||map.toSource(b)!==to)throw new RangeError('JSON edits must use source boundaries outside a CRLF pair.');
      const insert=textInputMap(text).text,next=source.slice(0,from)+text+source.slice(to);
      view.dispatch({changes:{from:a,to:b,insert},...(keepSelection?{}:{selection:{anchor:a+insert.length}}),effects:setJsonSource.of(next),
        annotations:[Transaction.userEvent.of(userEvent),isolateHistory.of('full')],scrollIntoView:true});
    },
    /** The indentation unit now in effect: a tab character or some spaces. */
    indentUnit: () => view.state.facet(indentUnit),
    coordinates: () => {
      const rect = view.coordsAtPos(view.state.selection.main.head) ?? parent.getBoundingClientRect();
      return { left: rect.left, top: rect.bottom + 8 };
    },
    format: () => {
      if (languageName !== "json") return false;
      // jsonc-parser formats tokens, so it also lays out a draft that does not parse yet.
      api.replaceDiff(formatJsonSource(api.getValue(), view.state.facet(indentUnit)));
      return true;
    },
    /**
     * Replace the whole text with `next` as one undoable edit. When `next` differs only in whitespace (a format), each run of whitespace that
     * changed is its own change, so the cursor stays on its token; otherwise only the part that differs is replaced.
     */
    replaceDiff: (next) => {
      const source = api.getValue();
      if (source === next) return;
      const edits = whitespaceEdits(source, next);
      if (edits) {
        const map = textInputMap(source);
        try {
          const changes = ChangeSet.of(edits.map((edit) => ({ from: map.toInput(edit.from), to: map.toInput(edit.to), insert: textInputMap(edit.insert).text })), view.state.doc.length);
          view.dispatch({ changes, selection: view.state.selection.map(changes, 1), effects: setJsonSource.of(next), annotations: [Transaction.userEvent.of("input.format"), isolateHistory.of("full")], scrollIntoView: true });
          return;
        } catch (error) {
          // An edit that splits a CRLF pair: replace the differing middle instead.
          if (!(error instanceof RangeError)) throw error;
        }
      }
      let from = 0, end = source.length, nextEnd = next.length;
      while (from < end && from < nextEnd && source[from] === next[from]) from++;
      while (end > from && nextEnd > from && source[end - 1] === next[nextEnd - 1]) { end--; nextEnd--; }
      if (source[from - 1] === "\r" && source[from] === "\n") from--;
      if (source[end - 1] === "\r" && source[end] === "\n") { end++; nextEnd++; }
      api.replace(from, end, next.slice(from, nextEnd), { keepSelection: true, userEvent: "input.format" });
    }
  };
  return {
    api,
    openOptions,
    setCatalogs(value){catalogs=value??[];closeOptions();},
    /** Switch the highlighting between "json" (with its parse linter, field highlights and option menu), "yaml" and "markdown". */
    setLanguage(name){
      if(name===languageName)return;
      languageName=name;closeOptions();
      view.dispatch({ effects: [language.reconfigure(languageExtension(name, completionExtension)), indent.reconfigure(indentExtension(name))] });
    },
    /** Forget the typed edits CodeMirror can undo (the text they were typed against is gone). Returns nothing; the document is unchanged. */
    resetHistory(){
      view.dispatch({ effects: historyField.reconfigure([]) });
      view.dispatch({ effects: historyField.reconfigure(history()) });
    },
    /** How many typed edit groups CodeMirror can still undo. */
    undoDepth: () => undoDepth(view.state),
    setReadOnly(value){view.dispatch({ effects: editable.reconfigure(editableExtension(value)) });},
    /** The CodeMirror view, for hosts that scroll or measure it. */
    view,
    update(code, invalid=false, field=null, describedBy) {
      if(code!==api.getValue())closeOptions();
      const current = view.state.doc.toString(), normalized=textInputMap(code).text;
      const effects = [attributes.reconfigure(contentAttributes(invalid, describedBy)), hoverField.of(field),setJsonSource.of(code)];
      // A different text is a different document (or a rewrite of it by the host): read its indentation again. The same text, which the host
      // passes after every applied edit to refresh the attributes, keeps the unit.
      if (current !== normalized) {
        const detected = detectIndent(code);
        if (detected && detected !== jsonIndent) {
          jsonIndent = detected;
          if (languageName === "json") effects.push(indent.reconfigure(indentExtension("json")));
        }
      }
      if (current === normalized) {
        view.dispatch({ effects });
        return;
      }
      let from = 0, oldEnd = current.length, newEnd = normalized.length;
      while (from < oldEnd && from < newEnd && current[from] === normalized[from]) from++;
      while (oldEnd > from && newEnd > from && current[oldEnd - 1] === normalized[newEnd - 1]) {
        oldEnd--;
        newEnd--;
      }
      view.dispatch({
        changes: { from, to: oldEnd, insert: normalized.slice(from, newEnd) },
        effects,
        annotations: [external.of(true), Transaction.addToHistory.of(false)]
      });
    },
    destroy: () => {if(disposed)return;disposed=true;closeOptions();view.destroy();}
  };
}
export {
  mountJsonCodeEditor
};
