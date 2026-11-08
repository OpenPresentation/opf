# E1 after02: first 60 sheets visually reviewed

Evidence only. Never merge this branch. This review inspected actual `view_image` PNGs from immutable [after02 at 29ba0ae536b019ada68623d44850d6cb3b7a6350](https://github.com/OpenPresentation/opf/tree/29ba0ae536b019ada68623d44850d6cb3b7a6350/docs/evidence/e1-033-after-2026-11-08-02). No input or rendered artifact changed and no image was rendered again.

[Finite judgments and source/image hashes](e1-review60/review.json), [checksum verification](e1-review60/verification.json), and [bounded measured-code evidence](e1-review60/measured-code.json) preserve the result. The order is the execution receipt's deck order, then ascending sheet ordinal: overview 1–13, pilot 1–11, batch-01 1–13, batch-02 1–13, batch-03 1–10. All 60 sheets / 232 slide triptychs were viewed individually at original image detail. The remaining 184 sheets / 704 triptychs are unreviewed by this batch. Earlier targeted triage remains separately scoped; neither that triage nor this batch accepts all 936 slides.

## New confirmed follow-up: E1V60-01

Short code in a mixed code/text row stays small inside a mostly empty full-height panel. This is an under-capacity readability finding in the actual 0.33 output, not a claim that the font shrank from the unrecovered historical producer. The authored sources set no code size, font size, font style, min/max size or fill override on these blocks. Existing reading-measure PR1194 handles ordinary paragraphs and does not cover this code growth.

| Source / slide | Immutable paired sheet | Settled code / panel |
| --- | --- | --- |
| Published sampler, `dynamic-code-text`, ordinal 48 | [overview/review-12.png](https://github.com/OpenPresentation/opf/blob/29ba0ae536b019ada68623d44850d6cb3b7a6350/docs/evidence/e1-033-after-2026-11-08-02/sheets/overview/review-12.png) | 22 px code, 3 lines × 26.84 px = 80.52 px in 510.923 px height (15.76%) |
| Recovered pilot, `dynamic-code-text`, ordinal 42 | [pilot/review-11.png](https://github.com/OpenPresentation/opf/blob/29ba0ae536b019ada68623d44850d6cb3b7a6350/docs/evidence/e1-033-after-2026-11-08-02/sheets/pilot/review-11.png) | Same authored code and same 15.76% height |
| Recovered batch-02, `s34` | [batch-02/review-09.png](https://github.com/OpenPresentation/opf/blob/29ba0ae536b019ada68623d44850d6cb3b7a6350/docs/evidence/e1-033-after-2026-11-08-02/sheets/batch-02/review-09.png) | 22 px code, 6 lines × 26.84 px = 161.04 px in 514.923 px height (31.27%) |
| Recovered batch-03, `s12` | [batch-03/review-03.png](https://github.com/OpenPresentation/opf/blob/29ba0ae536b019ada68623d44850d6cb3b7a6350/docs/evidence/e1-033-after-2026-11-08-02/sheets/batch-03/review-03.png) | Same 22 px / six-line / 31.27% geometry |

The actual PNGs are 640 × 360 at scale 0.5, so the 22 px source code is drawn at 11 px there. Notes remain 28 px before scaling. These four occurrences represent three authored cases; pilot/sampler duplication is explicit. There are zero diagnostics on these source slides. Both the full triptychs and the individual after images were visually inspected. The advisory proof uses genuine published 0.33 public composition and office/visual/auto font APIs without rendering; exact code source, panel geometry, complete text and source hashes are retained in the measurement receipt.

Queue a bounded mixed-row code growth fix after the active timeline fix. Keep authored content/order, all note sizes and fonts, fixed controls and strict fit guards. Show before/after sheets of these exact cases and include controls before claiming acceptance. No product edit is part of this review.

## Existing work and controls

- Ordinary long prose at b01/s27+s45, b02/s16+s33, b03/s11+s18+s29 maps to PR1194's general retained-type reflow. The already-known b13/s32 witness lies outside this batch. These are final-0.34 recheck locations, not new duplicate items.
- Small multi-timeline labels/notes, especially b03/s27, remain the active LH-41 class. This review does not duplicate that defect or accept its proposed fix.
- b02/s36 has explicit `chart.type: pareto` with two numeric series (`Current`, `Baseline`). Current 0.33 draws both series as grouped columns without the cumulative curve. The coordinator identifies this as the known multi-series Pareto limitation; discarding a series to imitate the fixed panel would be wrong. The located 0.33 findings array for s36 is empty. F3 should verify the adaptation-report contract; this is not reported as a new single-series Pareto bug.
- Template `layout-code` (overview/pilot 26) hugs its snippet at 54.39% text-to-box height; b02/s30 is 62.89%. Those are controls for LH-101's accepted snippet-hugging policy. A large surface alone is not used to flag every code slide. Lone-code, dense-code, sparse metric and table observations stay distinct from E1V60-01.
- The selected 232 triptychs carry ten original `opf/numbering-start-ignored` findings and no overflow/unplaced warnings. All 427 corpus warnings remain in the source evidence packet; their count is not a new-regression count. The overcapacity/unplaced cases outside this batch have not been newly accepted here.
- Six current-only sampler diagram layouts visibly disclose absent before/Claude panels. Missing before b11/s27, b13/s29 and b17/s04 are outside this batch; their source packet/earlier triage remains authoritative. The fixed image-only Claude covers are preserved without fabricated replacement content.

## Vetoable decisions / progress log

2026-11-08, V60-1: Use receipt order for a finite first-60 batch and record every view, checksum, slide binding and note. Separately view duplicate pilot sheets rather than infer that they were inspected.

2026-11-08, V60-2: Treat E1V60-01 as a current under-capacity mixed-code finding. Keep three unique authored cases and the duplicate pilot occurrence explicit. Do not infer an exact old/new font-size regression while the old producer is unknown.

2026-11-08, V60-3: Route ordinary reading measure, nested timelines and multi-series Pareto to existing work. Keep raw warning/source controls and avoid creating duplicate bug claims from warning counts or image-style differences.

2026-11-08, V60-4: Retain the accepted LH-101 snippet-hugging controls. Subordinate chart/table/metric labels and whitespace alone do not establish a new implementation defect; the owner's design judgment remains vetoable.

2026-11-08, V60-5: This is completed bounded visual review, not full E1 acceptance, final-0.34 acceptance or public publication. The remaining 184 sheets are explicitly unreviewed by this batch. No Office, login, deployment, CI watch or product-source change occurred.

Reproduction: `capture-review.mjs` checks all 60 PNGs against the immutable Git tree, all 232 after hashes and five source files against the execution/archive receipts; it assembles the retained judgments, it does not render images. `measure-code.mjs` measures only the listed source cases using the approved installed consumer. Initial exploratory measurement calls failed on an unavailable root compose export and a Windows path import; the declared `/composition` export and file URL corrected those review-script calls. They did not alter source or output artifacts.

Validation: one required changed-scope run passed install/build, Biome, fragment, release-report and skill-command checks. Its tracker/text steps initially failed on missing sparse evidence fixtures. Exact HEAD blob hydration restored 1,806 native metadata/limitation/text fixtures (44,622,204 bytes) and the two named catalog-proof files; no fixture bytes or assertions changed. The affected tracker passes 18/18 and strict freshness (863 records); text passes 6/6 and the 8,572-file scan. Initial and focused-rerun logs remain in the packet. No package suite, type check, broad CI or golden regeneration was selected.
