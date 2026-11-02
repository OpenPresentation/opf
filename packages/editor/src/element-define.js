// CE-30: `import "@openpresentation/opf-editor/element/define"` defines `<opf-editor>` and nothing else. It is the one entry of the element with a
// side effect (listed in the package's `sideEffects`), for a page that wants the tag from a single import line. On a server there is no
// `customElements`, so importing it there does nothing. A page that needs another tag name, or default `fonts` and `catalogs`, imports
// `defineOpfEditorElement` from `@openpresentation/opf-editor/element` and calls it.
import { defineOpfEditorElement } from "./element.js";

if (typeof customElements !== "undefined" && typeof HTMLElement !== "undefined") defineOpfEditorElement();
