# Shared quote release gates

This is a prepared, unpublished rollout. The actual registry set remains core 0.7.0, CLI 0.5.0, renderer 0.5.1, PPTX 0.5.2 and editor 0.4.0, as recorded in `release-plan.json`. Existing versions must never be republished.

| Order | Prepared target | Reason |
| --- | --- | --- |
| 1 | Core 0.8.0 | Shared accepted quote geometry, `grid-score-v2`, opt-in explanations and persisted pagination floors. The minor bump acknowledges stricter generated payload types. |
| 2 | CLI 0.6.0 | Bundles core 0.8.0 and updated provider-neutral skills; retains the supported offline installer. |
| 3 | Renderer 0.6.0 | Requires core 0.8.0 and consumes accepted quote parts; publishes the reviewed 41-entry raster change. |
| 4 | PPTX 0.6.0 | Requires core 0.8.0/renderer 0.6.0 and exports accepted parts as editable native lines. |
| 5 | Editor 0.5.0 | Requires the new core/renderer; commits one-page readability changes with undo and verifies the new converter in the example workflow. |

Core implementation PR #47 and installed-browser PR #48 are merged and fully checked. Downstream source branches remain pinned at renderer `7f08cf9e6db1f5da58b96ca1625d9ae2614ea59b`, converter `829103b67fdc96ae977bbb05f3e94457620645cd` and editor `a143ee7b1c06b6cb7fbca482927661ca2b208226`. Their ordinary npm CI still installs core 0.7.0, so dependency/lock updates must follow core publication. Do not substitute local links for final candidate/registry evidence.

Core/CLI release preparation uses `codex/shared-quote-release-20260909`. Local release checks pass: 433 core tests plus preservation suites, 11 CLI tests and 69 command checks on Node 20/24; core/CLI typechecks; 519 core tarball entries and clean import checks; CLI global/npx installation; all six skills/17 helpers; 126 valid examples; spec and schema-removal gates; zero audited advisories. The complete four-repository coordinator and installed-browser runner pass on Node 24 with seven suites/230 assertions/eight trusted scenarios. CLI tarball integrity is `sha512-MacFNm+uwppdMbDUFJCU9wEeJy00jQM3cmUccAZk7u8jsp7CfIMSTERGF665XUnggLyk98XBAnFJ4tAprQco7A==`.

Final remote CI/review remain gates. Merge the exact reviewed tree, tag `opf-v0.8.0`, wait for trusted publication and verify npm version/gitHead/integrity/provenance. Publish CLI 0.6.0 using `cli-v0.6.0`, as checked in `.github/workflows/cli-publish.yml`, after its independent packed/global/npx gates pass. No tag has been created during preparation.

For each downstream release, update declared dependencies and the lockfile against the newly published predecessor. Renew clean installed-candidate checks, Node 20/24 CI/review, real browser interactions, and the converter's Windows PowerPoint fixtures. Existing twelve-case native evidence is bound to source hashes; do not silently relabel it as verification of a different packaged runtime. Preserve font hashes/licenses and distinguish advance geometry, glyph containment, editability/save/reopen and raster differences.

After all five versions are verified, update `release-plan.json` and immutable source/registry CI refs. Enable the installed quote API/geometry checks for registry core 0.8.0 and later in `scripts/test-packed-ecosystem.mjs`; those checks currently run only in candidate mode. Advance the registry raster baseline only to the reviewed new renderer fixture. Repeat fresh installations, browser execution, signature/attestation checks and native comparisons on the actual published artifacts.

Finally adopt the published set in all three sites, regenerate bundled assets/fonts and accurate release dates, review/deploy, and execute public workflows against exact READY deployment commits and bundle hashes. Preserve the independent active website #20 work when choosing an adoption base. Current website production #19 has been reverified separately and still advertises the earlier published set.

No release should claim complete automatic repair, unified code/metric/timeline/chart internals, arbitrary quote/PPTX semantic round-trip, pixel-equivalent fonts or missing macOS/Keynote evidence. Those remain active goal work.
