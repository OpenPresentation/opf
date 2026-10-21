---
type: changed
packages: []
---
RR-101: the published runtime control accepts newer patch releases. `release-plan.json` is a floor: a package whose registry `latest` has the plan's major.minor and a patch at or above the plan's (the gallery: its major with a minor or patch at or above the plan's) is resolved with its own registry `gitHead`, with a `plan is behind registry` notice, and the published checkout is staged and verified with the resolved plan. A new minor or major, a lower version, or a missing or invalid `gitHead` still fails, so only those need a plan refresh.
