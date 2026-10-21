// The inspector of the layout editor (RR-99): the properties of the selection, as form fields. With nothing selected it edits the layout
// (id, name, summary, direction, default anchor, overflow region, design hints); a split has a direction, size and anchor; a region has
// its name, size, accepted kinds, role, flow, max, anchor, bleed, list columns and empty rule. Every field is a command on the shared
// model, so it is validated by core and undoable like a drag on the canvas.
import { createLayoutModel } from "./layout-model.js";
import { LAYOUT_ANCHORS, LAYOUT_REGION_FLOWS, LAYOUT_REGION_KINDS, LAYOUT_REGION_ROLES } from "./layout-templates.js";
import { effectiveSize, inheritedAnchor, isHeading, isSplit, listAt, parseSize } from "./layout-tree.js";
import { KIND_ICONS, createDom, handleGlobalShortcut, nextId } from "./layout-editor-ui.js";

const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const SIZE_ERROR = "A size is a number above 0 and up to 100, or auto.";

/**
 * Mount the inspector in `container`. Options: `model` (shared state; one is created from the other options when omitted), `label`.
 * Returns `{ element, model, refresh, focus, destroy }`.
 */
export function createLayoutInspector(container, options = {}) {
  if (!container?.ownerDocument) throw new TypeError("A DOM container is required.");
  const doc = container.ownerDocument;
  const dom = createDom(doc);
  const { el } = dom;
  const ownModel = !options.model;
  const model = options.model ?? createLayoutModel(options);
  const id = nextId("opf-lx-inspector");

  const root = el("section", "opf-lx-inspector opf-ui", { "aria-labelledby": `${id}-title`, "data-density": model.density });
  const head = el("div", "opf-lx-panel-head");
  const title = el("h2", "opf-lx-panel-title", { id: `${id}-title` });
  head.append(dom.icon("Pencil", 14), title);
  const body = el("div", "opf-lx-inspector-body");
  root.append(head, body);
  container.append(root);

  let editing = false;
  let checks = [];
  /** Text and number fields keep their focus and caret while the person types, so an edit from one does not redraw the panel; the other controls do. */
  const edit = (callback) => { editing = true; try { callback(); } finally { editing = false; } };

  // --- field builders --------------------------------------------------------------------------------------------------------------
  /** A labeled field. `path`/`field` tie it to core's findings: they show under the field and mark it invalid. */
  function field(label, control, { help, path, field: key, labelFor, group, target } = {}) {
    const wrap = el("div", "opf-lx-field", { "data-field-name": key ?? "" });
    const fieldId = `${id}-${nextId("f")}`;
    const focusTarget = target ?? control;
    if (group) {
      const caption = el("span", "opf-lx-label-text", { id: `${fieldId}-label`, text: label });
      control.setAttribute("aria-labelledby", `${fieldId}-label`);
      if (!control.getAttribute("role")) control.setAttribute("role", "group");
      wrap.append(caption);
    } else {
      if (!labelFor && !control.id) control.id = fieldId;
      wrap.append(el("label", "opf-lx-label-text", { for: labelFor ?? control.id, text: label }));
    }
    wrap.append(control);
    if (help) { const note = el("p", "opf-lx-help", { id: `${fieldId}-help`, text: help }); wrap.append(note); if (!group) focusTarget.setAttribute("aria-describedby", note.id); }
    const error = el("p", "opf-lx-field-error", { id: `${fieldId}-error`, role: "status", "aria-live": "polite" });
    error.hidden = true;
    wrap.append(error);
    if (path && key) {
      checks.push(() => {
        const issues = model.findingsFor(path, key);
        error.hidden = !issues.length;
        error.replaceChildren();
        if (issues.length) error.append(dom.icon("CircleX", 14), el("span", "", { text: issues.map((issue) => issue.message).join(" ") }));
        wrap.dataset.invalid = String(Boolean(issues.length));
        if (!group) { if (issues.length) { focusTarget.setAttribute("aria-invalid", "true"); focusTarget.setAttribute("aria-errormessage", error.id); } else { focusTarget.removeAttribute("aria-invalid"); focusTarget.removeAttribute("aria-errormessage"); } }
      });
    }
    return Object.assign(wrap, { error });
  }
  function textInput(value, { onInput, name, pattern, placeholder, multiline } = {}) {
    const input = el(multiline ? "textarea" : "input", "opf-lx-input", { type: multiline ? undefined : "text", "data-field": name, pattern, placeholder, spellcheck: "false", autocomplete: "off", rows: multiline ? 2 : undefined });
    input.value = value ?? "";
    input.addEventListener("input", () => edit(() => onInput(input.value)));
    return input;
  }
  function select(entries, current, { onChange, name }) {
    const input = el("select", "opf-lx-select", { "data-field": name });
    for (const [value, label] of entries) { const option = el("option", "", { value, text: label }); input.append(option); }
    input.value = current;
    input.addEventListener("change", () => onChange(input.value));
    return input;
  }
  function segmented(entries, current, { onPick, label, name }) {
    const wrap = el("div", "opf-lx-segmented", { role: "group", "aria-label": label });
    for (const [value, text, iconName] of entries) {
      const button = dom.button("opf-lx-segment", { text, iconName, size: 14, pressed: value === current, attributes: { "data-field": `${name}-${value}`, "data-value": value } });
      button.addEventListener("click", () => { if (value !== current) onPick(value); });
      wrap.append(button);
    }
    return wrap;
  }
  const actionButton = (text, iconName, run, { label, disabled, shortcut } = {}) => {
    const button = dom.button("opf-lx-action", { text, iconName, size: 14, attributes: { "aria-label": label, "aria-keyshortcuts": shortcut } });
    button.disabled = Boolean(disabled) || model.readOnly;
    button.addEventListener("click", () => run());
    return button;
  };
  const section = (label) => { const node = el("div", "opf-lx-section"); if (label) node.append(el("h3", "opf-lx-section-title", { text: label })); return node; };

  // --- the size field: a number, and Auto where the parent is a column -----------------------------------------------------------------
  function sizeField(path, entry) {
    const direction = model.parentDirection(path);
    const list = listAt(model.record, path.slice(0, -1)) ?? [];
    const current = effectiveSize(entry, direction);
    const auto = entry.size === "auto" || (entry.size === undefined && current === "auto");
    const input = el("input", "opf-lx-input opf-lx-size-input", { type: "number", min: "0.01", max: "100", step: "0.5", "data-field": "size", inputmode: "decimal", id: nextId(`${id}-size`) });
    input.value = auto ? "" : String(current);
    input.disabled = auto || model.readOnly;
    input.placeholder = auto ? "auto" : "1";
    const wrap = el("div", "opf-lx-size-row");
    wrap.append(input);
    let toggle = null;
    // Auto is the height the content needs, so it is offered only where a column stacks its children (in a row an existing auto can only be cleared).
    if (direction === "column" || entry.size === "auto") {
      toggle = dom.button("opf-lx-segment opf-lx-auto", { text: "Auto", pressed: auto, attributes: { "data-field": "size-auto" } });
      toggle.addEventListener("click", () => model.setProperty(path, "size", auto ? 1 : "auto", { coalesce: null }));
      wrap.append(toggle);
    }
    const note = (() => {
      if (auto) return "The height the content needs, at most half the slide.";
      const total = list.reduce((sum, item) => { const size = effectiveSize(item, direction); return sum + (typeof size === "number" ? size : 0); }, 0);
      return total > 0 && typeof current === "number" ? `${Math.round(current / total * 100)}% of the ${direction === "row" ? "width" : "height"} shared with its siblings.` : "";
    })();
    const error = el("p", "opf-lx-field-error opf-lx-size-error", { role: "status" });
    error.hidden = true;
    input.addEventListener("input", () => {
      const text = input.value.trim();
      if (text === "") { error.hidden = true; edit(() => model.setProperty(path, "size", undefined)); return; }
      if (parseSize(text) === undefined) { error.hidden = false; error.replaceChildren(dom.icon("CircleX", 14), el("span", "", { text: SIZE_ERROR })); input.setAttribute("aria-invalid", "true"); return; }
      error.hidden = true;
      input.removeAttribute("aria-invalid");
      edit(() => model.setProperty(path, "size", Number(text)));
    });
    // On leaving the field it shows the size the layout really has (an empty or rejected entry is the default again).
    input.addEventListener("change", () => {
      const now = model.nodeAt(path);
      const size = now ? effectiveSize(now, direction) : current;
      if (typeof size === "number") input.value = String(size);
      error.hidden = true;
      input.removeAttribute("aria-invalid");
    });
    const holder = field("Size", wrap, { help: note, path, field: "size", labelFor: input.id, target: input });
    holder.append(error);
    return holder;
  }

  function anchorField(path, inherited, current, onChange) {
    const names = { top: "Top", middle: "Middle", bottom: "Bottom" };
    const shown = inherited ? `Inherited · ${names[inherited.value ?? "top"].toLowerCase()}${inherited.from === "default" ? " (default)" : inherited.from === "split" ? " (from the split)" : " (from the layout)"}` : "None · top";
    const input = select([["", shown], ...LAYOUT_ANCHORS.map((value) => [value, names[value]])], current ?? "", { onChange: (value) => onChange(value || undefined), name: "anchor" });
    const wrap = field("Anchor", input, { help: current === undefined ? (inherited ? "Not set here, so this follows the nearest split or the layout." : "Regions without their own anchor sit at the top.") : "Set here. Choose the first option to inherit again.", path, field: "anchor", labelFor: undefined });
    wrap.dataset.inherited = String(current === undefined);
    return wrap;
  }

  // --- the three views ---------------------------------------------------------------------------------------------------------------
  function layoutView() {
    const record = model.record;
    title.textContent = "Layout";
    const props = section();
    props.append(
      field("Id", textInput(record.id, { name: "id", placeholder: "my-layout", pattern: "[a-z][a-z0-9-]*", onInput: (value) => model.setLayoutProperty("id", value) }), { path: [], field: "id", help: "Lowercase letters, digits and hyphens. Slides use this id." }),
      field("Name", textInput(record.name, { name: "name", placeholder: "My layout", onInput: (value) => model.setLayoutProperty("name", value) }), { path: [], field: "name" }),
      field("Summary", textInput(record.summary, { name: "summary", multiline: true, placeholder: "When to use this layout", onInput: (value) => model.setLayoutProperty("summary", value) }), { path: [], field: "summary" }),
      field("Direction", segmented([["row", "Row", "Columns2"], ["column", "Column", "Rows2"]], record.direction === "row" ? "row" : "column", { label: "Direction", name: "direction", onPick: (value) => model.setLayoutProperty("direction", value) }), { group: true, path: [], field: "direction", help: "Row places the regions side by side; column stacks them." }),
      anchorField([], null, record.anchor, (value) => model.setLayoutProperty("anchor", value)),
    );
    const bodyNames = model.record.regions ? flatBody(record) : [];
    props.append(field("Overflow region", select([["", "Default · the first primary region"], ...bodyNames.map((name) => [name, name])], record.overflowRegion ?? "", { name: "overflowRegion", onChange: (value) => model.setLayoutProperty("overflowRegion", value || undefined) }), { path: [], field: "overflowRegion", help: "Where content that no region accepts goes." }));
    body.append(props);
    const hints = record.design && typeof record.design === "object" ? Object.entries(record.design) : [];
    if (hints.length) {
      const block = section("Design hints");
      const dl = el("dl", "opf-lx-hints");
      for (const [key, value] of hints) {
        const row = el("div", "opf-lx-hint-row");
        const remove = dom.button("opf-lx-hint-remove", { label: `Remove the ${key} design hint`, iconName: "X", size: 14 });
        remove.disabled = model.readOnly;
        remove.addEventListener("click", () => model.removeDesignHint(key));
        row.append(el("dt", "opf-lx-hint-key", { text: key }), el("dd", "opf-lx-hint-value", { text: typeof value === "string" ? value : JSON.stringify(value) }), remove);
        dl.append(row);
      }
      block.append(dl);
      body.append(block);
    }
  }
  const flatBody = (record) => {
    const out = [];
    const walk = (list) => { for (const entry of Array.isArray(list) ? list : []) { if (isSplit(entry)) walk(entry.regions); else if (entry && !isHeading(entry)) out.push(entry.name); } };
    walk(record.regions);
    return out;
  };

  function actions(paths, { split, heading }) {
    const block = section("Actions");
    const group = el("div", "opf-lx-actions", { role: "group", "aria-label": "Actions" });
    const one = paths.length === 1 ? paths[0] : null;
    if (one && !split) {
      group.append(
        actionButton("Split into row", "Columns2", () => model.splitRegion(one, "row"), { label: "Split into a row" }),
        actionButton("Split into column", "Rows2", () => model.splitRegion(one, "column"), { label: "Split into a column" }),
      );
    }
    group.append(
      actionButton("Wrap in row", "Columns2", () => model.wrap(paths, "row")),
      actionButton("Wrap in column", "Rows2", () => model.wrap(paths, "column")),
    );
    if (split) group.append(actionButton("Unwrap", "Unfold", () => model.unwrap(one)), actionButton("Insert region", "Plus", () => model.insertRegion(one, (model.nodeAt(one).regions ?? []).length), { label: "Insert a region in this split" }));
    if (!heading) group.append(actionButton("Duplicate", "Copy", () => model.duplicate(paths), { shortcut: "Control+D Meta+D" }));
    if (one) group.append(
      actionButton("Earlier", undefined, () => model.reorder(one, -1), { label: "Move earlier", shortcut: "[" }),
      actionButton("Later", undefined, () => model.reorder(one, 1), { label: "Move later", shortcut: "]" }),
    );
    group.append(actionButton("Delete", "Trash2", () => model.remove(paths), { label: heading ? `Remove the ${model.nodeAt(one)?.name} region` : "Delete", shortcut: "Delete" }));
    block.append(group);
    return block;
  }

  function splitView(path, entry) {
    title.textContent = "Split";
    const props = section();
    props.append(
      field("Direction", segmented([["row", "Row", "Columns2"], ["column", "Column", "Rows2"]], entry.direction === "row" ? "row" : "column", { label: "Direction", name: "direction", onPick: (value) => model.setProperty(path, "direction", value, { coalesce: null }) }), { group: true, path, field: "direction", help: "How the regions inside this split are placed." }),
      sizeField(path, entry),
      anchorField(path, inheritedAnchor(model.record, path), entry.anchor, (value) => model.setProperty(path, "anchor", value, { coalesce: null })),
    );
    const note = el("p", "opf-lx-help", { text: `${(entry.regions ?? []).length} ${(entry.regions ?? []).length === 1 ? "entry" : "entries"} inside. Regions under this split inherit its anchor.` });
    body.append(props, note, actions([path], { split: true }));
  }

  function headingView(path, entry) {
    title.textContent = `${cap(entry.name)} region`;
    const props = section();
    props.append(
      field("Name", Object.assign(textInput(entry.name, { name: "name", onInput: () => {} }), { readOnly: true }), { path, field: "name", help: entry.name === "title" ? "Holds the slide's title. Without a title region the engine adds one on top." : "Holds the slide's subtitle. A subtitle needs a title." }),
      sizeField(path, entry),
    );
    body.append(props, el("p", "opf-lx-help", { text: "A heading region takes only a size." }), actions([path], { heading: true }));
  }

  function regionView(path, entry) {
    title.textContent = "Region";
    const props = section();
    const inherited = inheritedAnchor(model.record, path);
    const set = (key, value, opts) => model.setProperty(path, key, value, opts);
    props.append(
      field("Name", textInput(entry.name, { name: "name", pattern: "[a-z][a-z0-9-]*", onInput: (value) => set("name", value) }), { path, field: "name", help: "Lowercase letters, digits and hyphens, unique in the layout." }),
      sizeField(path, entry),
    );
    // Accepted kinds: none selected means every kind.
    const chips = el("div", "opf-lx-chips", { role: "group" });
    const accepted = new Set(entry.accepts ?? []);
    for (const kind of LAYOUT_REGION_KINDS) {
      const chip = dom.button("opf-lx-chip", { text: kind, iconName: KIND_ICONS[kind], size: 14, pressed: accepted.has(kind), attributes: { "data-kind": kind, "data-field": `accepts-${kind}` } });
      chip.disabled = model.readOnly;
      chip.addEventListener("click", () => {
        const next = new Set(accepted);
        if (next.has(kind)) next.delete(kind); else next.add(kind);
        set("accepts", [...next], { coalesce: null });
      });
      chips.append(chip);
    }
    props.append(field("Accepts", chips, { group: true, path, field: "accepts", help: accepted.size ? `${accepted.size} of ${LAYOUT_REGION_KINDS.length} kinds. Deselect them all to accept every kind.` : "Every kind. Choose kinds to limit this region." }));
    const defaults = { role: "primary", flow: "auto", empty: "collapse" };
    const withDefault = (key, values) => [["", `Default · ${defaults[key]}`], ...values.map((value) => [value, cap(value)])];
    props.append(
      field("Role", select(withDefault("role", LAYOUT_REGION_ROLES), entry.role ?? "", { name: "role", onChange: (value) => set("role", value || undefined, { coalesce: null }) }), { path, field: "role", help: "Which content this region wants first." }),
      field("Flow", select(withDefault("flow", LAYOUT_REGION_FLOWS), entry.flow ?? "", { name: "flow", onChange: (value) => set("flow", value || undefined, { coalesce: null }) }), { path, field: "flow", help: "How several blocks share the region." }),
    );
    const max = el("input", "opf-lx-input", { type: "number", min: "1", max: "12", step: "1", "data-field": "max", placeholder: "Default" });
    max.value = entry.max === undefined ? "" : String(entry.max);
    max.addEventListener("input", () => edit(() => set("max", max.value === "" ? undefined : Number(max.value))));
    props.append(field("Max blocks", max, { path, field: "max", help: "A whole number from 1 to 12. Default: 1 for flow none, else 6." }));
    props.append(anchorField(path, inherited, entry.anchor, (value) => set("anchor", value, { coalesce: null })));
    const bleed = el("input", "opf-lx-check", { type: "checkbox", "data-field": "bleed" });
    bleed.checked = entry.bleed === true;
    bleed.addEventListener("change", () => set("bleed", bleed.checked || undefined, { coalesce: null }));
    const bleedField = field("Bleed to the slide edge", bleed, { path, field: "bleed", help: "Outer edges on the content box reach the slide edge." });
    bleedField.classList.add("opf-lx-field-check");
    props.append(
      bleedField,
      field("List columns", select([["", "Default · 1"], ["auto", "Automatic"], ["1", "1"]], entry.listColumns === undefined ? "" : String(entry.listColumns), { name: "listColumns", onChange: (value) => set("listColumns", value === "" ? undefined : value === "auto" ? "auto" : 1, { coalesce: null }) }), { path, field: "listColumns", help: "Automatic lets a long list flow into columns." }),
      field("When empty", select(withDefault("empty", ["collapse", "keep"]), entry.empty ?? "", { name: "empty", onChange: (value) => set("empty", value || undefined, { coalesce: null }) }), { path, field: "empty", help: "Collapse gives the space to a neighbor; keep leaves it." }),
    );
    body.append(props, actions([path], {}));
  }

  function multiView(paths) {
    title.textContent = `${paths.length} selected`;
    body.append(el("p", "opf-lx-help", { text: `${paths.length} siblings are selected. Wrap them in a row or column, duplicate them or delete them.` }), actions(paths, {}));
  }

  function render() {
    const active = doc.activeElement;
    const focusKey = body.contains(active) ? active.dataset?.field : undefined;
    checks = [];
    body.replaceChildren();
    const paths = model.selection;
    if (!paths.length) layoutView();
    else if (paths.length > 1) multiView(paths);
    else {
      const entry = model.nodeAt(paths[0]);
      if (!entry) layoutView();
      else if (isSplit(entry)) splitView(paths[0], entry);
      else if (isHeading(entry)) headingView(paths[0], entry);
      else regionView(paths[0], entry);
    }
    // Findings that point at the node but at no field shown here.
    const shown = new Set([...body.querySelectorAll("[data-field-name]")].map((node) => node.dataset.fieldName));
    const loose = model.findingsFor(paths.length === 1 ? paths[0] : []).filter((finding) => !finding.field || !shown.has(finding.field));
    if (loose.length && paths.length <= 1) {
      const list = el("ul", "opf-lx-loose", { "aria-label": "Other findings" });
      for (const finding of loose) { const item = el("li", "opf-lx-field-error"); item.append(dom.icon("CircleX", 14), el("span", "", { text: finding.message })); list.append(item); }
      body.append(list);
    }
    root.dataset.density = model.density;
    update();
    if (focusKey) body.querySelector(`[data-field="${focusKey}"]`)?.focus({ preventScroll: true });
  }
  function update() { for (const check of checks) check(); }

  root.addEventListener("keydown", (event) => { handleGlobalShortcut(event, model); });
  const unsubscribe = model.subscribe((event) => {
    if (event.type === "notice" || event.type === "tool" || event.type === "rename") return;
    if (event.type === "view") { root.dataset.density = model.density; render(); return; }
    if (editing) { update(); return; }
    render();
  });
  render();

  return {
    element: root,
    model,
    refresh: render,
    focus() { (body.querySelector("input, select, textarea, button") ?? root).focus?.(); },
    destroy() { unsubscribe(); root.remove(); if (ownModel) model.destroy(); },
  };
}
