// The one panel that Design (design-menu.js), Find and replace (find-panel.js) and Export (export-menu.js) open in: the same frame (a 44px
// head with the title and Close, a scrolling body, an optional foot line), the same place (under an anchor, its end edge on the anchor's,
// never taller than the room below it) and only one of them open in a document at a time: opening one closes the other in place. On a
// phone (PANEL_SHEET_QUERY) the frame is a bottom sheet with a grabber. Internal, not a package entry; styles in src/styles/panel.css
// (classes `opf-panel-*`).
import { el, icon } from "./export-dom.js";

/** At this width and under, a panel is a bottom sheet (the Design menu's breakpoint). */
export const PANEL_SHEET_QUERY = "(max-width: 600px)";
const MARGIN = 8;

/**
 * The frame: `{ element, head, heading, close, body, foot, note }`. The element is a hidden `role="dialog"` named by its visible title, or by
 * `label` when the title changes (Find). `closeIcon` replaces the X.
 */
export function createPanelFrame(doc, { id, title, label, closeLabel = "Close", closeIcon, className = "" }) {
  const heading = el(doc, "span", { class: "opf-panel-title", id: `${id}-title`, text: title });
  const close = el(doc, "button", { type: "button", class: "opf-panel-close", "aria-label": closeLabel }, closeIcon ?? icon(doc, "X", 16));
  const head = el(doc, "div", { class: "opf-panel-head" }, heading, close);
  const body = el(doc, "div", { class: "opf-panel-body" });
  const note = el(doc, "span", { class: "opf-panel-note" });
  const foot = el(doc, "div", { class: "opf-panel-foot", hidden: true }, note);
  const element = el(doc, "div", { class: `opf-panel ${className}`.trim(), role: "dialog", id, "aria-label": label, "aria-labelledby": label ? undefined : heading.id, "data-mode": "popover", hidden: true },
    el(doc, "div", { class: "opf-panel-grab", "aria-hidden": "true" }), head, body, foot);
  return { element, head, heading, close, body, foot, note };
}

/** A section label: 11px mono capitals over a list. */
export const panelLabel = (doc, text, props = {}) => el(doc, "div", { ...props, class: `opf-panel-label ${props.class ?? ""}`.trim(), text });

/** An element is on screen when it has a box and is not `visibility: hidden`. */
export const shown = (node) => Boolean(node?.isConnected && node.getClientRects().length && node.ownerDocument.defaultView.getComputedStyle(node).visibility !== "hidden");

/**
 * Lay out an open panel. As a sheet the CSS places it (fixed to the bottom). Otherwise it opens under `anchor`: a button is measured to its
 * border, a bar to its content edge, so the panel lines up with the bar's last control; the panel's end edge is on that edge, inside the
 * viewport, and the panel is at most as tall as the room under the anchor (above it, when that room is larger and the panel does not fit
 * below). The body scrolls; the head and the foot stay.
 */
export function placePanel(panel, anchor, sheet) {
  const { style } = panel;
  panel.dataset.mode = sheet ? "sheet" : "popover";
  for (const property of ["left", "top", "max-height"]) style.removeProperty(property);
  if (sheet || !anchor) return;
  const win = panel.ownerDocument.defaultView;
  const box = anchor.getBoundingClientRect();
  const css = win.getComputedStyle(anchor);
  const rtl = css.direction === "rtl";
  const bar = anchor.localName !== "button";
  const inset = bar ? Number.parseFloat(rtl ? css.paddingLeft : css.paddingRight) + Number.parseFloat(rtl ? css.borderLeftWidth : css.borderRightWidth) || 0 : 0;
  const gap = bar ? 8 : 4;
  const width = panel.offsetWidth;
  const natural = panel.offsetHeight;
  const below = win.innerHeight - box.bottom - gap - MARGIN;
  const above = box.top - gap - MARGIN;
  const flip = natural > below && above > below;
  const room = Math.max(120, Math.min(flip ? above : below, win.innerHeight - 2 * MARGIN));
  const height = Math.min(natural, room);
  const edge = rtl ? box.left + inset : box.right - inset;
  const left = Math.max(MARGIN, Math.min(rtl ? edge : edge - width, win.innerWidth - width - MARGIN));
  style.left = `${left}px`;
  style.top = `${flip ? box.top - gap - height : box.bottom + gap}px`;
  if (natural > room) style.maxHeight = `${room}px`;
}

/**
 * Tab inside an open panel: the next or previous control that takes the focus. With `wrap` (a sheet) it goes round; otherwise Tab from the
 * last control (Shift+Tab from the first) returns false and the caller lets the focus leave, closing the panel.
 */
export function tabWithin(panel, event, wrap) {
  const stops = [...panel.querySelectorAll("button, input, [tabindex]")].filter((node) => node.tabIndex >= 0 && !node.disabled && node.getClientRects().length);
  const at = stops.indexOf(panel.ownerDocument.activeElement);
  const next = at + (event.shiftKey ? -1 : 1);
  if (!stops.length || (!wrap && (next < 0 || next >= stops.length))) return false;
  event.preventDefault();
  stops[(next + stops.length) % stops.length].focus();
  return true;
}

const owners = new WeakMap();
/** Opening a panel closes the one that is open in the same document (`close` closes this one without moving the focus). */
export function claimPanel(doc, close) {
  const open = owners.get(doc);
  owners.set(doc, close);
  if (open && open !== close) open();
}
export function releasePanel(doc, close) {
  if (owners.get(doc) === close) owners.delete(doc);
}
