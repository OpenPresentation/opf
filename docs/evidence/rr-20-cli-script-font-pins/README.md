# RR-20: CLI packed-peer script font selection

The CLI 0.18.1 dry preparation on core main `f312773565c1663ee13a38442966b80a178bb2ce` failed its peer packed gate because the test installed Noto Sans JP 0.4.3 while the selected registry renderer 0.18.1 declares 0.4.4. The 77 drawing checks passed before the exact-version assertion failed. The original failed preparation and log were preserved; release metadata was not changed by this repair.

The test now derives Japanese and Chinese pins from the selected installed renderer manifest after existing explicit skip gates. It checks renderer identity/version and exact font pins. The installed regression retains its exact-match assertion. This is test tooling only: no runtime behavior, release version, public status, tolerance or golden change.

The selector also supports an explicit validated staged renderer manifest/version. This preserves the pending candidate-gallery CI path when it is integrated after PR604 merges; that path must select the staged artifact rather than compare it to registry development pins. The reviewed integration hunk is prepared against `63244a4228ee718343ab9cd659b4a263a4a51e96`. It has not been applied to PR604 or the frozen qualification graph.

Validation before that integration:

- Focused three cases pass: renderer 0.18.0 selects font 0.4.3, renderer 0.18.1 selects 0.4.4, malformed/missing/stale manifests reject, and an explicit staged renderer selects its own version/pins independently of registry development pins.
- Mapped and full source checks passed, including 35 root checks. The full run covered the original two fixture cases; the subsequently added staged case passed independently and will be covered by the required full rerun after integration.
- A disposable copy of the actual CLI 0.18.1 dry metadata with three explicit test overlays passed frozen installation and packed peers with registry renderer/PPTX 0.18.1: 77 drawing checks, 16 installed font/image/no-fetch checks and global/npm-exec paths. Manifest/changelog/lock bytes matched the untouched original dry preparation.

Working evidence retained on the review host:

- Original failure: `/private/tmp/rr20-cli-0181-packed-peers.log`.
- Focused/mapped/full: `/private/tmp/rr20-cli-font-pins-mapped.log`, `/private/tmp/rr20-cli-font-pins-full.log`.
- Actual prepared replay: `/private/tmp/rr20-cli-font-pins-prepared-packed-peers.log`, overlay SHA256 identities `/private/tmp/rr20-cli-prepared-font-overlay.json`.
- Original dry tree: `/var/folders/zj/5tv5dvds3793_qhx2jyxs0000000gn/T/release-train-cli-eys3k1`; replay `/private/tmp/rr20-cli-prepared-font-replay`.

The peer test reports the existing renderer 0.14/core 0.14 historical SVG digest skip explicitly; this is not new golden evidence. No Windows/Linux/native acceptance or publication is claimed. Before a PR, refresh onto merged PR604 and run mapped/full source checks plus both the registry 0.18.1 and real validated six-artifact candidate paths using disposable copies; frozen original graphs remain unchanged.
