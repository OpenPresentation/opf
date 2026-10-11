# Renderer 0.18.2 count gate: 2026-10-11

Renderer release-prep [#234](https://github.com/OpenPresentation/opf-render/pull/234), exact head `09325bddb475d1de2d4650373c0de007764ef167`, failed coordinated CI: the prepared registry correctly lists 94 lazy faces, but core's strict version table stopped at 0.18.1. The consumer refused an unknown 0.18.2 record. No renderer 0.18.2 publication is claimed.

Core repair [#622](https://github.com/OpenPresentation/opf/pull/622), frozen `7e0a71d8e7d6f244bcc77b77af152d20d4c09461`, adds only explicit 0.18.2 → 94, the root check registration and negative wrong-count/unknown-version/immutability regression. Gate pending at this record snapshot. Counts are asset-derived: 78 open + 16 Intos faces; [actual published 0.18.1 count](published-count.json) and [candidate count/manifest](candidate-count.json) are 94. [Independent 143-file proof](font-byte-proof.json) binds candidate manifest/fonts/licenses byte-for-byte to actual published baseline `d4259333a1105ce54d136ced0635f086d0f750ee`.

Focused and mapped tests pass; full core run 95671 terminal 0 with 37 root checks. Frozen serial packed run 62061 terminal 0 passes installed font preparation (layout/edit/undo/SVG/PNG/PPTX/reimport), 22 exports and all existing consumers. [Exact clean source identities](source-identities.json), [unchanged canonical tar manifest](manifest.json) and [independent artifact proof](artifact-proof.json) bind the four-package source/tar graph. The manifest has no commit fields; companion identities provide that binding. This is local tarball evidence, not registry verification of 0.18.2 or native acceptance.

Scratch working logs remain `/private/tmp/rr20-font-count-{full,changed-final,packed-frozen}.log`; initial failure `/private/tmp/opf-supervisor-20261010/render234-failure.log` and setup provenance failures were retained. Durable compact receipts above support review without importing large transcripts.

Required tasks remain open:

- Gate/merge #622, then run the prescribed ecosystem lock roller and gate its generated PR before retrying #234. Renderer CI's refs action reads ecosystem.lock; a fix on main alone does not select it. Never handpin the lock or change the release workflow.
- Retry exact renderer release-prep/commit gates, then trusted publication and independent registry verification. Continue required PPTX/editor 0.18.2 floors and final adoption afterward.
- Before renderer 0.19.0 or any selected 0.19 prerelease qualification, qualify that exact version's manifest/vendor/peer face bytes and prepared lazy count, then add its explicit reviewed version record with unknown/prerelease/wrong-count refusal tests. #622 admits ONLY 0.18.2. Integrate #622 into the v2 core candidate; historical staged renderer 0.18.1 results do not qualify new version metadata.

The bounded version-specific preflight found no analogous active PPTX/editor count map. Actual release-plan/verificationRefs/consumer locks still require genuine published graph adoption, and native packet identities/seals require a new reviewed packet for changed inputs. No stable metadata gate, breaking check, strict hash or native boundary is waived. Progress remains 15/40; T18 and final registry/site/native acceptance remain open.
