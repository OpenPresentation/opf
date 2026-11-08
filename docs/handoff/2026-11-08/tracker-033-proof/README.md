# Strict v0.33 automatic tracker proof

Evidence-only branch codex/rr-033-tracker-proof. Never merge this proof branch; coordinator must cherry-pick the exact bot refresh into the new033 reapplication after revert. No product source, generator, override, policy or test was edited.

Base7c0c3f13e9de77e038b6ec26183043eb7fe90822 reproduces17/18 passing controls, with only committed freshness failing; strict generator --check exits1. Exact automated commit90f645535c02d2aab2373503ca220faf2ad5f287 was cherry-picked as8ac0cc792. Afterward all18 controls pass and generator --check exits0. OPF_TRACKER_STALE was removed from the subprocess environment in every receipt: the default strict policy is exercised, not warning mode. Node24.20.0; no dependency install required.

Commands: node --test scripts/build-gallery-tracker.test.mjs scripts/tracker-staleness.test.mjs and node scripts/build-gallery-tracker.mjs --check. before-receipt18.json and after-receipt.json retain commands, exit codes and environment; stdout/stderr are lossless. bot-generated.patch is the entire two-line generated change (103 to105 burndown items in JSON/Markdown), matching the reviewed GitHub commit.

The sparse checkout initially omitted required evidence. restored-inputs.json records1807 exact committed inputs selected by the generator's existing native-evidence traversal plus explicit required files (44,609,662bytes), each verified byte-for-byte against7c0. Git cherry-pick reapplied sparse exclusions: the first after attempt therefore failed with missing rr-20 limitations.json (9/18 controls passed). Those literal sparse-reapplied-* receipts are retained. Restoring the same1807 files and verifying their recorded hashes produced the final18-pass result. The generator/test behavior and thresholds were unchanged.

The initial before-tests-only receipts show14/15 package tests plus the same stale failure; the combined receipt is the complete18-test contract. Both are kept. The two generator outputs are changed solely by the original bot commit, not regenerated or hand-edited in this proof. No further GitHub API reads or workflow mutations were used.
