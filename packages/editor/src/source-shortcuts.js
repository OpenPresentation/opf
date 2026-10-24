// The keyboard shortcuts dialog (artifacts/source-editor/SPEC.md, section 8.6): every binding the editor installed, grouped and searchable, with the keys
// of the platform. The list is `getShortcuts()`, produced from the same table that installs the keymap (source-keymap.js), so it cannot drift from the keys.
// Cmd/Ctrl+K Cmd/Ctrl+S, F1 or the "?" button of the source pane open it; Escape closes it and returns focus to the editor. A host that wants its own
// dialog passes `onShowShortcuts(shortcuts)` and returns true. Plain DOM, loaded lazily.
const FOCUSABLE = 'button, input, [tabindex]:not([tabindex="-1"])';
let counter = 0;
const open = new WeakMap();

const element = (doc, tag, className, attributes = {}) => {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
};

/** The words a search looks in: title, group, id and the keys with `+`, `-` and spaces folded to spaces. */
const haystack = (row) => `${row.title} ${row.group} ${row.id} ${row.when ?? ""} ${row.keys.join(" ")}`.toLowerCase().replace(/[+-]/g, " ");
export const matches = (row, query) => {
  const words = query.toLowerCase().replace(/[+-]/g, " ").split(/\s+/).filter(Boolean);
  const text = haystack(row);
  return words.every((word) => text.includes(word));
};

/** Open the dialog for `view` (or close it when it is open). Returns true: the key was taken. */
export function showShortcuts(view, context) {
  const shortcuts = context.getShortcuts();
  if (context.options.onShowShortcuts?.(shortcuts) === true) return true;
  const existing = open.get(view);
  if (existing) { existing.close(); return true; }
  const doc = view.dom.ownerDocument;
  const host = view.dom.closest(".opf-ui") ?? doc.body;
  const opener = doc.activeElement;
  const id = `opf-shortcuts-${++counter}`;
  const root = element(doc, "div", `opf-shortcuts${host === doc.body ? " opf-ui" : ""}`);
  const dialog = element(doc, "div", "opf-shortcuts-dialog", { role: "dialog", "aria-modal": "true", "aria-labelledby": `${id}-title`, "aria-describedby": `${id}-help`, tabindex: "-1" });
  const head = element(doc, "div", "opf-shortcuts-head");
  const title = Object.assign(element(doc, "h2", "opf-shortcuts-title", { id: `${id}-title` }), { textContent: "Keyboard shortcuts" });
  const closeButton = Object.assign(element(doc, "button", "opf-shortcuts-close", { type: "button", "aria-label": "Close the keyboard shortcuts" }), { textContent: "×" });
  head.append(title, closeButton);
  const help = Object.assign(element(doc, "p", "opf-shortcuts-help", { id: `${id}-help` }), { textContent: `Keys for ${context.platform === "mac" ? "macOS" : context.platform === "win" ? "Windows" : "Linux"}. Type to search by name or key; Escape closes.` });
  const search = element(doc, "input", "opf-shortcuts-search", { type: "search", "aria-label": "Search the keyboard shortcuts", placeholder: "Search shortcuts", autocomplete: "off", spellcheck: "false" });
  const status = element(doc, "div", "opf-shortcuts-status", { role: "status", "aria-live": "polite" });
  const list = element(doc, "div", "opf-shortcuts-list", { tabindex: "0", role: "region", "aria-label": "Shortcuts" });
  dialog.append(head, help, search, status, list);
  root.append(dialog);
  host.append(root);

  const plural = (count) => `${count} ${count === 1 ? "shortcut" : "shortcuts"}`;
  function render() {
    const rows = shortcuts.filter((row) => matches(row, search.value));
    list.replaceChildren();
    let group = null, section = null;
    for (const row of rows) {
      if (row.group !== group) {
        group = row.group;
        section = element(doc, "section", "opf-shortcuts-group", { "aria-label": group });
        section.append(Object.assign(element(doc, "h3", "opf-shortcuts-group-title"), { textContent: group }));
        list.append(section);
      }
      const item = element(doc, "div", "opf-shortcuts-row", { "data-id": row.id });
      const name = element(doc, "span", "opf-shortcuts-name");
      name.append(document.createTextNode(row.title));
      if (row.when) name.append(Object.assign(element(doc, "span", "opf-shortcuts-when"), { textContent: ` (${row.when})` }));
      const keys = element(doc, "span", "opf-shortcuts-keys");
      row.keys.forEach((keyText, index) => {
        if (index) keys.append(Object.assign(element(doc, "span", "opf-shortcuts-or"), { textContent: "or" }));
        for (const stroke of keyText.split(" ")) keys.append(Object.assign(element(doc, "kbd", "opf-shortcuts-key"), { textContent: stroke }));
      });
      item.append(name, keys);
      section.append(item);
    }
    if (!rows.length) list.append(Object.assign(element(doc, "p", "opf-shortcuts-none"), { textContent: "No shortcut matches." }));
    status.textContent = search.value ? `${plural(rows.length)} match` : plural(rows.length);
  }

  function focusables() { return [...dialog.querySelectorAll(FOCUSABLE)].filter((node) => node.getClientRects().length); }
  function onKeydown(event) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key !== "Tab") return;
    const nodes = focusables();
    if (!nodes.length) { event.preventDefault(); dialog.focus(); return; }
    const first = nodes[0], last = nodes.at(-1), active = doc.activeElement;
    if (event.shiftKey && (active === first || active === dialog)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
    else if (!dialog.contains(active)) { event.preventDefault(); first.focus(); }
  }
  function onFocusin(event) { if (!dialog.contains(event.target)) (focusables()[0] ?? dialog).focus(); }
  function close() {
    if (!open.has(view)) return;
    open.delete(view);
    doc.removeEventListener("focusin", onFocusin, true);
    root.remove();
    if (view.dom.isConnected) view.focus(); else if (opener?.isConnected) opener.focus();
    context.say("Keyboard shortcuts closed");
  }
  open.set(view, { close });
  root.addEventListener("keydown", onKeydown);
  root.addEventListener("pointerdown", (event) => { if (event.target === root) close(); });
  closeButton.addEventListener("click", close);
  search.addEventListener("input", render);
  doc.addEventListener("focusin", onFocusin, true);
  render();
  search.focus();
  context.say(`Keyboard shortcuts, ${plural(shortcuts.length)}. Type to search, Escape to close.`);
  return true;
}
