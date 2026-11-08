# Wave-2 independent review and assembly, 2026-11-07

This is a preparation branch, `codex/wave2-review`, not a released or CI-approved integration. The parent coordinates the final merge of v0.33.0/main, one golden regeneration, and one integration gate. The evidence-only branch `handoff/review-sheets-2026-11-07` was read but never merged. No source PR branch was modified.

All 17 requested heads were code-reviewed and locally assembled. Source revisions below are immutable; the review fixes are ordinary commits on this derived branch.

| PR | Reviewed head | Result |
| --- | --- | --- |
| #1123 LH-46 | `67490486efa29af76b45d060526642dd53aabd15` | Code and closing-lead sheet accepted; lead and card grid preserve text size. |
| #1124 LH-102 | `84d309869cce3df112ee45be820dd663368cf65d` | Code and two centered-stack sheets accepted, plus combined LH-69 correction below. |
| #1131 LH-69 | `aa680dcfabcce0f34495d0c820b484d10c40adcd` | Code and five-slide sheet accepted, plus combined growth correction below. |
| #1130 LH-30 | `0b661cad609bdde72d4a17f6780337fcfc8e91fd` | Diagnostic-hiding defect fixed; optional-parent policy is an explicit vetoable decision below. |
| #1129 LH-61/LH-73 | `3e64e6a86583940f55a33ceb0e81ca3d0ae95b64` | Documentation and all three comparison sheets accepted. Keep larger KPI/table text and readable notes rather than imitate smaller captions. |
| #1135 LH-80 | `91c07d230e0ccab6c568ad3c5c975ac56be2c95f` | Reviewed only after `117de8059277c06597c5d2c2c54f39e370fb22e7`; estimated-width m17 track accepted with whole-word two-line cells at the same font size. |
| #1126 SH-08 | `9570ebea55036ec3bca8687e6f0e21f74b8d1f44` | SmartArt reader and importer reviewed; large hidden overlay moving the heading was reproduced and fixed. |
| #1109 SH-12 | `36979baa67540ce35ad340af31d85b53365a6378` | DOT parser and native export reviewed; generated cluster identity collision fixed. |
| #1119 SH-13 | `4d5905db4bb515f79ef5beeca6d8946cec7cb166` | Stacked on #1109. PlantUML parser and native export reviewed; identity collision, reversed state edge and unbounded scheduler fixed. |
| #1118 LH-110 | `c4b0227f58bd934499ca5a85271f982fd3f847b0` | Code and six-slide reference-line sheet accepted; axes include lines, number-word labels use digits, no text shrinks. |
| #1114 RR-105 | `b7aff87f8b9e65d9acd526dd90fd94f3d1e38511` | Native-wrap interval and small-run title baseline reviewed. Native qualification remains owed on the final integration head. |
| #1084 RR-106 | `3ba3dee92eeac29cbb5b7aa10733960e15d7fba0` | LibreOffice runner, native differences and font pack reviewed; destructive output cleanup fixed. Experimental status retained. |
| #1117 importer IDs | `6e6102af6e099e352d155166ffe57fd674b23fe5` | Global identifier allocation avoids cross-slide duplicates; retained LibreOffice fixture test accepted. |
| #1132 fontconfig | `21b747c2f2676ecb9c7f94a5e9d5e0d62c88b9a8` | Stacked on #1084. Alias XML escapes family names and does not recursively reinclude itself. |
| #1098 LH-179 | `b425ae984ccd96f76e99c563c737ba3ad91977e1` | Windows browser fixes reviewed. Assembly retains both editor-windows and LibreOffice nightly legs and their report dependencies. |
| #1136 audit | `5ba72b90d1fbf9919550e066da0ce6e474826539` | Accepted as historical audit at `a34478680`; not current qualification. Current status correction is recorded below. |
| #1134 COM evidence | `f00b59a90b42d54ec4e5116f89f09d2a831c2bee` | Accepted as historical evidence with its source and scope retained. Not evidence for this assembled head. |

## Reproduced defects and fixes

- `e091fa9bf`: DOT c0 and PlantUML g0 generated group names collided with authored node names; group identifiers now share the node namespace. Left-pointing state edges now reverse their ends. PlantUML Gantt with all weekdays closed or a huge duration hung; invalid dates and backwards spans also slipped through. Regression tests reproduce the old hang in a child process with a two-second deadline and assert precise refusal diagnostics after the fix.
- `a95142841`: an optional group containing an undeclared variable could disappear and falsely report complete resolution. Unknown names and invalid built-ins keep the group visible to the normal diagnostic walk.
- `292887840`: a huge hidden overlay moved a cover heading. Hidden shapes no longer contribute body bounds; visible-overlay behavior is retained.
- `131a67f0e`: the LibreOffice runner recursively deleted any supplied output directory, including earlier evidence. It now requires a new or empty real directory and preserves nonempty or symlink outputs. The regression test verifies that earlier files survive refusal.
- `00e6400d9`: LH-69 and LH-102 passed independently but failed together. The placed label counted as a step badge and its fixed size capped the smallest-growing-text score. A sibling list fell from 56 px in the plain control to 37 px with a tile. The sibling now grows to 56 px; the fixed tile label remains 49 px. Both existing LTR/RTL no-shrink assertions are unchanged, and a new assertion checks that the list can grow past its label. [Combined English/Arabic before and after](wave2-review/lh69-lh102-combined-review.png), [estimated-size before](wave2-review/lh69-lh102-before.json), [after](wave2-review/lh69-lh102-after.json). PNG SHA-256: `9495bb11695e645de5e59e159379f4413d84ff988cc4a8bff5ff51b6e0f17f24`.

## Vetoable decisions

1. Gantt tasks and offsets allow at most 36,600 days, with 366,000 calendar-day checks shared across a diagram. Excess reports `diagram-limit`; authored schedules are never silently clamped. Every-weekday-closed and invalid/reversed dates report syntax errors.
2. LH-30 preserves the source PR's policy: valid built-ins and color variables do not count as optional content. A parent containing only nested unfilled optional fields is omitted, including static content. Unknown names and malformed built-ins always keep their diagnostics visible.
3. A placed tile retains its own region and label size while sibling body text grows independently. A tile cannot cost the sibling list a size.
4. LH-80 may wrap names and the Square feet header onto two whole-word lines at the existing size only when no unwrapped track is available. Prefer an unwrapped track whenever one fits.
5. Qualification evidence is append-only by attempt: refuse a nonempty output, with no clobber option. LibreOffice stays experimental.
6. Historical native checks and audits retain their original source scope and do not count as a pass for this new integration.

## Slide review evidence

Read-only source sheets are at evidence commit `b560fa82011b149609587cf5cbab3eb14e338d08`, under `supervisor/`: `lh-46.png`, `lh-102-1.png`, `lh-102-2.png`, `LH-69.png`, `LH-80.png`, `LH-110.png`, `LH-61.png`, `LH-73-1.png`, `LH-73-2.png`. The review favors bodies filling available space, larger readable type, and whole-word wrapping. No reviewed change gains an approximately 70-character line or loses authored content. The combined regression sheet above is additional evidence generated on this derived branch, not a golden update.

## v0.33.0 native sheet review delegated by the parent

Reviewed the parent's `review-00.png` through `review-05.png` and full `chart-type-sampler-1.png` for source `2db20c01ef4d9b80db9797116dc83e41f65d1c68`. The parent's report has 25 decks / 270 slides, all opening without repair, no native shrink and successful round trips. This reviewer inspected images only and did not drive PowerPoint.

| Sheet | SHA-256 |
| --- | --- |
| review-00.png | `ac45794f6608613f04ae4195105613ca18063185cf73a03ede9ef368d1a79840` |
| review-01.png | `f09be88277bd67b891e195fdac5a5a0688c6e68cef4f668db02e5c96d7b96af7` |
| review-02.png | `a04bf7133ae16f2153ba071e7274e0814fd7e93bfab0e833b6a3d0e8a224ae62` |
| review-03.png | `165d2f0e9e460b00b9a6ffc2f116f0f5cb14c1aa8e8c4eacbcadcaea6ac69404` |
| review-04.png | `b870ea39823455af55ac09b5333a29cd9ff8c1b069f0a6c41d4752b10b151eef` |
| review-05.png | `717d40de5a3223cc0c47c43d430ebc370186a62d86d315ee34a6f756196936e6` |

These images are durable on the parent's evidence-only branch [codex/rr105-final-evidence](https://github.com/OpenPresentation/opf/tree/codex/rr105-final-evidence/docs/programs/release-readiness/rr-105-com/final-033-2026-11-07); never merge that evidence branch.

Findings sent to the parent: sampler slide 31 pyramid labels were black natively instead of preview white; chart-type sampler box/scatter axes used native auto ranges instead of the preview's fixed numeric ranges. The parent owns both supported-feature fixes and requalification. The academy small-run title baseline, opt-in native-body wrapping and native wrapped-title slack remain scoped to #1114/#1127 for 0.34. No other unexpected content loss was found in sheets 00-05. Shapes, diagrams, Mermaid native/picture cases and footers were visually consistent within those sheets.

## Verification and next step

Full seven-package build passed. The focused core batch has 86 passing tests, including DOT/PlantUML hostile-input controls and combined LTR/RTL growth. DOT, PlantUML, SmartArt and LibreOffice PPTX acceptance files pass; native-wrap acceptance passes for 202 native bodies with a one-percent margin and 21 documented tight-wrap measured fallbacks. The combined LibreOffice/workflow script batch has 33 passing tests. Final changed-branch checks and final integration native checks are recorded below as they complete.

Next: finish local checks, push this preparation branch, merge the final v0.33/main into the assembled branch with the parent, run the final integration review/golden workflow once, and gate the one integration PR. Do not push any folded source branch.

### Local check follow-up

The required `pnpm check:changed` run built all packages and passed typecheck. Its full core run passed 3,933 tests with one omitted-evidence file failure; after restoring only the two tracked script-corpus inputs, the width-estimate file passes all 35 cases. The compressed-evidence integrity check passes after restoring its one tracked gzip input. The Windows browser-safe helper test used a slash-only prefix removal; separator normalization preserves all six contract assertions and its complete check now passes. The RR-106 status token was corrected to `in-progress`; the report's remaining missing RR-105 row is expected until the v0.33 integration is merged, since that branch owns the row. The bundle report has zero catalog bytes in every entry; official `check-catalog-free.mjs --update` refreshed measured sizes and the existing three-percent headroom for reviewed parser/layout growth, and the complete catalog-free check passes. Tracker tests have 17 passes plus the expected stale snapshot failure under strict local policy; normal PR warning policy is separate. Full render/package checks are still running and final native and golden gates are still owed.
