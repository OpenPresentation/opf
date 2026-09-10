# Shared code release gates

These are prospective versions, not published releases. Core PR #54 merged as `8d9c9c80b788bbdc80e18ad2b6468f07b2e2321d`, tree-identical to reviewed `e8b520dd2c23e559a8d9affcfcb8772c8b8079b7`. Complete Linux coordinator `34441603873`, core `34441603829`, Windows/macOS CLI `34441603812` and Bugbot pass, including the XML character boundary correction. [Portable CI evidence](../evidence/shared-code-ci-2026-09-09.json) is separate from the corrected Windows installed/native reports. Keep `release-plan.json` on the current complete published set until all successors are verified. Never republish an existing version.

Branch `codex/shared-code-release-20260909` prepares core 0.9.0 and CLI 0.7.0 with updated layout/skill documentation. npm confirms both versions are unused at preparation time; recheck before publication. Complete release checks and review before tags or npm publication. Consumer source branches remain `codex/shared-code-integration-20260909`: renderer `b5a3722725338e8d964783e8b7f1f7b80ce28cd3`, converter `b4f4645cdaa2f5eff8a883f68533875d3b63f239`, editor `52e540b83e441892fd928e9f159bffbb29da5653`.

[Local release preparation evidence](../evidence/shared-code-release-preparation-2026-09-09.json) passes Node 20.20.2/24.20.0: 448 core tests and preservation suites, 11 CLI tests and 69 command checks, core/CLI declarations, actual core installs checking 519 tarball entries, and standalone global/npx-style CLI installation. All six skills/17 helpers, 126 examples, spec/schema gates and zero-advisory audit pass; lint has no errors. CLI local-pack integrity is identical across both runtimes: `sha512-d72DCb5aNuM66Ori83ll+fMOeZBNk5RmaLityd/sgad84oAYrmRnbmHCe/re86jvsU1IAsZ3acG5bQmjL2HpIA==`. These local archives are not registry releases; complete the release PR's full coordinated CI and review next.

The standalone core verifier now runs all 28 quote/code layout and composition/pagination fixtures through actual installed public APIs in both local-tarball and registry modes. It rejects source-loader environments and replaces only test import paths. Local core 0.9.0 tarball checks pass on both runtimes; the registry mode must run after publication. This closes the previous verifier's omission of code fixtures without changing package runtime bytes.

| Order | Proposed target | Required behavior and dependencies |
| --- | --- | --- |
| 1 | Core 0.9.0 | Public `layoutCode`/source-line types, accepted `codeLayout`, complete metadata/body candidate scoring and pagination; `grid-score-v3` acknowledges changed selection and explanation types. |
| 2 | CLI 0.7.0 | Bundle core 0.9.0 and updated self-contained skills; retain safe offline six-skill installation, status and explicit updates. |
| 3 | Renderer 0.7.0 | Require core 0.9.0; use accepted code geometry, literal tabs/source spans, metadata targets and reviewed code raster baseline. |
| 4 | PPTX 0.7.0 | Require core 0.9.0 and coordinated renderer 0.7.0 for preview/font measurement; editable accepted code lines, guarded source recovery and explicit XML character errors. |
| 5 | Editor 0.6.0 | Require core 0.9.0/renderer 0.7.0; use converter 0.7.0 in verified examples; preserve source line endings, metadata/body edits, literal Tab and undoable export/reimport. |

Refresh each consumer lock only after its upstream versions are published. Run its complete source, packed, browser and CI/review gates on the release branch. Use trusted publication and immutable merge/tag refs, then inspect actual registry files, versions, integrity, signatures/provenance and fresh installs on Node 20/24. Do not substitute linked sources or private preview tarballs for that evidence.

Core preparation updates versioned API/skill documentation and CLI bundled-core wording. Reconcile the CLI-local changelog's missing published 0.6.0 entry with the already recorded 0.6.0 release; do not invent a new release or alter its published date. Keep the published quote-era documentation explicitly versioned when describing the prior `grid-score-v2` behavior.

After the complete set exists, enable shared-code registry tests against immutable released fixtures. Execute actual installed renderer/editor workflows, all previous browser suites and the corpus. Repeat the code-native PowerPoint bridge on registry bytes: generate, native edit/save/reopen, compare exact source and metadata. Preserve the font/executable/runtime and output hashes, and inspect representative wide/portrait native/SVG rasters. XML-representable Unicode does not establish glyph coverage; native source recovery does not reconstruct formatting, geometry, font theme or readability policy.

Advance the published core plan/immutable CI refs only after those registry gates pass. Update openpresentation.org documentation and accurate UTC changelog, pptx.gallery and pptx.dev to the new exact packages. Check deployed bundles/fonts and actual author/import, preview/layout, editing/undo, export and reimport workflows before claiming public adoption. Keep the current verified deployments available through review.

This release does not complete deterministic layout repair, Auto arrange, metric/timeline/chart internals, multilingual shaping, broad open-font compatibility or missing macOS PowerPoint/Keynote evidence. Continue the full ecosystem objective after the code milestone.
