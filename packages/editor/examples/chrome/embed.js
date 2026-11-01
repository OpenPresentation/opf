// #region imports
import { createOpfEditor } from "@openpresentation/opf-editor/workspace";
import { gallery } from "@openpresentation/gallery";
import { loadPreviewFonts } from "@openpresentation/opf-render/preview-fonts";
// #endregion
import { deck } from "./deck.js";

// #region mount
const editor = createOpfEditor(document.querySelector("#card"), {
  document: deck,
  catalogs: [gallery],
  fonts: loadPreviewFonts("./opf-fonts/"),
  layout: "embed",
});
// #endregion

// #region deck-name
const label = document.querySelector("#deck-name");
label.textContent = deck.name;
editor.on("deckName", ({ name }) => {
  label.textContent = name || "Untitled presentation";
});
// #endregion

window.editor = editor; // for the console
