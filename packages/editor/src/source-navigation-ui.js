// The widgets of go to definition, peek, find references and rename (artifacts/source-editor/SPEC.md, sections 8.3 and 13): one block widget under the
// line of the symbol, holding a peek of the definition, the card of a record only the app provides, the list of references or the rename input. The widget
// is a CodeMirror decoration, so it moves with the edits above it; keys inside it are its own (Escape closes it and returns to the editor, Enter acts on the
// choice), and it is plain DOM named for assistive technology. Styles: styles/source-navigation.css, only `--opf-ui-*` tokens.
import { Decoration, EditorView, WidgetType, keymap } from "@codemirror/view";
import { Prec, StateEffect, StateField } from "@codemirror/state";
import { textInputMap } from "./text-input.js";
import { docNode } from "./source-docs.js";

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

// ---- the widget and its place in the editor ----------------------------------------------------------------------------------------
const openEffect = StateEffect.define();
const closeEffect = StateEffect.define();

class PanelWidget extends WidgetType {
  constructor(panel) { super(); this.panel = panel; }
  eq(other) { return other.panel === this.panel; }
  toDOM() { return this.panel.dom; }
  ignoreEvent() { return true; }
  get estimatedHeight() { return this.panel.dom.offsetHeight || 120; }
}

const panelField = StateField.define({
  create: () => ({ decorations: Decoration.none, panel: null }),
  update(value, tr) {
    let { decorations, panel } = value;
    if (tr.docChanged) decorations = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(closeEffect)) { decorations = Decoration.none; panel = null; }
      else if (effect.is(openEffect)) {
        panel = effect.value.panel;
        decorations = Decoration.set([Decoration.widget({ widget: new PanelWidget(panel), block: true, side: 1 }).range(effect.value.pos)]);
      }
    }
    return decorations === value.decorations && panel === value.panel ? value : { decorations, panel };
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

// Escape in the editor closes an open widget before anything else (a widget the author clicked away from keeps listening to it).
const escapeKey = Prec.highest(keymap.of([{ key: "Escape", run: (view) => closePanel(view) }]));

function install(view) {
  if (view.state.field(panelField, false)) return;
  view.dispatch({ effects: StateEffect.appendConfig.of([panelField, escapeKey]) });
}

/** The panel now open under the editor, or null. */
export const openPanelOf = (view) => view.state.field(panelField, false)?.panel ?? null;

/** Close the open panel and give the focus back to the editor. Returns whether a panel was open. */
export function closePanel(view, { focus = true } = {}) {
  if (!openPanelOf(view)) return false;
  view.dispatch({ effects: closeEffect.of(null) });
  if (focus) view.focus();
  return true;
}

/** Show `panel` (`{ dom, focus() }`) under the line that ends at source offset `at`, and move the focus into it. */
export function showPanel(view, panel, at, source) {
  install(view);
  if (openPanelOf(view)) view.dispatch({ effects: closeEffect.of(null) });
  const map = textInputMap(source);
  const pos = Math.min(map.toInput(Math.min(at, source.length)), view.state.doc.length);
  view.dispatch({ effects: openEffect.of({ panel, pos }) });
  panel.focus();
}

// ---- shared pieces -----------------------------------------------------------------------------------------------------------------
function frame(kind, label, title, onClose, role = "region") {
  const dom = el("div", `opf-sym opf-sym-${kind}`);
  dom.setAttribute("role", role);
  dom.setAttribute("aria-label", label);
  const head = el("div", "opf-sym-head");
  head.append(el("span", "opf-sym-title", title));
  const close = el("button", "opf-sym-close", "Close");
  close.type = "button";
  close.setAttribute("aria-label", `Close ${kind === "refs" ? "references" : kind}`);
  close.addEventListener("click", (event) => { event.preventDefault(); onClose(); });
  head.append(close);
  dom.append(head);
  return { dom, head };
}

// The keys inside a panel are the panel's: nothing reaches the editor behind it.
const own = (dom, handler) => dom.addEventListener("keydown", (event) => {
  if (event.isComposing) return;
  if (handler(event)) { event.preventDefault(); event.stopPropagation(); } else if (event.key !== "Tab") event.stopPropagation();
});

const cut = (text, max = 220) => {
  const flat = text.trim().replace(/\s+/g, " ");
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

// ---- the peek of a definition --------------------------------------------------------------------------------------------------------
/**
 * `{ label, title, where, lines: [{ number, text, target }], onGo, onClose }`: the lines of the definition with some context, the declaration marked
 * (by an arrow and a bold line, not by color alone). Enter goes to the definition.
 */
export function peekPanel(spec) {
  const { dom } = frame("peek", `Peek definition of ${spec.label}`, spec.title, () => spec.onClose());
  dom.tabIndex = 0;
  dom.querySelector(".opf-sym-head").insertBefore(el("span", "opf-sym-where", spec.where), dom.querySelector(".opf-sym-close"));
  const list = el("ol", "opf-sym-lines");
  list.setAttribute("role", "list");
  for (const line of spec.lines) {
    const row = el("li", `opf-sym-line${line.target ? " is-target" : ""}`);
    if (line.target) row.setAttribute("aria-current", "location");
    row.append(el("span", "opf-sym-no", String(line.number)), el("span", "opf-sym-mark", line.target ? "▸" : ""), el("code", "opf-sym-text", line.text || " "));
    row.setAttribute("aria-label", `Line ${line.number}${line.target ? ", definition" : ""}: ${cut(line.text) || "blank"}`);
    list.append(row);
  }
  dom.append(list, el("p", "opf-sym-hint", "Enter goes to the definition. Escape closes."));
  own(dom, (event) => {
    if (event.key === "Escape") { spec.onClose(); return true; }
    if (event.key === "Enter" && event.target === dom) { spec.onGo(); return true; }
    return false;
  });
  return { dom, focus: () => dom.focus() };
}

/** The card of a record only the app provides: `{ label, title, model, preview?, onClose }` (`model` is a source-docs.js card). */
export function cardPanel(spec) {
  const { dom } = frame("card", `Peek of ${spec.label}, provided by the app`, spec.title, () => spec.onClose());
  dom.tabIndex = 0;
  dom.append(docNode(spec.model));
  const slot = el("div", "opf-sym-preview");
  slot.hidden = true;
  dom.append(slot);
  dom.append(el("p", "opf-sym-hint", "This record is provided by the app, so it has no definition in the document. Escape closes."));
  own(dom, (event) => {
    if (event.key === "Escape" || (event.key === "Enter" && event.target === dom)) { spec.onClose(); return true; }
    return false;
  });
  // An optional preview from the host: an element, or an image address (https or data), possibly after a wait.
  Promise.resolve(spec.preview).then((value) => {
    if (value instanceof Node) slot.append(value);
    else if (typeof value === "string" && /^(?:https:\/\/|data:image\/)/.test(value)) { const image = el("img", "opf-sym-image"); image.alt = ""; image.src = value; slot.append(image); }
    slot.hidden = slot.childNodes.length === 0;
  }, () => {});
  return { dom, focus: () => dom.focus() };
}

// ---- the list of references --------------------------------------------------------------------------------------------------------------
let counter = 0;
/**
 * `{ label, title, rows: [{ number, slide, text, declaration }], onPick(index), onClose }`: Up, Down, Home and End move, Enter jumps to the usage, Escape
 * closes. The declaration is marked with the word, not only a style.
 */
export function referencesPanel(spec) {
  const { dom } = frame("refs", `References to ${spec.label}`, spec.title, () => spec.onClose());
  const id = `opf-sym-refs-${++counter}`;
  const list = el("ul", "opf-sym-list");
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", `References to ${spec.label}`);
  list.tabIndex = 0;
  const rows = spec.rows.map((row, index) => {
    const item = el("li", `opf-sym-ref${row.declaration ? " is-declaration" : ""}`);
    item.id = `${id}-${index}`;
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", "false");
    item.setAttribute("aria-label", `${row.declaration ? "Declaration, " : ""}line ${row.number}${row.slide ? `, slide ${row.slide}` : ""}: ${cut(row.text) || "blank"}`);
    item.append(el("span", "opf-sym-no", String(row.number)));
    item.append(el("span", "opf-sym-badge", row.declaration ? "Declaration" : row.slide ? `Slide ${row.slide}` : ""));
    item.append(el("code", "opf-sym-text", cut(row.text)));
    item.addEventListener("click", (event) => { event.preventDefault(); spec.onPick(index); });
    list.append(item);
    return item;
  });
  let active = 0;
  const select = (index) => {
    active = Math.max(0, Math.min(rows.length - 1, index));
    rows.forEach((item, at) => item.setAttribute("aria-selected", String(at === active)));
    list.setAttribute("aria-activedescendant", rows[active]?.id ?? "");
    rows[active]?.scrollIntoView?.({ block: "nearest" });
  };
  dom.append(list, el("p", "opf-sym-hint", "Up and Down choose, Enter goes to it. Escape closes."));
  own(dom, (event) => {
    if (event.key === "Escape") { spec.onClose(); return true; }
    if (event.key === "ArrowDown") { select(active + 1); return true; }
    if (event.key === "ArrowUp") { select(active - 1); return true; }
    if (event.key === "Home") { select(0); return true; }
    if (event.key === "End") { select(rows.length - 1); return true; }
    if (event.key === "Enter" && event.target === list) { spec.onPick(active); return true; }
    return false;
  });
  select(0);
  return { dom, focus: () => list.focus() };
}

// ---- rename -------------------------------------------------------------------------------------------------------------------------
/**
 * `{ label, current, validate(name) => message, onSubmit(name), onClose, say }`: an input holding the current id, all selected. The name is checked as
 * it is typed; the message shows in the widget and is announced. Enter applies a valid name, Escape cancels.
 */
export function renamePanel(spec) {
  const { dom } = frame("rename", `Rename ${spec.label}`, `Rename ${spec.label}`, () => spec.onClose(), "group");
  const id = `opf-sym-rename-${++counter}`;
  const row = el("div", "opf-sym-field");
  const label = el("label", "opf-sym-label", "New name");
  label.htmlFor = `${id}-input`;
  const input = el("input", "opf-sym-input");
  input.id = `${id}-input`;
  input.type = "text";
  input.value = spec.current;
  input.spellcheck = false;
  input.autocomplete = "off";
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("aria-describedby", `${id}-message`);
  input.setAttribute("aria-invalid", "false");
  const message = el("div", "opf-sym-message");
  message.id = `${id}-message`;
  row.append(label, input);
  dom.append(row, message, el("p", "opf-sym-hint", "Enter renames everywhere it is used. Escape cancels."));
  let last = "";
  const check = () => {
    const problem = spec.validate(input.value);
    input.setAttribute("aria-invalid", String(Boolean(problem)));
    message.textContent = problem;
    message.classList.toggle("is-error", Boolean(problem));
    if (problem && problem !== last) spec.say(problem);
    last = problem;
    return problem;
  };
  input.addEventListener("input", check);
  own(dom, (event) => {
    if (event.key === "Escape") { spec.onClose(); return true; }
    if (event.key === "Enter" && event.target === input) {
      const problem = check();
      if (problem) { spec.say(problem); return true; }
      spec.onSubmit(input.value);
      return true;
    }
    return false;
  });
  return { dom, focus: () => { input.focus(); input.select(); } };
}
