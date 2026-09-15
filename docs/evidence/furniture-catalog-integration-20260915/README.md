# Corrected catalogs in the furniture package set

Core [PR82](https://github.com/OpenPresentation/opf/pull/82) and renderer
[PR22](https://github.com/OpenPresentation/opf-render/pull/22) are merged into
main at `72f2241` and `cbf058e`. Core furniture merge `8414e83` incorporates
that correction; renderer merge `aaa9e6f` incorporates the main baseline and
updates only the furniture baseline's source fingerprint. All 805 raster
hashes and byte counts remain unchanged. Schemas, renderer behavior, authored
slide fields and package versions were not modified by this integration.

Core `363711d`, editor `651a532` and converter `891fc5f` pin the coordinated
sources in CI. Editor and converter changes are confined to their workflows;
their runtime sources remain `8d6e313` and `1363a65`. The existing furniture
PRs remain drafts while native/font and release requirements are open.

## Local acceptance

Node 24.21.0 passes all 523 core tests, eleven CLI tests, four text-checker
tests, type checks and the complete coordinated package command. All 126
saved examples lint with zero errors and warnings; all 100 generated examples
validate without writing example files. The earlier errors and warnings are
retained in the [catalog correction evidence](../catalog-example-correction-20260915/README.md).

Fresh candidate packages pass 81 CLI commands and the exact installed editor
layout regression, including pagination and undo. Their bundled examples all
lint cleanly, and the installed JSON options API exposes the 44 corrected
catalog choices with fetch disabled. Installed browser verification passes
eight general suites, seven JSON workflows and sixteen furniture workflows.
The latter cover source editing, no-op preservation, undo/redo, empty fields,
generated values and current-content PPTX export/reimport.

The fresh 805-slide candidate equals the reviewed furniture baseline except
for its accepted source digest. All forty field masks and the deliberately
displaced negative control match the prior evidence byte for byte. The
negative control still detects 297 outside pixel centers. Four full-size
views also match the prior reviewed bytes. `summary.json` identifies those
existing committed images; they are not duplicated here.

The first build attempt could not reach the registry to verify the pinned
pnpm release signature. Its failure is retained. The successful retry used
normal network access and the same Node 24 and pinned package manager; no
signature check or package-manager policy was disabled. The first archive
verification expected a different installed-choice report shape. Its failure
is also retained; the reader now checks the report's actual fields without
changing the successful product check or its output.

All six exact-head CI runs pass: core `34967517101`, CLI macOS/Windows
`34967517090`, coordinated packages `34967517097`, renderer `34967523596`,
editor `34967529801` and converter Linux/Windows `34967535412`.
`ci-summary.json` binds each result to the source/workflow records; `ci/`
retains complete job metadata and logs. These results apply to the listed
commits, with native and release requirements still separate.

## Reproduction and boundary

Use the sources in `summary.json`, Node 24 and each repository's locked
dependencies. In core run `pnpm build`, then
`node scripts/link-ecosystem.mjs --packages-only`. Run `pnpm test`,
`pnpm typecheck`, `pnpm check:examples`, and `pnpm test:packages` with
`OPF_GOLDEN_BASELINE` set to the renderer's furniture baseline. Then run:

```sh
node scripts/test-packed-browser.mjs
node scripts/test-furniture-workflow.mjs artifacts/furniture-catalog installed
node ../opf-editor/test/json-editor-browser.mjs artifacts/json-catalog.json artifacts/npm/consumer
```

Copy the installed-choice verifier from the preceding catalog evidence and
the saved installed layout fixture into the new `artifacts/npm/consumer`.
Execute them there against the installed public entrypoints. The choice
verifier takes the core checkout and output report paths as its two arguments.

Run `node docs/evidence/furniture-catalog-integration-20260915/verify.mjs`
to verify the retained hashes and report invariants offline. Raw logs, the
actual consumer lock and furniture report are losslessly gzip-compressed.

These results establish the recorded candidate behavior, source preservation
and visual regression. Native Office recovery, native tab/image/provenance
acceptance, physical-font fidelity, coordinated registry publication and
production furniture adoption remain unresolved. No native Office action,
package publication or site deployment occurred in this integration.
