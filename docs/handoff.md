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

The link step builds the sibling libraries against the current core. Re-run it after reinstalling dependencies. Core 0.4.0 and renderer/editor/PPTX/CLI 0.1.0 are now published. The source-link workflow remains useful for development. Generated review artifacts, installed dependencies and local server state are excluded from Git and rebuilt by these commands.

Start the editor with `python3 -m http.server 3102 --directory artifacts/editor` from `opf`. In another terminal start the gallery with `OPF_LOCAL_WORKSPACE=1 pnpm dev --port 3101` from `pptx-gallery`. From `openpresentation-site`, run `OPF_LOCAL_SOURCE=../opf pnpm sync:opf`, then `pnpm dev --port 3103`.

For public-site documentation built from a remote branch instead of the sibling checkout, use `OPF_REPO_REF=codex/opf-ecosystem-20260907 OPF_FORCE_SYNC=1 pnpm sync:opf`.

Production builds use `OPF_LOCAL_WORKSPACE=1 pnpm build` in `pptx-gallery` after linking, and `OPF_LOCAL_SOURCE=../opf pnpm build` in `openpresentation-site`. The gallery workspace flag lets Turbopack resolve the sibling package. Normal standalone gallery builds now use registry core 0.4.0. Normal site builds default to the source tag matching the installed core version; stale/local snapshots refresh automatically unless OPF_LOCAL_SOURCE explicitly selects local development.

## Current release checkpoint — September 8 UTC

PR #8 is incorporated into the pushed PR #9 branch through merge 10ed11c. Both test suites, structural package slimming, named schema definitions, catalog/index fixes, governance and Node 20/24 release gates are retained. The PRs remain open; no merges or site deployments have occurred.

All five planned versions are now published and resolve through ordinary npm installation:

| Package | Version | Source and publication |
| --- | --- | --- |
| @openpresentation/opf | 0.4.0 | Tag opf-v0.4.0 at 6180096; workflow 34182120112 with provenance |
| @openpresentation/opf-render | 0.1.0 | Tag opf-render-v0.1.0 at 207c32e; workflow 34182599445 with provenance |
| @openpresentation/opf-editor | 0.1.0 | Tag opf-editor-v0.1.0 at c8da0a9; retried workflow 34182810412 with provenance |
| @openpresentation/opf-pptx | 0.1.0 | Tag opf-pptx-v0.1.0 at 7a385fc; retried workflow 34182814991 with provenance |
| @openpresentation/cli | 0.1.0 | Reviewed standalone tarball from core 6180096, authenticated first publication; no provenance on this bootstrap release |

The user completed npm login and browser 2FA. Trusted publishers now exist for editor/PPTX release.yml and core cli-publish.yml. Initial permissions failures were resolved, and exact tagged jobs reran successfully. The CLI public tarball SHA-1 is 0308493d1d85ce18518b69882085419ec3817d73, matching the reviewed artifact. npm metadata took several minutes to expose the new package; it now installs normally. Do not republish an existing version.

`pnpm test:registry-ecosystem` passed for all five exact versions with no local overrides: model operations, fonts, SVG, editable PPTX, TypeScript, browser bundle, CLI create/validate/version. All 60 CLI command checks also pass using the registry-installed executable. `release-plan.json` pins immutable core/editor harness refs for the published release set so unreleased source tests cannot silently change release verification. `test:registry-libraries` is an additional four-library check, not a replacement for the complete gate. All six registry-installed browser suites pass 161 checks (34 canvas, 19 lists, 31 rich text, 19 layout, 18 blocks, 40 creation). Browser evidence lives in `artifacts/npm/registry-browser-verification.json`.

Source work newer than these releases: renderer 5472483 adds trace-only rich-line geometry; editor a4be429 adds native continuous rich typing with glyph-aligned caret/pointer selection, mixed-style preservation, draft undo/redo, cancellation, conflict protection and composition lifecycle handling. Source browser suites pass 176 checks (34 canvas, 19 lists, 46 rich text, 19 layout, 18 blocks, 40 creation). Actual keystrokes and a measured pointer hit were verified. These changes are marked Unreleased and need a later version/dependency update, release CI and published-consumer verification. Real OS IME, bidi/complex-script and cross-browser behavior remain open. Normal renderer output is unchanged and all 805 raster checks pass.

The renderer baseline covers 805 slides in 126 installed-core example decks; missing/changed corpora fail and updates create review candidates without replacing the baseline. All 17 overview sheets were inspected and timeline endpoint clipping was fixed. PptxGenJS remains pinned to 4.0.1; its unused image-size advisory remains unresolved, with model/image embedding tested while parser loading is blocked. Neither baseline nor model checks establish native PowerPoint fidelity.

Gallery 3a12c7c passes 106 tests and normal build against registry core 0.4.0. Site 91e1580 aligns optional catalog fields and raw documentation with the installed release; normal build, stale-snapshot refresh/reuse and 583 raw-file hashes, six skill downloads and seven guide pages pass. The homepage was visually checked. Gallery/site assets still need regeneration and review from the published toolchain.

Coordinated CI for released checkpoints passed on Node 20/24 (34182821903); current CI pins the newer source feature commits and must be verified again. Main has the core changelog correction; complete ecosystem code remains on the PR branches. The user has authorized pushes, PR updates and npm publication. Preserve unrelated gallery pnpm-workspace.yaml.

## Current scope and remaining work

The branch includes shared dynamic layout and pagination, loaded-font measurement and substitutes, rich text/lists, CSV/JSON import, an installable agent CLI, six portable skills, schema-driven properties, copy/import/galleries, canvas resizing/moving/creation/deletion, native PPTX improvements, and site/galleries integration. See [ecosystem quality](plans/ecosystem-quality.md) and [coverage](plans/spec-editor-coverage.md) for evidence and remaining fidelity gaps.

The broader goal is still active. Continuous rich typing, advanced table/media/preset fidelity, native PowerPoint raster comparison, coordinated public npm releases and CI integration remain work. Local preview tarballs are not evidence of registry publication.

Next: finish the installed browser verification record, regenerate and review gallery/site assets from the published set, review/finish the existing PRs, release the new rich typing work after CI, and advance the remaining fidelity roadmap. Main currently has a changelog-only 0.4.0 correction; the complete ecosystem code remains on the coordinated PR branches.
