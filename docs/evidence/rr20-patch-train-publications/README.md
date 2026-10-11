# Patch-train publications and remaining qualification

Core **0.18.4**, renderer **0.18.2** and PPTX **0.18.2** are trusted-published and independently verified. Editor source test repair [#160](https://github.com/OpenPresentation/opf-editor/pull/160), head `44def28661d14e2134206a7fca910d17f79a405f`, awaits exact-head gate 91343. Editor release preparation and final release-plan/site adoption remain incomplete. T18 stays open; progress remains **15/40**. Required order is core → renderer → PPTX → editor; CLI remains 0.18.1.

## Verified publications

- **Core 0.18.4:** tag `opf-v0.18.4`, gitHead `e09461624a64fb58761c28475c2b354984deb165`, trusted workflow 38143021019. [Publication](core-0184/publication.log) and [independent verification](core-0184/independent-verify.log) bind integrity, exact source/tag, SLSA, one verified signature and GitHub Release. The [local publish-workflow replay](core-0184/local-publish-replay.log) and [script](core-0184/local-publish-replay.sh) retain pre-tag qualification.
- **Renderer 0.18.2:** tag `opf-render-v0.18.2`, gitHead `de0a5034f49dbacfe190946ec7416a976981cf45`, trusted workflow 38157832669. [Exact publication and separate verification receipts](renderer-0182/README.md) establish npm latest, integrity, SLSA, four verified signatures and GitHub Release.
- **PPTX 0.18.2:** tag `opf-pptx-v0.18.2`, gitHead `1954c9ce3d2c54a69666b54acdc9fcc87dcb9ca2`, trusted workflow 38165718768. [Exact receipts](pptx-0182/README.md) establish publisher 88826 and verifier 28020 exit 0, registry integrity/latest, SLSA, thirteen verified signatures and GitHub Release.

These are registry artifact proofs, not fresh native PowerPoint observations or site adoption.

## Qualification and retained failures

Renderer preparation #234 initially failed the coordinated strict font-count gate. [Repair and roller evidence](renderer-0182-count-repair/README.md) preserves the asset-derived 94-face proof, core #622 repair, prescribed generated lock #623, successful retry and release-commit qualification. Those failures and pending states are historical. Future renderer versions still require their own reviewed exact count records.

PPTX dependency-floor #249 merged, mandatory pre-prep packed qualification and full dry-release qualification passed, and executed #250 preparation matched all four reviewed metadata paths byte-for-byte. [Preparation, merge-tree and exact-commit receipts](pptx-0182-preparation/README.md) retain that sequence before the completed publication above.

Editor mandatory pre-prep and reviewed dry metadata preparation passed. [Prerequisite receipts and frozen hashes](editor-0182-preparation/README.md) preserve actual registry upstreams. The first prepared qualification failed native textbox selection in the broader data-grid browser test after all twenty playground cases passed; remaining gates were not run. [Original failure and unchanged-source evidence](editor-0182-preparation/failed-qualification/status.md) is retained.

Diagnostics then confirmed native keyboard test-harness shortcut mismatches. [Reviewed source repair and original/final receipts](editor-0182-preparation/source-test-repair/independent-review.md) preserve focus and selection assertions, application keyboard controls and strict expected values. Final local targeted dataset, all eleven registered browser suites, typecheck 205 and full seventy tests passed at `44def286`. PR #160's CI/merge remains pending. After integration, fresh pre-prep and dry full release replay are required before executing editor preparation; these source passes do not qualify a future release artifact.

## Local v0.19 source candidates

- [Core refresh and supervisor preservation proof](v019-source-refresh-622623/README.md): `b597dbe099166d62067ea1cc67696c45cc268177`, mapped 24/25 with genuine minor-version acknowledgment still unmet.
- [Optional-engine contract reviews and exact logs](v019-engine-peer-contract/README.md): isolated `1921a28c6d4eea090dc368c13c75ca1b359bdc39`; focused/consistency checks pass, strict missing 0.19 engines and genuine minor gate remain failures.
- [Renderer published-main refresh](v019-render-published-refresh/README.md): `d4ab7a5861719fb366e50299ee0604b05eec444e`, focused source checks against actual core b597/gallery e0; prior renderer 127669 remains immutable.
- [PPTX metadata refresh](v019-pptx-current-refresh/README.md): `f62dd05a8ef0712ca2a35a11857f9085de6fd7a1`, preserves original 1fae runtime/Pareto bytes and passes focused source checks against core 1921/renderer d4ab/gallery e0.

Historical staged graph and native packet identities remain unchanged. Source qualification, staged installed consumers, actual registry installation, native acceptance and site adoption are separate gates. None of these records closes a checkpoint or waives missing version, dependency, native or deployment requirements.
