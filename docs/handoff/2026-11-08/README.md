# Release continuation: 2026-11-08

This is the current handoff for the two-release goal: v0.33.0, then v0.34.0. [Unified checklist and team](https://github.com/OpenPresentation/opf/issues/1139). The [2026-11-07 working rules](../2026-11-07/working-rules.md) remain binding; this file supersedes their historical status snapshots, not their safety rules.

## v0.33 reapplication

PR #1133 passed exact-head normal/full CI and final Windows PowerPoint qualification, then squash-merged as `7c0c3f13e9de77e038b6ec26183043eb7fe90822`. Main failed strict gallery-tracker freshness: generated metadata counted 103 RR items instead of 105. The automatic Tracker refresh succeeded but could not open its PR. The queued release dry run was cancelled; no tag, npm publication or site deployment happened.

Per the red-main rule, #1161 restored the exact previous-main tree. Its actual squash commit is `502eb42d730edec4cc926c84d7bbaccaaba48a4c`. This new branch starts from that fresh main, reverses that exact revert, and carries the original generated refresh `90f645535c02d2aab2373503ca220faf2ad5f287`. The refresh changes only the JSON item count and Markdown link count. All original feature/source branches are permanently folded and must never be pushed again.

Vetoable implementation decisions:

- Restore the already-reviewed v0.33 product source without adding v0.34 work. Fix the generated metadata by folding the exact bot output; keep strict freshness and every assertion unchanged.
- Reuse accepted source/native evidence only where canonical product/schema/font/golden trees and exact input hashes match. A real output change requires targeted requalification; documentation or tracker-only changes do not justify repeating an unchanged corpus.
- Keep the current qualification host profile unchanged until v0.33 is published. The sealed seven-face Roboto setup for v0.34 is deferred and must use the maintained owned setup/check/cleanup helper.

[Strict tracker proof and release checklist](https://github.com/OpenPresentation/opf/tree/codex/rr-033-tracker-proof/docs/handoff/2026-11-08/tracker-033-proof): gallery 17/18 before, 18/18 after the exact refresh; font freshness passes, warning override unset. Release-prepare dry preflight passes 0.33.0 from 0.32.1, minimum minor, latest, with normal stability enabled and zero undeclared gallery changes. The top-level Release workflow dry run and slow gate are still mandatory.

[Accepted native evidence](https://github.com/OpenPresentation/opf/tree/codex/rr105-final-evidence/docs/programs/release-readiness/rr-105-com/final-033-2026-11-07): 25 files / 270 slides, 25 PowerPoint-saved imports, no shrink autofit. Explicit stacked-shape aggregate-bound false positives, opt-in v0.34 body/title findings, ChartEx automatic-margin limits and UI-only checks not run remain visible. No exact font-parity claim is added.

Next: independent reapplication review; one push and normal/full CI batch; maintained `pr-gate.mjs --expect-head <full sha> --required all`; squash merge; main's own verify/audit on its actual SHA; top-level Release workflow dry-run with skip-gate=false, then the real Release. Verify all seven registry/provenance/changelog receipts and GitHub release before genuine site bumps. The site step is advisory in the release workflow, so inspect all three outcomes explicitly.

## v0.34 and parallel work

Preparation is pushed on `codex/integration-034` at `64725585d39fd5371afef05982959f5e340fa02f`; it will merge the actual v0.33 release/main again before final integration. It contains the reviewed 17-PR wave-2 assembly plus language, localized status, font emphasis, native titles, added SmartArt nodes, inverted pyramids, optioned doughnut holes, MCP release bundle, pinned template-golden workflow, read-only native worker and ZIP evidence checker. Their folded source branches remain frozen. No v0.34 integration PR or golden batch is open yet.

The owner spot check at 07:18 UTC found 16 reviewed integration items over the preceding four hours (5 capabilities, 6 user-facing fixes, 5 delivery/test improvements), with zero published releases. The coordinator acknowledged the strict-tracker preflight miss and prioritized v0.33 recovery/publication. Agents continue bounded LH73/LH75/LH110 fixes, the concrete LH34 native saved-import correction and site security/readiness. SH20/21 and SH25/RTL exploratory native runs are paused; sealed packets and all failing evidence remain pushed, and no new live SmartArt domain is enabled.

Every new feature still needs its final source/sheet/native acceptance, assembled strict checks and pinned golden review. Corrected CLI qualification preserves the earlier incorrectly measured API input batches as failures. LH16 native text editing retains its duration; LH34 actual saved editing exposed a blank panel-paragraph guard defect with a narrow isolated correction in progress. These are not silently counted as released.

## Owner-only

D2; LibreOffice promotion; adding the hosted connector in Claude; uninstalling the local .mcpb; any deploy, DNS change or login. Prepare concrete verified PRs before requesting these actions, and continue independent authorized work. Site main merges can deploy and remain reserved for the owner step.

Never force-push, push folded source branches, merge evidence-only branches, rewrite raster goldens locally, terminate Office, attach to the owner's Office instance, or introduce a new CI polling loop.

## Core 0.33 documentation and artifact preflight

[Core currency handoff](core-033-currency.md) records the narrow current-doc corrections, exact 137-JSON/2-Markdown/36-layout source counts, required post-registry quickstart checks and every E1/E2/E3 comparison/planning artifact obligation. All seven 0.33.0 packages are now genuinely verified at 26fd4de9; the once-only registry plan and maintained quickstart pass, and the retained six-package consumer binds exact counts/content/lock integrity. [Post-publication receipt](core-033-currency/post-publication/receipt.json). E1/E2/E3 comparison/planning artifact refresh and sites remain separately owed. The cited old corpus generator is missing and is not replaced with guessed output.

- [Current033skill-reference correction](033-skill-reference.md): published-schema-backed regions/direction/size guidance plus current YAML convert verb; all six skill entrypoints/eight references audited within format/export-availability scope, historical guidance retained, public sites await gated main SHA.
