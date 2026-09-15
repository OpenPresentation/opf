# JSON publication gate verification

Node 24.21.0 / npm 11.19.0 local verification adds the JSON control to the existing release gates without changing runtime source, package versions, predecessor dependencies, or native requirements. The release workflow's pinned npm version is unchanged.

Source syntax and package metadata checks pass. Seven source JSON browser workflows pass offline. A fresh tarball installation with actual npm core 0.9.0 and renderer/PPTX 0.7.0 passes both JSON model suites and the same seven installed browser workflows. All 39 shipped files match the candidate before and after browser verification; the installed bundle cannot import a sibling runtime. Reports contain dependency integrities, bundle/verifier hashes and zero page errors or external requests.

The complete `npm run test:packed` command then exits 1 at `test/layout.mjs:51`, where the registry core lacks the current editor's required `frameBox` behavior. The full failure is retained. The scoped JSON checkpoint is not full-package acceptance, and no gate is bypassed: all later model/browser/audit/signature checks remain required before publication. Existing source integration needs a coordinated dependency release, as recorded in PR19; this change does not claim otherwise.

The manifest hashes every artifact and the changed verification/workflow files. This evidence is not a new npm release, native Office compatibility result, or deployed-site dependency update.
