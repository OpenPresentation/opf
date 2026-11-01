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

The editor owns the content of the element you give it (it replaces it, and `destroy()` leaves it empty). Nothing here fetches anything, stores anything unless you give `persistence`, or talks to a service: the host supplies fonts, catalogs, storage and export converters.

**What it loads.** The entry point imports the session, the source pane (CodeMirror) and core up front. The renderer (`@openpresentation/opf-render`, an optional peer of the package) and every part that shows slides (the canvas, the slide row, the presenter, Export, Review, Find, Design, the sorter, the outline and Layout Studio) are one chunk it imports on demand (`import("./workspace-parts.js")`), only when the layout mounts one of them, so a host that mounts only the source pane never loads the renderer. Measured with esbuild (ESM, code splitting, minified; `test/workspace-bundle.mjs`): a source-only host loads 1,914 KiB (602 KiB gzip) up front, where it loaded 3,086 KiB (1,007 KiB gzip) before; the bare `createSourcePane` is 1,728 KiB (558 KiB gzip). The parts mount once the fonts have arrived and, for a layout with slides, once that chunk has loaded (a source-only editor with a fonts handle at hand mounts before `createOpfEditor` returns); await `ready` before you use them.

**Before the parts mount.** The handle is returned at once and every method works from then on. Settings (`setDensity`, `setExportMode`, `setView`, `setSlide`, `setReadOnly`, `setTheme`, `setName`) are kept and used when the parts mount, over the options; calls that act on a part (`select`, `goTo`, `showPanel`, `focus`, `openFind`, `present`, and the Studio's `setLayout`, `setZoom`, `fit`, `openLayout` and `commands.register`) are queued and run, in order, just before `mounted` is emitted, a later call to the same method replacing an earlier one. A React host can therefore pass a `density` that settles in its first effects. Only `setDocument` and `setSourceText` throw before `ready`: their result depends on the document.

## Layouts and parts

`layout: "full"` (default) builds a toolbar (the deck title, Undo, Redo, Find, the view switch, autosave, Export, Present, expand and ⋯; see [Toolbar and presets](#toolbar-and-presets)), the source pane, the slide, the slide row (previous, counter, next and thumbnails), a status line and a side panel (Review, and Design when on). `"canvas"` builds the slide and its slide row. `"embed"` (CE-28) builds the slide alone under a compact toolbar, for a page that shows a deck (a homepage hero): no source, no slide row, no side panel. `"viewer"` is a deck to look at: read-only (unless you pass `readOnly: false`), the slide with its title, counter, Present and expand, no source, no strip and no Undo keys; Export when the `toolbar` lists it. `"source"` builds only the source pane (its own bar, problems and status; no slide stage, no status line, no slide chunk), which fills the element. `"studio"` is the Presentation and Slide Studio and `"playground"` its first-contact preset, which `editor.setLayout()` switches between in place ([studio.md](studio.md)). `panels` turns any part on or off:

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

Slot names: `toolbar` and the toolbar items `title`, `history`, `counter`, `views`, `expand`, `designMenu`, `reviewPill`, `help` and `actions` (see [Toolbar and presets](#toolbar-and-presets)), `source`, `canvas`, `slide` (the element hidden while another view shows), `properties`, `navigator`, `thumbnails`, `slides`, `slideToolbar`, `sorter`, `outline`, `layouts`, `export`, `present`, `review`, `design`, `find`, `banner` and `autosave` (the restore prompt and the autosave line), `status`, `overlay`.

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
| `toolbar` | the toolbar's items in order, or `false` for no bar; see [Toolbar and presets](#toolbar-and-presets) |
| `expand` | `{ target, fullscreen }` for the expanded editor (the `expand` item, `editor.expand()`), or `false` to turn it off |
| `actions` | the host's own toolbar buttons (`{ id, label, icon, title, run, enabled, pressed, primary }`); see [Actions](#actions) |
| `designMenu` | `{ onOpenPanel }`: the Design quick menu's "More design options…" opens your own Design panel (the editor's own panel wins when it has one) |
| `slideActions` | "+" and the context menu on the thumbnail strip (default true in `full` and `embed`) |
| `guardUnload` | `true` (the browser asks before the page closes while `dirty`) or `(editor) => boolean`; see [Unsaved changes and save](#unsaved-changes-and-save) |
| `icons` | the chrome's icons by name, one flat map; see [styling](styling.md) |
| `theme` | see [theming](theming.md) and, for class hooks, layers and icons, [styling](styling.md) |
| `onChange`, `onSelection`, `onCursor`, `onError`, `onReady`, `on` | callbacks and listeners |

## The handle

`getDocument()` (frozen, replaced on every change, so a store snapshot) · `setDocument(document, { text, format, name, rebase })` (opens a document as one undoable change that forks no catalog record; the source pane shows `text` as written; a document the session refuses becomes a draft in the pane and the call returns `false`) · `setSourceText(text, { format, name, rebase })` (raw text in the source pane, below) · `session` · `canvas` · `sourcePane` and the other parts · `slideIndex`, `setSlide(index)`, `goTo(index, path)`, `select(path)` · `view`, `views`, `setView(view)` · `undo()`, `redo()`, `commit()` · `focus("source" | "canvas")` · `present()` · `openFind()` · `readSource()` · `sourceCursor` · `getDeckName()`, `setDeckName(name)` · `expand(on)`, `expanded` · `dirty`, `markSaved()`, `save()` · `setActions(list)` · `shortcuts()` · `toolbar`, `deckTitle`, `designMenu`, `reviewPill`, `helpButton`, `toolbarActions` · `setReadOnly`, `setTheme`, `setDensity`, `setExportMode` · `status(message)` · `on(event, listener)` (returns the unsubscribe) and `off` · `ready` · `destroy()`.

Events: `mounted` (the parts exist; the first update may still wait for fonts), `ready` (the first update is done), `change` (`{ document, canUndo, canRedo, event }`), `selection`, `cursor` (the caret of the source pane, below), `slide`, `view`, `source` (the verdict on the text: `valid`, `invalid` or `syntax`), `checking`, `fonts`, `geometry`, `sync` (after every update once fonts are ready, with the slide's geometry and layout notes computed when read), `render`, `draft`, `commit`, `cancel`, `status`, `error`, `kept`, `rename`, `export`, `persistence`, `review`, `panel`, `deckName` (`{ name, previous }`), `expand` (`{ expanded }`), `dirty` (`{ dirty }`), `save` (`{ document, text, format, draft }`), `review-open` (`{ counts, findings }`), `destroy`; the Studio adds `zoom`, `layout`, `command` and `layoutStudio`, and its `selection` carries the list (`items`, `primary`, `source`). An exception thrown by a listener is reported to `error` and does not stop the others.

While the text in the source pane is not a valid deck, the editor says so (`editor.inSync` is `false`): the slide shows the last valid document and is locked, Export, Present and Undo wait for the fix.

## Toolbar and presets

CE-28. The bar of the built layouts is a toolbar of named items (`src/toolbar.js`, `@openpresentation/opf-editor/toolbar`). It stays on one row: when the items do not fit the width of the bar (the bar's own width, so an editor in a narrow column collapses too, not only on a phone), the collapsible ones move into the ⋯ menu, lowest priority first, and come back as the bar widens. The ⋯ menu is a `role="menu"` built from what each collapsed part offers (its `menuItems()`): the arrow keys, Home and End move, Enter and Space run an item, Escape closes it and gives the focus back to ⋯, Tab leaves it. An item that opens something (Find's field, a popover) keeps the focus it takes. Under a coarse pointer every control of the bar is 44px and the title field 16px.

There are three ways to adopt it:

- **A. A preset.** `layout: "full"`, `"canvas"`, `"embed"` or `"viewer"` builds its toolbar. `toolbar: [...]` replaces the preset with your list, in your order, and an item can carry its own priority: `toolbar: ["title", "history", "spacer", { id: "export", priority: 90 }, "more"]`.
- **B. Items in your own elements.** `slots: { title, history, counter, views, expand, designMenu, reviewPill, help, actions }` mounts those items in your elements (your own header, say) and leaves them out of the bar; `toolbar: false` builds no bar at all. Slots that name only these items (and `toolbar`) keep the built layout. `slots.toolbar` is the element the whole bar is built in, the only way to have it with your own `slots` arrangement. When the expand button sits in a header outside the editor's element, give `expand: { target }` a wrapper that contains both: the expanded editor is an overlay, and what it does not contain is covered.
- **C. Headless.** Build your own bar from the handle (`getDeckName`, `setDeckName`, `undo`, `redo`, `setSlide`, `present`, `expand`) and its events (`deckName`, `change`, `slide`, `expand`), or from the part factories (`createDeckTitle` in `/deck-title`, `createExpandController` and `createExpandButton` in `/editor-expand`, `createSlideNavigator` in `/slide-navigator`, `createToolbar` in `/toolbar`, `createDesignMenu`, `createReviewPill`, `createHelpButton` and `createToolbarActions` in their own entries).

```js
// The homepage hero: the slide, its name, Undo and Redo, the counter, Expand and Present.
createOpfEditor(hero, { document, fonts, catalogs, layout: "embed" });

// The title and the counter in the host's own header; no bar.
createOpfEditor(el, { document, fonts, catalogs, toolbar: false, slots: { title: headerTitle, counter: headerCounter } });
```

| Item | What it is | Priority | In ⋯ when collapsed |
| --- | --- | --- | --- |
| `title` | the deck's `name`, edited in place (Enter renames and keeps the focus in the field, blur renames, Escape puts it back; an empty name removes it) | 95, fixed: it shrinks instead | – |
| `history` | Undo and Redo | 80 | Undo, Redo |
| `counter` | previous, the counter, next: a second slide navigator on the one slide index (it binds the arrow keys only when there is no slide row) | 85 | Previous slide, Next slide |
| `views` | the view switch (only with more than one view) | 40 | each view, the one on show checked |
| `find` | the Find button | 50 | Find… |
| `autosave` | the autosave line (with `persistence`) | 20 | – |
| `export` | the Export menu | 65 | Export… (opens the Export sheet, which keeps its progress and result on screen) |
| `present` | the Present button | 75 | Present |
| `expand` | expand the editor to fill the window (Escape returns it) | 70 | Expand editor |
| `design` | the Design quick menu: theme, colors, fonts and this slide's layout, each one undoable edit; "More design options…" opens the Design panel when there is one, or yours (`designMenu.onOpenPanel`). A preset leaves it out where the Design side panel is on (not in `embed`) | 35 | Design… |
| `review` | the review pill ("Valid", "3 issues"), fed by the Review counts; it opens the Review panel. Listed in a layout without one (the embed), the review runs headless for it and pressing it emits `review-open` (`{ counts, findings }`) for you to show the findings | 30 | Review (3) |
| `help` | the keyboard shortcuts sheet, listing `editor.shortcuts()` (the bindings this editor has); "?" opens it, except in `embed` and `viewer` | 10 | Keyboard shortcuts |
| `actions` | your own buttons (`actions`, `setActions`); hidden while there are none | 25; 90 while one action is `primary` (unless `toolbar` gives it a priority) | one entry per action |
| `more` | the ⋯ menu, shown only while something is in it | fixed | – |
| `spacer`, `\|` | the free space; a divider, shown only between two visible items | – | – |
| `zoom` | the Studio's own; left out by the workspace | – | – |

| Layout | Default `toolbar` |
| --- | --- |
| `full` | `title`, `history`, `find`, `views`, `spacer`, `actions`, `design`, `review`, `autosave`, `export`, `present`, `help`, `expand`, `more` |
| `canvas` | `title`, `history`, `spacer`, `actions`, `expand`, `more` |
| `embed` | `title`, `history`, `counter`, `spacer`, `actions`, `design`, `expand`, `present`, `more` |
| `viewer` | `title` (read-only), `counter`, `spacer`, `actions`, `present`, `expand`, `more` |
| `source`, `slots` | none (`slots.toolbar` with a `toolbar` list builds one) |
| `studio`, `playground` | the Studio's own bar, which shows the deck title and the expand button (before `topbarEnd`); `toolbar` is ignored, and the Studio's shortcut sheet lists its commands with the chrome's keys, the same list as `editor.shortcuts()` |

An item the editor has nothing for is left out (Export with `panels.export: false`, the views in a layout with one view). The embed and viewer layouts keep their keys to themselves: the arrows, F5, Ctrl/Cmd Z and S and "?" act only while the focus is inside the editor, so the page around it keeps its own. The strip's "+" and context menu (`slideActions`) are on in `full` (and an embed with thumbnails); "+" offers the deck's layouts, and read-only removes it.

### Actions

```js
const editor = createOpfEditor(el, {
  document, fonts, catalogs,
  actions: [
    { id: "share", label: "Share", primary: true, run: () => openShareDialog(editor.getDocument()) },
    { id: "publish", label: "Publish", enabled: () => !editor.dirty, run: () => publish(editor.getDocument()) },
  ],
});
editor.setActions([...]); // replace them later
```

Each `enabled()` and `pressed()` is read again after every change, selection, read-only switch, `dirty` change, expand and slide change; the buttons are disabled while the source text is not a valid deck. In the ⋯ menu each action is one entry.

### Unsaved changes and save

`editor.dirty` is true while the document differs from the baseline (what was last loaded with `setDocument` or `setSourceText`, or saved), or while the source pane holds a draft that is not a valid deck (it never reaches the document) whose text differs from the baseline's; `dirty` (`{ dirty }`) is told on every change of it. A copy or a download of the source (and a JSON, YAML or Markdown export) counts as saved. Ctrl/Cmd+S inside the editor (or on the page's body in `full`, `canvas` and the Studio, as Undo) emits `save` with `{ document, text, format, draft }` (`text` is the pane's text, a draft too, so you can keep it as a file) and keeps the browser's Save page from opening, only while something listens to `save`; `editor.save()` does the same from your own button. Call `editor.markSaved()` once you have stored it: it records the baseline and, with `persistence`, tells autosave too. `guardUnload: true` makes the browser ask before the page closes while dirty; a function `(editor) => boolean` decides itself, for a host with state of its own. React: `useOpfDirty(editor)`; Svelte: `opfDirty(editor)`.

```js
const editor = createOpfEditor(el, { document, fonts, catalogs, guardUnload: true });
editor.on("save", async ({ document, text, draft }) => {
  await store(draft ? text : JSON.stringify(document));
  editor.markSaved();
});
```

### Embedding in an iframe

The package playground (`examples/playground.html`, built by `pnpm run build:playground`) is what pptx.gallery embeds in an iframe. It shows the toolbar items in its own top bar (the title, the review pill, the Design menu, help and expand) and exposes the editor's handle as `window.opfEditor`: a same-origin host uses `iframe.contentWindow.opfEditor` (`getDocument`, `setDocument`, `on("change")`, `dirty`, `markSaved`, ...). A cross-origin host would need a `postMessage` protocol, which is not part of this package.

**The deck name.** `editor.getDeckName()` is the document's `name` (`""` without one; `getName`, `setName` and the `rename` event stay the source pane's file name). `editor.setDeckName(name)` renames as one validated, undoable edit through the session (trimmed; empty removes `name`), after committing an open canvas edit; it returns `false` while read-only, while the source text is not a valid deck, or when the edit was refused, and is queued before mount. `deckName` (`{ name, previous }`) is told whenever the name changes: from the title, the source pane, undo or the host. React: `const [name, setName] = useOpfDeckName(editor)`. Svelte: `opfDeckName(editor)` from `@openpresentation/opf-editor/svelte` is a store (`$name`, `bind:value={$name}`).

**Expand.** `editor.expand()` (or the `expand` item) makes the editor fill the window in place, without moving it in the DOM, so nothing is lost; Escape, the button again or `editor.expand(false)` returns it, and `expand` (`{ expanded }`) is told each time. The page behind is inert while it is expanded; your own header elements given as slots stay usable. `expand: { fullscreen: true }` also asks the browser for full screen (best effort), and `--opf-expand-z` sets the overlay's z-index (default 1000; the presenter is above it).

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

## Raw text and the exact-source writer

`setDocument` opens a document; a host that has text instead (a file as it was read, a buffer it keeps itself, a draft that does not parse) gives it to the pane as it is:

```js
// The pane shows the text byte for byte in its format (comments, spelling and line endings kept) and applies it when it reads as a deck.
const applied = editor.setSourceText(fileText, { format: "yaml", name: "q3-review" });
if (!applied) showProblems(editor.sourceState); // a draft: the pane lists its problems, the slide keeps the last valid document
```

It is what pasting the text over everything does: one undoable change when it applies (Undo, or Cmd/Ctrl+Z in the code, brings the old text back), nothing converted. An open canvas edit is committed first. It throws before `ready`, in a layout without a source pane and while read-only; `editor.sourcePane.setSourceText(text, { format, name })` is the same on the pane. Hosts that called `sourcePane.editor.api.replace(...)` for this use it instead.

A host that keeps the JSON text of a deck itself writes an edit back with the editor's own writer, so the author's bytes survive (only the changed values are rewritten):

```js
import { createSourceMemory, updateJsonSource } from "@openpresentation/opf-editor/exact-source";

const memory = createSourceMemory();                     // one per document
buffer = updateJsonSource(buffer, editedDeck, memory);    // indentation, key order, escapes and CRLF kept
```

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
