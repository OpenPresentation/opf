# Furniture, JSON controls and lint integration

The furniture candidates now include core main through lint PR81 and editor main
through JSON-control PR19 and publication-check PR20. Existing furniture PRs
core #79, renderer #20, editor #17 and PPTX #34 retain focused merge/CI commits.
No runtime behavior, source examples, package version or visual baseline was
changed while integrating those already reviewed commits.

`summary.json` records the immutable runtime sources and workflow commits. The
workflow commits differ from those source references only in CI configuration.
Each job pins the same runtime graph; editor and converter CI now exercise the
installed JSON control alongside furniture editing. Linux and Windows converter
jobs retain fail-fast command execution and the unchanged paint allowance.

All six integration CI runs passed: core verification `34962091358`, CLI
macOS/Windows `34962091369`, coordinated packages `34962091577`, editor
`34961969041`, renderer `34962102749`, and PPTX Linux/Windows `34962118695`.
`ci-summary.json` links every exact-head result; `ci/` retains full logs and job
metadata. Both converter platforms explicitly complete sixteen installed
furniture workflows and seven installed JSON workflows. These results apply to
the recorded integration commits, not an untested future source revision.

## Local Node 24 acceptance

- Core: 523 tests, 11 CLI tests, four text-checker tests, schema integrity and
  TypeScript checks pass.
- The full coordinated package command passes model/geometry/font/skill checks,
  all 805 reviewed furniture raster entries, fresh candidate tarball installs,
  installed semantic/provenance checks, TypeScript/browser bundles, and 81 CLI
  commands including lint. These tarballs remain unpublished.
- Eight general installed browser suites, seven source and seven installed JSON
  workflows pass. Reports retain blocked-request/error inventories.
- Sixteen installed furniture workflows and forty measured field masks pass.
  The deliberately displaced text control still fails containment, with 297
  outside pixel centers. The four full-size screenshots exactly match the
  previously reviewed clearance views; no new visual baseline is introduced.
- The exact editor layout regression passes against the installed public
  entrypoints, including `frameBox` before/after pagination and undo. The copied
  fixture changes only its two relative editor import specifiers; its original
  and adapted hashes are retained.

The registry-predecessor failure retained in [editor PR20 evidence](https://github.com/OpenPresentation/opf-editor/tree/4557f55ea60c24ac5a8cd407f1810d4a5db6f76f/docs/evidence/json-release-checks-20260915)
is not erased by this result. It demonstrates why the coordinated core is needed;
publication still requires new dependency versions and fresh registry acceptance.

## Reproduction and scope

Use Node 24 and the recorded source refs in normal sibling checkouts. Install
their locked dependencies, run `pnpm build` in core, then
`node scripts/link-ecosystem.mjs --packages-only`. In core run:

```sh
pnpm test
pnpm typecheck
OPF_GOLDEN_BASELINE="$PWD/../opf-render/test/golden/opf-examples-png.furniture.sha256.json" pnpm test:packages
node scripts/test-packed-browser.mjs
node scripts/test-furniture-workflow.mjs artifacts/furniture-integration installed
node ../opf-editor/test/json-editor-browser.mjs artifacts/json-integration.json artifacts/npm/consumer
```

The saved layout fixture can be copied into `artifacts/npm/consumer` and executed
there with Node; it must resolve the installed packages. Run
`node docs/evidence/furniture-json-integration-20260915/verify.mjs` to check the
retained bytes and report invariants without rebuilding or using the network.

Raw logs are gzip-compressed without changing their contents. The manifest binds
the reports, consumer lock, candidate tarball hashes, regression fixture, forty
field masks, negative control and four reviewed views. CI evidence is recorded
separately as each exact-head job finishes.

The initial evidence verifier incorrectly required a summary line from every
browser suite; interactive suites report individual `PASS` entries instead.
Its retained failure concerns the evidence reader, not the browser tests. The
corrected verifier checks the exact assertion counts and rejects any failure.

Native Office recovery, native tab/image/provenance acceptance, full font-shaping
and physical-font fidelity, registry publication and public-site furniture
adoption remain unresolved. No native Office call or process action was made.
The independent lint corpus still reports 41 existing companion-catalog errors
and four reference warnings; its examples and authoritative schemas are intact.
