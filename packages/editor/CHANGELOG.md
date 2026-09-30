# Changelog

## Unreleased

## 0.10.1

- Release 0.10.1 (patch: additive `/canvas` exports and an opt-in font gate; no public export removed). Core floor stays `@openpresentation/opf` ^0.11.2 and the optional peer `@openpresentation/opf-render` stays ^0.11.0 (`createFontGate` treats a registry without the lazy loaders as having nothing pending, so older renderers keep working unchanged); development dependencies move to renderer ^0.11.2 and `@openpresentation/opf-pptx` ^0.11.1. New `/canvas` exports: `createFontGate`, `whenFontsReady`, `FONTS_PENDING`, `FONTS_UNAVAILABLE` and the `fonts`/`onFonts` canvas options (FF-41, #46; details below).

- FF-41: every path that sets a new document or draws a slide loads the fonts the document needs before it renders. Published 0.10.0 re-rendered the main canvas first (the canvas subscribes to the session itself), so an Aptos deck with Japanese text applied from the Source dialog (also the pptx.gallery handoff) showed "Preview unavailable ... Intos Display cannot display U+65E5" although the Source preview had drawn it. New `createFontGate(registry)`, `whenFontsReady` and the `fonts`/`onFonts` canvas options (exported from `/canvas`): with a gate the canvas shows "Loading fonts…", loads the faces (vendored faces, then script faces; a bounded number of rounds) and renders only then, for editor changes, undo/redo, imports, dimension switches, slide changes and in-progress edits (a draft that needs a script face waits for it). A failed load is reported, offers "Retry loading fonts" and is not retried by itself. The playground's Source Apply, import, data import, properties preview, PPTX export, slide navigation and thumbnails all go through the same gate. Its layout panel, Paginate and PowerPoint export use a per-document script-aware measurement (`createScriptTextMeasurement`), because `composeSlide` with the plain registry measurement threw for Japanese under Aptos even with every face loaded. New browser tests: `test/playground-ensure-fonts.mjs` and `test/canvas-fonts-browser.mjs` (in `test:playground`), `test/font-gate.mjs` (in `npm test`). Development renderer pin moves to 0.11.1. No public export is removed.

## 0.10.0

- Release 0.10.0 (minor: new core floor and the optional renderer peer moves to the 0.11 line; no editor source change since 0.9.0, no public export removed). Require `@openpresentation/opf` ^0.11.2, the optional peer `@openpresentation/opf-render` ^0.11.0 and (development/playground) `@openpresentation/opf-pptx` ^0.11.0. Core 0.11.2 centers cover slides, so preview, export and editing agree only when all engines resolve the same core; install editor 0.10.0 with renderer 0.11.0, PPTX 0.11.0 and core 0.11.2. With renderer 0.11.0 the playground activates the automatic script fonts (#40) and lazy Intos fonts (#42) added in 0.9.0. Tooling fix (#45): `check:font-hotlinks` works in the release container (read-only `safe.directory` for `git ls-files`, regular files only).

## 0.9.0

- Release 0.9.0 (minor: the optional renderer peer moves to a new 0.x line). Require `@openpresentation/opf` ^0.11.1, the optional peer `@openpresentation/opf-render` ^0.10.0 and (development/playground) `@openpresentation/opf-pptx` ^0.10.0, so composition, preview and export share the accepted font-scheme, alignment and furniture contracts. Composition and slide transfer fall back to the shared `aptos` scheme and report `unresolved-font-scheme` through `onDiagnostic`; gallery apply keeps every font-scheme role. Automatic script fonts (#40) and lazy Intos fonts (#42) activate only with a renderer newer than 0.10.0 (the next renderer release), which this release does not require. No public export is removed; `@openpresentation/opf-editor/switches` is new.

- Tests only (#39): the playground quote-import check projects imported styled lines (PPTX 0.10.0 imports them as `TextRun[]`) to visible text, and the metric browser check expects the renderer 0.10.0 edge-anchored metric lines. No runtime change.
- Canvas selection outlines use the placeholder's allocated bounds (the accepted `composeSlide` item box, or the traced part box for code, metric and source-text parts) instead of the glyph ink returned by `getBBox()`, so a short title selects its whole padded placeholder rather than only its letters. The new exported `allocatedSelectionBox(node, item)` is unit-tested with mock nodes (`test/placeholder-selection.mjs`) and checked in a real browser (`npm run test:selection-browser`). Needs no core or renderer change. Supersedes OpenPresentation/opf-editor#25. Selection outlines use the allocated placeholder frame even when the text overflows it, so an overflowing title or body is selected by its frame, not by the glyphs that spill outside.

- Playground source view keeps exact source bytes. Source the author applies is shown byte for byte (JSON escapes such as `\/`, `\u00e9` and `\n`, irregular whitespace, key order), and slide edits rewrite only the tokens that change, so Escape, Undo and Redo restore the exact prior bytes instead of a `JSON.stringify` respelling.
  The internal `src/exact-source.js` (`updateJsonSource`, `createSourceMemory`, `findDuplicateKey`; not a package export) keeps a bounded memory of recently seen documents (64 sources, 8 MB in total, oldest evicted first) and coalesces typing drafts. A remembered source replaces the current one only when both are byte-equal outside the edited nodes, so manual respellings are never reverted. Adding or removing array elements or object keys keeps every untouched sibling token (removal is by tree range, so it also works for inline containers; reordering an array moves the exact element tokens, in one parse, so a move in a 4 MB deck takes about 150 ms); keys named like Object.prototype members (`__proto__`, `constructor`) are ordinary keys; only typing into one string value coalesces intermediate states, every discrete edit stays exactly restorable; the result is always verified to parse to the edited document, and if an in-place edit cannot do that it falls back to indented JSON for that edit. The playground rejects repeated object keys on Apply.
  Limit: a source longer than 2,000,000 characters is not remembered. Edits still work, but restoring an edited value then uses normalized JSON spelling, and the playground says so in the source dialog footer and status line. Covered by `test/exact-source.mjs` (in `npm test`) and `test/playground-source.mjs` (in `npm run test:playground`). The JSON editor entrypoints are unchanged.

- FF-16: add `@openpresentation/opf-editor/switches` (`switchDimension`, `prepareDimensionSwitch`, `SWITCH_DIMENSIONS`) with one validated, undoable switch for each of the 14 pptx.gallery dimensions, `prepareBlockReplace` in `/layout` and `resolveSlideFonts`. Content-type conversion is out of scope: `blocks` is block replacement only. Tests cover every dimension (patch, undo/redo, preview refresh) and export after each switch with opf-pptx's FF-08 typeface check when the installed opf-pptx has it.

- FF-19: the playground previews non-Latin documents. It loads the renderer's pinned script faces lazily (`fontRegistry.ensureScripts`), only for the scripts the document draws, from `./script-fonts/` next to the page, so Japanese, Chinese, Korean, Arabic, Hebrew, Indic, Thai, Khmer and other scripts draw with a face instead of failing to preview. Nothing is fetched for Latin text; a face that cannot be fetched is reported and retried on the next edit. `build:playground` copies the hash-verified faces (63 files, 66.9 MiB) from the 31 exact `@expo-google-fonts/noto-*` dev dependencies, and skips them with an older renderer. Needs a renderer with `registry.ensureScripts`; older renderers keep the Latin fonts. Covered by `test/playground-script-fonts.mjs` in `test:playground`. CI pins the renderer to the change that adds the API until it is released. The library itself is unchanged: hosts load fonts.

- FF-31 (#38): fonts are never hotlinked. `npm run check:font-hotlinks` (`scripts/check-font-hotlinks.mjs`, allowlist `scripts/font-hotlink-allowlist.json`) fails on font CDN references in tracked files and runs in `npm test` and, on the built output, in `test:playground`. The editor ships no font files of its own.

- FF-31 (#42): the playground loads vendored preview fonts (Intos for the Aptos font scheme) on demand through `fontRegistry.ensureLazyFonts`, served next to the page and hash-verified by the renderer, never from `fonts.json` or a CDN. Like the script fonts above, this activates only with a renderer that has the lazy font APIs; renderer 0.10.0 does not, and the playground then keeps the fonts it has.

- Playground tests (#43): `test/playground-script-fonts.mjs` skips unless the installed renderer's browser registry has `pendingScripts()` and `ensureScripts()`, the loader the playground feature-detects.

- FF-35b: an unknown font-scheme id is resolved by the shared rule (`resolveFontSchemeReference` in `src/font-defaults.js`, a local copy of core's). The default `aptos` record is the base and sibling overrides apply, so composition no longer measures such decks in Roboto. `session.composeSlide()` and `session.paginateSlide()` accept `onDiagnostic` and report one `unresolved-font-scheme` diagnostic. `test/default-font-scheme.mjs` runs the shared unknown-scheme cases. The checks against core (`DEFAULT_FONT_SCHEME`, `resolveFontSchemeReference`, `paginatePresentation`) are skipped while the installed core is published 0.11.0. They activate when this package moves to a core release that includes FF-35b, or when core ecosystem CI pins a commit that contains this test (see opf `docs/design-resolution.md`, "Sibling agreement checks"). No package version change.

- FF-35: composition and slide transfer fall back to the shared engine default font scheme, `aptos` (core `DEFAULT_FONT_SCHEME`, kept locally in `src/font-defaults.js` until a published core exports it), instead of `roboto`. A custom theme without a font scheme is now composed in Aptos, and slides inserted from such a deck freeze `fontScheme: "aptos"`, matching preview and PPTX export. `test/default-font-scheme.mjs` replaces the FF-17 `roboto` pin with parity checks. No package version change.

- FF-17: gallery apply keeps every font-scheme role that the record schema defines. A font scheme attached from a gallery descriptor now keeps its `code` role (string or Font object) and valid `type`, `app` and `languageFamily` values, instead of only `major`/`minor`. Gallery `heading`/`body` (strings or Font objects) map onto `major`/`minor` only, so a later inline `design.fontScheme` major/minor override still wins. `accent` is not part of the record schema and is not attached. Invalid values are dropped, and legacy descriptors attach unchanged. Bundled catalog ids are still not re-attached. A new test also pinned the editor's last-resort font scheme, now the shared `aptos` (FF-35).

## 0.8.0

- Require `@openpresentation/opf` ^0.11.0, `@openpresentation/opf-render` ^0.9.0, and `@openpresentation/opf-pptx` ^0.9.0 (lockfile 0.9.1, render peer ^0.9.0). Reserve the full slide and content-payload id namespace for pagination and transfer insert. Forward validation warnings to the schema inspector; accept documented ColorRef forms in the rich-text toolbar. Canvas named-color paint uses published render 0.9.0; PPTX export hex-resolves through pptx 0.9.1. Native `schemeClr`, theme write, and `p:hf` remain out of scope.

## 0.7.0

- Add reusable browser-safe JSON editor and contextual options entrypoints. Preserve exact source line endings through editing, indentation, paired quotes/brackets, array-item continuation, search, folding, formatting and undo/redo; expose catalog/schema choices from already loaded context.
- Use core 0.10.0 and renderer 0.8.0 for merged metric/timeline/content-card editing, scalar and rich source preservation, selection and undo. Keep native PPTX fidelity separate from browser and JSON-control acceptance.
- Verify actual installed JSON controls in the publication workflow. Shared furniture and prepared-glyph editing drafts are not included in this release.

- Require Node 24 (`24.x`) for the next release and development; upgrade from Node 20 or 22 before installing. Retain browser and operating-system checks, and retire duplicate Node 20 CI jobs. Previously published packages and evidence are unchanged.

## 0.6.0

- Edit code source and metadata through accepted renderer trace targets, including empty source and shorthand values. Preserve source line endings through no-op commits and edits; insert literal tabs and support cancel/undo. Generated labels are not editable source targets, and code selection does not offer invalid rich-text formatting.
- Verify offline pointer/keyboard edits, pagination policy, undo/redo, native export and exact code/metadata/source-boundary reimport in wide and portrait canvases. The source textarea uses native browser editing, while committed preview uses accepted SVG geometry. Native formatting/font theme and pixel equivalence remain separate gaps. Requires core 0.9.0 and renderer 0.7.0; verified examples use PPTX 0.7.0.

## 0.5.0

- Commit pagination readability changes even when content stays on one slide, with undo/redo and no duplicate history after an unchanged repeat. Requires core 0.8.0 and renderer 0.6.0 for persisted minimums and shared quote geometry.
- Verify quote source editing, pagination, preview and PPTX export/reimport offline in Edge. Imported native quote lines retain text but do not reconstruct OPF quote structure, typography or readability policy.

## 0.4.0

- Require core 0.7.0 and renderer 0.5.0 for canonical styled and spanning table cells.

- Add coordinated styled-table regression coverage for `.value` typing/formatting, style/span preservation, empty cells, field discovery, rejected structural edits and atomic undo. The existing model supports these cells through the core 0.7.0 schema. Browser verification with actual Roboto fonts passes merged rich typing, scalar promotion and formatting, partial selection, empty styled values, cancellation and undo.

## 0.3.0

- Require core 0.6.0 and renderer 0.4.0 so the editor uses shared content-aware table rows. Multiline cells grow into available space while retaining formatting, typing, empty-cell editing and undo behavior.

## 0.2.0

- Verify existing formatting, mixed-style typing, empty-cell editing and undo controls against canonical rich table cells and headers. Requires core 0.5.0 and renderer 0.3.0; core 0.4.1 does not accept rich table arrays. Reproduce the 14 browser checks with the core repository's `scripts/build-rich-table-browser.mjs` harness.

## 0.1.2

- Accept renderer 0.2.x alongside 0.1.x through the optional peer dependency, allowing the new image-fidelity releases in a coordinated installation.
- Require core 0.4.1 with the corrected embedded image example. Editor behavior and browser entrypoints are unchanged.

## 0.1.1

- Require renderer 0.1.1 when using the canvas so empty-line caret geometry is available.
- Add native mixed-style typing with glyph-aligned caret and pointer selection, composition lifecycle handling, draft undo/redo, cancellation and guarded commit.
- Preserve run styles, links and metadata during typing, repeated-character edits and grapheme-safe changes; keep insertion style after deleting all text.
- Keep empty blocks editable and use renderer trace geometry for trailing blank-line carets.
- Verify 46 rich-text browser checks plus native keystrokes and a measured pointer hit. Real OS IME, bidi/complex-script and cross-browser behavior still require verification.

## 0.1.0

- Require core 0.4.0 and renderer 0.1.0 for compatible standalone installation.
- Add an embeddable canvas, schema-driven properties, rich range formatting, clipboard/gallery/data imports and content starters.
- Support guarded edits, resize/reorder/move operations, nested composition, duplication, deletion and atomic undo.
- Verify model, component, transfer, schema, rich-text and layout suites on Node 20 and 24 before provenance publication.

Continuous native caret/IME editing, complete visual spec coverage and native PowerPoint parity remain unfinished. Model tests do not establish browser interaction fidelity.
