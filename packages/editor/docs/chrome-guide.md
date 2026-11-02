# The editor chrome: a task guide (CE-30)

This guide is for a developer who wants an editor in a page, with its title bar behaving the way the page needs. It is organised by task. Every code sample tagged with a file name (`js embed.js#mount`) is a region of a runnable example in [`examples/chrome/`](../examples/chrome/), and `test/chrome-guide.mjs` fails when the two drift apart. The examples run in a real browser in `test/chrome-examples-browser.mjs`.

The reference pages stay the reference: [embedding.md](embedding.md) (every option, the handle, the events), [theming.md](theming.md) (the tokens), [styling.md](styling.md) (classes, state attributes, icon names) and [web-component.md](web-component.md).

To run the examples:

```sh
pnpm run build           # the package (dist/)
pnpm run build:chrome-examples
# serve artifacts/chrome-examples with any static server, then open index.html
```

## Add an editor to a page in 5 minutes

Install the editor, the renderer (it draws the slides; an optional peer of the editor) and the default catalog, and fill a font folder from the installed packages. Nothing is requested from a font CDN, and the editor sends nothing anywhere.

```sh
npm install @openpresentation/opf-editor @openpresentation/opf-render @openpresentation/gallery
npx opf-preview-fonts public/opf-fonts     # Roboto at startup, every other face only when a deck draws it
```

Include the stylesheet once (`<link rel="stylesheet" href="/styles.css">`, or `import "@openpresentation/opf-editor/styles.css"` in a bundle) and give the editor an element with a size:

```html embed.html#markup
<div id="card" class="card"></div>
<p>The deck is called <strong id="deck-name"></strong>.</p>
```

```js embed.js#imports
import { createOpfEditor } from "@openpresentation/opf-editor/workspace";
import { gallery } from "@openpresentation/gallery";
import { loadPreviewFonts } from "@openpresentation/opf-render/preview-fonts";
```

```js embed.js#mount
const editor = createOpfEditor(document.querySelector("#card"), {
  document: deck,
  catalogs: [gallery],
  fonts: loadPreviewFonts("./opf-fonts/"),
  layout: "embed",
});
```

`deck` is an OPF object (or its JSON text). `fonts` accepts the promise `loadPreviewFonts` returns; the folder is resolved against the page. The editor owns the content of the element you give it; `editor.destroy()` leaves it empty. The result is the slide under a compact bar: the deck's name, Undo and Redo, the slide counter, Design, Expand and Present. [`embed.html`](../examples/chrome/embed.html) is the page.

The handle comes back at once and every method works from then on; `await editor.ready` when you need the parts drawn.

## Pick a preset

`layout` picks the arrangement the editor builds, and with it the toolbar. Pass `toolbar: [...]` to replace the toolbar of any of them.

| `layout` | What it builds | Toolbar items | Read-only | Keyboard shortcuts (Ctrl/Cmd Z, F5, arrows, `?`) |
| --- | --- | --- | --- | --- |
| `embed` | The slide alone under a compact bar. For a page that shows a deck: a homepage hero, a docs page, a card. | title, history, counter, spacer, actions, design, expand, present, more | no | only while the focus is inside the editor |
| `viewer` | A deck to look at. No source, no strip. Export when the `toolbar` lists it. | title, counter, spacer, actions, present, expand, more | yes (pass `readOnly: false` to edit) | only while the focus is inside the editor; no Undo keys |
| `canvas` | The slide and its slide row (previous, counter, next, thumbnails). | title, history, spacer, actions, expand, more | no | page-wide |
| `full` | The whole editor: source pane, slide, slide row, status line, side panel (Review, and Design when on). | title, history, find, views, spacer, actions, design, review, autosave, export, present, help, expand, more | no | page-wide |
| `source` | Only the source pane, with its own bar. No slide chunk is loaded. | none | no | the source pane's own |
| `studio`, `playground` | The Presentation and Slide Studio ([studio.md](studio.md)). Its own bar shows the deck title and Expand; `toolbar` is ignored. | the Studio's own | no | the Studio's commands ([studio.md](studio.md)) |

The bars, as they are drawn (`~~~` is the free space of `spacer`; an item the editor has nothing for, such as `actions` without any, is left out):

```text
embed    [Title        ] [Undo][Redo] [‹ 01 / 03 ›] ~~~~~~~~ [Design] [⤢ Expand] [▶ Present] [⋯]
viewer   [Title        ] [‹ 01 / 03 ›] ~~~~~~~~~~~~~~~~~~~~~ [Action…] [▶ Present] [⤢ Expand] [⋯]
canvas   [Title        ] [Undo][Redo] ~~~~~~~~~~~~~~~~~~~~~~ [Action…] [⤢ Expand] [⋯]
full     [Title ] [Undo][Redo] [Find] [Slide|Sorter|Outline|Layouts] ~~~ [Action…] [Design] [Review ✓]
         [saved] [Export] [▶ Present] [?] [⤢ Expand] [⋯]
```

The bar stays on one row. When it does not fit its own width (the bar's, so an editor in a narrow column collapses too, not only on a phone), the collapsible items move into the `⋯` menu, lowest priority first, and come back as the bar widens.

## Choose and order toolbar items

`toolbar` is a list of item names in the order they appear. An item can carry its own `priority` (higher stays visible longer) and say whether it may move into `⋯`.

```js
// Only the name and the history, then Expand on the right.
createOpfEditor(card, { document, catalogs, fonts, layout: "embed", toolbar: ["title", "history", "spacer", "expand"] });

// Keep Export in the bar longer than the default, and never fold Undo and Redo into the more menu.
createOpfEditor(card, { document, catalogs, fonts, toolbar: ["title", { id: "history", collapsible: false }, "spacer", { id: "export", priority: 90 }, "present", "more"] });
```

An item may be listed once (a name given twice throws); `spacer` and `|` may repeat.

| Item | What it is |
| --- | --- |
| `title` | The deck's `name`, edited in place. Fixed: it shrinks instead of moving. |
| `history` | Undo and Redo. |
| `counter` | Previous, `01 / 03`, next. |
| `views` | The view switch (Slide, Sorter, Outline, Layouts); only with more than one view. |
| `find` | The Find button. |
| `design` | The Design quick menu: theme, colors, fonts and this slide's layout, each one an undoable edit. |
| `review` | The review pill ("Valid", "3 issues"). In a layout without a Review panel it runs headless and pressing it emits `review-open`. |
| `autosave` | The autosave line (with `persistence`). |
| `export`, `present` | The Export menu, the Present button. |
| `expand` | Fill the window. |
| `actions` | The host's own buttons ([Host buttons](#host-buttons)). Hidden while there are none. |
| `help` | The keyboard shortcut sheet. |
| `more` | The `⋯` menu, shown only while something is in it. |
| `spacer`, `\|` | The free space; a divider between two visible items. |
| `{ id, priority }`, a name of your own | An empty slot for your own element, with its own priority. Put the element in `editor.toolbar.slot(id)` and register what it offers in `⋯` with `editor.toolbar.mount(id, { menuItems })`. The playground's Source, Save OPF and Import buttons are items like this. |

`zoom` is the Studio's own and is left out of the workspace's bars. Items and priorities in full: [embedding.md, Toolbar and presets](embedding.md#toolbar-and-presets). `toolbar: false` builds no bar at all, which is the starting point for the next two sections.

## Put items in your own header

Give an item its own element through `slots` and it is mounted there instead of in the bar. With `toolbar: false` and slots for the items you want, the page's own header carries the editor's controls:

```html own-header.html#markup
<div id="app" class="card">
  <header>
    <span class="brand">Acme Decks</span>
    <div id="header-title"></div>
    <div id="header-history"></div>
    <span class="grow"></span>
    <div id="header-counter"></div>
    <div id="header-design"></div>
    <div id="header-expand"></div>
  </header>
  <div id="editor"></div>
</div>
```

```js own-header.js#mount
const editor = createOpfEditor(document.querySelector("#editor"), {
  document: deck,
  catalogs: [gallery],
  fonts: loadPreviewFonts("./opf-fonts/"),
  layout: "embed",
  toolbar: false,
  slots: {
    title: document.querySelector("#header-title"),
    history: document.querySelector("#header-history"),
    counter: document.querySelector("#header-counter"),
    designMenu: document.querySelector("#header-design"),
    expand: document.querySelector("#header-expand"),
  },
  expand: { target: document.querySelector("#app") },
});
```

- The slot names of the items are `title`, `history`, `counter`, `views`, `expand`, `designMenu`, `reviewPill`, `help` and `actions`; `export`, `present` and `autosave` are also the slots of their items. An item given a slot is left out of the bar.
- Slots that name only these items (and `toolbar`) keep the built layout (here, `embed`). `slots.toolbar` is an element to build the whole bar in, when you want the bar but not in the default place.
- The `counter` slot is a second slide navigator on the one slide index.
- **Expand and your header.** The expanded editor is an overlay, and what it does not contain is covered (and made `inert`). When the Expand button lives in a header outside the editor's element, set `expand: { target }` to a wrapper that contains both, as above: the whole card expands, and the header's button still returns it. [`own-header.html`](../examples/chrome/own-header.html) is the page.

## Go headless

Build no bar, and drive the editor from your own controls through the handle and its events. The handle works from the first moment, before the parts have mounted.

```html headless.html#markup
<div id="app" class="card">
  <header>
    <input id="title" class="host-field" aria-label="Deck name">
    <button id="undo" class="host-button" type="button">Undo</button>
    <button id="redo" class="host-button" type="button">Redo</button>
    <button id="previous" class="host-button" type="button">Previous</button>
    <span id="counter" class="note" aria-live="polite"></span>
    <button id="next" class="host-button" type="button">Next</button>
    <button id="expand" class="host-button" type="button" aria-pressed="false">Expand</button>
    <span id="dirty" class="badge" data-dirty="false">Saved</span>
  </header>
  <div id="editor"></div>
</div>
```

```js headless.js#mount
const editor = createOpfEditor(document.querySelector("#editor"), {
  document: deck,
  catalogs: [gallery],
  fonts: loadPreviewFonts("./opf-fonts/"),
  layout: "embed",
  toolbar: false,
  expand: { target: document.querySelector("#app") },
});
```

Controls call the handle:

```js headless.js#controls
$("#title").addEventListener("change", (event) => editor.setDeckName(event.target.value));
$("#undo").addEventListener("click", () => editor.undo());
$("#redo").addEventListener("click", () => editor.redo());
$("#previous").addEventListener("click", () => editor.setSlide(editor.slideIndex - 1));
$("#next").addEventListener("click", () => editor.setSlide(editor.slideIndex + 1));
$("#expand").addEventListener("click", () => editor.expand(!editor.expanded));
```

Events tell the controls what the document did, whoever did it (the canvas, the source pane, undo, your own code):

```js headless.js#events
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
```

Events fire on changes, so read the starting state once (`editor.ready.then(...)`, as [`headless.js`](../examples/chrome/headless.js) does; [`headless.html`](../examples/chrome/headless.html) is the page). When you want the editor's own controls instead of rebuilding them, each part is a factory you can mount anywhere, over the session: `createDeckTitle` (`/deck-title`), `createExpandController` and `createExpandButton` (`/editor-expand`), `createSlideNavigator` (`/slide-navigator`), `createDesignMenu` (`/design-menu`), `createReviewPill` (`/review-pill`), `createHelpButton` (`/shortcuts-sheet`), `createToolbarActions` (`/toolbar-actions`) and `createToolbar` (`/toolbar`). Each follows one contract: `createX(container, options)` returns `{ element, setDensity, destroy, ... }`.

## Rename the deck

The deck's name is the document's `name`. It is not the source pane's file name (`getName`, `setName` and the `rename` event are that).

- `editor.getDeckName()` is the name (`""` without one).
- `editor.setDeckName(name)` renames as one validated, undoable edit through the session. The text is trimmed, and an empty name removes `name`. It returns `false` while the editor is read-only, while the source text is not a valid deck, or when the edit was refused; before the editor has mounted it is queued and returns `true`.
- The `deckName` event (`{ name, previous }`) fires whenever the name changes, from any source: the title field, the source pane, undo or your own call. That is why a label outside the editor stays right without any other wiring:

```js embed.js#deck-name
const label = document.querySelector("#deck-name");
label.textContent = deck.name;
editor.on("deckName", ({ name }) => {
  label.textContent = name || "Untitled presentation";
});
```

The event fires on a change, not at the start, so show `getDeckName()` once yourself, as above.

Two details of a field of your own: commit on Enter or blur (`change`, as in the headless example), because every commit is an undo step, and do not feed the trimmed value back on every keystroke (the trim would remove a space the person is still typing). The React example keeps a draft for the same reason.

## Expand to full screen

`editor.expand()` (or the `expand` item) makes the editor fill the window in place, without moving it in the DOM, so nothing is lost. Escape, the button again or `editor.expand(false)` returns it, and `expand` (`{ expanded }`) is told each time. `editor.expanded` is the state.

```js
createOpfEditor(card, {
  document, catalogs, fonts, layout: "embed",
  expand: { fullscreen: true },        // also ask the browser for full screen (best effort)
});
```

- `expand: { target }`: the element that fills the window. Default: the editor's own element. Give a wrapper when your header sits outside it ([Put items in your own header](#put-items-in-your-own-header)), and keep your own controls inside the wrapper.
- `expand: { fullscreen: true }` also asks the browser for full screen. It needs a user gesture, and in an iframe the frame must allow it (`allow="fullscreen"`); without it the fixed overlay is the expanded editor.
- `expand: false` turns it off; `editor.expand()` then returns `false`.
- The layer is `--opf-ui-z-overlay` (default 1000; the presenter is above it). Raise it above a sticky site header with `#editor { --opf-ui-z-overlay: 6000; }` ([styling.md](styling.md#expand)).
- While expanded, the page behind the target is `inert`.

## Unsaved changes and saving

The editor never stores anything unless you give it `persistence`. Saving is the host's: three pieces connect the editor to wherever you save.

- `editor.dirty` is true while the document differs from the last loaded or saved one. The `dirty` event (`{ dirty }`) tells every change of it.
- Ctrl/Cmd+S inside the editor emits `save` with `{ document, text, format, draft }` and keeps the browser's own Save page from opening (only while something listens to `save`). `editor.save()` does the same from a button of yours. `draft` is true while the source pane holds text that is not a valid deck; `text` is then what to keep as a file.
- `editor.markSaved()` tells the editor you have stored it: that is the new baseline, `dirty` becomes false.

```js full.js#save
editor.on("save", ({ document, draft }) => {
  if (draft) {
    status.textContent = "The source is not a valid deck yet: nothing was saved.";
    return;
  }
  localStorage.setItem(KEY, JSON.stringify(document));
  editor.markSaved();
  status.textContent = "Saved to this browser.";
});
```

```js full.js#dirty
const badge = document.querySelector("#dirty");
editor.on("dirty", ({ dirty }) => {
  badge.dataset.dirty = String(dirty);
  badge.textContent = dirty ? "Unsaved changes" : "All changes saved";
});
```

`guardUnload: true` makes the browser ask before the page closes while `dirty`; a function `(editor) => boolean` decides for a host with state of its own. In React, `useOpfDirty(editor)`; in Svelte, `opfDirty(editor)`.

Notes: Ctrl/Cmd+S is heard while the focus is inside the editor's element, or on the page's body (nothing focused) in the `full`, `canvas` and Studio layouts; `embed` and `viewer` hear it only inside. Enter in the title renames and keeps the focus in the field. A copy or a download of the source counts as saved. [`full.html`](../examples/chrome/full.html) is the page.

## Host buttons

`actions` puts your own buttons in the bar (the `actions` item, which the `full`, `canvas`, `embed` and `viewer` presets all list). Each one is a label, an optional icon (an SVG element, a function returning one, or 24x24 path data), what it does, and optionally when it is enabled and whether it is a toggle.

```js full.js#mount
const stored = localStorage.getItem(KEY);
const editor = createOpfEditor(document.querySelector("#editor"), {
  document: stored ? JSON.parse(stored) : deck,
  catalogs: [gallery],
  fonts: loadPreviewFonts("./opf-fonts/"),
  layout: "full",
  guardUnload: true,
  actions: [
    { id: "save", label: "Save", primary: true, enabled: () => editor.dirty, run: () => editor.save() },
    { id: "share", label: "Share", run: () => { status.textContent = "Share clicked: open your own dialog here."; } },
  ],
});
```

- `primary: true` fills the button with the accent color; `pressed()` makes it a toggle (`aria-pressed`); `enabled()` and `pressed()` are read again after every change, selection, read-only switch, `dirty` change (so `enabled: () => editor.dirty` just works), expand and slide change; for state of your own, call `editor.toolbarActions.refresh()` (or `editor.setActions([...])` to replace the list).
- The buttons are disabled while the source text is not a valid deck, and each is one entry in `⋯`.
- `actions` has a low priority (25), so on a narrow bar it is among the first things to move into `⋯`; while one of the actions is `primary` (Save above) the item's priority is 90, so it stays in the bar after everything but the title and the counter. A priority you give the item in `toolbar` wins.
- In the viewer, the same option adds a "Download" for the person looking at the deck. The converter is the host's (`@openpresentation/opf-pptx`); the editor just gives the button a place:

```js viewer.js#download
async function downloadPptx() {
  const bytes = await toPptx(editor.getDocument(), { catalogs: [gallery], fonts: await fonts });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }));
  link.download = `${editor.getDeckName() || "deck"}.pptx`;
  link.click();
  URL.revokeObjectURL(link.href);
}
```

```js viewer.js#mount
const editor = createOpfEditor(document.querySelector("#viewer"), {
  document: deck,
  catalogs: [gallery],
  fonts,
  layout: "viewer",
  actions: [{ id: "download", label: "Download PPTX", icon: "M12 4v11m0 0-4-4m4 4 4-4M5 20h14", run: downloadPptx }],
});
```

The viewer is read-only (the title shows as text, `setDeckName` returns `false`), has no Undo keys, and keeps Present and Expand. [`viewer.html`](../examples/chrome/viewer.html) is the page.

## Restyle it

The chrome is plain DOM with stable class names, state attributes and `--opf-ui-*` tokens, and [styling.md](styling.md) is the contract for all of them. There are four levers, lightest first: tokens (`theme.tokens`, or custom properties in CSS), classes and state attributes, the layered stylesheet (`styles.layered.css`, so a rule of yours wins without raising its specificity) and the `icons` option.

```html styled.html#css
<style>
  /* A dark bar: each part redeclares the tokens on itself, so set them on the bar and on every part inside it. */
  .opf-ws-bar,
  .opf-ws-bar .opf-ui {
    --opf-ui-bar-bg: #111827;
    --opf-ui-bar-fg: #f9fafb;
    --opf-ui-bar-border: #374151;
    --opf-ui-surface: #1f2937;
    --opf-ui-fg: #f9fafb;
    --opf-ui-muted: #374151;
    --opf-ui-muted-fg: #d1d5db;
    --opf-ui-border: #374151;
  }

  /* A pill-shaped review status, filled when there are errors. */
  .opf-review-pill {
    border-radius: 999px;
    padding-inline: 14px;
  }
  .opf-review-pill[data-severity="error"] {
    background: var(--opf-ui-danger);
    color: var(--opf-ui-surface);
  }
</style>
```

```js styled.js#mount
const editor = createOpfEditor(document.querySelector("#card"), {
  document: deck,
  catalogs: [gallery],
  fonts: loadPreviewFonts("./opf-fonts/"),
  layout: "embed",
  toolbar: ["title", "history", "counter", "spacer", "review", "expand", "more"],
  theme: {
    tokens: { titleFont: "Georgia, 'Times New Roman', serif", titleSize: "18px", titleWeight: "700" },
  },
  icons: {
    more: "M5 12h.01M12 12h.01M19 12h.01",       // 24x24 path data, stroked in currentColor
    expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
    valid: "M5 13l4 4L19 7",
  },
});
```

The page links `styles.layered.css` instead of `styles.css`. Colors and shape: [theming.md](theming.md) lists every token, in light and dark, and `theme.colorScheme` is `light`, `dark`, `auto` or `inherit` (the default: the host page decides, with `.dark` or `[data-theme="dark"]` on `<html>`). [`styled.html`](../examples/chrome/styled.html) is the page.

## Use the web component

`<opf-editor>` is the same editor as one tag, for a CMS, a WordPress page or a static site where no framework is in the picture. The `toolbar` attribute takes the item names, comma separated (or `none`), and `layout` takes any layout.

```html element.html#element
<opf-editor id="hero" layout="embed" toolbar="title,history,counter,spacer,expand" fonts="./opf-fonts/">
  <script type="application/json">
    {
      "name": "Launch plan",
      "language": "en-US",
      "design": { "theme": "classic", "fontScheme": "roboto" },
      "slides": [
        { "id": "why", "title": "Why now", "text": "The category is moving, and we are early." },
        { "id": "how", "title": "How we get there", "items": ["Ship the beta", "Land three design partners", "Open the waitlist"] }
      ]
    }
  </script>
</opf-editor>
<p>The deck is called <strong id="deck-name">Launch plan</strong>.</p>
```

```js element.js#define
import "@openpresentation/opf-editor/element/define";
import { gallery } from "@openpresentation/gallery";

// The tag is defined by the import above. Give it its catalogs before it mounts (it starts after the first microtask).
document.querySelector("#hero").catalogs = [gallery];
```

```js element.js#listen
const label = document.querySelector("#deck-name");
document.addEventListener("opf-deck-name", ({ detail }) => {
  label.textContent = detail.name || "Untitled presentation";
});
```

Every event of the handle is re-dispatched on the element as `opf-<name>` (`opf-deck-name`, `opf-dirty`, `opf-save`, `opf-expand`, `opf-review-open`, ...), bubbling and composed, with the handle's detail. `el.editor` is the handle, and `el.ready` a promise of it. To define the tag with default `catalogs` and `fonts` for every element, use `defineOpfEditorElement` from `@openpresentation/opf-editor/element` instead. Everything else (attributes, `src`, errors, lifecycle, fonts): [web-component.md](web-component.md). [`element.html`](../examples/chrome/element.html) is the page.

## React and Svelte

React 18 and 19: `<OpfEditor>` renders a `<div>` and takes the options of `createOpfEditor` as props (read once when it mounts; `theme`, `readOnly`, `view`, `density` and `exportMode` follow later renders). `onEditor` hands you the handle, and the hooks read it:

```jsx react.jsx#imports
import { OpfEditor, useOpfDeckName, useOpfDirty } from "@openpresentation/opf-editor/react";
import { gallery } from "@openpresentation/gallery";
import { loadPreviewFonts } from "@openpresentation/opf-render/preview-fonts";
```

```jsx react.jsx#app
function App() {
  const [editor, setEditor] = useState(null);
  const [name, setName] = useOpfDeckName(editor);
  const dirty = useOpfDirty(editor);
  const [draft, setDraft] = useState(null); // what is typed, until Enter or blur renames the deck

  return (
    <>
      <div className="row">
        <input
          className="host-field"
          aria-label="Deck name"
          value={draft ?? name}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => { if (draft !== null) setName(draft); setDraft(null); }}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
        />
        <span id="dirty" className="badge" data-dirty={dirty}>{dirty ? "Unsaved changes" : "Saved"}</span>
      </div>
      <div className="card">
        <OpfEditor
          layout="embed"
          document={deck}
          catalogs={[gallery]}
          fonts={fonts}
          style={{ height: "100%" }}
          onEditor={setEditor}
        />
      </div>
    </>
  );
}
```

`useOpfDeckName(editor)` is `[name, setName]` (`["", () => false]` while `editor` is `null`), and `useOpfDirty(editor)` is a boolean that is `false` until there is an editor. `fonts` there is the promise `loadPreviewFonts("./opf-fonts/")` made once, outside the component. [`react.html`](../examples/chrome/react.html) and [`react.jsx`](../examples/chrome/react.jsx) are the page and the source.

Svelte has no component: create the editor in `onMount`, and read it through two stores from `@openpresentation/opf-editor/svelte`, `opfDeckName(editor)` (writable: `$name`, `bind:value={$name}`) and `opfDirty(editor)` (readable). There is no Svelte example page, because Svelte needs its own compiler; the stores are covered by the package's unit tests.

```svelte
<script>
  import { onMount } from "svelte";
  import { createOpfEditor } from "@openpresentation/opf-editor/workspace";
  import { opfDeckName, opfDirty } from "@openpresentation/opf-editor/svelte";

  let host, name, dirty;
  onMount(() => {
    const editor = createOpfEditor(host, { document: deck, catalogs: [gallery], fonts, layout: "embed" });
    name = opfDeckName(editor);
    dirty = opfDirty(editor);
    return () => editor.destroy();
  });
</script>

<input bind:value={$name} aria-label="Deck name" />
{#if $dirty}<span>Unsaved changes</span>{/if}
<div bind:this={host} style="height: 420px"></div>
```

## In an iframe

An editor in an iframe keeps the page that hosts it apart from the page that runs it: the inner page is an ordinary page like the examples (its own stylesheet, its own fonts), and the outer page only sizes the frame. What crosses the boundary is the host's to define; the package has no message protocol.

- **Same origin.** The outer page reads the handle from the frame's window. Have the inner page expose it (`window.editor = editor`, as the examples do), then `frame.contentWindow.editor.on("deckName", ...)`, `getDocument()`, `markSaved()` and the rest work as in the page itself.
- **Another origin.** Post the events you care about from the inner page and check who sent them in the outer page:

```js
// Inside the frame: tell the page what happened.
editor.on("deckName", ({ name }) => parent.postMessage({ type: "opf:deckName", name }, "https://app.example.com"));
editor.on("dirty", ({ dirty }) => parent.postMessage({ type: "opf:dirty", dirty }, "https://app.example.com"));

// In the page that holds the frame: accept messages from that frame and that origin only.
window.addEventListener("message", (event) => {
  if (event.source !== frame.contentWindow || event.origin !== "https://editor.example.com") return;
  if (event.data?.type === "opf:deckName") label.textContent = event.data.name;
});
```

- **Expand fills the frame, not the window.** The expanded editor is a fixed overlay inside its own viewport. To fill the window, resize the frame from the outer page when the inner page reports `expand`, or set `expand: { fullscreen: true }` and give the frame `allow="fullscreen"` (the browser then shows the frame full screen).
- **Keys.** The `embed` and `viewer` layouts keep Ctrl/Cmd Z and S, F5, the arrows and `?` to themselves while the focus is outside them, which is what makes them safe in a frame that shares a window with other code. Clicking into the frame gives it the focus.
- **Theme.** The inner page follows its own `prefers-color-scheme`; pass `theme: { colorScheme: "dark" }` (or a query parameter your inner page reads) to match the outer page, and call `editor.setTheme(...)` when the outer page switches.

pptx.gallery embeds the playground this way, and the playground exposes its handle as `window.opfEditor` for a same-origin host ([embedding.md](embedding.md#embedding-in-an-iframe)).
