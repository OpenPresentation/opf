# Windows release and adoption evidence — 2026-09-08

This supplements the portable handoff. GitHub branches remain the source of truth; local artifacts can be regenerated. The ecosystem goal remains active, including adoption by developers and agents.

## Host preflight

- GitHub CLI authentication and admin/write permissions verified for all seven repositories. A renderer dry-run push succeeds.
- npm authentication verified as `grimmmichaelj`. Existing release workflows use GitHub Actions trusted publication with provenance; no package was republished during preflight.
- Vercel CLI authentication verified after user login. The connector sees all three projects in the Data Advantage team, each connected to the expected GitHub repository.
- Node 20.20.2, Node 24.20.0, npm 11.16.0 and pnpm 10.33.2 are runnable through npm exec. The host's default Node is 26.4.0, so release tests explicitly select supported runtimes.
- Microsoft PowerPoint 16.0 native automation created a one-slide PPTX, exported a 1280×720 PNG, reopened the deck, edited a native text box and saved. The test deck was then opened in the visible PowerPoint UI and inspected. This is host capability evidence, not OPF export fidelity evidence.
- Edge automation reads the deployed site. File Explorer automation navigates to the generated evidence. User approved application access. OS sleep/hibernate settings were inspected, not changed.

## Renderer 0.5.0 candidate

Exact reviewed source: `OpenPresentation/opf-render@b47bba101ab78dc226d9ff848bb8622e3a0109e1`.

- GitHub CI run [34246424745](https://github.com/OpenPresentation/opf-render/actions/runs/34246424745) passes full Node 20/24 checks on this exact head.
- Full standalone tests pass locally on Windows with both supported runtimes, npm 11.16.0 and installed registry core 0.7.0. Each run passes the unchanged 126-deck/805-slide golden raster gate, smoke corpus, WebP, all JPEG orientations, font policies, rich/styled table checks and browser bundle construction. Syntax and package metadata checks pass; build leaves the tracked tree unchanged.
- A fresh consumer installs the new renderer tarball and exactly one registry core 0.7.0. Styled table regressions pass on Node 20/24 with `NODE_OPTIONS` cleared. Every installed `dist` file matches the tested build byte-for-byte.
- Tarball: 32,778 bytes; SHA-1 `3efdeb1903dd435b732a8e1ac2539240cea98812`; integrity `sha512-yOjy+5XR16I6GgGNCqU1ymX9z9CpNFCxSTYxPYNUG+eYfIOhQtExj5ZiHu8sfB7pXU0Qr+J5HqIoSJEnPnewlw==`. Packing a clean Git archive gives identical bytes.
- Review assessment: core applies vertical alignment to `cell.textBox.y` before rendering; independent scalar/rich baseline assertions verify that behavior. The implicit-neighbor border finding was valid and is fixed by explicit segment ownership, including zero-width and partial merge boundaries. Both earlier GitHub review threads are resolved. Renewed Bugbot check `102140710854` completed successfully at 16:17:32 UTC with no issues. PR #6 merged as `9f34d70002307fcb3795de638e7e4bf0605a33f8`; the merged tree matches the tested head. Tag `opf-render-v0.5.0` was pushed to that merge.

Publication, final registry integrity/provenance checks, downstream lockfiles and release-specific native PowerPoint tests remain pending at this checkpoint.

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

The OPF installer still requires implementation and clean-project/update tests. It must preserve user changes and unrelated agent configuration, install all six self-contained folders, work on Windows without symlink privileges, and expose a real command in CLI help and repository/site documentation. No implemented or published installer is claimed by this research checkpoint.
