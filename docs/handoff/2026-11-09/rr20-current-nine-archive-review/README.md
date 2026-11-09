# Actual current nine-deck archive review

The maintained nine-deck reviewer ran **once** on clean built producers, reproducing every current baseline lock before exporting any current candidate. All nine candidate archives change only the inverted-pyramid provenance hash in `ppt/tags/opfLayout18.xml`, from the reviewed SH-24 public-description correction.

This is an **evidence-only branch; never merge it as product source**. The generated candidate JSON stays an unpromoted proposal. No locked fixture, historical source, tolerance, golden, exporter or chart property changed. This packet does not qualify the separate21-deck family or native PowerPoint behavior.

## Exact source and bounded decision

Vetoable **RR20-BASELINE-CURRENT-LOCK**, explicitly accepted by the coordinator: baseline `c9732accd41cfffa27b8893251f33868c6b0514e`, candidate `5b9e4386c00319da1fa4370dcc0b3eb6e93c9578`. The baseline previously passed the280-file PPTX contract and carries the approved fixture SHA `73cea56b226a75d785c2d00d980776743bc412e18f723717ee7e61cab5549d68`. Raw513 and0cafa retain old091830 fixture locks and cannot satisfy the reviewer's same-current-lock guard without forbidden mutation. No failing review invocation was used to override that guard; source inspection established the incompatibility before exports.

Both roots were isolated using maintained `agent-worktree.mjs`, installed with unchanged frozen dependencies under Node24.20.0/pnpm10.33.2, then normally built for core/gallery/render/PPTX. Builds and the one review use the maintained machine-wide slot. Missing workspace-bin warnings before first builds remain in the actual successful install logs. Both producer trees stayed clean; the reviewer sealed all four dist inventories, own-root ESM resolution, catalog/tool/source hashes and unchanged input fixture bytes.

The previous original producer `513156a982397eaa0033808215fbb86dd284745b` remains bound through immutable `5e89a184ffc8a38539f5fb5e573f403066bcca17`. Offline comparison proves every newly generated c973 baseline PPTX byte-identical to its corresponding published513 archive.

## Actual result

- 9 baseline plus9 candidate PPTXs retained, with raw changed parts, full unnormalized ZIP inventories and source/build/protocol receipts.
- 1,407 total package parts:9 metadata changes,1,398 byte-identical parts.
- Each changed tag is519bytes before/after and changes21 raw bytes: hash `4baa264255f9f66b` becomes `22f5fe00efa7a1f8`; every other payload field is identical.
- All15 complete embedded XLSX archives and180 nested workbook parts remain byte-identical.
- Ordered diagnostics, layout counts and layout-tag counts remain identical for every deck. No nonmetadata difference was observed.
- Actual treemap output is107,591bytes/SHA `c844c8abe2f223546f9a735e27f16cb0e036dd7c519b01992e02df5c22639079`, matching the separate pure derivation and actual combined failure.
- Generated `candidate-fixture.json` SHA `94cfa51624b4a1bf01e4f7ad84f7ed1ffc61f2f3b245ee49a5ec8088cd6b0105` is outside both producers and has not replaced a lock. It preserves all source/history/deck fields and appends only this review/current previous-lock history.

The complete nine-row current/baseline SHA, size, diagnostic and count table is in snapshot `run/nine-audit.json`. Actual outputs remain in `outputs/`; `run/nine-workbook-inventories.json` lists all nested bytes.

## Offline verification and boundary

```powershell
node docs/handoff/2026-11-09/rr20-current-nine-archive-review/verify.mjs C:/opf-work/integration-034/packages/pptx/package.json
```

This reads the sealed snapshot and existing immutable Git evidence; it invokes no exporter, build, browser, service or Office API and writes no file. The dependency path only supplies existing unchanged fflate0.8.3. Git access under C:/opf-work uses the established elevated sandbox context. Manifest hashes bind all raw inputs; verification separately checks previous published ZIPs, actual package/workbook bytes and generated proposal history.

The original combined gate remains RED. This is causal review, not fixture promotion or a passing rerun of the failed test. No full280-suite, native run, provider action, CI dispatch or push occurs here. Root owns independent review, publication of this evidence branch, final maintained fixture promotion and strict combined acceptance.
