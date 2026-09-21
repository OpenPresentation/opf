# D evidence: native tab-stop control on Windows PowerPoint

## Scope

This evidence records one bounded native-created PowerPoint control for tab-stop geometry. It separates worker and ownership safety from the measured 0.02-point fidelity gates. It does not claim that a successful PowerPoint lifecycle implies that a geometry tolerance passed.

## Retained attempts

| Attempt | Role in the evidence |
| --- | --- |
| `native-tab-v2-01` | Failed harness attempt. PowerPoint saved the owned deck, then PowerShell dynamic scope caused the stage label to replace all requested shape names and observation stopped. The failed worker report remains `cleanupConfirmed=false`. `native-tab-before-ui-close.pptx` and `supervisor-ui-close.json` separately retain the exact-byte copy and supervised UI close; they do not relabel the failed worker cleanup. This attempt is not a fidelity result. |
| `native-tab-v2-02` | Ownership lifecycle completed, but offline metric postprocessing failed because Windows PowerShell 5.1 did not project `OrderedDictionary` keys through `Measure-Object -Property`. The raw report retains `metrics:null`; recovered metrics are separate evidence. This attempt established the loop-based metric fix. |
| `native-tab-v2-03` | Worker exit 0, cleanup confirmed, and content, persistence, raster, and source checks passed. The native tab-target and pair-agreement 0.02-point gates failed. Its pre-fix report serialized native Single observations in rounded JSON forms while calculating metrics from the fuller in-memory values, so a JSON-only replay differs slightly. The immutable report is retained as serialization-limit evidence. |
| `native-tab-v2-04` | Final reviewed control. Captured native Single values were promoted to Double before JSON. Worker exit 0 and cleanup passed. The independent Python stdlib audit exactly recomputes every stored phase, persistence, and content metric from all nine original and reopened records. The tab-target maximum error is `0.022655487060546875` points and the tab-minus-literal maximum is `0.022678375244140625` points, so the separate 0.02-point tab and pair gates fail while the literal gate passes. |

## Proposed bundle inventory

- The four raw attempt directories, including their request, report, worker, supervisor, progress, stage log, exact input snapshots, owned PPTX, and PNG evidence where present.
- The run-01 supervised UI-close record and byte-preserved presentation.
- The separate run-02 recovery result and run-03 serialization-limit explanation.
- `native-tab-v2-04/metrics.root-replay.json` and `root-precision-check.json`.
- `tab-independent-audit-04/audit-tab-v2.py` and passing `audit-report-v2.json`. The preserved `audit-report.json` is a failed audit-development output caused by an overly strict JSON `0` versus recomputed `0.0` type comparison and a too-small bound for the PowerShell replay subtraction delta; it is not the final audit result.
- Source documentation and the exact tested verifier/process-helper revisions, with a bundle manifest of paths, sizes, and SHA-256 hashes.

## Interpretation

Run 04 is a worker and lifecycle pass with a native geometry-gate failure. Original and reopened PPTX observations are persistent, and the PNG bytes are identical for this bounded control. Those facts do not establish universal rendering equivalence.

Python's binary-double replay of the run-04 JSON observations matches every stored metric exactly. The separate Windows PowerShell 5.1 replay first materializes JSON numbers as `Decimal` and then casts them to `Double`; index-8 offsets differ by about `1.4e-14` points and their subtraction by about `2.8e-14` points. The recorded maxima and all gates are unchanged.

The bundle should contain no installed font program, PDF, user screenshot, recent-file data, or unrelated private material. Raw reports and attempt artifacts remain immutable; later audit and explanatory files are additive.
