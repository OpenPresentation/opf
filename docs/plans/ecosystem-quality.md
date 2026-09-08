# Ecosystem quality work

The user’s full objective covers the JSON standard, LLM authoring, presets, editor, previews, and editable PPTX exports, with particular emphasis on dynamic layouts. Local end-to-end checks are intermediate evidence, not completion of that objective. The goal remains active until the broader work below is handled and verified.

## Current priorities

1. Define portable dynamic composition with one pure geometry implementation shared by preview and export.
2. Preserve all content when layouts have too few placeholders; fix promoted row geometry; report text overflow.
3. Expose composition through validated, undoable editor operations and real gallery examples.
4. Exercise the sibling repositories together using the current local format package, not stale npm dependencies.
5. Inspect actual artifacts and document remaining fidelity limits before release.

## Initial findings

- OPF is at 0.3.0 locally; toolkit repositories depend on 0.2.x.
- SVG and PPTX have separate layout, title, and grid algorithms.
- SVG places excess placeholder content over already-bound content.
- SVG's standalone `top`/`middle`/`bottom` regions occupy the full content area.
- Text is silently truncated at the minimum font size, and unbroken strings do not wrap.
- SVG images are currently placeholders; many visual presets are illustrative markup rather than rendered OPF.
- Existing baseline OPF tests pass.

## Release boundary

Work locally and retain reviewable changes. Package publishing and production deployment require a concrete release decision. Conformance and documented limitations take precedence over unsupported claims of perfect PowerPoint fidelity.

## Implemented and verified

- Added schema-backed dynamic composition and a shared, browser-safe geometry API, with weighted tracks, automatic grid selection, responsive dimensions, and path-specific overflow diagnostics.
- Connected SVG, editable PPTX, and the editor to shared geometry. Fixed promoted rows, excess-placeholder overlap, long-token wrapping, silent text truncation, custom inch dimensions, dark-theme text contrast, and embedded raster images.
- Added undoable editor composition operations, safer JSON Patch array indexing, and correct handling of special object keys. Duplicate slide IDs now fail semantic validation.
- Added portable composition defaults to multi-region presets without changing catalog IDs.
- Added an interactive gallery composition preview and JSON discovery endpoint. Migrated all 854 generated gallery examples to canonical OPF, preserving extended layout IDs through inline records and resolving legacy font schemes inline.
- Replaced gallery marker-only checks with validation of the JSON actually copied from each page. All 854 examples validate and render locally; all nine local registry-page smoke checks pass.
- OPF tests and toolkit type/smoke/metadata checks pass. The renderer's smoke suite covers 126 example decks. The gallery production build passes when its linked dependency is held stable.
- The end-to-end test verifies editable OOXML text-box coordinates against SVG geometry, deterministic output, import, PNG/PDF generation, embedded assets, custom dimensions, and undo/redo. macOS Quick Look successfully opens the sample PPTX.

## Remaining release and fidelity work

- Publish a new OPF version first, then advance downstream minimum versions and lockfiles before publishing toolkit packages or deploying the gallery. Use the coordinated local npm tarballs for an installable preview; older registry versions lack the new composition and canvas APIs.
- Native font embedding, complete shaping/feature parity across outputs, complete density models for specialized payloads, richer layout constraints, and complete fidelity for all specialized chart/image treatments remain queued work. Text metrics use a local font provider when supplied, with deterministic estimates as the fallback; some advanced gallery styling is retained as host-rendering notes rather than portable geometry.
- The historical renderer PNG golden manifest targets a different OPF commit and is skipped by its existing gate. The current corpus has deterministic-render coverage, not an approved full-corpus visual baseline.
- The upstream `image-size` dependency used by PptxGenJS has audit findings without a nonbreaking upstream fix at inspection time. Review that dependency before a public release; do not downgrade PptxGenJS to an incompatible ancient release suggested by `npm audit --force`.

## Interactive editor follow-up

A local editor playground now exercises real SVG selection, text edits, composition controls, JSON validation, slide creation, and undo/redo. Browser checks confirmed text selection stays on the intended payload, edits appear in the preview, undo restores content, redo reapplies it, and invalid JSON leaves the document unchanged. React snapshots are now referentially stable and immutable between edits; SVG selection handlers stop parent selections from replacing the clicked selection.

The patchable `fast-uri` advisory was resolved with 3.1.7 lockfile updates in the core, toolkit, and gallery repositories. The PptxGenJS/image-size upstream finding remains a release follow-up.

## Nested composition follow-up

Recursive groups now compose independently within parent tracks, including promoted regions. The schema, generated TypeScript types, semantic validator, shared geometry, renderer, editor, and gallery agree on the contract. Groups expose their source paths and bounds; leaves retain complete paths. Font sizes stay canvas-relative, and strict overflow cannot be weakened by a child. An iterative validation preflight rejects cycles and more than 32 group levels before recursive schema processing.

Auto-layout scoring walks descendant content with bounded candidate search. This is a deterministic heuristic, not a global packing optimizer. The four-slide dynamic example includes a column nested within a row and another row inside that column.

Verified: root tests/typecheck, all toolkit tests/typechecks, 854 gallery snippets validating and rendering, production gallery build, and end-to-end editable PPTX coordinates for every leaf. Browser checks cover nested selection, text edits, group reflow, undo/redo, portrait gallery groups, and no console errors. The rendered fourth slide and editor screenshot were visually reviewed. Current artifacts are in `artifacts/verification/`.

Next substantive work: text measurement, broader preset fidelity and visual baselines, complete editor authoring workflows, then coherent package/release verification. None of those outstanding items is waived by the nested-layout milestone.

## Pagination follow-up

Added explicit `paginateSlide` and `paginatePresentation` authoring transforms. Output is ordinary schema-valid OPF, with source/output path mappings and half-open text/item ranges. Input text characters, rich-run formatting, list items, table rows, and enclosing groups are preserved. Headings repeat; notes stay on the first page; continuation IDs avoid deck collisions. Unsplittable content or resource-limit exhaustion fails atomically with diagnostics.

Visual inspection exposed overly dense 16-pixel pages, so pagination now targets 24 reference pixels and prefers sentence/paragraph boundaries. Grapheme-aware long-token wrapping preserves combining marks and emoji sequences. Table density participates in layout diagnostics and pagination. SVG and native PPTX table row sizing/insets were aligned, body table colors respect dark themes, and native export does not create extra table pages.

The editor exposes pagination as one validated undoable transaction, with a Split overflow button and a long draft example. The CLI’s `opf paginate input output` command writes reviewable JSON without overwriting files. Gallery discovery includes `/api/pagination.json` with a complete source/result example.

Verified: root tests and typechecks; toolkit smoke tests; editor pagination undo/redo and atomic failure; browser 24-pixel output without overflow diagnostics; CLI validation and overwrite protection; all 854 gallery snippets still render. The end-to-end pagination test transforms two source slides into eight pages, reconstructs all source text and 55 table rows, checks native PPTX page/row counts, and renders pages for visual inspection. Artifacts are under `artifacts/pagination/`.

Remaining pagination work is part of the active goal: richer per-payload measurement (especially charts, timelines, code chrome, rich-text font overrides), native font fidelity, and more sophisticated semantic continuation behavior. Current pagination preserves content; it does not summarize or improve the prose.

## Font fidelity follow-up

Added a shared measurement/style provider to composition, pagination, SVG, editor, and PPTX. A local Fontkit registry measures real glyph advances, embeds supplied fonts and license notices into SVG, and reports missing fonts/glyphs or explicit substitutions. The editor loads bundled font bytes and exposes an undoable font selector. Native PPTX uses the resolved family and measured line breaks; unused deck defaults no longer block slides with explicit font overrides.

The Office pack supplies 24 faces across Carlito, Caladea, Arimo, Tinos, Cousine, and Gelasio. Exact fonts win over aliases. Metric, visual, and generic fallback levels are explicit; missing styles cannot masquerade as metric matches. Theme tokens resolve before substitution. Symbol encoding and math font gaps produce specific errors.

Verified: renderer's 126-deck smoke corpus and font policy regressions; three measured pagination pages with matching editor/SVG/native PPTX geometry; six Office-font pages with matching boxes and line breaks; browser font selection and compatibility notices. Read-only comparisons found exact shaped-width matches on 48 Arial/Times New Roman/Courier New runs. Gelasio's optional ligatures caused up to 2.0125% width differences from local Georgia, so that mapping is approximate. Font versions and hashes are recorded in `artifacts/fonts/office/report.json`. The browser's Roboto sample differed from Fontkit by 0.138 pixels at size 25.

Akasia's upstream project was verified and recorded as an experimental Aptos candidate, without a production compatibility claim. User interest in original open-source, metric-matched glyphs is recorded in `docs/font-fidelity.md`. Remaining work includes font-feature parity, vertical metrics, rich-run/mixed-script shaping, actual embedded-PPTX import/export, Akasia evaluation, and reproducible original-font experiments. The ecosystem goal remains active.

## Starter font scope and editor design

The user chose an existing-font starter set and a written roadmap before further custom-font work. `docs/plans/font-roadmap.md` defines the shipped local pack, optional approximate mappings, evaluation priorities, and acceptance gates for Aptos, regional scripts, symbols, math, native embedding, and narrowly scoped original glyphs. Roboto remains the default. Custom font development is deferred.

The editor playground now uses a restrained, Linear-inspired interface: actual slide thumbnails, a central canvas, Content/Design inspector tabs, a focused source dialog, inline presentation naming, speaker notes, OPF download, zoom, and keyboard undo/redo. Selection outlines use rendered text bounds; thumbnails reuse cached renders. Source edits retain schema validation and undo. This is a local editor playground; document persistence remains explicit file download.

## Live canvas and npm preview follow-up

Added `@openpresentation/opf-editor/canvas`: native inline editing over canonical SVG text, live validated drafts, one transaction per commit, cancellation, external-change conflict protection, typed table cells, structured fields for other payloads, image replacement, and collection controls. The demo now has a side-by-side JSON preview and examples for tables/charts/metrics/quotes/code/timelines. This is an initial canvas implementation; complete formatting, drag operations, media treatment, and all-preset fidelity remain open.

Added `@openpresentation/opf-render/fonts-browser` for explicit file loading with shared measurement bytes, FontFace registration and owned cleanup. Fonts load once in the demo. Split the shared SVG implementation from Node raster/PDF dependencies so browser bundles require no Node shims. Both environments use the same SVG source.

Local preview tarballs use coordinated prerelease versions, pinned sibling dependency versions and SHA-256 manifests. `scripts/test-packed-ecosystem.mjs` verifies clean installation, editing, rendering, fonts, native PPTX, declarations and browser bundling. Public publishing remains a separate release decision. See `docs/live-editor.md` for the API, supported interactions, fidelity contract and remaining work.

Final browser verification covers the canvas both from source and from cleanly installed npm tarballs. Structured forms can dock in the inspector so the slide stays visible during editing. Package, type, bundle, font and ecosystem checks pass; see the live editor guide for explicit remaining fidelity limits.

The final clean npm installation passed 33 checks in the Codex browser. Results are recorded in `artifacts/npm/browser-verification.json`, alongside the tarball digest manifest.


## Provider-neutral access and explanation site

The user confirmed that all open-source format, skills, CLI, editor, preview, export, and docs capabilities must remain free and usable by agents of all types. The future paid AI layer at pptx.dev consumes the same public foundation; it does not supply required infrastructure. `docs/open-ecosystem.md` records this boundary.

The related `openpresentation-site` now builds its agent quickstart, raw Markdown, schemas/catalogs, checksum manifest, and downloadable self-contained skills from an explicit source snapshot. Local HTTP verification covered 580 raw-file hashes, six downloaded skill folders (including actual helper execution), and the agent/guide/discovery routes. The homepage uses a real renderer-produced SVG with matching downloadable JSON/PPTX, replacing its hand-built illustration. Site builds pass; these changes are local, not a production deployment.

## Rich text measurement follow-up

Text payload arrays now use shared per-run measurement and wrapping in composition, SVG, and native PPTX. Font family/weight/style, requested point sizes, scripts, underline, strike, colors, and safe hyperlinks are retained. Spaces, explicit blank lines, and grapheme-safe long-token breaks are tested. Schema rejects nonpositive run sizes. Composition/pagination regressions and 126 renderer corpus decks pass; the rich SVG specimen was visually inspected. Native PPTX run properties were checked in OOXML.

Remaining: list-specific rich styling, selection-based formatting/caret UI, complex-script shaping, and PowerPoint raster parity. Native rich text currently uses one editable box per fitted line, so continuous native paragraph editing and rich PPTX import remain fidelity work. No claim of full pixel parity or complete WYSIWYG coverage follows from these checks.

### Rich text selection editing — September 7

The reusable canvas now formats native SVG selections, with source offsets supplied by the shared renderer. Supported controls include bold/italic/underline/strike, font family and point size, color, hyperlinks, script styles, selected-text replacement, and style reset. Plain text payloads expose a Format text entry; structured run controls remain accessible. Edits validate the full document, preserve surrounding run metadata, and create one undo step per action. Concurrent changes invalidate the selection.

The new `/rich-text` editor package export supplies immutable range formatting/replacement helpers for any agent or host. UTF-16 ranges must respect whole graphemes. Coordinated preview.6 tarballs include the API and declarations; these are local installation artifacts, not registry publication.

Evidence: editor model tests; native SVG/PPTX formatting checks; renderer's 126-deck corpus; browser range editing and existing canvas regressions; installed-package imports, strict TypeScript and browser bundle checks. A continuous mixed-style typing caret, advanced shaping/IME, richer list/cell editing, and native PowerPoint raster comparison remain outstanding. The whole ecosystem goal is not complete.

### Direct dynamic-layout resizing — September 7

The shared composition result now exposes exact flow tracks. The reusable canvas's Arrange mode resizes relative weights through pointer dividers and keyboard controls, including nested groups. Automatic layouts freeze their resolved columns into an explicit grid when resized. Promoted region positions remain fixed. Reserved placeholder slots require an explicit arrangement, and flows exceeding twelve tracks need grouping before resizing.

Pointer drafts do not mutate the session, each drag commits one undo step, Escape/cancel discards a draft, strict overflow rejects invalid fit, newer container edits cancel stale work, and unrelated document edits survive. The editor now implements JSON Patch test guards, including key-order-independent comparisons, atomic failures, and read-only test-only patches. The headless prepareTrackResize API includes a container guard.

Evidence: core composition/pagination/data/rich-text tests, editor model suite, 19 browser keyboard/lifecycle/overflow checks, trusted pointer drag/undo/cancel/conflict/rebase checks, and measured native PPTX shape-coordinate checks for resized root and nested layouts. Coordinated preview.7 tarballs pass imports, TypeScript declarations and browser bundling. Continuous rich-text typing, object drag/reordering, full preset/media fidelity, native PowerPoint raster comparison, and public release remain open.

### Complete-block moves — September 7

Arrange mode now supports native drag reordering of sibling blocks, keyboard earlier/later moves, and a destination menu for moves between existing groups and block-based slides. Entire groups can move as units. The new prepareBlockMove and listBlockContainers APIs are available to headless agents through the editor's layout export. Guarded remove/add patches account for index shifts, preserve all block content and metadata, and leave positional track weights intact. No-op moves produce no history. Empty containers, containment cycles, stale guards, and strict render failures are rejected.

Evidence: editor model regressions cover nested/ancestor/cross-slide moves, shifted destinations, formatting/table data, extension-data exclusion, no-op, guards and undo. Eighteen browser checks cover menu/keyboard flows and strict-fit rejection; a trusted native pointer drag and its single-step undo were verified separately. Measured native PPTX coordinates still match the shared geometry after resizing and moving blocks. Coordinated preview.8 packages pass clean local installation, TypeScript and browser-bundle checks. The gallery bundle and agent documentation were refreshed. Automatic object insertion/deletion, continuous rich-text typing, more media/preset fidelity, native PowerPoint raster comparison and public releases remain outstanding.

## Shared rich list layout

List entries, descriptions and text-style bullets now use `fitList` for mixed-run measurement, hanging indents, nested levels and uniform shrink. Composition and pagination account for actual list height. SVG traces each editable entry and description; the canvas preserves structural controls and supports inline text, range formatting and undo. Native PPTX uses positioned editable lines, explicit bullet styles and valid single paragraph-property nodes. Adjacent native bullet import retains levels, but remains heuristic.

Evidence: core list/pagination/rich-text checks, 126 renderer corpus decks, editor/PPTX suites, 19 source and installed-package browser checks, and measured native PPTX line/indent/bullet checks. Coordinated preview.9 tarballs include the API and declarations. The preview was visually inspected; image bullets, continuous rich typing, advanced cell/media/preset fidelity, native PowerPoint raster comparison and public registry releases remain open. The ecosystem goal remains active.

## Direct content creation

Added agent-callable insertion, duplication and deletion helpers plus eleven starter kinds, with complete-document validation and revision guards. The canvas palette accepts implicit slides, groups and named-region leaves. It preserves metadata during normalization, embeds local image bytes, and preflights rendering before applying. Arrange handles duplicate/delete whole subtrees and add adjacent/inside content; deletion prunes empty groups without removing the slide. The main toolbar opens insertion directly.

Verification covers model preservation/guards/undo, 40 browser creation checks, installed-package use, and native PPTX shape coordinates after insert/duplicate/delete. Preview.10 packages carry the APIs and declarations. Continuous rich typing, advanced media/cell/preset fidelity, native PowerPoint raster comparisons and public releases remain active work.
