import { createOpfEditor } from "@openpresentation/opf-editor/workspace";
import { gallery } from "@openpresentation/gallery";
import { loadPreviewFonts } from "@openpresentation/opf-render/preview-fonts";
import { deck } from "./deck.js";

// #region mount
const editor = createOpfEditor(document.querySelector("#editor"), {
  document: deck,
  catalogs: [gallery],
  fonts: loadPreviewFonts("./opf-fonts/"),
  layout: "embed",
  toolbar: false,
  slots: {
    title: document.querySelector("#header-title"),
    history: document.querySelector("#header-history"),
    counter: document.querySelector("#header-counter"),
    designMenu: document.querySelector("#header-design"),
    expand: document.querySelector("#header-expand"),
  },
  expand: { target: document.querySelector("#app") },
});
// #endregion

window.editor = editor; // for the console
