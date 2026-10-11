# RR-20: CLI packed-peer script font selection

The CLI 0.18.1 dry preparation on core main `f312773565c1663ee13a38442966b80a178bb2ce` failed its peer packed gate because the test installed Noto Sans JP 0.4.3 while the selected registry renderer 0.18.1 declares 0.4.4. The 77 drawing checks passed before the exact-version assertion failed. The original failed preparation and log were preserved; release metadata was not changed by this repair.

The test now derives Japanese and Chinese pins from the selected installed renderer manifest after existing explicit skip gates. It checks renderer identity/version and exact font pins. The installed regression retains its exact-match assertion. This is test tooling only: no runtime behavior, release version, public status, tolerance or golden change.

The selector also supports an explicit validated staged renderer manifest/version. The repair is refreshed onto merged PR604 at `080da598013328857f6c9478eabe84b5977c140d`, preserving its source/tar/runtime and installed byte/resolver guards. Candidate selection uses its staged artifact rather than registry development pins. Packed peers now reuse the tested `preparePackedSmokeCli` contract: validate staged bytes before refusing a candidate rebuild; ordinary registry tests still build.

Validation before that integration:

- Focused three cases pass: renderer 0.18.0 selects font 0.4.3, renderer 0.18.1 selects 0.4.4, malformed/missing/stale manifests reject, and an explicit staged renderer selects its own version/pins independently of registry development pins.
- Mapped and full source checks passed, including 35 root checks. The full run covered the original two fixture cases; the subsequently added staged case passed independently and will be covered by the required full rerun after integration.
- A disposable copy of the actual CLI 0.18.1 dry metadata with three explicit test overlays passed frozen installation and packed peers with registry renderer/PPTX 0.18.1: 77 drawing checks, 16 installed font/image/no-fetch checks and global/npm-exec paths. Manifest/changelog/lock bytes matched the untouched original dry preparation.

Working evidence retained on the review host:

- Original failure: `/private/tmp/rr20-cli-0181-packed-peers.log`.
- Focused/mapped/full: `/private/tmp/rr20-cli-font-pins-mapped.log`, `/private/tmp/rr20-cli-font-pins-full.log`.
- Actual prepared replay: `/private/tmp/rr20-cli-font-pins-prepared-packed-peers.log`, overlay SHA256 identities `/private/tmp/rr20-cli-prepared-font-overlay.json`.
- Original dry tree: `/var/folders/zj/5tv5dvds3793_qhx2jyxs0000000gn/T/release-train-cli-eys3k1`; replay `/private/tmp/rr20-cli-prepared-font-replay`.

The peer test reports the existing renderer 0.14/core 0.14 historical SVG digest skip explicitly; this is not new golden evidence. No Windows/Linux/native acceptance or publication is claimed. Final mapped checks passed in 119.3 seconds after the merged-main refresh; the complete source suite passed all 36 root checks, core tests and CLI command/file contracts; registry 0.18.1 and real validated six-artifact candidate paths were exercised in disposable copies. Frozen original graphs remain unchanged.

## Fresh candidate replay

A disposable source overlay `0151c87372ea2a5db56e4fc663f3cd8788caf6ac` over frozen d208 retained all six source versions and runtime bytes. The fresh six archives had identical entry sets and non-manifest bytes; five package manifests changed only relocated absolute staged dependency paths, while gallery was archive-identical. Honest fresh manifest identities were retained, not substituted into old expectations. Source-only negative-test dependency aliases were separate from installed global/npm-exec packages.

The serial replay passed 77 drawing checks, 16 installed offline regressions and exact global/npm-exec byte/resolver checks. Existing helper regression passed three cases including candidate runtime tamper refusal before build, candidate dist preservation and ordinary build. Logs: `/private/tmp/rr20-cli-font-candidate-packed-peers-ready.log`, `/private/tmp/rr20-cli-font-buildguard-contract-tests.log`; actual tar/source comparison and result: `/private/tmp/rr20-cli-font-candidate-buildguard-comparison.json`, `/private/tmp/rr20-cli-font-candidate-replay-result.json`. Earlier failed attempts (unconditional candidate rebuild; missing scratch source dependency aliases) remain preserved. No frozen original graph was modified.

Final refreshed validation logs: `/private/tmp/rr20-cli-font-pins-post604-mapped.log`, `/private/tmp/rr20-cli-font-pins-post604-full.log`. The candidate replay uses the same final packed-files body; its source overlay records the frozen source graph rather than claiming this main-based harness branch is the v2 runtime.
