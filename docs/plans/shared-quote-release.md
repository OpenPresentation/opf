# Shared quote release gates

This rollout is partially published: core 0.8.0, CLI 0.6.0 and renderer 0.6.0 are available and verified from npm. PPTX 0.6.0 and editor 0.5.0 remain release candidates. `release-plan.json` deliberately retains the last complete coordinated set (core 0.7.0, CLI 0.5.0, renderer 0.5.1, PPTX 0.5.2 and editor 0.4.0) until every successor is published and verified. Existing versions must never be republished.

| Order | Prepared target | Reason |
| --- | --- | --- |
| 1 | Core 0.8.0 | Shared accepted quote geometry, `grid-score-v2`, opt-in explanations and persisted pagination floors. The minor bump acknowledges stricter generated payload types. |
| 2 | CLI 0.6.0 | Bundles core 0.8.0 and updated provider-neutral skills; retains the supported offline installer. |
| 3 | Renderer 0.6.0 | Requires core 0.8.0 and consumes accepted quote parts; publishes the reviewed 41-entry raster change. |
| 4 | PPTX 0.6.0 | Requires core 0.8.0/renderer 0.6.0 and exports accepted parts as editable native lines. |
| 5 | Editor 0.5.0 | Requires the new core/renderer; commits one-page readability changes with undo and verifies the new converter in the example workflow. |

Core implementation PR #47 and installed-browser PR #48 are merged and fully checked. Original downstream integration checkpoints remain renderer `7f08cf9e6db1f5da58b96ca1625d9ae2614ea59b`, converter `829103b67fdc96ae977bbb05f3e94457620645cd` and editor `a143ee7b1c06b6cb7fbca482927661ca2b208226`. Release preparation uses the same portable branch name, `codex/shared-quote-release-20260909`, in all four repositories. Do not substitute local links for final candidate/registry evidence.

Core/CLI release preparation uses `codex/shared-quote-release-20260909`. Local release checks pass: 433 core tests plus preservation suites, 11 CLI tests and 69 command checks on Node 20/24; core/CLI typechecks; 519 core tarball entries and clean import checks; CLI global/npx installation; all six skills/17 helpers; 126 valid examples; spec and schema-removal gates; zero audited advisories. The complete four-repository coordinator and installed-browser runner pass on Node 24 with seven suites/230 assertions/eight trusted scenarios. CLI tarball integrity is `sha512-MacFNm+uwppdMbDUFJCU9wEeJy00jQM3cmUccAZk7u8jsp7CfIMSTERGF665XUnggLyk98XBAnFJ4tAprQco7A==`.

Core release [PR #49](https://github.com/OpenPresentation/opf/pull/49) merged as `4dc292fa93bee52320bafa3fd0f5b05a2dc0a283`, tree-identical to reviewed `95f9982036a01a52e080992abe4c4350c4b72354`. Core CI `34400722403`, coordinator `34400722391`, Windows/macOS CLI CI `34400722421` and Bugbot pass. Tags `opf-v0.8.0` and `cli-v0.6.0` point to that merge. Trusted publication workflows `34401446306` and `34402210003` succeed. Actual npm publication timestamps are respectively `2026-09-09T20:32:02.843Z` and `2026-09-09T20:39:35.937Z`.

Fresh Node 20/24 actual-registry installs verify both packages' integrity, signatures and provenance. Core checks all 519 shipped entries, public imports and thirteen quote/layout/pagination tests. CLI checks its exact 0.6.0/core 0.8.0 versions, standalone global installation, npx installation of all six skills, preserved AGENTS.md, repeat-install idempotence, and 69 command checks from the immutable release source. Actual registry integrities differ from local Windows preparation archives; retain their separate labels in [publication evidence](../evidence/core-cli-publication-2026-09-09.json).

The enhanced source verifier can select an independently published CLI before advancing the complete plan:

```sh
node packages/javascript/test/packed-install-smoke.mjs --registry
node packages/cli/test/packed.mjs --registry --version=0.6.0 --verification-ref=4dc292fa93bee52320bafa3fd0f5b05a2dc0a283
```

Use the current verification checkout containing these options. The core command uses that checkout's package manifest version; the explicit CLI version/ref pair is checked against the immutable source manifests. Omitting the CLI pair continues to verify the complete release plan. Both helpers also retain their original local-tarball modes. These commands do not publish anything or change the complete set.

Renderer [PR #10](https://github.com/OpenPresentation/opf-render/pull/10) merged as `7fe9905ad2d8a224efeef51b4a22d0aff0c413fe`, tree-identical to reviewed `95c1eb92a8b3be0c8e63917180dcb447aed0cfb8`. Node 20/24 CI `34420837605` and Bugbot pass; trusted publication `34421186727` succeeds. npm published renderer 0.6.0 at `2026-09-10T00:26:19.032Z`. Fresh npm installations pass on Node 20/24: all 16 shipped files match the immutable release commit, 44 installed dependency/test-tool signatures and twelve attestations verify, seven fidelity suites and all 805 raster baselines pass, and JPEG/loaded-font quote browser suites execute on Edge 152. [Actual renderer publication evidence](../evidence/renderer-060-publication-2026-09-09.json). Reproduce without rebuilding the installed renderer:

```sh
node scripts/test-renderer-publication.mjs 0.6.0 7fe9905ad2d8a224efeef51b4a22d0aff0c413fe ../opf-render
```

The optional third argument locates the fetched renderer checkout for immutable test/source reads. The verifier installs actual registry packages into its own contained temporary directory, rejects mismatched published bytes, runs the pinned fixtures, and removes only that directory. Browser evidence remains separate from native PowerPoint raster comparisons.

Converter preparation is `bb449f954699a3ce46ce9c2fc864875cd3894cf8`; editor preparation is `dc3d81d3a1de06c9923476d808328e22ffa625b2`. The converter lock now resolves published core 0.8.0/renderer 0.6.0; its full installed/browser/native gates are underway before opening the final PR. Editor's final lock still waits for converter publication. Prepared Linux workflows use the matching Playwright 1.63.0 image/digest; Windows converter CI remains native. Editor publication also requires its offline playground workflow.

For each downstream release, update declared dependencies and the lockfile against the newly published predecessor. Renew clean installed-candidate checks, Node 20/24 CI/review, real browser interactions, and the converter's Windows PowerPoint fixtures. Existing twelve-case native evidence is bound to source hashes; do not silently relabel it as verification of a different packaged runtime. Preserve font hashes/licenses and distinguish advance geometry, glyph containment, editability/save/reopen and raster differences.

After all five versions are verified, update `release-plan.json` and immutable source/registry CI refs. Enable the installed quote API/geometry checks for registry core 0.8.0 and later in `scripts/test-packed-ecosystem.mjs`; those checks currently run only in candidate mode. Advance the registry raster baseline only to the reviewed new renderer fixture. Repeat fresh installations, browser execution, signature/attestation checks and native comparisons on the actual published artifacts.

Finally adopt the published set in all three sites, regenerate bundled assets/fonts and accurate release dates, review/deploy, and execute public workflows against exact READY deployment commits and bundle hashes. Preserve the independent active website #20 work when choosing an adoption base. Current website production #19 has been reverified separately and still advertises the earlier published set.

No release should claim complete automatic repair, unified code/metric/timeline/chart internals, arbitrary quote/PPTX semantic round-trip, pixel-equivalent fonts or missing macOS/Keynote evidence. Those remain active goal work.
