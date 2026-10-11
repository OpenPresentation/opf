# Required geometry patch-train publication evidence

Core 0.18.4, renderer 0.18.2 and PPTX 0.18.2 are published and independently verified. Required order remains core 0.18.4 → renderer 0.18.2 → PPTX 0.18.2 → editor 0.18.2. The remaining editor publication and final release-plan/site adoption are pending. T18 stays open; this evidence closes no checkpoint and changes no progress count.

## Core 0.18.4

Exact release commit/tag/gitHead: `e09461624a64fb58761c28475c2b354984deb165`, tag `opf-v0.18.4`, package `@openpresentation/opf@0.18.4`. Trusted publication used [.github/workflows/npm-publish.yml, run 38143021019](https://github.com/OpenPresentation/opf/actions/runs/38143021019/attempts/1). [Publication transcript](core-0184/publication.log) and separate [independent verification](core-0184/independent-verify.log) bind npm integrity, main/tag/version identity, SLSA provenance, one verified signature with zero invalid/missing signatures, and the GitHub release. Both original logs are retained byte-for-byte.

Before tagging, an isolated exact-commit [local workflow replay](core-0184/local-publish-replay.log) completed exit 0 using Node 24.21.0, npm 11.16.0 and pnpm 10.33.2. The [exact replay script](core-0184/local-publish-replay.sh) checks full history and the `opf-v0.18.3` baseline, absent initial core/CLI dist, literal token-placeholder npmrc, unset `NODE_AUTH_TOKEN`, and the intended tag ref environment. Frozen install, publication guard, lint, types, full tests, breaking check, pack dry run, examples, portable skills and isolated packed smoke passed serially with no tracked source delta. Replay itself did not tag or publish. Its scratch paths are retained as provenance; use an isolated checkout and substitute only local path locations when replaying.

This is verified core 0.18.4 registry evidence, not qualification of unpublished v0.19 staged engines/gallery, new native packet observations or final site adoption. Native acceptance and the coordinated v0.19 source/staged boundaries remain separate. Further patch-train package receipts can be appended here after actual trusted publication and independent verification.

## Renderer 0.18.2 retry prerequisite — 2026-10-11

Release-prep #234 failed the coordinated font-count gate; [strict repair and remaining task list](renderer-0182-count-repair/README.md) retain the exact asset-derived 94-face proof and pending core #622 gate. Required order is repair merge → prescribed ecosystem lock roller/generated-PR gate → renderer #234 retry → trusted publication/independent verification. Future 0.19 renderer versions require their own reviewed exact count records; #622 is not blanket version acceptance. No additional publication, checkpoint or progress change is claimed.

## Renderer 0.18.2 published and verified

[Exact trusted publication and separate independent verification](renderer-0182/README.md) completed at `de0a5034f49dbacfe190946ec7416a976981cf45`, workflow 38157832669, with npm latest, registry integrity, SLSA provenance, four verified signatures and GitHub release checked. Prior pending records remain historical. PPTX/editor 0.18.2 and adoption are pending; T18 and 15/40 progress are unchanged.

## PPTX 0.18.2 qualified preparation — 2026-10-11

[Dependency-floor merge, fresh prerequisite, full dry qualification and byte-identical executed preparation](pptx-0182-preparation/README.md) are complete. Release-prep #250 at `d07b63491be294bc9a14c7aba04683036c1eb954` awaits gate 12145; no PPTX publication is claimed.

## Local renderer v0.19 refresh — 2026-10-11

[Reviewed source refresh](v019-render-published-refresh/README.md) is clean at `d4ab7a5861719fb366e50299ee0604b05eec444e`; focused source checks pass. Prior `12766980` graph/packet identities are retained; final registry/native acceptance remains separate. PPTX gate 12145 remains pending.

## PPTX preparation merged — 2026-10-11 18:19:49 UTC

#250 merged at `1954c9ce3d2c54a69666b54acdc9fcc87dcb9ca2`, gate 12145 exit 0; [merged tree proof](pptx-0182-preparation/merged-tree-comparison.json) equals reviewed preparation. Sole exact-commit gate 24822 is pending; no tag or publication yet. Prior pending prose is historical.

## Local PPTX v0.19 current-main refresh — 2026-10-11

[Metadata-only refresh and focused source evidence](v019-pptx-current-refresh/README.md) are retained at `f62dd05a`; prior `1fae5a9d` stays immutable. No fresh full-graph, registry 0.19 or native claim.

## PPTX exact-commit gate and tag — 2026-10-11 18:53:20 UTC

[Gate 24822 receipt](pptx-0182-preparation/release-commit-gate.log) confirms all four checks at `1954c9ce`. Tag `opf-pptx-v0.18.2` is created; supervisor process 88826 awaits trusted workflow startup. Publication/independent verification are pending; editor pre-prep waits. No T18 closure.

## PPTX 0.18.2 published and verified

[Exact receipts](pptx-0182/README.md) confirm publisher 88826/verifier 28020 exit 0 at `1954c9ce`, workflow 38165718768. Editor pre-prep is running; no editor prep yet. T18 remains open for editor and adoption. Earlier pending paragraphs are historical.

## Editor 0.18.2 prerequisite and dry preparation

[Pre-prep and reviewed metadata receipts](editor-0182-preparation/README.md) are retained. Prepared qualification 22527 failed the broader data-grid browser case after all 20 playground cases and preceding gates passed; remaining gates are unrun, source unchanged, diagnosis unconfirmed. [Failure receipts](editor-0182-preparation/failed-qualification/status.md). No release PR or acceptance claim.
