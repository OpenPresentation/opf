# Shipping checkpoint, 2026-11-08

Evidence-only branch; never merge it. Unified checklist: https://github.com/OpenPresentation/opf/issues/1139 . Persistent two-release goal remains active.

## v0.33 recovery is the critical path

PR1133 squash-merged at7c0c3f13e9de77e038b6ec26183043eb7fe90822 after exact-head normal/full CI and final native acceptance. Merged-main lint failed because the generated gallery tracker still counted103 release-readiness items instead of105. The automatic Tracker refresh run42456443752 generated exact commit90f645535c02d2aab2373503ca220faf2ad5f287, but repository Actions could not open its PR. No source assertion failed beyond tracker freshness. The Release dry run42456530874 was cancelled while queued; nothing was tagged, published or deployed.

Binding red-main rule: exact-tree revert PR1161 at2f2a2bd4d0f9a20823bf8dc6c9981c9b0999ac4a restores prior main d19c4bb6172b703d132ebba3fd006e4ec5cdf845. One maintained required-all pr-gate with merge enabled watches it (session1032). No other CI watcher is active. Do not push1133 or its folded source branches.

After the actual revert squash lands, create a NEW branch from fresh main, reverse that actual revert commit, cherry-pick exact bot90f6455, update the current handoff and obtain independent review before one push. Strict gallery tracker17/18→18/18 and strict font freshness are already proved at evidence-only codex/rr-033-tracker-proof00690ada0; never merge that proof branch. Keep the RR table at105 rows for this exact bot refresh. Verify product/golden/font/input identity against accepted7c0/5b320; reuse unchanged native evidence. Strict trackers, stability/version preflight, exact-head normal/full CI, main's own verify/audit and top-level Release dry run with skip-gate=false precede real publication. Direct npm-publish rehearsal is insufficient because it omits Release prepare stability.

## v0.34 preparation and owner spot check

Current preparation is pushed at64725585d39fd5371afef05982959f5e340fa02f on codex/integration-034. It normally includes current main7c0 ancestry, frozen wave2 source, accepted language/font/status/title/pyramid/doughnut work, pinned template workflow RR108, read-only native worker RR109 and ZIP evidence integrity RR110. Every source branch folded there is frozen. Final v0.34 integration CI/goldens/native release acceptance remain owed; no integration PR/golden batch yet.

The owner spot check at07:18UTC covered the prior four hours:16 implemented/reviewed integration items (5capabilities,6user-facing fixes,5delivery/test improvements),0published releases. These are preparation counts, not completion of final integration/release acceptance. The coordinator acknowledged the avoidable strict-tracker preflight miss and narrowed its own work to033 recovery/publication. SH20/21 and SH25/RTL exploratory native runs are paused; accepted evidence and sealed diagnostics are preserved. Core agent continues bounded LH73/LH75/LH110 work; site agent handles the concrete LH34 saved-import defect and033 site readiness/security.

Actual read-only native edits/save/reopen succeeded for LH16 and LH34. LH16 reimport retains edited Build text and duration4. LH34 exposed a real empty-panel-paragraph import guard defect; fix is isolated and not accepted yet. Initial API qualification batches omitted measured fonts and are retained as failed evidence; corrected CLI batch13files/19slides opens. RTL ranges remain wrong and Roboto is absent from the host, so those034 cases remain held. A sealed seven-face font packet is ready; registration is deferred until033 publication to preserve the active qualification host profile. No new live SmartArt domain is enabled.

Owner-only D2, LibreOffice promotion, Claude connector, extension uninstall, deploy/DNS/login stay reserved. No force push, folded-source push, evidence-branch merge, Office termination, local raster-golden rewrite or new CI polling loop.
