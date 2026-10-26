// CE-06: the default arrangement of the workspace (`layout: "full"`, `"canvas"` or `"source"`): a bar, the source pane, the slide, the slide
// row, and a side panel for Review and Design. It only builds DOM and hands the elements to the workspace as named slots; a host that
// arranges the parts itself passes its own elements as `slots` and none of this runs. Styled by src/styles/workspace.css (tokens only).

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

/**
 * Build the shell inside `root`. `parts` names what is mounted (`source`, `canvas`, `navigator`, `thumbnails`, `present`, `export`, `find`,
 * `review`, `design`, `layouts`, `sorter`, `outline`, `persistence`, `history`); `views` lists the views in switch order. Returns the slots
 * (one element per mounted part) and the bar's controls.
 */
export function buildWorkspaceShell(root, { parts, views, layout, labels = {} }) {
  const doc = root.ownerDocument;
  const text = { slideView: "Slide view", undo: "Undo", redo: "Redo", find: "Find", review: "Review", design: "Design", inspector: "Inspector", ...labels };
  const slots = {};
  const controls = {};
  const slot = (name, tag = "div", attributes = {}) => (slots[name] = make(doc, tag, { "data-opf-slot": name, ...attributes }));

  // The bar.
  const bar = make(doc, "header", { class: "opf-ws-bar" });
  if (parts.history) {
    controls.undo = make(doc, "button", { type: "button", class: "opf-ws-button", "data-opf-action": "undo", "aria-label": text.undo, title: `${text.undo} · Ctrl/Cmd Z`, text: text.undo });
    controls.redo = make(doc, "button", { type: "button", class: "opf-ws-button", "data-opf-action": "redo", "aria-label": text.redo, title: `${text.redo} · Ctrl/Cmd Shift Z`, text: text.redo });
    bar.append(make(doc, "div", { class: "opf-ws-group" }, controls.undo, controls.redo));
  }
  if (parts.find) {
    controls.find = make(doc, "button", { type: "button", class: "opf-ws-button", "data-opf-action": "find", "aria-expanded": "false", "aria-keyshortcuts": "Control+F Meta+F Control+H", title: `${text.find} · Ctrl/Cmd F`, text: text.find });
    bar.append(controls.find);
  }
  if (views.length > 1) {
    const group = make(doc, "div", { class: "opf-ws-views", role: "group", "aria-label": text.slideView });
    controls.views = {};
    for (const view of views) group.append(controls.views[view] = make(doc, "button", { type: "button", class: "opf-ws-button", "data-opf-view-button": view, "aria-pressed": "false", text: VIEW_LABELS[view] ?? view }));
    bar.append(group);
  }
  bar.append(make(doc, "span", { class: "opf-ws-spacer" }));
  if (parts.persistence) bar.append(slot("autosave", "span", { class: "opf-ws-autosave" }));
  if (parts.export) bar.append(slot("export", "div", { class: "opf-ws-export" }));
  if (parts.present) bar.append(slot("present", "div", { class: "opf-ws-present" }));
  const hasBar = bar.children.length > 1;

  // The main column: the slide (or another view) over the slide row.
  const stage = make(doc, "div", { class: "opf-ws-stage" });
  const frame = make(doc, "div", { class: "opf-ws-frame" }, slot("canvas", "div", { class: "opf-ws-canvas", "aria-label": "Slide preview" }));
  stage.append(frame);
  for (const view of ["sorter", "outline", "layouts"]) if (parts[view]) stage.append(slot(view, "div", { class: `opf-ws-view opf-ws-${view}`, hidden: true }));
  const main = make(doc, "section", { class: "opf-ws-main", "aria-label": "Slide workspace" });
  if (parts.find) main.append(slot("find", "div", { class: "opf-ws-find", hidden: true }));
  main.append(stage);
  if (parts.navigator || parts.thumbnails) {
    const dock = make(doc, "div", { class: "opf-ws-dock" });
    if (parts.navigator) dock.append(slot("navigator", "div", { class: "opf-ws-navigator" }));
    if (parts.thumbnails) dock.append(slot("thumbnails", "div", { class: "opf-ws-thumbnails" }));
    main.append(dock);
  }
  main.append(slot("status", "p", { class: "opf-ws-status", role: "status" }));

  const body = make(doc, "div", { class: "opf-ws-body" });
  if (parts.source) body.append(make(doc, "section", { class: "opf-ws-source", "aria-label": "OPF source" }, slot("source", "div", { class: "opf-ws-source-host" })));
  body.append(main);

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

  if (parts.persistence) root.append();
  if (hasBar) root.append(bar);
  if (parts.persistence) root.append(slot("banner", "div", { class: "opf-ws-banner", hidden: true }));
  root.append(body);
  root.setAttribute("data-opf-layout", layout);
  controls.frame = frame;
  controls.stage = stage;
  controls.bar = bar;
  return { slots, controls };
}
