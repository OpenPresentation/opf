import { Annotation, Compartment, EditorSelection, EditorState, Prec, StateEffect, StateField, Transaction } from "@codemirror/state";
import { Decoration, EditorView, drawSelection, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab, isolateHistory, redo, undo, undoDepth } from "@codemirror/commands";
import { HighlightStyle, StreamLanguage, bracketMatching, codeFolding, foldKeymap, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, startCompletion } from "@codemirror/autocomplete";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { linter } from "@codemirror/lint";
import { tags } from "@lezer/highlight";
import { applyEdits, findNodeAtOffset, format, getNodePath, parseTree } from "jsonc-parser";
import {jsonSource,jsonSourceHistory,setJsonSource} from './json-source.js';
import {textInputMap,preferredLineEnding} from './text-input.js';
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
// The completion popup keeps CodeMirror's keys (arrows, Enter, Escape) but not Ctrl-Space, which opens the field menu.
const completionKeys = Prec.highest(keymap.of(completionKeymap.filter((binding) => binding.run !== startCompletion)));
// Accept a completion by rewriting its whole token (quotes included), so a string key, a bare word and a changed value type all land
// as valid JSON. A key adds ": " when none follows and then offers the values of that key.
function completionApply(found, option) {
  return (view, completion, from, to) => {
    const start = found.quoted ? from - 1 : from;
    const end = found.closed ? to + 1 : to;
    let insert = JSON.stringify(option.value);
    const chain = found.kind === "key" && !/^\s*:/.test(view.state.sliceDoc(end, Math.min(view.state.doc.length, end + 200)));
    if (chain) insert += ": ";
    view.dispatch({ changes: { from: start, to: end, insert }, selection: { anchor: start + insert.length }, userEvent: "input.complete", scrollIntoView: true });
    if (chain) setTimeout(() => startCompletion(view), 0);
  };
}
function indentation(source) {
  const spaces = source.match(/^[\t ]+(?=\S)/gm) ?? [];
  return spaces.some((value) => value.includes("	")) ? "	" : " ".repeat(spaces.length ? Math.min(8, ...spaces.map((value) => value.length)) : 2);
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
  const indent = line.number === parentLine.number ? /^\s*/.exec(parentLine.text)[0] + indentation(source) : existingIndent;
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
  // Live completions (JSON only, `completions: true`): property names and values at the cursor's JSON path, from the same data as the
  // field menu. The data loads with the field menu's chunk on first use.
  async function completionSource(context) {
    if (disposed || languageName !== "json") return null;
    let module;
    try { module = await import('./json-options.js'); } catch (error) { options.onError?.(error); return null; }
    if (disposed || context.aborted) return null;
    const found = module.getJsonCompletions(context.state.doc.toString(), context.pos, catalogs, { explicit: context.explicit });
    if (!found) return null;
    return { from: found.from, to: found.to, filter: true, options: found.options.map((option) => ({
      label: option.label, detail: option.detail, info: option.info, boost: option.boost, type: found.kind === "key" ? "property" : "enum", apply: completionApply(found, option),
    })) };
  }
  // Undo and Redo run CodeMirror's history first. When it has nothing left, the host's fallback may step further (the source pane
  // routes a whole-document replace to the session); a fallback answers true when it did something.
  const undoCommand = (target) => undo(target) || Boolean(options.historyFallback?.undo?.());
  const redoCommand = (target) => redo(target) || Boolean(options.historyFallback?.redo?.());
  const historyBindings = historyKeymap.map((binding) => binding.run === undo ? { ...binding, run: undoCommand } : binding.run === redo ? { ...binding, run: redoCommand } : binding);
  const completionExtension = options.completions ? [autocompletion({ override: [completionSource], defaultKeymap: false, icons: false, maxRenderedOptions: 60 }), completionKeys] : null;
  let currentIndent = indentation(options.code);
  const contentAttributes = (invalid = options.invalid, describedBy = options.describedBy) => EditorView.contentAttributes.of({
    "aria-label": options.label,
    "aria-invalid": String(Boolean(invalid)),
    "aria-describedby": describedBy ?? "",
    "aria-keyshortcuts": "Control+Space Meta+Space Alt+ArrowDown",
    spellcheck: "false",
    autocapitalize: "off",
    autocorrect: "off"
  });
  const view = new EditorView({ parent, state: EditorState.create({ doc: options.code, extensions: [
    language.of(languageExtension(languageName, completionExtension)),
    editable.of(editableExtension(options.readOnly)),
    jsonSource.init(()=>options.code),jsonSourceHistory,
    indent.of(indentUnit.of(currentIndent)),
    indentOnInput(),
    historyField.of(history()),
    drawSelection(),
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
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        api.format();
        return true;
      }
      return false;
    } })),
    keymap.of([
      { key: "Enter", run: nextStringItem },
      { key: '"', run: (view2) => skipDelimiter(view2, '"') },
      { key: ",", run: (view2) => skipDelimiter(view2, ",") },
      { key: "Mod-Space", run: () => {
        void openOptions();
        return true;
      } },
      { key: "Ctrl-Space", run: () => {
        void openOptions();
        return true;
      } },
      { key: "Alt-ArrowDown", run: () => {
        void openOptions();
        return true;
      } },
      indentWithTab,
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyBindings,
      ...searchKeymap,
      ...foldKeymap
    ]),
    EditorView.domEventHandlers({
      click(event) {
        if (view.state.selection.main.empty) void openOptions(event.clientX, event.clientY + 12);
      },
      paste(event){
        if(!event.clipboardData||view.state.selection.ranges.length!==1)return false;
        const text=event.clipboardData.getData('text/plain');
        if(!text)return false;
        event.preventDefault();api.replace(...api.getSelection(),text);return true;
      },
      focus() {
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
      if (update.docChanged && !update.transactions.every((tr) => tr.annotation(external))) options.onChange(update.state.field(jsonSource));
    })
  ] }) });
  const api = {
    getValue: () => view.state.field(jsonSource),
    getSelection: () => {const map=textInputMap(api.getValue());return [map.toSource(view.state.selection.main.from),map.toSource(view.state.selection.main.to)];},
    hasFocus: () => view.hasFocus,
    focus: () => view.focus(),
    setSelection: (from, to=from) => {const map=textInputMap(api.getValue());view.dispatch({ selection: EditorSelection.single(map.toInput(from),map.toInput(to)), scrollIntoView: true });},
    replace: (from, to, text) => {
      const source=api.getValue(),map=textInputMap(source),a=map.toInput(from),b=map.toInput(to);
      if(to<from||map.toSource(a)!==from||map.toSource(b)!==to)throw new RangeError('JSON edits must use source boundaries outside a CRLF pair.');
      const insert=textInputMap(text).text,next=source.slice(0,from)+text+source.slice(to);
      view.dispatch({changes:{from:a,to:b,insert},selection:{anchor:a+insert.length},effects:setJsonSource.of(next),
        annotations:[Transaction.userEvent.of('input.complete'),isolateHistory.of('full')],scrollIntoView:true});
    },
    coordinates: () => {
      const rect = view.coordsAtPos(view.state.selection.main.head) ?? parent.getBoundingClientRect();
      return { left: rect.left, top: rect.bottom + 8 };
    },
    format: () => {
      const source = api.getValue();
      try {
        JSON.parse(source);
      } catch {
        return false;
      }
      const unit = indentation(source);
      const next = applyEdits(source, format(source, void 0, { insertSpaces: unit !== "	", tabSize: unit.length, eol: preferredLineEnding(source) }));
      if (source !== next) api.replace(0, source.length, next);
      return true;
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
      view.dispatch({ effects: language.reconfigure(languageExtension(name, completionExtension)) });
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
      const nextIndent = indentation(code);
      if (nextIndent !== currentIndent) {
        currentIndent = nextIndent;
        effects.push(indent.reconfigure(indentUnit.of(nextIndent)));
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
