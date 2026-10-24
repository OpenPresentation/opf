// The shape hint (artifacts/source-editor/SPEC.md, section 8.2): a signature-like tooltip of the slide or object around the caret. Loaded lazily by the
// code editor at the first focus. `showShapeHint(view, context)` is Cmd/Ctrl+Shift+Space; `autoShapeHint(view, context, typed)` is called after a `{` or a
// `,` was typed. Both return true when the key was taken. `context` is `{ format, catalogs, say, api, options }` (json-editor.js `featureContext`).
export function showShapeHint(_view, context) {
  context.say("The shape hint is not available yet");
  return true;
}
export function autoShapeHint() { return false; }
