# Browser preview and live editing

Published editor 0.16.0 provides an embeddable SVG canvas in `@openpresentation/opf-editor/canvas`. OPF JSON remains the document; the canvas writes validated JSON Patch operations through an `EditorSession`. Draft edits render with the same SVG engine used for standalone previews. Completed edits produce one undoable change.

The published canvas covers the interactions below; complete PowerPoint feature coverage remains separate work. “Pixel perfect” is a fidelity target with specific prerequisites and remaining gaps described below.

## Install the published packages

Use Node 24 with core 0.16.0, renderer 0.16.0, editor 0.16.0 and PPTX 0.16.1:

```sh
npm install --save-exact @openpresentation/opf@0.16.0 @openpresentation/opf-render@0.16.0 @openpresentation/opf-editor@0.16.0 @openpresentation/opf-pptx@0.16.1
```

No paid service or provider account is required. The six agent skills install with `npx @openpresentation/cli@0.16.0 skills install`. See the [quickstart](quickstart.md) for an installed-package workflow and the [compatibility matrix](compatibility-matrix.md) for separately scoped browser and native evidence.

For library development, separately regenerate unpublished local preview tarballs from sibling checkouts:

```sh
pnpm build
node scripts/link-ecosystem.mjs
pnpm pack:ecosystem
pnpm test:packed-ecosystem
```

The packed consumer installs actual tarballs without workspace aliases, exercises editing/SVG/PPTX, checks TypeScript declarations, and bundles a browser entry without Node shims. For a public release, advance source versions and downstream minimums/lockfiles together and follow the release process.

The gallery host example also offers local PPTX file import with preview/diagnostics and editable PowerPoint download. It commits active canvas text before export, shares preview text measurements and applies imports as a single undoable change. Save OPF to preserve the original source; native PowerPoint positions, fonts and unsupported features can change during conversion. The browser E2E checks run offline after loading and inspect the downloaded native merged table, then reimport and undo/redo. Native edit/save/reopen is a separate targeted check, not a pixel-equivalence claim.

The editor exports in the browser (SVG through the renderer's browser entries, PPTX through opf-pptx). To export a saved presentation on a server, call `convert("deck.opf.json", "deck.pdf")` (or `convert(presentation, { format: "pdf" | "png" | "svg" | "pptx" })` for the bytes) from `@openpresentation/opf/node`, which draws with the same engines and the bundled fonts; `open("deck.pptx")` reads a PowerPoint file back into a presentation for the editor ([OPF files in Node](node.md)).

`pnpm prepare:gallery:registry` builds host controls from the immutable `exampleRefs.opf-editor` in `release-plan.json` while resolving libraries only from the fresh npm consumer. Package `verificationRefs` continue to point at actual published releases. The gallery manifest records both the example source hashes and registry package integrities. Updating example controls does not imply a new editor library release.

Script fonts: when the pinned editor example loads faces from `./script-fonts/` and the pinned renderer has the script pack (0.10.0 and later), the registry build also writes `script-fonts.json` and lists its hash in `manifest.json`. The manifest is the reviewable half: every `@expo-google-fonts/noto-*` package, exact version, SPDX license, license-file hash and each face's SHA-256, taken from the published renderer. The faces are binaries (63 files, 66.9 MiB), so they are never committed to the gallery repository. The gallery build copies them from its own pinned npm dependencies into the untracked `public/opf-editor/script-fonts/` directory, verifying every hash, and writes the license notices beside them; nothing is fetched from a font CDN. See `scripts/gallery-script-fonts.mjs` and the gallery's `scripts/prepare-editor-script-fonts.mjs`.

Base fonts (FF-41): when the pinned editor example loads `base-fonts.json` (opf-editor 0.10.5: the example passes the faces as the renderer's `extraLazyFonts`, renderer 0.11.7 and later; 0.10.4's example used its own `examples/base-font-gate.js`), the registry build starts the editor with Roboto Regular alone in `fonts.json` (217 KB instead of 12.8 MB) and writes every other eager face (Roboto in six more styles, Roboto Mono, the Office substitutes) as a separate file named after its hash beside it, listed with its SHA-256 in `base-fonts.json` and in `manifest.json`; the editor fetches only the faces a document draws, verified, through its font gate (`scripts/gallery-base-fonts.mjs`). An older pinned example keeps every eager face in `fonts.json`. A default Roboto deck loads about 0.7 MB of fonts instead of 12.8 MB.

Lazy fonts: when the pinned editor example calls `ensureLazyFonts` and the pinned renderer vendors faces (Intos for the default Aptos scheme and the open families, renderer 0.11.0 and later), the registry build also writes `lazy-fonts.json` and lists its hash in `manifest.json`. It pins every vendored package (exact version, SPDX license, license-file and notice hashes) and each face SHA-256, taken from the published renderer. The faces are binaries, so they are not committed either: the gallery build copies them from its pinned `@openpresentation/opf-render` package (`fonts/<name>/`) into the untracked `public/opf-editor/fonts/` directory, verifying every hash, and the editor fetches only the families a document uses, same-origin. See `scripts/gallery-lazy-fonts.mjs` and the gallery's `scripts/prepare-editor-lazy-fonts.mjs`.

The browser bundle links `playground.js.LEGAL.txt`, included in the hashed resources. It contains bundled license notices and package license files, including the vendored PptxGenJS MIT license. For dependencies that publish only an explicit MIT declaration in their README, the build retains that declaration/attribution and the standard terms; omitted upstream notices use a version-specific source URL and verified supplement hash. License collection runs offline from the verified installation and committed supplement. Runtime JavaScript is not rewritten to normalize comment whitespace.

## Embed in any browser application

Mount after the host DOM exists. The container controls width; the slide retains its aspect ratio. React and Svelte applications can mount this framework-independent API in their normal client lifecycle and destroy it on unmount.

```js
import { createCanvasEditor } from '@openpresentation/opf-editor/canvas';
import { loadFonts } from '@openpresentation/opf-render/fonts-browser';
import { defaultCatalog } from '@openpresentation/opf/catalog';

// Copy these licensed font files into your application's static assets first.
// Use pinned, static faces; include every weight/style required by your deck.
const fonts = await loadFonts({ faces: [
  { url: '/fonts/Roboto-Regular.ttf', family: 'Roboto', weight: 400 },
  { url: '/fonts/Roboto-Bold.ttf', family: 'Roboto', weight: 700 },
  { url: '/fonts/RobotoMono-Regular.ttf', family: 'Roboto Mono', weight: 400 },
] });

const canvas = createCanvasEditor(document.querySelector('#slide'), {
  presentation: {
    design: { theme: 'classic', fontScheme: 'roboto' },
    slides: [{ title: 'An editable presentation', text: 'Click to edit.' }],
  },
  catalogs: [defaultCatalog], // core ships no records: register the catalog the theme and font scheme above come from
  fonts,
  onCommit: ({ editor }) => {
    const updatedOPF = editor.presentation; // Host owns saving and collaboration.
    console.log(updatedOPF);
  },
  onError: error => console.error(error.message),
});
await canvas.ready;

// JSON or LLM patches also update the slide automatically.
canvas.editor.set('slides.0.title', 'Changes from another control');
canvas.editor.undo();

// On unmount:
// canvas.destroy();
// fonts.dispose();
```

`loadFonts` accepts explicit font-file URLs or `Uint8Array` data (`faces`). It uses the same bytes for Fontkit measurement and browser `FontFace` registration, awaits loading, reports failures, and exposes `dispose()` for its owned font faces; the handle's `pending` and `ensure` load the script and vendored faces a document needs, and the canvas waits for them before it renders. Cross-origin font URLs need CORS access. Load fonts once and share the handle between canvases. The canvas does not fetch fonts or catalog sources itself.

For standalone SVG export, pass the handle as `{ fonts }` to `renderSlideSvg` (one slide) or `renderSvg` (every slide); the export carries the font bytes and supplied license metadata. In a running browser canvas the registered fonts are already available, so embedding those bytes into every draft is unnecessary.

```js
import { renderSlideSvg } from '@openpresentation/opf-render/svg';
const svg = renderSlideSvg(canvas.editor.presentation, 0, { fonts });
```

The explicit `/svg` entry is browser safe. Browser-aware bundlers also select it for the renderer's root import. The Node root entry additionally supplies `svgToPng` and `svgToPdf`; those functions are not browser APIs.

## Editing behavior

| Content or action | Current behavior |
| --- | --- |
| Titles, subtitles, plain text, simple numeric values | One click enters editing with the caret at the clicked character (editor 0.10.2); press-drag selects a range; while editing, double-click selects a word and triple-click a paragraph. Focus a target and press Enter, Space or F2 to edit with all text selected. See *Text entry gestures* below. |
| Table headers and string/number cells | Inline editing; numeric cells keep their numeric type. |
| Lists, charts, metrics, quotes, code, timelines, rich text payloads | Select the object and edit its existing scalar fields in a floating form; valid drafts render immediately. A timeline event's `status` (`done`, `current`, `planned`) is a menu, not free text. |
| Images | Edit source/alt fields; replace with a local PNG/JPEG/GIF/WebP file up to 20 MB. External sources still require a host image resolver. |
| Collections | Add or remove the last item, subject to OPF schema validation. Empty structured collections may need authoring through source. |
| Dynamic layout | Text edits recompose the slide through shared geometry; row/column/grid controls remain in the demo inspector. |
| Undo and cancellation | Blur or Ctrl/Cmd+Enter commits plain text; Escape cancels; property forms have Apply/Cancel. |
| Changes elsewhere | Unrelated edits are preserved; a changed selected payload cancels the stale local draft instead of overwriting it. This is conflict protection, not a distributed collaboration protocol. |
| JSON editing | The demo Source view previews valid JSON beside the source; Apply records the document replacement. Invalid drafts retain the last valid preview. |

`createCanvasEditor` accepts an existing `editor` session or a `presentation`, plus `slideIndex`, `fonts` (the renderer's fonts handle), `renderOptions`, `textEntry` (`'click'` by default, or `'dblclick'`), an optional empty `propertiesContainer` to dock forms outside the slide, and callbacks `onSelect`, `onDraft`, `onCommit`, `onCancel`, `onRender`, and `onError`. The returned object exposes `editor`, `ready`, `select`, `beginEdit`, `editProperties`, `commit`, `cancel`, `setSlide`, `setRenderOptions`, `setLayoutEditing`, `render`, and `destroy`. `commit()` and setters return false if a draft cannot be committed. Avoid using public `render(presentation)` as a second source of truth; normal document changes should flow through the session.

## Text entry gestures

Editor 0.10.2 follows the PowerPoint and Google Slides convention. Hover outlines a text target. A single press (mouse, pen, or a touch tap) on editable text selects the box, starts inline editing and puts the caret at the nearest character boundary to the pointer, including in wrapped, multi-line, centered, right-aligned, right-to-left and CJK text. Press and drag selects the range from the press point to the release point and never moves the box. While editing, a native double-click selects a word, a triple-click a line or paragraph, and a click elsewhere moves the caret. Clicking a different text target commits the current edit (an invalid edit still refuses) and enters the new target in the same click. Rich text uses the same gestures through its own pointer mapping.

Keyboard entry keeps the replace convention: focus a target and press Enter, Space or F2 to edit with **all** text selected; `canvas.beginEdit(path)` does the same. Escape leaves editing and keeps the box selected. Images, video, charts and other non-text targets are unchanged: a click selects and a double-click opens their properties. Layout handles and block controls keep their own pointer handling.

`createCanvasEditor(container, { textEntry: 'dblclick' })` keeps the older two-step gesture (a click selects, a double-click enters), but the double-click now places the caret at the pointer instead of selecting everything. Tests and hosts that used `dblclick()` and then relied on all text being selected should enter with the keyboard (focus the target, press Enter) or select explicitly; on the default canvas `dblclick()` now places the caret and selects the word under it. Carets are resolved from the traced SVG glyphs (each rendered line carries its source range) and converted to offsets in the input value, so CRLF sources, tabs and wrapped whitespace map exactly; real operating-system IME and bidi caret behavior are not verified.

## Fidelity contract and remaining work

The same document, renderer version, dimensions, font bytes, and measurement provider produce the same SVG geometry in read and edit modes. Inline editing retains the actual SVG glyphs beneath a transparent native input; the input supplies the caret and selection. Browser regression checks compare draft text positions to standalone SVG rendering.

That is not a promise of identical raster pixels across browser engines, operating systems, or PowerPoint. Native caret/selection wrapping can differ from shaped SVG text, especially for mixed scripts, rich text, or unusual font features. Browser anti-aliasing and native PowerPoint typography also differ. Without a measurement provider the renderer uses deterministic estimates, which are not sufficient for a high-fidelity claim.

Still needed for the requested complete editor:

1. Continuous mixed-style typing and calibrated caret positioning, bidi/IME/vertical-script coverage. Rich text selection, formatting, links, and selected-text replacement are available through the [SVG formatting toolbar and range API](rich-text.md).
2. More placement constraints and specialized interactions for fixed promoted regions and individual object geometry. **Add content** and **Arrange** already support the insertion, duplication and deletion described below, track resizing, sibling block dragging, and moving complete blocks between existing groups or slides.
3. Full visual implementations for specialized charts, media playback, image crops/effects, theme chrome, and every catalog preset. Generic property editing does not imply complete renderer support.
4. Approved screenshot baselines across representative fonts/layouts/browsers, vertical metric tests, and native PPTX comparison/embedding work.
5. Broader font-family/script coverage and independently loadable font packs; the current base and Office substitute packs do not cover every requested font. Published packages, documentation examples and installed-package browser CI already exist.

Google Fonts supports browser loading through its CSS API, and its repository permits self-hosting subject to each font's license. The OPF fidelity path uses pinned files for reproducibility instead of depending on whichever variant a hosted stylesheet returns. Keep the font's accompanying license. Sources: [Google Fonts CSS API](https://developers.google.com/fonts/docs/css2), [Google Fonts files and licenses](https://github.com/google/fonts/blob/main/README.md).

The [font roadmap](plans/font-roadmap.md) covers the starter Office substitutes and remaining families.

## Verification

`pnpm demo:editor` builds the playground and `/canvas-tests.html`. The browser harness exercises real font registration, live drafts, text-position parity, one-step undo, cancellation, external edit conflicts, number validation, table cells, structured payloads, collection changes, and cleanup. Node tests cover escaped field paths, typed values, immutable drafts, font loader failures and aborts. The renderer's 126-deck corpus and the coordinated CI's pinned furniture PNG baseline are separate checks. Current installed-package and browser results are recorded in the [compatibility matrix](compatibility-matrix.md); neither those checks nor historical rasters establish general native Office parity.

## Copy, paste, files, and galleries

The demo's **Copy OPF** dialog exports the whole presentation, the current slide with its design/catalogs/assets, or the selected JSON value. Choose readable JSON, compact JSON, or a Markdown code block for an LLM. The slide toolbar and selection inspector offer direct shortcuts. If clipboard permission is unavailable, **Select all** provides a manual copy fallback.

**Add OPF** accepts a document, one slide, a slide array, a JSON value, or a single fenced JSON/OPF block. Paste into its text box, choose a `.opf`/`.json` file, drop a file on the editor, or load a public JSON URL. Preview first, then insert after the current slide, open a presentation, or replace selected content. Imports are validated and create one undo step. Normal copy/paste inside text fields remains native. Outside text fields, Cmd/Ctrl+V opens import review; Cmd/Ctrl+Shift+C opens Copy OPF; Cmd/Ctrl+O opens file import.

**Browse galleries** includes 854 examples generated from the sibling PPTX.gallery checkout and a separate live PPTX.gallery registry. Search by name, category, or description. Select an entry to preview, copy its OPF, or insert it. **Manage galleries** adds/removes custom registry URLs; custom sources persist in this browser's local storage. Host defaults are defined in `opf-editor/examples/galleries.json`. The bundled snapshot is regenerated by `pnpm demo:editor`; it does not update in the background. Some presets are minimal definition examples rather than completed presentation slides.

Public PPTX.gallery detail links for layouts, colors, typography, themes, charts, backgrounds, narratives, blocks, and image treatments can be entered in the URL tab. Other sites should expose a direct OPF document or a registry JSON endpoint. Cross-origin servers must enable CORS. Requests omit credentials and referrers, are cancelable, and cap responses at 20 MB. A registry item's URL must stay on the configured origin; explicitly load another origin's URL when intended. The editor does not scrape arbitrary HTML pages or automatically load external fonts/catalog sources.

A custom registry can mix inline OPF and relative document URLs:

```json
{
  "name": "Team slides",
  "items": [
    { "id": "intro", "name": "Introduction", "category": "Team", "opf": { "slides": [{ "title": "Hello" }] } },
    { "id": "metrics", "name": "Metrics", "opfUrl": "./metrics.opf.json" }
  ]
}
```

Imported documents should embed the catalog records and assets they use. Inserting slides copies their records with core `copySlides`: groups match by `source`, an identical record is reused, a differing `custom` record is renamed `<id>-2` and a differing catalog revision moves into `custom` as `<id>-2`, so the inserted slides look the same and the existing slides stay intact. It does not merge presentation-level speakers, organizations, or narrative metadata into the current deck. Open as a presentation to retain the complete source document.

The reusable npm APIs are browser-safe and independent of the demo UI:

```js
import { parseOpfTransfer, serializeOpfTransfer, prepareOpfImport } from '@openpresentation/opf-editor/transfer';
import { loadOpfGallery, loadOpfGalleryItem } from '@openpresentation/opf-editor/galleries';

const markdown = serializeOpfTransfer(editor.presentation, {
  scope: 'slide', slideIndex: 0, format: 'markdown',
});
const parsed = parseOpfTransfer(markdown);
const result = prepareOpfImport(editor.presentation, parsed, {
  mode: 'insert', slideIndex: 0,
});
// Host previews result.presentation before applying this single undoable change.
editor.applyPatch([{ op: 'replace', path: '', value: result.presentation }], {
  source: 'import', rejectInvalid: true,
});

const gallery = await loadOpfGallery('https://example.com/registry.json');
const presentation = await loadOpfGalleryItem(gallery.items[0], { gallery: gallery.url });
```

Both gallery functions accept an `AbortSignal` and an injected `fetch` for host integrations and tests. Import/copy tests cover format round trips, invalid inputs, conflicting IDs and references, source isolation, and one-step undo; the generated 854-example snapshot is checked through insertion and SVG rendering.

## All OPF properties

**All properties** opens the schema-driven workspace beside a live SVG preview. Use Presentation, Current slide, Selection, or Design to navigate; add optional fields, select structured value forms, edit arrays/maps, and Apply a validated change with one undo step. Click content in the preview to locate its field. Nonvisual metadata remains part of the OPF document. A dirty draft must be applied or discarded before closing.

The `/schema` and `/schema-inspector` npm exports provide the reusable model and DOM inspector. `createSchemaInspector(container, {editor, path, onDraft})` exposes `navigate`, `commit`, `reset`, `destroy`, and read-only `presentation`/`dirty` getters. Use `onDraft` to render valid previews. The companion gallery `/spec` reference indexes the same 604 property definitions, and `/editor` embeds the shared browser build.

See [spec coverage](plans/spec-editor-coverage.md) for the distinction between complete field discovery and the remaining WYSIWYG rendering work.

## Create, duplicate and delete content

Use **Add content** in the editor toolbar, or the canvas button in Arrange mode. Choose a content kind, destination and insertion position. Starter content covers text, lists, charts, tables, metrics, quotes, code, timelines and groups. Image insertion accepts a local PNG/JPEG/WebP file or a source; local files are embedded as data URLs. Video insertion stores a source, but playback and native video export remain separate work. Source URLs and asset references still need the host's supported asset-resolution behavior.

Arrange handles also offer **Duplicate**, **Delete**, **Add after** and, for groups, **Add inside**. Duplication copies the complete content subtree while retaining asset references. Deletion prunes empty ancestor groups or their named region, preserving the slide and its metadata. Removing the last root block leaves a valid empty slide. Every operation preflights the complete candidate with the shared renderer and commits one undo step; stale forms are dismissed and strict overflow fails before mutation.

Adding to implicit root content or a named-region leaf converts existing payloads into explicit blocks in the renderer's canonical field order. Headings, notes, design, metadata and neighboring regions stay intact. Named regions are kept in their existing positions; choose one as the destination. Existing composition weights remain attached to positions, so insertion/deletion can change which content occupies a weighted slot.

```js
import {
  prepareBlockInsert, prepareBlockDuplicate, prepareBlockRemove, createContentBlock,
  listBlockContainers,
} from '@openpresentation/opf-editor/layout';
const containers = listBlockContainers(editor.presentation, {includeImplicit: true});
const prepared = prepareBlockInsert(editor.presentation, containers[0].path,
  createContentBlock('table')); // omit index to append
// Render prepared.presentation with your intended fonts before applying.
editor.applyPatch(prepared.patches, {rejectInvalid: true});
// Duplicate/remove take complete paths such as /slides/0/blocks/1.
// canvas.openInsertMenu(containerPath?, index?) opens the browser palette.
```

The headless helpers return `{presentation, patches, path, changed}` and include expected-value guards. Preserve those guards when applying patches. They need no browser, AI provider, account or hosted service. These helpers are published in editor 0.8.0; use the coordinated versions above and check installed exports when working with older packages. `/create-tests.html` and its installed-package equivalent exercise creation, image bytes, regions, duplication, deletion, strict-fit rejection, keyboard focus and undo.
