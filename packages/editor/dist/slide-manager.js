// Slide manager (RR-21): the DOM list of slides used as the slide navigator and, with `variant: "sorter"`, as the slide sorter grid. It
// selects (click, Ctrl/Cmd+click, Shift+click, Shift+arrows), reorders by drag and drop and by keyboard (Alt+arrows), and offers every slide
// operation from a toolbar and a context menu: add (with a layout), duplicate, delete, hide, sections, split and merge. Each action is one
// undoable session change from `slides.js`; the manager owns no document state, only the selection, and it announces every result in a
// polite live region. Importing needs no DOM; mounting does.
import {
  addSection, addSlide, duplicateSlides, hasSections, listSections, moveSection, moveSlides, moveSlidesBy, removeSection, removeSlides, renameSection, setHidden, setSection, slideTitle,
} from "./slides.js";
import { listSwitchOptions } from "./switches.js";

let instances = 0;
const SVG_NS = "http://www.w3.org/2000/svg";
const MIME = "application/x-opf-slides";
const ICONS = {
  duplicate: "M8 8h12v13H8zM15 8V3H3v13h5",
  delete: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  hide: "M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.2 9.5 6-.4.8-1.3 2.1-2.7 3.4M6.6 7.7C4.4 9.1 3 11.2 2.5 12c1 1.8 4.5 6 9.5 6 1.3 0 2.5-.3 3.6-.8M9.9 10a3 3 0 0 0 4.1 4.1",
  show: "M2.5 12c1-1.8 4.5-6 9.5-6s8.5 4.2 9.5 6c-1 1.8-4.5 6-9.5 6s-8.5-4.2-9.5-6zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
};

function icon(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", name === "more" ? "3" : "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", ICONS[name]);
  svg.append(path);
  return svg;
}
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
const range = (from, to) => Array.from({ length: Math.abs(to - from) + 1 }, (_, offset) => Math.min(from, to) + offset);
const isMac = () => /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? "");

/**
 * Mount the slide list into `container` (a `nav` or `div`; one `.slide-card` button per slide, with section headers between when the deck has
 * sections). Options: `editor`, `getSlideIndex()`, `setSlideIndex(index)`, `renderThumbnail(presentation, index)` (an HTML string), `variant`
 * (`"navigator"` or `"sorter"`), `toolbar` (an element to fill with the action buttons), `contentActions` (the RR-26 split and merge
 * functions: `{ splitSlideByBlocks, mergeSlides }`), `layoutOptions(presentation)` (layout choices for "Add slide with layout"), `onStatus(message)`
 * `autoRender` (false to skip the first draw) and `onError(error)`. Returns `{ render, getSelection, setSelection, openLayoutPicker, destroy }`.
 */
export function createSlideManager(container, options) {
  const { editor } = options;
  const variant = options.variant === "sorter" ? "sorter" : "navigator";
  const id = `opf-slides-${++instances}`;
  const doc = container.ownerDocument;
  let selection = new Set();
  let anchor = 0;
  let focusIndex = 0;
  let pendingFocus = false;
  const collapsed = new Set(); // section start labels collapsed by the user, by `${occurrence}:${name}`
  let drag;
  let menu;

  container.classList.add("opf-slides");
  container.dataset.variant = variant;
  const live = el("div", { class: "sr-only opf-slides-live", role: "status", "aria-live": "polite", "aria-atomic": "true", id: `${id}-live` });
  container.after(live);
  const hint = el("span", { id: `${id}-hint`, class: "sr-only", text: variant === "sorter"
    ? "Arrow keys move between slides. Shift plus arrow keys extend the selection. Alt plus arrow keys move the selected slides. Delete removes them. Press the context menu key for more actions."
    : "Up and Down arrows move between slides. Shift plus arrow keys extend the selection. Alt plus Up or Down moves the selected slides. Delete removes them. Press the context menu key for more actions." });
  container.after(hint);

  const deck = () => editor.presentation;
  const count = () => deck().slides.length;
  const current = () => Math.max(0, Math.min(count() - 1, options.getSlideIndex()));
  const announce = (message) => {
    live.textContent = "";
    // Re-set on the next tick so the same message announces twice in a row.
    globalThis.setTimeout(() => { live.textContent = message; }, 20);
    options.onStatus?.(message);
  };
  const report = (error) => {
    const message = error?.issues?.[0]?.message ?? error?.message ?? String(error);
    announce(message);
    options.onError?.(error);
  };
  const selectedList = () => {
    const all = [...selection].filter((index) => index >= 0 && index < count());
    if (!all.includes(current())) all.push(current());
    return [...new Set(all)].sort((a, b) => a - b);
  };
  const sectionLabel = (name) => (name === undefined ? "No section" : name);

  // --- rendering ------------------------------------------------------------------------------------

  function sectionKey(sections, section) {
    const occurrence = sections.slice(0, section.index).filter((other) => other.name === section.name).length;
    return `${occurrence}:${section.name ?? ""}`;
  }
  function render() {
    const presentation = deck();
    const sections = hasSections(presentation) ? listSections(presentation) : [];
    const slideCount = presentation.slides.length;
    selection = new Set([...selection].filter((index) => index < slideCount));
    selection.add(current());
    if (selection.size === 1) anchor = current();
    const hadFocus = pendingFocus || container.contains(doc.activeElement);
    pendingFocus = false;
    if (!container.contains(doc.activeElement) && !hadFocus) focusIndex = current();
    focusIndex = Math.max(0, Math.min(slideCount - 1, focusIndex));
    // The current slide's section is never collapsed away from it.
    for (const section of sections) if (current() >= section.start && current() < section.start + section.count) collapsed.delete(sectionKey(sections, section));
    const nodes = [];
    const sectionAtStart = new Map(sections.map((section) => [section.start, section]));
    const sectionOfIndex = (index) => sections.find((section) => index >= section.start && index < section.start + section.count);
    presentation.slides.forEach((slide, index) => {
      const section = sectionAtStart.get(index);
      if (section) nodes.push(sectionHeader(sections, section));
      const owner = sectionOfIndex(index);
      if (owner && collapsed.has(sectionKey(sections, owner))) return;
      nodes.push(card(presentation, slide, index, slideCount));
    });
    container.replaceChildren(...nodes);
    container.setAttribute("aria-label", variant === "sorter" ? "Slide sorter" : "Slides");
    if (hadFocus) container.querySelector(`.slide-card[data-index="${focusIndex}"]`)?.focus({ preventScroll: false });
    renderToolbar();
  }
  function card(presentation, slide, index, slideCount) {
    const selected = selection.has(index);
    const title = slideTitle(slide) || "Untitled slide";
    const hidden = slide.hidden === true;
    const button = el("button", {
      type: "button", class: "slide-card", draggable: "true", "data-index": index, "aria-current": String(index === current()),
      "aria-label": `Slide ${index + 1} of ${slideCount}: ${title}${hidden ? ", hidden" : ""}${selected && selection.size > 1 ? ", selected" : ""}`,
      "aria-describedby": `${id}-hint`, "aria-keyshortcuts": "Alt+ArrowUp Alt+ArrowDown Delete", tabindex: index === focusIndex ? "0" : "-1",
    });
    button.dataset.selected = String(selected);
    button.dataset.hidden = String(hidden);
    // Some browsers (Firefox) do not start a drag from a <button> itself, only from what is inside it: the contents are draggable too, and
    // their dragstart and dragend bubble to the card.
    const number = el("span", { class: "thumbnail-number", draggable: "true", text: String(index + 1).padStart(2, "0") });
    const thumbnail = el("span", { class: "thumbnail", "aria-hidden": "true" });
    let html = "";
    try { html = options.renderThumbnail?.(presentation, index) ?? ""; } catch { html = "Preview unavailable"; }
    thumbnail.innerHTML = html;
    thumbnail.querySelectorAll("[tabindex]").forEach((node) => node.removeAttribute("tabindex"));
    const label = el("span", { class: "thumbnail-title", text: slideTitle(slide) || "Untitled slide" });
    const content = el("span", { class: "thumbnail-content", draggable: "true" }, thumbnail, label);
    if (hidden) content.append(el("span", { class: "slide-badge", text: "Hidden" }));
    button.append(number, content);
    button.addEventListener("click", (event) => choose(index, event));
    button.addEventListener("keydown", (event) => keydown(event, index));
    button.addEventListener("focus", () => { focusIndex = index; });
    button.addEventListener("contextmenu", (event) => { event.preventDefault(); if (!selection.has(index)) choose(index, {}); openMenu(event.clientX, event.clientY, button); });
    button.addEventListener("dragstart", (event) => dragStart(event, index, button));
    button.addEventListener("dragend", dragEnd);
    return button;
  }
  function sectionHeader(sections, section) {
    const key = sectionKey(sections, section);
    const isCollapsed = collapsed.has(key);
    const name = sectionLabel(section.name);
    const header = el("div", { class: "slide-section", "data-section": section.index, "data-unnamed": String(section.unnamed) });
    const toggle = el("button", {
      type: "button", class: "section-toggle", "aria-expanded": String(!isCollapsed), "aria-label": `${name}, ${plural(section.count, "slide")}`,
      onclick: () => { if (isCollapsed) collapsed.delete(key); else collapsed.add(key); render(); },
    }, el("span", { class: "section-caret", "aria-hidden": "true", text: isCollapsed ? "▸" : "▾" }), el("span", { class: "section-name", text: name }), el("span", { class: "section-count", "aria-hidden": "true", text: String(section.count) }));
    const more = el("button", { type: "button", class: "section-more", "aria-label": `Section actions: ${name}`, "aria-haspopup": "menu", title: "Section actions" });
    more.append(icon("more"));
    more.addEventListener("click", () => { const box = more.getBoundingClientRect(); openMenu(box.left, box.bottom, more, sectionMenu(section)); });
    header.append(toggle, more);
    header.addEventListener("dragover", (event) => { if (!hasSlides(event)) return; event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move"; mark(header, "drop-into"); });
    header.addEventListener("dragleave", () => header.classList.remove("drop-into"));
    header.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearMarks();
      const target = isCollapsed ? section.start + section.count : section.start;
      dropSlides(target, section.name ?? null);
    });
    return header;
  }

  // --- selection and navigation ---------------------------------------------------------------------

  function setCurrent(index) {
    options.setSlideIndex(index);
  }
  function choose(index, event) {
    const modifier = event.ctrlKey || event.metaKey;
    if (event.shiftKey) selection = new Set(range(anchor, index));
    else if (modifier) { if (selection.has(index) && selection.size > 1) selection.delete(index); else selection.add(index); anchor = index; }
    else { selection = new Set([index]); anchor = index; }
    focusIndex = index;
    pendingFocus = true;
    if (event.shiftKey || modifier) { options.setSlideIndex(index); }
    else setCurrent(index);
    // The host refreshes (and re-renders) on a slide change; render here too so a selection-only change is visible at once.
    render();
  }
  /** How many slides sit in one row of the sorter grid (1 in the navigator). */
  function columns() {
    if (variant !== "sorter") return 1;
    const tracks = doc.defaultView.getComputedStyle(container).gridTemplateColumns;
    const count = typeof tracks === "string" && tracks !== "none" ? tracks.trim().split(/\s+/).length : 1;
    return Math.max(1, count);
  }
  function keydown(event, index) {
    const last = count() - 1;
    const step = (delta) => Math.max(0, Math.min(last, index + delta));
    const mod = event.ctrlKey || event.metaKey;
    const verticalStep = variant === "sorter" ? columns() : 1;
    const arrows = { ArrowUp: -verticalStep, ArrowDown: verticalStep, ArrowLeft: variant === "sorter" ? -1 : 0, ArrowRight: variant === "sorter" ? 1 : 0 };
    if (event.altKey && !mod && event.key in arrows && arrows[event.key] !== 0) {
      event.preventDefault();
      moveBy(selectedList(), arrows[event.key]);
      return;
    }
    if (event.key in arrows && arrows[event.key] !== 0 && !event.altKey && !mod) {
      event.preventDefault();
      const target = step(arrows[event.key]);
      if (event.shiftKey) { selection = new Set(range(anchor, target)); } else { selection = new Set([target]); anchor = target; }
      focusIndex = target;
      pendingFocus = true;
      options.setSlideIndex(target);
      render();
      return;
    }
    if ((event.key === "Home" || event.key === "End") && !event.altKey && !mod) {
      event.preventDefault();
      const target = event.key === "Home" ? 0 : last;
      if (event.shiftKey) selection = new Set(range(anchor, target)); else { selection = new Set([target]); anchor = target; }
      focusIndex = target;
      pendingFocus = true;
      options.setSlideIndex(target);
      render();
      return;
    }
    if (mod && event.key.toLowerCase() === "a") { event.preventDefault(); selection = new Set(range(0, last)); pendingFocus = true; render(); announce(`${plural(count(), "slide")} selected`); return; }
    if (mod && event.key.toLowerCase() === "d" && !event.shiftKey && !event.altKey) { event.preventDefault(); act("duplicate"); return; }
    if ((event.key === "Delete" || event.key === "Backspace") && !mod && !event.altKey) { event.preventDefault(); act("delete"); return; }
    if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
      event.preventDefault();
      const box = event.currentTarget.getBoundingClientRect();
      openMenu(box.left + 12, box.top + 12, event.currentTarget);
      return;
    }
    if (event.key === "Escape" && selection.size > 1) { selection = new Set([current()]); anchor = current(); pendingFocus = true; render(); announce("Selection cleared"); }
  }

  // --- actions --------------------------------------------------------------------------------------

  function show(change, message) {
    if (!change?.changed) return false;
    const target = change.selection?.length ? change.selection : [current()];
    selection = new Set(target);
    anchor = target[0];
    focusIndex = target[0];
    pendingFocus = true;
    options.setSlideIndex(target[0]);
    render();
    announce(message);
    return true;
  }
  function moveBy(indices, delta) {
    try {
      const before = deck().slides.length;
      const change = moveSlidesBy(editor, indices, delta);
      if (!change.changed) { announce(delta < 0 ? (indices.includes(0) ? "Already the first slide" : "Cannot move up") : "Already the last slide"); return; }
      const position = change.selection[0] + 1;
      show(change, indices.length === 1 ? `Slide moved to position ${position} of ${before}${sectionNote(change.selection[0])}` : `${plural(indices.length, "slide")} moved, now at positions ${change.selection.map((index) => index + 1).join(", ")} of ${before}`);
    } catch (error) { report(error); }
  }
  function sectionNote(index) {
    const presentation = deck();
    if (!hasSections(presentation)) return "";
    const name = presentation.slides[index].section;
    return name ? `, in section ${name}` : ", with no section";
  }
  function moveTo(indices, edge) {
    try {
      const to = edge === "start" ? 0 : count();
      const change = moveSlides(editor, indices, to);
      if (!change.changed) { announce(edge === "start" ? "Already at the start" : "Already at the end"); return; }
      show(change, `${plural(indices.length, "slide")} moved to the ${edge}`);
    } catch (error) { report(error); }
  }
  function act(name, extra) {
    const list = selectedList();
    try {
      if (name === "duplicate") {
        const change = duplicateSlides(editor, list);
        show(change, `Duplicated ${plural(list.length, "slide")}. Undo with ${isMac() ? "Command" : "Control"} Z.`);
      } else if (name === "delete") {
        const total = count();
        if (list.length >= total) { announce("A presentation needs at least one slide"); return; }
        const change = removeSlides(editor, list);
        show(change, `Deleted ${plural(list.length, "slide")}. ${total - list.length} left. Undo with ${isMac() ? "Command" : "Control"} Z.`);
      } else if (name === "hide") {
        const change = setHidden(editor, list);
        show(change, change.hidden ? `${plural(list.length, "slide")} hidden from the slide show` : `${plural(list.length, "slide")} shown again`);
        if (change.changed) { selection = new Set(list); render(); }
      } else if (name === "split") {
        const change = options.contentActions.splitSlideByBlocks(editor, current(), { each: true });
        if (!change.changed) { announce(change.reason ?? "This slide has nothing to split"); return; }
        const first = change.range?.start ?? current();
        const total = change.slideCount ?? 2;
        const slides = range(first, first + total - 1);
        show({ changed: true, selection: slides }, `Slide split into ${total} slides`);
      } else if (name === "merge") {
        const sorted = list;
        const contiguous = sorted.length > 1 && sorted.every((index, at) => at === 0 || index === sorted[at - 1] + 1);
        const start = contiguous ? sorted[0] : current();
        const total = contiguous ? sorted.length : 2;
        if (start + total > count()) { announce("There is no slide after this one to merge with"); return; }
        const change = options.contentActions.mergeSlides(editor, start, total);
        if (!change.changed) { announce(change.reason ?? "Nothing to merge"); return; }
        const loss = change.loss?.length ? ` Not carried over: ${change.loss.join(", ")}.` : "";
        show({ changed: true, selection: [start] }, `Merged ${plural(total, "slide")} into one.${loss}`);
      } else if (name === "move-start") moveTo(list, "start");
      else if (name === "move-end") moveTo(list, "end");
      else if (name === "move-up") moveBy(list, -1);
      else if (name === "move-down") moveBy(list, 1);
      else if (name === "select-all") { selection = new Set(range(0, count() - 1)); pendingFocus = true; render(); announce(`${plural(count(), "slide")} selected`); }
      else if (name === "new-section") sectionPrompt(list[0]);
      else if (name === "to-section") {
        const change = setSection(editor, list, extra.name);
        show(change, extra.name ? `${plural(list.length, "slide")} added to section ${extra.name}` : `${plural(list.length, "slide")} removed from their section`);
      }
    } catch (error) { report(error); }
  }
  async function sectionPrompt(index) {
    const presentation = deck();
    const hasAny = hasSections(presentation);
    const name = await ask("Add section", "Section name", hasAny ? "" : "Section 1", `The section starts at slide ${index + 1}.`);
    if (name === null) { focusCard(index); return; }
    try {
      const change = addSection(editor, index, name);
      show(change, `Section ${name} started at slide ${index + 1}`);
    } catch (error) { report(error); }
  }
  function focusCard(index) {
    focusIndex = index;
    container.querySelector(`.slide-card[data-index="${index}"]`)?.focus();
  }

  // --- section menu ---------------------------------------------------------------------------------

  function sectionMenu(section) {
    const sections = listSections(deck());
    const items = [];
    items.push({ label: "Rename section…", disabled: section.unnamed, run: async () => {
      const name = await ask("Rename section", "Section name", section.name ?? "");
      if (name === null) return;
      try { show(renameSection(editor, section.index, name), `Section renamed to ${name}`); } catch (error) { report(error); }
    } });
    items.push({ label: "Add section at this slide…", run: () => sectionPrompt(section.start) });
    items.push({ separator: true });
    items.push({ label: "Move section up", disabled: section.index === 0, run: () => runSection(() => moveSection(editor, section.index, section.index - 1), "Section moved up") });
    items.push({ label: "Move section down", disabled: section.index === sections.length - 1, run: () => runSection(() => moveSection(editor, section.index, section.index + 2), "Section moved down") });
    items.push({ separator: true });
    items.push({ label: "Remove section (keep slides)", disabled: section.unnamed, run: () => runSection(() => removeSection(editor, section.index), "Section removed; its slides joined the section before it") });
    items.push({ label: "Remove section and delete its slides", disabled: section.unnamed || section.count >= count(), run: () => runSection(() => removeSection(editor, section.index, { deleteSlides: true }), "Section and its slides deleted") });
    return items;
  }
  function runSection(run, message) {
    try { show(run(), message); } catch (error) { report(error); }
  }

  // --- context menu ---------------------------------------------------------------------------------

  function slideMenu() {
    const list = selectedList();
    const presentation = deck();
    const sections = hasSections(presentation) ? listSections(presentation) : [];
    const everyHidden = list.every((index) => presentation.slides[index].hidden === true);
    const first = list[0];
    const items = [
      { label: list.length > 1 ? `Duplicate ${list.length} slides` : "Duplicate slide", shortcut: `${isMac() ? "⌘" : "Ctrl"}+D`, run: () => act("duplicate") },
      { label: list.length > 1 ? `Delete ${list.length} slides` : "Delete slide", shortcut: "Delete", disabled: list.length >= count(), run: () => act("delete") },
      { label: everyHidden ? "Show slide in slide show" : "Hide slide from slide show", run: () => act("hide") },
      { separator: true },
      { label: "Move up", shortcut: "Alt+↑", disabled: list.includes(0) && list[0] === 0 && list.every((index, at) => index === at), run: () => act("move-up") },
      { label: "Move down", shortcut: "Alt+↓", disabled: list.every((index, at) => index === count() - list.length + at), run: () => act("move-down") },
      { label: "Move to start", run: () => act("move-start") },
      { label: "Move to end", run: () => act("move-end") },
      { separator: true },
      { label: "Add section here…", run: () => act("new-section") },
    ];
    if (sections.length) {
      const names = [...new Set(sections.map((section) => section.name).filter((name) => name !== undefined))];
      for (const name of names) items.push({ label: `Move to section: ${name}`, run: () => act("to-section", { name }) });
      items.push({ label: "Remove from section", run: () => act("to-section", { name: null }) });
    }
    if (options.contentActions) {
      const sorted = list;
      const contiguous = sorted.length > 1 && sorted.every((index, at) => at === 0 || index === sorted[at - 1] + 1);
      items.push({ separator: true });
      items.push({ label: "Split slide into one slide per block", disabled: list.length > 1, run: () => act("split") });
      items.push({ label: contiguous ? `Merge ${sorted.length} slides into one` : "Merge with next slide", disabled: !contiguous && first >= count() - 1, run: () => act("merge") });
    }
    items.push({ separator: true });
    items.push({ label: "Select all slides", shortcut: `${isMac() ? "⌘" : "Ctrl"}+A`, run: () => act("select-all") });
    return items;
  }
  function closeMenu(restore = true) {
    if (!menu) return;
    const { root, opener, off } = menu;
    off();
    root.remove();
    menu = undefined;
    // A render while the menu was open replaced the card it came from: fall back to the card at the same place.
    if (restore) (opener?.isConnected ? opener : container.querySelector(`.slide-card[data-index="${focusIndex}"]`))?.focus?.();
  }
  function openMenu(x, y, opener, items = slideMenu()) {
    closeMenu(false);
    const root = el("div", { class: "opf-menu", role: "menu", "aria-label": opener.getAttribute?.("aria-label") ?? "Slide actions", tabindex: "-1" });
    const buttons = [];
    for (const item of items) {
      if (item.separator) { root.append(el("div", { class: "opf-menu-separator", role: "separator" })); continue; }
      const button = el("button", { type: "button", role: "menuitem", class: "opf-menu-item", tabindex: "-1", disabled: item.disabled }, el("span", { text: item.label }), item.shortcut ? el("kbd", { text: item.shortcut }) : null);
      button.addEventListener("click", () => { closeMenu(false); Promise.resolve(item.run()).catch(report); });
      root.append(button);
      if (!item.disabled) buttons.push(button);
    }
    doc.body.append(root);
    const box = root.getBoundingClientRect();
    const view = doc.defaultView;
    root.style.left = `${Math.max(4, Math.min(x, view.innerWidth - box.width - 4))}px`;
    root.style.top = `${Math.max(4, Math.min(y, view.innerHeight - box.height - 4))}px`;
    const onKey = (event) => {
      const at = buttons.indexOf(doc.activeElement);
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeMenu(); }
      else if (event.key === "Tab") closeMenu(false);
      else if (event.key === "ArrowDown") { event.preventDefault(); buttons[(at + 1) % buttons.length]?.focus(); }
      else if (event.key === "ArrowUp") { event.preventDefault(); buttons[(at - 1 + buttons.length) % buttons.length]?.focus(); }
      else if (event.key === "Home") { event.preventDefault(); buttons[0]?.focus(); }
      else if (event.key === "End") { event.preventDefault(); buttons.at(-1)?.focus(); }
    };
    const onPointer = (event) => { if (!root.contains(event.target)) closeMenu(false); };
    root.addEventListener("keydown", onKey);
    doc.addEventListener("pointerdown", onPointer, true);
    menu = { root, opener, off: () => doc.removeEventListener("pointerdown", onPointer, true) };
    buttons[0]?.focus();
  }

  // --- dialogs --------------------------------------------------------------------------------------

  function ask(title, label, value = "", help = "") {
    return new Promise((resolve) => {
      const dialog = el("dialog", { class: "opf-sm-dialog", "aria-labelledby": `${id}-ask-title` });
      const input = el("input", { type: "text", id: `${id}-ask-input`, value, autocomplete: "off", spellcheck: "false", maxlength: "120" });
      const form = el("form", { method: "dialog" },
        el("h2", { id: `${id}-ask-title`, text: title }),
        el("label", { for: input.id, text: label }), input,
        help ? el("p", { class: "field-help", text: help }) : null,
        el("p", { class: "opf-sm-error", role: "alert" }),
        el("div", { class: "opf-sm-actions" }, el("button", { type: "button", class: "secondary", "data-cancel": "", text: "Cancel" }), el("button", { type: "submit", class: "primary", text: "OK" })));
      dialog.append(form);
      doc.body.append(dialog);
      let result = null;
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const text = input.value.trim();
        if (!text) { form.querySelector(".opf-sm-error").textContent = "Enter a name."; input.focus(); return; }
        result = text;
        dialog.close();
      });
      form.querySelector("[data-cancel]").addEventListener("click", () => dialog.close());
      dialog.addEventListener("close", () => { dialog.remove(); resolve(result); });
      dialog.showModal();
      input.select();
    });
  }
  function layoutChoices() {
    return options.layoutOptions ? options.layoutOptions(deck()) : listSwitchOptions(deck(), "layouts", { catalogs: editor.catalogs });
  }
  function openLayoutPicker() {
    const choices = layoutChoices();
    if (!choices.length) { announce("No layouts are available"); return; }
    const opener = doc.activeElement;
    const dialog = el("dialog", { class: "opf-sm-dialog opf-layout-dialog", "aria-labelledby": `${id}-layout-title` });
    const filter = el("input", { type: "search", id: `${id}-layout-filter`, placeholder: "Filter layouts", autocomplete: "off" });
    const select = el("select", { id: `${id}-layout-list`, size: "9", "aria-label": "Layouts" });
    const detail = el("p", { class: "field-help", id: `${id}-layout-detail`, "aria-live": "polite" });
    const where = el("select", { id: `${id}-layout-where` },
      el("option", { value: "after", text: "After the current slide" }), el("option", { value: "end", text: "At the end" }));
    const fill = () => {
      const needle = filter.value.trim().toLowerCase();
      const shown = choices.filter((choice) => !needle || `${choice.label} ${choice.id}`.toLowerCase().includes(needle));
      select.replaceChildren(...shown.map((choice) => el("option", { value: choice.id, text: choice.label })));
      if (shown.length) select.selectedIndex = 0;
      describe();
    };
    const describe = () => {
      const choice = choices.find((entry) => entry.id === select.value);
      const slots = Array.isArray(choice?.record?.placeholders) ? choice.record.placeholders.map((slot) => slot.type).join(", ") : "";
      detail.textContent = choice ? `${choice.record?.description ?? ""}${slots ? ` Slots: ${slots}.` : choice.record?.placeholders ? " An empty slide." : ""}`.trim() : "No layout matches.";
    };
    const form = el("form", { method: "dialog" },
      el("h2", { id: `${id}-layout-title`, text: "Add slide with layout" }),
      el("label", { for: filter.id, text: "Layout" }), filter,
      select, detail,
      el("label", { for: where.id, text: "Where" }), where,
      el("p", { class: "opf-sm-error", role: "alert" }),
      el("div", { class: "opf-sm-actions" }, el("button", { type: "button", class: "secondary", "data-cancel": "", text: "Cancel" }), el("button", { type: "submit", class: "primary", text: "Add slide" })));
    dialog.append(form);
    doc.body.append(dialog);
    filter.addEventListener("input", fill);
    select.addEventListener("change", describe);
    select.addEventListener("dblclick", () => form.requestSubmit());
    filter.addEventListener("keydown", (event) => { if (event.key === "ArrowDown") { event.preventDefault(); select.focus(); } });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!select.value) { form.querySelector(".opf-sm-error").textContent = "Choose a layout."; return; }
      try {
        const at = where.value === "end" ? count() : current() + 1;
        const change = addSlide(editor, { layout: select.value, at });
        dialog.close();
        show(change, `Added a slide with the ${choices.find((entry) => entry.id === select.value)?.label ?? select.value} layout at position ${change.index + 1}`);
      } catch (error) { form.querySelector(".opf-sm-error").textContent = error.message; }
    });
    form.querySelector("[data-cancel]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { dialog.remove(); if (!container.contains(doc.activeElement)) opener?.focus?.(); });
    fill();
    dialog.showModal();
    filter.focus();
  }

  // --- drag and drop --------------------------------------------------------------------------------

  const hasSlides = (event) => [...(event.dataTransfer?.types ?? [])].includes(MIME);
  function dragStart(event, index, node) {
    // Dragging a slide that is not selected drags just that slide; dragging a selected one drags the whole selection. Nothing re-renders
    // mid-drag (a rebuilt list would lose the drag), so the selection itself stays as it is until the drop.
    const list = selection.has(index) ? selectedList() : [index];
    drag = { indices: list };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(MIME, JSON.stringify(list));
    if (list.length > 1) {
      const badge = el("span", { class: "opf-drag-badge", text: `${list.length} slides` });
      doc.body.append(badge);
      event.dataTransfer.setDragImage(badge, 12, 12);
      globalThis.setTimeout(() => badge.remove(), 0);
    }
    container.classList.add("is-dragging");
    node.classList.add("is-drag-source");
    for (const other of container.querySelectorAll(".slide-card")) if (list.includes(Number(other.dataset.index))) other.classList.add("is-drag-source");
  }
  function dragEnd() {
    drag = undefined;
    container.classList.remove("is-dragging");
    clearMarks();
    for (const node of container.querySelectorAll(".is-drag-source")) node.classList.remove("is-drag-source");
  }
  function mark(node, className) {
    clearMarks();
    node.classList.add(className);
  }
  function clearMarks() {
    for (const node of container.querySelectorAll(".drop-before, .drop-after, .drop-into, .drop-end")) node.classList.remove("drop-before", "drop-after", "drop-into", "drop-end");
  }
  /** The drop gap and section under the pointer. */
  function dropTarget(event) {
    const node = event.target.closest?.(".slide-card");
    if (!node) return { gap: count(), node: null, after: true };
    const index = Number(node.dataset.index);
    const box = node.getBoundingClientRect();
    const after = variant === "sorter" ? event.clientX > box.left + box.width / 2 : event.clientY > box.top + box.height / 2;
    return { gap: index + (after ? 1 : 0), node, after, index };
  }
  function dropSlides(gap, section) {
    const list = drag?.indices ?? selectedList();
    drag = undefined;
    try {
      const change = moveSlides(editor, list, gap, hasSections(deck()) ? { section } : {});
      if (!change.changed) { announce("The slide stays where it is"); return; }
      show(change, list.length === 1 ? `Slide moved to position ${change.selection[0] + 1} of ${count()}${sectionNote(change.selection[0])}` : `${plural(list.length, "slide")} moved`);
    } catch (error) { report(error); }
  }
  const onDragOver = (event) => {
    if (!hasSlides(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const target = dropTarget(event);
    if (!target.node) { mark(container.lastElementChild ?? container, "drop-end"); return; }
    mark(target.node, target.after ? "drop-after" : "drop-before");
  };
  const onDrop = (event) => {
    if (!hasSlides(event)) return;
    event.preventDefault();
    const target = dropTarget(event);
    clearMarks();
    const sectionName = target.node ? (deck().slides[target.index].section ?? null) : (deck().slides.at(-1)?.section ?? null);
    dropSlides(target.gap, sectionName);
  };
  const onDragLeave = (event) => { if (!container.contains(event.relatedTarget)) clearMarks(); };
  container.addEventListener("dragover", onDragOver);
  container.addEventListener("drop", onDrop);
  container.addEventListener("dragleave", onDragLeave);

  // --- toolbar --------------------------------------------------------------------------------------

  let toolbarButtons;
  function renderToolbar() {
    const bar = options.toolbar;
    if (!bar) return;
    const list = selectedList();
    const everyHidden = list.every((index) => deck().slides[index].hidden === true);
    if (!toolbarButtons) {
      bar.setAttribute("role", "toolbar");
      bar.setAttribute("aria-label", "Slide actions");
      const make = (name, label, glyph, run) => {
        const button = el("button", { type: "button", class: "icon-button slide-tool", "data-action": name, "aria-label": label, title: label });
        button.append(icon(glyph));
        button.addEventListener("click", () => { run(); });
        return button;
      };
      toolbarButtons = {
        duplicate: make("duplicate", "Duplicate slide", "duplicate", () => act("duplicate")),
        delete: make("delete", "Delete slide", "delete", () => act("delete")),
        hide: make("hide", "Hide slide", "hide", () => act("hide")),
        more: make("more", "More slide actions", "more", () => { const box = toolbarButtons.more.getBoundingClientRect(); openMenu(box.left, box.bottom, toolbarButtons.more); }),
      };
      toolbarButtons.more.setAttribute("aria-haspopup", "menu");
      bar.replaceChildren(...Object.values(toolbarButtons));
      bar.addEventListener("keydown", (event) => {
        const buttons = Object.values(toolbarButtons).filter((button) => !button.disabled);
        const at = buttons.indexOf(doc.activeElement);
        if (event.key === "ArrowRight") { event.preventDefault(); buttons[(at + 1) % buttons.length]?.focus(); }
        else if (event.key === "ArrowLeft") { event.preventDefault(); buttons[(at - 1 + buttons.length) % buttons.length]?.focus(); }
      });
    }
    const many = list.length > 1;
    toolbarButtons.duplicate.setAttribute("aria-label", many ? `Duplicate ${list.length} slides` : "Duplicate slide");
    toolbarButtons.duplicate.title = toolbarButtons.duplicate.getAttribute("aria-label");
    toolbarButtons.delete.setAttribute("aria-label", many ? `Delete ${list.length} slides` : "Delete slide");
    toolbarButtons.delete.title = toolbarButtons.delete.getAttribute("aria-label");
    toolbarButtons.delete.disabled = list.length >= count();
    const hideLabel = everyHidden ? (many ? "Show slides" : "Show slide") : (many ? "Hide slides" : "Hide slide");
    toolbarButtons.hide.setAttribute("aria-label", hideLabel);
    toolbarButtons.hide.title = hideLabel;
    toolbarButtons.hide.replaceChildren(icon(everyHidden ? "show" : "hide"));
  }

  // A change that did not come from this manager (Undo, a canvas edit, Apply in the source dialog, the outline) leaves a multi-selection
  // meaningless, so the selection falls back to the current slide; the manager's own operations set it themselves afterwards.
  const unsubscribe = editor.subscribe((event) => { if (event.meta?.source !== "slides") selection = new Set(); });
  // A host that draws only after its fonts are loaded passes `autoRender: false` and calls `render()` itself.
  if (options.autoRender !== false) render();
  return {
    render,
    getSelection: selectedList,
    setSelection(indices) {
      selection = new Set(indices);
      anchor = indices[0] ?? 0;
      render();
    },
    /** Move focus to a slide's card. */
    focus: focusCard,
    openLayoutPicker,
    /** Collapse or expand a section (an index from `listSections`). Collapsing is view state: nothing is written to the document, and the section that holds the current slide cannot stay collapsed. */
    setSectionCollapsed(sectionIndex, isCollapsed = true) {
      const sections = listSections(deck());
      const section = sections[sectionIndex];
      if (!section) return false;
      const key = sectionKey(sections, section);
      if (isCollapsed) collapsed.add(key); else collapsed.delete(key);
      render();
      return true;
    },
    /** Run a named action on the selection: duplicate, delete, hide, move-up, move-down, move-start, move-end, split, merge, select-all. */
    run: act,
    destroy() {
      closeMenu(false);
      unsubscribe();
      container.removeEventListener("dragover", onDragOver);
      container.removeEventListener("drop", onDrop);
      container.removeEventListener("dragleave", onDragLeave);
      live.remove();
      hint.remove();
      container.replaceChildren();
      container.classList.remove("opf-slides");
    },
  };
}
