---
type: changed
packages: []
---
MR-34: the cross-repository machinery is retired. Deleted: the ecosystem lock roller and guard, `Depends-On` handling in `pr-gate.mjs`, the candidate-gallery lanes and the published-control workflow, `release-plan.json` and its CLI-peer bridge, the RR-55 unreleased-core gates, `release-train.mjs` and its workflow, CI evidence, `publish-source`, the release-prep merge-queue fast path, the old per-repository CI workflows and the sibling-checkout scripts. `scripts/registry-plan.mjs` replaces the release plan: the registry consumers test the `latest` dist-tag of each package with the harness files of the commit it was built from. `pr-gate.mjs` is the no-merge-queue gate (one required check, `verify`, GitHub auto-merge).
