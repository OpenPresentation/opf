// CE-06 (promoted from openpresentation.org's playground runtime): editing a document whose `{{variables}}` the canvas draws resolved.
// With `variables: "resolved"` the canvas shows a deck's variables filled in, and a glyph offset of the resolved text does not address
// the authored `{{token}}`. A press on such text opens the field's properties form (which edits the authored value) instead of an
// inline text edit, and a press on text that has no field of its own focuses the source pane.

function hasSourceToken(value) {
  if (typeof value === "string") return value.includes("{{") || value.startsWith("var:");
  if (Array.isArray(value)) return value.some(hasSourceToken);
  return value !== null && typeof value === "object" && Object.values(value).some(hasSourceToken);
}

/**
 * Route inline edits of text that holds a variable token to the canvas's properties form. `resolved()` says whether the canvas currently
 * draws variables resolved (a template deck draws them as authored). Returns a function that removes the listeners.
 */
export function installCanvasVariableEditing(host, editor, canvas, { resolved = () => true, focusSource } = {}) {
  function route(event) {
    if (!resolved() || !(event.target instanceof Element)) return;
    const target = event.target.closest('svg [data-opf-path][role="button"]');
    if (!target || !host.contains(target) || !target.querySelector("text")) return;
    const path = target.getAttribute("data-opf-path");
    const value = editor.get(path);
    const inline = ((typeof value === "string" || typeof value === "number") && !/\.(image|video)$/.test(path))
      || (Array.isArray(value) && target.hasAttribute("data-opf-rich-text"));
    if (value !== undefined && (!inline || !hasSourceToken(value))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (value === undefined) {
      focusSource?.();
      return;
    }
    // The click following pointerdown must not commit and reopen the same form.
    if (canvas.editingPath !== path) canvas.editProperties(path);
  }
  function pointer(event) {
    // A touch press may begin scrolling. Its actual click opens the form.
    if (event.pointerType !== "touch" && event.button === 0) route(event);
  }
  function key(event) {
    if (!event.isComposing && event.keyCode !== 229 && ["Enter", " ", "F2"].includes(event.key)) route(event);
  }
  host.addEventListener("pointerdown", pointer, true);
  host.addEventListener("click", route, true);
  host.addEventListener("dblclick", route, true);
  host.addEventListener("keydown", key, true);
  return () => {
    host.removeEventListener("pointerdown", pointer, true);
    host.removeEventListener("click", route, true);
    host.removeEventListener("dblclick", route, true);
    host.removeEventListener("keydown", key, true);
  };
}
