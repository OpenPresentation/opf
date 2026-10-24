// The symbol picker (artifacts/source-editor/SPEC.md, section 8.4): Cmd/Ctrl+Shift+O lists the slides ("3. Highlights") and the other symbols of the
// document (source-symbols.js) in a box at the top of the editor, filtered as you type. The arrows move, Enter jumps to the symbol and selects its range,
// Escape closes and returns to where you were. Loaded lazily by the code editor.
import { EditorView } from "@codemirror/view";
import { documentSymbols, filterSymbols, symbolAt } from "./source-symbols.js";

let counter = 0;
const open = new WeakMap();
const MAX_SHOWN = 200;

const element = (doc, tag, className, attributes = {}) => {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
};
const KIND_WORDS = { slide: "slide", section: "section", asset: "asset", dataset: "dataset", variable: "variable", reference: "reference", record: "catalog record" };

/** Go to a symbol: select its range, scroll it into view and say where we are. */
export function goToSymbol(view, context, symbol) {
  context.api.setSelection(symbol.from, symbol.to);
  context.api.focus();
  context.say(`${symbol.label}, ${KIND_WORDS[symbol.kind] ?? symbol.kind}, line ${symbol.line}`);
}

/** Open the picker for `view` (Cmd/Ctrl+Shift+O); a second press closes it. Returns true: the key was taken. */
export function showSymbolPicker(view, context) {
  const existing = open.get(view);
  if (existing) { existing.close(); return true; }
  const text = context.api.getValue();
  const symbols = documentSymbols(context.format, text);
  const doc = view.dom.ownerDocument;
  const id = `opf-quickpick-${++counter}`;
  const root = element(doc, "div", "opf-quickpick");
  const input = element(doc, "input", "opf-quickpick-input", { type: "text", role: "combobox", "aria-label": "Go to symbol", "aria-expanded": "true", "aria-controls": `${id}-list`, "aria-autocomplete": "list", placeholder: "Go to symbol: type to filter", autocomplete: "off", spellcheck: "false" });
  const list = element(doc, "ul", "opf-quickpick-list", { id: `${id}-list`, role: "listbox", "aria-label": "Symbols" });
  const status = element(doc, "div", "opf-quickpick-status", { role: "status", "aria-live": "polite" });
  root.append(input, list, status);
  view.dom.append(root);
  const [caret] = context.api.getSelection();
  const here = symbolAt(symbols.filter((symbol) => symbol.kind === "slide" || symbol.depth >= 0), caret);
  const scroll = view.scrollDOM.scrollTop;
  let shown = symbols, selected = 0, closed = false, timer = null;

  function optionId(index) { return `${id}-option-${index}`; }
  function select(index, { preview = true } = {}) {
    if (!shown.length) { selected = 0; input.removeAttribute("aria-activedescendant"); return; }
    selected = (index + shown.length) % shown.length;
    [...list.children].forEach((node, at) => { const on = at === selected; node.setAttribute("aria-selected", String(on)); node.classList.toggle("is-selected", on); if (on) node.scrollIntoView?.({ block: "nearest" }); });
    input.setAttribute("aria-activedescendant", optionId(selected));
    // The editor follows the selection without moving the caret (VS Code shows the symbol as you arrow through the list).
    if (preview) view.dispatch({ effects: EditorView.scrollIntoView(shown[selected].from, { y: "center" }) });
    clearTimeout(timer);
    timer = setTimeout(() => { const symbol = shown[selected]; if (symbol && !closed) context.say(`${symbol.label}, ${KIND_WORDS[symbol.kind] ?? symbol.kind}. ${selected + 1} of ${shown.length}`); }, 100);
  }
  function render(initial) {
    shown = filterSymbols(symbols, input.value);
    list.replaceChildren();
    shown.slice(0, MAX_SHOWN).forEach((symbol, index) => {
      const item = element(doc, "li", `opf-quickpick-item is-${symbol.kind}`, { id: optionId(index), role: "option", "aria-selected": "false", "data-kind": symbol.kind });
      item.style.paddingLeft = `${10 + symbol.depth * 14}px`;
      item.append(Object.assign(element(doc, "span", "opf-quickpick-label"), { textContent: symbol.label }));
      if (symbol.detail) item.append(Object.assign(element(doc, "span", "opf-quickpick-detail"), { textContent: symbol.detail }));
      item.append(Object.assign(element(doc, "span", "opf-quickpick-kind"), { textContent: KIND_WORDS[symbol.kind] ?? symbol.kind }));
      item.addEventListener("pointerdown", (event) => event.preventDefault());
      item.addEventListener("click", () => pick(index));
      list.append(item);
    });
    if (shown.length > MAX_SHOWN) list.append(Object.assign(element(doc, "li", "opf-quickpick-more", { role: "presentation" }), { textContent: `${shown.length - MAX_SHOWN} more: keep typing to narrow the list.` }));
    status.textContent = shown.length ? `${shown.length} ${shown.length === 1 ? "symbol" : "symbols"}` : "No symbols match";
    const start = initial && here ? Math.max(0, shown.findIndex((symbol) => symbol.id === here.id)) : 0;
    select(start, { preview: !initial });
    if (!initial) context.say(status.textContent);
  }
  function pick(index) {
    const symbol = shown[index];
    if (!symbol) return;
    close({ restore: false });
    goToSymbol(view, context, symbol);
  }
  function close({ restore = true } = {}) {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    open.delete(view);
    doc.removeEventListener("pointerdown", outside, true);
    root.remove();
    if (restore) view.scrollDOM.scrollTop = scroll;
    if (view.dom.isConnected) view.focus();
  }
  function outside(event) { if (!root.contains(event.target)) close(); }
  open.set(view, { close });
  input.addEventListener("input", () => render(false));
  input.addEventListener("keydown", (event) => {
    const page = Math.max(1, Math.floor(list.clientHeight / 28) - 1);
    if (event.key === "ArrowDown") { event.preventDefault(); select(selected + 1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); select(selected - 1); }
    else if (event.key === "PageDown") { event.preventDefault(); select(Math.min(shown.length - 1, selected + page)); }
    else if (event.key === "PageUp") { event.preventDefault(); select(Math.max(0, selected - page)); }
    else if (event.key === "Enter") { event.preventDefault(); pick(selected); }
    else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === "Tab") { event.preventDefault(); close(); }
    // The key that opened the picker closes it, also from the input.
    else if ((context.platform === "mac" ? event.metaKey : event.ctrlKey) && event.shiftKey && !event.altKey && (event.key.toLowerCase() === "o" || event.code === "KeyO")) { event.preventDefault(); event.stopPropagation(); close(); }
  });
  input.addEventListener("blur", () => { setTimeout(() => { if (!closed && !root.contains(doc.activeElement)) close({ restore: false }); }, 0); });
  doc.addEventListener("pointerdown", outside, true);
  render(true);
  input.focus();
  context.say(`Go to symbol, ${symbols.length} ${symbols.length === 1 ? "symbol" : "symbols"}. Type to filter, Enter to go, Escape to close.`);
  return true;
}
