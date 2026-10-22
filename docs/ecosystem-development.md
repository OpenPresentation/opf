# Local development across the packages

Use Node 24 for the current source and published packages. All six packages live in this repository, one pnpm workspace, so there is nothing to link: `workspace:` dependencies resolve to the sibling directories, and a change that touches several packages is built and tested together.

```sh
pnpm install
pnpm build                 # every package, in dependency order
pnpm check:changed         # only what your branch changed (the check to run after each change)
pnpm test                  # everything; CI and the last run before a pull request
pnpm test:integration      # the private tests that need several packages at once
```

For a cheap checkout of one task (small blobless worktree, one shared pnpm store), use `node scripts/agent-worktree.mjs add <task>`.

CI is `verify` (`.github/workflows/ci.yml`): one required check that runs the packages your change affects, with their dependents at the contract tier (`test:contract` of each package); `nightly.yml` runs the Windows, macOS, Node 22 and 26 and packed-install legs and the weekly `slow-checks.yml` the published-package consumers. See [the CI design](programs/monorepo/ci-design.md). Add the label `full-ci` to a pull request that touches OS- or Node-version-specific code. There is no `Depends-On`, no lock to roll and no merge queue.

On Windows, keep the checkout under a short path (esbuild and Biome exceed MAX_PATH deeper) and see the notes in `AGENTS.md`. npm and pnpm orchestration in the scripts invokes the package manager's JavaScript entrypoint with the selected Node runtime instead of a batch shim through a shell, so paths with spaces and shell metacharacters stay literal arguments.

Execute the installed-package browser harnesses after their corresponding build:

```sh
pnpm test:packages
pnpm test:packed-browser
pnpm test:registry-ecosystem
pnpm test:packed-browser registry
```

The renderer package supplies the locked Playwright test dependency. Install Chromium with `pnpm --filter @openpresentation/opf-render exec playwright install --with-deps chromium` on Linux. Local Windows runs use Edge; `OPF_BROWSER_CHANNEL` can explicitly select another installed Playwright channel. CI uses the matching official Playwright container pinned by digest (one string in every workflow, `pnpm check:playwright-pin`), without installing OS packages during each run.

Each build writes `artifacts/editor/packed-browser-manifest.json` with the mode, installed versions, consumer build ID, dependency-lock hash and exact font/HTML/JavaScript hashes. The runner rejects a different mode, stale consumer or changed asset. It serves only the verified bytes on loopback and rejects external requests and network writes. Rebuild before switching between candidate and registry modes. Reports include the browser and Node versions and are saved by mode/runtime; failures retain a screenshot.

`node scripts/test-packed-browser-guards.mjs` verifies those four rejection cases against the current disposable harness and restores each changed fixture byte-for-byte. CI runs it after the registry browser checks.

Seven suites exercise canvas, rich text, lists, creation, layout, block moves and styled tables. Real browser input covers divider resizing/cancellation/concurrent changes, block dragging, merged-cell typing/redo/undo, plain-to-rich conversion and bold formatting, and empty-cell typing/undo. Conversion and formatting currently create separate undo transactions. Harness DOM assertions also cover renderer agreement and preservation. These checks do not replace full application export/reimport, public deployment checks or native PowerPoint raster evidence.

`pnpm test:ecosystem` validates the dynamic composition fixture, edits and undoes a composition, renders SVG/PNG/PDF, exports editable PPTX, checks OOXML text-box coordinates against the shared geometry, and imports the result back into schema-valid OPF. Artifacts are written to a temporary directory and its location is printed. For full gallery render coverage, run `pnpm test:gallery -- --render` (or invoke the script with `--render`): it validates all generated documents and can render them with the local SVG engine.

`pnpm test:pagination` verifies long-text and table pagination through SVG and editable PPTX, including exact source reconstruction, table row counts, and absence of extra exporter-created pages. It writes review artifacts under `artifacts/pagination/`.

`pnpm test:fonts` verifies actual-font measurement across editor, SVG, pagination, and PPTX. It also runs the offline font-switch matrix (`scripts/test-font-switch-ecosystem.mjs`, FF-09): a seeded pairwise covering array of 58 decks over the 14 gallery dimensions, plus fixed content-type, block-replacement, per-slide override, CJK-in-Latin, theme and language switches, each switched A to B and back to A. A value class is a group of catalog values that take the same path through the engines, derived from the catalogs in the script: font schemes by language family, then by licensing and preview policy (Office metric, Office visual-only, monospace, open Google); one language per script family in the array and every other catalog script in a language chain; every layout family; the eight content blocks; every distinct chart export path of the non-deprecated chart types; header/footer, background (theme, solid, gradient, pattern, image) and image treatments by kind; and the first and last record of the metadata dimensions. Dimensions that a deck can carry several times (font scheme states, layouts, blocks, charts, backgrounds, images) take several values per deck. Every state is exported and checked with the FF-08 typeface inventory, the catalog's literal theme fonts, a package structure check, a preview re-render and a re-import. It pins the office font pack with visual substitution and asserts every substitution; known engine limitations, including chart types the preview approximates or the exporter writes as bar charts, are named expected failures in the script that fail with a "limitation resolved" message when they go away. It runs no browser and no Office. Its report is written to `artifacts/font-switch-matrix/report.json`. The pairwise decks run on four worker threads with a fixed partition (deck i on worker i mod 4), so every host verifies each deck after the same earlier decks; `OPF_MATRIX_WORKERS=1` runs them in one thread, `OPF_MATRIX_WORKERS=n` on n workers. See [font fidelity](font-fidelity.md) for loading and embedding local fonts and for current native PowerPoint limits.

## Regenerating the example goldens (MR-31)

The raster golden of the examples corpus lives in one place, `packages/render/test/golden/` (a directory per baseline, one file per deck; `packages/render/test/golden/README.md` has the layout and `notes/` the review notes). The corpus is this repository's `examples/` and the renderer, core and the gallery are the checkout's own, so there is no lock selection, no core fixture and no sibling renderer to pin. A pull request that changes `examples/`, the core code that composes them, the gallery's records or the renderer's drawing moves slide hashes (or only the corpus digest, as FA-33 did: `notes/MR-31.md`); `pnpm test` and the `goldens` job of `ci.yml` fail until the baseline follows.

```sh
gh workflow run golden.yml --ref <branch>             # or add the `regenerate-goldens` label to the pull request
pnpm golden:update --local                           # a review candidate under packages/render/artifacts/golden/, never the baseline
```

- **The workflow.** `.github/workflows/golden.yml` has two jobs. `regenerate` (read-only token) runs `pnpm golden:update` on the branch in the pinned Playwright image: it builds core, the gallery and the renderer, renders every slide, rewrites only the per-deck files whose hashes differ and uploads the patch, `diff.json` and the review sheets of the changed slides. `push` (write token, no branch code) applies the patch only when it touches `packages/render/test/golden/`, pushes one commit and dispatches `ci.yml` on it (a push made with `GITHUB_TOKEN` starts no workflow). It refuses the default branch and a fork.
- **`pnpm golden:update`.** `scripts/golden-update.mjs`: without `--local` it refuses to rewrite the baseline anywhere but GitHub Actions on Linux in the Playwright image (the check the renderer's `golden-pinned-image.mjs` made); with `--local` it writes the review candidate only. The comparison is never changed (exact hashes, the baseline's own scale and font policy).
- **Review.** The commit is evidence, not an approval. Open the artifact, look at the changed slides, write the reason in `notes/<ID>.md` and in the pull request, then approve. A change that moves one slide for a reason other than the PR's intent is a bug in the PR.
- **Merge rhythm.** A merge conflict in deck files is resolved by merging `main`, taking either side, and regenerating. One pull request changes a layout and the golden of every package together (risk 23 of the monorepo plan).

## Trying the packages in a site checkout

The three sites (openpresentation.org, pptx.gallery, pptx.dev) live in their own repositories and install the published packages. To browse pptx.gallery with this checkout, keep `pptx-gallery` in the same parent directory as this repository, install its dependencies, build here, run `node scripts/link-ecosystem.mjs` (it replaces the installed `@openpresentation/*` packages in the site's `node_modules` with links to this checkout without saving paths in manifests or lockfiles; reinstalling replaces the links, so rerun it) and start the site with `OPF_LOCAL_WORKSPACE=1 pnpm dev`. Layout detail pages have an interactive composition example; the flag expands Turbopack's local root to include this checkout. Build before starting the site, and stop and restart it around clean rebuilds: removing a linked `dist` directory during compilation can leave Turbopack with stale missing-module errors.

After a release, the sites are bumped by `bump-sites.yml` (`release-process.md`); nothing here deploys or changes a site.

## Editor host bundle and font provenance

Contributor details moved from the [browser integration guide](live-editor.md); published-package users can start there.

For library development, build the tarballs of the six packages from this checkout and install them into a clean consumer:

```sh
pnpm build
pnpm pack:ecosystem
pnpm test:packed-ecosystem
```

The packed consumer installs actual tarballs without workspace aliases, exercises editing/SVG/PPTX, checks TypeScript declarations, and bundles a browser entry without Node shims. A public release is the one-click workflow in [the release process](release-process.md); it packs and smoke-tests the same way before it publishes.

The gallery host example also offers local PPTX file import with preview/diagnostics and editable PowerPoint download. It commits active canvas text before export, shares preview text measurements and applies imports as a single undoable change. Save OPF to preserve the original source; native PowerPoint positions, fonts and unsupported features can change during conversion. The browser E2E checks run offline after loading and inspect the downloaded native merged table, then reimport and undo/redo. Native edit/save/reopen is a separate targeted check, not a pixel-equivalence claim.

`pnpm prepare:gallery:registry` builds the host controls of the pptx.gallery site's vendored editor (`public/opf-editor`) while resolving libraries only from a fresh npm consumer; the manifest records both the example source hashes and the registry package integrities. It still reads the editor examples from a sibling `opf-editor` checkout at a pinned commit and the pinned set from `release-plan.json`; making it read `packages/editor/examples` at the release tag is open work (MR-52 follow-up, `docs/programs/monorepo/site-workflows/README.md`), and until then the site's bundle is refreshed by hand after a release.

Script fonts: when the pinned editor example loads faces from `./script-fonts/` and the pinned renderer has the script pack (0.10.0 and later), the registry build also writes `script-fonts.json` and lists its hash in `manifest.json`. The manifest is the reviewable half: every `@expo-google-fonts/noto-*` package, exact version, SPDX license, license-file hash and each face's SHA-256, taken from the published renderer. The faces are binaries (63 files, 66.9 MiB), so they are never committed to the gallery repository. The gallery build copies them from its own pinned npm dependencies into the untracked `public/opf-editor/script-fonts/` directory, verifying every hash, and writes the license notices beside them; nothing is fetched from a font CDN. See `scripts/gallery-script-fonts.mjs` and the gallery's `scripts/prepare-editor-script-fonts.mjs`.

Base fonts (FF-41): when the pinned editor example loads `base-fonts.json` (opf-editor 0.10.5: the example passes the faces as the renderer's `extraLazyFonts`, renderer 0.11.7 and later; 0.10.4's example used its own `examples/base-font-gate.js`), the registry build starts the editor with Roboto Regular alone in `fonts.json` (217 KB instead of 12.8 MB) and writes every other eager face (Roboto in six more styles, Roboto Mono, the Office substitutes) as a separate file named after its hash beside it, listed with its SHA-256 in `base-fonts.json` and in `manifest.json`; the editor fetches only the faces a document draws, verified, through its font gate (`scripts/gallery-base-fonts.mjs`). An older pinned example keeps every eager face in `fonts.json`. A default Roboto deck loads about 0.7 MB of fonts instead of 12.8 MB.

Lazy fonts: when the pinned editor example calls `ensureLazyFonts` and the pinned renderer vendors faces (Intos for the default Aptos scheme and the open families, renderer 0.11.0 and later), the registry build also writes `lazy-fonts.json` and lists its hash in `manifest.json`. It pins every vendored package (exact version, SPDX license, license-file and notice hashes) and each face SHA-256, taken from the published renderer. The faces are binaries, so they are not committed either: the gallery build copies them from its pinned `@openpresentation/opf-render` package (`fonts/<name>/`) into the untracked `public/opf-editor/fonts/` directory, verifying every hash, and the editor fetches only the families a document uses, same-origin. See `scripts/gallery-lazy-fonts.mjs` and the gallery's `scripts/prepare-editor-lazy-fonts.mjs`.

The browser bundle links `playground.js.LEGAL.txt`, included in the hashed resources. It contains bundled license notices and package license files, including the vendored PptxGenJS MIT license. For dependencies that publish only an explicit MIT declaration in their README, the build retains that declaration/attribution and the standard terms; omitted upstream notices use a version-specific source URL and verified supplement hash. License collection runs offline from the verified installation and committed supplement. Runtime JavaScript is not rewritten to normalize comment whitespace.
