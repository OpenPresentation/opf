import { createOpfEditor } from "@openpresentation/opf-editor/workspace";
import { gallery } from "@openpresentation/gallery";
import { loadPreviewFonts } from "@openpresentation/opf-render/preview-fonts";
import { deck } from "./deck.js";

// #region mount
const editor = createOpfEditor(document.querySelector("#card"), {
  document: deck,
  catalogs: [gallery],
  fonts: loadPreviewFonts("./opf-fonts/"),
  layout: "embed",
  toolbar: ["title", "history", "counter", "spacer", "review", "expand", "more"],
  theme: {
    tokens: { titleFont: "Georgia, 'Times New Roman', serif", titleSize: "18px", titleWeight: "700" },
  },
  icons: {
    more: "M5 12h.01M12 12h.01M19 12h.01",       // 24x24 path data, stroked in currentColor
    expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
    valid: "M5 13l4 4L19 7",
  },
});
// #endregion

window.editor = editor; // for the console
