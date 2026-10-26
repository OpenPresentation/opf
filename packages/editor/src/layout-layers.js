// The layers panel of the layout editor (RR-99): the tree outline of splits and regions in reading order (role="tree"). Select, rename,
// drag to reorder or to move between splits, and see which nodes have findings; the findings are listed under the tree.
// CE-18: the tree items, the tree keyboard, the drag controller and the drop place are the studio kit's (src/studio-kit/).
import { createLayoutModel } from "./layout-model.js";
import { trialMove } from "./layout-adapter.js";
import { isHeading, isPrefix, isSplit, nodeAt, pathKey, samePath } from "./layout-tree.js";
import { SIZE_LABEL, createDom, handleGlobalShortcut, handleSelectionShortcut, isHandled, isTypingTarget, nextId, nodeMenuItems, openMenu } from "./layout-editor-ui.js";
import { hitRow, rovingTabStop, rowDropMode, showTreeDrop, treeItem, treeKeyAction } from "./studio-kit/tree.js";
import { createDragController } from "./studio-kit/drag.js";
const parsePath = (text) => (text === "" || text === undefined ? [] : text.split(".").map(Number));

/**
 * Mount the layers panel in `container`. Options: `model` (shared state; one is created from the other options when omitted),
 * `onFindingSelect(finding)`, `label`. Returns `{ element, model, refresh, focus, destroy }`.
 */
export function createLayoutTree(container, options = {}) {
  if (!container?.ownerDocument) throw new TypeError("A DOM container is required.");
  const doc = container.ownerDocument, win = doc.defaultView;
  const dom = createDom(doc);
  const { el } = dom;
  const ownModel = !options.model;
  const model = options.model ?? createLayoutModel(options);
  const id = nextId("opf-lx-layers");

  const root = el("section", "opf-lx-layers opf-ui", { "aria-labelledby": `${id}-title`, "data-density": model.density });
  const head = el("div", "opf-lx-panel-head");
  head.append(dom.icon("Layers", 14), el("h2", "opf-lx-panel-title", { id: `${id}-title`, text: "Layers" }));
  const scroller = el("div", "opf-lx-layers-scroll");
  const list = el("ul", "opf-lx-tree", { role: "tree", "aria-label": options.label ?? "Layout layers" });
  const dropMark = el("div", "opf-lx-tree-drop", { "aria-hidden": "true" });
  dropMark.hidden = true;
  scroller.append(list, dropMark);
  const findings = el("div", "opf-lx-findings");
  const findingsHead = el("p", "opf-lx-findings-head", { role: "status" });
  const findingsList = el("ul", "opf-lx-findings-list", { "aria-label": "Findings" });
  findings.append(findingsHead, findingsList);
  root.append(head, scroller, findings);
  container.append(root);

  const collapsed = new Set();
  let menu = null;
  let renameInput = null;

  const itemOf = (path) => list.querySelector(`[data-path="${pathKey(path)}"]`);
  const isSelected = (path) => (path.length ? model.selection.some((entry) => samePath(entry, path)) : model.selection.length === 0);

  function build(path, entry, level, direction, position) {
    const rootItem = path.length === 0, split = !rootItem && isSplit(entry);
    const li = treeItem(dom, {
      level, selected: isSelected(path), expanded: rootItem || split ? !collapsed.has(pathKey(path)) : undefined,
      setsize: rootItem ? undefined : position.size, posinset: rootItem ? undefined : position.index + 1,
      attributes: { "data-path": pathKey(path), "data-kind": rootItem ? "layout" : split ? "split" : "region" },
    });
    const issues = model.findingsFor(path);
    const within = model.findingsWithin(path);
    const row = el("div", "opf-lx-row", { "data-selected": String(isSelected(path)), "data-finding": issues.length ? "error" : within.length ? "within" : "" });
    row.style.paddingInlineStart = `calc(${level - 1} * var(--opf-lx-indent) + 6px)`;
    if (!rootItem) { const grip = el("span", "opf-lx-grip", { "aria-hidden": "true" }); grip.append(dom.icon("GripVertical", 14)); row.append(grip); }
    if (rootItem || split) {
      const caret = el("span", "opf-lx-caret", { "aria-hidden": "true" });
      caret.append(dom.icon(collapsed.has(pathKey(path)) ? "ChevronRight" : "ChevronDown", 14));
      caret.addEventListener("click", (event) => { event.stopPropagation(); toggle(path); });
      row.append(caret);
    } else row.append(el("span", "opf-lx-caret"));
    row.append(dom.icon(rootItem ? "Layers" : split ? (entry.direction === "row" ? "Columns2" : "Rows2") : isHeading(entry) ? "Heading" : "Square", 14));
    const name = rootItem ? model.record.name || model.record.id || "Untitled layout" : split ? `${entry.direction === "row" ? "Row" : "Column"} split` : entry.name;
    row.append(el("span", "opf-lx-row-name", { text: name }));
    if (!rootItem) row.append(el("span", "opf-lx-row-size", { "aria-hidden": "true", text: SIZE_LABEL(entry, direction) }));
    else row.append(el("span", "opf-lx-row-size", { "aria-hidden": "true", text: model.record.direction === "row" ? "row" : "column" }));
    if (issues.length || within.length) {
      const flag = el("span", "opf-lx-row-flag", { title: (issues.length ? issues : within).map((finding) => finding.message).join("\n") });
      flag.append(dom.icon("CircleX", 14), el("span", "opf-lx-visually-hidden", { text: `${(issues.length ? issues : within).length} finding${(issues.length ? issues : within).length === 1 ? "" : "s"}` }));
      row.append(flag);
    }
    li.append(row);
    if (split && !collapsed.has(pathKey(path)) && Array.isArray(entry.regions)) li.append(group(path, entry.regions, level + 1, entry.direction === "row" ? "row" : "column"));
    if (rootItem && !collapsed.has("")) li.append(group([], model.record.regions, level + 1, model.record.direction === "row" ? "row" : "column"));
    return li;
  }
  function group(path, entries, level, direction) {
    const ul = el("ul", "opf-lx-group", { role: "group" });
    entries.forEach((entry, index) => ul.append(build([...path, index], entry, level, direction, { index, size: entries.length })));
    return ul;
  }
  function toggle(path) {
    const key = pathKey(path);
    if (collapsed.has(key)) collapsed.delete(key); else collapsed.add(key);
    render();
  }

  function render() {
    const active = doc.activeElement;
    const focusedKey = list.contains(active) ? active.closest?.("[data-path]")?.dataset.path : undefined;
    // A selection hidden inside a collapsed split opens it.
    for (const path of model.selection) for (let n = 1; n < path.length; n++) collapsed.delete(pathKey(path.slice(0, n)));
    if (model.selection.length) collapsed.delete("");
    list.replaceChildren(build([], model.record, 1, "column", { index: 0, size: 1 }));
    const primary = model.primary ?? [];
    const stop = itemOf(primary) ?? itemOf([]);
    rovingTabStop(list.querySelectorAll(".opf-lx-item"), stop);
    if (focusedKey !== undefined) { const next = itemOf(primary) ?? itemOf(parsePath(focusedKey)) ?? stop; next?.focus({ preventScroll: true }); }
    paintFindings();
    syncRename();
  }
  function paintFindings() {
    const items = model.findings;
    const errors = items.filter((finding) => finding.severity === "error").length;
    findingsHead.textContent = items.length ? `${items.length} finding${items.length === 1 ? "" : "s"}` : "No findings";
    findingsHead.dataset.state = items.length ? (errors ? "error" : "warning") : "valid";
    findingsHead.prepend(dom.icon(items.length ? "CircleX" : "Check", 14));
    findingsList.replaceChildren();
    findingsList.hidden = !items.length;
    for (const finding of items) {
      const li = el("li", "opf-lx-finding-item");
      const button = el("button", "opf-lx-finding", { type: "button", "data-rule": finding.ruleId ?? "" });
      const where = finding.node.length ? `${model.describe(finding.node)}${finding.field ? ` · ${finding.field}` : ""}` : `layout${finding.field ? ` · ${finding.field}` : ""}`;
      button.append(el("span", "opf-lx-finding-message", { text: finding.message }), el("span", "opf-lx-finding-where", { text: `${finding.ruleId ?? "finding"} · ${where}` }));
      button.addEventListener("click", () => { model.select(finding.node.length ? [finding.node] : []); options.onFindingSelect?.(finding); itemOf(finding.node)?.focus({ preventScroll: true }); });
      li.append(button);
      findingsList.append(li);
    }
  }

  // --- rename in place ---------------------------------------------------------------------------------------------------------------
  function syncRename() {
    const request = model.renaming;
    const wanted = request?.surface === "layers" ? request.path : null;
    if (renameInput && (!wanted || renameInput._path !== pathKey(wanted))) { renameInput = null; }
    if (!wanted || renameInput) return;
    const item = itemOf(wanted);
    const entry = nodeAt(model.record, wanted);
    if (!item || !entry || isSplit(entry)) { model.requestRename(null); return; }
    const label = item.querySelector(":scope > .opf-lx-row > .opf-lx-row-name");
    const input = el("input", "opf-lx-rename opf-lx-rename-row", { type: "text", value: entry.name, "aria-label": `Rename ${entry.name}`, spellcheck: "false", autocomplete: "off" });
    input._path = pathKey(wanted);
    label.replaceWith(input);
    let done = false;
    const finish = (commit) => {
      if (done) return;
      done = true;
      const value = input.value.trim();
      renameInput = null;
      model.requestRename(null);
      if (commit && value && value !== entry.name) model.setProperty(wanted, "name", value, { coalesce: null });
      else render();
      itemOf(model.primary ?? wanted)?.focus({ preventScroll: true });
    };
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") { event.preventDefault(); finish(true); }
      else if (event.key === "Escape") { event.preventDefault(); finish(false); }
    });
    input.addEventListener("blur", () => finish(true));
    input.addEventListener("pointerdown", (event) => event.stopPropagation());
    renameInput = input;
    input.focus();
    input.select();
  }

  // --- pointer: select, context menu, drag ---------------------------------------------------------------------------------------------
  const rowPath = (event) => { const item = event.target.closest?.(".opf-lx-item"); return item ? parsePath(item.dataset.path) : null; };
  list.addEventListener("click", (event) => {
    if (event.target.closest(".opf-lx-rename, .opf-lx-caret")) return;
    const path = rowPath(event);
    if (!path) return;
    if (!path.length) { model.select([]); itemOf([])?.focus({ preventScroll: true }); return; }
    if (event.shiftKey) model.selectAdd(path); else model.select([path]);
    itemOf(path)?.focus({ preventScroll: true });
  });
  list.addEventListener("dblclick", (event) => {
    const path = rowPath(event);
    if (!path?.length || model.readOnly) return;
    const entry = nodeAt(model.record, path);
    if (entry && !isSplit(entry)) model.requestRename(path, "layers");
  });
  list.addEventListener("focusin", (event) => {
    const item = event.target.closest?.(".opf-lx-item");
    if (!item || event.target !== item || dragger.active || dragger.pending) return;
    const path = parsePath(item.dataset.path);
    if (!path.length) { if (model.selection.length) model.select([]); } else if (!isSelected(path)) model.select([path]);
  });
  list.addEventListener("contextmenu", (event) => {
    const path = rowPath(event);
    if (!path?.length) return;
    event.preventDefault();
    if (!isSelected(path)) model.select([path]);
    openRowMenu({ x: event.clientX, y: event.clientY }, itemOf(path));
  });
  function openRowMenu(point, returnFocus) {
    menu?.close({ restore: false });
    if (!model.selection.length) return;
    menu = openMenu(dom, root, { x: point.x, y: point.y, label: "Layer actions", returnFocus, onClose: () => { menu = null; }, items: nodeMenuItems(model, model.selection, "layers", win) });
  }

  list.addEventListener("pointerdown", (event) => {
    if (model.readOnly || (event.pointerType === "mouse" && event.button !== 0) || event.target.closest(".opf-lx-rename, .opf-lx-caret")) return;
    if (event.pointerType === "touch" && !event.target.closest(".opf-lx-grip")) return;
    const path = rowPath(event);
    if (!path?.length) return;
    const paths = model.selection.some((entry) => samePath(entry, path)) ? model.selection.map((entry) => [...entry]) : [path];
    dragger.press(event, { paths });
  });
  list.addEventListener("pointermove", (event) => { dragger.move(event); });
  list.addEventListener("pointerup", (event) => { dragger.release(event); });
  list.addEventListener("pointercancel", () => { dragger.cancel(); });
  list.addEventListener("touchmove", (event) => { if (dragger.active && event.cancelable) event.preventDefault(); }, { passive: false });
  // The kit's drag controller: a press past 4px drags the rows; each move finds the drop place; the release moves once; Escape cancels.
  const dragger = createDragController({
    doc,
    onStart(press) {
      list.setPointerCapture?.(press.id);
      return { paths: press.payload.paths, drop: null };
    },
    onStarted(drag) {
      root.dataset.dragging = "true";
      for (const path of drag.paths) itemOf(path)?.classList.add("is-dragging");
    },
    onMove(drag, event) {
      const found = dropAt(drag, event);
      drag.drop = found;
      for (const node of list.querySelectorAll("[data-into]")) node.removeAttribute("data-into");
      showTreeDrop(dropMark, scroller, found && { mode: found.mode, state: found.reason ? "refused" : found.noop ? "same" : "ok", reason: found.reason, box: found.box });
      if (found?.mode === "into") found.item.setAttribute("data-into", "true");
    },
    onEnd() {
      dropMark.hidden = true;
      delete root.dataset.dragging;
      for (const node of list.querySelectorAll(".is-dragging, [data-into]")) { node.classList.remove("is-dragging"); node.removeAttribute("data-into"); }
    },
    onDrop(drag) {
      const outcome = drag.drop, paths = drag.paths;
      if (!outcome || !paths) return;
      if (outcome.reason) { model.notify(outcome.reason, "error"); return; }
      if (outcome.noop) return;
      model.move(paths, outcome.listPath, outcome.index);
    },
    onEscape: () => model.notify("Move cancelled."),
  });
  function dropAt(drag, event) {
    const rows = [...list.querySelectorAll(".opf-lx-item")].map((item) => ({ item, path: parsePath(item.dataset.path), row: item.firstElementChild }));
    const hit = hitRow(rows, event.clientY);
    if (!hit || drag.paths.some((path) => isPrefix(path, hit.path))) return null;
    const box = hit.row.getBoundingClientRect();
    const fraction = (event.clientY - box.top) / (box.height || 1);
    const entry = hit.path.length ? nodeAt(model.record, hit.path) : model.record;
    const mode = rowDropMode(fraction, { root: !hit.path.length, container: hit.path.length > 0 && isSplit(entry) });
    let listPath, index;
    if (!hit.path.length) { listPath = []; index = model.record.regions.length; }
    else if (mode === "into") { listPath = hit.path; index = (entry.regions ?? []).length; }
    else { listPath = hit.path.slice(0, -1); index = hit.path[hit.path.length - 1] + (mode === "before" ? 0 : 1); }
    const { reason, noop } = trialMove(model.record, drag.paths, listPath, index);
    return { listPath, index, mode, reason, noop, box, item: hit.item };
  }

  // --- keyboard (the WAI-ARIA tree pattern) -------------------------------------------------------------------------------------------------
  const visibleItems = () => [...list.querySelectorAll(".opf-lx-item")];
  list.addEventListener("keydown", (event) => {
    if (isHandled(event) || event.target.closest?.(".opf-lx-rename")) return;
    if (handleGlobalShortcut(event, model)) return;
    if (isTypingTarget(event.target)) return;
    const item = event.target.closest?.(".opf-lx-item");
    if (!item) return;
    const path = parsePath(item.dataset.path);
    if (event.key === "Escape") {
      event.preventDefault();
      if (menu) { menu.close(); return; }
      if (dragger.active) { dragger.cancel(); return; }
      if (path.length) { const parent = path.slice(0, -1); model.select(parent.length ? [parent] : []); itemOf(parent)?.focus({ preventScroll: true }); }
      return;
    }
    if (path.length && handleSelectionShortcut(event, model, "layers")) return;
    const action = treeKeyAction(event, item, visibleItems(), {
      expandable: item.hasAttribute("aria-expanded"),
      expanded: item.getAttribute("aria-expanded") === "true",
      collapsible: path.length > 0,
      parent: path.length ? itemOf(path.slice(0, -1)) : null,
      firstChild: item.querySelector(":scope > ul > .opf-lx-item"),
      menu: path.length > 0,
    });
    if (!action) return;
    event.preventDefault();
    if (action.type === "focus") action.target?.focus();
    else if (action.type === "expand" || action.type === "collapse") { toggle(path); itemOf(path)?.focus(); }
    else if (action.type === "activate") { if (path.length) model.select([path]); else model.select([]); }
    else if (action.type === "menu") {
      const box = item.firstElementChild.getBoundingClientRect();
      openRowMenu({ x: box.left + 24, y: box.bottom }, item);
    }
  });

  const unsubscribe = model.subscribe((event) => {
    if (event.type === "notice" || event.type === "tool") return;
    if (event.type === "view") { root.dataset.density = model.density; return; }
    if (dragger.active && event.type === "record") return;
    render();
  });
  render();

  return {
    element: root,
    model,
    refresh: render,
    focus() { (itemOf(model.primary ?? []) ?? itemOf([]))?.focus(); },
    /** Edit the name of the region at `path` in its row. */
    beginRename(path) { model.requestRename(path, "layers"); },
    destroy() {
      unsubscribe();
      dragger.cancel();
      menu?.close({ restore: false });
      root.remove();
      if (ownModel) model.destroy();
    },
  };
}
