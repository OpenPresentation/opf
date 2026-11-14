---
type: fixed
packages: []
---

The renderer's `test/shared-metric.mjs` runs on every pull request again and is correct for 0.34 (logical `contentAlignment`, and the stated anchor of a measured tracked line). It had been left out of the package's test run while only the registry tier ran it, so the nightly check of the published 0.34.0 packages failed on a stale test. A root check now requires every test of the registry tier to run in pull-request CI.
