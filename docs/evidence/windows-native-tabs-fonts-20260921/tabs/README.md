# Windows native tab-stop evidence — 2026-09-21

This directory is a byte-preserving, portable evidence bundle for the bounded D plain-text native tab-stop control. It records a native 0.02-point failure and the harness lineage needed to interpret it. It does **not** complete goal D: mixed-size table behavior remains open and is outside this bundle.

The control originates from a new presentation created directly by PowerPoint, not an OPF-generated or imported presentation. It contains one 960 × 540 slide and nine pairs of native text boxes. Each pair compares a leading U+0009 tab followed by `Before` against a directly positioned literal `Before` at the same requested offset. No font program or PDF is part of the evidence.

## Tested runtime and source binding

The final run used PowerPoint `16.0.20326.20158` on Windows build `26200.9457`. Every attempt preserves its own request, environment, worker and supervisor result, durable stage log, and exact verifier/process-helper snapshots. Those run-local snapshots are the authority for what executed.

[OpenPresentation/opf-pptx PR 48](https://github.com/OpenPresentation/opf-pptx/pull/48), head `4b5d756`, adds the bounded tab control. Its `test/native-tab-control-v2.ps1` bytes have SHA-256 `6a0f8f33e1072cf373e7b6c744d248ae89ec66901e7b8a3be6c89a32cce660dd`, exactly matching the final run-04 verifier snapshot. Earlier attempts intentionally retain earlier verifier snapshots and must be read against those bytes rather than the final source.

## Attempt lineage

`native-tab-v2-01` is failed harness evidence. PowerPoint saved the owned deck, then PowerShell dynamic scope caused the wrapper stage label to replace the requested shape names, so observation stopped at missing `tab-0`. The worker report remains `cleanupConfirmed: false`. `supervisor-ui-close.json` separately records a supervised close of the exact saved file with unchanged bytes and an empty PowerPoint workspace. It does not rewrite the failed worker cleanup state, and this attempt is not a fidelity result.

`native-tab-v2-02` completed the owned native create/save/close/read-only-reopen/export/close lifecycle with cleanup confirmed. Later metric postprocessing failed because Windows PowerShell 5.1 did not project `OrderedDictionary` keys through `Measure-Object -Property`. The raw report remains a failed worker report with `metrics: null`. Both recovery files and both independent-auditor versions are retained separately; the passing auditor binds the raw observations, hashes, package, and successful native lifecycle without relabeling worker success.

`native-tab-v2-03` completed with worker exit 0, cleanup confirmed, and passing content, persistence, source, and raster checks. The native tab-target and pair-agreement gates failed at 0.02 points. Its pre-fix observations serialize native Single values in rounded Windows PowerShell JSON forms while its metrics were calculated from fuller in-memory values. The raw report is retained as the serialization-limit result; it should not be used to claim exact JSON-only metric replay.

`native-tab-v2-04` is the final reviewed control. Native Single observations were promoted to Double before JSON. The worker exited 0 with cleanup confirmed; content, save/reopen persistence, source bytes, and rasters passed. Independent Python standard-library recomputation exactly matches every stored original and reopened phase metric for all nine records, plus persistence and content. The literal-target gate passes. The tab-target maximum error is `0.022655487060546875` points and the tab-minus-literal maximum is `0.022678375244140625` points, so the tab-target and pair-agreement 0.02-point gates fail in both phases. This is a worker and lifecycle pass with a separate native geometry-gate failure.

Windows PowerShell 5.1 offline replay first materializes JSON numbers as `Decimal` and then casts them to `Double`. Run 04 therefore has index-8 offset differences of about `1.4e-14` points and a subtraction difference of about `2.8e-14` points in that replay. The maximum errors and every gate are unchanged. `root-precision-check.json`, `metrics.root-replay.json`, and the final independent audit keep this representation detail separate from the exact Python binary-double replay.

## Visual review and limits

The root supervising agent reviewed the complete exported slides for attempts 02, 03, and 04 on 2026-09-21. `visual-review.json` binds that statement to the six original/reopened PNG hashes. Byte-identical original and reopened PNGs are persistence evidence for these finite controls; they are not a general PowerPoint rendering or pixel-equivalence claim.

This bundle supports only the plain-text native control described above. It does not establish mixed-size table layout, general text reflow, cross-version behavior, or goal-D completion.

## Reading the bundle

`artifact-manifest.json` inventories every payload file except itself with its source-relative path, byte length, and SHA-256. Raw attempt directories are unchanged copies, including failed versions, recoveries, precision checks, scripts, JSONL stages, worker logs, PPTX bytes, and exported slide rasters. Raw reports intentionally retain historical absolute host paths; use the bundle paths and hashes for portable inspection.

The builder copies only its explicit whitelist, excludes `__pycache__`, and rejects font programs, PDFs, screenshot names, recent-file data, and symlinks. `.gitattributes` contains `** -text` so Git will not normalize evidence bytes. Run `python portable-verify.py` for standard-library inventory, hash, JSON/JSONL, PPTX CRC/XML/font, lineage, precision-result, and review-binding checks. The verifier makes no Office calls.
