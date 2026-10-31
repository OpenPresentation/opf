# The `<opf-editor>` web component (CE-30)

`<opf-editor>` is the embeddable editor as one HTML tag: no framework, no build step beyond what loads a JavaScript module. It is for a CMS, a WordPress page, a static site or any page where React or Svelte is not in the picture. It wraps [`createOpfEditor`](embedding.md) (the same editor, options and handle) and adds only what a custom element needs: attributes, properties, DOM events and a lifecycle that follows the element.

```html
<link rel="stylesheet" href="/vendor/opf-editor/styles.css">
<script type="module">
  import "@openpresentation/opf-editor/element/define";
</script>

<opf-editor layout="embed" src="/decks/q3-review.json" style="height: 640px"></opf-editor>
```

Nothing is fetched until the page sets `src`, and nothing is sent anywhere: the editor runs in the page, and the host owns storage, auth and export.

## Install

```sh
npm install @openpresentation/opf-editor @openpresentation/opf-render @openpresentation/gallery
```

`@openpresentation/opf-render` is an optional peer of the editor, and the element needs it to draw slides (the canvas, the thumbnails and the presenter import it on demand). `@openpresentation/gallery` is the default catalog; the library imports no catalog data, so the page passes the catalogs it wants (below).

Two entry points, one decision:

| Entry | What it does |
| --- | --- |
| `@openpresentation/opf-editor/element/define` | Importing it defines `<opf-editor>`. It is the only file with a side effect, listed in the package's `sideEffects` so a bundler keeps the import. On a server (no `customElements`) it does nothing. |
| `@openpresentation/opf-editor/element` | `defineOpfEditorElement(name = "opf-editor", { fonts, catalogs } = {})` defines the element under a name you choose, with default `fonts` and `catalogs` for every element of that name, and returns the class. Importing it defines nothing. Defining twice returns the same class; a name that belongs to another element throws. |

Most pages need the second one, to hand the element its catalogs once:

```html
<script type="module">
  import { defineOpfEditorElement } from "@openpresentation/opf-editor/element";
  import { gallery } from "@openpresentation/gallery";

  defineOpfEditorElement("opf-editor", { catalogs: [gallery] });
</script>
```

### Without a bundler

The element is a plain ES module that imports the editor, core and the renderer by package name, so the page needs those names to resolve: bundle it (any bundler; each import is a standard package entry) or give the page an import map that points the names at files you serve yourself. There is no CDN in the picture on purpose: self-host the files, and keep the fonts on your own server too (below).

```html
<script type="importmap">
  { "imports": {
      "@openpresentation/opf-editor/": "/vendor/opf-editor/dist/",
      "@openpresentation/opf": "/vendor/opf/dist/index.js"
  } }
</script>
```

An import map covers only the names it lists, so every package the graph reaches needs an entry (core's subpaths, CodeMirror, `yaml`, `jsonc-parser`, the renderer's entries). A bundler resolves all of that for you, which is why the examples above assume one. The editor is large (CodeMirror and core); one bundle, loaded once per page, serves every element on it.

### Styles

The element renders in the light DOM, so the package stylesheet applies to it, and so do the page's own rules. Include the stylesheet once:

```html
<link rel="stylesheet" href="/vendor/opf-editor/styles.css">
```

(`@openpresentation/opf-editor/styles.css`, or `import "@openpresentation/opf-editor/styles.css"` in a bundle.) The editor's colors, radii and fonts are `--opf-ui-*` custom properties; see [theming](theming.md).

## Attributes

All are observed. A change after the editor is mounted is applied live where the editor supports it and otherwise remounts the editor on the same document (one remount, however many attributes change in a task). A value the editor rejects (`slide="second"`, an unknown `theme`) is reported as [`opf-error`](#errors) and the editor keeps running.

| Attribute | Value | Effect |
| --- | --- | --- |
| `layout` | any `createOpfEditor` layout: `embed`, `full`, `canvas`, `source`, `studio`, `playground`, `viewer` | Which arrangement the editor builds. The element does not interpret it: the editor validates it, so a layout it does not know is an [`opf-error`](#errors). Changing it remounts. |
| `toolbar` | comma-separated item names (`title, history, \|, export`) or `none` | The title bar items of the editor chrome, passed as the `toolbar` option (`none` becomes `false`). Applied live when the editor has `setToolbar`, else it remounts. |
| `readonly` | boolean (present or absent) | Read-only: the editor refuses its own writes and locks the slide and the code. Live. |
| `theme` | `light`, `dark` or `auto` | The color scheme (`theme.colorScheme`), merged over `options.theme`. Live. Without it the editor follows the page (`.dark` or `[data-theme="dark"]` on an ancestor). |
| `density` | `comfortable`, `touch` or `auto` | Control size. Live. |
| `slide` | whole number from 0 | The slide on show. Live. |
| `src` | URL of a deck | Fetched **only** when the page sets it. JSON, YAML or Markdown, read with `readDeckFile` (`@openpresentation/opf-editor/read-deck-file`): the file extension decides first, then the `Content-Type`, then the content. A change on a mounted element opens the new deck in the same editor, as one undoable change. A failed request or a file that is not a deck is an [`opf-error`](#errors) with `source: "src"`; nothing throws. |
| `fonts` | URL of a font root | The self-hosted font folder (the layout of `npx opf-preview-fonts public/opf-fonts`), loaded on demand with the renderer's `loadPreviewFonts`, as `<opf-deck fonts="/opf-fonts">` does. See [Fonts](#fonts). |

The attributes are also properties: `el.layout`, `el.toolbar`, `el.theme`, `el.density`, `el.src` (strings), `el.readOnly` (boolean, the `readonly` attribute) and `el.slide` (a number: the editor's current slide once mounted; setting it navigates).

## The document

The element opens, in this order of precedence:

1. the `document` property, when the page set one;
2. the deck at `src`;
3. an inline script child: `<script type="application/json">`, `application/yaml` or `text/markdown`.

```html
<opf-editor layout="canvas">
  <script type="application/yaml">
    name: Launch plan
    slides:
      - title: Why now
  </script>
</opf-editor>
```

The editor mounts in a `div` inside the element, so the inline script stays where you wrote it (browsers never run it). YAML and Markdown open in their own format in the source pane, with the text as written. The start waits until the parser has produced the element's children, so an element in the page source reads its inline script even when the module that defines it runs first.

## Properties

| Property | |
| --- | --- |
| `document` | Get: the live document of a mounted editor (frozen, replaced on every change), else the one it will open. Set: an object, or a string of JSON, YAML or Markdown. On a mounted editor it opens as one undoable change and fires `opf-change`; a document the editor refuses is an [`opf-error`](#errors). |
| `options` | More [`createOpfEditor` options](embedding.md#options) (`panels`, `persistence`, `export`, `theme` tokens, `on: { ... }` and the callbacks, ...). Attributes win over `options`. Setting a different object on a mounted element remounts it. |
| `fonts` | A fonts handle, a lease, a promise or a function of either (the [`fonts` option](embedding.md#options)), or a string: the URL of a font root. Wins over the `fonts` attribute and over the default of `defineOpfEditorElement`. |
| `catalogs` | The catalogs for the session and every draw (`[gallery]`). Wins over the default of `defineOpfEditorElement`. |
| `editor` | Read-only. The editor handle ([the handle](embedding.md#the-handle)); `null` before it is created, after the element is removed and when it could not be created. |
| `ready` | Read-only. A `Promise` of the handle, settled once the editor has mounted and drawn, and rejected when it could not be created (the reason is also an `opf-error`). It belongs to the editor that is coming: read it again after changing an attribute that remounts. A page that never awaits it gets no unhandled rejection. |

A property set on an element before the class is defined (a script that runs first) is picked up when the class upgrades the element.

```js
const el = document.querySelector("opf-editor");
el.options = { persistence: { key: "q3-review" } };
el.document = await (await fetch("/api/decks/12")).json();   // or YAML / Markdown text
const editor = await el.ready;
editor.undo();
```

## Events

Every event of the editor handle is re-dispatched on the element as a `CustomEvent` named `opf-<name>` (camelCase becomes kebab-case) with `bubbles: true` and `composed: true`; `detail` is the handle's event detail. A listener on the element, on a parent or on `document` hears them, also across a shadow boundary.

```js
document.addEventListener("opf-change", ({ target, detail }) => {
  save(target.dataset.deckId, detail.document);          // detail: { document, canUndo, canRedo, event }
});
el.addEventListener("opf-slide", ({ detail }) => console.log(detail.index, detail.count));
```

| Event | `detail` (as in `createOpfEditor`'s `on`) |
| --- | --- |
| `opf-mounted`, `opf-ready` | `{ editor }`: the parts exist; the first draw is done |
| `opf-change` | `{ document, canUndo, canRedo, event }` |
| `opf-selection`, `opf-cursor` | the canvas selection; the caret of the source pane |
| `opf-slide`, `opf-view`, `opf-panel`, `opf-layout`, `opf-zoom` | the slide (`{ index, count }`), the view, the side panel, the Studio preset and its zoom |
| `opf-layout-studio`, `opf-command` | Layout Studio opened or closed; a Studio command ran |
| `opf-source`, `opf-checking` | the verdict on the source text; the pane has text it has not applied |
| `opf-fonts`, `opf-geometry`, `opf-sync`, `opf-render` | font loading state; the slide's size; after every update; a slide was drawn |
| `opf-draft`, `opf-commit`, `opf-cancel` | an inline canvas edit and its end |
| `opf-status` | a message for the status line |
| `opf-error` | `{ error, message, ... }`; see [Errors](#errors) |
| `opf-kept`, `opf-rename`, `opf-export` | the source was copied or downloaded; the file was renamed; an export finished |
| `opf-persistence`, `opf-review`, `opf-review-goto`, `opf-review-focus` | autosave status; Review counts and its go-to and focus requests |
| `opf-deck-name`, `opf-expand` | the editor chrome's events (CE-28), forwarded once the editor emits them |
| `opf-destroy` | the editor was destroyed (the element was removed, or remounted) |

`opf-render`, `opf-sync`, `opf-geometry` and `opf-status` fire on every update; listen only to the ones you need. `OPF_EDITOR_EVENTS` and `opfEventType(name)` are exported from `@openpresentation/opf-editor/element`, and `OpfEditorElementEventMap` types the events for `addEventListener`.

### Errors

`opf-error` is the one place failures arrive; the element never throws out of an attribute change, a fetch or a property setter. `detail` is `{ error, message, source }`:

| `source` | When |
| --- | --- |
| `"src"` | the request failed (network, a status that is not 2xx) or the file is not a deck |
| `"inline"`, `"document"` | the inline script or a string `document` is not a deck in JSON, YAML or Markdown; the editor refused a document |
| `"mount"` | the editor could not be created: an unknown `layout`, a `view` the layout does not have, ... |
| `"layout"`, `"theme"`, `"slide"`, `"density"`, ... | the editor rejected that attribute's new value |
| none | an error the editor itself reported (a listener that threw, fonts a document needs, ...) |

After a failed start the element is empty (`data-opf-state="error"`, `ready` rejected) and starts again when something it reads changes: fix the attribute or set `document`.

## Lifecycle

- The editor is created when the element is connected, after the first microtask (so attributes set by the parser are in) and, in a page still being parsed, once the element's children exist. The element reflects its state as `data-opf-state="loading" | "ready" | "error"`: style it, or wait for it in a test.
- It is destroyed one microtask after the element leaves the document. Moving the element (a disconnect and a connect in one task: `parent.append(el)`, a reorder, a framework moving a node) keeps the same editor: nothing is destroyed or created, and no event fires. Removing it destroys the editor and everything it mounted (listeners, observers, styles), and leaves the element, with its inline script, as it was. Putting it back later opens a new editor on the document the old one had, edits included.
- Several elements on one page are independent: each has its own editor, and they share one copy of the editor code (and one fonts handle per font root).

## Fonts

Slide layout needs the fonts the deck draws. The element uses, in this order: the `fonts` property; the `fonts` default of `defineOpfEditorElement`; the `fonts` entry of `options`; the `fonts` attribute. With none of them it mounts without a fonts handle and draws with estimated layout and system fonts, fetching nothing. (`loadFonts()` from `@openpresentation/opf-render/fonts-browser` with no faces is an error, so there is no hidden default handle: a page that wants exact layout says where its fonts are.)

For exact layout give it a handle you built (`loadFonts({ faces })`, with the faces your page serves) or a font root:

```sh
npx opf-preview-fonts public/opf-fonts        # fills the folder from the installed packages; every file is hash-checked
```

```html
<opf-editor layout="embed" fonts="/opf-fonts" src="/decks/q3.json"></opf-editor>
```

The root has the renderer's `loadPreviewFonts` layout: Roboto Regular at startup, every other face only when a deck draws it, hash-verified, from your own server. Nothing is requested from a font CDN. A font root needs `@openpresentation/opf-render` (an optional peer of the editor) installed; a page that passes a handle does not load it for fonts.

## Sizing and styling

The element is `display: block`, `position: relative` and 600px high (240px at least) by default. The rule that says so has zero specificity (`:where(opf-editor)`), so any rule of the page, or an inline `style`, wins:

```css
opf-editor { height: 80vh; }
opf-editor[hidden] { display: none; }   /* hidden still works */
```

The editor fills the element (the host `div` inside it is `height: 100%`). Colors and shape are the `--opf-ui-*` tokens: set them on `opf-editor` or any ancestor, or pass `options.theme`. The default style is added once per document (or shadow root) as `<style data-opf-element-style>`.

## Server rendering and no JavaScript

Importing the element, or its define entry, on a server does nothing: no global is touched until `defineOpfEditorElement` runs in a browser, and the editor code is loaded only when a tag is connected. The server renders the tag and its inline script as ordinary HTML. Without JavaScript the page shows an empty block of the element's height and the deck data in the `<script>` (which browsers never run), so put a text fallback inside the tag:

```html
<opf-editor layout="embed">
  <script type="application/json">{ "name": "Q3 review", "slides": [ ... ] }</script>
  <noscript>This presentation needs JavaScript to be edited. <a href="/decks/q3.json">Download the deck</a>.</noscript>
</opf-editor>
```

## Limits

- `toolbar` and the `embed` and `viewer` layouts belong to the editor chrome (CE-28): the element passes the values through and lets the editor validate them.
- One editor per tag. A host that arranges its own panels (`slots`) or keeps state in React uses [`createOpfEditor`](embedding.md) or the [React bindings](embedding.md#react) directly; `el.editor` is the same handle.
