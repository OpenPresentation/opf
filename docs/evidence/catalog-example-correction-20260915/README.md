# Valid local catalogs without changing slide content

Core source `08f96cdcee12616a1696cfe4f22ef8d5f91fd269` corrects the example
catalogs; `a5a2872b0e6438e1ab8b3d23776724f3418f4d83` pins the companion renderer
and merged editor for CI. Review [core PR82](https://github.com/OpenPresentation/opf/pull/82)
with [renderer PR22](https://github.com/OpenPresentation/opf-render/pull/22),
whose source is `d0e1f4a633a45256539b7c89c912dff5a617ec37`.

## Correction and preservation

The previous corpus had 41 companion-catalog errors and four reference warnings.
Forty generated themes used invalid string backgrounds. Fourteen `light1` and
thirteen `dark1` references now use the required theme object. Thirteen fixed
`#F8FAFC` defaults become `light2`, which every affected deck already explicitly
binds to that exact color. The decks' literal backgrounds, palettes and slide
overrides are unchanged. Catalog themes now follow the schema's slot semantics
if a future author deliberately changes the palette.

The `acme-night` color scheme gains its missing name and explicit schema marker.
The catalog-overrides fixture gains local records for its existing audience,
purpose and tone IDs, preserving all current root fields. No ID is renamed and
no schema or linter rule is relaxed. All 126 examples now lint with zero errors
and warnings; 401 declared external-source notices remain informational.

`source-preservation.json` binds both Git revisions and all source hashes.
Every byte outside the root `catalogs` value is identical in all 126 documents.
The other 84 documents are entirely unchanged. `changes.json` records each
catalog edit; the generator was corrected without regenerating or replacing
the authored gallery decks.

## Verification

- Node 24.21.0: all 515 core tests and eleven CLI tests pass.
- `pnpm check:examples` now checks saved examples with production lint and all
  100 generator outputs in memory. The generator check fails on the old forty
  bad records and passes after the correction; it writes no example files.
- The complete coordinated package suite passes, including fresh tarballs,
  TypeScript and 81 CLI commands. All 126 installed bundled examples lint
  cleanly. The installed JSON options API exposes 44 corrected document-catalog
  choices that were previously absent or only preserved as an unknown current
  value. That check disables fetch and retains the actual installed lock hash.
- The main and furniture rendering graphs each reproduce all 805 existing PNG
  hashes and byte counts. The original gates correctly fail on the changed
  source digest with zero raster differences. Main's reviewed timeline baseline
  changes only its source SHA-256; its complete gate passes afterward. The
  held furniture baseline is not promoted by this evidence.

The main graph uses renderer source equivalent to `f2f2d51c`, editor `4557f55e`
and converter `e480f4e6`. The separate furniture comparison uses the fresh
installed candidate recorded in core furniture evidence commit `135191c4`:
core `46948153`, renderer `3d4fa8ce`, editor `8d6e313b`, converter `1363a653`.
`furniture-candidate-packages.json` retains those original tarball hashes.
The later main package check creates a new consumer and does not reuse that
furniture runtime. Both source-gate failures are preserved as failures.

Run `node docs/evidence/catalog-example-correction-20260915/verify.mjs` to verify
the archived hashes and report invariants offline. With Node 24 and the recorded
sibling sources, `pnpm build`, the existing `scripts/link-ecosystem.mjs
--packages-only`, `pnpm check:examples` and `pnpm test:packages` reproduce the
source/package checks. Copy `verify-installed-choices.mjs` into the freshly
created `artifacts/npm/consumer` and execute it from there with the core checkout
path and a report output path as its two arguments.

Schema support, exact corpus regression, browser behavior and native/font
fidelity remain distinct. Package versions, schemas, renderer code and public
deployments are unchanged. Native Office recovery, font/native compatibility
and the coordinated release/adoption gates remain open.
