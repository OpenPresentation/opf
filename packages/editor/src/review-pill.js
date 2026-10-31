// CE-29, the review pill: the toolbar's `review` item. One compact status button that says how the deck checks out ("Valid", "3 issues", "Checking…")
// and opens the Review panel when pressed. It owns no findings: the host feeds it the counts that the workspace's `review` event carries
// (`{ error, warning, info, total, all, sources, unavailable }`) through `update(counts)`. Not color alone: every state has a glyph and words.
// Plain DOM, no framework, no network. Icons are Lucide paths (ISC license), inlined.
const SVG_NS = "http://www.w3.org/2000/svg";

// Each glyph is a list of [tag, attributes]. "valid" is a filled success dot (the words carry the meaning), "checking" a ring.
const GLYPHS = {
  error: [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "m15 9-6 6" }], ["path", { d: "m9 9 6 6" }]],
  warning: [["path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" }], ["path", { d: "M12 9v4" }], ["path", { d: "M12 17h.01" }]],
  info: [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M12 16v-4" }], ["path", { d: "M12 8h.01" }]],
  valid: [["circle", { cx: 12, cy: 12, r: 5, fill: "currentColor", stroke: "none" }]],
  checking: [["circle", { cx: 12, cy: 12, r: 8, "stroke-dasharray": "3 3" }]],
  unavailable: [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M8 12h8" }]],
};

const count = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Math.trunc(Number(value)) : 0);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const DEFAULT_LABELS = {
  /** The visible text before the first `update()`. */
  checking: "Checking…",
  /** The visible text when the deck has no findings. */
  valid: "Valid",
  /** The visible text when the review could not run. */
  unavailable: "Review unavailable",
  /** The visible text with findings, for example "3 issues". */
  issues: (total) => plural(total, "issue", "issues"),
  /** One severity in the accessible name, for example "2 errors". */
  error: (n) => plural(n, "error", "errors"),
  warning: (n) => plural(n, "warning", "warnings"),
  info: (n) => plural(n, "note", "notes"),
  /** The accessible name of the button, from the state: "Review: Valid", "Review: 3 issues (2 errors, 1 warning)". `view` is what `describeReview` returns. */
  name: ({ state, text, parts }) => (state === "issues" ? `Review: ${text} (${parts.join(", ")})` : state === "unavailable" ? text : `Review: ${text}`),
  /** The overflow menu item: "Review" while there is nothing to count, "Review (3)" with findings. */
  menu: (total) => (total > 0 ? `Review (${total})` : "Review"),
};

function glyph(doc, name) {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "opf-review-pill-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  for (const [tag, attributes] of GLYPHS[name]) {
    const node = doc.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    svg.append(node);
  }
  return svg;
}

/**
 * What the pill shows for a `review` event payload, without a DOM: `{ state, severity, total, text, parts }`.
 * `state` is `"checking"` (no counts yet), `"unavailable"`, `"valid"` (`total` is 0) or `"issues"`; `severity` is the most severe level present
 * (`"error"`, `"warning"` or `"info"`, else null); `parts` lists the non-zero severities for the accessible name.
 */
export function describeReview(counts, labels = DEFAULT_LABELS) {
  const l = { ...DEFAULT_LABELS, ...labels };
  if (!counts) return { state: "checking", severity: null, total: 0, text: l.checking, parts: [] };
  const error = count(counts.error), warning = count(counts.warning), info = count(counts.info);
  const total = count(counts.total);
  if (counts.unavailable) return { state: "unavailable", severity: null, total, text: l.unavailable, parts: [] };
  if (total === 0) return { state: "valid", severity: null, total: 0, text: l.valid, parts: [] };
  const severity = error ? "error" : warning ? "warning" : info ? "info" : null;
  const parts = [error && l.error(error), warning && l.warning(warning), info && l.info(info)].filter(Boolean);
  return { state: "issues", severity, total, text: l.issues(total), parts };
}

/**
 * Mount the review pill into `container`.
 *
 * Options: `onOpen()` (called when the pill is pressed or its menu item runs; the workspace opens the Review panel), `density` (`"comfortable"` or
 * `"touch"`), `labels` (every string; see `ReviewPillLabels`).
 *
 * Returns `{ element, update(counts), setDensity(density), setDisabled(disabled), menuItems(), destroy() }`.
 *
 * States: before the first `update()` it reads "Checking…". `update(counts)` with `total` 0 reads "Valid" with a success dot; with findings it reads
 * "N issues" with the glyph and color of the most severe level. When `counts.unavailable` is true (the review could not run) the pill stays visible,
 * muted and disabled, and reads "Review unavailable": hiding it would make a broken check look like a clean deck. The accessible name carries the
 * counts, for example "Review: 3 issues (2 errors, 1 warning)".
 */
export function createReviewPill(container, options = {}) {
  if (!container?.ownerDocument) throw new TypeError("A DOM container is required.");
  const doc = container.ownerDocument;
  const labels = { ...DEFAULT_LABELS, ...(options.labels ?? {}) };
  let density = options.density === "touch" ? "touch" : "comfortable";
  let disabled = false;
  let destroyed = false;
  let view = describeReview(null, labels);

  const element = doc.createElement("button");
  element.type = "button";
  element.className = "opf-review-pill";
  element.dataset.density = density;
  const text = doc.createElement("span");
  text.className = "opf-review-pill-text";
  let icon = null;

  const blocked = () => disabled || view.state === "unavailable";
  function draw() {
    element.dataset.state = view.state;
    if (view.severity) element.dataset.severity = view.severity; else delete element.dataset.severity;
    const next = glyph(doc, view.state === "issues" ? view.severity ?? "info" : view.state);
    if (icon) icon.replaceWith(next); else element.prepend(next);
    icon = next;
    text.textContent = view.text;
    element.setAttribute("aria-label", labels.name(view));
    element.disabled = blocked();
  }
  element.append(text);
  draw();
  container.append(element);

  const open = () => { if (!destroyed && !blocked()) options.onOpen?.(); };
  element.addEventListener("click", open);

  return {
    element,
    /** Show the counts of a `review` event. Without counts (null or undefined) the pill goes back to "Checking…". */
    update(counts) {
      if (destroyed) return;
      view = describeReview(counts, labels);
      draw();
    },
    setDensity(next) {
      density = next === "touch" ? "touch" : "comfortable";
      element.dataset.density = density;
    },
    setDisabled(next) {
      disabled = Boolean(next);
      element.disabled = blocked();
    },
    menuItems() {
      return [{ id: "review", label: labels.menu(view.total), disabled: blocked(), run: open }];
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      element.removeEventListener("click", open);
      element.remove();
    },
  };
}
