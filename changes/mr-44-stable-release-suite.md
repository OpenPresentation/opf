---
type: fixed
packages: []
---
MR-44: a stable release passes the suite on its own release-prep commit. `check:prerelease` derives its cases from the tree's version (the next minor and prereleases above it) instead of preparing a fixed `0.26.0`, which the release commit's CHANGELOG already has, and `check:changes` accepts an empty `changes/` (which is what a release leaves behind) and keeps its coverage in fixtures.
