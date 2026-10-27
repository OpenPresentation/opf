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

`layout: "full"` (default) builds a bar (Undo, Redo, Find, the view switch, Export, Present), the source pane, the slide, the slide row (previous, counter, next and thumbnails), a status line and a side panel (Review, and Design when on). `"canvas"` builds the slide and its slide row. `"source"` builds only the source pane. `"studio"` is the Presentation and Slide Studio and `"playground"` its first-contact preset, which `editor.setLayout()` switches between in place ([studio.md](studio.md)). `panels` turns any part on or off:

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
| `source` | `format`, `name`, `text`, `worker` (the Web Worker for the pane's text checks: `true`, a `Worker`, a function or a worker script's URL; see [The source worker](#the-source-worker)), `checks`, `outline`, `applyDelay`, `cursorDelay`, `onCopy`, `onDownload`, `onRename`, `resolvePreview` |
| `canvas` | more options for the canvas: `textEntry`, `imageTools`, `layoutEditing` |
| `export` | more options for the Export menu: `exportPptx(deck, { signal, onProgress })`, `items`, `label`, `onDownload` |
| `review`, `find`, `design` | `true`, or the options of that panel (`review.hook` is the hosted reviewer) |
| `persistence` | `{ key, storage, debounceMs, ... }` (see "Autosave and restore" in the README); `key` is required |
| `readOnly` | refuse every write from the editor's parts and lock the slide and the code; the host's own writes to `editor.session` still work |
| `density`, `exportMode` | `"comfortable" | "touch" | "auto"` (follows the pointer); `"menu" | "sheet" | "auto"` (the sheet at 900px and under) |
| `theme` | see [theming](theming.md) |
| `onChange`, `onSelection`, `onCursor`, `onError`, `onReady`, `on` | callbacks and listeners |

## The handle

`getDocument()` (frozen, replaced on every change, so a store snapshot) · `setDocument(document, { text, format, name, rebase })` (opens a document as one undoable change that forks no catalog record; the source pane shows `text` as written; a document the session refuses becomes a draft in the pane and the call returns `false`) · `session` · `canvas` · `sourcePane` and the other parts · `slideIndex`, `setSlide(index)`, `goTo(index, path)`, `select(path)` · `view`, `views`, `setView(view)` · `undo()`, `redo()`, `commit()` · `focus("source" | "canvas")` · `present()` · `openFind()` · `readSource()` · `sourceCursor` · `setReadOnly`, `setTheme`, `setDensity`, `setExportMode` · `status(message)` · `on(event, listener)` (returns the unsubscribe) and `off` · `ready` · `destroy()`.

Events: `mounted` (the parts exist; the first update may still wait for fonts), `ready` (the first update is done), `change` (`{ document, canUndo, canRedo, event }`), `selection`, `cursor` (the caret of the source pane, below), `slide`, `view`, `source` (the verdict on the text: `valid`, `invalid` or `syntax`), `checking`, `fonts`, `geometry`, `sync` (after every update once fonts are ready, with the slide's geometry and layout notes computed when read), `render`, `draft`, `commit`, `cancel`, `status`, `error`, `kept`, `rename`, `export`, `persistence`, `review`, `panel`, `destroy`; the Studio adds `zoom`, `layout`, `command` and `layoutStudio`, and its `selection` carries the list (`items`, `primary`, `source`). An exception thrown by a listener is reported to `error` and does not stop the others.

While the text in the source pane is not a valid deck, the editor says so (`editor.inSync` is `false`): the slide shows the last valid document and is locked, Export, Present and Undo wait for the fix.

## The source pane's hooks (CE-17)

A host that replaces its own code editor with the source pane needs to know where the caret is, to scroll to a field without taking the focus, and to mark fields of its own. All three work in JSON, YAML and Markdown, through core's `pathAt` and `locate`. The event is on the handle; the methods are on `editor.sourcePane` (undefined in a layout without a source pane).

```js
// Where is the caret? { pointer, idPath, from, to, head, part, format }, told when it moves (after `source.cursorDelay`, default 50 ms, of quiet).
editor.on("cursor", ({ pointer, idPath, from, to }) => showFieldDocs(pointer));
editor.sourceCursor;                 // the latest event, or null
editor.sourcePane.getCursor();       // read at once

// Scroll a field or a range into view without moving the caret or the focus (`focus`, `select`, `flash` and `align` are options).
editor.sourcePane.revealPath("/slides/12/title");
editor.sourcePane.revealPath({ from: 120, to: 180 }, { align: "nearest" });

// Marks and line classes of your own, in sets (groups) you replace or clear; the editor's own squiggles and highlights are separate.
editor.sourcePane.setDecorations(
  [{ path: "/slides/3/title", kind: "error", label: "Title is too long" }, { path: "/slides/4", kind: "added", line: true }],
  { group: "validation" },
);
editor.sourcePane.setDecorations([{ path: "/slides/7/text", kind: "agent" }], { group: "agent" });
editor.sourcePane.clearDecorations("agent");   // or clearDecorations() for every set
```

- **`cursor`** is `{ pointer, idPath, from, to, head, part, format }`. `pointer` is the JSON Pointer of the field under the caret (`/slides/0/title`; on a property name or a value it is that property, between members it is the container, and `""` outside the content). `idPath` is the same place addressed by id (`/slides/@intro/title`), read from the session's document, so it survives a reorder; an element without an id keeps its index, and while the text does not read as a document `idPath` is the pointer. `from` and `to` are the selection and `head` the end the caret is at, in source offsets (UTF-16 positions in `getText()`, a CRLF counting as two). `part` is `key`, `value`, `between` or `none`. The event is not told while a typed edit waits to be applied (so `idPath` names the right slide), is coalesced over `cursorDelay`, is not repeated for a place already told, and is told also while the pane has no focus (a reveal that selects, a click, a format switch). The detail is frozen. The `onCursor` option is the same as `on: { cursor }`.
- **`revealPath(target, options?)`** takes a pointer (or dotted path) or `{ from, to }`. It scrolls the start of the target into view, opening any fold around it, and moves neither the caret nor the focus, unlike `focusPath`. Options: `focus` (also focus the code), `select` (also select the range, which emits `cursor`), `align` (`center`, the default, `start` or `nearest`), `flash` (mark the first line for a moment) and `part` (which part of a field a path means: `entry`, the default, `value`, `key`, `open` or `colon`). It returns `{ from, to, line, exact }` (`exact` is false when only the nearest container could be placed) or `null`.
- **`setDecorations(list, { group })`** draws one set, replacing the set of that `group` (default `default`); `[]` or `null` clears it. An item is `{ path, part?, kind?, label?, line? }` or `{ range: { from, to }, kind?, label?, line? }`. A path stays on its field as the text is edited and the format is switched, and is not drawn while the text has no such field; a range follows the text as positions, like a selection. `kind` becomes the class `opf-source-decoration-<kind>` (`highlight`, `error`, `warning`, `info`, `added` and `changed` have a look in the stylesheet; style any other kind yourself, the `--opf-ui-*` tokens work in it), `label` is the tooltip of a mark, and `line: true` puts the class on every line the range touches. `getDecorations(group?)` lists what is drawn now at the current offsets. The sets are the host's: the editor's own problems, field highlights and selection are untouched, and `clearDecorations()` removes only the host's.

## The source worker

`source: { worker }` (and `createSourcePane(el, { worker })`) runs the pane's text checks in a Web Worker, so typing in a deck of a thousand slides never blocks the page. Without it (the default) the checks run on the main thread, which is fast enough for ordinary decks. The worker script is `@openpresentation/opf-editor/source-worker`. It imports core, so it only runs bundled: serving `dist/source-worker.js` straight from `node_modules` fails (a module worker cannot resolve `@openpresentation/opf`, a classic one cannot read `import`).

| Bundler | What to pass | Measured with the 0.28.0 packages |
| --- | --- | --- |
| Next.js 16 (Turbopack or `--webpack`), webpack 5 | `worker: true`, or `worker: () => new Worker(new URL("@openpresentation/opf-editor/source-worker", import.meta.url), { type: "module" })` | both forms bundle the worker and it answers, in `next dev` and `next build` |
| Vite 7, build | either form above | the worker is bundled (`assets/source-worker-<hash>.js`) |
| Vite 7, dev server | the function form, with `optimizeDeps: { include: ["@openpresentation/opf", "@openpresentation/opf/yaml", "@openpresentation/opf/markdown", "@openpresentation/opf/source"] }` | `worker: true` asks for `.vite/deps/source-worker.js`, which does not exist (the dependency optimizer moved the editor); without the `include`, the worker's copy of core imports ajv as CommonJS and fails |
| esbuild | build the worker as its own entry, `entryPoints: { "source-worker": "@openpresentation/opf-editor/source-worker" }`, and pass `worker: new URL("./source-worker.js", import.meta.url)` | esbuild leaves `new URL(..., import.meta.url)` alone, so neither form above emits the worker |

- A file of your own that only imports the worker entry (`import "@openpresentation/opf-editor/source-worker";`) and is started with `new URL("./my-worker.js", import.meta.url)` works too: the entry is listed in the package's `sideEffects`, so bundlers keep that import (with the earlier `"sideEffects": false` they dropped it and the worker never answered).
- A URL or a string is started as a module worker (`new Worker(url, { type: "module" })`); give a bundled script.
- The worker says it is ready as soon as its module has run. One that cannot start, that fails, or that loads but does not say so within 5 s (an emptied script) is given up: the pane checks on the main thread from then on, no edit is lost, and `onError` is told once, with a message that names the worker (and, under the Vite dev server, what to change).
- A worker starts on the first typed edit, not when the pane mounts. pptx.dev checks on the main thread on purpose: its decks are small, and starting the worker's module competed with the first slide's drawing on two-core machines.

## One copy of CodeMirror

The editor depends on the `@codemirror/*` and `@lezer/*` packages by caret range (`^6.43.15`), so a package manager can share them with a host that uses CodeMirror itself. Two copies of `@codemirror/view` must never meet in one editor: the view of one copy ignores every plugin the other copy built, so tooltips, completions, the problems panel and find stop working, with no error. When the code editor mounts, it looks for plugins of another copy among its extensions and says so once per page, through `onError` (the error's `code` is `"duplicate-codemirror"`) or, without one, on the console. To fix it, resolve one copy of each `@codemirror/*` package: `npm dedupe`, a pnpm override (`pnpm.overrides` or `overrides` in `pnpm-workspace.yaml`) or a bundler alias for `@codemirror/view` and `@codemirror/state`.

## React


```jsx
import { OpfEditor, useOpfCursor, useOpfDocument, useOpfSelection } from "@openpresentation/opf-editor/react";

function Editor() {
  const [editor, setEditor] = React.useState(null);
  const document = useOpfDocument(editor);      // replaced on every change
  const selection = useOpfSelection(editor);    // { path, value } | null
  const cursor = useOpfCursor(editor);          // { pointer, idPath, from, to, ... } | null: the caret of the source pane
  return (
    <>
      <OpfEditor className="editor" style={{ height: 720 }} document={deck} fonts={loadFonts} catalogs={[gallery]}
        theme={theme} readOnly={locked} onEditor={setEditor} onChange={save} onCursor={showFieldDocs} />
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
