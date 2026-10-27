// CE-20: the Studio's layers panel, the current slide's scene as a tree (the WAI-ARIA tree pattern from the kit: `role="tree"`, a roving tab
// stop, `aria-level`, `aria-setsize`, `aria-posinset`, `aria-selected`, `aria-expanded`). A click selects, Shift+click selects a range of
// siblings, Cmd or Ctrl+click toggles one; the arrow keys move and expand or collapse; Enter goes to the canvas with that node selected; F2 edits
// a text node; a drag reorders or moves into a container with the canvas's trial and reason. One selection for every surface: the Studio
// owns it, this only draws it and asks for changes.
import { hitRow, rovingTabStop, rowDropMode, showTreeDrop, treeItem, treeKeyAction } from "./studio-kit/tree.js";
import { isTypingTarget } from "./studio-kit/dom.js";

const ICON_OF = { slide: "Square", heading: "Heading", region: "Columns2", group: "Group", implicit: "AlignLeft", part: "GitCommitHorizontal" };
const TYPE_ICON = { text: "AlignLeft", list: "List", image: "Image", video: "Video", chart: "ChartColumn", table: "Table", code: "Code", metric: "Hash", quote: "Quote", timeline: "CalendarRange" };

/**
 * Mount the layers tree in `container`. `adapter` is the slide adapter, `studio` the controller. Returns `{ element, render, paintSelection,
 * focus, destroy }`.
 */
export function createStudioLayers(container, { dom, adapter, studio }) {
  const doc = container.ownerDocument;
  const { el } = dom;
  const p = dom.prefix;
  const scroller = el("div", `${p}-layers-scroll`);
  const tree = el("ul", `${p}-tree`, { role: "tree", "aria-label": "Layers", "aria-multiselectable": "true" });
  const mark = el("div", `${p}-tree-drop`, { "aria-hidden": "true" });
  mark.hidden = true;
  scroller.append(tree, mark);
  container.append(scroller);
  const collapsed = new Set();
  let rows = [];
  let focusKey = null;
  let drag = null;
  let lastScene = null;

  const scene = () => adapter.scene();
  const visibleChildren = (s, key) => s.children(key).filter((node) => node.kind !== "part");

  function render() {
    const s = scene();
    lastScene = s;
    const hadFocus = tree.contains(doc.activeElement);
    const selected = new Set(studio.selectedKeys());
    const items = [];
    rows = [];
    const add = (node, level, setsize, posinset) => {
      const children = visibleChildren(s, node.key);
      const expandable = children.length > 0;
      const expanded = expandable && !collapsed.has(node.key);
      const li = treeItem(dom, { level, selected: selected.has(node.key), expanded: expandable ? expanded : undefined, setsize: level > 1 ? setsize : undefined, posinset: level > 1 ? posinset : undefined, attributes: { "data-key": node.key, "data-kind": node.kind }, className: `${p}-row` });
      const label = el("span", `${p}-row-label`);
      label.style.setProperty("--opf-studio-level", String(level - 1));
      if (expandable) {
        const caret = el("span", `${p}-caret`, { "aria-hidden": "true" });
        caret.append(dom.icon(expanded ? "ChevronDown" : "ChevronRight", 14));
        caret.addEventListener("click", (event) => { event.stopPropagation(); toggle(node.key); });
        label.append(caret);
      } else label.append(el("span", `${p}-caret`, { "aria-hidden": "true" }));
      label.append(dom.icon(node.kind === "block" || node.kind === "implicit" ? TYPE_ICON[node.type] ?? "Square" : ICON_OF[node.kind] ?? "Square", 14));
      label.append(el("span", `${p}-row-text`, { text: node.kind === "slide" ? studio.slideLabel(node) : node.label }));
      if (node.findings.length) label.append(el("span", `${p}-row-badge`, { text: String(node.findings.length), title: node.findings.map((finding) => finding.message).join("\n"), "aria-label": `${node.findings.length} finding${node.findings.length === 1 ? "" : "s"}` }));
      if (node.hidden) { const hidden = el("span", `${p}-row-hidden`, { title: "Hidden slide" }); hidden.append(dom.icon("EyeOff", 14)); label.append(hidden); }
      li.append(label);
      items.push(li);
      rows.push({ row: li, key: node.key, node, level, expandable, expanded });
      if (expanded) {
        const group = el("ul", `${p}-tree-group`, { role: "group" });
        li.append(group);
        const parentItems = items.length;
        children.forEach((child, index) => add(child, level + 1, children.length, index + 1));
        group.append(...items.splice(parentItems));
      }
    };
    const slide = s.node(s.slideKey);
    add(slide, 1, 1, 1);
    // The Background pseudo-row: it selects the slide and shows the Design panel's background section.
    const background = treeItem(dom, { level: 2, selected: false, setsize: visibleChildren(s, s.slideKey).length + 1, posinset: visibleChildren(s, s.slideKey).length + 1, attributes: { "data-key": "#background", "data-kind": "background" }, className: `${p}-row` });
    const backgroundLabel = el("span", `${p}-row-label`);
    backgroundLabel.style.setProperty("--opf-studio-level", "1");
    backgroundLabel.append(el("span", `${p}-caret`, { "aria-hidden": "true" }), dom.icon("Image", 14), el("span", `${p}-row-text`, { text: "Background" }));
    background.append(backgroundLabel);
    rows.push({ row: background, key: "#background", node: null, level: 2, expandable: false, expanded: false });
    const slideGroup = items[0]?.querySelector(":scope > ul");
    if (slideGroup) slideGroup.append(background);
    else { const group = el("ul", `${p}-tree-group`, { role: "group" }); group.append(background); items[0]?.append(group); }
    tree.replaceChildren(...items);
    paintSelection({ focus: hadFocus });
  }

  /** Mark the selection and the tab stop without rebuilding (`focus`: move focus to the stop). */
  function paintSelection({ focus = false } = {}) {
    if (scene() !== lastScene) { render(); return; }
    const selected = new Set(studio.selectedKeys());
    const primary = studio.primaryKey();
    for (const entry of rows) entry.row.setAttribute("aria-selected", String(entry.key !== "#background" && selected.has(entry.key)));
    const stop = (focus ? null : rows.find((entry) => entry.key === (focusKey && tree.contains(doc.activeElement) ? focusKey : primary))) ?? rows.find((entry) => entry.key === primary) ?? rows[0];
    if (focus && stop) focusKey = stop.key;
    rovingTabStop(rows.map((entry) => entry.row), stop?.row);
    if (focus && stop) stop.row.focus({ preventScroll: false });
    else if (stop && !tree.contains(doc.activeElement)) stop.row.scrollIntoView?.({ block: "nearest" });
  }

  function toggle(key) {
    if (collapsed.has(key)) collapsed.delete(key); else collapsed.add(key);
    focusKey = key;
    render();
    rows.find((entry) => entry.key === key)?.row.focus();
  }
  const rowOf = (target) => rows.find((entry) => entry.row === target.closest?.(`.${p}-row`));

  function activate(entry, event) {
    if (entry.key === "#background") { studio.select([scene().slideKey], { source: "layers" }); studio.showDesignSection("background"); return; }
    if (event.shiftKey) studio.selectRange(entry.key, { source: "layers" });
    else if (event.metaKey || event.ctrlKey) studio.selectAdd(entry.key, { source: "layers" });
    else studio.select([entry.key], { source: "layers" });
  }
  tree.addEventListener("click", (event) => {
    const entry = rowOf(event.target);
    if (!entry || drag?.moved) return;
    focusKey = entry.key;
    activate(entry, event);
    entry.row.focus({ preventScroll: true });
  });
  tree.addEventListener("focusin", (event) => { const entry = rowOf(event.target); if (entry) focusKey = entry.key; });
  tree.addEventListener("keydown", (event) => {
    if (isTypingTarget(event.target)) return;
    const entry = rowOf(event.target);
    if (!entry) return;
    const visible = rows.map((item) => item.row);
    const parentRow = entry.node?.parent ? rows.find((item) => item.key === entry.node.parent)?.row : entry.key === "#background" ? rows[0]?.row : null;
    const firstChild = entry.expanded ? rows[rows.indexOf(entry) + 1]?.row : null;
    if (event.key === "F2" && entry.node) { event.preventDefault(); studio.select([entry.key], { source: "layers" }); studio.beginTextEdit(entry.key); return; }
    if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      event.stopPropagation();
      activate(entry, {});
      studio.focusCanvas();
      return;
    }
    if ((event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) && entry.node) {
      event.preventDefault();
      if (!studio.selectedKeys().includes(entry.key)) studio.select([entry.key], { source: "layers" });
      const box = entry.row.getBoundingClientRect();
      studio.openContextMenu({ x: box.left + 24, y: box.bottom }, { returnFocus: entry.row });
      return;
    }
    const action = treeKeyAction(event, entry.row, visible, { expandable: entry.expandable, expanded: entry.expanded, collapsible: entry.expandable, parent: parentRow, firstChild, menu: false });
    if (!action || action.type === "activate" || action.type === "menu") {
      if (event.key === " ") { event.preventDefault(); activate(entry, event); }
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (action.type === "expand" || action.type === "collapse") { toggle(entry.key); return; }
    const target = rows.find((item) => item.row === action.target);
    if (!target) return;
    focusKey = target.key;
    rovingTabStop(visible, target.row);
    target.row.focus();
    if (target.key !== "#background" && !event.shiftKey) studio.select([target.key], { source: "layers" });
    else if (event.shiftKey && target.key !== "#background") studio.selectRange(target.key, { source: "layers" });
  });

  // --- drag to reorder or move into a container -------------------------------------------------------------------------------------------
  tree.addEventListener("pointerdown", (event) => {
    const entry = rowOf(event.target);
    if (!entry?.node?.can?.move || studio.readOnly || (event.pointerType === "mouse" && event.button !== 0)) return;
    drag = { entry, x: event.clientX, y: event.clientY, id: event.pointerId, moved: false, drop: null };
  });
  const dropFor = (clientY) => {
    const target = hitRow(rows.filter((item) => item.node), clientY);
    if (!target) return null;
    const box = target.row.querySelector(`.${p}-row-label`).getBoundingClientRect();
    const node = target.node;
    const container = node.kind === "slide" || node.kind === "group" || node.kind === "region";
    const mode = rowDropMode((clientY - box.top) / Math.max(1, box.height), { root: node.kind === "slide", container });
    const keys = studio.selectedKeys().includes(drag.entry.key) ? studio.selectedKeys() : [drag.entry.key];
    let targetKey, index;
    if (mode === "into") { targetKey = node.key; index = scene().contentChildren(node.key).length; }
    else {
      if (!node.parent) return null;
      targetKey = node.parent;
      const list = scene().contentChildren(node.parent);
      index = list.findIndex((child) => child.key === node.key) + (mode === "after" ? 1 : 0);
      if (index < 0) return null;
    }
    const trial = adapter.trialMove(keys, targetKey, index);
    return { keys, target: targetKey, index, mode, box, ...trial };
  };
  tree.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) return;
    if (!drag.moved) { drag.moved = true; try { tree.setPointerCapture?.(event.pointerId); } catch { /* a pointer that cannot be captured (a synthetic one) */ } if (!studio.selectedKeys().includes(drag.entry.key)) studio.select([drag.entry.key], { source: "layers" }); }
    drag.drop = dropFor(event.clientY);
    showTreeDrop(mark, scroller, drag.drop ? { mode: drag.drop.mode, state: drag.drop.ok ? (drag.drop.noop ? "same" : "ok") : "refused", reason: drag.drop.reason, box: drag.drop.box } : null);
    if (drag.drop && !drag.drop.ok) studio.status(drag.drop.reason);
  });
  const endDrag = (commit) => {
    const session = drag;
    drag = null;
    showTreeDrop(mark, scroller, null);
    if (!session?.moved || !commit) return;
    // The click that follows a drag must not select the row under the pointer.
    drag = { moved: true };
    globalThis.setTimeout(() => { if (drag?.moved && !drag.entry) drag = null; }, 0);
    const found = session.drop;
    if (!found) return;
    if (!found.ok) { studio.announce(found.reason); return; }
    if (!found.noop) studio.move(found.keys, found.target, found.index);
  };
  tree.addEventListener("pointerup", () => endDrag(true));
  tree.addEventListener("pointercancel", () => endDrag(false));
  tree.addEventListener("keydown", (event) => { if (event.key === "Escape" && drag?.moved) { event.preventDefault(); event.stopPropagation(); endDrag(false); studio.announce("Move cancelled."); } }, true);

  return {
    element: scroller,
    render,
    paintSelection,
    focus() { (rows.find((entry) => entry.row.tabIndex === 0) ?? rows[0])?.row.focus(); },
    destroy() { scroller.remove(); },
  };
}
