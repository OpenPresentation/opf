// CE-18, the studio kit: the layers tree (the WAI-ARIA tree pattern). `treeItem` makes a `role="treeitem"` with its level, place, selection
// and expansion; `rovingTabStop` keeps one item in the tab order; `treeKeyAction` says what a key does on a focused item; `rowDropMode` and
// `hitRow` find where a dragged row would land; `showTreeDrop` draws that place. The host builds the rows and owns the document.

/**
 * A tree item (`li`, `role="treeitem"`). `expanded` is true or false for an item with children and undefined for a leaf; `setsize` and
 * `posinset` (1-based) are left out for the root. `attributes` are added as they are (`data-*`).
 */
export function treeItem(dom, { level, selected, expanded, setsize, posinset, attributes = {}, className = `${dom.prefix}-item` }) {
  const li = dom.el("li", className, { role: "treeitem", "aria-level": level, ...attributes });
  li.setAttribute("aria-selected", String(Boolean(selected)));
  if (expanded !== undefined) li.setAttribute("aria-expanded", String(Boolean(expanded)));
  if (setsize !== undefined) { li.setAttribute("aria-setsize", String(setsize)); li.setAttribute("aria-posinset", String(posinset)); }
  return li;
}

/** Make `stop` the one item of `items` in the tab order. */
export function rovingTabStop(items, stop) {
  for (const item of items) item.tabIndex = item === stop ? 0 : -1;
}

/**
 * What a key does on the focused tree item `item` (the tree pattern). `items` are the visible items in order. Returns null, or:
 * - `{ type: "focus", target }` (ArrowDown, ArrowUp, Home, End; ArrowRight on an expanded item goes to `firstChild`, ArrowLeft on a child to
 *   `parent`; `target` may be null when there is nowhere to go, and the key is still the tree's);
 * - `{ type: "expand" }` (ArrowRight on a collapsed item) and `{ type: "collapse" }` (ArrowLeft on an expanded item that can collapse);
 * - `{ type: "activate" }` (Enter or Space) and `{ type: "menu" }` (the ContextMenu key or Shift+F10, on an item that has one).
 * `state` is `{ expandable, expanded, collapsible, parent, firstChild, menu }`.
 */
export function treeKeyAction(event, item, items, state = {}) {
  const at = items.indexOf(item);
  const focus = (target) => ({ type: "focus", target: target ?? null });
  switch (event.key) {
    case "ArrowDown": return focus(items[Math.min(items.length - 1, at + 1)]);
    case "ArrowUp": return focus(items[Math.max(0, at - 1)]);
    case "Home": return focus(items[0]);
    case "End": return focus(items[items.length - 1]);
    case "ArrowRight":
      if (!state.expandable) return null;
      return state.expanded ? focus(state.firstChild) : { type: "expand" };
    case "ArrowLeft":
      if (state.expanded && state.collapsible) return { type: "collapse" };
      return state.parent ? focus(state.parent) : null;
    case "Enter":
    case " ":
      return { type: "activate" };
    default:
      if ((event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) && state.menu) return { type: "menu" };
      return null;
  }
}

/** The row of `rows` (`{ row, ... }`, `row` an element) that a client y is over, or undefined. */
export const hitRow = (rows, clientY) => rows.find(({ row }) => { const box = row.getBoundingClientRect(); return clientY >= box.top && clientY <= box.bottom; });

/**
 * Where a drop at `fraction` of a row's height lands: "into" the row (always for the root, and in the middle 40% of a container), else
 * "before" (the upper half) or "after".
 */
export function rowDropMode(fraction, { root = false, container = false } = {}) {
  if (root) return "into";
  if (container && fraction >= 0.3 && fraction <= 0.7) return "into";
  return fraction < 0.5 ? "before" : "after";
}

/**
 * Draw the drop place on `mark` (positioned in `scroller`): a line above or below the row's box, or the whole box for "into". `state` is
 * "ok", "same" or "refused", with `reason` as its title. A null drop hides it.
 */
export function showTreeDrop(mark, scroller, drop) {
  if (!drop) { mark.hidden = true; return; }
  const parent = scroller.getBoundingClientRect();
  mark.hidden = false;
  mark.dataset.mode = drop.mode;
  mark.dataset.state = drop.state;
  mark.title = drop.reason ?? "";
  const top = drop.mode === "after" ? drop.box.bottom : drop.box.top;
  mark.style.top = `${top - parent.top + scroller.scrollTop}px`;
  mark.style.left = `${drop.box.left - parent.left}px`;
  mark.style.width = `${drop.box.width}px`;
  mark.style.height = drop.mode === "into" ? `${drop.box.height}px` : "0px";
}
