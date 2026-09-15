# Prepared caret checkpoint — September 15, 2026

This records local validation of renderer `6fed8d4c064c8de3bdab61590bd7a9398ea20c3d`
and editor `67ce1b780828459cba59dbda8e4cebe55f7d4172`, with core source
`8414e83322293101b20925fd8c63d3c8c3bb9d18` (current core checkout `e4df386`).
Both changes are committed and pushed in draft PRs:
[renderer #21](https://github.com/OpenPresentation/opf-render/pull/21) and
[editor #21](https://github.com/OpenPresentation/opf-editor/pull/21).

Node 24.21.0 package metadata/syntax checks, the full renderer shaping suite and
the complete editor Node suite passed. Renderer carets cover 86 face/text cases,
20 independently read GDEF positions, 44 explicitly interpolated positions and
1,309 direction comparisons with pinned WASM. Existing painting checks pass
650 supported source-preserving runs, 13 explicit missing-coverage controls and
five unchanged-layout/logical-text slides.

Six new Chromium 153.0.8010.12 workflows pass for scalar/rich input, font-defined
and interpolated ligatures, two viewport widths, selection, trusted pointer
input, source-preserving commit and undo. Maximum caret error is
0.01519201432044781 CSS pixels under the existing 0.1-pixel requirement. A control
changes invisible native text geometry: candidate carets stay in place and each
case's before/after screenshot bytes match. Ten measured and ten estimated
rich-input browser workflows also pass.

The exact same browser verifier was run against an isolated archive of editor
`651a5321a91f33d705c74ec5f25c335ff279e091` with the current renderer provider.
It fails at a font-defined ligature caret by 0.38854244723916054 pixels before the
control; after changing invisible native geometry, its maximum drift is
33.15833255276084 pixels. The retained reports share verifier SHA-256
`9ee763ec41a9b57f92d0789631a9340fc749a031591b7a4030e6847923db707e`.
Earlier probes first hit screenshot inequality and a Carlito fixture using an
unsupported U+0302. The committed test checks alignment before screenshot
equality and retains the combining-mark fixture in Gelasio, which supports it.
No product coverage rule or tolerance was relaxed.

The five gzip reports are verbatim source artifacts; `manifest.json` binds both
compressed and uncompressed bytes. Browser reports include runtime input,
bundle, WASM and verifier hashes. Reproduce using the commands in the two
repositories' `docs/prepared-carets.md`. The predecessor uses `git archive` of
the commit above, the candidate's test, and the same renderer/core graph.

Current candidate CI was running when recorded:
[renderer](https://github.com/OpenPresentation/opf-render/actions/runs/34972060370),
[editor](https://github.com/OpenPresentation/opf-editor/actions/runs/34972181739).
Fresh installed acceptance, broader painted input, soft wraps across styled
runs, browser RTL/empty fields and robustness/performance remain pending.
Source success is not installed or CI success. Existing native variable-font
metric failures, Office recovery and tab/image acceptance remain separate;
there is no new npm publication or production deployment in this checkpoint.
