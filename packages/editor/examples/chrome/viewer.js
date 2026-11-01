import { createOpfEditor } from "@openpresentation/opf-editor/workspace";
import { gallery } from "@openpresentation/gallery";
import { loadPreviewFonts } from "@openpresentation/opf-render/preview-fonts";
import { toPptx } from "@openpresentation/opf-pptx";
import { deck } from "./deck.js";

const fonts = loadPreviewFonts("./opf-fonts/");

// #region download
async function downloadPptx() {
  const bytes = await toPptx(editor.getDocument(), { catalogs: [gallery], fonts: await fonts });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }));
  link.download = `${editor.getDeckName() || "deck"}.pptx`;
  link.click();
  URL.revokeObjectURL(link.href);
}
// #endregion

// #region mount
const editor = createOpfEditor(document.querySelector("#viewer"), {
  document: deck,
  catalogs: [gallery],
  fonts,
  layout: "viewer",
  actions: [{ id: "download", label: "Download PPTX", icon: "M12 4v11m0 0-4-4m4 4 4-4M5 20h14", run: downloadPptx }],
});
// #endregion

window.editor = editor; // for the console
