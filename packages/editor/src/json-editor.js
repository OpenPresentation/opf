import { Annotation, ChangeSet, Compartment, EditorSelection, EditorState, Prec, StateEffect, StateField, Transaction, countColumn } from "@codemirror/state";
import { Decoration, EditorView, activateHover, closeHoverTooltips, crosshairCursor, drawSelection, hasHoverTooltips, hoverTooltip, keymap, lineNumbers, rectangularSelection } from "@codemirror/view";
import { defaultKeymap, deleteCharBackward, history, historyKeymap, indentLess, indentMore, insertNewlineAndIndent, isolateHistory, redo, selectAll, selectLine, selectParentSyntax, toggleTabFocusMode, undo, undoDepth } from "@codemirror/commands";
import { HighlightStyle, StreamLanguage, bracketMatching, codeFolding, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { acceptCompletion, autocompletion, closeBrackets, closeBracketsKeymap, closeCompletion, completionStatus, currentCompletions, deleteBracketPair, hasNextSnippetField, hasPrevSnippetField, moveCompletionSelection, nextSnippetField, prevSnippetField, startCompletion } from "@codemirror/autocomplete";
import { closeSearchPanel, gotoLine, highlightSelectionMatches, openSearchPanel, search, searchKeymap } from "@codemirror/search";
import { tags } from "@lezer/highlight";
import { findNodeAtOffset, getNodePath, parseTree } from "jsonc-parser";
import {jsonSource,jsonSourceHistory,setJsonSource} from './json-source.js';
import {textInputMap} from './text-input.js';
import {detectIndent,formatJsonSource,whitespaceEdits} from './json-format.js';
import { redoPair, undoPair } from "./source-undo-groups.js";
import {a11yExtension,createAnnouncer} from './source-a11y.js';
import { forEachDiagnostic } from "@codemirror/lint";
import {createDiagnostics,editsTransaction} from './source-diagnostics.js';
import { createKeymap, domKeymap, strokeText } from './source-keymap.js';
import { fold, foldEverything, foldGutterExtension, foldLevel, foldRecursively, toggleFoldHere, unfold, unfoldEverything, unfoldRecursively } from './source-folding.js';
import {languageDataFor,markdownBackspace,markdownEnter,markdownFolding,markdownTab,markdownToggleComment,markdownWrapSelection,yamlEnter} from './source-editing.js';
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
  if (name === "yaml") return [yaml(), languageDataFor("yaml"), completions ?? []];
  if (name === "markdown") return [markdownLanguage, languageDataFor("markdown"), markdownWrapSelection, markdownFolding, completions ?? []];
  return [json(), fieldDecorations, completions ?? []];
}
// The name the completion engine knows a language by.
const formatOf = (name) => (name === "markdown" ? "md" : name);
// Tab or Enter pressed right after a keystroke can arrive before the completion query that keystroke started has answered (with the data
// loaded it answers within a task or two). Accepting then waits for the answer instead of inserting whitespace or a line over a list that is
// about to open; when no list comes, `fallback` does what the key does without a list.
// The wait is cut short by the next key: a key that follows at once (a typed line break, a paste of keystrokes) must find the text the held key made, so
// the held key runs first, as if no list had been coming.
const heldKeys = new WeakMap();
function acceptOrFallBack(isReady, fallback) {
  return (view) => {
    if (acceptCompletion(view)) return true;
    if (completionStatus(view.state) !== "pending" || !isReady()) return fallback(view);
    let tries = 0, done = false, timer = 0;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      heldKeys.delete(view);
      if (!view.dom.isConnected) return;
      if (!acceptCompletion(view)) fallback(view);
    };
    const settle = () => {
      if (done || !view.dom.isConnected) return;
      if (completionStatus(view.state) === "pending" && ++tries < 50) { timer = setTimeout(settle, 2); return; }
      finish();
    };
    heldKeys.set(view, finish);
    timer = setTimeout(settle, 0);
    return true;
  };
}
// Runs before every key binding: the key held for the list (see acceptOrFallBack) goes first.
const releaseHeldKey = EditorView.domEventHandlers({ keydown(_event, view) { heldKeys.get(view)?.(); return false; } });
// The documentation panel beside the selected item is shown by default (VS Code's `suggest.showInlineDetails`); Ctrl+Space with the list open
// hides or shows it (`toggleSuggestionDetails`). The choice is the editor's, not the list's, so it stays across lists.
function toggleDocs(view) {
  const hidden = view.dom.classList.toggle("opf-docs-off");
  view.dom.dataset.opfDocs = hidden ? "off" : "on";
  return true;
}
const listIsOpen = (state) => completionStatus(state) === "active" && currentCompletions(state).length > 0;
// Left and Right inside the word being completed move the caret and keep the list, which then filters by the text before the caret (VS Code).
// A move that leaves the word (or the line) is the plain move, which closes the list. The move is dispatched as typing without a change, which
// is the one transaction the completion state keeps its result for.
function moveInToken(forward, tokenOf) {
  return (view) => {
    const { state } = view, range = state.selection.main;
    if (!listIsOpen(state) || state.selection.ranges.length !== 1 || !range.empty) return false;
    const target = view.moveByChar(range, forward);
    if (target.head === range.head) return false;
    const text = state.doc.toString(), here = tokenOf(text, range.head), there = tokenOf(text, target.head);
    if (!here || !there || here.start !== there.start) return false;
    view.dispatch({ selection: { anchor: target.head }, userEvent: "input.type", scrollIntoView: true });
    // Ask again at the new caret, so the list filters by the text before it.
    startCompletion(view);
    return true;
  };
}
// Backspace with the list open deletes and asks again, so the list widens as the word shrinks (the completion state alone closes the list
// when the caret goes back past the place it was opened).
function backspaceInToken(tokenOf) {
  return (view) => {
    if (!listIsOpen(view.state) || view.state.selection.ranges.length !== 1 || !view.state.selection.main.empty) return false;
    if (!(deleteBracketPair(view) || deleteCharBackward(view))) return false;
    const { state } = view;
    if (tokenOf(state.doc.toString(), state.selection.main.head)) startCompletion(view);
    return true;
  };
}
// Completion keys, as in VS Code: Tab and Enter accept the selected suggestion (Shift+Tab and Shift+Enter accept it too: in a JSON string the
// accepted item always replaces the whole token), Escape closes the list, Ctrl+Space (and Cmd+I on macOS) opens it wherever the schema has
// something to offer and, with the list open, shows or hides its documentation, and the arrows, the Page keys and Ctrl+N and Ctrl+P (macOS)
// move the selection. Without a list, none of them is taken: Tab then inserts whitespace (or walks the stops of a snippet) and Enter inserts
// a line. The keys come from the table in source-keymap.js.
function completionKeys(km, isReady, tokenOf, onStep, { newline, tab }) {
  // Tab and Shift+Tab walk the tab stops of a snippet; the engine says which stop it is and opens the list at a stop that is a choice.
  const walk = (forward, fallback) => (view) => {
    if (forward ? hasNextSnippetField(view.state) && nextSnippetField(view) : hasPrevSnippetField(view.state) && prevSnippetField(view)) { onStep(view, forward); return true; }
    return fallback(view);
  };
  const enter = newline;
  km.note("suggest.details");
  km.note("snippet.next");
  km.note("snippet.previous");
  return Prec.highest([releaseHeldKey, keymap.of([
    ...km.bind("suggest.dismiss", closeCompletion),
    ...km.bind("suggest.next", moveCompletionSelection(true)),
    ...km.bind("suggest.previous", moveCompletionSelection(false)),
    ...km.bind("suggest.nextPage", moveCompletionSelection(true, "page")),
    ...km.bind("suggest.previousPage", moveCompletionSelection(false, "page")),
    // Ctrl+Space opens the list, or shows and hides the documentation when it is open; Cmd+I (macOS) opens it again.
    ...km.bind("suggest.trigger", [(view) => (listIsOpen(view.state) ? toggleDocs(view) : startCompletion(view)), startCompletion]),
    ...km.bind("suggest.accept", [acceptOrFallBack(isReady, walk(true, tab)), acceptOrFallBack(isReady, enter)]),
    ...km.bind("suggest.acceptReplace", [acceptOrFallBack(isReady, walk(false, indentLess)), acceptOrFallBack(isReady, insertNewlineAndIndent)]),
    { key: "ArrowLeft", run: moveInToken(false, tokenOf) },
    { key: "ArrowRight", run: moveInToken(true, tokenOf) },
    { key: "Backspace", run: backspaceInToken(tokenOf) },
  ])]);
}
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
  // Every key binding is declared in source-keymap.js; `km` records what this editor installs, for getShortcuts() and the shortcuts dialog.
  const km = createKeymap();
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
  // Live completions (JSON only, `completions: true`): property names and values at the cursor's JSON path, from the schema and the catalogs, with
  // templates and snippets (source-completions.js). The engine loads at the first focus or the first query; once loaded, a query answers at once
  // (no promise), and the list stays valid while the author types within the same token (`validFor`), so typing only refilters it.
  let optionsModule = null, optionsLoading = null;
  const loadOptions = () => (optionsLoading ??= import('./source-completions.js').then((module) => (optionsModule = module), (error) => { optionsLoading = null; throw error; }));
  const applyOption = (target, completion, from, to) => optionsModule.applyCompletion(target, completion, from, to, say, formatOf(languageName));
  // Hover: the schema's words over a key, the record's over a catalog id. A problem under the pointer is the lint tooltip's (message, next, fixes).
  const problemAt = (state, position) => { let hit = false; forEachDiagnostic(state, (_diagnostic, from, to) => { if (position >= from && position <= to) hit = true; }); return hit; };
  const hoverExtension = options.hover === false ? [] : hoverTooltip(async (target, position) => {
    if (disposed || problemAt(target.state, position)) return null;
    if (!optionsModule) { try { await loadOptions(); } catch { return null; } }
    return optionsModule.hoverAt(target.state, position, { catalogs, format: formatOf(languageName) });
  }, { hoverTime: 300 });
  // Cmd/Ctrl+K Cmd/Ctrl+I shows the hover at the caret (VS Code), and says what it holds.
  const showHoverAtCaret = (target) => {
    if (options.hover === false) return false;
    const run = () => {
      const position = target.state.selection.main.head;
      const found = optionsModule.hoverModelAt(target.state, position, { catalogs, format: formatOf(languageName) });
      if (!found) { say("No hover information here"); return; }
      activateHover(target, found.from, 1, { tooltip: hoverExtension, until: (tr) => tr.docChanged || (tr.selection !== undefined && tr.newSelection.main.head !== position) });
      say(optionsModule.docText(found.model));
    };
    if (optionsModule) run(); else loadOptions().then(run, () => {});
    return true;
  };
  function completionResult(context) {
    const found = optionsModule.completionResult(context.state, context.pos, { explicit: context.explicit, catalogs, format: formatOf(languageName) });
    if (!found) return null;
    for (const option of found.options) option.apply = applyOption;
    return found;
  }
  function completionSource(context) {
    if (disposed || context.state.readOnly) return null;
    if (optionsModule) return completionResult(context);
    return loadOptions().then(() => (disposed || context.aborted ? null : completionResult(context)), (error) => { options.onError?.(error); return null; });
  }
  // Undo and Redo run CodeMirror's history first. When it has nothing left, the host's fallback may step further (the source pane routes a whole-document replace to the session); a fallback answers true when it did something.
  const undoCommand = (target) => undoPair(target) || undo(target) || Boolean(options.historyFallback?.undo?.());
  const redoCommand = (target) => redoPair(target) || redo(target) || Boolean(options.historyFallback?.redo?.());
  // Accept with no minimum delay: the list is already valid for the typed text, so Tab or Enter right after a keystroke accepts (VS Code does).
  // Screen reader announcements and the problems drawn in the text (squiggles, F8, Cmd/Ctrl+.). The pane supplies the problems.
  const announcer = createAnnouncer(parent, options.announce);
  const say = (message) => announcer.say(message);
  const applyProblemFix = (fix, problem) => {
    if (disposed || view.state.readOnly) return;
    if (typeof fix.run === "function") { fix.run(api, problem); return; }
    if (fix.edits?.length) {
      view.dispatch(editsTransaction(view.state, api.getValue(), fix.edits, { caret: fix.caret, select: fix.select }));
      view.focus();
      say(`${fix.title} applied`);
    }
  };
  const diagnostics = createDiagnostics({ getSource: () => view.state.field(jsonSource), say, applyFix: applyProblemFix, km });
  // On its own (no source pane to supply the problems) the editor underlines the syntax errors of JSON: one per cause, 300 ms after the last key.
  let syntaxTimer = null;
  function scheduleSyntax() {
    if (options.syntaxProblems === false) return;
    clearTimeout(syntaxTimer);
    syntaxTimer = setTimeout(async () => {
      if (disposed || languageName !== "json") return;
      try {
        const { analyzeSyntax } = await import('./source-syntax.js');
        if (disposed || languageName !== "json") return;
        const source = api.getValue();
        diagnostics.draw(view, analyzeSyntax(source).map((problem) => ({ from: problem.range.from, to: problem.range.to, severity: "error", message: problem.message, next: problem.next, rule: problem.ruleId,
          fixes: (problem.editFixes ?? []).filter((fix) => !fix.action).map((fix) => ({ id: fix.id, title: fix.title, safe: fix.safe, edits: fix.edits, caret: fix.caret })) })));
      } catch (error) { options.onError?.(error); }
    }, 300);
  }
  // Enter and Tab by language: JSON continues a list of strings, YAML and Markdown indent the way their text is built (source-editing.js).
  const smart = options.smartListEnter !== false;
  const newlineCommand = (target) => (languageName === "json" ? smart && nextStringItem(target) : languageName === "yaml" ? yamlEnter(target, { lists: smart }) : markdownEnter(target, { lists: smart }));
  const tabCommandFor = (target) => (languageName === "markdown" && markdownTab(target)) || tabCommand(target);
  const completionExtension = options.completions ? [autocompletion({ override: [completionSource], defaultKeymap: false, icons: false, maxRenderedOptions: 60, interactionDelay: 0, activateOnTypingDelay: 0 }), completionKeys(km, () => optionsModule !== null, (text, position) => optionsModule?.tokenFor(formatOf(languageName), text, position), (target, forward) => optionsModule?.snippetStep(target, forward, { say }), { newline: (target) => newlineCommand(target) || insertNewlineAndIndent(target), tab: (target) => tabCommandFor(target) })] : null;
  // Format the document: the host's command (the source pane formats every language) or, standalone, the JSON formatter.
  const runFormat = () => { if (options.onFormat) options.onFormat(); else api.format(); return true; };

  // ---- Features loaded on first use (go to definition and rename, the shape hint, the symbol picker, the shortcuts dialog). Each module exports commands
  // `(view, context) => boolean`; the context is what the editor knows.
  const lazy = (load) => { const slot = { module: null, loading: null, load: () => (slot.loading ??= load().then((module) => (slot.module = module), (error) => { slot.loading = null; throw error; })) }; return slot; };
  const modules = { navigation: lazy(() => import('./source-navigation.js')), hints: lazy(() => import('./source-hints.js')), outline: lazy(() => import('./source-outline.js')), shortcuts: lazy(() => import('./source-shortcuts.js')) };
  const featureContext = () => ({ format: formatOf(languageName), catalogs, say, api, options, view, platform: km.platform, getShortcuts: (platform) => km.shortcuts(platform), readOnly: view.state.readOnly });
  /** A command that runs `module[name](view, context)`, loading the module the first time. The key is always taken. */
  const feature = (moduleName, name) => (target) => {
    const slot = modules[moduleName];
    const run = () => { if (!disposed) slot.module[name]?.(target, featureContext()); };
    if (slot.module) run(); else slot.load().then(run, (error) => options.onError?.(error));
    return true;
  };
  const commentCommand = (target) => {
    if (languageName === "markdown") return markdownToggleComment(target, say);
    // JSON has no comments: say so instead of doing nothing (YAML and Markdown comment their lines out).
    if (languageName !== "json") return false;
    say("JSON has no comments. Use YAML or Markdown for notes.");
    return true;
  };
  // Insert line above (Cmd/Ctrl+Shift+Enter): a new line with the indentation of this one, above it, with the caret on it.
  const insertLineAbove = (target) => {
    const { state } = target;
    if (state.readOnly) return false;
    const update = state.changeByRange((range) => {
      const line = state.doc.lineAt(range.from), indent = /^\s*/.exec(line.text)[0];
      return { changes: { from: line.from, insert: `${indent}\n` }, range: EditorSelection.cursor(line.from + indent.length) };
    });
    target.dispatch(state.update(update, { scrollIntoView: true, userEvent: "input" }));
    return true;
  };
  // Expand selection (word, then each enclosing syntax node) and Shrink selection (back, one step at a time) as in VS Code.
  const expansions = new WeakMap();
  const expandSelection = (target) => {
    const before = target.state.selection, main = before.main;
    const word = main.empty ? target.state.wordAt(main.head) : null;
    if (word) target.dispatch({ selection: EditorSelection.single(word.from, word.to), scrollIntoView: true, userEvent: "select.expand" });
    else selectParentSyntax(target);
    if (target.state.selection.eq(before)) return true;
    const history = expansions.get(target) ?? [];
    expansions.set(target, [...(history.length && history.at(-1).after.eq(before) ? history : []), { before, after: target.state.selection }]);
    return true;
  };
  const shrinkSelection = (target) => {
    const history = expansions.get(target);
    const last = history?.at(-1);
    if (!last || !last.after.eq(target.state.selection)) { say("Nothing to shrink"); return true; }
    history.pop();
    target.dispatch({ selection: last.before, scrollIntoView: true, userEvent: "select.shrink" });
    return true;
  };

  // The keys VS Code reads from the event, so the physical key counts where Alt changes the character (macOS) and a lowercase letter is accepted
  // with Shift held (some platforms report it): redo, the problems panel, Format, the field menu, the symbol picker and the chords of Cmd/Ctrl+K.
  // A lowercase "z" with Shift can match CodeMirror's unshifted undo binding first, so redo resolves before it, even with older undo steps still available.
  km.bindDom("edit.redo", (target) => { redoCommand(target); return true; });
  km.bindDom("problem.panel", () => Boolean(options.onFocusProblems?.()));
  km.bindDom("hover.show", (target) => showHoverAtCaret(target));
  km.bindDom("format.document", () => runFormat());
  km.bindDom("edit.fieldMenu", () => { if (languageName !== "json") return false; void openOptions(); return true; });
  // Cmd/Ctrl+L: read from the event because a platform that reports Ctrl+Shift+L as a lowercase "l" would otherwise run it instead of Select All Occurrences.
  km.bindDom("select.line", (target) => selectLine(target));
  km.bindDom("nav.symbol", feature("outline", "showSymbolPicker"));
  km.bindDom("help.shortcuts", feature("shortcuts", "showShortcuts"));
  const saying = (run) => (target) => run(target, say);
  km.bindDom("fold.toggle", saying(toggleFoldHere));
  km.bindDom("fold.foldRecursively", saying(foldRecursively));
  km.bindDom("fold.unfoldRecursively", saying(unfoldRecursively));
  km.bindDom("fold.all", saying(foldEverything));
  km.bindDom("fold.unfoldAll", saying(unfoldEverything));
  for (let level = 1; level <= 7; level++) km.bindDom(`fold.level${level}`, saying(foldLevel(level)));
  const keydownKeys = Prec.high(domKeymap(km, say));

  // CodeMirror's own bindings, kept as they are except where the table gives a key to something else: the expand-selection key is ours, Ctrl+G goes to a
  // line (Find next is F3 and, on macOS, Cmd+G), and Fold All and Unfold All are chords. Undo and Redo run CodeMirror's history, then the host's.
  const mac = km.platform === "mac";
  const kept = {
    basic: defaultKeymap.filter((binding) => binding.run !== selectParentSyntax && binding.run !== selectLine),
    history: historyKeymap.filter((binding) => binding.run !== undo && binding.run !== redo),
    search: searchKeymap.filter((binding) => binding.run !== gotoLine && !(binding.key === "Mod-g" && !mac)),
  };
  const mainKeymap = keymap.of([
    ...km.bind("edit.enter", (target) => newlineCommand(target)),
    ...km.hidden([
      { key: '"', run: (view2) => languageName === "json" && skipDelimiter(view2, '"') },
      { key: ",", run: (view2) => languageName === "json" && skipDelimiter(view2, ",") },
      { key: "Backspace", run: (target) => languageName === "markdown" && markdownBackspace(target) },
      // The field menu (a searchable dialog of the choices of one field) is on Alt+Shift+O, a chord VS Code does not use. With completions off
      // it is also on Ctrl+Space, because the list is not there to take that key.
      ...(options.completions ? [] : [{ key: "Ctrl-Space", run: () => languageName === "json" && (void openOptions(), true) }, { key: "Mod-Space", run: () => languageName === "json" && (void openOptions(), true) }]),
    ]),
    ...km.bind("edit.tab", (target) => tabCommandFor(target)),
    ...km.bind("edit.shiftTab", indentLess),
    ...km.bind("lines.comment", commentCommand),
    ...km.bind("lines.insertAbove", insertLineAbove),
    ...km.bind("focus.toggleTab", toggleTabFocusMode),
    ...km.bind("nav.line", gotoLine),
    ...km.bind("select.expand", expandSelection),
    ...km.bind("select.shrink", shrinkSelection),
    ...km.bind("find.replace", openSearchPanel),
    ...km.bind("fold.fold", saying(fold)),
    ...km.bind("fold.unfold", saying(unfold)),
    ...km.bind("edit.undo", undoCommand),
    ...km.bind("hint.shape", feature("hints", "showShapeHint")),
    ...km.bind("nav.definition", feature("navigation", "goToDefinition")),
    ...km.bind("nav.peek", feature("navigation", "peekDefinition")),
    ...km.bind("nav.references", feature("navigation", "findReferences")),
    ...km.bind("nav.rename", feature("navigation", "renameSymbol")),
    ...km.hidden(closeBracketsKeymap),
    ...km.spread(kept.basic),
    ...km.spread(kept.history),
    ...km.spread(kept.search),
  ]);
  const shortcutAttribute = (ids) => ids.flatMap((id) => km.shortcuts().find((row) => row.id === id)?.strokes.slice(0, 1) ?? []).map((stroke) => strokeText(stroke, km.platform).replace(/Cmd/g, "Meta").replace(/Ctrl/g, "Control")).join(" ");
  const contentAttributes = (invalid = options.invalid, describedBy = options.describedBy) => EditorView.contentAttributes.of({
    "aria-label": options.label,
    "aria-invalid": String(Boolean(invalid)),
    "aria-describedby": describedBy ?? "",
    "aria-keyshortcuts": shortcutAttribute(["suggest.trigger", "problem.next", "problem.previous", "problem.quickFix", "format.document", "nav.symbol"]),
    "aria-description": options.completions ? `Press ${strokeText("Ctrl-Space", km.platform).replace("Ctrl", "Control")} for suggestions. Press F8 for the next problem. Press ${strokeText("Mod-k Mod-s", km.platform).replace(/Cmd/g, "Command").replace(/Ctrl/g, "Control")} for the keyboard shortcuts. Press Escape then Tab to leave the editor.` : "Press Escape then Tab to leave the editor.",
    spellcheck: "false",
    autocapitalize: "off",
    autocorrect: "off"
  });
  const view = new EditorView({ parent, state: EditorState.create({ doc: options.code, extensions: [
    // The problem menu's keys come before the list's: the two are never open together, and Enter must reach whichever is.
    diagnostics.extension,
    language.of(languageExtension(languageName, completionExtension)),
    hoverExtension,
    Prec.high(keymap.of([
      { key: "Escape", run: (target) => (hasHoverTooltips(target.state) ? (target.dispatch({ effects: closeHoverTooltips }), true) : false) },
    ])),
    a11yExtension(announcer, (completion) => completion.opfDoc ?? (typeof completion.info === "string" ? completion.info : "")),
    editable.of(editableExtension(options.readOnly)),
    jsonSource.init(()=>options.code),jsonSourceHistory,
    indent.of(indentExtension(languageName)),
    indentOnInput(),
    historyField.of(history()),
    drawSelection(),
    // Multiple cursors, as in VS Code: Cmd/Ctrl+D, Cmd/Ctrl+Shift+L, Cmd/Ctrl+Alt+Up and Down, Alt+click, and Shift+Alt+drag for a column.
    EditorState.allowMultipleSelections.of(true),
    // Alt+click adds a cursor (VS Code's default); Cmd/Ctrl+click goes to the definition.
    EditorView.clickAddsSelectionRange.of((event) => event.altKey),
    rectangularSelection({ eventFilter: (event) => event.altKey && event.shiftKey && event.button === 0 }),
    crosshairCursor(),
    bracketMatching(),
    closeBrackets(),
    codeFolding(),
    options.fold === false ? [] : foldGutterExtension,
    search({ top: true }),
    highlightSelectionMatches(),
    syntaxHighlighting(highlightStyle),
    activeField,
    attributes.of(contentAttributes()),
    options.lineNumbers ? lineNumbers() : [],
    EditorView.lineWrapping,
    keydownKeys,
    mainKeymap,
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
      mousedown(event, target) {
        // Cmd/Ctrl+click on an id goes to its definition (a click anywhere else is a plain click).
        const mod = km.platform === "mac" ? event.metaKey : event.ctrlKey;
        if (!mod || event.altKey || event.shiftKey || event.button !== 0 || event.detail > 1) return false;
        const position = target.posAtCoords({ x: event.clientX, y: event.clientY });
        if (position === null) return false;
        event.preventDefault();
        target.dispatch({ selection: { anchor: position } });
        target.focus();
        feature("navigation", "goToDefinition")(target);
        return true;
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
      if (update.docChanged) scheduleSyntax();
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
    /** Say `message` in the editor's live region. */
    say,
    /**
     * Apply several edits as one undoable change. `edits` are `{ from, to, insert }` in source offsets of the text as it is now; `caret` (or
     * `select: [from, to]`) is a position in the text after the edits.
     */
    applyEdits(edits, { caret, select, userEvent } = {}) {
      view.dispatch(editsTransaction(view.state, api.getValue(), edits, { caret, select, userEvent }));
    },
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
    /**
     * Draw the problems in the text: `{ from, to, severity, message, next?, rule?, fixes? }` with source offsets into the current text. A fix is
     * `{ id, title, safe?, edits?, caret?, select?, run? }`.
     */
    setProblems(problems){if(!disposed)diagnostics.draw(view,problems??[]);},
    /** The problems drawn now, in position order, at their current source offsets. */
    getProblems:()=>diagnostics.problems(view).map(({diagnostic,...problem})=>problem),
    nextProblem:()=>diagnostics.next(view),
    previousProblem:()=>diagnostics.previous(view),
    /** Open the quick fix list for the problems at the caret (Cmd/Ctrl+.). */
    triggerQuickFix:()=>diagnostics.openMenu(view),
    /** Open the suggestion list at the caret (Ctrl+Space). */
    triggerCompletion:()=>startCompletion(view),
    /**
     * Every key binding this editor installed, for `platform` ("mac", "win" or "linux"; default: the page's): `{ id, title, group, keys, symbols, strokes,
     * when? }` in the order of the shortcuts list. The same table installs the keys, so the list is the keymap.
     */
    getShortcuts:(platform)=>km.shortcuts(platform),
    /** Bindings the editor installed that have no title in the list (empty unless a binding was added without a place in source-keymap.js). */
    unlistedShortcuts:()=>km.unlisted(),
    /** Open the keyboard shortcuts dialog (Cmd/Ctrl+K Cmd/Ctrl+S). */
    showShortcuts:()=>feature("shortcuts","showShortcuts")(view),
    /** Open the symbol picker (Cmd/Ctrl+Shift+O). */
    showSymbols:()=>feature("outline","showSymbolPicker")(view),
    /** Whether a suggestion list is open or being asked for. */
    isCompleting:()=>completionStatus(view.state)!==null,
    /** Perform a fix (its edits as one undoable change, or its own action). */
    applyFix:(fix,problem)=>applyProblemFix(fix,problem),
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
    destroy: () => {if(disposed)return;disposed=true;clearTimeout(syntaxTimer);closeOptions();announcer.destroy();view.destroy();}
  };
}
export {
  mountJsonCodeEditor
};
