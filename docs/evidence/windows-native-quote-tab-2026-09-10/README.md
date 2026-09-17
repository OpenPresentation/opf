# Coordinated quote fix and native tab control

The quote classification regression is cleared on fresh native PowerPoint runs using [PPTX #24](https://github.com/OpenPresentation/opf-pptx/pull/24). Each of Node 20.20.2 and 24.20.0 completed 12 slides and 36 original/saved/edited slide imports. Exact current body/footer order and multiplicity, title edits, native character bounds and body/footer separation pass. Quotes still import as generic text blocks. Raster differences are observations without a browser/native equivalence threshold. The [original 36 failed classifications](../windows-native-2026-09-10/content-two-runtime-summary.json) remain immutable.

The independent [native-created tab harness](https://github.com/OpenPresentation/opf-pptx/pull/26) reproduces the remaining metric discrepancy without OPF input. At 16.27734375 requested points, the native tab word offset is 16.30; its directly positioned literal is approximately 16.2773224. DrawingML retains the tab to one EMU, and original/reopened observations and PNGs are identical. PDF text coordinates also differ by +0.024 point for this pair but have their own serialization rounding. This is evidence of native tab behavior, not a definitive internal cause or exact screen-pixel measurement. The existing 0.02 point gate remains failed. No tolerance or consumer offset changed.

All three tab attempts remain raw: the initial COM-only success; an ExportAsFixedFormat null PrintRange adapter failure with completed native observations; and the successful documented SaveAs PDF control. Each owned helper is bounded to 45 seconds; none timed out. Private PDFs and their proprietary font subsets are excluded. The retained independent extraction report, raster and source-PDF hash can be reproduced locally with the exact Python reader. The PDF was visually inspected for all nine tab/literal pairs. Font resource `Calibri` names do not identify a physical font file for every glyph.

`sources.json` records actual source pins, source-equivalent coordinated CI pins, application/OS details and PRs. `runtime/` contains exact open-source runtime bytes and `verifiers/` the exact native quote verifier snapshots. Native tab attempt verifiers are retained alongside each run. Proprietary reference fonts and Office binaries are represented only by SHA-256 hashes.

From the OPF repository root:

```powershell
node docs/evidence/windows-native-quote-tab-2026-09-10/verify-evidence.mjs HEAD
node docs/evidence/windows-native-quote-tab-2026-09-10/verify-tab-control.mjs
```

The manifest verifier reads immutable Git blobs and checks complete coverage, byte sizes, hashes, fixture generation and runtime bindings. Use `index` before committing. Native quote reproduction uses the retained `native-quote.mjs generate`, two separately selected `native-quote.ps1 -Deck quote-1280` / `-Deck quote-540` workers, then `native-quote.mjs compare`; point each command at one fresh evidence directory. Native tab reproduction is documented in PPTX #26. Preserve the user's existing Office documents and never automatically retry a blocked Office call.
