---
type: changed
packages: [opf, cli, render, pptx, editor, gallery]
---
MR-23: the six packages are one pnpm workspace at one shared version, 0.26.0 (the gallery goes backwards from 5.0.0; `latest` moves with an explicit `--tag latest`). Packages depend on each other through `workspace:^`, which `pnpm pack` publishes as `^0.26.0`, so a consumer never mixes minors. Core's install hints and `PEER_RANGES` name `^0.26.0`. The gallery package no longer has a sync from pptx.gallery or a bootstrap for unreleased engines; records are written in `packages/gallery`. No behavior change otherwise.
