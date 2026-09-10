# OPF font roadmap

Status: the starter pack is retained in published renderer 0.7.0 and used by the coordinated offline browser workflow. Package publication and actual registry checks preserve its existing font hashes/licenses; this release does not expand font compatibility claims. The [expanded ecosystem objective](ecosystem-objective-2026-09-09.md) requires substantially broader font conformance, installation/embedding, multilingual and native-platform evidence. The historical measurements below remain narrow samples; they do not establish general font or pixel equivalence. Evaluate existing open fonts and engine fixes before original font development.

The merged Mac font-preparation source milestone adds an immutable 33-face/eight-notice manifest, exact package pins and `prepareNodeFonts` shared options. A nine-face offline raster probe reproduced missing semibold and italic output under the old six-file default; loading the complete base pack corrects it. All 143 changed corpus slides were compared with the verified prior 805-slide checkpoint in 18 paired sheets, with six full-size inspections. The separate base-font regression checkpoint preserves 662 unchanged hashes and identical source. This does not close estimated rich spacing, excess card whitespace, multilingual shaping, Akasia/Aptos, native embedding or native application gates. Registry publication and public adoption remain required.

The next source increment resolves the reproduced static variant naming gaps: preferred-family requests find exact available weights, and native exporters receive physical legacy-family style flags from the font bytes. It preserves three prior selection failures and three native-style flag failures, with all six corrected in focused source checks. All nine base faces pass actual offline browser advances on both Node runtimes; seven payload slide pairs were visually inspected. This is a bounded static-base-font result, not completion of all variant or native portability work. See [candidate evidence](../evidence/mac-font-variants/README.md).

The [new native advance study](../evidence/shared-metric-native-anchor/font-study-comparison.json) records 1,024 local reference-font observations, with 949 within a candidate model's 0.02pt comparison tolerance and 75 outliers. It tests native reference faces, not their open substitutes. Prioritize the remaining combining-mark, Arabic and Calibri kerning cases, explicit native font-file/fallback identification, and independent shaping/raster checks before considering a measurement profile. Fontkit file hashes and Office font-name properties alone cannot establish per-glyph native font identity. No proposed profile is shipped.

## Ship the existing starter pack

Default new presentations to Roboto, with Roboto Mono for code. Use the same supplied font bytes for measurement, browser previews, and raster exports. Native PowerPoint exports name the resolved open font; recipients currently need that font installed.

| Presentation requests | Starter face | Handling |
| --- | --- | --- |
| Roboto | Roboto | Exact bundled family |
| Code / monospaced text | Roboto Mono | Exact bundled family |
| Calibri | Carlito | Upstream metric-compatible substitute |
| Cambria | Caladea | Established Fontconfig mapping; direct reference comparison remains pending |
| Arial | Arimo | Metric substitute; tested locally |
| Times New Roman | Tinos | Metric substitute; tested locally |
| Courier New | Cousine | Metric substitute; tested locally |
| Georgia | Gelasio | Available as an explicit approximate substitute |
| Aptos / Aptos Display | Carlito | Temporary approximate fallback, visibly reported |

The Office pack currently includes regular, bold, italic, and bold italic for six substitute families. The base Roboto pack is included unless disabled. No custom glyphs, OS font installation, or remote font fetch is needed. Preserve exact available fonts before considering substitutions. A font's presence does not imply every language or symbol is supported.

Entry point: `loadOfficeFontRegistry` in `@openpresentation/opf-render/fonts-node`. Use `substitutionPolicy: 'metric'` for strict established mappings; choose `'visual'` explicitly for approximate fallbacks. The editor uses the visual policy and shows substitution notices. The lower-level registry has no automatic substitution by default.

Existing checks: `pnpm test:fonts`, renderer font-policy tests, matching editor/SVG/native PPTX box coordinates and line breaks, license notices, and strict missing-glyph errors. A local reference comparison matched Arimo, Tinos, and Cousine on 48 shaped-text samples across their four styles. Gelasio ligatures differed from Georgia by up to 2.0125%, so it is not in the strict metric tier. See [font fidelity](../font-fidelity.md) for evidence and limitations.

## Delivery order

Selectable/vector PDF is an accepted product requirement with its own [delivery plan and verification gates](pdf-export.md). Its font work must reuse resolved faces and shaped placement, verify permission to embed/subset each face, and provide Unicode mappings for search and copy. The current raster PDF path does not satisfy that requirement; PDF embedding and text extraction are separate checks from browser font loading and native PPTX embedding.

The [Mermaid/diagram and general SVG work](diagrams-svg.md) is sequenced after font reliability is accepted. Keep its requirements and full diagram-family inventory documented, but finish the active font/layout fixes and their browser/raster/native verification and release gates before starting diagram or SVG implementation.

| Priority | Work | Deliverable | Acceptance gate |
| --- | --- | --- | --- |
| 1 | Make the starter reliable | Pinned font manifest, file hashes, license bundle, missing-font diagnostics, and reproducible package installation | A clean install renders the starter corpus without relying on system fonts; each substitution is reported |
| 2 | Modern Office defaults | Evaluate Akasia for Aptos regular/bold/italic/bold italic, then its other supported weights | Compare target font versions, shaped runs, paragraph wrapping, vertical metrics, and complete slides in browsers and native PowerPoint; keep experimental until passing |
| 3 | Text-feature parity | Explicit control of optional ligatures, kerning, font weight/style, line metrics, and rich-text runs | The same feature settings reach layout, SVG, and PPTX; add the Gelasio/Georgia regression; no silent synthetic styles |
| 4 | Latin office gaps | Calibri Light, Arial Narrow, Aptos Display/Narrow/Mono, Segoe UI, Tahoma, Verdana, Trebuchet, Consolas | Each face gets its own classification and tests; never infer Light, Narrow, Display, or Mono compatibility from the base family |
| 5 | Unicode and regional coverage | Load-on-demand Noto text/symbol packs; Japanese, Korean, Simplified Chinese, Traditional Chinese, then Arabic/Hebrew/Indic requirements | Script-aware font choice, language-aware shaping, bidi tests, combining marks, line breaking, no missing glyphs, and a documented download budget |
| 6 | Symbols and equations | Explicit Wingdings/Webdings/Symbol character maps; STIX Two Math or suitable Noto math support | Verify source encoding and semantic Unicode; preserve equations and editable intent; ordinary text fallback must not silently change symbols |
| 7 | PowerPoint portability | Import theme font aliases and permitted embedded fonts; support native embedding where redistribution and embedding permissions allow | Real PowerPoint opens exports on a clean machine with expected fonts, wrapping, and editability; document restricted/unavailable fonts |
| 8 | Original glyphs only where needed | A narrowly scoped open-font experiment for a demonstrated coverage or compatibility gap | Reproducible sources, clear provenance/license, visual review, complete style tests, and cross-engine layout conformance |

## Candidate families

- Modern Office: Akasia is an upstream Aptos candidate. Source Sans 3 is an optional visual alternative. Neither establishes Aptos Display or Narrow compatibility by itself.
- General Latin sans: Open Sans, Noto Sans, Lato, Libre Franklin, Montserrat, and DejaVu Sans cover different visual needs. Keep them optional instead of shipping every family by default.
- Serif: EB Garamond, Libre Baskerville, Libre Bodoni, Merriweather, and TeX Gyre Pagella/Bonum/Schola are candidates for corresponding stylistic gaps. Treat as visual until tested otherwise.
- Mono: Cousine and Roboto Mono cover the starter. Evaluate Inconsolata and Liberation Mono for additional requests.
- Narrow: evaluate the separately distributed Liberation Sans Narrow and its license/provenance independently. It is not included in the standard Liberation 2 family.
- International: use appropriate Noto CJK regional families and script-specific Noto fonts. A single broad fallback is not a substitute for correct shaping and language selection.
- Symbols/math: Noto Sans Symbols 2 and STIX Two Math are candidates, coupled with encoding-aware import and the relevant text/math layout engine.

These are evaluation candidates, not an instruction to install every font or a promise of metric compatibility. The curated runtime list and experimental candidates are exported by `@openpresentation/opf-render/fonts`.

## Conformance and release policy

For each target/substitute pair, record exact versions and file hashes, source/license, supported styles, repertoire, and feature settings. Compare individual advances, shaped strings, line breaks, baselines, clipping, and real slide layouts. Include accents, decomposed marks, punctuation, numbers, bullets, long tokens, and the relevant scripts. Test browser SVG, PNG/PDF, and native PowerPoint independently.

Use three outcomes: verified within a stated test matrix, approximate with explicit reflow, or unsupported with an actionable diagnostic. Upstream metric intent is useful evidence but does not replace version-specific tests. Do not promote a candidate solely because screenshots look similar.

Published renderer 0.6.0 passes the reviewed 126-deck/805-slide regression baseline. The shared quote rollout intentionally changed 41 baseline entries; the [release evidence](shared-quote-release.md) records that review separately from font compatibility. Matching the accepted baseline does not measure general visual quality or validate proprietary/open font equivalence. Font shaping, per-run fallback, native embedding and additional platform evidence are not completed by the starter pack. Original font design is deferred until existing open fonts and targeted engine fixes have been evaluated.
