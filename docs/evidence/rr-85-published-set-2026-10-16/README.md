# Selected published set — 2026-10-16

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
