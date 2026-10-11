# PPTX 0.18.2 prepared release qualification

Prepared checkout: `/private/tmp/release-train-pptx-iwOZns`, base `e19e1533401f49aa73f437d630a72b0362e1da9a`. Genuine release-train dry prep changes only package.json, package-lock.json, CHANGELOG.md and deletes assembled changes/rr-20-geometry-peer-floors.md (7 additions/7 deletions). Package version 0.18.2, core ^0.18.4 and optional renderer ^0.18.2.

Exact runner: `/private/tmp/rr20-pptx0182-release-qualification.sh`.
Transcript: `/private/tmp/rr20-pptx0182-release-qualification.log`.
Per-gate logs: `/private/tmp/rr20-pptx0182-release-<gate>.log`.
Session: 92067, terminal exit 0.

Node 24.21.0; task-local npm 11.16.0; TMPDIR=/private/tmp. NODE_AUTH_TOKEN explicitly unset. Temporary user npmrc is the literal setup-node `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}`. GITHUB_REF=refs/tags/opf-pptx-v0.18.2 and GITHUB_REF_NAME=opf-pptx-v0.18.2; checked package version matches. No token printed, source links, metadata edits, tags or publication performed.

Serial commands: npm ci; npm audit; npm run typecheck; npm run validate; npm test; npm run test:code; node scripts/published-core-gate.mjs --forbid; npm run test:packed; exact Playwright 1.63.0 package assertion; npm run test:browser; npm run test:font-variants; four test:native-{picture-edit,font-embed,mixed-edit,font-inventory}-controls scripts; npm pack --dry-run; git diff --check.

The release workflow pins Playwright Linux image v1.63.0-noble digest eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27. This is a macOS local replay with the same Playwright package, not a claim of executing that Linux image or cross-platform CI. Offline native harness checks do not establish Office native acceptance. GitHub release creation and npm publish are deliberately excluded from qualification.

Final result: every listed gate passed serially; terminal exit 0 at 17:57:33 UTC. Full suite 128 tests; packed browser 127 core examples byte-identical to Node; zero known vulnerabilities. Final tracked diff remains exactly the original four prepared metadata paths, 7 additions/7 deletions. No additional source or lock changes.
