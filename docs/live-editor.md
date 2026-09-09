# Browser preview and live editing

The current local preview provides an embeddable SVG canvas in `@openpresentation/opf-editor/canvas`. OPF JSON remains the document; the canvas writes validated JSON Patch operations through an `EditorSession`. Draft edits render with the same SVG engine used for standalone previews. Completed edits produce one undoable change.

This is a working preview release, not complete PowerPoint feature coverage. “Pixel perfect” is a fidelity target with specific prerequisites and remaining gaps described below.

## Install the published packages

The verified public set is core 0.7.0, renderer 0.5.0, editor 0.4.0 and PPTX 0.5.1. Install with `npm install @openpresentation/opf@0.7.0 @openpresentation/opf-render@0.5.0 @openpresentation/opf-editor@0.4.0 @openpresentation/opf-pptx@0.5.1`. No paid service or provider account is required. The six agent skills install with `npx @openpresentation/cli@latest skills install`.

For library development, separately regenerate unpublished local preview tarballs from sibling checkouts:

```sh
pnpm build
node scripts/link-ecosystem.mjs
pnpm pack:ecosystem
pnpm test:packed-ecosystem
```

The packed consumer installs actual tarballs without workspace aliases, exercises editing/SVG/PPTX, checks TypeScript declarations, and bundles a browser entry without Node shims. For a public release, advance source versions and downstream minimums/lockfiles together and follow the release process.

The gallery host example also offers local PPTX file import with preview/diagnostics and editable PowerPoint download. It commits active canvas text before export, shares preview text measurements and applies imports as a single undoable change. Save OPF to preserve the original source; native PowerPoint positions, fonts and unsupported features can change during conversion. The browser E2E checks run offline after loading and inspect the downloaded native merged table, then reimport and undo/redo. Native edit/save/reopen is a separate targeted check, not a pixel-equivalence claim.

`pnpm prepare:gallery:registry` builds host controls from the immutable `exampleRefs.opf-editor` in `release-plan.json` while resolving libraries only from the fresh npm consumer. Package `verificationRefs` continue to point at actual published releases. The gallery manifest records both the example source hashes and registry package integrities. Updating example controls does not imply a new editor library release.

## Embed in any browser application

Mount after the host DOM exists. The container controls width; the slide retains its aspect ratio. React and Svelte applications can mount this framework-independent API in their normal client lifecycle and destroy it on unmount.

```js
import { createCanvasEditor } from '@openpresentation/opf-editor/canvas';
import { loadBrowserFontRegistry } from '@openpresentation/opf-render/fonts-browser';

// Copy these licensed font files into your application's static assets first.
// Use pinned, static faces; include every weight/style required by your deck.
const fonts = await loadBrowserFontRegistry([
  { url: '/fonts/Roboto-Regular.ttf', family: 'Roboto', weight: 400 },
  { url: '/fonts/Roboto-Bold.ttf', family: 'Roboto', weight: 700 },
  { url: '/fonts/RobotoMono-Regular.ttf', family: 'Roboto Mono', weight: 400 },
]);

const canvas = createCanvasEditor(document.querySelector('#slide'), {
  document: {
    design: { theme: 'classic', fontScheme: 'roboto' },
    slides: [{ title: 'An editable presentation', text: 'Double-click to edit.' }],
  },
  renderOptions: { textMeasurement: fonts.textMeasurement },
  onCommit: ({ editor }) => {
    const updatedOPF = editor.document; // Host owns saving and collaboration.
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

`loadBrowserFontRegistry` accepts explicit font-file URLs or `Uint8Array` data. It uses the same bytes for Fontkit measurement and browser `FontFace` registration, awaits loading, reports failures, and exposes `dispose()` for its owned font faces. Cross-origin font URLs need CORS access. Load fonts once and share the registry between canvases. The canvas does not fetch fonts or catalog sources itself.

For standalone SVG export, pass `fonts.embeddedFonts` to `renderSvg`; the export carries the font bytes and supplied license metadata. In a running browser canvas the registered fonts are already available, so embedding those bytes into every draft is unnecessary.

```js
import { renderSvg } from '@openpresentation/opf-render/svg';
const svg = renderSvg(canvas.editor.document, {
  textMeasurement: fonts.textMeasurement,
  embeddedFonts: fonts.embeddedFonts,
});
```

The explicit `/svg` entry is browser safe. Browser-aware bundlers also select it for the renderer's root import. The Node root entry additionally supplies `svgToPng` and `svgToPdf`; those functions are not browser APIs.

## Editing behavior

| Content or action | Current behavior |
| --- | --- |
| Titles, subtitles, plain text, simple numeric values | Double-click or focus and press Enter/Space to edit on the slide. |
| Table headers and string/number cells | Inline editing; numeric cells keep their numeric type. |
| Lists, charts, metrics, quotes, code, timelines, rich text payloads | Select the object and edit its existing scalar fields in a floating form; valid drafts render immediately. |
| Images | Edit source/alt fields; replace with a local PNG/JPEG/GIF/WebP file up to 20 MB. External sources still require a host image resolver. |
| Collections | Add or remove the last item, subject to OPF schema validation. Empty structured collections may need authoring through source. |
| Dynamic layout | Text edits recompose the slide through shared geometry; row/column/grid controls remain in the demo inspector. |
| Undo and cancellation | Blur or Ctrl/Cmd+Enter commits plain text; Escape cancels; property forms have Apply/Cancel. |
| Changes elsewhere | Unrelated edits are preserved; a changed selected payload cancels the stale local draft instead of overwriting it. This is conflict protection, not a distributed collaboration protocol. |
| JSON editing | The demo Source view previews valid JSON beside the source; Apply records the document replacement. Invalid drafts retain the last valid preview. |

`createCanvasEditor` accepts an existing `editor` session or a `document`, plus `slideIndex`, `renderOptions`, an optional empty `propertiesContainer` to dock forms outside the slide, and callbacks `onSelect`, `onDraft`, `onCommit`, `onCancel`, `onRender`, and `onError`. The returned object exposes `editor`, `ready`, `select`, `beginEdit`, `editProperties`, `commit`, `cancel`, `setSlide`, `setRenderOptions`, `setLayoutEditing`, `render`, and `destroy`. `commit()` and setters return false if a draft cannot be committed. Avoid using public `render(document)` as a second source of truth; normal document changes should flow through the session.

## Fidelity contract and remaining work

The same document, renderer version, dimensions, font bytes, and measurement provider produce the same SVG geometry in read and edit modes. Inline editing retains the actual SVG glyphs beneath a transparent native input; the input supplies the caret and selection. Browser regression checks compare draft text positions to standalone SVG rendering.

That is not a promise of identical raster pixels across browser engines, operating systems, or PowerPoint. Native caret/selection wrapping can differ from shaped SVG text, especially for mixed scripts, rich text, or unusual font features. Browser anti-aliasing and native PowerPoint typography also differ. Without a measurement provider the renderer uses deterministic estimates, which are not sufficient for a high-fidelity claim.

Still needed for the requested complete editor:

1. Continuous mixed-style typing and calibrated caret positioning, bidi/IME/vertical-script coverage. Rich text selection, formatting, links, and selected-text replacement are available through the [SVG formatting toolbar and range API](rich-text.md).
2. Object insertion/deletion and more placement constraints. **Arrange** supports track resizing, sibling block dragging, and moving complete blocks between existing groups or slides. Fixed promoted regions and individual object geometry still need specialized interactions.
3. Full visual implementations for specialized charts, media playback, image crops/effects, theme chrome, and every catalog preset. Generic property editing does not imply complete renderer support.
4. Approved screenshot baselines across representative fonts/layouts/browsers, vertical metric tests, and native PPTX comparison/embedding work.
5. Public package release with coordinated versions, smaller optional font packs, documentation examples, and browser regression automation in CI.

Google Fonts supports browser loading through its CSS API, and its repository permits self-hosting subject to each font's license. The OPF fidelity path uses pinned files for reproducibility instead of depending on whichever variant a hosted stylesheet returns. Keep the font's accompanying license. Sources: [Google Fonts CSS API](https://developers.google.com/fonts/docs/css2), [Google Fonts files and licenses](https://github.com/google/fonts/blob/main/README.md).

The [font roadmap](plans/font-roadmap.md) covers the starter Office substitutes and remaining families.

## Verification

`pnpm demo:editor` builds the playground and `/canvas-tests.html`. The browser harness exercises real font registration, live drafts, text-position parity, one-step undo, cancellation, external edit conflicts, number validation, table cells, structured payloads, collection changes, and cleanup. Node tests cover escaped field paths, typed values, immutable drafts, font loader failures and aborts. The renderer's 126-deck smoke corpus still passes; its historical PNG golden baseline remains skipped because it targets another OPF commit.

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

Imported documents should contain their required inline catalog records and assets. Inserting namespaces catalog IDs and conflicting asset/slide IDs, preserves the source slides' main design defaults, and leaves existing slides intact. It does not merge presentation-level speakers, organizations, or narrative metadata into the current deck. Open as a presentation to retain the complete source document. Conflicting or unresolved external catalog sources require a self-contained document before insertion.

The reusable npm APIs are browser-safe and independent of the demo UI:

```js
import { parseOpfTransfer, serializeOpfTransfer, prepareOpfImport } from '@openpresentation/opf-editor/transfer';
import { loadOpfGallery, loadOpfGalleryItem } from '@openpresentation/opf-editor/galleries';

const markdown = serializeOpfTransfer(editor.document, {
  scope: 'slide', slideIndex: 0, format: 'markdown',
});
const parsed = parseOpfTransfer(markdown);
const result = prepareOpfImport(editor.document, parsed, {
  mode: 'insert', slideIndex: 0,
});
// Host previews result.document before applying this single undoable change.
editor.applyPatch([{ op: 'replace', path: '', value: result.document }], {
  source: 'import', rejectInvalid: true,
});

const gallery = await loadOpfGallery('https://example.com/registry.json');
const document = await loadOpfGalleryItem(gallery.items[0], { gallery: gallery.url });
```

Both gallery functions accept an `AbortSignal` and an injected `fetch` for host integrations and tests. Import/copy tests cover format round trips, invalid inputs, conflicting IDs and references, source isolation, and one-step undo; the generated 854-example snapshot is checked through insertion and SVG rendering.

## All OPF properties

**All properties** opens the schema-driven workspace beside a live SVG preview. Use Presentation, Current slide, Selection, or Design to navigate; add optional fields, select structured value forms, edit arrays/maps, and Apply a validated change with one undo step. Click content in the preview to locate its field. Nonvisual metadata remains part of the OPF document. A dirty draft must be applied or discarded before closing.

The `/schema` and `/schema-inspector` npm exports provide the reusable model and DOM inspector. `createSchemaInspector(container, {editor, path, onDraft})` exposes `navigate`, `commit`, `reset`, `destroy`, and read-only `document`/`dirty` getters. Use `onDraft` to render valid previews. The companion gallery `/spec` reference indexes the same 604 property definitions, and `/editor` embeds the shared browser build.

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
const containers = listBlockContainers(editor.document, {includeImplicit: true});
const prepared = prepareBlockInsert(editor.document, containers[0].path,
  createContentBlock('table')); // omit index to append
// Render prepared.document with your intended fonts before applying.
editor.applyPatch(prepared.patches, {rejectInvalid: true});
// Duplicate/remove take complete paths such as /slides/0/blocks/1.
// canvas.openInsertMenu(containerPath?, index?) opens the browser palette.
```

The headless helpers return `{document, patches, path, changed}` and include expected-value guards. Preserve those guards when applying patches. They need no browser, AI provider, account or hosted service. Current APIs are in coordinated local previews; check installed exports before assuming public registry availability. `/create-tests.html` and its installed-package equivalent exercise creation, image bytes, regions, duplication, deletion, strict-fit rejection, keyboard focus and undo.
