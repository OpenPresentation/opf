# Concurrent font/converter preparation — local acceptance

The reviewed candidate passes fresh **macOS local acceptance: 704/704 unit tests, 13/13 standalone controls, and one unchanged 39/39 browser suite with zero retries, skips, or flaky results**. This is not fresh Windows, preview, canonical production, native-font, or release acceptance. The original App54 Windows 38/39 failure remains preserved under `base/previous-failure/`.

The change overlaps full font acquisition and converter warmup while readiness still requires **both**. This preserves the converter-ready-before-preview boundary used by offline PPTX export. All 33 font faces, their 9,317,044 bytes, the manifest, measurement gates, policy, and shared lease lifecycle remain unchanged. The independent source review found no blocking issue. This candidate does not establish that converter loading was the sole cause of the earlier Windows delay.

## Fresh local result

[Acceptance report](acceptance/REPORT.md), [all 39 outcomes](acceptance/browser-outcomes.json), and original JSON/list reporters bind the one local run to build `eDrCpu0YEZtjYRCFXNVvI`, Node 24.21.0, pnpm 11.1.3, and Playwright 1.63.0 Chromium on macOS. Reporter duration was **111.898960 seconds**; the process-wrapper measurement was **112.130358958 seconds**. The owned standalone listener on port 4337 was stopped after the run; the server receipt records that no listener remained and no other server was changed.

The captured 702 regular source inputs and 33 tracked symlink targets match after the run. [Root independently rehashed the tested-source binding](root-review/root-tested-source-binding.json) and confirmed those same current inputs. The original report records the source-capture timing precisely: an initial pre-unit capture rejected a tracked directory symlink; the complete capture occurred during units and before build/browser, while the earlier frozen candidate receipt already bound the two changed files before units. No build or browser failure occurred in this local acceptance run. Source snapshots are archived as `.txt`.

The unchanged suite exercised cold/offline Author and Inspector editing/export/reimport, the previously failing initial recovery target, recovery after strict overflow, accessible font-substitution notes, and hostile SVG strings. Local success does not erase the original failed Windows gate. The actual converter/font initialization and offline workflows passed locally; fresh exact-head platform and release checks remain required.

## Visual and ownership review

[Root's visual review](root-review/root-browser-visual-review.json) records four differing screenshot pairs, each inspected as baseline and candidate (eight frames), plus recovery and font-note frames. The other 23 of 27 new screenshot files were byte-identical to the prior local baseline. No scoped new visual blocker was found. Differing hashes are not labeled pixel-perfect equivalence or assigned an unproven cause. All 27 new screenshots and the four reviewed baseline screenshots are included.

[Root's disposal review](root-review/root-disposal-ownership-review.json) confirms the installed font loader disposes only its own captured FontFace objects; a failed old preparation's cleanup does not delete by global family name. This is source evidence, separately scoped from browser behavior. [Built-font identity](base/review/root/root-built-font-identity.json) verifies the complete baseline/candidate/standalone font bytes.

The [production metadata receipt](root-review/root-production-before-publication.json), captured at 20:54:31 UTC, still identified live App53 `e40c287` and its READY deployment. It records a read-only observation, not a deployment or this candidate's production acceptance. The earlier exact-head preview was protected by Vercel sign-in; no login or bypass was performed. Native Office/font compatibility and other documented release gates remain separate.

## Preserved evidence

- `base/` is the entire prior 118-file publication bundle, unchanged: original Windows failure, exact CI/source/preview/HTTP bindings, raw logs and failure trace, diagnosis, candidate controls including baseline/intermediate failures, and independent/root source reviews.
- `acceptance/` contains the original final report, build/unit/browser/server receipts and logs, source-before/after records, every per-case outcome, all 103 non-trace browser outputs (including 27 PNGs and two PPTX downloads), and four original passing trace ZIPs listed below.
- `baseline-screenshots/` contains the four exact baseline PNGs named in root's paired review.
- `root-review/` contains the exact visual, disposal-ownership, tested-source binding, and pre-publication production receipts.
- `provenance.json` maps all immutable copies to original paths, sizes, and SHA-256 values. It explicitly lists included and omitted traces. `SHA256SUMS.json` verifies this final assembly; nested original manifests retain their original scopes.

The included passing traces preserve the actual recovery, wide and narrow offline Inspector, and Author offline workflows:

- [Inspector recovery](acceptance/results/inspector-recovery-schema--76507-ers-after-source-correction/trace.zip)
- [Inspector 1440 px offline editing/export](acceptance/results/inspector-editing-all-Insp-15273-fline-undo-export-at-1440px/trace.zip)
- [Inspector 540 px offline editing/export](acceptance/results/inspector-editing-all-Insp-a78d3-ffline-undo-export-at-540px/trace.zip)
- [Author canvas, offline export, and undoable reimport](acceptance/results/author-anonymous-Author-ca-d560b-xport-and-undoable-reimport/trace.zip)

All 39 original trace hashes/CRC results and the full 142-output inventory remain in [artifact-inventory.json](acceptance/artifact-inventory.json). The other 35 passing ZIPs remain at the original acceptance path and are omitted from this compact publication copy. All non-trace outputs are included unchanged. `acceptance/SHA256SUMS.original.json` is the byte-identical inventory of the complete 163-file original acceptance directory, not a claim that this curated subset includes every ZIP.

Copied bytes were never trimmed, normalized, or rewritten. Narrow file-scoped whitespace attributes cover only captured raw evidence where necessary. The assembly performed no application edit, test/browser rerun, commit, push, workflow dispatch, merge, deployment, account action, or native Office action. Older failures and their provenance remain intact.
