# Installed whole-source grapheme editing

Runtime commits: core `cd7ad0e596d67e4854c9d81dc43d8c5baf0e3335`,
renderer `f2446b0e39a878c3836f5c4b9d9e79f918280a93`, editor
`7c9e0b3e59791f9b9caf47be4f21764daed3a245`, converter
`91d99d2eb720596128606530185a8f43b498127a`.

A rich run boundary could expose a caret between a base letter and its combining
accent, even though whole-source range formatting correctly rejected it. Editor
[PR21](https://github.com/OpenPresentation/opf-editor/pull/21) now filters native
and prepared caret/navigation points through the complete source's grapheme
boundaries. Original runs, styles, line endings and metadata remain intact.
The [source and matched installed predecessor failures](https://github.com/OpenPresentation/opf-editor/tree/7c9e0b3e59791f9b9caf47be4f21764daed3a245/docs/evidence/cross-run-graphemes-20260915)
show the same trusted click selecting offset 1 instead of 2 before the fix.

Node 24.21.0 / pinned pnpm 10.33.2: the fresh installed graph passes the normal
model, layout, provenance/reimport, TypeScript and browser bundle checks. Twenty
prepared workflows and thirteen rich-input workflows in each of measured,
estimated and painted modes pass, along with all eight general browser suites
(276 assertions and eight trusted interaction scenarios). New pointer, arrow,
Shift-selection and typing checks preserve differently styled bases and accents
before and after a CRLF, with draft isolation and exact document undo.

The package manifest and consumer lock bind the tarballs. Browser reports bind
module, bundle, font/WASM and verifier hashes and reject checkout imports.
Compressed reports are verbatim; the manifest hashes stored and raw bytes.
The initial metadata captured running jobs. Final evidence now confirms core
`cd7ad0e` passed all three workflows, including [coordinated acceptance](https://github.com/OpenPresentation/opf/actions/runs/34979707274).
Editor `7c9e0b3` [CI](https://github.com/OpenPresentation/opf-editor/actions/runs/34980714174)
also passes: twenty source and twenty installed prepared cases and thirteen
installed painted rich-input workflows. Final metadata and actual reports are
retained separately from the running snapshots.
No registry publication or public-site deployment occurred.

## Remaining cross-run shaping dependency

`probe-shaping.mjs` compares identical source text and paint formatting expressed
as one run or two runs. It uses installed package exports and pinned open fonts,
rejects runtime aliases/checkout modules, and records font/module/WASM hashes.
Run it from `artifacts/npm/consumer` using Node 24 with:

```sh
node --input-type=module < ../../../docs/evidence/cross-run-graphemes-20260915/probe-shaping.mjs
```

At 32px, Arimo `AV` measures 40.3125px as one run and 42.6875px as `A` + `V`;
Gelasio `office` measures 75.53125px as one run and 76.296875px as `of` + `fice`.
Identical formatting should not lose kerning or ligatures solely because of
source-run boundaries. The equal-width combining-mark example does not establish
identical glyph placement. This probe records an unresolved issue, not passing
shaping acceptance. The caret fix does not change the renderer or core fitting.

The next font/layout change must preserve shaping context across compatible
runs while retaining authored run ranges and formatting for editing, tracing,
undo and export. Rewriting or flattening the source is not an acceptable fix;
fragment-local shapes or prefix-width guesses cannot stand in for the accepted
whole run. Review changed line breaks and ink across the full corpus.

Paragraph bidi/itemization, fallback, broader font/feature/lifecycle coverage,
rich native table tabs, native Office recovery and existing font/tab/image gates
remain open. The goal and coordinated drafts remain active and unpublished.
