# Verified font preparation — 10 September 2026

This source milestone verifies the existing open font files and shares their inputs across layout, SVG, editor, Node raster and PPTX export. It is unpublished. It does not establish native Office fidelity, substitute-font equivalence, multilingual correctness or general slide quality.

## Findings and bounded acceptance

The previous default raster list had six files, while the base measurement registry had nine. The [before probe](before/report.json) reproduces three mismatches: Roboto SemiBold 600, regular italic and bold italic. The [after probe](after/report.json) matches the full nine-file registry for every case. The adjacent PNGs preserve the original failures and corrected output. `scripts/probe-base-fonts.mjs <renderer-checkout> <output-directory>` reproduces this comparison independently of the corpus.

The manifest pins 33 faces from eight existing OFL-1.1 font packages, retaining the original license notices and SHA-256 hashes. Integrity controls alter only temporary copies, verifying font bytes, notices, versions and missing-resource failures. The default raster path now reports a missing resource and recovers after a repaired installation. Shared preparation disables system fonts and runtime font downloads.

The original renderer checkpoint is `23432d0bc21c16d4bdc8bad33a1d9c5e7a8e2ccd`; core source is `e882f357cd7860b3e0905fdf0b2fb3ff8c2464d8`. Both Node 20.20.2 and 24.21.0 pass the complete renderer suite and all 805 slides using the separate `test/golden/opf-examples-png.base-fonts.sha256.json` checkpoint. The old shared-text checkpoint remains unchanged. The [corpus report](corpus-review/report.json) verifies 1,610 before/after PNG hashes against an identical 126-deck source digest: 143 changed and 662 unchanged. All 18 paired sheets were visually inspected. Six changed slides were also inspected at full size; their original SVG and paired PNGs are in [corpus-detail](corpus-detail).

The accepted change is completion of the raster font list. Existing large rich-run gaps, sparse cards, missing assets and unresolved chart data remain visible. Those observations remain open layout/content concerns. Corpus hash equality is regression evidence, not visual-quality certification.

[Node 24 browser observations](font-browser-node24.json) and [Node 20 browser observations](font-browser-node20.json) load all nine exact base faces offline into Chromium. Every sample preserves its text and agrees with the measured advance within 0.1 pixels, with no page errors or remote requests. This small Latin sample does not certify other scripts, native shaping or font embedding.

## Reproduction

Use Node 20 or 24, install locked dependencies, build core and link the coordinated repositories with core's `scripts/link-ecosystem.mjs --packages-only`. Build the renderer before running:

```sh
npm run test:font-preparation
npm run test:font-preparation-browser
OPF_GOLDEN_BASELINE=test/golden/opf-examples-png.base-fonts.sha256.json npm test
node scripts/probe-base-fonts.mjs . artifacts/font-probe
```

To repeat the visual review, independently render both checkpoints with `OPF_GOLDEN_ARTIFACTS=1`, retaining their `candidate.json` and all PNGs. Core's `scripts/review-font-corpus.mjs <before> <after> <output>` validates both sets and builds the paired sheets. Run the prior renderer against the unchanged shared-text baseline. Never overwrite a historical failure or baseline to obtain a passing result.

Font weight-family naming, text features, rich spacing, multilingual shaping, Akasia/Aptos comparison, native embedding, actual PowerPoint behavior and clean-machine installation remain separate gates in the core font roadmap. No new font compatibility profile, package version or PDF capability is introduced here.
