# Continue the OPF ecosystem work

The coordinated working branch is `codex/opf-ecosystem-20260907` in these repositories:

| Checkout | Draft PR |
| --- | --- |
| opf | https://github.com/OpenPresentation/opf/pull/9 |
| opf-render | https://github.com/OpenPresentation/opf-render/pull/1 |
| opf-editor | https://github.com/OpenPresentation/opf-editor/pull/1 |
| opf-pptx | https://github.com/OpenPresentation/opf-pptx/pull/1 |
| pptx-gallery | https://github.com/Data-Advantage/pptx-gallery/pull/9 |
| openpresentation-site | https://github.com/Data-Advantage/openpresentation-site/pull/5 |

Clone the six branches into sibling directories. Use Node.js 24 and pnpm 10.33.2. From the parent directory:

```sh
gh repo clone OpenPresentation/opf -- --branch codex/opf-ecosystem-20260907
gh repo clone OpenPresentation/opf-render -- --branch codex/opf-ecosystem-20260907
gh repo clone OpenPresentation/opf-editor -- --branch codex/opf-ecosystem-20260907
gh repo clone OpenPresentation/opf-pptx -- --branch codex/opf-ecosystem-20260907
gh repo clone Data-Advantage/pptx-gallery -- --branch codex/opf-ecosystem-20260907
gh repo clone Data-Advantage/openpresentation-site -- --branch codex/opf-ecosystem-20260907
```

Install dependencies with `pnpm install --frozen-lockfile` in `opf`, `pptx-gallery` and `openpresentation-site`; use `npm ci` in the three library repositories. Then, from `opf`:

```sh
pnpm build
node scripts/link-ecosystem.mjs
pnpm test
pnpm test:skills
pnpm test:ecosystem
pnpm test:layout
pnpm test:lists
pnpm demo:editor
pnpm pack:ecosystem
pnpm test:packed-ecosystem
```

The link step builds the sibling libraries against the current core. Re-run it after reinstalling dependencies. Core 0.4.0 and renderer 0.1.0 are now published; editor/PPTX 0.1.0 publication is running. The source-link workflow remains useful for development. Generated review artifacts, installed dependencies and local server state are excluded from Git and rebuilt by these commands.

Start the editor with `python3 -m http.server 3102 --directory artifacts/editor` from `opf`. In another terminal start the gallery with `OPF_LOCAL_WORKSPACE=1 pnpm dev --port 3101` from `pptx-gallery`. From `openpresentation-site`, run `OPF_LOCAL_SOURCE=../opf pnpm sync:opf`, then `pnpm dev --port 3103`.

For public-site documentation built from a remote branch instead of the sibling checkout, use `OPF_REPO_REF=codex/opf-ecosystem-20260907 OPF_FORCE_SYNC=1 pnpm sync:opf`.

Production builds use `OPF_LOCAL_WORKSPACE=1 pnpm build` in `pptx-gallery` after linking, and `OPF_LOCAL_SOURCE=../opf pnpm build` in `openpresentation-site`. The gallery workspace flag lets Turbopack resolve the sibling package. Normal standalone gallery builds now use registry core 0.4.0. Normal site builds default to the source tag matching the installed core version; stale/local snapshots refresh automatically unless OPF_LOCAL_SOURCE explicitly selects local development.

## Current release checkpoint — September 8 UTC

PR #8 is incorporated into the pushed PR #9 branch through merge 10ed11c. Both test suites, structural package slimming, named schema definitions, catalog/index fixes, governance and Node 20/24 release gates are retained. PR #8 and the six coordinated draft PRs remain open; no merges or site deployments have occurred.

The user authorized pushes, PR updates and npm publication. Core 0.4.0 published with provenance from tag `opf-v0.4.0` at 6180096 (workflow 34182120112). Its changelog is now also on main and its GitHub release notes are accurate. Renderer 0.1.0 published with provenance from 207c32e (workflow 34182599445). Registry reads confirm both versions.

Editor 0.1.0 at c8da0a9 and PPTX 0.1.0 at 7a385fc passed clean registry installation, full package tests, metadata checks and packing locally, then Node 20/24 GitHub CI (34182749722 and 34182754394). Their release tags have been pushed; confirm workflow completion and registry availability before reporting publication. All three libraries now require core ^0.4.0; editor/PPTX have an optional renderer ^0.1.0 peer. PptxGenJS is pinned to 4.0.1; its image-size advisory remains unresolved, with a release gate verifying model and image embedding operations while parser loading is blocked.

The renderer raster gate now runs all 805 slides in 126 installed-core example decks. Missing or changed corpora fail. Candidate generation never replaces the baseline automatically. All 17 overview sheets were inspected, and a timeline endpoint clipping defect was fixed and checked at full-slide scale. The historical manifest is retained as history, not claimed to pass. This baseline does not establish complete visual correctness or native PowerPoint parity.

Gallery 3a12c7c passes 106 tests and its production build against registry core 0.4.0. Site 91e1580 fixes optional theme/catalog fields and aligns raw documentation with the installed release; its normal build passes, stale-snapshot refresh/reuse is verified, and the served site passes 583 raw-file hashes, six downloaded skills and seven guides. Prior source/local-tarball browser creation checks passed 40 each; fresh complete registry browser checks still need to run.

The coordinated public-package workflow pins the new library commits and runs source/package tests on Node 20/24. Its previous checkpoint passed; verify the updated workflow before closing release work. `release-plan.json` records core 0.4.0 and renderer/editor/PPTX/CLI 0.1.0. `pnpm test:registry-ecosystem` requires all five exact published versions and no local overrides; it remains incomplete until the CLI is published. Local preview tarballs are explicitly unpublished.

CLI 0.1.0 is bundled and passes its offline installed executable checks, but npm first publication needs local authentication. The user has been asked to run `npm login`; do not expose credentials or claim trusted-publisher configuration succeeded without evidence.

## Current scope and remaining work

The branch includes shared dynamic layout and pagination, loaded-font measurement and substitutes, rich text/lists, CSV/JSON import, an installable agent CLI, six portable skills, schema-driven properties, copy/import/galleries, canvas resizing/moving/creation/deletion, native PPTX improvements, and site/galleries integration. See [ecosystem quality](plans/ecosystem-quality.md) and [coverage](plans/spec-editor-coverage.md) for evidence and remaining fidelity gaps.

The broader goal is still active. Continuous rich typing, advanced table/media/preset fidelity, native PowerPoint raster comparison, coordinated public npm releases and CI integration remain work. Local preview tarballs are not evidence of registry publication.

Next: finish editor/PPTX publication, authenticate and publish the CLI, run the complete clean registry consumer and real-browser harnesses, regenerate reviewed gallery/site showcase bundles from the published set, update all existing PRs and advance the documented fidelity roadmap. Main currently has a changelog-only 0.4.0 correction; the complete ecosystem code remains on the coordinated PR branches.
