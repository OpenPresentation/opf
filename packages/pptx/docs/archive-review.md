# Reviewing exact PPTX archive locks

The nine ChartEx fallback decks and the 21 RR54 default-export decks are separate contracts. Keep their generators, receipts and candidate JSON files separate.

The nine-deck source helper is `test/helpers/chartex-fallback-decks.mjs`. A test binds its exact deck definitions to both the historical `test/fixtures/chartex-fallback-main.mjs.txt` source and the locked `test/fixtures/chartex-fallback-main.json` definitions. `test/chartex.mjs` still checks the complete archive SHA256, size, ordered diagnostics, layout count and layout-tag count without normalization or relaxed assertions.

From a clean final candidate checkout, build that checkout and a clean checkout at the exact accepted baseline export commit. Preserve both build logs. Then run:

```powershell
node packages/pptx/scripts/review-chartex-fallback-archives.mjs --baseline C:/opf-work/accepted-baseline --candidate C:/opf-work/final-candidate --out C:/opf-work/nine-archive-review-01 --baseline-export-ref <full-40-character-baseline-sha>
```

Run the command from its selected candidate checkout. The output directory must be fresh and outside both checkouts. The baseline must be the exact selected commit; both source trees must be clean. Builds are deliberately separate: the reviewer records every relevant dist file, resolved module path, source tree object, catalog hash, Node version and tool hash, and rejects producer/runtime changes during the review. A stale baseline build cannot silently pass a different expected archive: all nine existing locks must reproduce before any candidate export starts. Keep the build logs to bind the candidate dist inventory to the selected final source.

The export caller is exactly the test's registered-gallery `toPptx(deck, {chartex: 'fallback', catalogs: [gallery], onDiagnostic})` route. It adds no timestamp, seed, font preparation or CLI defaults. This is an API archive contract, separate from shipped-CLI/native qualification.

The reviewer retains all 18 complete PPTX files, baseline and candidate summaries, complete unnormalized ZIP inventories, changed raw part bytes, and nested embedded-workbook inventories/differences. An unsuccessful baseline leaves its raw bytes and summary inspectable but produces no candidate fixture. The generated `candidate-fixture.json` preserves source decks, historical metadata and previous locks. The command never writes either input fixture, the 21-deck RR54 fixture or the separate historical native-acceptance fixture.

Review every changed part and its declared reason, including any new catalog layouts and tags; compare embedded workbook contents too. Select the final integrated catalog/source first. Only after that review should a separate source change copy the generated candidate JSON into the locked nine-deck fixture and run the unchanged strict tests. Never hand-edit archive hashes or use normalization to make a lock pass. Existing native receipts can be reused only with exact input-byte identity; generation of these locks is not native acceptance.

The 21-deck family continues to use `packages/pptx/scripts/review-rr54-archives.mjs` and `test/fixtures/rr-54-unchanged.json`. This command does not refresh that family. Raster goldens continue to use the pinned `golden.yml` workflow only.
