// CE-18, the studio kit: the overlay drawn over a studio's frame. Boxes are placed in unit coordinates (0 to 1 of the frame) and kept by key,
// so a redraw moves the existing elements instead of rebuilding them. The overlay also has the hover outline, findings badges, the dividers
// between tracks (role="separator", with their keyboard), the drop line and "into" highlight of a drag, the ratio badge of a resize, an
// optional guide line, and an optional marker layer (for comment pins, proposal ghosts and peers later). It knows boxes, not documents.
import { pct } from "./dom.js";

/** Place an absolutely positioned element over `box` (`{ x, y, w, h }` in unit coordinates), grown by `pad` on every side. */
export function setBox(node, box, pad = 0) {
  node.style.left = pct(box.x - pad);
  node.style.top = pct(box.y - pad);
  node.style.width = pct(box.w + 2 * pad);
  node.style.height = pct(box.h + 2 * pad);
}

/** Whether a unit point is inside `box`, with `slack` around it. */
export const inside = (box, point, slack = 0) => point.x >= box.x - slack && point.x <= box.x + box.w + slack && point.y >= box.y - slack && point.y <= box.y + box.h + slack;

/** The boxes under a unit point, from the outermost to the deepest (by `depth`), leaving out those `skip(box)` refuses. */
export const boxesAt = (boxes, point, { slack = 0.0005, skip } = {}) => boxes.filter((box) => inside(box, point, slack) && !(skip && skip(box))).sort((a, b) => a.depth - b.depth);

/**
 * Keyed elements in `layer`. Each redraw is `const pass = keyed.begin()`, then `pass.ensure(key, create)` for every element in the order
 * they should have (it creates the element the first time and returns the same one after), then `pass.done()`, which removes the elements
 * not ensured in this pass and puts the rest in order, moving only those out of place (so focus and transitions survive).
 */
export function createKeyedLayer(layer) {
  const keyed = new Map();
  return {
    get: (key) => keyed.get(key),
    entries: () => keyed.entries(),
    begin() {
      const seen = new Set();
      const order = [];
      return {
        ensure(key, create) {
          let node = keyed.get(key);
          if (!node) { node = create(); keyed.set(key, node); }
          seen.add(key);
          order.push(node);
          return node;
        },
        done() {
          for (const [key, node] of keyed) if (!seen.has(key)) { node.remove(); keyed.delete(key); }
          let cursor = null;
          for (const node of order) {
            const expected = cursor ? cursor.nextSibling : layer.firstChild;
            if (node.parentNode !== layer || expected !== node) layer.insertBefore(node, expected);
            cursor = node;
          }
        },
      };
    },
  };
}

/**
 * Paint a selectable box: its place, `is-selected`, and what a screen reader hears. A `pressable` box is a toggle button (`aria-pressed`),
 * a container is a `group`. `tabStop` makes it the one box in the tab order (a roving tab stop).
 */
export function paintSelectable(node, { box, selected, pressable = true, label, tabStop }) {
  node.classList.toggle("is-selected", Boolean(selected));
  node.setAttribute("role", pressable ? "button" : "group");
  if (label !== undefined) node.setAttribute("aria-label", label);
  if (pressable) node.setAttribute("aria-pressed", String(Boolean(selected))); else node.removeAttribute("aria-pressed");
  node.tabIndex = tabStop ? 0 : -1;
  if (box) setBox(node, box);
}

/** The findings badge of a box (the CircleX icon, with the messages as its title); removed when `messages` is empty. */
export function paintBadge(dom, node, messages) {
  const selector = `:scope > .${dom.prefix}-badge`;
  let badge = node.querySelector(selector);
  if (messages.length && !badge) { badge = dom.el("span", `${dom.prefix}-badge`, { "aria-hidden": "true" }); badge.append(dom.icon("CircleX", 14)); node.append(badge); }
  if (badge) { if (messages.length) badge.title = messages.join("\n"); else badge.remove(); }
  return badge?.isConnected ? badge : null;
}

const DIVIDER_ATTRIBUTES = ["aria-label", "aria-valuemin", "aria-valuemax", "aria-valuenow", "aria-valuetext", "title"];
/**
 * Paint a divider between two tracks (`role="separator"`). `orientation` is the line's ("vertical" between columns). A `draggable` divider
 * is focusable when `tabbable`, with `aria-valuenow` (the first track's share in percent) and `aria-valuetext` ("2 : 1"); a fixed one is
 * `aria-disabled`.
 */
export function paintDivider(node, { box, orientation, draggable, tabbable = true, label, valueNow, valueText, title }) {
  node.dataset.orientation = orientation;
  node.dataset.fixed = draggable ? "false" : "true";
  if (box) setBox(node, box);
  node.setAttribute("role", "separator");
  node.setAttribute("aria-orientation", orientation);
  if (draggable) {
    node.tabIndex = tabbable ? 0 : -1;
    node.setAttribute("aria-label", label ?? "Resize");
    node.setAttribute("aria-valuemin", "0");
    node.setAttribute("aria-valuemax", "100");
    node.setAttribute("aria-valuenow", String(valueNow));
    node.setAttribute("aria-valuetext", String(valueText));
    node.removeAttribute("aria-disabled");
    if (title) node.title = title; else node.removeAttribute("title");
  } else {
    node.removeAttribute("tabindex");
    for (const name of DIVIDER_ATTRIBUTES) node.removeAttribute(name);
    node.setAttribute("aria-disabled", "true");
  }
}

/**
 * What a key does on a focused divider whose line is `orientation`: the arrow keys across the line nudge it (`{ type: "nudge", step, big }`,
 * Shift for a big step), Enter equalizes (`{ type: "equalize" }`), anything else (or a modifier) is null.
 */
export function dividerKeyAction(event, orientation) {
  if (event.altKey || event.metaKey || event.ctrlKey) return null;
  const keys = orientation === "vertical" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
  const step = event.key === keys[0] ? -1 : event.key === keys[1] ? 1 : 0;
  if (step) return { type: "nudge", step, big: Boolean(event.shiftKey) };
  if (event.key === "Enter") return { type: "equalize" };
  return null;
}

/** The ratio of two track sizes as a label: "2 : 1". */
export const ratioLabel = (a, b) => `${trim(a)} : ${trim(b)}`;
const trim = (value) => String(Math.round(value * 1000) / 1000);

/**
 * The overlay's own elements inside `host`, in this order: the guide line (when `guide` names its class suffix, e.g. "cut"), the drop line,
 * the ratio badge, and the marker layer (when `markers`). All start hidden and `aria-hidden`.
 */
export function createOverlay(dom, host, { guide = false, markers = false } = {}) {
  const p = dom.prefix;
  const hiddenEl = (name) => { const node = dom.el("div", `${p}-${name}`, { "aria-hidden": "true" }); node.hidden = true; return node; };
  const guideEl = guide ? hiddenEl(guide) : null;
  const drop = hiddenEl("drop");
  const ratio = hiddenEl("ratio");
  const markerEl = markers ? dom.el("div", `${p}-markers`, { "aria-hidden": "true" }) : null;
  host.append(...[guideEl, drop, ratio, markerEl].filter(Boolean));

  return {
    guide: guideEl,
    drop,
    ratio,
    markers: markerEl,
    /** A guide line through the middle of `box`: across a row split it is vertical (axis "row"), else horizontal. */
    showGuide(box, axis) {
      if (!guideEl) return;
      guideEl.hidden = false;
      if (axis === "row") Object.assign(guideEl.style, { left: pct(box.x + box.w / 2), top: pct(box.y), width: "0", height: pct(box.h) });
      else Object.assign(guideEl.style, { left: pct(box.x), top: pct(box.y + box.h / 2), width: pct(box.w), height: "0" });
      guideEl.dataset.axis = axis;
    },
    hideGuide() { if (guideEl) guideEl.hidden = true; },
    /**
     * The drop line along `line` (`{ x, y, w, h }`): a vertical line at its left edge (between items of a row) or a horizontal one at its top.
     * `state` is "ok", "same" (a drop that changes nothing) or "refused", with `reason` as its title.
     */
    showDrop(line, { orientation, state = "ok", reason = "" }) {
      drop.hidden = false;
      drop.dataset.orientation = orientation;
      drop.dataset.state = state;
      drop.title = reason;
      if (orientation === "vertical") Object.assign(drop.style, { left: pct(line.x), top: pct(line.y), width: "0", height: pct(line.h) });
      else Object.assign(drop.style, { left: pct(line.x), top: pct(line.y), width: pct(line.w), height: "0" });
    },
    hideDrop() { drop.hidden = true; },
    /** The ratio badge, centered on a unit point. */
    showRatio(label, at) {
      ratio.hidden = false;
      ratio.textContent = label;
      ratio.style.left = pct(at.x);
      ratio.style.top = pct(at.y);
    },
    hideRatio() { ratio.hidden = true; },
    /** Mark the hovered element in `layer` (`data-hover`), clearing the others; null clears. */
    hover(layer, node) {
      for (const other of layer.querySelectorAll("[data-hover]")) other.removeAttribute("data-hover");
      node?.setAttribute("data-hover", "true");
    },
    /** Mark the container a drop would go into (`data-into`), clearing the others; null clears. */
    into(layer, node) {
      for (const other of layer.querySelectorAll("[data-into]")) other.removeAttribute("data-into");
      node?.setAttribute("data-into", "true");
    },
  };
}
