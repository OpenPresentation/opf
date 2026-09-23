# Changelog

## Unreleased

- FF-27: header/footer slide numbers export as native PowerPoint slide-number fields (`<a:fld type="slidenum">`) inside the tagged furniture shapes, so they renumber in PowerPoint; `slideNumberFormat` literal text and `{total}` stay fixed runs around the field. Current dates (`date: true`, with the new `date` export option) export as native `datetime1`–`datetime7` fields when the `dateFormat` matches an en-US field type, else as fixed text with a `furniture-date-fixed` diagnostic. Fixed dates stay text. The furniture manifest records `slideNumberFormat`/`dateFormat`, and reimport maps fields and formats back while the current native text still matches them. Needs core with FF-27 furniture `fields`; with earlier cores a bare generated slide number still becomes a field and everything else is unchanged. Native `p:hf` objects remain out of scope.
- FF-17: pin the exporter's last-resort font scheme (`aptos`, matching `engine-defaults.json` `fontScheme.pptx.latin`) with `test/default-font-scheme.mjs`. It applies only when the resolved theme names no font scheme. Core pagination, the renderer and the editor use `roboto` there; opf `docs/design-resolution.md` documents the difference. The test also checks that code runs use the shared `resolveFontFamilies()` code role (the scheme's `code`, else Roboto Mono). No export behaviour or bytes change: across the 126 bundled examples, switching this default to `roboto` produced byte-identical PPTX.

- FF-32: re-import keeps design, metadata and layout references. Export stores the document's catalog references (`design.theme`, `colorScheme`, `fontScheme`, `dimensions`, `background`, composition defaults), authoring metadata (`narrative`, `tone`, `audience`, `purpose`, `language`, `organization`, `speaker`, `takeaway`, `duration`, `tags`, `variables`), and slide `id`/`beat`/`layout`. They go in standard PresentationML customer-data tags: `OPF_DOCUMENT_V1` on the presentation and `OPF_SLIDE_V1` on each slide (sharing a slide's furniture tag list when present). Referenced inline catalog records and metadata assets are stored with them. Each reference records the native evidence it produced. `fromPptx` restores it while the theme colors, theme fonts, slide size, backgrounds or slide arrangement are unchanged. Otherwise it keeps the observed values and reports `design-reference-changed`, `layout-reference-changed`, `slide-reference-changed`, `metadata-reference-changed` or `duplicate-slide-id`. A damaged record reports `invalid-document-provenance` and leaves the ordinary import. A single restored field that does not validate is dropped on its own, with that diagnostic at its path. Embedded `data:` sources are never copied into a tag: bytes that match an exported media part become a `ppt/media/` reference, and the restored asset re-exports the same picture. Other data sources, values over 256 KiB, and tags over the 16 MiB import limit are omitted. Export reports each omission with `document-provenance-omitted` and records it in the tag, so import keeps the observed values. A reference whose asset or media part no longer resolves reports `unresolved-asset-reference` and is not restored. New `toPptx` option `provenance: 'full' | 'references-only' | false` (default `'full'`). `'references-only'` stores catalog references without organization, speaker, free text, slide ids or assets; `false` writes no tags. Inherited backgrounds are no longer repeated as per-slide overrides on an unchanged re-import. Across the 126 bundled examples, 14 decks that state no reference are byte-identical. The other 112 add `ppt/tags/opfDocument.xml` and `opfSlideN.xml` parts plus the `custDataLst`, relationship and content-type entries (+914 to +5272 bytes, median +2673, +3.6% in total; embedded logos are no longer copied into tags); no other part changes. See `docs/document-roundtrip.md`.

- FF-31: the PPTX always names the chosen font family. Previously, a `textMeasurement` provider that previewed a family with a substitute wrote the substitute into the package. With the renderer Office pack and `substitutionPolicy:'visual'`, that was Carlito for Aptos and Calibri, Gelasio for Georgia, Tinos for Times New Roman, Arimo for Tahoma, and Cousine for Consolas and Courier New. Caller aliases leaked the same way. `toPptx` now wraps the provider: measurement still uses the substitute, but a substituted style is exported under the chosen family. Faces of the chosen family, such as Roboto Medium, keep their native style-link names. When the provider reports `resolveFont(style).substitute`, the exporter uses it; otherwise it compares family names. Across the 245 gallery values in dimension audit B, exporting with that registry wrote a substitute for 129 values before this change and for none after. Slide geometry, sizes and bold/italic flags are byte-identical; only `typeface` attributes change. Tests that asserted the old behaviour now expect the chosen family (`table-layout`, `rich-table`). `accepted-text` now chooses Carlito directly, so the native text fixtures still name the one face the native gate registers. Its generated fixtures change, so they must be regenerated before the next native text run. New test: `test/export-chosen-fonts.mjs`.

- FF-39: native heading and body paragraphs follow the effective `design.titleAlignment` / `design.contentAlignment` (the slide design overrides the deck) when core returns no accepted `placement.alignment`, which happens whenever the text measurement has no outline bounds. Titles use `titleAlignment`; subtitle, tag and scalar body text use `contentAlignment`, as the renderer's preview does. Previously these paragraphs fell back to `algn="l"`. A centered heading in a full-width box was then drawn about 437 pt left of the preview. `test/design-alignment.mjs` compares native alignment and anchor x with the traced preview, for deck and slide designs, both canvas orientations, and default and outline measurement. Across the 126 bundled examples, exports with the office font registry (outline measurement) are byte-identical. With default measurement, 101 decks change: 509 slide parts, where only `algn` changes (314 paragraphs `l`→`ctr`, 315 `l`→`r`). Box geometry and every other byte are unchanged.

- FF-08: the exported package no longer leaks default fonts. Chart data labels (including the pie label), axes, legend and titles use the chart slide's body font in `latin`, `ea` and `cs` instead of PptxGenJS's hard-coded Arial. Each embedded chart workbook uses the same fonts in `xl/styles.xml` and its theme (no Geneva, Arial, Calibri or Office script list); other workbook parts are unchanged. `docProps/app.xml` "Fonts Used" is regenerated from the fonts the finished package uses instead of the fixed Arial/Calibri, and the "Theme" entry follows the theme part's name. Run `pitchFamily` follows the font scheme type: 49 for monospace, 18 for serif, 34 for sans-serif; the code role counts as monospace. New `checkPptxTypefaces()`/`inventoryPptxTypefaces()` exports check a package against the chosen fonts, and `test/typeface-inventory.mjs` applies the check to all 126 bundled examples (0 passed before, 126 after). Across those examples, every deck changes in `docProps/app.xml`; the 109 decks with charts change in 144 chart parts and 144 workbooks (styles and theme only); 47 decks change `pitchFamily` in 59 slides. The vendored bytes are unchanged.

- FF-35b: export of an unknown font-scheme id is unchanged (the default `aptos` record is the base, with sibling overrides on top), and it now reports one `unresolved-font-scheme` diagnostic per path through `onDiagnostic`, the same diagnostic as the other engines. `test/default-font-scheme.mjs` runs the shared unknown-scheme cases. The checks against core (`DEFAULT_FONT_SCHEME`, `resolveFontSchemeReference`, `paginatePresentation`) are skipped while the installed core is published 0.11.0. They activate when this package moves to a core release that includes FF-35b, or when core ecosystem CI pins a commit that contains this test (see opf `docs/design-resolution.md`, "Sibling agreement checks"). All 126 bundled examples export byte-identically. No package version change.
- FF-25: export pattern backgrounds as native `<a:pattFill>` using the OPF DrawingML preset with explicit colors. The preview-only `diagStripe` is written as `wdUpDiag`, and other engine ids keep their background color and report `unsupported-pattern`. Export image backgrounds as native `<a:blipFill>` with cover crop, contain insets or tile scale matching the SVG preview, plus `alphaModFix` opacity. Tile scale uses the raster resolution (PNG pHYs, JPEG JFIF/EXIF, else 96 dpi), which `rasterMetadata` now reports as `dpiX`/`dpiY`. Previously both exported as a solid color. Import recovers both fill types, including inherited layout/master fills. It reports approximate pictures, including tile geometry OPF cannot express, and unsupported pictures. Text contrast on pattern backgrounds now follows the pattern background color, as in the preview. Pattern colors named by a theme slot or role become `a:schemeClr` under the FF-24 exact-match rule.

- FF-24: export the deck color scheme as the theme `a:clrScheme` (all twelve slots, named after the scheme) instead of the vendored Office palette. When `design.theme` names a catalog theme, the theme takes that theme's name. Document slot and role colors (runs, table cells and borders) and theme-slot backgrounds become `a:schemeClr` when the deck theme holds exactly that color. Literal hex, `var:` variables, translucent colors, slide-override colors, `hyperlink`/`followedHyperlink` run colors and engine-derived chrome stay `a:srgbClr`. `fromPptx` now returns `design.colorScheme`: a catalog id on an exact match, otherwise inline slots. It also returns `design.theme` when the theme name and its colors or fonts identify a catalog theme. Unreadable or missing theme colors report `unsupported-theme-colors`; a same-named but mismatched theme reports `theme-unverified`. The rewrite happens during package normalization; the vendored PptxGenJS bytes are unchanged. Across the 126 bundled examples, every deck changes `ppt/theme/theme1.xml`, and 104 of them also rename the theme. 380 of 805 slides change only their theme-slot background from `srgbClr` to `schemeClr` (`bg1` 119, `tx1` 108, `bg2` 91, `tx2` 62), and 237 of those also gain the `<a:effectLst/>` that `p:bgPr` requires. The resolved colors are identical on every slide. Packages grow by 479 bytes in total (+0.005%).

- FF-35: every engine now shares the exporter's last-resort font scheme, `aptos` (core `DEFAULT_FONT_SCHEME`). `test/default-font-scheme.mjs` replaces the FF-17 split pin with a parity check: when the installed core exports `DEFAULT_FONT_SCHEME`, core pagination measures a custom theme without a font scheme in exactly the families exported here. Export behavior is unchanged: all 126 bundled examples export byte-identically (estimated and measured) with the published core and with the FF-35 core. No package version change.

- FF-07: write the presentation language into the PPTX through core `resolveScriptFonts()` (FF-18). Runs, end-of-paragraph and default run properties carry the resolved OOXML `lang` (for example `ja-JP`, `ar-SA` or `en-GB`) instead of a fixed `en-US`; `altLang` is not written. For languages that use an East Asian or complex-script slot, theme major/minor `ea`/`cs` name the resolved fonts instead of the vendored empty values; for languages written in the latin slot they stay empty unless the design font scheme sets that slot explicitly (the latin fill is gated on FF-05). The theme's per-script entry for the language's own script names the resolver's supplement. Run `ea`/`cs` name the language's script font where one is chosen, and in right-to-left decks each slide and notes paragraph takes its direction from core `paragraphDirection()` (the renderer's rule): `rtl="1"` or an explicit `rtl="0"`, with the master default levels right-to-left and alignment unchanged. `fromPptx` maps run `lang` back to `language` (a catalog id when it round-trips, else the tag) and reports `mixed-run-languages`, `language-ambiguous`, `language-uncatalogued`, `rtl-language-mismatch` and `script-font-not-imported` against the final document. A stored FF-32 `language` wins while the runs still carry its tag; otherwise the run language is kept and `metadata-reference-changed` is reported. The rewrite happens during package normalization, and the vendored bytes are unchanged. With a core that has no resolver (published 0.11.0), output stays byte-identical to before and a document that names a language gets `language-export-unavailable`; a core without `paragraphDirection` reports `paragraph-direction-unavailable` for right-to-left decks. Across the 126 bundled examples, the 52 en-US or language-less decks are byte-identical; 71 en-GB/en-AU/en-CA/en-IN/de/pt decks change only in their `lang` attributes; one Japanese deck also in theme and run `ea` and the `Jpan` supplement; and two Arabic decks also in theme and run `cs`, the `Arab` supplement and paragraph direction (19 right-to-left and 73 left-to-right paragraphs). Those three decks also list their script font in the app.xml Fonts Used group (FF-08). The corpus grows by 220 bytes in total.

- FF-17: pin the exporter's last-resort font scheme (`aptos`, matching `engine-defaults.json` `fontScheme.pptx.latin`) with `test/default-font-scheme.mjs`. It applies only when the resolved theme names no font scheme. Core pagination, the renderer and the editor then used `roboto`; FF-35 makes every engine use `aptos`. The test also checks that code runs use the shared `resolveFontFamilies()` code role (the scheme's `code`, else Roboto Mono). No export behaviour or bytes change: across the 126 bundled examples, switching this default to `roboto` produced byte-identical PPTX.

- Make the slide master's nine `bodyStyle` bullet fonts follow the theme minor (body) font (`<a:buFont typeface="+mn-lt"/>`). Previously they used the Arial hard-coded in the vendored PptxGenJS master, so a Carlito-only `design.fontScheme` still shipped Arial bullets. The rewrite happens during package normalization, and the vendored bytes are unchanged. Every exported deck's `ppt/slideMasters/slideMaster1.xml` changes in those nine elements. Explicit slide list-marker fonts are unchanged.

## 0.9.1

- Raise the optional `@openpresentation/opf-render` peer to `^0.9.0` so a packed install of editor 0.8.0 + render 0.9.0 + pptx 0.9.1 resolves. Keep `@openpresentation/opf` at `^0.11.0`. No conversion-behavior change.

## 0.9.0

- Require published `@openpresentation/opf@^0.11.0`. Resolve content ColorRef values (hex, effective color-scheme slots and roles, and `var:<id>` variables) through core `resolveColorRef()` to sRGB hex before PptxGenJS export for styled table fill/text/borders and rich text runs. Eight-digit hex alpha is preserved for native transparency (core `normalizeHexColor` strips the AA byte). Unrecognized run colors still validate and fall back to the theme text color (`color:'invalid'` contract). Design backgrounds and gradients are unchanged; native `schemeClr`, theme `clrScheme` writes, and native `p:hf` remain follow-up work. Import still flattens theme colors to hex.

## 0.8.0

- Remove content-type declarations for nonexistent generated slide masters, retaining every actual part and relationship. Add the audited package-integrity regression; notes-master ordering is unchanged.
- Require core 0.10.0 and renderer 0.8.0. Export accepted metric/timeline/card/text geometry with guarded native source recovery, preserving current edits, scalar whitespace, selected readability floors and explicit font style links.
- Keep native chart workbooks and visible text authoritative during supported reimport. Native font identity, tab positioning and image acceptance retain their documented independent compatibility requirements.
- Shared furniture provenance and joint source-shaping/tab drafts are not included in this release.

- Require Node 24 (`24.x`) for the next release and development; upgrade from Node 20 or 22 before installing. Retain browser and operating-system checks, and retire duplicate Node 20 CI jobs. Previously published packages and evidence are unchanged.

- Consume physical family and bold/italic style-link metadata from accepted text styles across headings, scalar/rich text, lists, tables, quotes, code and metrics. Retain the legacy provider fallback and reject malformed selection metadata. Coordinated renderer preferred-family lookup selects installed Roboto 500/600/800 faces exactly; native paint verification remains separate.

## 0.7.0

- Reject XML-forbidden controls and unpaired UTF-16 surrogates in code source/metadata with `invalid-code-text`, the OPF path and character offset, instead of emitting invalid XML or replacement characters. Tabs, line endings and valid supplementary Unicode remain accepted; this does not certify glyph coverage.
- Export accepted code parts as editable native lines with explicit tab stops. Retain complete code source and metadata through guarded native shape tags, including soft-wrap boundaries and CR/LF/CRLF. Missing or ambiguous groups retain visible shapes with diagnostics. See [code round-trip scope](docs/code-roundtrip.md).
- Preserve significant whitespace, empty paragraphs, interleaved native fields and explicit line breaks during text import. Keep complete multiline titles rather than silently taking their first line. Grouped text is retained with a transform/reflow diagnostic.
- Add wide/portrait offline browser and actual Windows PowerPoint source/edit/save/reopen/import checks. Native geometry, styling, font theme and raster equivalence are not reconstructed by this source round-trip feature. Requires core 0.9.0 and renderer 0.7.0 for coordinated preview/font measurement.

## 0.6.0

- Export accepted core quote parts as editable native lines without another fit/style pass. Reject missing geometry or unusable boxes explicitly. Requires core 0.8.0 and renderer 0.6.0 for coordinated preview/font measurement.
- Add twelve controlled Calibri PowerPoint cases for wide/portrait long bodies, expanded sources and pagination readability floors: source lines, native glyph containment/separation, save/reopen and reimport. Raster differences remain measured observations, not equivalence guarantees; import still flattens quotes to editable text blocks.

## 0.5.2

- Match metric, quote, code and timeline payload geometry and measured typography to renderer 0.5.1. Reserve quote footer space before fitting, preserve attribution and source, export timeline lines/markers as editable native shapes, and prevent PowerPoint from rewrapping fitted payload lines.
- Use readable theme colors for native chart axis and legend labels while preserving editable Office charts. Native axis ticks/plot geometry and general scalar-text wrapping still differ from preview.
- Add cross-renderer typography/geometry checks and a 19-slide real PowerPoint candidate comparison. File editability and schema-valid reimport do not establish complete raster or arbitrary Office round-trip equivalence.

## 0.5.1

- Remove the unused, vulnerable image-size dependency from ordinary npm installations by shipping the exact MIT-licensed PptxGenJS 4.0.1 ESM distribution and license with verified upstream hashes. Keep JSZip as a direct dependency; preserve the conversion API and upstream runtime code. No paid service or application-specific package-manager override is required.
- Add weekly grouped dependency updates, reviewed immutable CI actions and unfiltered installation/release audits.

## 0.5.0

- Normalize physical merged-cell perimeter borders and implicit neighboring edges. Native Windows PowerPoint testing exposed truncated dashes and restored zero-width segments that anchor-only XML checks missed.

- Require core 0.7.0 and renderer 0.5.0 for canonical styled and spanning table cells.

- Import conditional table borders with separate outer/interior edges, band/edge/corner precedence, archive-local theme line references, placeholder alpha and partial direct overrides. Invisible or complete direct borders mask unresolved references. Merged anchors use their full spans for frame edges; differing continuation border segments retain the anchor border and report a diagnostic.

- Import and export the coordinated core's styled and spanning table cells as native editable merged grids. Preserve direct fills/text alpha, alignment, padding and individual border widths/dashes. Normalize zero/fractional export padding and dotted/transparent borders that PptxGenJS does not expose consistently. Native cells now return canonical `{value, style}` objects; covered positions are `null`. Malformed merges retain all source cell text with diagnostics. First-row merges crossing into body rows retain explicit formatting as body content.
- Import conditional solid cell fills with whole-table/band/edge/corner precedence and ordered theme fill references, including placeholder alpha and direct overrides. Unequal native column widths and unsupported effects remain explicit fidelity limitations.

- Import supported native table-style character formatting from embedded style parts or inline definitions. Apply whole-table, row/column bands, edge and corner precedence before direct paragraph/run overrides; preserve theme/explicit Latin fonts, bold/italic and supported colors/alpha. Diagnose missing definitions, unsupported effects and right-to-left table geometry.

## 0.4.0

- Use the shared core 0.6.0 table layout for native row heights and font fitting. Multiline cells consume available height and use uniform native paragraph spacing; short-row output remains unchanged. Requires published core 0.6.0 and renderer 0.4.0.

- Import native table cells and headers as canonical rich runs, preserving supported character styles, theme fonts/colors, alpha, external links, paragraph defaults, whitespace and run/field/break order. Explicit normal text stays normal in OPF headers. Styled cells now return arrays instead of flattened strings; unstyled body cells remain strings.
- Retain blank paragraphs and report unsupported conditional table styles, merged geometry, unresolved text fonts/colors/fills and hyperlink actions with native table/cell paths. Field values remain cached text, and full native PowerPoint visual parity remains unverified.

## 0.3.0

- Export canonical rich table cells and headers as editable native runs with measured font sizes, resolved families, emphasis, colors/alpha, links and script baselines. Preserve explicit line breaks and whitespace across styled run boundaries. Requires core 0.5.0 and renderer 0.3.0; native PPTX table import still flattens text, and native PowerPoint rendering remains unverified.

## 0.2.1

- Preserve ordered native luminance and opacity transforms in solid and linear-gradient backgrounds, including theme colors and style placeholders. Retain precision through the full color reference chain; diagnose unsupported transforms.

- Import supported slide backgrounds inherited from layouts and masters, resolving theme colors, color-map overrides, theme overrides and background style references to explicit editable fills.
- Preserve opacity when exporting OPF theme-slot backgrounds. Report unresolved or unsupported native background fills instead of silently ignoring them.
- Add inheritance/style-reference regression coverage; native Keynote/PowerPoint compatibility remains separately qualified in the README.

## 0.2.0

This minor release requires Node 20.9 or later and OPF 0.4.1. Browser entrypoints remain available without native Node dependencies.

- Keep background-only and empty slides blank on import instead of adding a synthetic slide title.
- Add captured Keynote 14.4 native PNG/PPTX regression references for editable gradients, portrait opacity and native import; document the Quick Look thumbnail limitation separately from native viewer evidence.

- Preserve native dimension precision on import so standard-size canvases do not acquire small raster differences through rounded inch values.

- Restore native JPEG quarter-turns and mirrors into EXIF on import without recompressing pixels; preserve source JPEG bytes for this exporter's eight supported orientations.
- Add bounded EXIF insertion/update that retains existing metadata offsets and links, plus import diagnostics for unsupported crop, rotation and metadata cases.

- Preserve fixed solid/linear-gradient backgrounds as editable native fills, including opacity, stop colors, per-slide overrides and inline theme overrides.
- Convert gradient direction and stop intervals between SVG bounding-box and native slide coordinates, with regression coverage across landscape, portrait and square canvases.
- Import supported RGB solid/linear fills and expose path-specific diagnostics for native gradients outside the OPF representation. Keynote appearance is verified by captured native references; Microsoft PowerPoint remains unverified.

- Convert WebP to compatible static PNG pictures by default in Node and browser exports; preserve alpha, EXIF orientation and the first animation frame. Add imageFormat: "preserve" for original WebP embedding.
- Use lazily loaded Sharp 0.35.4 for local Node conversion and browser image/canvas APIs in browser bundles. Raise the Node minimum to 20.9.0. Conversion errors include the image path and enforce a 40-megapixel limit.
- Verify 36 cases against independent Pillow pixel references and 13 browser checks. Keynote 14.4 displays all six converted specimens, replacing its empty-rectangle WebP import.

- Detect PNG/JPEG/GIF/WebP content from embedded bytes, repair native media extensions/content types and import correct data-URI MIME types even when filenames or resolver hints disagree.

- Repair duplicate native object IDs on slides mixing tables with other objects, and sort normalized ZIP paths for stable multi-chart export bytes.

- Preserve headerless table data and empty rows on import. Export native header-row flags and honor explicit XML boolean flags when importing, including edits from other applications.

- Fit native table cell font sizes with the same loaded-font measurements and effective nested composition settings as the SVG preview.
- Match table alignment, line spacing, margins and theme border colors; pad uneven rows so every column remains present.
- Preserve original cell text and native editable tables. Natural wrapping still belongs to the PowerPoint viewer; native raster parity remains unverified.
- Compare 168 cells across two slide sizes, Roboto and Calibri substitution, headers, uneven rows and all text alignments. Twenty-four cases require shrinking.

- Preserve image proportions with centered native fit/crop matching presentation and slide imageFill settings.
- Measure embedded PNG/JPEG/GIF/WebP bytes without a second resolver call or an image-size dependency. Unreadable/unsupported dimensions produce a path-specific error.
- Translate all eight JPEG EXIF orientations into native rotation/mirroring while preserving compressed pixels and normalizing only the embedded orientation tag.

## 0.1.0

- Require core 0.4.0, with an optional renderer 0.1.0 peer for coordinated consumers.
- Share composition and measured rich-text/list geometry while preserving native editable PowerPoint objects.
- Support nested dynamic layouts, stable export bytes and mechanical OOXML import/round-trip checks.
- Pin PptxGenJS 4.0.1 and verify model operations and embedded data/local/resolved images without loading its unused image-size dependency. The transitive security advisory remains documented and unresolved.
- Verify clean registry installs on Node 20 and 24 before provenance publication.

Native PowerPoint raster comparison and full visual/round-trip fidelity remain unfinished; schema-valid import is not proof of faithful rendering.
