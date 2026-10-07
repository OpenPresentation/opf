---
type: changed
packages: []
---
RR-20 (release tooling only, no package change): `scripts/release-train.mjs tag --execute --checks-wait-minutes N` waits up to N minutes for checks on the release commit that are still running, or not reported yet right after the merge, instead of stopping with "tag once they are green"; a red check still stops it at once and nothing is tagged. The default (0) keeps the old behaviour.
