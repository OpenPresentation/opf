// CE-18, the studio kit: the inspector frame. Sections are registered with `when(ctx)` and `render(body, ctx)`; every section whose `when`
// holds for the current selection is drawn, in order. While the person types in a field of the panel, a change only refreshes the findings
// under the fields (`update`), so the field keeps its focus and caret; any other change redraws the panel and puts focus back on the same
// field. `createFields` builds the labeled fields, with core's findings shown under each. Plain DOM, styled by class prefix.
import { nextId } from "./dom.js";

/**
 * The frame over `body`. Options: `sections` (`{ id, when(ctx), render(body, ctx) }`, in order), `context()` (the ctx of a redraw),
 * `before(ctx)` and `after(ctx)` (around the sections: a title, findings that fit no field). Returns `{ render, update, edit, check, editing,
 * sections }`: `edit(callback)` runs an edit from a typed field, `check(fn)` adds a findings check that `update` runs.
 */
export function createInspectorFrame(body, { sections = [], context = () => ({}), before, after } = {}) {
  const list = [...sections];
  let checks = [];
  let editing = false;
  const frame = {
    get editing() { return editing; },
    /** The sections drawn for `ctx`, in order. */
    sectionsFor: (ctx) => list.filter((section) => section.when ? section.when(ctx) === true : true),
    /** Add a section (before the one with id `before`, else at the end). Returns the function that removes it. */
    register(section, { before: id } = {}) {
      const at = id ? list.findIndex((entry) => entry.id === id) : -1;
      if (at >= 0) list.splice(at, 0, section); else list.push(section);
      return () => { const index = list.indexOf(section); if (index >= 0) list.splice(index, 1); };
    },
    render() {
      const doc = body.ownerDocument;
      const active = doc.activeElement;
      const focusKey = body.contains(active) ? active.dataset?.field : undefined;
      checks = [];
      body.replaceChildren();
      const ctx = context();
      before?.(ctx);
      for (const section of frame.sectionsFor(ctx)) section.render(body, ctx);
      after?.(ctx);
      frame.update();
      if (focusKey) body.querySelector(`[data-field="${focusKey}"]`)?.focus({ preventScroll: true });
    },
    update() { for (const check of checks) check(); },
    check(fn) { checks.push(fn); },
    edit(callback) { editing = true; try { callback(); } finally { editing = false; } },
  };
  return frame;
}

/**
 * Field builders bound to a frame. Options: `idPrefix` (field ids), `issues(path, field)` (the findings of one field, `{ message }`),
 * `readOnly()`. Each builder returns an element; `field` wraps a control with its label, help and the live findings line.
 */
export function createFields(dom, frame, { idPrefix = nextId(`${dom.prefix}-fields`), issues = () => [], readOnly = () => false } = {}) {
  const { el } = dom;
  const p = dom.prefix;
  /** A labeled field. `path`/`field` tie it to the findings: they show under the field and mark it invalid. */
  function field(label, control, { help, path, field: key, labelFor, group, target } = {}) {
    const wrap = el("div", `${p}-field`, { "data-field-name": key ?? "" });
    const fieldId = `${idPrefix}-${nextId("f")}`;
    const focusTarget = target ?? control;
    if (group) {
      const caption = el("span", `${p}-label-text`, { id: `${fieldId}-label`, text: label });
      control.setAttribute("aria-labelledby", `${fieldId}-label`);
      if (!control.getAttribute("role")) control.setAttribute("role", "group");
      wrap.append(caption);
    } else {
      if (!labelFor && !control.id) control.id = fieldId;
      wrap.append(el("label", `${p}-label-text`, { for: labelFor ?? control.id, text: label }));
    }
    wrap.append(control);
    if (help) { const note = el("p", `${p}-help`, { id: `${fieldId}-help`, text: help }); wrap.append(note); if (!group) focusTarget.setAttribute("aria-describedby", note.id); }
    const error = el("p", `${p}-field-error`, { id: `${fieldId}-error`, role: "status", "aria-live": "polite" });
    error.hidden = true;
    wrap.append(error);
    if (path && key) {
      frame.check(() => {
        const found = issues(path, key);
        error.hidden = !found.length;
        error.replaceChildren();
        if (found.length) error.append(dom.icon("CircleX", 14), el("span", "", { text: found.map((issue) => issue.message).join(" ") }));
        wrap.dataset.invalid = String(Boolean(found.length));
        if (!group) { if (found.length) { focusTarget.setAttribute("aria-invalid", "true"); focusTarget.setAttribute("aria-errormessage", error.id); } else { focusTarget.removeAttribute("aria-invalid"); focusTarget.removeAttribute("aria-errormessage"); } }
      });
    }
    return Object.assign(wrap, { error });
  }
  /** A text field (or a textarea, `multiline`); `onInput(value)` runs as a typed edit. */
  function textInput(value, { onInput, name, pattern, placeholder, multiline } = {}) {
    const input = el(multiline ? "textarea" : "input", `${p}-input`, { type: multiline ? undefined : "text", "data-field": name, pattern, placeholder, spellcheck: "false", autocomplete: "off", rows: multiline ? 2 : undefined });
    input.value = value ?? "";
    input.addEventListener("input", () => frame.edit(() => onInput(input.value)));
    return input;
  }
  /** A select of `[value, label]` entries. */
  function select(entries, current, { onChange, name }) {
    const input = el("select", `${p}-select`, { "data-field": name });
    for (const [value, label] of entries) { const option = el("option", "", { value, text: label }); input.append(option); }
    input.value = current;
    input.addEventListener("change", () => onChange(input.value));
    return input;
  }
  /** A segmented control of `[value, text, iconName]` entries (toggle buttons, one pressed). */
  function segmented(entries, current, { onPick, label, name }) {
    const wrap = el("div", `${p}-segmented`, { role: "group", "aria-label": label });
    for (const [value, text, iconName] of entries) {
      const button = dom.button(`${p}-segment`, { text, iconName, size: 14, pressed: value === current, attributes: { "data-field": `${name}-${value}`, "data-value": value } });
      button.addEventListener("click", () => { if (value !== current) onPick(value); });
      wrap.append(button);
    }
    return wrap;
  }
  /** An action button, disabled when `disabled` or read only. */
  const actionButton = (text, iconName, run, { label, disabled, shortcut } = {}) => {
    const button = dom.button(`${p}-action`, { text, iconName, size: 14, attributes: { "aria-label": label, "aria-keyshortcuts": shortcut } });
    button.disabled = Boolean(disabled) || readOnly();
    button.addEventListener("click", () => run());
    return button;
  };
  /** A section of the panel, with an optional title. */
  const section = (label) => { const node = el("div", `${p}-section`); if (label) node.append(el("h3", `${p}-section-title`, { text: label })); return node; };
  return { field, textInput, select, segmented, actionButton, section };
}
