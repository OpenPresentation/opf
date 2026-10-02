// The restore prompt and the autosave indicator for `createPersistence` (RR-22), as plain DOM a host can mount or ignore. The prompt is a
// non-modal region with two buttons (nothing steals focus or blocks editing); the indicator is a short line of text, and the problems
// (storage unavailable, full) are also announced in a polite live region. Importing needs no DOM; mounting does.
import { describeAutosave } from "./persistence.js";

function el(doc, tag, props = {}, ...children) {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}
const when = (savedAt, locale) => new Date(savedAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
const slides = (count) => (Number.isInteger(count) ? `${count} slide${count === 1 ? "" : "s"}` : "");

/**
 * Build the prompt and the indicator. Options: `banner` (the element the prompt is drawn in; it is hidden when there is nothing to
 * offer), `indicator` (an element for the one-line autosave status) and `locale`. Pass `ui.prompt` as `onRestorePrompt` and `ui.status` as
 * `onStatus` of `createPersistence`.
 */
export function createPersistenceUi(options) {
  const { banner, indicator, locale } = options;
  const doc = (banner ?? indicator).ownerDocument;
  const live = el(doc, "div", { class: "sr-only", role: "status", "aria-live": "polite", "aria-atomic": "true" });
  (banner ?? indicator).after(live);
  let announced = "";
  const say = (message) => {
    if (!message || message === announced) return;
    announced = message;
    live.textContent = "";
    globalThis.setTimeout(() => { live.textContent = message; }, 20);
  };
  if (banner) { banner.hidden = true; }

  function hide() {
    if (banner) { banner.hidden = true; banner.replaceChildren(); }
  }
  const ui = {
    /** `onRestorePrompt`: draw the offer. The buttons call `actions.restore` and `actions.discard`; the promise stays "later" (the buttons decide). */
    prompt(offer, actions) {
      if (!banner) return "later";
      const intro = offer.dirty
        ? `You have unsaved work from ${when(offer.savedAt, locale)}${offer.slideCount ? ` (${slides(offer.slideCount)})` : ""}, kept in this browser. Restore it?`
        : `Your last session from ${when(offer.savedAt, locale)}${offer.slideCount ? ` (${slides(offer.slideCount)})` : ""} is kept in this browser. Open it again?`;
      const note = offer.earlier ? el(doc, "p", { class: "restore-note", text: `An older copy from ${when(offer.earlier.savedAt, locale)} is also kept.` }) : null;
      const restore = el(doc, "button", { type: "button", class: "primary restore-yes", text: "Restore" });
      const discard = el(doc, "button", { type: "button", class: "secondary restore-no", text: "Discard copy", title: "Delete the stored copy" });
      const earlier = offer.earlier ? el(doc, "button", { type: "button", class: "secondary restore-earlier", text: "Restore older copy" }) : null;
      restore.addEventListener("click", async () => { restore.disabled = discard.disabled = true; const done = await actions.restore(); if (done) { hide(); say("Restored. Undo goes back to what you had."); } else { restore.disabled = discard.disabled = false; } });
      discard.addEventListener("click", async () => { await actions.discard(); hide(); say("Discarded the stored copy."); });
      earlier?.addEventListener("click", async () => { const done = await options.restoreEarlier?.(); if (done) { hide(); say("Restored the older copy. Undo goes back to what you had."); } });
      banner.replaceChildren(el(doc, "p", { class: "restore-text", id: `${banner.id || "restore"}-text`, text: intro }), note, el(doc, "div", { class: "restore-actions" }, restore, discard, earlier));
      banner.setAttribute("role", "region");
      banner.setAttribute("aria-label", "Restore your work");
      banner.hidden = false;
      say(intro);
      return "later";
    },
    /** `onStatus`: update the indicator and announce problems. */
    status(status) {
      const text = describeAutosave(status, { locale });
      if (indicator) {
        // The indicator keeps its own fallback line until storage reports; a problem keeps the suffix too, so it still says how to keep the work.
        if (text) indicator.textContent = options.suffix ? `${text}${/[.!?]$/.test(text) ? "" : "."} ${options.suffix}` : text;
        else if (options.fallback !== undefined) indicator.replaceChildren(...String(options.fallback).split("\n").flatMap((line, at) => (at ? [doc.createElement("br"), line] : [line])));
        else indicator.textContent = "";
        indicator.dataset.state = status.state;
        if (!options.fallback) indicator.hidden = !text;
      }
      if (status.state === "unavailable" || status.state === "error") say(status.message);
    },
    /** Hide the prompt (for example after the host restored through its own control). */
    hide,
    destroy() { hide(); live.remove(); if (indicator) indicator.textContent = ""; },
  };
  return ui;
}
