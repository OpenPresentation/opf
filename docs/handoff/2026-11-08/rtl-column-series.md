# RTL clustered column series positions

Candidate for v0.34.0, derived from approved integration `c43f266c75c28a2b28d63ab8938a2eddee26b1a7`. This is a new source branch; frozen SH25 and earlier chart branches remain untouched.

Actual PowerPoint's `column-ar` lifecycle measured First at 826.536851pt while its overlay was 766.221436pt: one bar width (60.259685pt). All five anchors missed by about 80.3–80.4px. The previous explanation that preview mirrored both offsets was reversed: source reversed the category slot, but left the clustered series offset increasing physically left to right. The native reversed category axis also reverses that within-cluster offset.

Vetoable decision: follow the independently observed native physical column slots using one `chartBarSeriesOffset` helper in SVG marks and core anchors. Reverse only vertical clustered RTL slots. Source series, colors and legend identities remain authored; stacked columns, horizontal bars and LTR plots retain their prior formula. Combo previews use the same column primitive; this does not expand qualified point-anchor types.

## Proof and retained limits

- New corrected core fixture: baseline 8/11 pass, exactly the three RTL scales fail; candidate 11/11 pass. Initial fixture also used explicit horizontal options outside the shared-plot domain; its source and all failures remain raw evidence. Existing six SH25 core controls pass (17 total).
- New actual SVG controls fail on baseline RTL column order; candidate four column/combo order, category direction, color and anchor cases pass. Existing 18 actual SVG bar/marker cases pass.
- [Paired sheet](rtl-column-series/review.png) was inspected: only the RTL clustered column's series marks/labels and attached circles swap physical slots; all control rows stay exact. It contains all seven complete CLI before/after pairs. There is no fixed Claude panel for these authored point probes.
- [Exact comparison](rtl-column-series/comparison.json): all 32 immutable source decks match, only `column-ar` analytical SVG changes, and six unaffected maintained-CLI PNGs/whole PPTX archives stay byte-identical. The affected archive changes only slide1.xml and the tag's native-structure fingerprint; every chart, workbook, series/options/legend and other part stays exact. The tag differs only in that fingerprint.
- Candidate chart XML is also identical to the already-run native input. The candidate serialized overlay centers are mathematically 0.042–0.078px from the previous independently observed native points. This is corroboration, not a new Office lifecycle or candidate native acceptance.
- Maintained CLI `office` / `visual` / script-auto fonts and date 2026-11-08 are identical for both PNG and PPTX. PNG scale is 1 at authored 1280×720. No type, authored data or frame changes are made.
- The first capture collector checked a nonexistent report property `compatibility`; it stopped after one successful PNG. The corrected collector checks public `substitutionPolicy`. Initial source/log/output and subsequent complete fresh run are retained. The first ZIP comparison expected only slide XML; the strict comparison was corrected to explicitly prove only its related native-structure fingerprint changes too. Raw failures are retained.

[Witness archive and per-file hashes](rtl-column-series/witnesses.json) preserve raw before/after source, PNGs, PPTX files, CLI reports, original actual native report/image and first failures. Candidate input root: `C:/opf-work/lh93-rtl-column-after-01`; `build.json` enumerates the seven native files. Fresh candidate Office acceptance, integration golden workflow review and final combined CI remain owed. Do not claim all SH25 domains qualified from focused controls.

Check completion and exact producer hashes are appended in `rtl-column-series/checks/receipt.json` before the one source push.

## Completed local checks

Immutable product commit: `d94b40949a24b5105cf3720748dfc224c4c3e9b2`. [Producer proof](rtl-column-series/producer.json) verifies all four runtime sources equal that commit and inventories the built seven-package distributions. The exported inputs predate this commit only by metadata; their authored and rendered bytes remain sealed. Checkout metadata is explicitly dirty, not disguised as a clean export.

The one required changed gate took249.8s:10/13steps pass, including build, Biome, type checks and all root checks. Core4169/4170 pass; only the inherited40template-key golden fails. Renderer stops at inherited RR108pie/doughnut digest locks with151later tests unrun; a clean approvedaf2fd focused rerun has the same actual hashes. Composition is271291gzip bytes against the unchanged267675ceiling. These are final coordinator-owned pinned-golden/budget obligations, not silently waived passes. All17focused core,4new+18existing actual SVG cases and16existing PPTX assertions pass. Full raw lossless logs and initial collector failures are in [the check receipt](rtl-column-series/checks/receipt.json). No CI watcher or native driver was started.
