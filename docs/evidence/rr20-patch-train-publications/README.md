# Required geometry patch-train publication evidence

Core 0.18.4 is published and independently verified. Required order remains core 0.18.4 → renderer 0.18.2 → PPTX 0.18.2 → editor 0.18.2. The remaining three publications and final release-plan/site adoption are pending. T18 stays open; this evidence closes no checkpoint and changes no progress count.

## Core 0.18.4

Exact release commit/tag/gitHead: `e09461624a64fb58761c28475c2b354984deb165`, tag `opf-v0.18.4`, package `@openpresentation/opf@0.18.4`. Trusted publication used [.github/workflows/npm-publish.yml, run 38143021019](https://github.com/OpenPresentation/opf/actions/runs/38143021019/attempts/1). [Publication transcript](core-0184/publication.log) and separate [independent verification](core-0184/independent-verify.log) bind npm integrity, main/tag/version identity, SLSA provenance, one verified signature with zero invalid/missing signatures, and the GitHub release. Both original logs are retained byte-for-byte.

Before tagging, an isolated exact-commit [local workflow replay](core-0184/local-publish-replay.log) completed exit 0 using Node 24.21.0, npm 11.16.0 and pnpm 10.33.2. The [exact replay script](core-0184/local-publish-replay.sh) checks full history and the `opf-v0.18.3` baseline, absent initial core/CLI dist, literal token-placeholder npmrc, unset `NODE_AUTH_TOKEN`, and the intended tag ref environment. Frozen install, publication guard, lint, types, full tests, breaking check, pack dry run, examples, portable skills and isolated packed smoke passed serially with no tracked source delta. Replay itself did not tag or publish. Its scratch paths are retained as provenance; use an isolated checkout and substitute only local path locations when replaying.

This is verified core 0.18.4 registry evidence, not qualification of unpublished v0.19 staged engines/gallery, new native packet observations or final site adoption. Native acceptance and the coordinated v0.19 source/staged boundaries remain separate. Further patch-train package receipts can be appended here after actual trusted publication and independent verification.
