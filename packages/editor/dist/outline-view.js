// Outline view (RR-21): the deck as an editable outline. Slide titles are the top level; each slide's text, bullets and subtitle sit beneath
// it. Rows are native text inputs, so they work with screen readers, IME and the clipboard. Typing commits on Enter or when the row loses focus
// as ONE undoable change; structure edits (Enter for a new line or slide, Alt+Shift+Left/Right to promote and demote, Alt+Up/Down to move)
// are one undoable change each, built in `outline.js`. Content that is not text is shown as a read-only row, and formatted text stays
// read-only here, so nothing is flattened away. Importing needs no DOM; mounting does.
import {
  applyOutlineChange, prepareAddOutlineBullet, prepareInsertOutlineItem, prepareInsertOutlineSlide, prepareMoveOutlineItem, prepareMoveOutlineSlide, prepareOutlineDemoteSlide,
  prepareOutlinePromote, prepareRemoveOutlineItem, prepareSetOutlineText, prepareShiftOutlineItem, readOutline,
} from "./outline.js";
import { hasSections, prepareRemoveSlides } from "./slides.js";

let instances = 0;
function el(doc, tag, props = {}, ...children) {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Mount the outline into `container`. Options: `editor`, `onSelectSlide(index)` (called when a row takes focus, so the host can follow),
 * `getSlideIndex()` and `onStatus(message)`. Returns `{ render, focusSlide, destroy }`; the host calls `render()` after document changes.
 */
export function createOutlineView(container, options) {
  const { editor } = options;
  const doc = container.ownerDocument;
  const id = `opf-outline-${++instances}`;
  let rows = [];
  let renderedKeys = "";
  let lastSnapshot;
  let activeKey;
  let pendingFocus;
  let keys = [];

  container.classList.add("opf-outline");
  const live = el(doc, "div", { class: "sr-only", role: "status", "aria-live": "polite", "aria-atomic": "true" });
  const help = el(doc, "p", { id: `${id}-help`, class: "outline-help", text: "Type to edit. Enter adds a line (or a slide after a title). Alt+Shift+Right demotes, Alt+Shift+Left promotes, Alt+Up and Alt+Down move the line or slide. Backspace on an empty line removes it." });
  const bar = el(doc, "div", { class: "outline-toolbar", role: "toolbar", "aria-label": "Outline actions" });
  const list = el(doc, "ul", { class: "outline-list", "aria-label": "Presentation outline" });
  const tools = {};
  for (const [name, label] of [["promote", "Promote"], ["demote", "Demote"], ["up", "Move up"], ["down", "Move down"], ["add", "Add line below"]]) {
    const button = el(doc, "button", { type: "button", class: "secondary outline-tool", "data-action": name, text: label });
    // Keep the row's text selected: a click on a tool must not drop the caret before the action reads the row.
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => perform(name));
    tools[name] = button;
    bar.append(button);
  }
  container.replaceChildren(bar, help, list, live);

  const announce = (message) => {
    live.textContent = "";
    globalThis.setTimeout(() => { live.textContent = message; }, 20);
    options.onStatus?.(message);
  };
  const report = (error) => announce(error?.issues?.[0]?.message ?? error?.message ?? String(error));
  const rowByKey = (key) => rows.find((row) => row.key === key);
  const inputFor = (key) => list.querySelector(`[data-key="${CSS.escape(key)}"] .outline-input`);

  function label(row) {
    const slide = `Slide ${row.slideIndex + 1}`;
    if (row.kind === "slide") return `${slide} title`;
    if (row.kind === "subtitle") return `${slide} subtitle`;
    if (row.kind === "text") return `${slide} text${row.editable ? "" : " (formatted, edit it on the slide)"}`;
    if (row.kind === "other") return `${slide} ${row.label}, not editable in the outline`;
    return `${slide}, ${row.level > 1 ? `level ${row.level} ` : ""}bullet`;
  }
  function build(row) {
    const input = el(doc, "input", { type: "text", class: "outline-input", "aria-label": label(row), spellcheck: row.editable ? "true" : "false", autocomplete: "off", value: row.kind === "other" ? row.label : row.text, "aria-describedby": `${id}-help` });
    if (!row.editable) input.readOnly = true;
    if (row.kind === "slide") input.placeholder = "Untitled slide";
    const item = el(doc, "li", { class: "outline-row", "data-key": row.key, "data-kind": row.kind, "data-level": row.level });
    item.style.setProperty("--level", String(row.level));
    if (row.kind === "slide") item.append(el(doc, "span", { class: "outline-number", "aria-hidden": "true", text: String(row.slideIndex + 1) }));
    else item.append(el(doc, "span", { class: "outline-bullet", "aria-hidden": "true", text: row.kind === "item" ? "•" : "" }));
    item.append(input);
    if (row.kind === "slide" && row.hidden) item.append(el(doc, "span", { class: "slide-badge", text: "Hidden" }));
    input.addEventListener("focus", () => { activeKey = row.key; options.onSelectSlide?.(rowByKey(row.key)?.slideIndex ?? row.slideIndex); updateTools(); });
    input.addEventListener("change", () => commit(row.key, input));
    input.addEventListener("keydown", (event) => keydown(event, row.key, input));
    return item;
  }

  function render() {
    const snapshot = editor.snapshot();
    const firstDraw = !lastSnapshot;
    if (snapshot === lastSnapshot && !pendingFocus) return;
    lastSnapshot = snapshot;
    const presentation = editor.presentation;
    rows = readOutline(presentation).rows;
    const sections = hasSections(presentation);
    const entries = [];
    let lastSection;
    for (const row of rows) {
      if (sections && row.kind === "slide" && (row.section !== lastSection || entries.every((entry) => entry.kind !== "section"))) {
        entries.push({ kind: "section", key: `section:${row.slideIndex}`, text: row.section ?? "No section" });
        lastSection = row.section;
      }
      entries.push(row);
    }
    const nextKeys = entries.map((entry) => entry.key);
    const joined = nextKeys.join("|");
    const hadFocus = list.contains(doc.activeElement);
    if (joined === renderedKeys && !firstDraw) {
      // Same structure: update values in place so a click on another row is never lost to a rebuild.
      for (const row of rows) {
        const input = inputFor(row.key);
        if (!input) continue;
        const text = row.kind === "other" ? row.label : row.text;
        if (input.value !== text && doc.activeElement !== input) input.value = text;
        input.setAttribute("aria-label", label(row));
        input.readOnly = !row.editable;
      }
      for (const entry of entries) if (entry.kind === "section") list.querySelector(`[data-key="${CSS.escape(entry.key)}"] .outline-section-name`).textContent = entry.text;
      for (const row of rows) if (row.kind === "slide") {
        const item = list.querySelector(`[data-key="${CSS.escape(row.key)}"]`);
        item.querySelector(".slide-badge")?.remove();
        if (row.hidden) item.append(el(doc, "span", { class: "slide-badge", text: "Hidden" }));
      }
    } else {
      renderedKeys = joined;
      keys = nextKeys;
      list.replaceChildren(...entries.map((entry) => {
        if (entry.kind === "section") return el(doc, "li", { class: "outline-section", "data-key": entry.key }, el(doc, "span", { class: "outline-section-name", text: entry.text }));
        return build(entry);
      }));
    }
    const target = pendingFocus ?? (hadFocus ? activeKey : undefined);
    pendingFocus = undefined;
    if (target) {
      const input = inputFor(target);
      if (input && doc.activeElement !== input) input.focus();
    }
    updateTools();
  }

  function activeRow() { return activeKey ? rowByKey(activeKey) : undefined; }
  function updateTools() {
    const row = activeRow();
    const presentation = editor.presentation;
    const can = { promote: false, demote: false, up: false, down: false, add: Boolean(row) };
    if (row) {
      try {
        if (row.kind === "item") {
          can.demote = prepareShiftOutlineItem(presentation, row, 1).changed;
          can.promote = row.level > 1 ? prepareShiftOutlineItem(presentation, row, -1).changed : row.editable;
          can.up = prepareMoveOutlineItem(presentation, row, -1).changed;
          can.down = prepareMoveOutlineItem(presentation, row, 1).changed;
        } else if (row.kind === "slide") {
          can.up = row.slideIndex > 0;
          can.down = row.slideIndex < presentation.slides.length - 1;
          can.demote = row.slideIndex > 0;
        }
      } catch { /* a row that vanished mid-edit leaves the tools off */ }
    }
    for (const [name, button] of Object.entries(tools)) button.disabled = !can[name];
  }

  function commit(key, input) {
    const row = rowByKey(key);
    if (!row?.editable) return false;
    if (input.value === row.text) return false;
    try {
      const prepared = prepareSetOutlineText(editor.presentation, row, input.value);
      if (!prepared.changed) return false;
      applyOutlineChange(editor, prepared);
      render();
      return true;
    } catch (error) {
      input.value = row.text;
      report(error);
      return false;
    }
  }

  function apply(prepare, message) {
    try {
      const prepared = prepare();
      if (!prepared.changed) { announce(prepared.reason ?? "Nothing to change"); return false; }
      pendingFocus = prepared.focus ?? activeKey;
      applyOutlineChange(editor, prepared);
      lastSnapshot = undefined;
      render();
      announce(typeof message === "function" ? message(prepared) : message);
      return true;
    } catch (error) {
      pendingFocus = undefined;
      report(error);
      return false;
    }
  }

  // Commit what is typed in the row before an action reads it, so the typed text and the structure change are two honest steps.
  function settle(input, key) { if (input) commit(key, input); return rowByKey(key); }

  function perform(action, input) {
    const key = activeKey;
    const row = settle(input ?? inputFor(key), key);
    if (!row) return;
    const presentation = editor.presentation;
    if (action === "add") {
      if (row.kind === "item") apply(() => prepareInsertOutlineItem(presentation, row), "Line added");
      else if (row.kind === "slide") apply(() => prepareAddOutlineBullet(presentation, row.slideIndex), "Bullet added under the slide title");
      else announce("Add a line from a title or a bullet");
    } else if (action === "demote") {
      if (row.kind === "item") apply(() => prepareShiftOutlineItem(presentation, row, 1), () => "Demoted");
      else if (row.kind === "slide") apply(() => prepareOutlineDemoteSlide(presentation, row.slideIndex), "Slide joined the slide before it as a bullet");
      else announce("Only titles and bullets change level");
    } else if (action === "promote") {
      if (row.kind === "item") {
        if (row.level > 1) apply(() => prepareShiftOutlineItem(presentation, row, -1), "Promoted");
        else apply(() => prepareOutlinePromote(presentation, row), (prepared) => `Promoted to slide ${prepared.newSlideIndex + 1}`);
      } else if (row.kind === "slide") announce("Slide titles are already the top level");
      else announce("Only titles and bullets change level");
    } else if (action === "up" || action === "down") {
      const delta = action === "up" ? -1 : 1;
      if (row.kind === "item") apply(() => prepareMoveOutlineItem(presentation, row, delta), `Moved ${action}`);
      else if (row.kind === "slide") apply(() => prepareMoveOutlineSlide(presentation, row.slideIndex, delta), (prepared) => `Slide moved to position ${prepared.selection[0] + 1} of ${presentation.slides.length}`);
      else announce("Move bullets or slides");
    }
  }

  function keydown(event, key, input) {
    const row = rowByKey(key);
    if (!row) return;
    const index = keys.indexOf(key);
    const focusAt = (position) => {
      for (let at = position; at >= 0 && at < keys.length; at += position > index ? 1 : -1) {
        const target = list.querySelector(`[data-key="${CSS.escape(keys[at])}"] .outline-input`);
        if (target) { target.focus(); return; }
      }
    };
    if (event.altKey && event.shiftKey && (event.key === "ArrowRight" || event.key === "ArrowLeft")) { event.preventDefault(); perform(event.key === "ArrowRight" ? "demote" : "promote", input); return; }
    if (event.altKey && !event.shiftKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) { event.preventDefault(); perform(event.key === "ArrowUp" ? "up" : "down", input); return; }
    if (event.key === "ArrowDown" && !event.altKey && !event.ctrlKey && !event.metaKey) { event.preventDefault(); focusAt(index + 1); return; }
    if (event.key === "ArrowUp" && !event.altKey && !event.ctrlKey && !event.metaKey) { event.preventDefault(); focusAt(index - 1); return; }
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      const settled = settle(input, key);
      if (!settled) return;
      const presentation = editor.presentation;
      if (settled.kind === "item") apply(() => prepareInsertOutlineItem(presentation, settled), "Line added");
      else if (settled.kind === "slide") apply(() => prepareInsertOutlineSlide(presentation, settled.slideIndex), (prepared) => `Slide ${prepared.index + 1} added`);
      else focusAt(index + 1);
      return;
    }
    if (event.key === "Backspace" && input.value === "" && input.selectionStart === 0 && !input.readOnly) {
      if (row.kind === "item") { event.preventDefault(); apply(() => prepareRemoveOutlineItem(editor.presentation, row), "Line removed"); }
      else if (row.kind === "slide" && !rows.some((other) => other.slideIndex === row.slideIndex && other.kind !== "slide")) {
        event.preventDefault();
        apply(() => {
          const prepared = prepareRemoveSlides(editor.presentation, [row.slideIndex]);
          return { ...prepared, focus: `slide:slides.${Math.max(0, row.slideIndex - 1)}` };
        }, `Slide ${row.slideIndex + 1} removed`);
      }
    }
  }

  render();
  return {
    render,
    /** Focus the title row of a slide. */
    focusSlide(slideIndex) {
      pendingFocus = `slide:slides.${slideIndex}`;
      render();
    },
    destroy() {
      container.replaceChildren();
      container.classList.remove("opf-outline");
    },
  };
}
