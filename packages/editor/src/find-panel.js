// Find and replace panel (RR-25): the DOM over the find-replace model. A docked, non-modal panel with a find field,
// a replace field, match case / whole word / regular expression options, a "this slide only" scope, previous and next,
// replace one and replace all, and a results list whose entries go to the match on the canvas. Replace all is one
// undo step and the panel offers it right there. Keyboard: Ctrl/Cmd+F opens find, Ctrl/Cmd+H (and Ctrl/Cmd+Shift+H)
// opens find and replace (see `installFindShortcuts`), Enter / Shift+Enter in the find field go to the next / previous
// match, F3 and Shift+F3 do the same anywhere in the panel, Enter in the replace field replaces the current match,
// Ctrl/Cmd+Alt+Enter replaces all, Esc closes and returns focus. Importing this module does not need a DOM.
import { getValueAtPath } from "./index.js";
import { collectSearchFields, expandReplacement, findMatches, replaceAll, replaceMatch, textOf } from "./find-replace.js";

const MAX_LISTED = 300;
let panelCounter = 0;

const STYLE_ID = "opf-find-panel-style";
const CSS = `
.opf-find{box-sizing:border-box;display:flex;flex-direction:column;gap:8px;width:100%;max-width:560px;padding:10px 12px 12px;background:#fff;color:#2c2838;border:1px solid #dcd5eb;border-radius:8px;box-shadow:0 8px 30px #28203922;font:13px/1.45 system-ui,sans-serif}
.opf-find[hidden]{display:none}
.opf-find *{box-sizing:border-box}
.opf-find-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.opf-find-head strong{font-size:13px}
.opf-find-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px}
.opf-find-row[hidden]{display:none}
.opf-find-field{flex:1 1 180px;display:flex;flex-direction:column;gap:2px;min-width:0}
.opf-find-field>span{font-size:11px;color:#6d6580}
.opf-find input[type=text]{width:100%;min-height:34px;padding:6px 8px;font:inherit;border:1px solid #cfc8de;border-radius:6px;background:#fff;color:inherit}
.opf-find input[type=text][aria-invalid=true]{border-color:#b4381f}
.opf-find button{min-height:34px;padding:5px 10px;font:inherit;border:1px solid #cfc8de;border-radius:6px;background:#f6f3fc;color:#463a63;cursor:pointer}
.opf-find button:disabled{opacity:.45;cursor:default}
.opf-find button.opf-find-primary{background:#6559cf;border-color:#6559cf;color:#fff}
.opf-find button.opf-find-close{min-width:34px;padding:0 8px;font-size:18px;line-height:1;background:transparent;border-color:transparent}
.opf-find button:focus-visible,.opf-find input:focus-visible,.opf-find-result:focus-visible{outline:2px solid #6559cf;outline-offset:2px}
.opf-find-opt{display:inline-flex;align-items:center;gap:5px;min-height:30px;padding:2px 8px;border:1px solid #cfc8de;border-radius:6px;font-size:12px;cursor:pointer;user-select:none}
.opf-find-opt:has(input:checked){background:#e9e5fa;border-color:#6559cf}
.opf-find-opt input{margin:0}
.opf-find-count{font-size:12px;color:#5d5666;min-height:1.4em}
.opf-find-error{font-size:12px;color:#b4381f}
.opf-find-error:empty{display:none}
.opf-find-undo{min-height:26px;padding:1px 8px}
.opf-find-results{list-style:none;margin:0;padding:0;max-height:min(30vh,240px);overflow:auto;border:1px solid #ebe7f4;border-radius:6px}
.opf-find-results:empty{display:none}
.opf-find-results li{margin:0;padding:0;border-top:1px solid #f1eef8}
.opf-find-results li:first-child{border-top:0}
.opf-find-result{display:block;width:100%;min-height:44px;padding:6px 10px;text-align:left;border:0;border-radius:0;background:transparent;color:inherit;font:inherit;cursor:pointer}
.opf-find-result[aria-current=true]{background:#efebfc}
.opf-find-where{display:block;font-size:11px;color:#6d6580}
.opf-find-text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.opf-find-text mark{background:#ffe08a;color:inherit;border-radius:2px;padding:0 1px}
.opf-find-more{font-size:11px;color:#6d6580;padding:6px 10px}
@media (pointer:coarse){.opf-find input[type=text]{font-size:16px}.opf-find button,.opf-find-opt{min-height:44px}.opf-find button.opf-find-close{min-width:44px}}
`;

function h(doc, tag, attributes = {}, ...children) {
  const element = doc.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue;
    if (key === "class") element.className = value;
    else if (key === "text") element.textContent = value;
    else element.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children) if (child) element.append(child);
  return element;
}

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const whereLabel = (match) => (match.slideIndex < 0 ? `Presentation · ${match.label}` : `Slide ${match.slideIndex + 1} · ${match.label}`);

/**
 * Mount the find and replace panel in `container` (it is hidden until `open()`).
 *
 * Options: `editor` (a session; required), `canvas` (a CanvasEditor: matches are shown and selected on it), `goToSlide(index)`
 * (a host that owns slide navigation shows the slide; defaults to `canvas.setSlide`), `onGoTo(match, selectedPath)` (called after a
 * go to, with the path selected on the canvas or null, and `{ via }`: "list" for a click on a result, "step" for next, previous and
 * after a replacement; a host puts speaker notes or a deck field in view here, and moves focus only for "list"), `getSlideIndex`,
 * `getSelectionText()` (seeds the find field when the panel opens), `commit()` (default `canvas.commit`: finishes an
 * inline edit before the document is replaced), `onStatus(message, { error })`, `onClose()`.
 */
export function createFindPanel(container, options) {
  const { editor } = options;
  // `canvas` may be a CanvasEditor or a function returning the current one (a host can recreate its canvas).
  const getCanvas = () => (typeof options.canvas === "function" ? options.canvas() : options.canvas);
  if (!editor || typeof editor.applyPatch !== "function") throw new TypeError("createFindPanel needs an editor session.");
  const doc = container.ownerDocument;
  const id = `opf-find-${++panelCounter}`;
  const state = { query: "", replacement: "", matchCase: false, wholeWord: false, regex: false, thisSlide: false, replaceMode: false, open: false };
  let result = { matches: [], fieldCount: 0, slideCount: 0, truncated: false };
  let current = -1;
  let destroyed = false;
  let opener = null;
  let lastReplaceAll = null;

  if (!doc.getElementById(STYLE_ID)) {
    const style = h(doc, "style", { id: STYLE_ID });
    style.textContent = CSS;
    (doc.head ?? container).append(style);
  }

  const root = h(doc, "section", { class: "opf-find", id, role: "dialog", "aria-modal": "false", "aria-label": "Find and replace", "data-opf-component": "find-panel", hidden: true });
  const title = h(doc, "strong", { text: "Find" });
  const closeButton = h(doc, "button", { type: "button", class: "opf-find-close", "aria-label": "Close find and replace", title: "Close (Esc)", text: "×" });
  const head = h(doc, "div", { class: "opf-find-head" }, title, closeButton);

  const findInput = h(doc, "input", { type: "text", id: `${id}-find`, autocomplete: "off", autocapitalize: "off", spellcheck: "false", enterkeyhint: "search", "aria-keyshortcuts": "Control+F Meta+F", "aria-describedby": `${id}-count ${id}-error` });
  const findField = h(doc, "label", { class: "opf-find-field", for: `${id}-find` }, h(doc, "span", { text: "Find" }), findInput);
  const previousButton = h(doc, "button", { type: "button", "aria-label": "Previous match", title: "Previous match (Shift+Enter)", text: "↑" });
  const nextButton = h(doc, "button", { type: "button", "aria-label": "Next match", title: "Next match (Enter)", text: "↓" });
  const findRow = h(doc, "div", { class: "opf-find-row" }, findField, previousButton, nextButton);

  const replaceInput = h(doc, "input", { type: "text", id: `${id}-replace`, autocomplete: "off", autocapitalize: "off", spellcheck: "false", enterkeyhint: "go", "aria-keyshortcuts": "Control+H Meta+H" });
  const replaceField = h(doc, "label", { class: "opf-find-field", for: `${id}-replace` }, h(doc, "span", { text: "Replace with" }), replaceInput);
  const replaceOneButton = h(doc, "button", { type: "button", text: "Replace" });
  const replaceAllButton = h(doc, "button", { type: "button", class: "opf-find-primary", "aria-keyshortcuts": "Control+Alt+Enter", text: "Replace all" });
  const replaceRow = h(doc, "div", { class: "opf-find-row", hidden: true }, replaceField, replaceOneButton, replaceAllButton);

  const option = (key, label) => {
    const input = h(doc, "input", { type: "checkbox", "data-option": key });
    return { input, label: h(doc, "label", { class: "opf-find-opt" }, input, h(doc, "span", { text: label })) };
  };
  const optCase = option("matchCase", "Match case");
  const optWord = option("wholeWord", "Whole word");
  const optRegex = option("regex", "Regex");
  const optSlide = option("thisSlide", "This slide only");
  const optionsRow = h(doc, "div", { class: "opf-find-row", role: "group", "aria-label": "Search options" }, optCase.label, optWord.label, optRegex.label, optSlide.label);

  const count = h(doc, "p", { class: "opf-find-count", id: `${id}-count`, role: "status", "aria-live": "polite" });
  const undoButton = h(doc, "button", { type: "button", class: "opf-find-undo", text: "Undo", hidden: true });
  const statusRow = h(doc, "div", { class: "opf-find-row" }, count, undoButton);
  const errorLine = h(doc, "p", { class: "opf-find-error", id: `${id}-error`, role: "alert" });
  const list = h(doc, "ul", { class: "opf-find-results", "aria-label": "Matches" });
  root.append(head, findRow, replaceRow, optionsRow, statusRow, errorLine, list);
  container.append(root);

  const report = (message, error = false) => options.onStatus?.(message, { error });
  const setError = (message) => {
    errorLine.textContent = message ?? "";
    findInput.setAttribute("aria-invalid", message ? "true" : "false");
  };
  const sessionOptions = () => ({
    matchCase: state.matchCase,
    wholeWord: state.wholeWord,
    regex: state.regex,
    slideIndex: state.thisSlide ? (options.getSlideIndex?.() ?? getCanvas()?.slideIndex ?? 0) : undefined,
  });

  function renderResults() {
    const { matches } = result;
    list.replaceChildren();
    matches.slice(0, MAX_LISTED).forEach((match, index) => {
      const mark = h(doc, "mark", { text: match.context.match });
      const text = h(doc, "span", { class: "opf-find-text" }, doc.createTextNode(match.context.before), mark, doc.createTextNode(match.context.after));
      const button = h(doc, "button", { type: "button", class: "opf-find-result", "aria-current": index === current ? "true" : "false", "data-index": String(index), "aria-label": `${whereLabel(match)}: ${match.context.before}${match.context.match}${match.context.after}` },
        h(doc, "span", { class: "opf-find-where", text: whereLabel(match) }), text);
      list.append(h(doc, "li", {}, button));
    });
    if (matches.length > MAX_LISTED) list.append(h(doc, "li", { class: "opf-find-more", text: `Showing the first ${MAX_LISTED} of ${matches.length}${result.truncated ? "+" : ""} matches.` }));
  }

  function renderCount() {
    const { matches } = result;
    if (state.query === "") count.textContent = "Type to search the whole presentation.";
    else if (result.error) count.textContent = "";
    else if (!matches.length) count.textContent = `No matches${state.thisSlide ? " on this slide" : ""}.`;
    else {
      const slides = new Set(matches.filter((match) => match.slideIndex >= 0).map((match) => match.slideIndex)).size;
      const deck = matches.some((match) => match.slideIndex < 0);
      const where = [slides ? plural(slides, "slide") : "", deck ? "the presentation settings" : ""].filter(Boolean).join(" and ");
      count.textContent = `${current >= 0 ? `${current + 1} of ` : ""}${matches.length}${result.truncated ? "+" : ""} ${matches.length === 1 ? "match" : "matches"} in ${where}`;
    }
  }

  function renderButtons() {
    const any = result.matches.length > 0 && !result.error;
    previousButton.disabled = nextButton.disabled = !any;
    replaceOneButton.disabled = !any;
    replaceAllButton.disabled = !any;
    root.toggleAttribute("data-has-matches", any);
  }

  function search(keep) {
    const before = current >= 0 ? result.matches[current] : undefined;
    result = findMatches(editor.document, state.query, sessionOptions());
    setError(result.error);
    if (!result.matches.length) current = -1;
    else if (keep && before) {
      // Keep the same place after a document change: the match at the same field and offset, else the first at or after it.
      const same = result.matches.findIndex((match) => match.pointer === before.pointer && match.start >= before.start);
      current = same >= 0 ? same : Math.min(current, result.matches.length - 1);
    } else {
      const slide = options.getSlideIndex?.() ?? getCanvas()?.slideIndex ?? 0;
      const first = result.matches.findIndex((match) => match.slideIndex >= slide);
      current = first >= 0 ? first : 0;
    }
    renderCount();
    renderResults();
    renderButtons();
  }

  async function goTo(index, { focusResult = false, via = "list" } = {}) {
    const match = result.matches[index];
    if (!match) return;
    current = index;
    renderCount();
    for (const button of list.querySelectorAll(".opf-find-result")) button.setAttribute("aria-current", button.dataset.index === String(index) ? "true" : "false");
    list.querySelector(`[data-index="${index}"]`)?.scrollIntoView?.({ block: "nearest" });
    if (focusResult) list.querySelector(`[data-index="${index}"]`)?.focus();
    if (options.commit ? !options.commit() : getCanvas() && !getCanvas().commit()) return;
    let selected = null;
    if (match.slideIndex >= 0) {
      if (options.goToSlide) await options.goToSlide(match.slideIndex);
      else if (getCanvas() && getCanvas().slideIndex !== match.slideIndex) getCanvas().setSlide(match.slideIndex);
      if (destroyed) return;
      selected = getCanvas()?.reveal(match.path) ?? null;
    }
    options.onGoTo?.(match, selected, { via });
    report(`${whereLabel(match)}: ${match.context.before}${match.context.match}${match.context.after}`);
  }

  const step = (delta) => {
    if (!result.matches.length) return;
    const total = result.matches.length;
    return goTo((((current < 0 ? (delta > 0 ? -1 : 0) : current) + delta) % total + total) % total, { via: "step" });
  };

  function finishCommit() {
    if (options.commit ? !options.commit() : getCanvas() && !getCanvas().commit()) {
      setError("Finish or cancel the edit in progress first.");
      return false;
    }
    return true;
  }

  function doReplaceOne() {
    const match = result.matches[current];
    if (!match || !finishCommit()) return;
    const order = new Map(collectSearchFields(editor.document, sessionOptions()).map((field, index) => [field.pointer, index]));
    const fieldText = textOf(getValueAtPath(editor.document, match.pointer));
    const written = match.start + expandReplacement(state.replacement, match, fieldText, state.regex).length;
    try {
      replaceMatch(editor, match, state.query, state.replacement, sessionOptions());
    } catch (error) {
      setError(error.message);
      search(true);
      return;
    }
    lastReplaceAll = null;
    undoButton.hidden = true;
    setError("");
    // Move on to the next match after the replaced text, in reading order (never the text just written).
    const replacedAt = order.get(match.pointer) ?? -1;
    result = findMatches(editor.document, state.query, sessionOptions());
    const nextOrder = new Map(collectSearchFields(editor.document, sessionOptions()).map((field, index) => [field.pointer, index]));
    let next = result.matches.findIndex((candidate) => {
      const position = nextOrder.get(candidate.pointer) ?? Infinity;
      return position > replacedAt || (position === replacedAt && candidate.start >= written);
    });
    if (next < 0 && result.matches.length) next = 0;
    current = next;
    renderCount();
    renderResults();
    renderButtons();
    report(`Replaced one match${result.matches.length ? `; ${plural(result.matches.length, "match", "matches")} left` : "; no matches left"}`);
    if (current >= 0) goTo(current, { via: "step" });
  }

  function doReplaceAll() {
    if (!result.matches.length || !finishCommit()) return;
    let done;
    try {
      done = replaceAll(editor, state.query, state.replacement, sessionOptions());
    } catch (error) {
      setError(error.issues?.[0]?.message ?? error.message);
      search(true);
      return;
    }
    setError("");
    search(false);
    const message = done.count ? `Replaced ${plural(done.count, "match", "matches")} in ${plural(done.fieldCount, "text field")}. One undo restores them.` : "Nothing to replace.";
    lastReplaceAll = done.count ? done : null;
    undoButton.hidden = !lastReplaceAll;
    count.textContent = message;
    report(message);
  }

  function setMode(replace) {
    state.replaceMode = replace;
    replaceRow.hidden = !replace;
    title.textContent = replace ? "Find and replace" : "Find";
  }

  function readOptions() {
    state.query = findInput.value;
    state.replacement = replaceInput.value;
    state.matchCase = optCase.input.checked;
    state.wholeWord = optWord.input.checked;
    state.regex = optRegex.input.checked;
    state.thisSlide = optSlide.input.checked;
  }
  const onInput = () => {
    readOptions();
    lastReplaceAll = null;
    undoButton.hidden = true;
    search(false);
  };
  findInput.addEventListener("input", onInput);
  replaceInput.addEventListener("input", readOptions);
  for (const item of [optCase, optWord, optRegex, optSlide]) item.input.addEventListener("change", onInput);
  previousButton.addEventListener("click", () => step(-1));
  nextButton.addEventListener("click", () => step(1));
  replaceOneButton.addEventListener("click", doReplaceOne);
  replaceAllButton.addEventListener("click", doReplaceAll);
  undoButton.addEventListener("click", () => {
    if (!lastReplaceAll) return;
    lastReplaceAll = null;
    undoButton.hidden = true;
    editor.undo();
    search(false);
    count.textContent = "Undid the replacement.";
    report("Undid the replacement");
  });
  closeButton.addEventListener("click", () => api.close());
  list.addEventListener("click", (event) => {
    const button = event.target.closest?.(".opf-find-result");
    if (button) goTo(Number(button.dataset.index));
  });
  list.addEventListener("keydown", (event) => {
    const buttons = [...list.querySelectorAll(".opf-find-result")];
    const at = buttons.indexOf(doc.activeElement);
    if (at < 0 || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const to = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, at + (event.key === "ArrowDown" ? 1 : -1)));
    buttons[to]?.focus();
  });
  root.addEventListener("keydown", (event) => {
    const meta = event.ctrlKey || event.metaKey;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      api.close();
    } else if (event.key === "F3") {
      event.preventDefault();
      step(event.shiftKey ? -1 : 1);
    } else if (event.key === "Enter" && event.target === findInput) {
      event.preventDefault();
      step(event.shiftKey ? -1 : 1);
    } else if (event.key === "Enter" && event.target === replaceInput) {
      event.preventDefault();
      if (meta && event.altKey) doReplaceAll();
      else doReplaceOne();
    } else if (event.key === "Enter" && meta && event.altKey) {
      event.preventDefault();
      doReplaceAll();
    }
  });
  const unsubscribe = editor.subscribe(() => {
    if (destroyed || !state.open) return;
    search(true);
  });

  const api = {
    element: root,
    get isOpen() { return state.open; },
    get matches() { return result.matches; },
    get current() { return current; },
    /** Show the panel (find, or find and replace with `{ replace: true }`), focus the find field and select its text. `{ query }` seeds the search. */
    open({ replace = state.replaceMode, query } = {}) {
      if (destroyed) return;
      opener = state.open ? opener : doc.activeElement;
      const seed = query ?? options.getSelectionText?.();
      if (typeof seed === "string" && seed.trim() && !/[\r\n]/.test(seed) && seed.length <= 200) findInput.value = seed;
      state.open = true;
      root.hidden = false;
      setMode(replace);
      readOptions();
      search(false);
      findInput.focus();
      findInput.select();
    },
    close() {
      if (!state.open) return;
      state.open = false;
      root.hidden = true;
      const restore = opener && doc.contains(opener) ? opener : null;
      opener = null;
      restore?.focus?.({ preventScroll: true });
      options.onClose?.();
    },
    /** Set the search programmatically (tests and hosts). */
    set(values = {}) {
      if (typeof values.query === "string") findInput.value = values.query;
      if (typeof values.replacement === "string") replaceInput.value = values.replacement;
      for (const [key, item] of [["matchCase", optCase], ["wholeWord", optWord], ["regex", optRegex], ["thisSlide", optSlide]]) if (typeof values[key] === "boolean") item.input.checked = values[key];
      readOptions();
      search(false);
    },
    next: () => step(1),
    previous: () => step(-1),
    goTo,
    replaceOne: doReplaceOne,
    replaceAll: doReplaceAll,
    refresh: () => search(true),
    destroy() {
      destroyed = true;
      unsubscribe();
      root.remove();
    },
  };
  return api;
}

/**
 * Wire the find shortcuts on a document: Ctrl/Cmd+F opens find, Ctrl/Cmd+H and Ctrl/Cmd+Shift+H open find and replace
 * (macOS reserves Cmd+H for hiding the window, so use Ctrl+H or Cmd+Shift+H there). The browser's own find is only
 * replaced while the editor has the focus; a modal dialog that is open keeps its own handling. Returns a function that
 * removes the listener. `isEnabled()` can turn the shortcuts off.
 */
export function installFindShortcuts(panel, { document: doc = globalThis.document, isEnabled } = {}) {
  const handler = (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || isEnabled?.() === false) return;
    const key = event.key.toLowerCase();
    const wantsReplace = key === "h";
    const wantsFind = key === "f" && !event.shiftKey;
    if (!wantsFind && !wantsReplace) return;
    // A modal dialog (the source editor, import, export) keeps its own find.
    const modal = doc.querySelector?.("dialog[open]");
    if (modal && !modal.contains(panel.element)) return;
    event.preventDefault();
    event.stopPropagation();
    panel.open(wantsReplace ? { replace: true } : {});
  };
  doc.addEventListener("keydown", handler, true);
  return () => doc.removeEventListener("keydown", handler, true);
}
