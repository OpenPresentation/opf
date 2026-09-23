# Changelog

## Unreleased

- FF-29: heading and body text anchor to core's per-item `alignment` (`composeSlide` resolves it once for every engine; the PPTX exporter reads the same value). Cores without `item.alignment` keep the FF-39 design fallback, so output is unchanged for them. No golden raster changes from this part.
- FF-29: metric lines without tabs now anchor at their accepted alignment edge (`text-anchor` middle/end at the aligned point), the same way native PPTX metric paragraphs do. Before, centered and right-aligned metrics were drawn start-anchored at an origin derived from the estimated width, so the drawn value drifted off its edge by half (center) or all (right) of the estimation error, and the preview reported left-anchored lines where PPTX has `algn="ctr"`/`"r"`. Tabbed lines keep their accepted segment origins. Script-font runs and right-to-left isolation are unchanged. Across the 126-deck corpus, 54 of 805 golden rasters change, all of them centered or right-aligned metrics (266 lines; median shift 6.6 px, p90 33.8 px, max 69.0 px at 1280×720). The same 54 entries change in `opf-examples-png.furniture.sha256.json` and `opf-examples-png.ff25-wdupdiag.sha256.json`; the previous furniture manifest is kept as `test/golden/pre-metric-anchor-opf-examples-png.furniture.sha256.json`. `test/shared-metric.mjs` now checks the edge anchor.
- FF-29: traced previews attribute a content card's surface `rect` to its item path, so parity tools can match it to the PPTX `OPF card` frame. Untraced output is unchanged, and the editor still selects the item's group.
- FF-27: accept a `date` render option (ISO YYYY-MM-DD) and pass it to core composition, so `date: true` header/footer furniture renders the host-supplied current date. Core FF-27 slide-number formats (`{current}`, `{total}`) and fixed ISO dates with `dateFormat` render through the existing furniture parts. The renderer never reads a clock. Documents without the new fields render unchanged (805-slide golden unchanged).

- FF-25: preview the DrawingML pattern presets `wdUpDiag`, `openDmnd` and `wave` for pattern backgrounds, so OPF documents that use them render without `unsupported-pattern`. `wdUpDiag` draws the same rising stripe as the engine id `diagStripe`, which PPTX export writes as `wdUpDiag`. Like `pct5`, `ltHorz` and `diagStripe`, these are 8px vector approximations of the native presets. Other presets still paint only the background color and report `unsupported-pattern`.

- FF-35b: an unknown font-scheme id no longer throws `catalog-resolution-failed`. Like every engine, the preview uses the default `aptos` record as the base, keeps sibling overrides (for example `major`/`minor` or `code` on `{ "id": "no-such-scheme", ... }`), and reports one `unresolved-font-scheme` diagnostic per rendered slide through `onDiagnostic` (`{ code, path, id, fallback, message }`, added to `RenderDiagnostic`). `test/default-font-scheme.mjs` runs the shared unknown-scheme cases. The checks against core (`DEFAULT_FONT_SCHEME`, `resolveFontSchemeReference`, `paginatePresentation`) are skipped while the installed core is published 0.11.0. They activate when this package moves to a core release that includes FF-35b, or when core ecosystem CI pins a commit that contains this test (see opf `docs/design-resolution.md`, "Sibling agreement checks"). All 805 example SVGs and 805 golden rasters are unchanged. No package version change.
- FF-39: titles follow only `design.titleAlignment`. When it is unset, a title is left-aligned, the same as core composition. Previously, a title without an accepted outline placement fell through to `design.contentAlignment`. A deck that set `contentAlignment: "center"` but no `titleAlignment` therefore previewed centered titles with the default measurement and left titles with outline measurement, and exported them left-aligned. Subtitle, tag and body text still follow `contentAlignment`. `test/design-preview.mjs` checks the anchors with both estimated and outline measurement. No bundled example sets `contentAlignment` without `titleAlignment`, so the 805-slide golden corpus is unchanged. Some pptx.gallery layout previews (chart/list/number `Nx`) do change.

- FF-35: fall back to the shared engine default font scheme, `aptos` (`engineDefaults.fontScheme.pptx.latin`, core `DEFAULT_FONT_SCHEME`), instead of `roboto` when the slide, deck and resolved theme name no font scheme. Previews of a custom theme without a font scheme now use the fonts that core pagination, opf-editor and opf-pptx use. Aptos is not bundled: estimated SVG names `Aptos`/`Aptos Display` and the default raster draws Roboto, as for any `aptos` deck; measured previews need the office pack with `substitutionPolicy: "visual"` (Carlito, approximate), licensed Aptos faces, or a `fallbackFamily`, and otherwise fail with `font-unavailable`. `engineDefaults.fontScheme.google` stays for a future Google Slides target. All 805 golden rasters and all 805 example SVGs are unchanged; `test/default-font-scheme.mjs` checks parity with core. No package version change.
- FF-34: pass the socialPlatforms records to core composition (document source, injected `options.catalogs`, engine source, then bundled), so `socials: true` header/footer zones preview the primary organization's profile URLs. Requires a core build with `resolveSocialProfile`. Older cores ignore the option. Decks without `socials: true` render byte-identically; golden baselines are unchanged.

- FF-19: script fonts, `lang` and right-to-left text in previews. The renderer itemizes text by Unicode script. Each run is measured and drawn with its script slot's face, resolved by core `resolveScriptFonts` when the installed core provides it. Proprietary script fonts are previewed with designated open Noto replacements, recorded as `visual` substitutions. The SVG root carries `lang`/`xml:lang`, and measurement uses the matching OpenType language system. Direction is per paragraph, from core's `paragraphDirection(text, deckDirection)` (core #134), the rule the exporter uses: right to left when the deck is right to left and the first strong character is right to left, or there is none. Without that function, paragraphs are left to right, as in export, and `paragraph-direction-unavailable` is reported. Every wrapped line of a right-to-left paragraph is a Unicode isolate, and measured fragments are placed from the right edge. CJK punctuation and fullwidth forms, and language-dependent quotes, dashes and ellipsis, use the East Asian slot, while ASCII neutrals use the latin slot next to East Asian text. The text's role picks heading or body slots. Without core `resolveScriptFonts`, a document with a `language` reports `language-preview-unavailable`.
- Add an optional, hash-pinned OFL script font pack: 31 `@expo-google-fonts/noto-*` packages with 63 regular and bold faces, as exact optional peers. Load it with `prepareNodeFonts({scripts})`, `loadBundledFontRegistry({scripts})` or `loadOfficeFontRegistry({scripts})`, or with `scriptFontEntries` in browsers, where `loadBrowserFontRegistry` now verifies an entry's `sha256`. New `/fonts` exports: `createScriptTextMeasurement`, `createScriptFonts`, `detectScripts`, `itemizeScripts`, `SCRIPT_FONT_REPLACEMENTS` and `SCRIPT_FONT_FAMILIES`. Registries add `selectEmbeddedFonts` and `describeFaces`.
- When fontkit cannot apply a mark-positioning lookup (a null anchor, for example the Gurmukhi tippi in Noto Sans Gurmukhi), the text is measured again without mark positioning, which does not change advances. If that also fails, measurement throws `font-shaping-failed`.
- All 805 corpus rasters are unchanged. Traced SVGs change only by the new `lang` attributes (732 of 805 slides), plus right-to-left isolates around the six slide numbers of the Arabic deck, whose paragraphs have no strong letter. The Arabic-language decks' English paragraphs stay left to right under the paragraph rule.

## 0.9.0

- Require `@openpresentation/opf` ^0.11.0. Resolve content ColorRef values (hex, color-scheme slots and roles, and `var:<id>` document variables) for styled table fills, text colors, and border strokes through core `resolveColorRef()` before SVG paint. Authored `#RRGGBB` / `#RRGGBBAA` keep their written casing so packed-browser editor selection colors match. Rich text runs keep warn-and-fallback semantics for unrecognized colors such as `invalid`. Vendored `test/fixtures/color-references.opf.json` covers the OPF reference-layer fixture without expanding the 126-deck examples golden.

## 0.8.0

- Require core 0.10.0 and render accepted metric, timeline, content-card and vector-aware text geometry. Preserve selected readability floors and scalar source whitespace; keep estimated rich text flowing with native SVG advances.
- Retain reviewed 805-slide corpus baselines and corrected catalog examples. Shared furniture and the prepared HarfBuzz/variable-instance draft are not included in this release.

- Require Node 24 (`24.x`) for the next release and development; upgrade from Node 20 or 22 before installing. Retain browser and operating-system checks, and retire duplicate Node 20 CI jobs. Previously published packages and evidence are unchanged.

- Resolve installed preferred-family weight variants and carry physical family/style-link metadata through accepted text styles. Diagnose ambiguous grouped faces and preserve explicit caller family overrides. Requires the coordinated core type and PPTX source increment; native paint validation remains separate.

- Add `prepareNodeFonts` with shared measurement, embedded SVG and raster font options. Check pinned local font versions, all 33 font hashes and eight license notices; expose the immutable provenance manifest. No runtime downloads or system font installation are required.
- Use the complete nine-face base pack in default PNG/PDF raster export, including Roboto semibold, italic and bold italic. Missing or modified bundled resources fail explicitly. This does not add vector PDF or expand native/font compatibility claims.

## 0.7.0

- Reject XML-forbidden controls and unpaired UTF-16 surrogates in code source/metadata with `invalid-code-text`, the OPF path and character offset. Keep the input unchanged; tabs, line endings and valid supplementary Unicode remain accepted. Schema validity is separate from XML representability and font coverage.
- Consume the coordinated core's accepted filename/language/body code geometry and styles without another fit. Preserve whitespace, tabs, source ranges, metadata case and empty lines in traced SVG; expose internal code parts for editing.
- Use shared automatic layout for unspecified code layouts; explicit `code-1x` presets retain their slots. Review 43 changed code rasters with the remaining 762 hashes unchanged, and add actual-font browser segment/containment checks. Requires core 0.9.0; planned coordinated releases PPTX 0.7.0 and editor 0.6.0 will add native source recovery and editing.

## 0.6.0

- Consume accepted core quote body/source geometry without re-fitting. Shared footer allocation preserves readable source text and reports distinct failure reasons. Requires core 0.8.0.
- Review 41 changed quote-footer rasters across the 805-slide corpus; outer content boxes are unchanged. Loaded-font browser tests verify cell containment and separation and report glyph overhang beyond advance-based part boxes.

## 0.5.1

- Reserve attribution/source footer space before fitting quote text. Long, otherwise fittable quotes no longer overlap their footer. Quotes that cannot fit at the minimum font size retain overflow diagnostics and strict-mode rejection.
- Add wide/portrait long-quote regressions. The existing 126-deck/805-slide raster baseline is unchanged; this is a targeted layout fix, not a claim of native PowerPoint equivalence.

## 0.5.0

- Render the coordinated core's styled and spanning table cells with fills, text colors, alignment, reference-pixel padding and individual solid/dashed/dotted borders. Preserve anchor and `.value` traces for editing and keep the existing scalar raster corpus unchanged.
- Require core 0.7.0. Coordinated native import and styled editor pointer/keyboard/formatting/undo checks pass with actual browser fonts; native PowerPoint raster equivalence remains unverified.

## 0.4.0

- Consume shared core 0.6.0 table row and text geometry. Multiline cells grow into available space, constrained tables reduce spare row height before readable text, and rich cell line advances match native PPTX paragraph spacing. Short rows and the existing 805-slide raster baseline remain unchanged.

## 0.3.0

- Render canonical rich table cells and headers with shared run measurement, styles, links and editor trace geometry. Existing scalar-cell raster output remains unchanged. Requires core 0.5.0; core 0.4.1 does not accept this syntax.

## 0.2.0

This minor release requires Node 20.9 or later and OPF 0.4.1. Browser entrypoints remain available without native Node dependencies.

- Honor JPEG EXIF orientations 2–8 in PNG/PDF output while keeping ordinary JPEG source attributes and bytes unchanged. Verify all eight orientations, fit/crop and actual PDF pixels against independent references.
- Add reproducible browser orientation checks with an incorrect-orientation control and keep native raster dependencies out of the browser build.

- Render embedded WebP images in PNG/PDF output instead of dropping them. Preserve alpha, EXIF orientation, fit/crop and the first animation frame without modifying source SVG.
- Add lazy Node-only Sharp 0.35.4 decoding; raise the Node minimum to 20.9.0. Report malformed embedded images with their source path and enforce a 40-megapixel input limit.
- Check decoded PNG pixels, actual PDF image streams/alpha masks, image URI encodings and all 805 unchanged raster baselines.

## 0.1.1

- Include rich-text line offsets and measured boxes in opt-in SVG tracing, including empty and trailing lines, for editor caret placement. Normal SVG/PNG output is unchanged; all 805 raster checks pass.

## 0.1.0

- Require OPF 0.4.0, enabling standalone installs of shared composition, nested layouts, pagination, measured rich text and lists.
- Provide browser-safe SVG rendering, traceable content geometry, design previews, and local PNG/PDF conversion.
- Bundle open-source fonts with explicit substitution policies, browser font loading, measurement and embedding support.
- Keep timeline endpoint labels and markers within their content region, including portrait layouts.
- Run a mandatory raster regression check across 805 slides in 126 installed OPF example decks. Missing or changed corpora fail. Baseline updates create review candidates and preserve the historical manifest.
- Verify clean registry installs on Node 20 and 24 before publishing with provenance.

The raster baseline records current output, including known media, advanced-chart, contrast and language-shaping limitations. Native PowerPoint parity is not established. See `test/golden/README.md` for the review scope.
