// Review panel (RR-29): the DOM panel over core's design and accessibility audit. It lists the findings of the
// open presentation (contrast, overflow, alt text, reading order, fonts, links and more), lets the author go to
// the content a finding is about, offers safe quick fixes (type the alt text in place, switch a failing text
// colour to the readable one) and updates as the document changes. The panel owns no document state: every fix
// is an undoable edit through the editor session. Importing this module does not need a DOM; mounting does.
import {
  applyReviewFix,
  auditAvailable,
  countFindings,
  currentAltText,
  filterFindings,
  findingTarget,
  reviewFindings,
  reviewSeverities,
  runAudit,
  setReviewAltText,
} from "./review.js";

const SEVERITY_LABELS = { error: "Error", warning: "Warning", info: "Note" };
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
.opf-review-list{list-style:none;margin:0;padding:0}
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
 * follows), `getAuditOptions(document)` (core's AuditOptions; pass `textMeasurement` from the host's font registry
 * for font-exact overflow), `onGoTo({finding, target})` (select the content: `target` is {slide, path, pointer, exact}),
 * `onFocusField({finding, fix, target})` (focus a field the panel does not own: a title, text, link or language),
 * `onStatus(message, {error})`, `onChange({error, warning, info, total, all, unavailable})` (after every redraw, with the shown counts), `ignored` (rule ids hidden at the start) and `onIgnoredChange(ids)`,
 * `autoRefresh` (default true: re-audit after every session change; a host that must wait for its fonts sets false and
 * calls `refresh()` itself), `audit` (replace core's audit function).
 */
export function createReviewPanel(container, options) {
  const { editor, getSlideIndex, getAuditOptions, onGoTo, onFocusField, onStatus, onIgnoredChange, onChange } = options;
  if (!editor || typeof editor.subscribe !== "function") throw new Error("The Review panel needs an editor session created by createEditorSession.");
  const doc = container.ownerDocument;
  ensureStyles(doc);
  const id = `opf-review-${++panelCounter}`;
  const ignored = new Set(options.ignored ?? []);
  let report;
  let findings = [];
  let destroyed = false;
  let scheduled = false;
  let currentId;
  let editingAlt;
  let altDraft = "";
  let lastAuditError;

  const root = h(doc, "section", { class: "opf-review", "data-opf-component": "review-panel", "aria-labelledby": `${id}-title` });
  const counts = h(doc, "p", { class: "opf-review-counts", id: `${id}-counts`, role: "status", "aria-live": "polite" });
  const title = h(doc, "h2", { id: `${id}-title`, text: "Review", tabindex: "-1" });
  const head = h(doc, "div", { class: "opf-review-head" }, title, counts);
  const severitySelect = h(doc, "select", { id: `${id}-severity` },
    h(doc, "option", { value: "all", text: "All findings" }),
    h(doc, "option", { value: "warnings", text: "Errors and warnings" }),
    h(doc, "option", { value: "errors", text: "Errors only" }));
  const slideOnly = h(doc, "input", { type: "checkbox", id: `${id}-slide` });
  const filters = h(doc, "div", { class: "opf-review-filters" },
    h(doc, "label", { for: `${id}-severity` }, "Show ", severitySelect),
    h(doc, "label", { for: `${id}-slide` }, slideOnly, "This slide only"));
  const list = h(doc, "ul", { class: "opf-review-list", "aria-label": "Review findings" });
  const empty = h(doc, "p", { class: "opf-review-empty" });
  const ignoredBox = h(doc, "details", { class: "opf-review-ignored", hidden: true });
  root.append(head, filters, list, empty, ignoredBox);
  container.append(root);

  const say = (message, error = false) => {
    onStatus?.(message, { error });
  };

  function visible() {
    const minimum = MINIMUMS[severitySelect.value] ?? "info";
    const slide = slideOnly.checked ? (getSlideIndex?.() ?? 0) : undefined;
    return filterFindings(findings, { minimum, slide }).filter((finding) => !ignored.has(finding.ruleId));
  }

  function audit() {
    lastAuditError = undefined;
    try {
      report = runAudit(editor.document, { ...(getAuditOptions?.(editor.document) ?? {}), ...(options.audit ? { audit: options.audit } : {}) });
      findings = reviewFindings(report);
    } catch (error) {
      report = undefined;
      findings = [];
      lastAuditError = error;
    }
  }

  function focusGoto(findingId) {
    const buttons = [...list.querySelectorAll(".opf-review-goto")];
    (buttons.find((button) => button.dataset.findingId === findingId) ?? buttons[0])?.focus();
  }

  function go(finding) {
    currentId = finding.id;
    const target = findingTarget(editor.document, finding);
    for (const item of list.children) item.setAttribute("aria-current", String(item.dataset.findingId === finding.id));
    onGoTo?.({ finding, target });
  }

  function altForm(finding, fix) {
    const pointer = fix.focus.path;
    const inputId = `${id}-alt-${finding.id.replace(/[^a-z0-9]+/gi, "-")}`;
    const input = h(doc, "input", { type: "text", id: inputId, value: altDraft || currentAltText(editor.document, pointer), "aria-describedby": `${inputId}-help` });
    const error = h(doc, "span", { class: "opf-review-error", role: "alert" });
    const form = h(doc, "form", { class: "opf-review-alt", novalidate: true },
      h(doc, "label", { for: inputId, text: "Alt text" }), input,
      h(doc, "button", { type: "submit", class: "opf-review-fix", text: "Save alt text" }),
      h(doc, "button", { type: "button", class: "opf-review-fix quiet", text: "Cancel", onclick: () => closeAlt(finding) }),
      h(doc, "span", { id: `${inputId}-help`, class: "opf-review-meta", text: `${finding.ruleId === "audit/chart-text-alternative" || String(finding.path ?? "").includes("/chart") ? "Describe what the chart shows: its point and the key numbers." : "Describe what the picture shows."} Press Escape to cancel.` }), error);
    input.addEventListener("input", () => { altDraft = input.value; });
    form.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.stopPropagation(); closeAlt(finding); } });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        setReviewAltText(editor, pointer, input.value);
        editingAlt = undefined;
        altDraft = "";
        say("Alt text saved. Undo restores the previous text.");
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
        [...list.children].find((entry) => entry.dataset.findingId === finding.id)?.querySelector(".opf-review-alt input")?.focus();
        return;
      }
      go(finding);
      onFocusField?.({ finding, fix, target: findingTarget(editor.document, finding) });
      return;
    }
    const index = visible().findIndex((entry) => entry.id === finding.id);
    try {
      applyReviewFix(editor, finding, fix);
      say(`${fix.label}. Undo restores the previous state.`);
      // The change re-audits the document (the subscription); put focus on the neighbouring finding.
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
    h(doc, "span", { class: "opf-review-meta", text: `${where} · ${finding.ruleId}` }));
    const li = h(doc, "li", { class: "opf-review-item", "data-finding-id": finding.id, "data-rule": finding.ruleId, "data-severity": finding.severity, "aria-current": String(finding.id === currentId) }, go_,
      h(doc, "p", { class: "opf-review-help", text: finding.help }));
    const actions = h(doc, "div", { class: "opf-review-actions" });
    for (const fix of finding.fixes ?? []) {
      actions.append(h(doc, "button", {
        type: "button",
        class: `opf-review-fix${fix.safe ? "" : " is-careful"}`,
        "data-fix": fix.id,
        title: fix.safe ? undefined : "This changes how the slide looks or what it says; it can be undone.",
        text: fix.label,
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
    list.replaceChildren(...shown.map(item));
    if (lastAuditError) {
      empty.hidden = false;
      empty.textContent = lastAuditError.code === "audit-unavailable" ? lastAuditError.message : `The review could not run: ${messageOf(lastAuditError)}`;
      counts.textContent = "Review unavailable.";
    } else {
      const hiddenCount = findings.length - findings.filter((finding) => !ignored.has(finding.ruleId)).length;
      counts.textContent = summaryText(countFindings(shown), slideScope) + (hiddenCount ? ` ${plural(hiddenCount, "finding")} hidden.` : "");
      empty.hidden = shown.length > 0;
      empty.textContent = findings.length && !shown.length ? "Nothing to show with these filters." : "The audit found nothing to fix. It checks contrast, text fit, alt text, reading order and more; it does not replace looking at the slides.";
    }
    renderIgnored();
    onChange?.({ ...countFindings(shown), all: findings.length, unavailable: Boolean(lastAuditError) });
    // Live updates must not take the keyboard away: put focus back on the same control, or the same finding.
    if (hadFocus?.id && !lastAuditError) {
      const li = [...list.children].find((entry) => entry.dataset.findingId === hadFocus.id);
      const target = (hadFocus.fix ? [...li?.querySelectorAll("[data-fix]") ?? []].find((button) => button.dataset.fix === hadFocus.fix) : hadFocus.tag === "INPUT" ? li?.querySelector("input") : li?.querySelector(".opf-review-goto")) ?? li?.querySelector(".opf-review-goto");
      if (target && doc.activeElement !== target) target.focus();
    }
  }

  function refresh() {
    if (destroyed) return;
    scheduled = false;
    audit();
    renderList();
  }

  const unsubscribe = options.autoRefresh === false ? undefined : editor.subscribe(() => {
    if (scheduled || destroyed) return;
    scheduled = true;
    // One re-audit per burst of edits (an undo group, a paste), after the session has settled.
    Promise.resolve().then(refresh);
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
    /** The latest findings (core's diagnostics with `id`, `slide` and `dottedPath`), before filters and hidden checks. */
    get findings() { return findings; },
    get report() { return report; },
    refresh,
    /** Re-render after the host's slide changed (the "This slide only" filter). */
    update: renderList,
    setIgnored,
    destroy() {
      destroyed = true;
      unsubscribe?.();
      root.remove();
    },
  };
}

export { auditAvailable, reviewSeverities };
