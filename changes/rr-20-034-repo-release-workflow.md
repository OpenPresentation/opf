---
type: changed
packages: []
---
Repository only: the release workflow builds and checks the Claude Desktop bundle in its own job and attaches it to the GitHub release after publication (a missing asset is reported separately and does not stop the site bumps), skips the report-only LibreOffice leg in its gate, and keeps site-bump history (a rerun that conflicts goes to a fresh `bot/opf-vX.Y.Z-N` branch). The release instructions, the CI/CD contract for the three sites and the generated trackers are current.
