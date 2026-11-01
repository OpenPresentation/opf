// CE-06: the default arrangement of the workspace (`layout: "full"`, `"canvas"`, `"embed"` or `"source"`): a bar, the source pane, the slide, the
// slide row, and a side panel for Review and Design. It only builds DOM and hands the elements to the workspace as named slots; a host that
// arranges the parts itself passes its own elements as `slots` and none of this runs. Styled by src/styles/workspace.css (tokens only).
// CE-28: the bar is a toolbar (src/toolbar.js): one slot per named item, in the order the preset or the `toolbar` option gives.

const make = (doc, tag, attributes = {}, ...children) => {
  const node = doc.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue;
    if (name === "text") node.textContent = value;
    else node.setAttribute(name, value === true ? "" : value);
  }
  node.append(...children);
  return node;
};

const VIEW_LABELS = { slide: "Slide", sorter: "Sorter", outline: "Outline", layouts: "Layouts" };
export const viewLabel = (view) => VIEW_LABELS[view] ?? view;

/** CE-28: the toolbar of each built layout. `"source"` has none (the pane has its own bar), nor has `slots`; the Studio builds its own topbar. */
export const TOOLBAR_PRESETS = Object.freeze({
  full: Object.freeze(["title", "history", "find", "views", "spacer", "actions", "design", "review", "autosave", "export", "present", "help", "expand", "more"]),
  canvas: Object.freeze(["title", "history", "spacer", "actions", "expand", "more"]),
  embed: Object.freeze(["title", "history", "counter", "spacer", "actions", "design", "expand", "present", "more"]),
  // CE-28 wave 2: a deck to look at, read-only.
  viewer: Object.freeze(["title", "counter", "spacer", "actions", "present", "expand", "more"]),
  source: Object.freeze([]),
  slots: Object.freeze([]),
});

/** The text of the shell's own controls, with the host's `labels`. */
export const shellText = (labels = {}) => ({ slideView: "Slide view", undo: "Undo", redo: "Redo", find: "Find", review: "Review", design: "Design", inspector: "Inspector", ...labels });

/**
 * The controls of a toolbar item the workspace builds itself (`history`, `find`, `views`), inside `container`: the bar's slot, or a host's own
 * element (`slots.history`, `slots.views`). Returns the controls (`undo` and `redo`, `find`, `views`).
 */
export function buildItemControls(name, container, { views = [], labels = {} } = {}) {
  const doc = container.ownerDocument;
  const text = shellText(labels);
  const controls = {};
  if (name === "history") {
    controls.undo = make(doc, "button", { type: "button", class: "opf-ws-button", "data-opf-action": "undo", "aria-label": text.undo, title: `${text.undo} · Ctrl/Cmd Z`, text: text.undo });
    controls.redo = make(doc, "button", { type: "button", class: "opf-ws-button", "data-opf-action": "redo", "aria-label": text.redo, title: `${text.redo} · Ctrl/Cmd Shift Z`, text: text.redo });
    container.classList.add("opf-ws-group");
    container.append(controls.undo, controls.redo);
  } else if (name === "find") {
    controls.find = make(doc, "button", { type: "button", class: "opf-ws-button", "data-opf-action": "find", "aria-expanded": "false", "aria-keyshortcuts": "Control+F Meta+F Control+H", title: `${text.find} · Ctrl/Cmd F`, text: text.find });
    container.append(controls.find);
  } else if (name === "views") {
    controls.views = {};
    const group = make(doc, "div", { class: "opf-ws-views", role: "group", "aria-label": text.slideView });
    for (const view of views) group.append(controls.views[view] = make(doc, "button", { type: "button", class: "opf-ws-button", "data-opf-view-button": view, "aria-pressed": "false", text: viewLabel(view) }));
    container.append(group);
  }
  return controls;
}

// The toolbar items whose slot is a part's mount element: the slot's name (`data-opf-slot`; `design` and `review` already name the side panels,
// so their items' slots are `designMenu` and `reviewPill`) and the class the default layout gives it.
export const ITEM_SLOTS = Object.freeze({
  autosave: ["autosave", "opf-ws-autosave"],
  export: ["export", "opf-ws-export"],
  present: ["present", "opf-ws-present"],
  title: ["title", "opf-ws-title"],
  counter: ["counter", "opf-ws-counter"],
  expand: ["expand", "opf-ws-expand"],
  design: ["designMenu", "opf-ws-design-menu"],
  review: ["reviewPill", "opf-ws-review-pill"],
  help: ["help", "opf-ws-help"],
  actions: ["actions", "opf-ws-actions"],
});
const STRUCTURE = new Set(["spacer", "|", "more"]);

/**
 * Build the toolbar in `host` (the shell's bar, or the host's `slots.toolbar`) from `items` (already filtered to what this editor fills).
 * Returns the toolbar, the slots of the parts that mount in it and the controls the shell built in it; nothing when no item shows anything.
 */
export function buildToolbar(host, { items, views, labels = {}, density, createToolbar, onError, onCollapse }) {
  if (!items.some((item) => !STRUCTURE.has(item.id))) return { toolbar: undefined, slots: {}, controls: {} };
  const toolbar = createToolbar(host, { items, density, onError, onCollapse, labels: { ...(labels.more ? { more: labels.more } : {}), ...(labels.moreMenu ? { menu: labels.moreMenu } : {}) } });
  const slots = {};
  const controls = {};
  for (const [name, element] of Object.entries(toolbar.slots)) {
    if (ITEM_SLOTS[name]) {
      const [slotName, className] = ITEM_SLOTS[name];
      element.setAttribute("data-opf-slot", slotName);
      element.classList.add(className);
      slots[slotName] = element;
    } else if (!STRUCTURE.has(name)) Object.assign(controls, buildItemControls(name, element, { views, labels }));
  }
  return { toolbar, slots, controls };
}

/**
 * Build the shell inside `root`. `parts` names what is mounted (`source`, `canvas`, `navigator`, `thumbnails`, `present`, `export`, `find`,
 * `review`, `design`, `layouts`, `sorter`, `outline`, `persistence`, `history`); `views` lists the views in switch order; `toolbar` the toolbar
 * items (`createToolbar` builds them; `toolbarHost`, the host's own element for the bar, replaces the shell's `header`). Returns the slots (one
 * element per mounted part), the controls and the toolbar.
 */
export function buildWorkspaceShell(root, { parts, views, layout, labels = {}, toolbar: items = [], createToolbar, density, toolbarHost, onError, onCollapse }) {
  const doc = root.ownerDocument;
  const text = shellText(labels);
  const slots = {};
  const controls = {};
  const slot = (name, tag = "div", attributes = {}) => (slots[name] = make(doc, tag, { "data-opf-slot": name, ...attributes }));

  // The bar: the toolbar, in the shell's header unless the host gave its own element for it.
  const bar = toolbarHost ?? make(doc, "header", { class: "opf-ws-bar" });
  const built = buildToolbar(bar, { items, views, labels, density, createToolbar, onError, onCollapse });
  Object.assign(slots, built.slots);
  Object.assign(controls, built.controls);

  // The main column: the slide (or another view) over the slide row, and the status line. A source-only layout has none: the pane has its own
  // bar, problems and status.
  const viewParts = ["sorter", "outline", "layouts"].filter((view) => parts[view]);
  const hasMain = parts.canvas || parts.find || parts.navigator || parts.thumbnails || viewParts.length > 0;
  let stage;
  let frame;
  let main;
  if (hasMain) {
    stage = make(doc, "div", { class: "opf-ws-stage" });
    if (parts.canvas) {
      frame = make(doc, "div", { class: "opf-ws-frame" }, slot("canvas", "div", { class: "opf-ws-canvas", "aria-label": "Slide preview" }));
      stage.append(frame);
    }
    for (const view of viewParts) stage.append(slot(view, "div", { class: `opf-ws-view opf-ws-${view}`, hidden: true }));
    main = make(doc, "section", { class: "opf-ws-main", "aria-label": "Slide workspace" });
    if (parts.find) main.append(slot("find", "div", { class: "opf-ws-find", hidden: true }));
    main.append(stage);
    if (parts.navigator || parts.thumbnails) {
      const dock = make(doc, "div", { class: "opf-ws-dock" });
      if (parts.navigator) dock.append(slot("navigator", "div", { class: "opf-ws-navigator" }));
      if (parts.thumbnails) dock.append(slot("thumbnails", "div", { class: "opf-ws-thumbnails" }));
      main.append(dock);
    }
    main.append(slot("status", "p", { class: "opf-ws-status", role: "status" }));
  }

  const body = make(doc, "div", { class: "opf-ws-body" });
  if (parts.source) body.append(make(doc, "section", { class: "opf-ws-source", "aria-label": "OPF source" }, slot("source", "div", { class: "opf-ws-source-host" })));
  if (main) body.append(main);

  // The side panel: Review and Design as tabs.
  const tabs = ["design", "review"].filter((name) => parts[name]);
  if (tabs.length) {
    controls.tabs = {};
    const list = make(doc, "div", { class: "opf-ws-tabs", role: "tablist", "aria-label": text.inspector });
    const side = make(doc, "aside", { class: "opf-ws-side", "aria-label": text.inspector }, list);
    for (const name of tabs) {
      list.append(controls.tabs[name] = make(doc, "button", { type: "button", role: "tab", class: "opf-ws-tab", id: `opf-ws-tab-${name}`, "aria-selected": "false", "aria-controls": `opf-ws-panel-${name}`, "data-opf-tab": name, text: text[name] }));
      side.append(make(doc, "div", { class: "opf-ws-panel", role: "tabpanel", id: `opf-ws-panel-${name}`, "aria-labelledby": `opf-ws-tab-${name}`, hidden: true }, slot(name, "div", { class: `opf-ws-${name}` })));
    }
    controls.side = side;
    body.append(side);
  }

  if (built.toolbar && !toolbarHost) root.append(bar);
  if (parts.persistence) root.append(slot("banner", "div", { class: "opf-ws-banner", hidden: true }));
  root.append(body);
  root.setAttribute("data-opf-layout", layout);
  controls.frame = frame;
  controls.stage = stage;
  controls.bar = built.toolbar ? bar : undefined;
  return { slots, controls, toolbar: built.toolbar };
}
