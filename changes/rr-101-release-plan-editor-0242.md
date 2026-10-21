---
type: changed
packages: []
---
Roll `release-plan.json`, the published consumer lock, the quickstart, CLI guide, compatibility matrix and live-editor install command to the registry's current set: editor 0.24.2 (was 0.24.0) beside core 0.24.2, renderer 0.24.3, PPTX 0.24.1, CLI 0.24.1 and Gallery 4.0.0.
The registry check of installed files against the release commit now rebuilds the ignored `dist/styles.css` of opf-editor 0.24.1 and later from that commit's own `scripts/build-styles.mjs` and `src/styles`, instead of failing on a file the commit does not contain.
