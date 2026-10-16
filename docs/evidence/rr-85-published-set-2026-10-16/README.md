# Verified package set — 2026-10-16

Core **0.20.3**, renderer/CLI **0.20.0**, PPTX/editor **0.20.2** and Gallery **3.0.0**.

[Selected artifacts](selected-artifacts-core0203.json) binds this final selection
to exact registry metadata and downloaded tarball hashes. Core's
[maintained trusted-publication log](core0203-trusted-publication.log) records all
ten results, including exact tag/gitHead `28a65e010861e6fe2f8ed140f8306df2f6d2b567`,
SLSA subject/workflow/source, npm signatures and GitHub release. Core 0.20.3
adds the validation-results schema annotation and documentation change; public
schema IDs, types and APIs remain stable. The five sibling artifact identities
match the earlier trusted authority unchanged.

All 13 OPF dependency and peer ranges accept this selection. The normal
`prepare-consumer.mjs --update-lock` updates the committed matrix consumer
manifest and npm lock to Core 0.20.3. Qualification of this private PR consumer
is separate from activation of the merged canonical registry consumer and site
generation. No new native, deployment or global fidelity acceptance is claimed.

The original Core 0.20.2 selection below, its archive receipt and trusted log
remain unchanged dated evidence. Core 0.20.3 was subsequently published and
fully verified before this final plan revision.

# Earlier selection — 2026-10-16 06:46 UTC

This incremental selection advances Core from 0.20.1 to 0.20.2 and retains
renderer/CLI 0.20.0, PPTX/editor 0.20.2 and Gallery 3.0.0. It does not wait for or
claim publication of the separate dependency-floor train.

[Selected artifacts](selected-artifacts.json) records a fresh exact-version npm
metadata read and downloaded-tarball SHA-512 verification for all six packages.
Every `gitHead` and registry integrity matches the retained trusted publication
authority: [Core 0.20.2 checks](core0202-trusted-publication.log) and the
[unchanged five package records](../rr-20-registry-current-2026-10-14/verified-registry-authority.json).
The Core log includes the trusted workflow, SLSA provenance and signature results;
its `latest` observation remains dated, not a new dist-tag claim.

The selected renderer, PPTX, editor and CLI declare Core `^0.20.1`, which includes
0.20.2. Their optional OPF peers also accept the selected versions. No dependency
range, package payload, source snapshot lock, schema or catalog record changes.
The immutable Core verification ref advances to the actual 0.20.2 publisher commit
`b1f0aa3c543424f7befb08785634a6a5a8652caa`; all sibling and example refs stay unchanged.

This updates the canonical plan and current installation instructions. The normal
registry-consumer qualification and site asset generation must run after this
plan is merged. No new installed-consumer, browser, native, deployment or global
fidelity pass is claimed here. Earlier dated evidence remains unchanged.
