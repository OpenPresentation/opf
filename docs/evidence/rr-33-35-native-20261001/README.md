# RR-33, RR-34, RR-35 and RR-36: native PowerPoint checks (2026-10-01)

Supervisor-run native checks of the numbered-list (RR-33), footnote, citation and caption (RR-34) and chart option
(RR-35) decks, and of the single-series chart colour fix (RR-36), on the Windows host with PowerPoint 365. Internal
evidence only; nothing here is shown on pptx.gallery. Decks, saved `.pptx` files and PNGs are not committed (they stay
in the supervisor's scratch folder); only the analysis reports are.

| File | What it records |
| --- | --- |
| [report.md](report.md) | Run `native-run-20261001-201706` (v1): 25 decks, 122 slides. Per-check verdicts (RR-33 29 pass, 3 review; RR-34 17 pass, 1 fail, 5 review; RR-35 23 pass, 1 fail, 6 review) and findings F1 to F9. F1 (citation markers about 0.75x smaller in PowerPoint) and F2 (chartex axis titles blank and lost on save) were the two failures. |
| [parity-investigation.md](parity-investigation.md) | Follow-up on the review findings: causes, which were harness faults (the RR-35 build script called `toPptx` without `textMeasurement`) and which were product (single-series per-point colours, fixed by opf-pptx#149 and opf#272), and the same-day native confirmation of the RR-36 fix. |
| [v2-run-20261001.md](v2-run-20261001.md) | The v2 run (`native-run-20261001-214051`, 25 decks, all opened and saved): chartex axis titles present after a PowerPoint save, citation marker size matching. |

Burndown rows: RR-33, RR-34, RR-35, RR-36 ([burndown](../../programs/release-readiness/burndown.md)).
