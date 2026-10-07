---
type: added
packages: []
---
RR-57: `scripts/pr-gate.mjs`, the one shared PR/CI gate for agents. It watches pull requests (or a release commit with
`--commit`) through one batched GraphQL query per interval, judges only the base branch's required checks (rulesets,
read once per repository; every check except neutral bots without one), never reports green with zero or unregistered
checks, an older head's checks or uncomputed mergeability, stops at once on red, and with `--merge` enqueues into the merge
queue (re-enqueueing once after an ejection) or squash-merges. It backs off on the GraphQL rate limit and stops before
the 2-hour background-task cap with exit 75 and a resume line. AGENTS.md now says to use it instead of ad-hoc watchers.
