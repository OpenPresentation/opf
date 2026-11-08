# v0.33 recovery: strict pre-merge/main/release checklist

Read-only audit of exact merged033 source7c0c3f13e9de77e038b6ec26183043eb7fe90822 plus original automatic tracker refresh90f645535c02d2aab2373503ca220faf2ad5f287. No workflow, policy, tests, dependencies or public defaults are changed by this note. Coordinator owns one maintained gate; this agent made no additional status/API queries after the explicit three-read tracker investigation. SH20/21 exploratory experiments are paused until033 is published; all sealed packets remain durable and new production live domains stay off.

## Before the single reapplication push

- [ ] Observe actual revert squash merge through the coordinator's existing required-all gate. Do not reuse the revert PR head as the new main SHA. Confirm the revert main tree matches d19c4bb6172b703d132ebba3fd006e4ec5cdf845, then derive a new isolated branch from fresh origin/main. Never push folded1133/source branches.
- [ ] Reverse the actual revert commit on the new branch; cherry-pick original bot90f645535c02d2aab2373503ca220faf2ad5f287. Against old merged7c0, the product/schema/example/golden/qualification bytes should be unchanged; allow only the exact two generated tracker changes plus the new current handoff. Reuse native evidence only with that byte-identity proof.
- [ ] Do not add a new release-readiness burndown table row for this recovery: the exact bot output counts105items. Append the existing item's progress log/handoff instead. If authored tracker inputs change, strict regeneration must be supplied through its maintained owner workflow, not a hand edit.
- [ ] In the final assembled checkout, remove any OPF_TRACKER_STALE=warn inherited environment override. Run both pnpm check:font-tracker and pnpm check:gallery-tracker under strict default/fail mode. Sparse checkouts must restore exact committed required inputs; a missing file is an environment failure, never a pass. Isolated gallery proof here is17/18 stale before and18/18 after, with standalone --check exit0.
- [ ] Preserve final pnpm check:changed receipt and selected package checks; retain literal environment failures. This two-line tracker correction requires no new PowerPoint edits/renders when product-input bytes are verified identical to accepted033. No golden regeneration or tolerance change.
- [ ] Review the final diff and exact full40-character candidate head; update the current handoff, mark the failed/cancelled release attempt as unpublished, and ensure changelog fragments/declarations are intact. No post-push edits without restarting the expected-head gate.

## One green PR batch, then strict main

- [ ] Coordinator alone dispatches the selected CI/FullCI batch and runs node scripts/pr-gate.mjs OpenPresentation/opf#NEW --expect-head FULL40 --required all --merge. Do not create per-run polling loops or a second watcher. Confirm exact-head checks include every dispatched suite, not only statusCheckRollup.
- [ ] After squash merge, obtain actual main commit and use the same maintained tool in commit mode: node scripts/pr-gate.mjs --commit OpenPresentation/opf@MAIN40 --required all. Main always runs all package/root tiers and pnpm audit; PR green is insufficient. Wait for main's own verify=success before dispatching release.
- [ ] If main is red, retain logs and follow revert-first. Do not publish or make a second speculative source change while main is red.

## Release through the maintained workflow

- [ ] Dispatch top-level Release on main with version0.33.0, dry-run=true, skip-gate=false. Direct npm-publish dry-run is not the full rehearsal: its scratch prepare intentionally uses --no-stability, while top-level Release prepare enforces the real gallery stability verdict.
- [ ] Review prepare's previous/minimum-bump/version/declarations, unchanged build tree, version/peer/changelog/lockfile/breaking checks, generated release patch, all slow gate legs, and the tarball smoke/dry-publish result. No bypass flag, alternate tag, tag reuse or laptop publish. A minor release is required for the approved breaking/drawing changes.
- [ ] Keep main fixed at the rehearsed commit, then dispatch Release on main version0.33.0, dry-run=false, skip-gate=false. The real workflow itself rechecks main verify, runs the slow gate, and refuses a moved main before committing/tagging.
- [ ] Success means all seven dependency-order uploads, registry availability, exact version/dist-tag/gitHead/provenance/signatures/lockstep ranges/changelog verification, published-set smoke and GitHub release. Dry run cannot certify real registry/provenance completion. Preserve all receipts and final tag/commit in handoff.
- [ ] Inspect all three site bump outcomes separately and fold prepared draft site work into bump PRs. Site bump failures deliberately do not fail Release. Every site still needs local build, PR-preview review and updated docs/examples/gallery. Keep deploy, DNS, login and other explicitly owner-only operations for the owner; openpresentation.org main merges deploy automatically.

## Warning versus strict behavior found by the audit

| Policy | PR/main behavior | Release behavior and consequence |
| --- | --- | --- |
| Generated font and gallery freshness | ci.yml117 sets warn only for PR lint; main sets fail | Both strict by default. Confirmed033 blocker; bot refresh is independently proven here. |
| Gallery pixel stability | ci.yml390-393 is continue-on-error on PR and main | release.mjs206 rejects verdictOk=false, and normal prepare calls runStability. This is the other actual warning-to-strict boundary; top-level dry run must pass it. |
| Dependency audit/scope | PR selects audit only for lockfile/workspace/manifest input; main always audits and runs full tiers | Nightly called by Release has a strict audit plus Windows/macOS/Node22/26/installed/packed/registry/npm12 legs. A PR's omitted job is no proof. |
| Missing changelog fragment reminder | warn-missing is advisory; no-code maintenance can legitimately have none | Fragment syntax/assembly, declared breaking changes, version/bump and gallery drawing declarations are strict separately. This is not a hidden missing-fragment failure switch. |
| Quarantined tests | Deferred tests continue on error in CI and nightly | Remain advisory; valid quarantine controls stay strict. Preserve unresolved findings rather than claim native/feature acceptance from green CI. |
| Platform residual and flake measurement | Separate diagnostic jobs, continue-on-error | Remain advisory in nightly/release; no changed threshold or new hard gate is inferred. |
| Tracker automation and site bumps | Bot may push successfully without opening a PR; site workflow steps report failures without failing release | Independently inspect concrete PR/branch/site results. Successful automation or release is not their merge/deploy evidence. |
| Main-red issue reporter/artifact warnings | Reporting-only continue-on-error or if-no-files-found:warn | Does not change actual verify/gate verdict; retained diagnostics still need review. |

Audit limits: source/workflow inspection only beyond the independently executed tracker proof. No registry/network audit, stability rendering, new full suite or native run was started by this audit. Final candidate checks and workflow outcomes remain the coordinator's required steps.
