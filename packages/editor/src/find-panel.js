// Find and replace panel (RR-25): the DOM over the find-replace model, in the editor's one panel (src/panel.js, shared with Design and
// Export). A non-modal panel with a find field (the match count inside it), previous and next, a replace field with Replace and All, the
// options as toggle chips (match case, whole word, regular expression, this slide only), and the results grouped by slide, whose entries go to
// the match on the canvas. Replace all is one undo step and the panel offers it right there. Keyboard: Ctrl/Cmd+F opens find, Ctrl/Cmd+H (and
// Ctrl/Cmd+Shift+H) opens find and replace (see `installFindShortcuts`), Enter / Shift+Enter in the find field go to the next / previous
// match, F3 and Shift+F3 do the same anywhere in the panel, Enter in the replace field replaces the current match, Ctrl/Cmd+Alt+Enter
// replaces all, Esc closes and returns focus. With an `anchor` the panel opens under it (a bottom sheet on a phone) and closes when Design or
// Export opens; without one it is a card in its container. A press outside does not close it: the person edits the match on the slide.
// Styles in src/styles/panel.css (classes `opf-find-*`). Importing this module does not need a DOM.
import { el as h, icon } from "./export-dom.js";
import { getValueAtPath } from "./index.js";
import { collectSearchFields, expandReplacement, findMatches, replaceAll, replaceMatch, textOf } from "./find-replace.js";
import { PANEL_SHEET_QUERY, claimPanel, createPanelFrame, panelLabel, placePanel, releasePanel, shown } from "./panel.js";

const MAX_LISTED = 300;
let panelCounter = 0;

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

  const frame = createPanelFrame(doc, { id, title: "Find", label: "Find and replace", closeLabel: "Close find and replace", className: "opf-find" });
  const { element: root, heading: title, close: closeButton } = frame;
  root.dataset.opfComponent = "find-panel";
  root.dataset.mode = "docked";
  root.setAttribute("aria-modal", "false");
  closeButton.title = "Close (Esc)";

  // The find field with the match count inside it, then previous and next.
  const findInput = h(doc, "input", { type: "text", id: `${id}-find`, "aria-label": "Find", autocomplete: "off", autocapitalize: "off", spellcheck: "false", enterkeyhint: "search", "aria-keyshortcuts": "Control+F Meta+F", "aria-describedby": `${id}-count ${id}-error` });
  const position = h(doc, "span", { class: "opf-panel-meta opf-find-position", "aria-hidden": "true" });
  const findField = h(doc, "label", { class: "opf-panel-field opf-find-field" }, icon(doc, "Search", 14), findInput, position);
  const previousButton = h(doc, "button", { type: "button", class: "opf-panel-icon opf-find-step", "aria-label": "Previous match", title: "Previous match (Shift+Enter)" }, icon(doc, "ChevronUp", 14));
  const nextButton = h(doc, "button", { type: "button", class: "opf-panel-icon opf-find-step", "aria-label": "Next match", title: "Next match (Enter)" }, icon(doc, "ChevronDown", 14));
  const findRow = h(doc, "div", { class: "opf-find-row" }, findField, previousButton, nextButton);

  // The replace field, Replace (the current match) and All.
  const replaceInput = h(doc, "input", { type: "text", id: `${id}-replace`, "aria-label": "Replace with", placeholder: "Replace with", autocomplete: "off", autocapitalize: "off", spellcheck: "false", enterkeyhint: "go", "aria-keyshortcuts": "Control+H Meta+H" });
  const replaceField = h(doc, "label", { class: "opf-panel-field opf-find-field" }, replaceInput);
  const replaceOneButton = h(doc, "button", { type: "button", class: "opf-panel-button", text: "Replace" });
  const replaceAllButton = h(doc, "button", { type: "button", class: "opf-panel-button opf-panel-primary", "aria-label": "Replace all", "aria-keyshortcuts": "Control+Alt+Enter", text: "All" });
  const replaceRow = h(doc, "div", { class: "opf-find-row", hidden: true }, replaceField, replaceOneButton, replaceAllButton);

  // The options: toggle chips.
  const option = (key, label) => h(doc, "button", { type: "button", class: "opf-find-opt", "aria-pressed": "false", "data-option": key, text: label });
  const optCase = option("matchCase", "Match case");
  const optWord = option("wholeWord", "Whole word");
  const optRegex = option("regex", "Regex");
  const optSlide = option("thisSlide", "This slide");
  const chips = [optCase, optWord, optRegex, optSlide];
  const optionsRow = h(doc, "div", { class: "opf-find-row opf-find-options", role: "group", "aria-label": "Search options" }, ...chips);
  const errorLine = h(doc, "p", { class: "opf-find-error", id: `${id}-error`, role: "alert" });
  frame.head.after(h(doc, "div", { class: "opf-find-controls" }, findRow, replaceRow, optionsRow, errorLine));

  // The results, grouped by slide; the foot says how many and offers Undo after Replace all.
  const list = h(doc, "ul", { class: "opf-find-results", "aria-label": "Matches" });
  frame.body.append(list);
  const count = frame.note;
  count.id = `${id}-count`;
  count.classList.add("opf-find-count");
  count.setAttribute("role", "status");
  count.setAttribute("aria-live", "polite");
  const undoButton = h(doc, "button", { type: "button", class: "opf-panel-button opf-find-undo", text: "Undo", hidden: true });
  frame.foot.append(undoButton);
  frame.foot.hidden = false;
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

  // One small label per slide ("Slide 02 · 2 matches", "Presentation · 1 match") over its matches; each match names its place and shows the line.
  function renderResults() {
    const { matches } = result;
    const shown = matches.slice(0, MAX_LISTED);
    const groups = [];
    shown.forEach((match, index) => {
      if (groups.at(-1)?.slide !== match.slideIndex) groups.push({ slide: match.slideIndex, items: [] });
      groups.at(-1).items.push([match, index]);
    });
    list.replaceChildren(...groups.map(({ slide, items }, at) => {
      const all = matches.filter((match) => match.slideIndex === slide).length;
      const label = panelLabel(doc, `${slide < 0 ? "Presentation" : `Slide ${String(slide + 1).padStart(2, "0")}`} · ${plural(all, "match", "matches")}`, { id: `${id}-group-${at}` });
      const rows = items.map(([match, index]) => {
        const mark = h(doc, "mark", { text: match.context.match });
        const text = h(doc, "span", { class: "opf-find-text" }, doc.createTextNode(match.context.before), mark, doc.createTextNode(match.context.after));
        // WCAG 2.5.3 (label in name): no aria-label. The name is the visible text, the place and then the matching line, kept apart by a space.
        return h(doc, "li", {}, h(doc, "button", { type: "button", class: "opf-panel-row opf-find-result", "aria-current": index === current ? "true" : "false", "data-index": String(index) },
          h(doc, "span", { class: "opf-find-where", text: match.label }), " ", text));
      });
      return h(doc, "li", { class: "opf-find-group" }, label, h(doc, "ul", { class: "opf-panel-list", "aria-labelledby": label.id }, ...rows));
    }));
    if (matches.length > MAX_LISTED) list.append(h(doc, "li", { class: "opf-find-more", text: `Showing the first ${MAX_LISTED} of ${matches.length}${result.truncated ? "+" : ""} matches.` }));
    list.hidden = !shown.length;
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
    position.textContent = state.query === "" || result.error ? "" : `${current >= 0 ? `${current + 1} of ` : ""}${matches.length}${result.truncated ? "+" : ""}`;
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
    result = findMatches(editor.presentation, state.query, sessionOptions());
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
    const order = new Map(collectSearchFields(editor.presentation, sessionOptions()).map((field, index) => [field.pointer, index]));
    const fieldText = textOf(getValueAtPath(editor.presentation, match.pointer));
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
    result = findMatches(editor.presentation, state.query, sessionOptions());
    const nextOrder = new Map(collectSearchFields(editor.presentation, sessionOptions()).map((field, index) => [field.pointer, index]));
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
    for (const chip of chips) state[chip.dataset.option] = chip.getAttribute("aria-pressed") === "true";
  }
  const onInput = () => {
    readOptions();
    lastReplaceAll = null;
    undoButton.hidden = true;
    search(false);
  };
  findInput.addEventListener("input", onInput);
  replaceInput.addEventListener("input", readOptions);
  for (const chip of chips) {
    chip.addEventListener("click", () => {
      chip.setAttribute("aria-pressed", String(chip.getAttribute("aria-pressed") !== "true"));
      onInput();
    });
  }
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

  // ---- where it opens: under the anchor (a bottom sheet on a phone), or in its container --------------------------------------------------
  const win = doc.defaultView;
  const media = win?.matchMedia?.(PANEL_SHEET_QUERY);
  function place() {
    if (!state.open) return;
    const given = typeof options.anchor === "function" ? options.anchor() : options.anchor;
    if (!given) {
      root.dataset.mode = "docked";
      return;
    }
    placePanel(root, shown(given) ? given : null, Boolean(media?.matches) || !shown(given));
  }
  const onReflow = () => place();
  const resizer = win?.ResizeObserver ? new win.ResizeObserver(() => win.requestAnimationFrame(onReflow)) : null;
  function listen(on) {
    const method = on ? "addEventListener" : "removeEventListener";
    win?.[method]("resize", onReflow);
    win?.[method]("scroll", onReflow, true);
    media?.[method]?.("change", onReflow);
    if (on) resizer?.observe(root);
    else resizer?.disconnect();
  }
  // Design or Export opening closes this panel without moving the focus (they take it).
  const swapClose = () => close(false);
  function close(restoreFocus) {
    if (!state.open) return;
    state.open = false;
    root.hidden = true;
    releasePanel(doc, swapClose);
    listen(false);
    const restore = restoreFocus && opener && doc.contains(opener) ? opener : null;
    opener = null;
    restore?.focus?.({ preventScroll: true });
    options.onClose?.();
  }

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
      if (!state.open) {
        claimPanel(doc, swapClose);
        listen(true);
      }
      state.open = true;
      root.hidden = false;
      setMode(replace);
      readOptions();
      search(false);
      place();
      findInput.focus();
      findInput.select();
    },
    close: () => close(true),
    /** Set the search programmatically (tests and hosts). */
    set(values = {}) {
      if (typeof values.query === "string") findInput.value = values.query;
      if (typeof values.replacement === "string") replaceInput.value = values.replacement;
      for (const chip of chips) if (typeof values[chip.dataset.option] === "boolean") chip.setAttribute("aria-pressed", String(values[chip.dataset.option]));
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
      if (state.open) {
        releasePanel(doc, swapClose);
        listen(false);
      }
      destroyed = true;
      resizer?.disconnect();
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
