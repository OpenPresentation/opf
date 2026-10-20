// RR-98: the agent handoff dialog. A modal that shows the prompt `buildAgentHandoff` writes for a coding agent, with a target switch
// (PowerPoint, PDF or SVG), the prompt read-only in mono with its line count, Copy prompt ("Copied" for 1.2 seconds) and Close.
// Plain DOM, no framework, no network: the prompt never leaves the page until the author pastes it. Styles: src/styles/handoff.css.
import { HANDOFF_TARGETS, buildAgentHandoff } from "./agent-handoff.js";
import { el, icon, saveBlob } from "./export-dom.js";

const COPIED_MS = 1200;
const FOCUSABLE = 'button:not([disabled]), textarea, [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const FILE_NAME = "deck-handoff.md";
let counter = 0;

/**
 * Open the dialog in `container` (a host element, usually `document.body`). Options: `document` (the OPF deck the prompt embeds), `target`
 * (`"pptx"` default, `"pdf"` or `"svg"`), `fileName`, `specUrl`, `agentGuideUrl` (all for `buildAgentHandoff`), `density`
 * (`"comfortable"` or `"touch"`), `onClose`, `onDownload({ blob, fileName, format: "handoff" })` for "Download .md" (default: a Blob link),
 * `onTargetChange(target)` and `returnFocus` (the element that gets focus back on close; default: the one focused when it opened).
 * Returns `{ element, getPrompt(), setTarget(), setDocument(), copy(), close(), destroy() }`.
 */
export function createAgentHandoffDialog(container, options = {}) {
  const doc = container.ownerDocument ?? document;
  const id = `opf-handoff-${++counter}`;
  const opener = options.returnFocus ?? doc.activeElement;
  let target = options.target in HANDOFF_TARGETS ? options.target : "pptx";
  let deck = options.document;
  let copiedTimer, liveTimer, destroyed = false;
  let handoff;

  const closeButton = el(doc, "button", { type: "button", class: "opf-handoff-x", "aria-label": "Close" }, icon(doc, "X", 16));
  const radios = Object.entries(HANDOFF_TARGETS).map(([key, spec]) => el(doc, "button", { type: "button", role: "radio", class: "opf-handoff-target", "data-target": key, text: spec.label }));
  const group = el(doc, "div", { class: "opf-handoff-segments", role: "radiogroup", "aria-labelledby": `${id}-render` }, ...radios);
  const count = el(doc, "span", { class: "opf-handoff-count" });
  const prompt = el(doc, "textarea", { class: "opf-handoff-prompt", readonly: true, spellcheck: "false", wrap: "soft", "aria-label": "Prompt for a coding agent", "aria-describedby": `${id}-count` });
  count.id = `${id}-count`;
  const live = el(doc, "div", { class: "opf-handoff-live", role: "status", "aria-live": "polite", "aria-atomic": "true" });
  const copyLabel = el(doc, "span", { text: "Copy prompt" });
  const copyButton = el(doc, "button", { type: "button", class: "opf-handoff-button opf-handoff-copy", "data-primary": true }, icon(doc, "Copy"), copyLabel);
  const downloadButton = el(doc, "button", { type: "button", class: "opf-handoff-button opf-handoff-download" }, icon(doc, "Download"), "Download .md");
  const closeText = el(doc, "button", { type: "button", class: "opf-handoff-button opf-handoff-close", text: "Close" });

  const dialog = el(doc, "div", { class: "opf-handoff-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": `${id}-title`, "aria-describedby": `${id}-description`, tabindex: "-1" },
    el(doc, "div", { class: "opf-handoff-head" },
      el(doc, "div", { class: "opf-handoff-intro" },
        el(doc, "h2", { class: "opf-handoff-title", id: `${id}-title`, text: "Agent handoff" }),
        el(doc, "p", { class: "opf-handoff-description", id: `${id}-description` }, "Paste this into a coding agent. It carries the deck JSON and tells the agent to install ", el(doc, "code", { text: "@openpresentation/opf" }), ", validate the deck and render it."),
      ),
      closeButton,
    ),
    el(doc, "div", { class: "opf-handoff-targets" }, el(doc, "span", { class: "opf-handoff-render", id: `${id}-render`, text: "Render to" }), group),
    el(doc, "div", { class: "opf-handoff-box" }, el(doc, "div", { class: "opf-handoff-box-head" }, el(doc, "span", { class: "opf-handoff-file", text: FILE_NAME }), count), prompt),
    el(doc, "p", { class: "opf-handoff-note", text: "Nothing is sent anywhere. The prompt stays in this browser until you paste it." }),
    el(doc, "div", { class: "opf-handoff-foot" }, closeText, downloadButton, copyButton),
    live,
  );
  const element = el(doc, "div", { class: "opf-handoff opf-ui", "data-density": options.density === "touch" ? "touch" : "comfortable" }, dialog);

  function say(message) {
    globalThis.clearTimeout(liveTimer);
    live.textContent = "";
    liveTimer = globalThis.setTimeout(() => { live.textContent = message; }, 20);
  }
  function build() {
    handoff = buildAgentHandoff(deck, { target, fileName: options.fileName, specUrl: options.specUrl, agentGuideUrl: options.agentGuideUrl });
    prompt.value = handoff.markdown;
    count.textContent = `${handoff.lines} lines`;
    for (const radio of radios) {
      const on = radio.dataset.target === target;
      radio.setAttribute("aria-checked", String(on));
      radio.tabIndex = on ? 0 : -1;
    }
  }
  function resetCopy() {
    globalThis.clearTimeout(copiedTimer);
    copiedTimer = undefined;
    copyLabel.textContent = "Copy prompt";
    copyButton.querySelector("svg")?.replaceWith(icon(doc, "Copy"));
    delete copyButton.dataset.copied;
  }
  function setTarget(next, { focus = false } = {}) {
    if (!(next in HANDOFF_TARGETS) || next === target) return;
    target = next;
    build();
    resetCopy();
    options.onTargetChange?.(target);
    if (focus) radios.find((radio) => radio.dataset.target === target)?.focus();
  }
  async function copy() {
    const text = handoff.markdown;
    let ok = false;
    try { await globalThis.navigator?.clipboard?.writeText(text); ok = true; }
    catch {
      // No Clipboard API (an insecure page, or permission refused): select the text and ask the browser to copy the selection.
      prompt.focus();
      prompt.select();
      try { ok = Boolean(doc.execCommand?.("copy")); } catch { ok = false; }
    }
    if (destroyed) return ok;
    if (!ok) { prompt.focus(); prompt.select(); say("Could not copy. The prompt is selected: press Ctrl+C or Command+C."); return false; }
    globalThis.clearTimeout(copiedTimer);
    copyLabel.textContent = "Copied";
    copyButton.querySelector("svg")?.replaceWith(icon(doc, "Check"));
    copyButton.dataset.copied = "true";
    say("Prompt copied to the clipboard.");
    copiedTimer = globalThis.setTimeout(resetCopy, COPIED_MS);
    return true;
  }
  function download() {
    const blob = new Blob([handoff.markdown], { type: "text/markdown" });
    if (options.onDownload) options.onDownload({ blob, fileName: FILE_NAME, format: "handoff" });
    else saveBlob(doc, blob, FILE_NAME);
  }

  function focusables() { return [...dialog.querySelectorAll(FOCUSABLE)].filter((node) => !node.hidden && node.getClientRects().length); }
  function onKeydown(event) {
    if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key !== "Tab") return;
    const nodes = focusables();
    if (!nodes.length) { event.preventDefault(); dialog.focus(); return; }
    const first = nodes[0], last = nodes[nodes.length - 1], active = doc.activeElement;
    if (event.shiftKey && (active === first || active === dialog)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
    else if (!dialog.contains(active)) { event.preventDefault(); first.focus(); }
  }
  // Focus that escapes (a click on the page behind the scrim, a script) comes straight back.
  function onFocusin(event) { if (!destroyed && !dialog.contains(event.target)) (focusables()[0] ?? dialog).focus(); }
  function onKeydownRadio(event) {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const at = radios.findIndex((radio) => radio.dataset.target === target);
    let next;
    if (event.key in keys) next = (at + keys[event.key] + radios.length) % radios.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = radios.length - 1;
    else return;
    event.preventDefault();
    setTarget(radios[next].dataset.target, { focus: true });
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    globalThis.clearTimeout(copiedTimer);
    globalThis.clearTimeout(liveTimer);
    doc.removeEventListener("keydown", onKeydown, true);
    doc.removeEventListener("focusin", onFocusin, true);
    element.remove();
  }
  function close() {
    if (destroyed) return;
    destroy();
    if (opener?.isConnected && typeof opener.focus === "function") opener.focus();
    options.onClose?.();
  }

  build();
  for (const radio of radios) {
    radio.addEventListener("click", () => setTarget(radio.dataset.target));
    radio.addEventListener("keydown", onKeydownRadio);
  }
  closeButton.addEventListener("click", close);
  closeText.addEventListener("click", close);
  copyButton.addEventListener("click", copy);
  downloadButton.addEventListener("click", download);
  // A press and release on the scrim closes; a drag that starts in the dialog (selecting prompt text) and ends on the scrim does not.
  let pressedOnScrim = false;
  element.addEventListener("pointerdown", (event) => { pressedOnScrim = event.target === element; });
  element.addEventListener("click", (event) => { if (pressedOnScrim && event.target === element) close(); pressedOnScrim = false; });
  doc.addEventListener("keydown", onKeydown, true);
  doc.addEventListener("focusin", onFocusin, true);
  container.append(element);
  radios.find((radio) => radio.dataset.target === target)?.focus();

  return {
    element,
    /** The prompt as shown. */
    getPrompt: () => ({ ...handoff }),
    setTarget: (next) => setTarget(next),
    /** Replace the deck the prompt embeds. */
    setDocument(next) { deck = next; build(); resetCopy(); },
    copy,
    close,
    destroy,
  };
}
