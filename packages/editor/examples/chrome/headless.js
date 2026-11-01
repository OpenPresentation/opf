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
  expand: { target: document.querySelector("#app") },
});
// #endregion

const $ = (selector) => document.querySelector(selector);

// #region controls
$("#title").addEventListener("change", (event) => editor.setDeckName(event.target.value));
$("#undo").addEventListener("click", () => editor.undo());
$("#redo").addEventListener("click", () => editor.redo());
$("#previous").addEventListener("click", () => editor.setSlide(editor.slideIndex - 1));
$("#next").addEventListener("click", () => editor.setSlide(editor.slideIndex + 1));
$("#expand").addEventListener("click", () => editor.expand(!editor.expanded));
// #endregion

// #region events
editor.on("deckName", ({ name }) => { $("#title").value = name; });
editor.on("slide", ({ index, count }) => {
  $("#counter").textContent = `${index + 1} / ${count}`;
  $("#previous").disabled = index === 0;
  $("#next").disabled = index === count - 1;
});
editor.on("change", ({ canUndo, canRedo }) => {
  $("#undo").disabled = !canUndo;
  $("#redo").disabled = !canRedo;
});
editor.on("expand", ({ expanded }) => $("#expand").setAttribute("aria-pressed", String(expanded)));
editor.on("dirty", ({ dirty }) => {
  $("#dirty").dataset.dirty = String(dirty);
  $("#dirty").textContent = dirty ? "Unsaved" : "Saved";
});
// #endregion

// The events tell changes; read the starting state once the parts exist.
editor.ready.then(() => {
  $("#title").value = editor.getDeckName();
  $("#counter").textContent = `${editor.slideIndex + 1} / ${editor.getDocument().slides.length}`;
  $("#previous").disabled = editor.slideIndex === 0;
  $("#undo").disabled = true;
  $("#redo").disabled = true;
});

window.editor = editor; // for the console
