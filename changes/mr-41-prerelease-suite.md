---
type: fixed
packages: []
---
MR-41: a release candidate (`X.Y.Z-rc.N`) passes the whole suite like a stable version. The lazy font gate admits a prerelease on a reviewed font set and count, the CLI and integration tests read the workspace's peer ranges through shared version shapes (`scripts/version-shapes.mjs`), and `check:prerelease` prepares stable and prerelease trees and runs the version checks against them.
