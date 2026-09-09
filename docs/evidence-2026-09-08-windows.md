# Windows release and adoption evidence — 2026-09-08

## Verified production adoption and security continuation

Latest continuation: core PR #12 merged as `e43e263795c824b0fe6bddc4b37deb612a196766` after successful combined package CI `34266685795` and coordinated CI `34266685705` on `9f10ef3417af1ecfda8539d6844a2a80dcc50b2e`. Gallery's GitHub open security alert count is now zero. pptx.dev draft PR #15 preserves `08fab78`; fresh Windows Node 24 installation passes 588 tests/58 files, typecheck and compile build. A tested version-specific override removes unused image-size from that application's graph, yielding zero root audit advisories with no exceptions. Separate SDK lockfiles remain outside that claim. Its first real Edge inspector load exposed missing-Clerk assumptions in middleware/header; credential-free public-page fixes and browser regression coverage remain in progress.

- Core PR #28: reviewed head `17e9404b7d37139676ee5733e680f5fb3dbca6d9`, identical merged tree `51445f03b70bed896e53e346f2fb7b2c04293b94`. Passing package CI `34263741586`, Windows/macOS portability `34263741696`, coordinated CI `34263741700`, and renewed Bugbot review. Published CLI verification derives its version and test source from immutable release-plan fields.
- Website PR #14: reviewed head `4e952e8cb499c7c71ae2a1be0d9fed065b63089b`, identical merged tree `49d30c6a25d684e7f1a3cbdca44ec565e1b9472f`. CI `34262535034` and Bugbot pass. Production `dpl_6iQrr4VNh9Mu61DvdJXJ6Xs9c8Rc` is READY on that merge. Four Edge E2E tests pass against https://www.openpresentation.org, including clipboard and full six-skill file verification. The registry showcase includes CLI 0.5.0. GitHub open security alerts reached zero.
- Gallery PR #15: tested head `3d1d79e6692619cee1fe2e04820989e680107b2e`, identical merged tree `188758dcde7248f70ceeb44238ba5986be4c91d0`. CI `34263709069` passes; manual diff and test review completed. Production `dpl_6WQqZZAeS28tDCxuMLa6dJeWw7oo` is READY on that merge. Two Edge E2E tests pass against https://www.pptx.gallery: deployed seven-file manifest integrity and real JSON authoring, merged-table preview, inline editing, undo/redo, OPF export and reimport. Bundle regeneration validates/renders 854 documents. The 106 unit tests, 1,925-page build, required catalog checks and current pnpm audit pass. GitHub alerts were still awaiting reconciliation after deployment; none were dismissed.

These deployment tests do not cover browser PPTX import/export: the gallery's editor example currently exposes OPF controls only. Main-site tests cover documentation and artifact downloads, not a complete interactive presentation authoring flow. pptx.dev's custom preview and authenticated API export still need adoption work and browser evidence. A successful compile build and the existing unit suite missed its recursive palette failure; newly enabled standalone playground coverage found it before deployment.

Dependency review: checkout v7 and setup-node v7 passed exact-head Node 20/24 CI and migration review before core PRs #10/#11 merged. pnpm/action-setup v6.1 awaits renewed combined CI after resolving a workflow conflict. TypeScript 7 is explicitly deferred with reproducible declaration-bundler failure on PR #16. No major is merged solely because Dependabot proposed it, and no security alert is hidden.

## Published CLI installer and deployed website checkpoint

CLI 0.5.0 merged in PR #27 as `7a2845f45bd7c6f48312b07100851c0ee29a9d1c`, identical to reviewed `fcaa85fb50c06dd737f9e71419f3b9a40618184d`. Final linked-parent fix passes [macOS/Windows Node 20/24](https://github.com/OpenPresentation/opf/actions/runs/34260124438), [Linux package CI](https://github.com/OpenPresentation/opf/actions/runs/34260124472), [coordinated CI](https://github.com/OpenPresentation/opf/actions/runs/34260124563) and successful Bugbot review. The finding is resolved. [Trusted publication](https://github.com/OpenPresentation/opf/actions/runs/34261574915) succeeded for tag `cli-v0.5.0`.

Registry gitHead equals that merge; SLSA provenance exists. CLI tarball integrity is `sha512-zStGUvtciPZcRz7U9bwV5vYaF0BpoXY8De2sCATHBWXNEtbozakBzi0JmT3hseyv08e4yYx4rlJqMRn6e1LzMw==`. `node packages/cli/test/packed.mjs --registry` passes on Windows Node 20/24: fresh cache, npm registry download, isolated offline global installation, npx-style named-package installation of all six skills, preserved AGENTS.md, idempotent install and 69 installed CLI checks. Windows file-symlink privilege remains explicitly skipped; macOS/Linux CI covers file links, and Windows junction tests pass. Updated release-plan ecosystem checks pass on Node 20/24 with CLI 0.5.0; existing renderer/PPTX/editor versions are unchanged.

Main-site PR #11 merged as `c1cbbbb4e91911392612a157155441b523f187dc`, identical to reviewed `6db427276aab2a918e4edd7cdda59a4f33fcb28c`. [Website CI](https://github.com/Data-Advantage/openpresentation-site/actions/runs/34260733732), Bugbot and Vercel preview pass. Production deployment `dpl_ApPs9yCN43U6zVsGEkSmfQ6tFRTM` serves the merged commit. `OPF_SITE_URL=https://www.openpresentation.org pnpm test:e2e` passes all three checks: published history/links/anchors, mobile overflow containment, and OPF/SVG/PPTX browser downloads with exact registry-showcase hashes. This closes the separate deployed-changelog milestone; CLI 0.5.0 site documentation and broader application workflow coverage continue separately.

The installer-site follow-up builds 603 pages from immutable source `7a2845f45bd7c6f48312b07100851c0ee29a9d1c`, exporting six skills and 598 raw resources. Four local Edge tests additionally verify actual clipboard command copying and the size/hash of every served skill file. Gallery dependency maintenance passes 106 existing unit tests, a 1,925-page build and a zero-advisory pnpm audit, without muting alerts. Updated gallery artifacts validate/render 854 canonical documents and expose 625 schema fields; their final UI and deployment verification remain pending.

This supplements the portable handoff. GitHub branches remain the source of truth; local artifacts can be regenerated. The ecosystem goal remains active, including adoption by developers and agents.

## Host preflight

- GitHub CLI authentication and admin/write permissions verified for all seven repositories. A renderer dry-run push succeeds.
- npm authentication verified as `grimmmichaelj`. Existing release workflows use GitHub Actions trusted publication with provenance; no package was republished during preflight.
- Vercel CLI authentication verified after user login. The connector sees all three projects in the Data Advantage team, each connected to the expected GitHub repository.
- Node 20.20.2, Node 24.20.0, npm 11.16.0 and pnpm 10.33.2 are runnable through npm exec. The host's default Node is 26.4.0, so release tests explicitly select supported runtimes.
- Microsoft PowerPoint 16.0 native automation created a one-slide PPTX, exported a 1280×720 PNG, reopened the deck, edited a native text box and saved. The test deck was then opened in the visible PowerPoint UI and inspected. This is host capability evidence, not OPF export fidelity evidence.
- Edge automation reads the deployed site. File Explorer automation navigates to the generated evidence. User approved application access. OS sleep/hibernate settings were inspected, not changed.

## Renderer 0.5.0 published

Exact reviewed source: `OpenPresentation/opf-render@b47bba101ab78dc226d9ff848bb8622e3a0109e1`.

- GitHub CI run [34246424745](https://github.com/OpenPresentation/opf-render/actions/runs/34246424745) passes full Node 20/24 checks on this exact head.
- Full standalone tests pass locally on Windows with both supported runtimes, npm 11.16.0 and installed registry core 0.7.0. Each run passes the unchanged 126-deck/805-slide golden raster gate, smoke corpus, WebP, all JPEG orientations, font policies, rich/styled table checks and browser bundle construction. Syntax and package metadata checks pass; build leaves the tracked tree unchanged.
- A fresh consumer installs the new renderer tarball and exactly one registry core 0.7.0. Styled table regressions pass on Node 20/24 with `NODE_OPTIONS` cleared. Every installed `dist` file matches the tested build byte-for-byte.
- Tarball: 32,778 bytes; SHA-1 `3efdeb1903dd435b732a8e1ac2539240cea98812`; integrity `sha512-yOjy+5XR16I6GgGNCqU1ymX9z9CpNFCxSTYxPYNUG+eYfIOhQtExj5ZiHu8sfB7pXU0Qr+J5HqIoSJEnPnewlw==`. Packing a clean Git archive gives identical bytes.
- Review assessment: core applies vertical alignment to `cell.textBox.y` before rendering; independent scalar/rich baseline assertions verify that behavior. The implicit-neighbor border finding was valid and is fixed by explicit segment ownership, including zero-width and partial merge boundaries. Both earlier GitHub review threads are resolved. Renewed Bugbot check `102140710854` completed successfully at 16:17:32 UTC with no issues. PR #6 merged as `9f34d70002307fcb3795de638e7e4bf0605a33f8`; the merged tree matches the tested head. Tag `opf-render-v0.5.0` was pushed to that merge.

Trusted publication [34250244090](https://github.com/OpenPresentation/opf-render/actions/runs/34250244090) succeeded. Registry 0.5.0 points to merge `9f34d70002307fcb3795de638e7e4bf0605a33f8`, with signatures and SLSA provenance. Published integrity is `sha512-VsUTeRaOS00cnQl9z02dvQRuxSP/8ylNNozD86QhwZFxrlOBhpLOWRlq17yAWF4qAYxS2V1Gl9n9SVouYfaOEw==` (32,663 bytes). The Windows candidate above differs solely by CRLF in distributed text. Normalizing all 16 distributed files to LF reproduces the published tarball exactly.

Fresh registry renderer/core consumers pass styled-table and golden tests on Node 20/24 without source loaders. Edge passes all 16 JPEG orientation/fit/crop browser cases; the wrong-orientation control fails as expected. That browser bundle uses renderer source and registry core, not a final all-registry ecosystem bundle.

## PPTX 0.5.0 and editor 0.4.0 published

Both lockfiles resolve registry core 0.7.0 and renderer 0.5.0. Editor head `954118f79d937d0ab3a659efdf9f5bb159bbea1c` passes full local Node 20/24 suites, [CI 34250928417](https://github.com/OpenPresentation/opf-editor/actions/runs/34250928417), and renewed Bugbot review. A clean tarball consumer passes coordinated core/editor/SVG/PPTX checks, TypeScript declarations and browser bundling. Real Edge interaction with installed editor packages passes merged rich typing, style preservation, scalar promotion/bold formatting, empty styled-cell entry and complete undo. PR #5 merged as `e8bdedf7f80e2eab0ff7d869b9436cd2050e426d`; tag `opf-editor-v0.4.0` published through successful [run 34255543246](https://github.com/OpenPresentation/opf-editor/actions/runs/34255543246). Registry gitHead matches and SLSA provenance is present.

PPTX Windows tests exposed two URL.pathname fixture bugs; fileURLToPath fixes them. CI now covers Ubuntu and Windows on Node 20/24; all four jobs passed head `16efa451990d2cdd7f5766cb33c347bd1497e063`. Subsequent real PowerPoint testing found a native merged-border defect, fixed in `50a96e4be3f0500990a095c8d4fd0980e3f11f06`. Full local Node 20/24 suites, metadata/syntax checks and the 126-deck/805-slide corpus pass the fix. New assertions cover physical continuation borders, shared implicit neighbors, alpha/dashes, zero-width suppression and scaling. [CI 34252815618](https://github.com/OpenPresentation/opf-pptx/actions/runs/34252815618) passes all four OS/runtime jobs on the fix. Renewed Bugbot review `102154204635` succeeded at 17:00:36 UTC with no inline findings. PR #10 merged as `6198def72d9b4d58e8d8a22dc7842d0d0760a5a6`; tag `opf-pptx-v0.5.0` published through successful [run 34255173008](https://github.com/OpenPresentation/opf-pptx/actions/runs/34255173008). Registry gitHead matches and SLSA provenance is present.

PPTX published integrity is `sha512-GKVmqWjQ8GRuEMmpJajPs+W+q35MPy6q8+FL8nWH+d17Sh+/O87BBBfSi6m9KLGxQZav2o1I/bfMoftP5DNEfg==`; editor integrity is `sha512-5KhsDeLQdjWy2flkrrQMSEi57Z1XoCmNujpL9KOjt5+zDDtVXUHu1ospyh7SCKuoPwp3/mv+hWJuXkHOWCNrHA==`. Normalizing CRLF to LF in the tested Windows candidates reproduces both published tarballs exactly (13 of 14 PPTX files and all 32 editor files required normalization).

The complete published plan (core 0.7.0, renderer 0.5.0, PPTX 0.5.0, editor 0.4.0, CLI 0.4.0) now passes fresh registry ecosystem and pinned fidelity scripts on Windows Node 20/24. Tests execute actual installed distributables without source overrides: core/editor operations, seven table-layout tests, styled export/import/borders, standalone CLI, TypeScript, browser bundling, all 805 golden slides and the export dependency-boundary suite. Registry-generated Edge fixtures pass merged rich typing, scalar promotion/bold, empty-cell keyboard entry, style preservation and complete undo. Application/deployment E2E remains separate.

Edge executes the updated PPTX browser bundles successfully: 12 styled-table checks, 20 rich native import cases and 11 conditional-style checks. These bundles use the candidate PPTX source and registry core/renderer; final registry E2E remains separate.

The fresh PPTX consumer still reports high advisories through PptxGenJS 4.0.1's image-size dependency (GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq). No patched compatible image-size version was advertised. The full suite passes with image-size loading blocked. This is reachability evidence, not removal of the dependency or dismissal of its security alerts.

## Native Windows PowerPoint evidence

Repeatable harness: [generation/comparison](../scripts/test-native-powerpoint.mjs) and [PowerPoint automation](../scripts/test-native-powerpoint.ps1). It uses local installed Calibri regular/bold/italic/bold-italic bytes for measurement and SVG rasterization, with substitution disabled. It neither embeds nor redistributes those font binaries. PowerPoint itself remains an optional external verifier, not an ecosystem runtime dependency.

Three OPF fixtures export, open in PowerPoint 16.0, rasterize at 1280x720, retain two editable native tables, accept a cell edit and preserve it through save/reopen. Source export, native-saved and native-edited decks reimport as valid OPF with both table merges intact and no diagnostics. Tests were repeated with registry core 0.7.0, renderer 0.5.0 and PPTX 0.5.0; the registry report records each package's lockfile integrity and reproduces the candidate's raster measurements.

The first native comparison exposed a truncated dashed edge and a reappearing zero-width edge on merged cells. The corrected candidate explicitly styles physical continuation perimeters and matching implicit neighbor edges. Targeted native pixel assertions now observe 36 blue pixels in the lower dash region (minimum 15) and zero unwanted green pixels along the hidden border.

Global mean absolute RGB-channel differences against the SVG raster are 3.2767, 1.8507 and 2.5945 (0–255); 2.2505%, 1.2935% and 1.6997% of channels differ by more than 10. Text baselines/line spacing and native border dash/segment rendering still differ visibly. These are measured observations, not a declaration of pixel equivalence. Broad native corpus equivalence remains incomplete.

Reproduce from a consumer containing the desired exact package set:

```powershell
node scripts/test-native-powerpoint.mjs artifacts/native-powerpoint generate
./scripts/test-native-powerpoint.ps1 -EvidenceDirectory artifacts/native-powerpoint/evidence
node scripts/test-native-powerpoint.mjs artifacts/native-powerpoint compare
```

[Native comparison reports and raster evidence](evidence/native-powerpoint-2026-09-08/README.md) preserve the candidate checkpoint and separate final [registry results](evidence/native-powerpoint-2026-09-08/registry-comparison.json).

## Dependency and application inventory

Initial live inventory:

- Core has seven Dependabot PRs: #10 checkout 7, #11 setup-node 7, #12 pnpm/action-setup 6, #13 json-schema-to-typescript 16, #14 Biome 2.5.12, #15 Node types 26, #16 TypeScript 7. These remain unmerged pending compatibility and CI review.
- Renderer, PPTX, editor and gallery have no open Dependabot PRs. Main site has unrelated PR #4; pptx.dev has unrelated PR #6. Preserve and review their relationship to adoption work before changing overlapping files.
- The four public package repositories report no open Dependabot security alerts. The three application repositories had alerts disabled. Alerts were enabled and verified using the GitHub API. A complete paginated inventory then reported 22 alerts for the main site (15 high, 7 medium), 23 for gallery (14 high, 8 medium, 1 low), and 143 for pptx.dev (3 critical, 55 high, 72 medium, 13 low). No alerts were dismissed. Remediation remains pending; counts include multiple advisories for a single dependency and multiple manifests.
- The deployed main-site changelog shows only core 0.2.1 and 0.1.0 while its source metadata reports 0.6.0. This confirms a separate website data/rendering task remains.
- pptx.dev's manifest still targets core ^0.2.1, renderer ^0.0.2, PPTX ^0.0.1 and editor ^0.0.1. Its Vercel production deployment uses commit `4a1fc69af09addd37fe62500a1ab8b50fa63cbf8`. It needs a substantive compatibility audit, not just a version substitution.

## Skill installation research

Official references inspected:

- [Convex AI files CLI](https://docs.convex.dev/cli/reference/ai-files): managed install/update/status/remove commands, project-local instructions and agent skills.
- [Convex project configuration](https://docs.convex.dev/production/project-configuration): configurable target agents and install/staleness suggestions during development.
- [Open skills CLI](https://github.com/vercel-labs/skills): npx installation, named skill/agent selection, project/global scope, copy mode and updates.

The initial requirements were to preserve user changes and unrelated agent configuration, install all six self-contained folders, work on Windows without symlink privileges, and expose a real command in CLI help and repository/site documentation. The later implementation checkpoint below supersedes this research-only stage; publication remains a separate gate.

## Dependency-notification checkpoint

Core Dependabot PR #14 (Biome 2.5.3 to 2.5.12) was reviewed, tested against the current checkout with the actual 2.5.12 executable, and merged as `001caa0b7b36692b0ac445ca8ac782ee1a93045d`. Its CI passes Node 20/24; the lockfile diff changes only Biome and its platform binaries. Existing lint warnings remain; no runtime package was upgraded by this PR. The six major-version PRs remain separate for compatibility review.

Core configuration now groups minor/patch version updates and minor/patch security updates separately, schedules version updates for Monday 09:00 America/Los_Angeles, and caps routine open PRs. Unmatched majors remain individual updates. PR CI remains enabled; push CI runs only on main to remove duplicate push/PR jobs. CODEOWNERS remains intact. These changes take effect after the release-sync PR merges; other repositories still need equivalent configuration during their maintenance milestones.

References: [GitHub security-update configuration](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-security-updates), [reviewer configuration migration to CODEOWNERS](https://github.blog/changelog/2025-08-08-dependabot-reviewers-configuration-option-is-replaced-by-code-owners/). Security alerts were not suppressed, dismissed or delayed by the routine version-update schedule.

## Skills installer experiment

The official MIT-licensed `skills@1.5.25` installs all six OPF skills from GitHub on Windows with `skills add OpenPresentation/opf --skill '*' --agent codex --copy --yes`. The isolated project retained its existing AGENTS.md. Telemetry was disabled for the experiment. A simulated stale installation with a local skill customization was then updated using `skills update opf-inspect --project --yes`; that customization was overwritten. Therefore that updater is not presented as preserving local edits. A bundled CLI installer with preflight hash checks and recoverable updates is being implemented on `codex/skills-installer-20260908`; it is not published yet.

## Verified release-sync merge and installer candidate

Core PR #26 merged as `533b53cd7db3cf58e9ebf5fbd987741323ea2699`, with the tree identical to reviewed head `3d1c2bbc7c68a3f74f68232d1ae320a4f41ccdfd`. Coordinated [CI 34257731176](https://github.com/OpenPresentation/opf/actions/runs/34257731176), package [CI 34257731372](https://github.com/OpenPresentation/opf/actions/runs/34257731372) and Bugbot review all pass. Registry canvas browser coverage passes 34 checks in addition to pointer/keyboard styled-table interactions. Native comparison now binds package sources and generated PPTX/PNG SHA-256 hashes to the PowerPoint run, preventing stale evidence from being relabeled as a new package test.

CLI PR #27 prepares 0.5.0, without changing or republishing core 0.7.0. Full CLI and installer tests pass on Windows Node 20/24; isolated global installation and offline npx-style invocation install all six complete skills, preserve AGENTS.md, and need no symlink privileges. Tests cover idempotence, modified/unmanaged/additional files, unusual filenames, backup recovery, destination links, malformed markers, target selection and an existing installer lock. The original command suite passes 69 Windows checks; POSIX file modes are checked only on Unix and file-symlink rejection explicitly skips when this Windows account lacks that privilege. Junction checks still run. The six skills also pass three schema-valid examples and 17 inspection-helper executions.

CI at `9b5bc0198613a508485b817d1907fbd8ace1055d` passes Linux package/coordinated checks and Windows Node 20/24 CLI source/packed checks. Bugbot then identified valid linked-parent paths rejected by the installer. The fix resolves existing ancestors once and uses canonical paths thereafter, while still refusing a linked destination or installed skill. New linked-project install/status/update regressions pass locally, and macOS Node 20/24 CI was added. Latest-head CI and renewed review remain release gates.

## Website changelog/security candidate

Site PR #11 starts at `83ccb57` on `codex/published-ecosystem-adoption-20260908`. Its changelog records all nine published core versions, excludes unpublished 0.2.0, and shows all five current packages with exact UTC dates checked against npm. The site uses registry core 0.7.0 and a matching immutable documentation snapshot; showcase manifests identify the complete new registry set and check every downloadable file hash.

Targeted changes update Next.js/third-parties to 16.2.11, PostCSS, fast-uri, nanoid and the optional Sharp dependency. A fresh pnpm audit reports zero advisories and no muted entries; the default branch's 22 GitHub alerts are not yet closed because the PR remains unmerged. Weekly compatible groups and separate security groups preserve major-upgrade review and alert visibility.

Local Node 24 production build generates 603 pages. Existing tests cover 598 unique sitemap URLs; exported agent resources contain six skills and 585 raw files. Three actual Edge tests verify release links/anchors, mobile overflow containment, and home-page OPF/SVG/PPTX downloads by exact hash with OPF validation. Linux CI repeats build, registry checks, audit and Chromium browser tests. These checks do not establish author/import/edit/undo/export/reimport coverage across all applications. Deployment and the separate gallery/pptx.dev milestones remain pending.
