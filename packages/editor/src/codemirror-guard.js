// One copy of @codemirror/view. Every CodeMirror package (autocomplete, search, lint, language) builds its view plugins with the
// `ViewPlugin` of the @codemirror/view copy IT resolves to. When a host app resolves a second copy (its own CodeMirror at another version,
// or a package manager that did not dedupe), the editor's EditorView never runs those plugins: tooltips, completions, the problems
// panel and find stop working, with no error. This module finds that case from the extensions the code editor mounts with and says it
// once per page.
import { ViewPlugin } from "@codemirror/view";

const REPORTED = Symbol.for("@openpresentation/opf-editor:duplicate-codemirror-view");

/** Whether `value` is a ViewPlugin, of any copy of @codemirror/view (its fields, since `instanceof` is what fails across copies). */
const looksLikeViewPlugin = (value) => value !== null && typeof value === "object" && typeof value.create === "function" && typeof value.id === "number" && "domEventHandlers" in value && "baseExtensions" in value;

/**
 * The view plugins in the extension tree `extension` that were made by another copy of @codemirror/view than `ownViewPlugin` (the
 * editor's own). An empty list means one copy. Walks arrays, precedence and compartment wrappers (`inner`), plugin extensions and
 * facet providers whose value names a plugin (`plugin.of(arg)`).
 */
export function foreignViewPlugins(extension, ownViewPlugin = ViewPlugin) {
  const found = [];
  const seen = new Set();
  const visit = (value) => {
    if (value === null || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (looksLikeViewPlugin(value)) {
      if (!(value instanceof ownViewPlugin)) found.push(value);
      return;
    }
    if (looksLikeViewPlugin(value.value?.plugin)) visit(value.value.plugin);
    if ("inner" in value) visit(value.inner);
    if ("extension" in value && value.extension !== value) visit(value.extension);
  };
  visit(extension);
  return found;
}

/** The error a host hears when the code editor mounts on two copies of @codemirror/view. */
export function duplicateViewError() {
  const error = new Error(
    "Two copies of @codemirror/view are loaded, so the OPF source editor's tooltips, completions, problems and find do not work. " +
      "Make the app resolve one copy of each @codemirror/* package (npm dedupe; a pnpm override or a bundler alias for @codemirror/view and @codemirror/state).",
  );
  error.code = "duplicate-codemirror";
  return error;
}

/**
 * Check the extensions a code editor mounts with and report a second copy of @codemirror/view once per page: through `onError` when
 * the host gave one, else on the console. Returns whether a second copy was found (on every call, also after it was reported).
 */
export function checkCodeMirrorCopies(extension, onError) {
  if (foreignViewPlugins(extension).length === 0) return false;
  if (globalThis[REPORTED]) return true;
  globalThis[REPORTED] = true;
  const error = duplicateViewError();
  if (typeof onError === "function") {
    try {
      onError(error);
      return true;
    } catch {
      /* A host callback that throws: the console still says it. */
    }
  }
  globalThis.console?.error?.(error.message);
  return true;
}
