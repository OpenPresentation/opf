// The layers panel of the layout editor (RR-99): the tree outline of splits and regions in reading order (role="tree"). Select, rename,
// drag to reorder or to move between splits, and see which nodes have findings; the findings are listed under the tree.
import { createLayoutModel } from "./layout-model.js";
import { LayoutOperationError, isHeading, isPrefix, isSplit, moveNodes, nodeAt, pathKey, samePath } from "./layout-tree.js";
import { SIZE_LABEL, createDom, handleGlobalShortcut, handleSelectionShortcut, isTypingTarget, nextId, nodeMenuItems, openMenu } from "./layout-editor-ui.js";

const DRAG_DISTANCE = 4;
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
  let drag = null;
  let pending = null;
  let menu = null;
  let renameInput = null;

  const itemOf = (path) => list.querySelector(`[data-path="${pathKey(path)}"]`);
  const isSelected = (path) => (path.length ? model.selection.some((entry) => samePath(entry, path)) : model.selection.length === 0);

  function build(path, entry, level, direction, position) {
    const rootItem = path.length === 0, split = !rootItem && isSplit(entry);
    const li = el("li", "opf-lx-item", { role: "treeitem", "aria-level": level, "data-path": pathKey(path), "data-kind": rootItem ? "layout" : split ? "split" : "region" });
    li.setAttribute("aria-selected", String(isSelected(path)));
    if (rootItem || split) li.setAttribute("aria-expanded", String(!collapsed.has(pathKey(path))));
    if (!rootItem) { li.setAttribute("aria-setsize", String(position.size)); li.setAttribute("aria-posinset", String(position.index + 1)); }
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
    for (const item of list.querySelectorAll(".opf-lx-item")) item.tabIndex = item === stop ? 0 : -1;
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
    if (!item || event.target !== item || drag || pending) return;
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
    pending = { x: event.clientX, y: event.clientY, paths, id: event.pointerId };
  });
  list.addEventListener("pointermove", (event) => {
    if (pending && !drag && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > DRAG_DISTANCE) startDrag();
    if (drag) moveDrag(event);
  });
  list.addEventListener("pointerup", (event) => { if (drag) finishDrag(event); pending = null; });
  list.addEventListener("pointercancel", () => { endDrag(); pending = null; });
  list.addEventListener("touchmove", (event) => { if (drag && event.cancelable) event.preventDefault(); }, { passive: false });
  function startDrag() {
    drag = { paths: pending.paths, drop: null };
    list.setPointerCapture?.(pending.id);
    root.dataset.dragging = "true";
    doc.addEventListener("keydown", dragKey, true);
    for (const path of drag.paths) itemOf(path)?.classList.add("is-dragging");
  }
  function dropAt(event) {
    const rows = [...list.querySelectorAll(".opf-lx-item")].map((item) => ({ item, path: parsePath(item.dataset.path), row: item.firstElementChild }));
    const hit = rows.find(({ row }) => { const box = row.getBoundingClientRect(); return event.clientY >= box.top && event.clientY <= box.bottom; });
    if (!hit || drag.paths.some((path) => isPrefix(path, hit.path))) return null;
    const box = hit.row.getBoundingClientRect();
    const fraction = (event.clientY - box.top) / (box.height || 1);
    const entry = hit.path.length ? nodeAt(model.record, hit.path) : model.record;
    let listPath, index, mode;
    if (!hit.path.length) { listPath = []; index = model.record.regions.length; mode = "into"; }
    else if (isSplit(entry) && fraction >= 0.3 && fraction <= 0.7) { listPath = hit.path; index = (entry.regions ?? []).length; mode = "into"; }
    else { listPath = hit.path.slice(0, -1); index = hit.path[hit.path.length - 1] + (fraction < 0.5 ? 0 : 1); mode = fraction < 0.5 ? "before" : "after"; }
    let reason = "", noop = false;
    try { noop = JSON.stringify(moveNodes(model.record, drag.paths, listPath, index).record) === JSON.stringify(model.record); } catch (error) { if (!(error instanceof LayoutOperationError)) throw error; reason = error.message; }
    return { listPath, index, mode, reason, noop, box, item: hit.item };
  }
  function moveDrag(event) {
    const found = dropAt(event);
    drag.drop = found;
    for (const node of list.querySelectorAll("[data-into]")) node.removeAttribute("data-into");
    if (!found) { dropMark.hidden = true; return; }
    const parent = scroller.getBoundingClientRect();
    dropMark.hidden = false;
    dropMark.dataset.mode = found.mode;
    dropMark.dataset.state = found.reason ? "refused" : found.noop ? "same" : "ok";
    dropMark.title = found.reason;
    const top = found.mode === "after" ? found.box.bottom : found.mode === "before" ? found.box.top : found.box.top;
    dropMark.style.top = `${top - parent.top + scroller.scrollTop}px`;
    dropMark.style.left = `${found.box.left - parent.left}px`;
    dropMark.style.width = `${found.box.width}px`;
    dropMark.style.height = found.mode === "into" ? `${found.box.height}px` : "0px";
    if (found.mode === "into") found.item.setAttribute("data-into", "true");
  }
  function finishDrag() {
    const outcome = drag?.drop, paths = drag?.paths;
    endDrag();
    if (!outcome || !paths) return;
    if (outcome.reason) { model.notify(outcome.reason, "error"); return; }
    if (outcome.noop) return;
    model.move(paths, outcome.listPath, outcome.index);
  }
  function endDrag() {
    doc.removeEventListener("keydown", dragKey, true);
    dropMark.hidden = true;
    delete root.dataset.dragging;
    for (const node of list.querySelectorAll(".is-dragging, [data-into]")) { node.classList.remove("is-dragging"); node.removeAttribute("data-into"); }
    drag = null;
    pending = null;
  }
  function dragKey(event) { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); endDrag(); model.notify("Move cancelled."); } }

  // --- keyboard (the WAI-ARIA tree pattern) -------------------------------------------------------------------------------------------------
  const visibleItems = () => [...list.querySelectorAll(".opf-lx-item")];
  list.addEventListener("keydown", (event) => {
    if (event.opfLayoutHandled || event.target.closest?.(".opf-lx-rename")) return;
    if (handleGlobalShortcut(event, model)) return;
    if (isTypingTarget(event.target)) return;
    const item = event.target.closest?.(".opf-lx-item");
    if (!item) return;
    const path = parsePath(item.dataset.path);
    if (event.key === "Escape") {
      event.preventDefault();
      if (menu) { menu.close(); return; }
      if (drag) { endDrag(); return; }
      if (path.length) { const parent = path.slice(0, -1); model.select(parent.length ? [parent] : []); itemOf(parent)?.focus({ preventScroll: true }); }
      return;
    }
    if (path.length && handleSelectionShortcut(event, model, "layers")) return;
    const items = visibleItems();
    const at = items.indexOf(item);
    const go = (target) => { event.preventDefault(); target?.focus(); };
    if (event.key === "ArrowDown") go(items[Math.min(items.length - 1, at + 1)]);
    else if (event.key === "ArrowUp") go(items[Math.max(0, at - 1)]);
    else if (event.key === "Home") go(items[0]);
    else if (event.key === "End") go(items[items.length - 1]);
    else if (event.key === "ArrowRight") {
      if (item.hasAttribute("aria-expanded")) {
        if (item.getAttribute("aria-expanded") === "false") { event.preventDefault(); toggle(path); itemOf(path)?.focus(); } else go(item.querySelector(":scope > ul > .opf-lx-item"));
      }
    } else if (event.key === "ArrowLeft") {
      if (item.getAttribute("aria-expanded") === "true" && (path.length || false)) { event.preventDefault(); toggle(path); itemOf(path)?.focus(); }
      else if (path.length) go(itemOf(path.slice(0, -1)));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (path.length) model.select([path]); else model.select([]);
    } else if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
      if (!path.length) return;
      event.preventDefault();
      const box = item.firstElementChild.getBoundingClientRect();
      openRowMenu({ x: box.left + 24, y: box.bottom }, item);
    }
  });

  const unsubscribe = model.subscribe((event) => {
    if (event.type === "notice" || event.type === "tool") return;
    if (event.type === "view") { root.dataset.density = model.density; return; }
    if (drag && event.type === "record") return;
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
      endDrag();
      menu?.close({ restore: false });
      root.remove();
      if (ownModel) model.destroy();
    },
  };
}
