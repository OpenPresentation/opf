// Screen reader support for the source editor (artifacts/source-editor/SPEC.md, section 13): one polite live region next to the code that says
// what happened while the author types (how many suggestions, which one is selected, what was inserted, which tab stop a snippet is at), and an
// accessible name for every suggestion that carries its kind and its place in the list. Plain DOM, no network.
import { ViewPlugin } from "@codemirror/view";
import { completionStatus, currentCompletions, pickedCompletion, selectedCompletion } from "@codemirror/autocomplete";

const CLEAR_AFTER = 1500;
const SELECTION_DELAY = 100;
const MERGE_WITHIN = 400;
const KIND_WORDS = { property: "property", enum: "value", boolean: "value", catalog: "catalog id", reference: "reference", snippet: "snippet", keyword: "keyword", text: "text" };
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * The live region: `say(message)` replaces its text (an identical message in a row is announced again), and the text goes after 1.5 seconds.
 * `onSay` also receives every message (hosts mirror them into their own region; tests read them).
 */
export function createAnnouncer(parent, onSay) {
  const document = parent.ownerDocument;
  const region = document.createElement("div");
  region.className = "opf-source-live";
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "true");
  parent.append(region);
  let timer = null, toggle = false;
  return {
    element: region,
    say(message) {
      if (!message) return;
      clearTimeout(timer);
      toggle = !toggle;
      region.textContent = toggle ? message : `${message}​`;
      onSay?.(message);
      timer = setTimeout(() => { region.textContent = ""; }, CLEAR_AFTER);
    },
    destroy() { clearTimeout(timer); region.remove(); },
  };
}

/** The first sentence of a documentation text, for the selection announcement. */
export function firstSentence(text) {
  if (typeof text !== "string") return "";
  const flat = text.replace(/\s+/g, " ").trim();
  return /^.*?[.!?](?=\s|$)/.exec(flat)?.[0] ?? flat;
}

/** The accessible name of one suggestion: `label, kind[, required][, detail]. n of total`. */
export function optionName(completion, index, total) {
  const kind = KIND_WORDS[completion.type] ?? completion.type ?? "";
  const parts = [completion.label];
  if (kind) parts.push(kind);
  if (completion.opfRequired) parts.push("required");
  if (completion.detail && completion.detail !== kind) parts.push(completion.detail);
  return `${parts.join(", ")}. ${index + 1} of ${total}`;
}

/**
 * The editor extension: announces the list opening (the count), the selection changing (label, kind and the first sentence of its
 * documentation; after a short pause so arrowing through the list is not read item by item) and a suggestion being inserted; and names
 * every rendered option for assistive technology. `describe(completion)` gives the documentation text of an item.
 */
export function a11yExtension(announcer, describe = () => "") {
  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.view = view;
      this.open = false;
      this.selected = null;
      this.timer = null;
      this.labelTimer = null;
    }
    update(update) {
      const { state } = update;
      for (const tr of update.transactions) {
        const picked = tr.annotation(pickedCompletion);
        if (picked) announcer.say(`Inserted ${picked.label}`);
      }
      const open = completionStatus(state) === "active" && currentCompletions(state).length > 0;
      const selected = open ? selectedCompletion(state) : null;
      if (open && !this.open) {
        const footer = currentCompletions(state).find((completion) => completion.opfFooter)?.opfFooter;
        announcer.say(`${plural(currentCompletions(state).length, "suggestion")}${footer ? `. ${footer}` : ""}`);
      } else if (open && selected && selected !== this.selected) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          const text = firstSentence(describe(selected));
          const kind = KIND_WORDS[selected.type] ?? selected.type ?? "";
          announcer.say(`${selected.label}${kind ? `, ${kind}` : ""}${selected.opfRequired ? ", required" : ""}.${text ? ` ${text}` : ""}`);
        }, SELECTION_DELAY);
      }
      if (!open) clearTimeout(this.timer);
      this.open = open;
      this.selected = selected;
      if (open) {
        clearTimeout(this.labelTimer);
        this.labelTimer = setTimeout(() => this.label(), 0);
      }
    }
    label() {
      const { view } = this, { state } = view;
      const completions = currentCompletions(state);
      if (!completions.length) return;
      this.footer(completions);
      for (const node of view.dom.querySelectorAll(".cm-tooltip-autocomplete [role=option]")) {
        const index = Number(node.id.slice(node.id.lastIndexOf("-") + 1));
        const completion = completions[index];
        if (completion) node.setAttribute("aria-label", optionName(completion, index, completions.length));
      }
    }
    // The line under a list of catalog records whose catalog is not loaded (SPEC 4.5): part of the list's own box, after the options.
    footer(completions) {
      const tooltip = this.view.dom.querySelector(".cm-tooltip-autocomplete");
      if (!tooltip) return;
      const text = completions.find((completion) => completion.opfFooter)?.opfFooter ?? "";
      let node = tooltip.querySelector(":scope > .opf-completion-footer");
      if (!text) { node?.remove(); return; }
      if (!node) {
        node = tooltip.ownerDocument.createElement("div");
        node.className = "opf-completion-footer";
        node.setAttribute("role", "note");
      }
      if (node.textContent !== text) node.textContent = text;
      if (tooltip.lastElementChild !== node) tooltip.append(node);
    }
    destroy() { clearTimeout(this.timer); clearTimeout(this.labelTimer); }
  });
}
