# RR-78 candidate gallery staging boundary

This lane qualifies unpublished v2 source and an explicit local six-package tarball graph. It does not prove that the unchanged source manifests, which still request gallery 1, can install gallery 2 from npm. Normal CI with no candidate declaration keeps its original commands and published dependencies.

## Selection and trust

The core source must commit `.github/candidate-gallery.json` with exactly `{ "version": 1, "gallery": { "repository": "OpenPresentation/gallery", "sha": "<40 lowercase hex>", "version": "2.0.0" } }` and `opf.requiresUnreleasedGallery: "2.0.0"` in its runtime manifest. Both declarations are required; absence, mutable refs, mismatches and null declarations fail. PR and merge-queue jobs independently read the current originating PR's `Candidate-Gallery: OpenPresentation/gallery@<same SHA>` trailer using a read-only token. Manual qualification requires the same exact SHA input. Queue identity comes from the trusted event's queue ref, never an arbitrary caller-supplied PR. Scheduled and push runs with unresolved staging metadata fail instead of falling back to gallery 1.

Fresh gallery and engine checkouts have no persisted checkout credentials. Original lockfiles are installed before links or tarball staging. Gallery's own full tests, types, catalog verification, license gate and preview equality remain mandatory. Its build output and source checkout are checked for aliases, links, untracked source changes and immutable SHA identity.

## Original and staged metadata

Source versions, source manifests and lockfiles remain unchanged. Source-only links establish no packed or registry claim. The separate pack helper copies the original package's allowed files into disposable directories and records every original and staged manifest, byte digest, exact source SHA, npm file inventory and tarball digest. Staged normal graph dependencies use absolute `file:` references to those exact local tarballs; staged peer ranges identify the actual source versions. Development dependencies, lifecycle scripts and unpublished-source declarations are removed only from these disposable package manifests. The resulting artifacts are intentionally local and nonportable. No registry resolution or integrity is invented.

Installed contracts verify the actual tarball manifest and every member against staged and built source bytes, then verify installed bytes and a single shared gallery. Standalone global CLI and npm-exec tests use these same tarballs. A graph declaration without authorized staging cannot fall back to published dependencies. Required status aggregation rejects missing, skipped, cancelled or failed candidate/control jobs; both original named Windows and macOS installed-candidate checks execute for a candidate.

## Published source and current registry control

The control binds the reviewed plan's five package versions and verification SHAs to actual registry `gitHead` values and current stable versions. Gallery's independent version is also checked against the registry. Core and three engine sources come from their published verification refs. CLI has a separate core-repository checkout at its own published verification ref because CLI and core can publish from different commits.

Published source/harness contracts use their actual published definitions. Registry contracts install the same reviewed graph that the binding helper checked. When the published core source embeds a historical release plan, the control explicitly preserves its original bytes and digest under `artifacts/published-control`, stages the reviewed current plan into **only** `release-plan.json`, and proves afterward that no other tracked or untracked source changed. This is published source and harness with a reviewed metadata override, not a wholly unchanged checkout. CLI registry tests use the actual CLI release fixture; packed CLI source tests separately identify the CLI bundled in the selected core source. npm 11.16.0 is installed before original npm locked installs.

## Genuine release prerequisites and pending gates

The staging lane never changes or overrides `check:breaking`. V2 source merges require the separate genuine, untagged core `0.19.0-next.0` metadata preparation through the existing release tool after the initial 0.18 train clears. Do not publish that preliminary preparation.

Before this lane can qualify the current published control, a reviewed post-initial-train release-plan reconciliation must update `packages` and `verificationRefs` for core, renderer, PPTX, editor and CLI to their actual published versions and gitHeads. `independentPackages` must record the verified gallery 1.0.0 rather than its stale 0.0.1. `exampleRefs` must identify genuine compatible published example sources. This implementation does not invent those refs or alter the four-engine lock.

After merged source engines bootstrap gallery 2 and gallery 2 publishes, a separate reviewed registry-adoption PR must update real `^2` gallery ranges and actual registry locks and remove candidate configuration and declarations. Only then can final stable 0.19 preparation, tag and trusted publication proceed. Prep, tag, core npm publication and CLI publication explicitly reject unresolved gallery staging. Core 0.19 publication also requires an actual `^2` gallery dependency. The release-prep allowlist is unchanged: it cannot absorb arbitrary staging configuration removal.

Golden baselines, tolerances, source versions and normal registry gates are unchanged. Candidate source checks still need genuine breaking-version metadata, reviewed ecosystem selections and approved golden source/baseline refs. Pending registry metadata and source prerequisites are not a candidate failure waiver or a registry pass.

## Replay

```sh
node --test scripts/candidate-gallery.test.mjs scripts/candidate-gallery-pack.test.mjs scripts/candidate-gallery-results.test.mjs scripts/candidate-gallery-control.test.mjs scripts/candidate-gallery-workflow.test.mjs
pnpm check:changed
pnpm test
```

The pack regression creates six real Git-backed fixture packages, runs actual npm pack, installs the complete graph offline, verifies installed files, and runs standalone global and npm-exec CLI consumers. It proves rejection of source SHA, tarball, manifest and installed-byte tampering. Control tests prove the exact metadata-only boundary and rejection of source and preserved-original changes. Workflow tests enforce immutable browser/toolchain pins, the unchanged breaking command, active required OS checks, explicit supported-engine staging and publication guards. Full real v2 graph replay and the current published control must be reported independently of these fixture and default-source checks.

## Local implementation checkpoint

The helper freeze `7ca9d6d2b6aed0962ba71dde554b2a7b995d0cbe` passed the exact three-file Node 24 replay, 8/8 tests, and independent reviewer replay from an isolated git archive. No blocker was found within its helper contract; workflow fresh-build/source selection and full real runtime qualification remain separate obligations.

The working implementation's default-source replay on Node 24.21.0 / pnpm 10.33.2 passed `pnpm test`: 2,262 core Node tests, 169 CLI Node tests, 95 CLI command checks, 77 conversion checks and all 35 root checks. `pnpm check:changed` passed in 111.8 seconds after rebuilding the copied workspace. Its first attempt failed because the copied workspace lacked core `dist/index.js`; the complete build and subsequent replay resolved that local setup failure. Final workflow/aggregation/release-guard focused replay passed 37/37 tests, and all repository workflow/action YAML parsed. These are default-source and fixture results, **not** a full real v2 staged-graph run or a current registry-control pass.

Local logs: `/private/tmp/rr78-packed-control-freeze-tests.log`, `/private/tmp/rr78-wiring-full-test.log`, `/private/tmp/rr78-wiring-built-checkchanged.log`, and `/private/tmp/rr78-frozen-wiring-focused.log`. The unchanged breaking gate, real reviewed post-initial-train registry metadata, final reviewed source selections and genuine registry adoption remain explicit qualification prerequisites. The independently reviewed CLI peer-floor correction in core #598 was integrated at `e1b2c4efa57d3615186c0c2cb987171486dfdedd`; its 36 release-tool tests and the sequential default full suite passed. An overlapping full/check-changed attempt transiently lost declarations; the subsequent sequential full replay passed without changing tests.


## Actual graph replay boundary

The disposable `/private/tmp/rr78-v2-stage-replay` graph uses core `37d96a28aeba2be28a9d4bde5f1aca73264c1a03`, renderer `8c651e66ca995e790e0fd42d9822b34c4578be29`, PPTX `006e8a7df9c19e85b230a27f19794e5356cdac78`, editor `cef0bd18d53fe31df9a32cede3b1cec871f60f6d`, and gallery `e0a7eee2dfe996e680b34a907cabfe41905e6d99`, plus explicit staging implementation/configuration commits. Original source versions are retained. Genuine frozen pnpm/core and npm 11.16.0 sibling installs passed before source linking. The full gallery 75 tests, 28 preview comparisons, type/license/catalog checks, strict single-core graph, six real staged tarballs, and installed six-package consumer contracts passed. These results do not establish registry installability.

The original v2 core packed smoke fails at its retained `galleryManifest.opf.catalogSchema === 1` assertion. Gallery 2 declares schema 2. Disposable diagnostic commit `d3b2c211` changes only that expectation; the complete packed smoke then passes (101 tar entries, installed declarations and existing package contracts). This is a required v2-source follow-up, not acceptance of the unchanged source. Original failure: `/private/tmp/rr78-replay-core-packed.log`; corrected diagnostic: `/private/tmp/rr78-replay-core-packed-diagnostic.log`.

The standalone CLI test originally invoked its ordinary source build after graph staging, rebuilding core and producing TS2307 diagnostics for generated spec-file declarations. Candidate mode now verifies staged source/metadata/tarball/built bytes before consumption and again in the pack helper, while default local mode retains its build. A real rebuilt-dist regression verifies refusal alongside source-SHA and tarball tampering. The initial CLI diagnostic log path was inadvertently reused; the exact failure and command remain in the session tool output, and corrected results are identified separately rather than presented as an unchanged replay.

The corrected staged standalone CLI replay passed 95 command checks and isolated global/npm-exec installation (`/private/tmp/rr78-replay-cli-packed-diagnostic.log`). The complete unchanged installed-browser quarantine suite passed (`/private/tmp/rr78-replay-installed-browser.log`): rich input 14, plain text 12, readability 48, timeline 16, furniture 16, furniture fields 4 and JSON editor 8 workflows, plus packed controls, runtime-integrity guards and timeline acceptance/refusal cases.

The peer conversion replay exposed that the ordinary published peer gate parses normal dependency ranges as semver; staged dependencies intentionally name exact local tarballs. Candidate mode now validates exact installed core/peer manifests and every packed runtime byte against validated staged artifacts, requires the staged core version and shared core resolution, and continues the existing single-core and conversion tests. Default mode retains the original semver gate. Regression cases reject wrong core versions, substituted peer metadata, modified installed runtime and rebuilt distributables. The global prefix root is canonicalized to handle macOS's system `/var` alias; package leaves remain regular and unaliased. This is local artifact relationship validation, not published semver qualification.

Independent review of `e4bb050d` reproduced a missing global-gallery check: tampered installed gallery bytes still passed the narrower peer guard. The hardening extends that same-install guard to gallery and CLI, checks shared gallery resolution for every applicable package, and validates actual npm-exec cache installations independently. Real npm regressions prove refusal of tampered global gallery bytes and a nested second gallery. Standalone candidate dependency keys are explicitly derived from the validated source's core/gallery contract; the ordinary default remains core-only. The earlier replay retained the v2 branch's dependency-key assertion; final replays copy the same main-based packed helper bodies to remove that distinction.

## Final runtime checkpoint

Frozen implementation `d66912582cc5978a7b5d2bb6a7ef55d1a40f2484` passed `pnpm check:changed` (123.3 seconds), the complete sequential default `pnpm test`, independent actual-tarball guard review (4/4), and tampered-gallery/nested-gallery refusal tests. The disposable integrated graph is `2db7dd9d`; its source changes include the staging implementation plus the separately reviewed schema expectation and exact image-panel oracle. It is not the unchanged immutable v2 source.

Durable [staged-graph.json](replay/staged-graph.json) records all six original/staged manifests, source SHAs, packed file inventories and digests. [standalone.log](replay/standalone.log) proves 95 command checks and separately verified global/npm-exec installs. [peers.log](replay/peers.log) proves 77 drawing checks, 16 script-font/image/native-picture/zero-fetch checks, and guarded npm-exec PNG/PPTX/import. [installed-browser.log](replay/installed-browser.log) records the complete installed browser suite. Historical 0.14 SVG hashes are explicitly inapplicable to these newer installed engines; this existing notice is not a new candidate waiver and no baseline was changed.

Current published-control metadata is still awaiting the owner-managed initial release-train reconciliation. Genuine preliminary 0.19 source metadata, final approved engine selections, the two test-only source corrections, and later gallery-2 registry range/lock adoption remain separate prerequisites. No release or publication qualification is claimed.
