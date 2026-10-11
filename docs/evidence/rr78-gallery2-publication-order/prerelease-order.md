# Untagged core prerelease ordering audit

Read-only, API0. Inspected current main d12ad7e26aa0edfb52e4280dfe527053fe76f98e. No versions, manifests, locks or sources changed.

## Finding

Existing version tooling permits a genuine metadata-only core0.19.0-next.0 prep/merge before v2 source merges, then a distinct stable0.19.0 prep after gallery2 publishes. This solves breaking-version acknowledgment; it does not substitute for candidate-gallery source/packed qualification or waive any existing gate.

- scripts/check-breaking-changes.mjs parseVersion/versionAcknowledgesBreaking compare numeric major/minor. 0.19.0-next.0 is a breaking minor above the latest0.18 tag. No prerelease tag is needed or should be made.
- scripts/release-train.mjs isVersion accepts prereleases. compareVersions orders0.18.3 < 0.19.0-next.0 < 0.19.0. prep allows each strictly newer version.
- Core has upstream:[]; core-only preliminary prep raises no engine floors and waits for no engine/gallery publication. Independent gallery is outside the train.
- prep always assembles changelog fragments, refreshes lockfile, checks its metadata allowlist and opens a regular release-prep PR. It cannot do an empty bump through current assembler: no fragments/Unreleased bullets throws 'nothing to assemble', even with a summary. A real preliminary metadata announcement fragment is needed if there are no appropriate current fragments. Consumed fragments remain under the next.0 section; final implementation fragments are assembled into stable0.19.0. Stable notes must accurately describe the complete delivered release rather than silently omit earlier consumed substantive notes.
- Current release selector is releaseCommit (there is no findVersionCommit symbol in this checkout). It walks manifest-history commits from main, finding the oldest consecutive exact requested version, and stops on the first other version. A final stable-setting prep commit is therefore selected; its preceding next.0 commit cannot become the stable tag target. Each release commit's own checks remain required.
- After gallery2 trusted publication/verification, final prep must adopt actual registry gallery2 root/runtime ranges and real lock entries. Current ecosystemDependencies/unpublishedFloors only enumerates the five train packages, so it does NOT automatically enforce the independent gallery runtime floor; existing packed/publish checks and the explicit candidate-gallery release rejection must protect that boundary. Do not rely on release-train alone to reconcile gallery.
- The preliminary must remain UNTAGGED, and npm-publish workflow_dispatch must not run: the existing publisher publishes on dispatch and has no generic prerelease prohibition. Merely merging the prep does not trigger it; workflow events are tags or dispatch. Stable prep/tag/release follow ordinary trusted publishing after all gates pass.

## Reproduction

Node24 evaluated the actual pure breaking acknowledgment function from its source, and imported actual isVersion/compareVersions/releaseCommit/assembleChangelog. Assertions passed for breaking acknowledgment, accepted prerelease, next<stable ordering, core upstream[], distinct changelog sections, empty assembly rejection. A mock API supplying manifest history [afterStable:0.19.0,stable:0.19.0,feature:next.0,preliminary:next.0,old:0.18.3] made actual releaseCommit select 'stable' and stop before the feature/preliminary commits. No network or API requests.

Concrete order: genuine untagged preliminary metadata prep with unchanged published dependency ranges; required CI/queue green; opt-in exactSHA candidate-gallery lane qualifies v2 source and transparently staged packed manifests; merge reviewed v2 core/renderer; refresh gallery bootstrap pins to those merged sources; publish/verify gallery2; merge a reviewed registry-adoption PR updating the real registry range/lock and removing staging declarations/configuration before final stable prep; run ordinary release gates; tag the stable-setting prep commit and publish core0.19.0, then downstream packages.
