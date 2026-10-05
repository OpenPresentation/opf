# Local ecosystem development

Use Node 24 for the current source and published packages. Keep `opf`, `opf-render`, `opf-pptx`, `opf-editor`, and `pptx-gallery` in the same parent directory. Install each repository's dependencies normally, then run these commands from `opf`:

```sh
pnpm build
node scripts/link-ecosystem.mjs
pnpm test:ecosystem
pnpm test:gallery
```

The link command replaces the installed `@openpresentation/opf` package in sibling `node_modules` with a link to this checkout and builds the toolkit packages. It also links the renderer into editor/converter consumers and the converter into the editor. It does not save machine-specific paths in package manifests or lockfiles. Reinstalling dependencies can replace the links; rerun the command afterwards. Use `--packages-only` to omit the gallery checkout.

On Windows, directory junctions work without granting file-symlink privileges. The linker refuses a package parent that resolves outside the sibling checkout's `node_modules`, and replaces existing links without following them into source. npm/pnpm orchestration invokes the package manager's JavaScript entrypoint with the selected Node runtime instead of running a batch shim through a shell. Paths with spaces and shell metacharacters remain literal arguments. The supported npm-installed and npm-exec package-manager layouts are discovered from `PATH` or the matching `npm_execpath`; a missing manager returns an explicit installation error.

The core packed-install smoke check also uses this Windows invocation. The following portability results record the historical September 9 integration, before the current Node 24 requirement; current acceptance is linked from the [compatibility matrix](compatibility-matrix.md). Node 20/24 local evidence on the `codex/windows-test-harness-20260909` branch: all 414 core tests plus composition/pagination/data/rich-text/list suites pass, and actual local tarballs install into fresh temporary projects and pass 519 packed-entry checks. New isolated tests execute real npm builds, replace existing junctions, retain literal arguments, and reject an external `node_modules` parent without modifying its package. The then-current Windows/macOS CI repeated the core packed installation on both runtimes. These are local unpublished tarballs, not republished core 0.7.0 or proof of native rendering fidelity.

After integrating reviewed layout PR #43, the combined source passes all 420 core tests on local Windows Node 24. Exact combined-source CI and review are recorded on PR #44.

Coordinated CI `34384776504` and `34385059710` caught an older isolated-link fixture copying the linker without its new helper, causing `ERR_MODULE_NOT_FOUND` before package tests ran. The fixture now copies both files, passes directly on Windows Node 20/24, and runs in the Windows/macOS matrix as well as coordinated CI. This failure was fixed rather than waived; renewed combined-source CI was required at that checkpoint.

The current published compatible set is core 0.12.0, CLI 0.10.0, renderer 0.12.0, PPTX 0.12.2 and editor 0.11.2 on Node 24. Clean registry installs include shared composition and styled table rows without sibling links. `release-plan.json` records exact versions and immutable verification sources; `pnpm test:registry-ecosystem` and `pnpm test:registry-fidelity` exercise those installed packages. Source links are for coordinated development.

Execute the installed-package browser harnesses after their corresponding build:

```sh
pnpm test:packages
pnpm test:packed-browser
pnpm test:registry-ecosystem
pnpm test:packed-browser registry
```

The renderer checkout supplies its locked Playwright test dependency. Install Chromium with `npm exec --prefix ../opf-render -- playwright install --with-deps chromium` on Linux. Local Windows runs use Edge; `OPF_BROWSER_CHANNEL` can explicitly select another installed Playwright channel. CI uses the matching official Playwright container pinned by digest, without installing OS packages during each run.

Each build writes `artifacts/editor/packed-browser-manifest.json` with the mode, installed versions, consumer build ID, dependency-lock hash and exact font/HTML/JavaScript hashes. The runner rejects a different mode, stale consumer or changed asset. It serves only the verified bytes on loopback and rejects external requests and network writes. Rebuild before switching between candidate and registry modes. Reports include the browser and Node versions and are saved by mode/runtime; failures retain a screenshot.

`node scripts/test-packed-browser-guards.mjs` verifies those four rejection cases against the current disposable harness and restores each changed fixture byte-for-byte. CI runs it after the registry browser checks.

Seven suites exercise canvas, rich text, lists, creation, layout, block moves and styled tables. Real browser input covers divider resizing/cancellation/concurrent changes, block dragging, merged-cell typing/redo/undo, plain-to-rich conversion and bold formatting, and empty-cell typing/undo. Conversion and formatting currently create separate undo transactions. Harness DOM assertions also cover renderer agreement and preservation. These checks do not replace full application export/reimport, public deployment checks or native PowerPoint raster evidence.

To browse the gallery with the linked package:

```sh
cd ../pptx-gallery
OPF_LOCAL_WORKSPACE=1 pnpm dev
```

Layout detail pages have an interactive composition example. The flag expands Turbopack's local root to include the sibling package; production builds use the gallery root.

`pnpm test:ecosystem` validates the dynamic composition fixture, edits and undoes a composition, renders SVG/PNG/PDF, exports editable PPTX, checks OOXML text-box coordinates against the shared geometry, and imports the result back into schema-valid OPF. Artifacts are written to a temporary directory and its location is printed.

For tests that should read current source without modifying installed packages, use Node's local loader after building OPF:

```sh
node --import ./scripts/register-local-opf.mjs ../opf-render/test/smoke.mjs
```

The loader redirects only `@openpresentation/opf` imports to this checkout. Ordinary dependencies still resolve from the consuming repository.

For full gallery render coverage, run `pnpm test:gallery -- --render` (or invoke the script with `--render`). The test validates all 854 generated documents and can render them with the local SVG engine.

Build OPF before starting a linked gallery. Stop and restart the gallery around clean OPF rebuilds; removing the linked `dist` directory during compilation can leave Turbopack with stale missing-module errors.

`pnpm test:pagination` verifies long-text and table pagination through SVG and editable PPTX, including exact source reconstruction, table row counts, and absence of extra exporter-created pages. It writes review artifacts under `artifacts/pagination/`.

`pnpm test:fonts` verifies actual-font measurement across editor, SVG, pagination, and PPTX. It also runs the offline font-switch matrix (`scripts/test-font-switch-ecosystem.mjs`, FF-09): a seeded pairwise covering array of 58 decks over the 14 gallery dimensions, plus fixed content-type, block-replacement, per-slide override, CJK-in-Latin, theme and language switches, each switched A to B and back to A. A value class is a group of catalog values that take the same path through the engines, derived from the catalogs in the script: font schemes by language family, then by licensing and preview policy (Office metric, Office visual-only, monospace, open Google); one language per script family in the array and every other catalog script in a language chain; every layout family; the eight content blocks; every distinct chart export path of the non-deprecated chart types; header/footer, background (theme, solid, gradient, pattern, image) and slide-image treatments by kind; and the first and last record of the metadata dimensions. Dimensions that a deck can carry several times (font scheme states, layouts, blocks, charts, backgrounds, images) take several values per deck. Every state is exported and checked with the FF-08 typeface inventory, the catalog's literal theme fonts, a package structure check, a preview re-render and a re-import. It pins the office font pack with visual substitution and asserts every substitution; known engine limitations, including chart types the preview approximates or the exporter writes as bar charts, are named expected failures in the script that fail with a "limitation resolved" message when they go away. It runs no browser and no Office. Its report is written to `artifacts/font-switch-matrix/report.json`. See [font fidelity](font-fidelity.md) for loading and embedding local fonts and for current native PowerPoint limits.

## Coordinated CI: the ecosystem lock

`ecosystem.lock.json` records the four OpenPresentation commits (`opf`, `opf-render`, `opf-pptx`, `opf-editor`) that passed the coordinated ecosystem checks together, and the golden baseline (`OPF_GOLDEN_BASELINE`) the locked renderer renders the core examples against. `scripts/ecosystem-lock.schema.json` is its schema and `node scripts/ecosystem-lock.mjs validate` checks it with the same rules.

- **Who writes it.** The SHAs are written by the roller, never by hand. A pull request that moves goldens may change `golden` (a reviewed golden decision, like the `OPF_GOLDEN_BASELINE` edits it replaces).
- **Guard.** `node scripts/ecosystem-lock.mjs guard` checks every locked SHA against its repository's `main` through the GitHub REST compare API (the equivalent of `git merge-base --is-ancestor <sha> main`, no clone), and flags a pull request that changes a locked SHA from a branch other than the roller's (`ecosystem-roll/*`). The `ecosystem-core` job runs it as a warning; the repository variable `ECOSYSTEM_LOCK_GUARD=blocking` (or `--blocking`) makes a finding fail the job.
- **Reading it.** CI never pins a sibling by hand. Each job runs the composite action `.github/actions/ecosystem-refs` with its own repository as `consumer`; the action reads `ecosystem.lock.json` from its own commit and returns the commit to check out for each repository (`opf`, `opf_render`, `opf_pptx`, `opf_editor`) and the golden baseline relative to the workspace (`golden`, for example `opf/scripts/fixtures/opf-examples-png.audience-ids.sha256.json`). Core's workflows use `./opf/.github/actions/ecosystem-refs` (the lock of the commit under test); the sibling repositories use `OpenPresentation/opf/.github/actions/ecosystem-refs@main` (the lock on core `main`). `export-golden: 'true'` exports `OPF_GOLDEN_BASELINE`; `golden-override` replaces the lock's golden with a workspace-relative baseline (a renderer pull request that moves pixels). Locally: `node scripts/ecosystem-lock.mjs resolve --consumer opf`.
- **Depends-On.** For a change that needs an unmerged pull request of another ecosystem repository, add a line to the pull request body, for example `Depends-On: OpenPresentation/opf#264` (several pull requests may be listed, comma-separated or on several lines; the `https://github.com/OpenPresentation/<repository>/pull/<number>` form works too). On `pull_request` events the action then checks that repository out at the named pull request instead of the lock: its test merge commit (`refs/pull/<n>/merge`) while it is open and mergeable, its head while it has conflicts, and its merge commit once it is merged (so a dependent pull request needs no edit after its dependency merges; re-run its checks). A closed, unmerged dependency fails the step; another organization's repository, a repository outside the four and a dependency on the pull request's own repository are reported and ignored; trailers inside fenced code blocks do not count. The body is read through the REST API, so after editing it re-run the checks. `push`, `merge_group` and scheduled runs always use the lock, so merge the dependency first. This replaces throwaway pin branches and repin pull requests. Check a body locally with `node scripts/ecosystem-lock.mjs depends-on --body-file body.md`. A renderer dependency that moves pixels also needs a golden: set `golden` in the lock (core) or `golden-override` (siblings) in the same pull request.
- **Roller.** `scripts/ecosystem-roll.mjs` (workflow "Ecosystem lock roller", `.github/workflows/ecosystem-roll.yml`) tries the four `main` branches together: it builds the candidate lock (the four `main` SHAs; the lock's golden, or opf-render main's `golden-override` when it sets one), force-moves `ecosystem-roll/main` to core `main`, commits the candidate there, and proposes it as a pull request only when the coordinated checks pass. It never writes `main`. `node scripts/ecosystem-roll.mjs plan --lock ecosystem.lock.json` shows the candidate without writing.
  - **Without the GitHub App (today).** The roller runs with `GITHUB_TOKEN`, whose pushes start no workflow and whose pull requests start no checks. So it dispatches `Coordinated public packages` and `OPF CI` on its branch (a `workflow_dispatch` made with `GITHUB_TOKEN` does start a run), waits for them, and proposes only a green candidate; those runs report the required checks on the branch head, which is the pull request head. The repository does not let GitHub Actions open pull requests ("Allow GitHub Actions to create and approve pull requests" is off), so a green roll ends with a compare link in the job summary and a maintainer opens the pull request. The workflow is dispatch-only: the hourly schedule stays commented out.
  - **With the App ([opf#298](https://github.com/OpenPresentation/opf/issues/298)).** Set the repository variable `ECOSYSTEM_APP_ID` and the secret `ECOSYSTEM_APP_PRIVATE_KEY`: the workflow's token step then runs and the roller uses the App token with no code change, opening the pull request itself (its normal checks decide). Then uncomment the schedule, and let each sibling send a `repository_dispatch` of type `ecosystem-main-updated` after a merge to `main`.
- **No hand pins.** `scripts/ecosystem-lock.test.mjs` fails when a core workflow checks out an OpenPresentation repository at a hand-written SHA or selects a hand-written `OPF_GOLDEN_BASELINE`. The lock was generated from the last hand pins of `.github/workflows/ecosystem-ci.yml`; see [the CI study](programs/release-readiness/ci-cd.md), section 3.

## Coordinated CI: the contract tier

`Coordinated public packages` (`.github/workflows/ecosystem-ci.yml`) runs the three siblings' suites in two depths ([the CI study](programs/release-readiness/ci-cd.md), section 3, consumer-driven contracts). `scripts/ecosystem-scope.mjs` (`tierForEvent`) decides the depth and every sibling shard passes it as `--tier` to `scripts/test-package-ecosystem.mjs` (`scripts/package-ecosystem-plan.mjs` lists the commands).

| Event | Depth | What a sibling runs |
|---|---|---|
| `pull_request` | `contract` | `npm run test:contract` (instead of `npm run test`) |
| `merge_group`, `push` to main, the nightly `schedule` (01:37 UTC), `workflow_dispatch` | `full` | `npm run test` |
| `pull_request` that changes `ecosystem.lock.json`, the workflow, the tiering scripts or the `ecosystem-refs` action, comes from an `ecosystem-roll/*` branch or has the label `ecosystem-full` | `full` | `npm run test` |

- **The contract suite.** Each sibling defines it in `test/suites.json`: `contractExclude` names the tests of `npm test` (`scripts/run-tests.mjs`) that the contract leaves out, each with a reason (tests of the package's own machinery that take no input from core). Every other test is in the contract, so a new test gates core pull requests until someone excludes it on purpose. `node scripts/run-tests.mjs --suite contract --list` prints it; the sibling's `check:runners` fails on an exclusion that names a missing file or has no reason. `test:contract` also keeps the cheap build steps that bundle core (the renderer's font licence check and browser bundle, the converter's browser bundle). Nothing else in a shard changes: typecheck, validate, `test:code`, `test:font-preparation`, `test:font-variants`, the browser steps and the golden gate (805 raster hashes, exact) run at both depths, and no tolerance moved.
- **Nothing is skipped by the tier.** Only a pull request can run `contract`; a docs-only or contract-only change never lowers a `merge_group`, `main` or nightly run (`scripts/ecosystem-scope.test.mjs`). A sibling whose commit has no `test:contract` script (a lock that predates RR-53) runs its full `npm run test` with a warning.
- **While the merge queue is off ([opf#297](https://github.com/OpenPresentation/opf/issues/297)).** A pull request merges after the contract tier, so the push to `main` and the nightly run are the only full-suite gates. A red one fails the workflow run and the job `main-status` keeps an issue labelled `main-red` open for the red period (a comment for each further red run, closed by the next green one); poll it with `gh api 'repos/OpenPresentation/opf/issues?labels=main-red&state=open'`. Fix forward or revert; do not merge further pull requests while it is open. Once the queue is enabled, the `merge_group` run is the full gate before main and `main-red` becomes the rare case. Add the label `ecosystem-full` to a pull request that you know reaches past the contract (the font catalogs, the script packs, the PDF path) to run the full suites on it.
- **Merge order.** A sibling pull request that adds or changes its contract merges first; the roller then moves the lock. Core's pull request tier reads the contract at the lock's commit, or at the pull request named by a `Depends-On:` line.
