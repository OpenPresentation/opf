# Installed visible-line navigation — September 15, 2026

Runtime commits: core `f246a24c3e8fadad2a005cfdafae4231f09a08a9`,
renderer `f2446b0e39a878c3836f5c4b9d9e79f918280a93`, editor
`793ec493afe1add7f8f26613fbb19bd571ee8d4c`, converter
`91d99d2eb720596128606530185a8f43b498127a`.

The [editor change](https://github.com/OpenPresentation/opf-editor/pull/21)
uses visible line and caret geometry for Up/Down and Home/End, keeps the desired
x through short/blank lines, and preserves Shift anchors and the selected side
of soft-wrap boundaries. Pointer placement retains that visual line as well.
[Source failure and acceptance](https://github.com/OpenPresentation/opf-editor/tree/793ec493afe1add7f8f26613fbb19bd571ee8d4c/docs/evidence/visual-line-navigation-20260915)
remain separately recorded. No renderer runtime or slide styling changed.

Node 24.21.0, pinned pnpm 10.33.2: freshly packed/installed packages pass the
full installed model, source/edit/undo, layout, native XML/reimport, TypeScript
and browser-bundle harness. The expanded browser suites pass nineteen prepared
workflows and twelve rich-input workflows in each of measured, estimated and
painted modes. All eight general installed suites also pass (276 assertions,
eight trusted interaction scenarios). Browser reports bind module, bundle,
font/WASM and both test verifier hashes and reject checkout imports. The
package manifest and consumer lock bind the tested tarballs.

Core `f246a24` passed OPF CI and CLI portability. Its
[coordinated run](https://github.com/OpenPresentation/opf/actions/runs/34978145234)
also passed before this checkpoint was pushed. This includes source/package
acceptance, installed browser interactions, exact registry fixtures and native
XML/geometry checks; final metadata and the watcher transcript are retained.
Editor `793ec49` [CI](https://github.com/OpenPresentation/opf-editor/actions/runs/34978321761)
passed, including all nineteen source and nineteen installed prepared cases
and twelve installed painted rich-input workflows. Current CI metadata and
reports are retained separately from the earlier running snapshot. The prior coordinated failure was an incomplete source
font-loader import, now fixed and retained in the
[built font harness evidence](../built-font-harness-20260915/README.md).

Renderer [run 34975004214](https://github.com/OpenPresentation/opf-render/actions/runs/34975004214)
is terminal: Windows and macOS pass; Linux retains the native variable-font
failure in source and freshly installed checks. Source Serif SmText Bold is
334.06213682353496px in Fontkit and 334.193115234375px in Chromium. The failed
steps are retained; tolerances, font bytes and renderer defaults are unchanged.

## Table tab export investigation

A shared-layout probe with a 120px-wide table cell and deterministic
half-em measurement yields `A\tX ` at 32px with a tab from x=16 to x=64,
then soft-wraps `B\tY` at 24px with a tab from x=12 to x=48. The source has
one paragraph. A native paragraph's combined stops [48,64] would move its first
tab to 48 instead of 64. Simply copying a union of fitted stops is incorrect.
Current table export deliberately retains authored paragraphs and native
wrapping; inserting hard paragraph breaks would alter copy/reimport semantics.
The recorded fixture is investigation evidence, not a table implementation.
Complete native table tab handling must address this conflict while retaining
original source boundaries, styles and current native edits. No table runtime
was changed in this checkpoint.

All compressed artifacts are verbatim and hash-bound by `manifest.json`.
These remain coordinated unpublished drafts. Full script/bidi/IME and lifecycle
coverage, native Office recovery, physical font identity and existing tab/image
gates remain open; no package release or site deployment follows from this
checkpoint alone.
