# Embedding the editor (CE-06)

`createOpfEditor(element, options)` mounts the editor's components over one editor session and one fonts handle, wires them together, and returns a handle. It is the glue the playground, openpresentation.org, pptx.gallery and pptx.dev each wrote by hand, as a package entry point: the font gate before every draw, one slide index, commit-before-navigate, the verdict on the source text, the lifecycle of the fonts lease and of every listener, and the order in which the parts hear a change.

```js
import "@openpresentation/opf-editor/styles.css";
import { createOpfEditor } from "@openpresentation/opf-editor/workspace";
import { gallery } from "@openpresentation/gallery";

const editor = createOpfEditor(document.querySelector("#editor"), {
  document: myDeck,            // an OPF object or its JSON text
  catalogs: [gallery],         // for the session and every draw
  fonts: loadMyFonts,          // the renderer's fonts handle, a lease { fonts, release }, a promise or a function of either
  persistence: { key: "my-deck" },
  theme: { colorScheme: "auto", tokens: { accent: "hsl(262 60% 38%)" } },
  onChange: ({ document }) => save(document),
});
await editor.ready;
```

The editor owns the content of the element you give it (it replaces it, and `destroy()` leaves it empty). Nothing here fetches anything, stores anything unless you give `persistence`, or talks to a service: the host supplies fonts, catalogs, storage and export converters. The entry point imports the renderer (`@openpresentation/opf-render`, an optional peer of the package) and every component, so load it on demand (a dynamic `import()`) where bundle size matters.

## Layouts and parts

`layout: "full"` (default) builds a bar (Undo, Redo, Find, the view switch, Export, Present), the source pane, the slide, the slide row (previous, counter, next and thumbnails), a status line and a side panel (Review, and Design when on). `"canvas"` builds the slide and its slide row. `"source"` builds only the source pane. `panels` turns any part on or off:

| `panels.` | Part | Default in `full` |
| --- | --- | --- |
| `source` | the code editor: JSON, YAML, Markdown, with findings | on |
| `canvas` | the slide, edited in place | on |
| `navigator`, `thumbnails` | previous, counter, next; the thumbnail strip | on |
| `history` | Undo and Redo buttons | on |
| `find` | find and replace (Ctrl/Cmd F, H) | on |
| `present` | the Present button, F5 and the full-screen presenter | on |
| `export` | the Export menu (PPTX when you give `export.exportPptx`) | on |
| `review` | the Review panel | on |
| `layouts`, `sorter`, `outline` | Layout Studio, the slide sorter, the outline view | on |
| `design` | the design controls | off |
| `persistence` | autosave and the restore prompt | on when `persistence` is given |
| `slides` | the vertical slide list (`slots` only) | off |

`view` is the view shown first (`slide`, `sorter`, `outline`, `layouts`); `editor.setView(view)` switches (an open canvas edit is committed first). `panel` picks the side tab shown first.

**Your own arrangement.** Pass `slots`, an object of your own elements, and each part mounts in its own; a part without a slot is not mounted and nothing else is built. `element` is then your page (the editor adds one empty node to it, for dialogs), and `slots.overlay` can name the element dialogs mount in. `fit: "contain"` sizes the slide to the frame around the canvas element.

```js
createOpfEditor(page, {
  document, fonts, catalogs,
  slots: { source: sourceEl, canvas: canvasEl, navigator: navEl, thumbnails: thumbsEl, export: exportEl, present: presentEl, status: statusEl },
  fit: "contain",
});
```

Slot names: `source`, `canvas`, `slide` (the element hidden while another view shows), `properties`, `navigator`, `thumbnails`, `slides`, `slideToolbar`, `sorter`, `outline`, `layouts`, `export`, `present`, `review`, `design`, `find`, `banner` and `autosave` (the restore prompt and the autosave line), `status`, `overlay`.

## Options

| Option | |
| --- | --- |
| `document` | the document to edit (an object, or JSON text, whose spelling the source pane keeps); creates the session |
| `session` | an existing `EditorSession` to edit instead; register its catalogs on it |
| `catalogs` | the host's catalogs, for the session the editor creates and for every draw |
| `fonts` | the renderer's fonts handle (`loadFonts()`), a lease `{ fonts, release() }` (what a host's own acquire function returns), a promise of either, a function that returns any of those, or `{ lease(), release(fonts) }`. A function or a lease is called once; the lease is given back exactly once on `destroy()`, also when the editor is destroyed before the fonts arrive |
| `renderOptions`, `imageResolver` | extra `toSvg` options for every draw, and the renderer's hook that turns an asset reference into an address |
| `onAddAsset` | stores an uploaded image yourself and returns its reference (the design controls' hook) |
| `variables` | `"authored"` (default) shows `{{variables}}` as written; `"resolved"` fills them in, except in a template deck, and routes a press on filled-in text to its properties form |
| `source` | `format`, `name`, `text`, `worker` (the Web Worker for the pane's text checks: `true`, a `Worker` or a function), `checks`, `outline`, `applyDelay`, `onCopy`, `onDownload`, `onRename`, `resolvePreview` |
| `canvas` | more options for the canvas: `textEntry`, `imageTools`, `layoutEditing` |
| `export` | more options for the Export menu: `exportPptx(deck, { signal, onProgress })`, `items`, `label`, `onDownload` |
| `review`, `find`, `design` | `true`, or the options of that panel (`review.hook` is the hosted reviewer) |
| `persistence` | `{ key, storage, debounceMs, ... }` (see "Autosave and restore" in the README); `key` is required |
| `readOnly` | refuse every write from the editor's parts and lock the slide and the code; the host's own writes to `editor.session` still work |
| `density`, `exportMode` | `"comfortable" | "touch" | "auto"` (follows the pointer); `"menu" | "sheet" | "auto"` (the sheet at 900px and under) |
| `theme` | see [theming](theming.md) |
| `onChange`, `onSelection`, `onError`, `onReady`, `on` | callbacks and listeners |

## The handle

`getDocument()` (frozen, replaced on every change, so a store snapshot) · `setDocument(document, { text, format, name, rebase })` (opens a document as one undoable change that forks no catalog record; the source pane shows `text` as written; a document the session refuses becomes a draft in the pane and the call returns `false`) · `session` · `canvas` · `sourcePane` and the other parts · `slideIndex`, `setSlide(index)`, `goTo(index, path)`, `select(path)` · `view`, `views`, `setView(view)` · `undo()`, `redo()`, `commit()` · `focus("source" | "canvas")` · `present()` · `openFind()` · `readSource()` · `setReadOnly`, `setTheme`, `setDensity`, `setExportMode` · `status(message)` · `on(event, listener)` (returns the unsubscribe) and `off` · `ready` · `destroy()`.

Events: `mounted` (the parts exist; the first update may still wait for fonts), `ready` (the first update is done), `change` (`{ document, canUndo, canRedo, event }`), `selection`, `slide`, `view`, `source` (the verdict on the text: `valid`, `invalid` or `syntax`), `checking`, `fonts`, `geometry`, `sync` (after every update once fonts are ready, with the slide's geometry and layout notes computed when read), `render`, `draft`, `commit`, `cancel`, `status`, `error`, `kept`, `rename`, `export`, `persistence`, `review`, `panel`, `destroy`. An exception thrown by a listener is reported to `error` and does not stop the others.

While the text in the source pane is not a valid deck, the editor says so (`editor.inSync` is `false`): the slide shows the last valid document and is locked, Export, Present and Undo wait for the fix.

## React

```jsx
import { OpfEditor, useOpfDocument, useOpfSelection } from "@openpresentation/opf-editor/react";

function Editor() {
  const [editor, setEditor] = React.useState(null);
  const document = useOpfDocument(editor);      // replaced on every change
  const selection = useOpfSelection(editor);    // { path, value } | null
  return (
    <>
      <OpfEditor className="editor" style={{ height: 720 }} document={deck} fonts={loadFonts} catalogs={[gallery]}
        theme={theme} readOnly={locked} onEditor={setEditor} onChange={save} />
      <p>{document?.name} · {selection?.path}</p>
    </>
  );
}
```

- `<OpfEditor>` renders a `<div>`. Every prop that is not `className`, `style`, `id`, `slots` or a callback is an option of `createOpfEditor`, read once when the editor mounts (give the component another `key` to mount a new one); `theme`, `readOnly`, `view`, `density` and `exportMode` follow later renders without a remount, and the callbacks are always the latest. `ref` is the handle once mounted; `onEditor(editor | null)` tells you when it is created and destroyed.
- `useOpfEditor(options)` is the hook form for your own element: `const { ref, editor } = useOpfEditor(options)`, `<div ref={ref} />`. `slots` may hold React refs, resolved when the editor mounts.
- StrictMode (React 18 and 19): the editor module is requested after both of StrictMode's effects, the first effect's request is cancelled by its cleanup, and only the second creates an editor, so there is no double mount and nothing leaks. `test/workspace-react-browser.mjs` runs both React versions.
- Server rendering: the component renders an empty container (`<div data-opf-react>`) and nothing of the editor runs on the server; the client hydrates it and mounts. React is an optional peer (`>=18`): only `@openpresentation/opf-editor/react` imports it.

## Not in this release

Transactions, proposals, history, permissions beyond `readOnly`, comment anchors, the asset store and sync are separate items of the cloud-ready editor program (`docs/programs/cloud-editor`). The `readOnly` option is the whole of read-only for now.
