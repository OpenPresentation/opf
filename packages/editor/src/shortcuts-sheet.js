// CE-29, the help item: a button (and the "?" key) that opens the keyboard shortcuts sheet, a modal dialog listing every shortcut the host passes
// in, grouped and filterable by typing. The rows, the classes and the look are the source pane's shortcuts dialog (source-shortcuts.js,
// styles/shortcuts.css); the key names come from the studio kit's `formatKey` (⌘ on a Mac, Ctrl elsewhere) so the three sheets agree. Plain DOM,
// no framework, no network. The icon is the Lucide CircleHelp path (ISC license), inlined.
import { normalizeIcons, resolveIcon } from "./icons.js";
import { matches } from "./source-shortcuts.js";
import { formatKey, isHandled, markHandled } from "./studio-kit/commands.js";
import { isMac, isTypingTarget } from "./studio-kit/dom.js";

const ICON_NAMES = ["help", "close"];
// The help glyph is Lucide CircleHelp: a ring, a question mark and a dot.
const HELP_ICON = [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M9.09 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3" }], ["path", { d: "M12 17h.01" }]];
const FOCUSABLE = 'button, input, [tabindex]:not([tabindex="-1"])';
let counter = 0;

const DEFAULT_LABELS = {
  /** The accessible name of the toolbar button. */
  button: "Keyboard shortcuts",
  /** The tooltip of the toolbar button (the key is added when it is bound). */
  title: "Keyboard shortcuts",
  /** The heading of the dialog. */
  heading: "Keyboard shortcuts",
  close: "Close",
  /** The accessible name of the filter field. */
  search: "Filter the keyboard shortcuts",
  searchPlaceholder: "Filter shortcuts",
  /** The group of a shortcut that names none. */
  defaultGroup: "General",
  none: "No shortcut matches.",
  empty: "No keyboard shortcuts are available.",
  /** The sentence under the heading. `platform` is "macOS" or "Windows or Linux". */
  description: (platform) => `Keys for ${platform}. Type to filter; Escape closes.`,
  /** The live status line: how many shortcuts show. */
  status: (shown, total) => `${shown === total ? "" : `${shown} of `}${total} ${total === 1 ? "shortcut" : "shortcuts"}${shown === total ? "" : " match"}`,
};

/**
 * The strokes of one shortcut as people read them, one string per alternative: `["Mod-z", "Shift-Mod-z"]` becomes `["⌘Z", "⇧⌘Z"]` on a Mac and
 * `["Ctrl+Z", "Ctrl+Shift+Z"]` elsewhere. A key with several strokes ("Mod-k Mod-s") keeps them separated by a space. A name that does not parse
 * is shown as it is.
 */
export function formatShortcutKeys(keys, win) {
  return (Array.isArray(keys) ? keys : [keys]).filter((key) => typeof key === "string" && key).map((key) => key.split(" ").map((stroke) => {
    try { return formatKey(stroke, win); } catch { return stroke; }
  }).join(" "));
}

/** The sheet's rows from the host's `getShortcuts()`: `{ id, title, group, keys }`, in the order given, with the keys formatted for `win`. */
export function shortcutRows(shortcuts, win, defaultGroup = DEFAULT_LABELS.defaultGroup) {
  return (Array.isArray(shortcuts) ? shortcuts : []).filter((item) => item && typeof item.label === "string").map((item, index) => ({
    id: item.id ?? `shortcut-${index}`,
    title: item.label,
    group: item.group || defaultGroup,
    keys: formatShortcutKeys(item.keys, win),
  }));
}

/** Rows that match `query` (every word, in the label, group or keys; the source pane's rule), in their original order. */
export function filterShortcutRows(rows, query) {
  return query.trim() ? rows.filter((row) => matches(row, query)) : rows;
}

/** Whether a "?" key press should open the sheet: a bare "?" (with or without Shift), not typed into a field, an editor, a menu or a dialog, not handled by another part. */
export function opensOnKey(event) {
  if (event.key !== "?" || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.defaultPrevented || isHandled(event)) return false;
  const target = event.target;
  if (isTypingTarget(target)) return false;
  if (target && typeof target.closest === "function" && target.closest('.cm-editor,[contenteditable=""],[contenteditable="true"],[role="textbox"],[role="combobox"],[role="menu"],[role="dialog"],dialog[open]')) return false;
  return true;
}

function node(doc, tag, className, attributes = {}, text) {
  const made = doc.createElement(tag);
  if (className) made.className = className;
  for (const [key, value] of Object.entries(attributes)) made.setAttribute(key, value);
  if (text !== undefined) made.textContent = text;
  return made;
}

/**
 * Mount the help button into `container`. Pressing it (or "?" / "Shift-?" while focus is not in a field) opens the shortcuts sheet in `overlay`.
 *
 * Options: `overlay` (the element the dialog is added to; default the closest `.opf-ui` ancestor, else the document body), `getShortcuts()` (called on
 * every open; returns `[{ label, keys: ["Mod-z", "Shift-Mod-z"], group? }]` with CodeMirror-style key names), `density`, `labels`, `bindKey`
 * (default true: bind "?" on the document).
 *
 * Returns `{ element, open(), close(), setDensity(density), setDisabled(disabled), menuItems(), destroy() }`.
 */
export function createHelpButton(container, options = {}) {
  if (!container?.ownerDocument) throw new TypeError("A DOM container is required.");
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  const labels = { ...DEFAULT_LABELS, ...(options.labels ?? {}) };
  const bindKey = options.bindKey !== false;
  const icons = normalizeIcons(options.icons, ICON_NAMES, "createHelpButton icons");
  let density = options.density === "touch" ? "touch" : "comfortable";
  let disabled = false;
  let destroyed = false;
  let sheet = null;

  const element = node(doc, "button", "opf-help-button", { type: "button", "aria-label": labels.button, "aria-haspopup": "dialog", "aria-expanded": "false" });
  element.title = bindKey ? `${labels.title} (?)` : labels.title;
  element.dataset.density = density;
  element.append(resolveIcon(doc, icons.help, HELP_ICON, { name: "help", className: "opf-help-icon" }));
  container.append(element);

  const overlayHost = () => options.overlay ?? container.closest?.(".opf-ui") ?? doc.body;

  function open() {
    if (destroyed || disabled) return false;
    if (sheet) { sheet.focus(); return true; }
    const host = overlayHost();
    const opener = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : element;
    const rows = shortcutRows(options.getShortcuts?.(), win, labels.defaultGroup);
    const id = `opf-help-${++counter}`;
    const root = node(doc, "div", `opf-shortcuts opf-help-sheet${host === doc.body || !host.closest?.(".opf-ui") ? " opf-ui" : ""}`);
    root.dataset.density = density;
    const dialog = node(doc, "div", "opf-shortcuts-dialog", { role: "dialog", "aria-modal": "true", "aria-labelledby": `${id}-title`, "aria-describedby": `${id}-help`, tabindex: "-1" });
    const head = node(doc, "div", "opf-shortcuts-head");
    const closeButton = node(doc, "button", "opf-shortcuts-close", { type: "button", "aria-label": labels.close }, "×");
    // The close button reads "×" unless the host gives a `close` icon.
    const closeIcon = resolveIcon(doc, icons.close, null, { name: "close", className: "opf-help-close-icon", size: 16 });
    if (closeIcon) closeButton.replaceChildren(closeIcon);
    head.append(node(doc, "h2", "opf-shortcuts-title", { id: `${id}-title` }, labels.heading), closeButton);
    const help = node(doc, "p", "opf-shortcuts-help", { id: `${id}-help` }, labels.description(isMac(win) ? "macOS" : "Windows or Linux"));
    const search = node(doc, "input", "opf-shortcuts-search", { type: "search", "aria-label": labels.search, placeholder: labels.searchPlaceholder, autocomplete: "off", spellcheck: "false" });
    const status = node(doc, "div", "opf-shortcuts-status", { role: "status", "aria-live": "polite" });
    const list = node(doc, "div", "opf-shortcuts-list", { tabindex: "0", role: "region", "aria-label": labels.heading });
    dialog.append(head, help, search, status, list);
    root.append(dialog);
    host.append(root);

    function render() {
      const shown = filterShortcutRows(rows, search.value);
      list.replaceChildren();
      let group = null, section = null;
      for (const row of shown) {
        if (row.group !== group) {
          group = row.group;
          section = node(doc, "section", "opf-shortcuts-group", { "aria-label": group });
          section.append(node(doc, "h3", "opf-shortcuts-group-title", {}, group));
          list.append(section);
        }
        const item = node(doc, "div", "opf-shortcuts-row", { "data-id": row.id });
        const keys = node(doc, "span", "opf-shortcuts-keys");
        row.keys.forEach((text, index) => {
          if (index) keys.append(node(doc, "span", "opf-shortcuts-or", {}, "or"));
          for (const stroke of text.split(" ")) keys.append(node(doc, "kbd", "opf-shortcuts-key", {}, stroke));
        });
        item.append(node(doc, "span", "opf-shortcuts-name", {}, row.title), keys);
        section.append(item);
      }
      if (!shown.length) list.append(node(doc, "p", "opf-shortcuts-none", {}, rows.length ? labels.none : labels.empty));
      status.textContent = labels.status(shown.length, rows.length);
    }
    const focusables = () => [...dialog.querySelectorAll(FOCUSABLE)].filter((item) => item.getClientRects().length);
    function onKeydown(event) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) { event.preventDefault(); dialog.focus(); return; }
      const first = items[0], last = items.at(-1), active = doc.activeElement;
      if (event.shiftKey && (active === first || active === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
      else if (!dialog.contains(active)) { event.preventDefault(); first.focus(); }
    }
    const onFocusin = (event) => { if (!dialog.contains(event.target)) (focusables()[0] ?? dialog).focus(); };
    const onPointerdown = (event) => { if (event.target === root) close(); };
    function close() {
      if (!sheet) return;
      sheet = null;
      element.setAttribute("aria-expanded", "false");
      doc.removeEventListener("focusin", onFocusin, true);
      root.removeEventListener("keydown", onKeydown);
      root.removeEventListener("pointerdown", onPointerdown);
      root.remove();
      if (opener?.isConnected) opener.focus({ preventScroll: true }); else if (element.isConnected) element.focus({ preventScroll: true });
    }
    sheet = { root, close, focus: () => search.focus() };
    root.addEventListener("keydown", onKeydown);
    root.addEventListener("pointerdown", onPointerdown);
    closeButton.addEventListener("click", close);
    search.addEventListener("input", render);
    doc.addEventListener("focusin", onFocusin, true);
    element.setAttribute("aria-expanded", "true");
    render();
    search.focus();
    return true;
  }
  const close = () => sheet?.close();

  const onKey = (event) => {
    if (destroyed || disabled || sheet || !opensOnKey(event)) return;
    event.preventDefault();
    markHandled(event);
    open();
  };
  const onClick = () => { open(); };
  element.addEventListener("click", onClick);
  if (bindKey) doc.addEventListener("keydown", onKey);

  return {
    element,
    /** Open the sheet. Returns false when the button is disabled or destroyed. */
    open,
    /** Close the sheet and return the focus to where it was. */
    close,
    setDensity(next) {
      density = next === "touch" ? "touch" : "comfortable";
      element.dataset.density = density;
      if (sheet) sheet.root.dataset.density = density;
    },
    setDisabled(next) {
      disabled = Boolean(next);
      element.disabled = disabled;
      if (disabled) close();
    },
    menuItems() {
      return [{ id: "help", label: labels.button, disabled, run: open }];
    },
    destroy() {
      if (destroyed) return;
      close();
      destroyed = true;
      element.removeEventListener("click", onClick);
      doc.removeEventListener("keydown", onKey);
      element.remove();
    },
  };
}
