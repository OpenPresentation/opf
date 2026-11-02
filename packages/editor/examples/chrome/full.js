import { createOpfEditor } from "@openpresentation/opf-editor/workspace";
import { gallery } from "@openpresentation/gallery";
import { loadPreviewFonts } from "@openpresentation/opf-render/preview-fonts";
import { deck } from "./deck.js";

const KEY = "opf-chrome-example-full";
const status = document.querySelector("#status");

// #region mount
const stored = localStorage.getItem(KEY);
const editor = createOpfEditor(document.querySelector("#editor"), {
  document: stored ? JSON.parse(stored) : deck,
  catalogs: [gallery],
  fonts: loadPreviewFonts("./opf-fonts/"),
  layout: "full",
  guardUnload: true,
  actions: [
    { id: "save", label: "Save", primary: true, enabled: () => editor.dirty, run: () => editor.save() },
    { id: "share", label: "Share", run: () => { status.textContent = "Share clicked: open your own dialog here."; } },
  ],
});
// #endregion

// #region save
editor.on("save", ({ document, draft }) => {
  if (draft) {
    status.textContent = "The source is not a valid deck yet: nothing was saved.";
    return;
  }
  localStorage.setItem(KEY, JSON.stringify(document));
  editor.markSaved();
  status.textContent = "Saved to this browser.";
});
// #endregion

// #region dirty
const badge = document.querySelector("#dirty");
editor.on("dirty", ({ dirty }) => {
  badge.dataset.dirty = String(dirty);
  badge.textContent = dirty ? "Unsaved changes" : "All changes saved";
});
// #endregion

window.editor = editor; // for the console
