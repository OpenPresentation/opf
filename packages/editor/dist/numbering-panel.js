// List numbering panel (RR-33): the DOM control over the numbering model. It numbers a list (or turns numbering off), picks
// the style, start and suffix, optionally per list level, shows the markers the list will draw, and restarts the count at
// the selected entry. The panel owns no document state: every change is one validated, undoable edit through the session, and
// the panel redraws from the document. Importing this module does not need a DOM; mounting does.
import {
  MAX_NUMBERING_LEVELS,
  MAX_NUMBERING_START,
  NUMBERING_STYLE_OPTIONS,
  NUMBERING_SUFFIX_OPTIONS,
  findNumberableLists,
  numberingAvailable,
  numberingState,
  numberingValue,
  setEntryStart,
  setNumbering,
} from "./numbering.js";

let panelCounter = 0;

function h(doc, tag, attributes = {}, ...children) {
  const element = doc.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue;
    if (key === "class") element.className = value;
    else if (key === "text") element.textContent = value;
    else if (key.startsWith("on")) element.addEventListener(key.slice(2), value);
    else element.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children) if (child) element.append(child);
  return element;
}

/**
 * Mount the numbering control. Options: `editor` (a session), `getTarget()` (the path the host has selected: a list, an entry
 * or anything inside one), `getSlideIndex()` (the slide whose lists are offered when nothing in a list is selected) and
 * `onStatus(message, {error})`.
 */
export function createNumberingPanel(container, options) {
  if (!numberingAvailable()) throw new Error("The numbering control needs a core release that ships numbering.");
  const { editor, getTarget, getSlideIndex, onStatus } = options;
  const doc = container.ownerDocument;
  const id = `opf-numbering-${++panelCounter}`;
  let explicit;
  let destroyed = false;
  let drawn = "";

  const root = h(doc, "section", { class: "opf-numbering-panel", "data-opf-component": "numbering-panel", "aria-label": "List numbering" });
  const body = h(doc, "div", { class: "opf-numbering-body" });
  const live = h(doc, "p", { class: "opf-numbering-live", role: "status", "aria-live": "polite" });
  root.append(body, live);
  container.append(root);

  const say = (message, error = false) => {
    live.textContent = message;
    live.dataset.error = error ? "true" : "false";
    onStatus?.(message, { error });
  };

  const currentPath = () => {
    const slide = getSlideIndex?.() ?? 0;
    const lists = findNumberableLists(editor.document, slide);
    const wanted = explicit ?? getTarget?.();
    if (wanted && numberingState(editor.document, wanted)) return { path: wanted, lists };
    return { path: lists[0]?.path, lists };
  };

  const optionElements = (options, selected) => options.map((option) => h(doc, "option", { value: option.value, text: option.label, selected: option.value === selected }));

  function levelRow(index, level, { label, enabled }) {
    const prefix = `${id}-l${index}`;
    const style = h(doc, "select", { id: `${prefix}-style`, "data-field": "style", "data-level": index, disabled: !enabled }, ...optionElements(NUMBERING_STYLE_OPTIONS, level.style));
    const start = h(doc, "input", { id: `${prefix}-start`, type: "number", min: 1, max: MAX_NUMBERING_START, step: 1, value: level.start, "data-field": "start", "data-level": index, disabled: !enabled });
    const suffix = h(doc, "select", { id: `${prefix}-suffix`, "data-field": "suffix", "data-level": index, disabled: !enabled }, ...optionElements(NUMBERING_SUFFIX_OPTIONS, level.suffix));
    return h(doc, "div", { class: "opf-numbering-level", role: "group", "aria-label": label },
      h(doc, "span", { class: "opf-numbering-level-name", text: label }),
      h(doc, "label", { for: style.id, text: "Style" }), style,
      h(doc, "label", { for: start.id, text: "Start at" }), start,
      h(doc, "label", { for: suffix.id, text: "After the number" }), suffix);
  }

  function readLevels(state) {
    const rows = [...body.querySelectorAll(".opf-numbering-level")];
    return rows.map((row) => ({
      style: row.querySelector('[data-field="style"]').value,
      start: Number(row.querySelector('[data-field="start"]').value),
      suffix: row.querySelector('[data-field="suffix"]').value,
    })).slice(0, state.perLevel ? MAX_NUMBERING_LEVELS : 1);
  }

  function commit(path, value, message) {
    try {
      setNumbering(editor, path, value);
      say(message);
    } catch (error) {
      say(error?.issues?.[0]?.message ?? error?.message ?? String(error), true);
      draw(true);
    }
  }

  function draw(force = false) {
    if (destroyed) return;
    const { path, lists } = currentPath();
    const state = path ? numberingState(editor.document, path) : undefined;
    const signature = JSON.stringify([path, state, lists.map((entry) => [entry.path, entry.numbered])]);
    if (!force && signature === drawn) return;
    drawn = signature;
    body.replaceChildren();
    if (!state) {
      body.append(h(doc, "p", { class: "opf-numbering-empty", text: "This slide has no list. Add a list or a bullets block to number it." }));
      return;
    }
    const enabled = state.numbered;
    if (lists.length > 1) {
      const select = h(doc, "select", { id: `${id}-list`, "aria-label": "List" }, ...lists.map((entry) => h(doc, "option", { value: entry.path, text: `${entry.label} (${entry.count} ${entry.count === 1 ? "entry" : "entries"})`, selected: entry.path === state.path })));
      select.addEventListener("change", () => { explicit = select.value; draw(true); });
      body.append(h(doc, "div", { class: "opf-numbering-list" }, h(doc, "label", { for: select.id, text: "List" }), select));
    }
    const toggle = h(doc, "input", { id: `${id}-enabled`, type: "checkbox", checked: enabled });
    toggle.checked = enabled;
    toggle.addEventListener("change", () => {
      if (toggle.checked) commit(state.path, numberingValue(state.levels), "Numbered the list.");
      else commit(state.path, undefined, "Numbering turned off; the list shows bullets again.");
    });
    body.append(h(doc, "div", { class: "opf-numbering-toggle" }, toggle, h(doc, "label", { for: toggle.id, text: "Number this list" })));

    const levels = state.perLevel ? Array.from({ length: Math.min(MAX_NUMBERING_LEVELS, Math.max(state.depth, state.levels.length)) }, (_, index) => state.levels[Math.min(index, state.levels.length - 1)]) : [state.levels[0]];
    const rowsHost = h(doc, "div", { class: "opf-numbering-levels" });
    levels.forEach((level, index) => rowsHost.append(levelRow(index, level, { label: state.perLevel ? `Level ${index + 1}` : "Every level", enabled })));
    rowsHost.addEventListener("change", (event) => {
      if (!event.target.closest(".opf-numbering-level")) return;
      try {
        commit(state.path, numberingValue(readLevels(state)), "Updated the numbering.");
      } catch (error) {
        say(error?.message ?? String(error), true);
        draw(true);
      }
    });
    body.append(rowsHost);

    if (state.depth > 1 || state.perLevel) {
      const perLevel = h(doc, "input", { id: `${id}-per-level`, type: "checkbox", disabled: !enabled });
      perLevel.checked = state.perLevel;
      perLevel.addEventListener("change", () => {
        // Turning it on starts an outline (1. a. i.), because identical levels would be written as one entry again.
        const cycle = ["arabic", "alpha-lower", "roman-lower", "alpha-upper", "roman-upper"];
        const next = [{ ...state.levels[0] }];
        for (let index = 1; index < Math.min(MAX_NUMBERING_LEVELS, Math.max(2, state.depth)); index++) {
          const previous = next[index - 1].style;
          const style = cycle.slice((index - 1) % cycle.length).concat(cycle).find((candidate) => candidate !== previous);
          next.push({ ...state.levels[0], start: 1, style });
        }
        commit(state.path, perLevel.checked ? numberingValue(next) : numberingValue([state.levels[0]]), perLevel.checked ? "Numbering can now differ per level." : "Every level uses the first level's numbering.");
      });
      body.append(h(doc, "div", { class: "opf-numbering-toggle" }, perLevel, h(doc, "label", { for: perLevel.id, text: "Different numbering for each level" })));
    }

    if (enabled) {
      const shown = state.markers.slice(0, 8).map((marker) => marker.text).join("  ");
      body.append(h(doc, "p", { class: "opf-numbering-preview", "aria-label": "Markers", text: `${shown}${state.markers.length > 8 ? "  …" : ""}` }));
      if (state.markers.some((marker) => marker.adapted)) body.append(h(doc, "p", { class: "opf-numbering-note", text: "Roman numerals stop at 3999; larger numbers are drawn in arabic." }));
    }

    if (enabled && state.entry) {
      const start = h(doc, "input", { id: `${id}-entry-start`, type: "number", min: 1, max: MAX_NUMBERING_START, step: 1, value: state.entry.start ?? "", placeholder: state.entry.marker ?? "" });
      const apply = () => {
        const text = start.value.trim();
        try {
          setEntryStart(editor, `${state.path}.${state.entry.index}`, text === "" ? undefined : Number(text));
          say(text === "" ? "Removed the restart." : `Entry ${state.entry.index + 1} now starts at ${text}.`);
        } catch (error) {
          say(error?.issues?.[0]?.message ?? error?.message ?? String(error), true);
          draw(true);
        }
      };
      start.addEventListener("change", apply);
      body.append(h(doc, "div", { class: "opf-numbering-entry" },
        h(doc, "label", { for: start.id, text: `Entry ${state.entry.index + 1} starts at` }), start,
        h(doc, "span", { class: "opf-numbering-help", text: "Leave empty to continue the count. Later entries carry on from it." })));
    }
  }

  const unsubscribe = editor.subscribe(() => draw());
  draw(true);

  return {
    element: root,
    setTarget(path) {
      explicit = path;
      draw(true);
    },
    refresh() {
      draw(true);
    },
    destroy() {
      destroyed = true;
      unsubscribe();
      root.remove();
    },
  };
}
