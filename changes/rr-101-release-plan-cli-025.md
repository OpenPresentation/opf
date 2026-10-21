---
type: changed
packages: []
---
Roll `release-plan.json` and the install docs (README, quickstart, CLI guide, compatibility matrix) to CLI 0.25.0, now on npm, with its registry `gitHead` as `verificationRefs.cli`. The plan's CLI peer ranges match the plan's libraries again, so the registry install, quickstart and packed-ecosystem lanes install and run the CLI instead of skipping it.
