# Rich tabs and prepared direction — September 15, 2026

The expanded editing checks found real gaps after the first caret checkpoint:
pure RTL left-arrow navigation stayed at offset zero, consecutive scalar tabs
shared an insertion point, and rich tabs reached the strict font provider as
U+0009. These are now fixed without changing source text or weakening font
coverage checks. Generated Unicode direction tables also retain exact LF bytes
on Windows checkouts.

Tested runtime source:

| Package | Commit | Review |
| --- | --- | --- |
| Core | `e4980f8b52dfad641d1db6c86ac3b0e8799c0bef` | [PR83](https://github.com/OpenPresentation/opf/pull/83), stacked on furniture PR79 |
| Renderer | `f2446b0e39a878c3836f5c4b9d9e79f918280a93` | [PR21](https://github.com/OpenPresentation/opf-render/pull/21) |
| Editor | `bc9a967844ff4931fd28674e71545cecbf5a54f7` | [PR21](https://github.com/OpenPresentation/opf-editor/pull/21) |
| PPTX | `91d99d2eb720596128606530185a8f43b498127a` | [PR35](https://github.com/OpenPresentation/opf-pptx/pull/35), stacked on furniture PR34 |

Core rich fragments retain original tabs and run-relative source ranges, with
four-space stops measured at the current run's font size. Width and outline
providers never receive tab controls. The renderer uses these layout advances
for caret/selection geometry and whitespace decoration, and emits resolved
horizontal direction. The editor applies that direction to native input. Body
and list PPTX paragraphs retain tabs and receive the accepted DrawingML stops
on each rich run, as required by the writer.

Node 24.21.0 / pinned pnpm 10.33.2 local acceptance:

- Core type checking, 524 tests and the additional rich/list/layout/pagination
  suites pass. Source/style offsets, wrapping, mixed-size tab stops and explicit
  invalid metrics are checked.
- Complete renderer suite passes, including all 805 unchanged golden slides
  from 126 decks. New caret-layout checks cover scalar/rich consecutive and
  tab-only fields, decorations and emitted RTL direction.
- Complete editor and converter suites pass. Fifteen prepared browser workflows
  pass both from checkout and fresh tarballs: independent font/interpolated
  ligatures, responsive views, mixed styled wraps, pure Hebrew with combining
  marks, keyboard/pointer selection, empty fields, tabs, underlines and exact undo.
- The fresh installed graph also passes ten rich-input workflows in each of
  measured, estimated and painted modes, plus eight general browser suites
  (276 assertions and eight trusted interaction scenarios).
- Twelve installed body/list PPTX paragraphs retain tab/space characters and
  DrawingML stops matching estimated, measured and prepared shared geometry.
  The normal installed-package gate also passes source/edit/export/import,
  provenance, TypeScript declarations and browser bundling.

The gzip reports/logs are verbatim artifacts. `manifest.json` binds both stored
and decompressed bytes; the package manifest and consumer lock identify the
fresh tarballs. Browser reports record source/module, bundle, WASM and verifier
hashes and reject checkout imports in installed mode. Reproduce with the
existing `pack:ecosystem`, `test:packed-ecosystem`, `test:packed-browser`, and the
editor's prepared/rich-input browser commands. Build core before running
dependent package tests: two initial parallel launches hit a core dist rebuild
race, recorded separately from the passing ordered reruns. A singleton
selection assertion was corrected to handle one rectangle per tab; a PPTX test
fixture was corrected to use an inline Arimo font scheme instead of an unknown
catalog id. Neither change relaxed product behavior or tolerances.

Prior CI at renderer `6fed8d4` is retained: macOS passed; Linux preserved the
existing source and installed native variable-metric failures; Windows failed
because Git converted the generated direction table to CRLF. The LF rule in
`d467efe` was independently tested using `git checkout-index` with
`core.autocrlf=true`: the predecessor produces CRLF and the fix preserves exact
generator bytes. Previous editor `67ce1b7` Linux CI passed installed carets.

Current-head [editor CI 34975326604](https://github.com/OpenPresentation/opf-editor/actions/runs/34975326604)
passed on Linux, including source and installed prepared/rich editing.
[PPTX CI 34975238288](https://github.com/OpenPresentation/opf-pptx/actions/runs/34975238288)
passed on Windows and Linux. Their metadata and reports/logs are retained.
[Renderer CI 34975004214](https://github.com/OpenPresentation/opf-render/actions/runs/34975004214)
has passed macOS and Windows; Linux was still running at this checkpoint.
Consult that run for completion rather than treating local checks as CI.

These remain unpublished drafts. Pure RTL runs are not paragraph bidi or
script itemization; real OS IME, broader font/settings, performance/lifetime,
rich table-cell tab placement and full rich-source native round trips remain
open. Native Office recovery, physical font identity and the existing tab/image
gates are unchanged. No source normalization, pixel offsets, tolerance change,
new npm version or public-site deployment is part of this checkpoint.
