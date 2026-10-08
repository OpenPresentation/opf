// Review panel (RR-29, RR-55): the DOM panel over core's `validate` report and, optionally, a hosted reviewer. It lists the findings
// of the open presentation by category (format, references, policy, accessibility, layout, content, and any category a hosted
// reviewer adds), lets the author go to the content a finding is about, offers quick fixes (type the alt text in place, switch a
// failing text colour to the readable one) and updates as the document changes. The full check runs after the document has been
// quiet for a moment, not on every keystroke (the session itself checks only the `format` category per edit). The panel owns no
// document state: every fix is an undoable edit through the editor session. Importing this module does not need a DOM;
// mounting does.
import { validate } from "@openpresentation/opf";
import { mergeCatalogs } from "./catalogs.js";
import {
  applyReviewFix,
  countFindings,
  currentAltText,
  filterFindings,
  findingTarget,
  CORE_SOURCE,
  groupFindings,
  mergeFindingReports,
  reviewFindings,
  reviewSeverities,
  setReviewAltText,
} from "./review.js";

const SEVERITY_LABELS = { error: "Error", warning: "Warning", info: "Note" };
const CATEGORY_LABELS = { format: "Format", references: "References", policy: "Policy", accessibility: "Accessibility", layout: "Layout", content: "Content" };
const categoryLabel = (category) => CATEGORY_LABELS[category] ?? (category.charAt(0).toUpperCase() + category.slice(1));
const DEFAULT_DELAY = 300;
const MINIMUMS = { all: "info", warnings: "warning", errors: "error" };
let panelCounter = 0;

function h(doc, tag, attributes = {}, ...children) {
  const element = doc.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue;
    if (key === "class") element.className = value;
    else if (key === "text") element.textContent = value;
    else if (key.startsWith("on")) element.addEventListener(key.slice(2), value);
    else element.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children) if (child) element.append(child);
  return element;
}

const STYLE = `
.opf-review{display:block;font-size:12px}
.opf-review-head{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;margin:0 0 8px}
.opf-review-head h2{margin:0;font-size:13px}
.opf-review-counts{margin:0;color:var(--muted,#656570)}
.opf-review-filters{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin:0 0 8px}
.opf-review-filters label{display:inline-flex;gap:6px;align-items:center;margin:0;font-weight:400}
.opf-review-list{margin:0;padding:0}
.opf-review-category{margin:0 0 8px}
.opf-review-category-title{margin:10px 0 2px;font-size:12px;font-weight:600;color:var(--muted,#656570)}
.opf-review-items{list-style:none;margin:0;padding:0}
.opf-review-item{border-top:1px solid var(--border,#e8e8ec);padding:8px 0}
.opf-review-item[aria-current="true"]{background:var(--review-current,rgba(101,89,207,.07))}
.opf-review-goto{display:block;width:100%;box-sizing:border-box;white-space:normal;overflow-wrap:anywhere;line-height:1.45;text-align:left;background:none;border:0;padding:2px 4px;font:inherit;color:inherit;cursor:pointer;border-radius:4px}
.opf-review-goto:hover{background:rgba(0,0,0,.04)}
.opf-review-goto:focus-visible,.opf-review-fix:focus-visible,.opf-review-alt input:focus-visible{outline:2px solid #6559cf;outline-offset:1px}
.opf-review-sev{display:inline-block;min-width:5.2em;margin-right:6px;padding:0 6px;border:1px solid currentColor;border-radius:9px;font-size:11px;font-weight:600;text-align:center}
.opf-review-item[data-severity="error"] .opf-review-sev{color:#b3261e}
.opf-review-item[data-severity="warning"] .opf-review-sev{color:#8a5a00}
.opf-review-item[data-severity="info"] .opf-review-sev{color:#44556a}
.opf-review-meta{display:block;margin-top:2px;color:var(--muted,#656570);font-size:11px}
.opf-review-help{margin:4px 4px 6px;color:var(--muted,#656570)}
.opf-review-actions{display:flex;flex-wrap:wrap;gap:6px;margin:0 4px}
.opf-review-fix{font:inherit;padding:3px 8px;border:1px solid var(--border,#d4d4da);border-radius:5px;background:#fff;cursor:pointer}
.opf-review-fix.is-careful{border-style:dashed}
.opf-review-fix.quiet{border-color:transparent;background:none;color:var(--muted,#656570);text-decoration:underline}
.opf-review-alt{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 4px 0}
.opf-review-alt label{flex:1 0 100%;font-weight:600}
.opf-review-alt input{flex:1 1 12em;min-width:0;font:inherit;padding:4px 6px}
.opf-review-empty{margin:8px 0;color:var(--muted,#656570)}
.opf-review-ignored{margin-top:8px}
.opf-review-ignored li{display:flex;gap:8px;align-items:center;margin:4px 0}
.opf-review-error{color:#b3261e}
`;

function ensureStyles(doc) {
  if (doc.querySelector("style[data-opf-review]")) return;
  const style = doc.createElement("style");
  style.setAttribute("data-opf-review", "");
  style.textContent = STYLE;
  (doc.head ?? doc.documentElement).append(style);
}

const plural = (count, noun) => `${count} ${noun}${count === 1 ? "" : "s"}`;
const messageOf = (error) => error?.issues?.[0]?.message ?? error?.message ?? String(error);

function summaryText(counts, scopeLabel) {
  if (!counts.total) return `No findings${scopeLabel}.`;
  const parts = [];
  if (counts.error) parts.push(plural(counts.error, "error"));
  if (counts.warning) parts.push(plural(counts.warning, "warning"));
  if (counts.info) parts.push(plural(counts.info, "note"));
  return `${plural(counts.total, "finding")}${scopeLabel}: ${parts.join(", ")}.`;
}

/**
 * Mount the Review panel. Options: `editor` (a session), `getSlideIndex()` (the slide the "This slide only" filter
 * follows), `getValidateOptions(presentation)` (core's `ValidateOptions`: `fonts` with the host's `textMeasurement` for font-exact
 * overflow, `severity`, `ignore`, `thresholds`, `contracts`, ...), `onGoTo({finding, target})` (select the content: `target` is
 * {slide, path, pointer, exact}), `onFocusField({finding, fix, target})` (focus a field the panel does not own: a title, text, link or
 * language), `onStatus(message, {error})`, `onChange({error, warning, info, total, all, sources, unavailable})` (after every redraw, with
 * the shown counts), `ignored` (rule ids hidden at the start) and `onIgnoredChange(ids)`.
 *
 * The full `validate(presentation)` runs once the document has been quiet for `delay` milliseconds (default 300) after a session change,
 * and at once on mount and on `refresh()`. `autoRefresh` (default true) turns the re-check after changes off for a host that must wait
 * for its fonts; it then calls `refresh()` itself.
 *
 * `review(presentation, { signal, report, validateOptions })` is an optional hook that returns a `FindingReport` from a hosted reviewer
 * (pptx.dev's review). Its findings join core's in the same list, kept per `Finding.source`; a finding with no source is listed under
 * `review`. The hook can cost money and take seconds, so it runs when the author presses its button (`reviewLabel`, default "Run
 * review") or, with `autoReview: true`, after every re-check; findings from an earlier run stay listed, marked as possibly out of date,
 * until the next run. A failing hook shows its message and leaves core's findings in place.
 */
export function createReviewPanel(container, options) {
  const { editor, getSlideIndex, getValidateOptions, onGoTo, onFocusField, onStatus, onIgnoredChange, onChange, review } = options;
  // Core resolves the deck's references with the session's registered catalogs (and any the host adds): the same list as the preview.
  const validateOptions = () => {
    const host = getValidateOptions?.(editor.presentation) ?? {};
    return { ...host, catalogs: mergeCatalogs(editor.catalogs, host.catalogs) };
  };
  if (review !== undefined && typeof review !== "function") throw new TypeError("The Review panel's review hook must be a function (presentation, options) returning a FindingReport.");
  if (!editor || typeof editor.subscribe !== "function") throw new Error("The Review panel needs an editor session created by createEditorSession.");
  const doc = container.ownerDocument;
  ensureStyles(doc);
  const id = `opf-review-${++panelCounter}`;
  const ignored = new Set(options.ignored ?? []);
  let report;
  let coreReport;
  let hookReport;
  let hookStale = false;
  let hookError;
  let hookRunning;
  let findings = [];
  let destroyed = false;
  let timer;
  let currentId;
  let editingAlt;
  let altDraft = "";
  let lastAuditError;
  const delay = Number.isFinite(options.delay) && options.delay >= 0 ? options.delay : DEFAULT_DELAY;

  const root = h(doc, "section", { class: "opf-review", "data-opf-component": "review-panel", "aria-labelledby": `${id}-title` });
  const counts = h(doc, "p", { class: "opf-review-counts", id: `${id}-counts`, role: "status", "aria-live": "polite" });
  const title = h(doc, "h2", { id: `${id}-title`, text: "Review", tabindex: "-1" });
  const hookButton = review ? h(doc, "button", { type: "button", class: "opf-review-fix", "data-action": "run-review", text: options.reviewLabel ?? "Run review", onclick: () => { void runHook(); } }) : undefined;
  const hookStatus = review ? h(doc, "p", { class: "opf-review-meta", role: "status", "aria-live": "polite" }) : undefined;
  const head = h(doc, "div", { class: "opf-review-head" }, title, counts, hookButton);
  const severitySelect = h(doc, "select", { id: `${id}-severity` },
    h(doc, "option", { value: "all", text: "All findings" }),
    h(doc, "option", { value: "warnings", text: "Errors and warnings" }),
    h(doc, "option", { value: "errors", text: "Errors only" }));
  const slideOnly = h(doc, "input", { type: "checkbox", id: `${id}-slide` });
  const filters = h(doc, "div", { class: "opf-review-filters" },
    h(doc, "label", { for: `${id}-severity` }, "Show ", severitySelect),
    h(doc, "label", { for: `${id}-slide` }, slideOnly, "This slide only"));
  const list = h(doc, "div", { class: "opf-review-list", role: "group", "aria-label": "Review findings" });
  const empty = h(doc, "p", { class: "opf-review-empty" });
  const ignoredBox = h(doc, "details", { class: "opf-review-ignored", hidden: true });
  root.append(head, ...(hookStatus ? [hookStatus] : []), filters, list, empty, ignoredBox);
  container.append(root);

  const say = (message, error = false) => {
    onStatus?.(message, { error });
  };

  function visible() {
    const minimum = MINIMUMS[severitySelect.value] ?? "info";
    const slide = slideOnly.checked ? (getSlideIndex?.() ?? 0) : undefined;
    const shown = filterFindings(findings, { minimum, slide }).filter((finding) => !ignored.has(finding.ruleId));
    return groupFindings(shown).flatMap((group) => group.findings);
  }

  // Core's full check, then the hook's findings merged in by source.
  function validateNow() {
    lastAuditError = undefined;
    try {
      coreReport = validate(editor.presentation, validateOptions());
    } catch (error) {
      coreReport = undefined;
      lastAuditError = error;
    }
    merge();
  }

  function merge() {
    report = coreReport || hookReport ? mergeFindingReports(coreReport, hookReport) : undefined;
    findings = reviewFindings(report);
  }

  function hookMessage() {
    if (!review) return "";
    if (hookRunning) return "Running the hosted review…";
    if (hookError) return `The hosted review could not run: ${messageOf(hookError)}`;
    if (hookReport && hookStale) return "Hosted review findings are from before your latest edit.";
    if (hookReport) return "Hosted review is up to date.";
    return "";
  }

  // The hosted reviewer: one run at a time; a document change while it runs drops its result (the next run starts from the new text).
  async function runHook() {
    if (!review || destroyed) return;
    hookRunning?.controller.abort();
    const controller = new AbortController();
    const running = { controller };
    hookRunning = running;
    hookError = undefined;
    if (!coreReport && !lastAuditError) validateNow();
    renderList();
    try {
      const result = await review(editor.presentation, { signal: controller.signal, report: coreReport, validateOptions: validateOptions() });
      if (destroyed || hookRunning !== running) return;
      if (!result || !Array.isArray(result.findings)) throw new TypeError("The review hook must resolve a FindingReport ({ valid, findings, counts }).");
      hookRunning = undefined;
      hookReport = result;
      hookStale = false;
      merge();
    } catch (error) {
      if (destroyed || hookRunning !== running) return;
      hookRunning = undefined;
      hookError = error;
    }
    renderList();
  }

  const itemFor = (findingId) => [...list.querySelectorAll(".opf-review-item")].find((entry) => entry.dataset.findingId === findingId);

  function focusGoto(findingId) {
    const buttons = [...list.querySelectorAll(".opf-review-goto")];
    (buttons.find((button) => button.dataset.findingId === findingId) ?? buttons[0])?.focus();
  }

  function go(finding) {
    currentId = finding.id;
    const target = findingTarget(editor.presentation, finding);
    for (const entry of list.querySelectorAll(".opf-review-item")) entry.setAttribute("aria-current", String(entry.dataset.findingId === finding.id));
    onGoTo?.({ finding, target });
  }

  function altForm(finding, fix) {
    const pointer = fix.focus.path;
    const inputId = `${id}-alt-${finding.id.replace(/[^a-z0-9]+/gi, "-")}`;
    const input = h(doc, "input", { type: "text", id: inputId, value: altDraft || currentAltText(editor.presentation, pointer), "aria-describedby": `${inputId}-help` });
    const error = h(doc, "span", { class: "opf-review-error", role: "alert" });
    const form = h(doc, "form", { class: "opf-review-alt", novalidate: true },
      h(doc, "label", { for: inputId, text: "Alt text" }), input,
      h(doc, "button", { type: "submit", class: "opf-review-fix", text: "Save alt text" }),
      h(doc, "button", { type: "button", class: "opf-review-fix quiet", text: "Cancel", onclick: () => closeAlt(finding) }),
      h(doc, "span", { id: `${inputId}-help`, class: "opf-review-meta", text: `${finding.ruleId === "opf/chart-text-alternative" || String(finding.path ?? "").includes("/chart") ? "Describe what the chart shows: its point and the key numbers." : "Describe what the picture shows."} Press Escape to cancel.` }), error);
    input.addEventListener("input", () => { altDraft = input.value; });
    form.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.stopPropagation(); closeAlt(finding); } });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        setReviewAltText(editor, pointer, input.value);
        editingAlt = undefined;
        altDraft = "";
        say("Alt text saved. Undo restores the previous text.");
        refresh();
      } catch (problem) {
        error.textContent = messageOf(problem);
        say(messageOf(problem), true);
        input.focus();
      }
    });
    return form;
  }

  function closeAlt(finding) {
    editingAlt = undefined;
    altDraft = "";
    renderList();
    focusGoto(finding.id);
  }

  function runFix(finding, fix) {
    if (fix.kind === "focus") {
      if (fix.focus?.field === "alt") {
        editingAlt = finding.id;
        altDraft = "";
        renderList();
        itemFor(finding.id)?.querySelector(".opf-review-alt input")?.focus();
        return;
      }
      go(finding);
      onFocusField?.({ finding, fix, target: findingTarget(editor.presentation, finding) });
      return;
    }
    const index = visible().findIndex((entry) => entry.id === finding.id);
    try {
      applyReviewFix(editor, finding, fix);
      say(`${fix.title}. Undo restores the previous state.`);
      // Check the changed document at once, then put focus on the neighbouring finding.
      refresh();
      const after = visible();
      const next = after[Math.min(Math.max(index, 0), after.length - 1)];
      if (next) focusGoto(next.id);
      else title.focus();
    } catch (error) {
      say(messageOf(error), true);
      if (error?.code === "stale-finding") refresh();
    }
  }

  function item(finding) {
    const where = finding.slide === null ? "Presentation" : `Slide ${finding.slide + 1}`;
    const go_ = h(doc, "button", {
      type: "button",
      class: "opf-review-goto",
      "data-finding-id": finding.id,
      "aria-label": `${SEVERITY_LABELS[finding.severity]}, ${where}: ${finding.message} Go to it.`,
      onclick: () => go(finding),
    },
    h(doc, "span", { class: "opf-review-sev", text: SEVERITY_LABELS[finding.severity] }),
    h(doc, "span", { class: "opf-review-msg", text: finding.message }),
    h(doc, "span", { class: "opf-review-meta", text: `${where} · ${finding.ruleId}${finding.source && finding.source !== CORE_SOURCE ? ` · ${finding.source}` : ""}` }));
    const li = h(doc, "li", { class: "opf-review-item", "data-finding-id": finding.id, "data-rule": finding.ruleId, "data-source": finding.source ?? CORE_SOURCE, "data-severity": finding.severity, "aria-current": String(finding.id === currentId) }, go_,
      finding.help ? h(doc, "p", { class: "opf-review-help", text: finding.help }) : undefined);
    const actions = h(doc, "div", { class: "opf-review-actions" });
    for (const fix of finding.fixes ?? []) {
      actions.append(h(doc, "button", {
        type: "button",
        class: `opf-review-fix${fix.safe ? "" : " is-careful"}`,
        "data-fix": fix.id ?? fix.title,
        title: fix.safe ? undefined : "This changes how the slide looks or what it says; it can be undone.",
        text: fix.title,
        onclick: () => runFix(finding, fix),
      }));
    }
    actions.append(h(doc, "button", {
      type: "button",
      class: "opf-review-fix quiet",
      "data-action": "ignore-rule",
      text: "Hide this check",
      title: `Stop listing ${finding.ruleId} findings in this panel`,
      onclick: () => setIgnored(finding.ruleId, true),
    }));
    li.append(actions);
    if (editingAlt === finding.id) {
      const fix = (finding.fixes ?? []).find((entry) => entry.kind === "focus" && entry.focus?.field === "alt");
      if (fix) li.append(altForm(finding, fix));
    }
    return li;
  }

  function setIgnored(ruleId, hidden) {
    if (hidden) ignored.add(ruleId);
    else ignored.delete(ruleId);
    onIgnoredChange?.([...ignored]);
    say(hidden ? `Hiding ${ruleId} findings.` : `Showing ${ruleId} findings again.`);
    renderList();
  }

  function renderIgnored() {
    ignoredBox.hidden = ignored.size === 0;
    if (!ignored.size) { ignoredBox.replaceChildren(); return; }
    ignoredBox.replaceChildren(
      h(doc, "summary", { text: `Hidden checks (${ignored.size})` }),
      h(doc, "ul", { class: "opf-review-ignored-list", style: "list-style:none;padding:0" }, ...[...ignored].map((ruleId) => h(doc, "li", {}, h(doc, "span", { text: ruleId }),
        h(doc, "button", { type: "button", class: "opf-review-fix quiet", "data-restore": ruleId, text: "Show again", "aria-label": `Show ${ruleId} findings again`, onclick: () => setIgnored(ruleId, false) })))),
    );
  }

  function renderList() {
    if (destroyed) return;
    const hadFocus = doc.activeElement && list.contains(doc.activeElement) ? { id: doc.activeElement.closest("[data-finding-id]")?.dataset.findingId, fix: doc.activeElement.dataset.fix, tag: doc.activeElement.tagName } : undefined;
    const shown = visible();
    const slideScope = slideOnly.checked ? ` on slide ${(getSlideIndex?.() ?? 0) + 1}` : "";
    list.replaceChildren(...groupFindings(shown).map(({ category, findings: inGroup }) => {
      const heading = h(doc, "h3", { class: "opf-review-category-title", id: `${id}-cat-${category}`, text: `${categoryLabel(category)} (${inGroup.length})` });
      return h(doc, "section", { class: "opf-review-category", "data-category": category, "aria-labelledby": heading.id }, heading, h(doc, "ul", { class: "opf-review-items" }, ...inGroup.map(item)));
    }));
    if (hookStatus) {
      hookStatus.textContent = hookMessage();
      hookButton.disabled = Boolean(hookRunning);
      hookButton.textContent = hookReport ? `${options.reviewLabel ?? "Run review"} again` : options.reviewLabel ?? "Run review";
    }
    if (lastAuditError) {
      empty.hidden = false;
      empty.textContent = `The review could not run: ${messageOf(lastAuditError)}`;
      counts.textContent = "Review unavailable.";
    } else {
      const hiddenCount = findings.length - findings.filter((finding) => !ignored.has(finding.ruleId)).length;
      counts.textContent = summaryText(countFindings(shown), slideScope) + (hiddenCount ? ` ${plural(hiddenCount, "finding")} hidden.` : "");
      empty.hidden = shown.length > 0;
      empty.textContent = findings.length && !shown.length ? "Nothing to show with these filters." : "Nothing to fix. The checks cover the format, references, contrast, text fit, alt text, reading order and more; they do not replace looking at the slides.";
    }
    renderIgnored();
    onChange?.({ ...countFindings(shown), all: findings.length, sources: report?.sources ?? [], unavailable: Boolean(lastAuditError) });
    // Live updates must not take the keyboard away: put focus back on the same control, or the same finding.
    if (hadFocus?.id && !lastAuditError) {
      const li = itemFor(hadFocus.id);
      const target = (hadFocus.fix ? [...li?.querySelectorAll("[data-fix]") ?? []].find((button) => button.dataset.fix === hadFocus.fix) : hadFocus.tag === "INPUT" ? li?.querySelector("input") : li?.querySelector(".opf-review-goto")) ?? li?.querySelector(".opf-review-goto");
      if (target && doc.activeElement !== target) target.focus();
    }
  }

  function refresh() {
    if (destroyed) return;
    clearTimeout(timer);
    timer = undefined;
    validateNow();
    renderList();
    if (options.autoReview && review) void runHook();
  }

  // One full check per burst of changes (typing, an undo group, a paste): when nothing has changed for `delay` milliseconds.
  function schedule() {
    if (destroyed) return;
    clearTimeout(timer);
    timer = setTimeout(refresh, delay);
  }

  // A change while the hosted review runs drops its result (it was about the old text); one that comes after marks it out of date.
  const stop = editor.subscribe(() => {
    if (destroyed) return;
    if (hookRunning) { hookRunning.controller.abort(); hookRunning = undefined; }
    if (hookReport) hookStale = true;
    if (options.autoRefresh === false) { renderList(); return; }
    schedule();
  });

  severitySelect.addEventListener("change", renderList);
  slideOnly.addEventListener("change", renderList);
  list.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const target = event.target;
    if (!target?.classList?.contains("opf-review-goto")) return;
    const buttons = [...list.querySelectorAll(".opf-review-goto")];
    const at = buttons.indexOf(target);
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, at + (event.key === "ArrowDown" ? 1 : -1)));
    event.preventDefault();
    buttons[next]?.focus();
  });

  refresh();

  return {
    element: root,
    /** The latest findings (core's, and the hosted reviewer's, with `id`, `slide` and `dottedPath`), before filters and hidden checks. */
    get findings() { return findings; },
    /** The merged report: `valid`, `findings`, `counts` and `sources`. */
    get report() { return report; },
    /** Core's `validate` report alone. */
    get validation() { return coreReport; },
    refresh,
    /** Check after `delay` milliseconds without another call: a host that drives its own checks (`autoRefresh: false`) calls this after each redraw. */
    schedule,
    /** Run the hosted reviewer now (the `review` hook); resolves when its findings are listed. */
    review: runHook,
    /** Re-render after the host's slide changed (the "This slide only" filter). */
    update: renderList,
    setIgnored,
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      hookRunning?.controller.abort();
      stop();
      root.remove();
    },
  };
}

export { reviewSeverities };
