// Go to definition, peek, references and rename (artifacts/source-editor/SPEC.md, section 8.3). Loaded lazily by the code editor on the first use of F12,
// Alt+F12, Shift+F12, F2 or Cmd/Ctrl+click. Each command is `(view, context) => boolean` (true: the key was taken); `context` is what the code editor
// knows: `{ format, catalogs, say, api, options, openRecord }` (see json-editor.js `featureContext`).
const todo = (name) => (_view, context) => { context.say(`${name} is not available yet`); return true; };

/** F12, Cmd/Ctrl+click: jump to where the id under the caret is defined (or open the record's card). */
export const goToDefinition = todo("Go to definition");
/** Alt+F12: show the definition inline. */
export const peekDefinition = todo("Peek definition");
/** Shift+F12: list the places that use the id under the caret. */
export const findReferences = todo("Find references");
/** F2: rename the id under the caret in its definition and every reference, as one undo step. */
export const renameSymbol = todo("Rename");
