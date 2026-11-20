# RR-105 font-slot continuation — November 10, 2026

Successor branch: `codex/rr-105-font-slots-takeover`, based on fresh main followed by the existing font-slot lane `a72850e125493da4d88b3e93ef236665d58bc0b4`. The earlier stopped handoff and its 14/15 failure remain in [native-latin-slots](native-latin-slots/README.md). No runtime, font, native geometry, golden baseline or tolerance changes are made by this continuation.

## Every recorded CI failure is accounted for

The seven once-fetched execution logs from run `42864408344` remain in the `final-handoff-receipts.json.gz` packet on evidence-only branch `codex/handoff-recovery-20261110` (`d15846a04c1757a091c6ceb772f8162aedcb91c4`); never merge that recovery branch.

| Failure | Cause and disposition |
| --- | --- |
| Core `source-docs-currency.test.mjs:14` | Genuine stale source inventory. There are 149 JSON decks: 101 gallery and 48 technical. Corrected both current compatibility-matrix counts and the llms guide; unchanged test passes 2/2. |
| PPTX `native-latin-slots.mjs` | Its authored-document expectation contradicted the existing native-body reader contract. `body-text-import.js` reads current explicit native formatting and paragraph boundaries; `native-body-inherited-style.mjs` requires explicit false overrides. The archived 863/66d comparison independently yields exactly the same four-run canonical document. Retained exact deep equality with that independently specified document and added exact whole-document native text/bold edit controls. No runtime normalization or source-text restoration. |
| PPTX `rtl-layout.mjs:117` | The original source itemizer assigns the whitespace after `v2.0` to the Latin span. CS selection therefore creates one extra whitespace boundary inside the existing Arabic-proofing chunk. The test now checks the exact five runs and verifies Latin CS on that whitespace while the adjacent Arabic word retains theme CS. Text, proofing and geometry are unchanged. |
| PPTX `script-fonts.mjs:108` | Its blanket no-CS assertion contradicted the new Arabic-proofing ASCII exception. The replacement requires exactly the selected heading/body families, ASCII-only exception runs and exact final Latin/CS equality; all other scripts, EA slots and notes retain the original absence assertions. |
| Renderer `golden.mjs`, `golden-gate.mjs` and dedicated goldens | All three report the same seven changed localized-chart-reference slides. The downloaded existing artifact below identifies every key. These belong to the explicit chart-reference source changes and require the coordinator's final coherent pinned golden run and image review. No baseline was edited here and these failures remain OPEN. |

One bounded artifact download: [artifact 13786262643](https://github.com/OpenPresentation/opf/actions/runs/42864408344/artifacts/13786262643), ZIP SHA-256 `1b6e145b171b31b0aa9d102f66fa98cb3903004092b21c0dcd90d5818789eb8e`, 192,894 bytes. Its `diff.json` lists `technical/localized-chart-references.opf.json#0` through `#6`, and two new decks (`explicit-chart-reference-lines.opf.json` and `singleton-combo-reference-lines.opf.json`). Its `sourceMatches` is false. This identifies the affected scope; it is not a new visual acceptance claim.

## Contract decisions and actual checks

Vetoable decision, approved for implementation by the coordinator: preserve the ordinary native-body import's current formatting/paragraph contract. Do not extend source-boundary recovery into canonical native paragraphs merely to satisfy an incorrect authored-form test. Exact current-native text and formatting edits must win over stored source.

Node 24.21.0 and pnpm 10.33.2 were used in an isolated Mac worktree. The normal workspace build passed. Focused native-slot checks pass 15/15, the full RTL layout script passes, the script-font suite passes all 13 language cases and its remaining controls, and strict core typecheck passes. The source-doc check genuinely reproduced 1 PASS / 1 RED before correction and passes 2/2 after correction.

The required repair-delta mapper (`--base a72850e125493da4d88b3e93ef236665d58bc0b4`) ended with **8 PASS / 2 RED / 1 type SKIP in 80.8 seconds**. The mapped PPTX suite and browser check pass; both failures were absent sparse historical tracker/text prerequisites. The initial sandbox slot-lock refusal is also retained. Materializing exactly 1,844 existing HEAD blobs (47,022,080-byte Git tar, without editing the index or source) restored the complete native JSON/Markdown scanner inputs plus declared tracker/proof/text prerequisites. Failed-only replay passes: gallery tracker 18/18 and unchanged 863-record freshness; text checks 7/7 and 11,383-file validity. This is composited local evidence, not a claim that the original mapper exited green or the complete integration is accepted.

Raw results retain build, type, focused and mapper logs, the original added-control setup failure, failed-only replays, exact hydration source/blob identities and the downloaded original golden evidence ZIP. JSON members store their original bytes as base64 with SHA-256; no original failure is replaced.

The first added bold-edit control refused to mutate because the false value came from inherited defaults, not a local run attribute. That setup failure is retained in the raw results. The corrected control adds a real local `b="1"`, requires changed XML and checks the exact imported document. No assertion was removed to obtain a pass.

The native body still explicitly supplies one verified Intos 400 caller face; W04 owns automatic preparation and will remove that supplementation after its reviewed dependency channel is integrated. Actual PowerPoint Save/reopen, visible B07 glyph/order cases 05/06/09/10, final current-source tests and pinned golden review remain owed. No Office was run and no native fidelity or release acceptance is claimed.
