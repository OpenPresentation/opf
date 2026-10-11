# RR-20: complete graph serial staged qualification

This records local source and staged-package proof, not registry installability or native Windows acceptance. All five consumers ran serially after the corrected build and stage and exited zero against the common six-package staged graph. Individual consumers installed the subsets documented in their logs. Package versions, original dependency ranges and locks remain unchanged; the preliminary 0.19 metadata prerequisite is separate.

## Exact reviewed inputs

| Package | Reviewed source commit | Staged source commit |
| --- | --- | --- |
| Core and CLI | 3e8cc60e9aef14b9caa325d2dfbf0a59fcabdaa0 | d20895f2ba07a20fd870568ba424d6b66f679943 |
| Renderer | d57236802c8746fde430998bf2ddc9d16fe86712 | same |
| PPTX | 25ecc82dce8ac5018837924d5f559315fde5f9b0 | same |
| Editor | 569a83488fe0f833a97f08bba520513b276c38d5 | same |
| Gallery | e0a7eee2dfe996e680b34a907cabfe41905e6d99 | same |

Core's disposable staged checkout applies explicit tooling overlays: candidate-gallery CI 9d4bc7866914ea48a5fa217050045af44df46349, exact image-panel oracle a9cd23ba803e38e9bb860d8a3522c45c2e9c380a, then the two execution-path files of reviewed race repair 7a768be4a44def7079579f05b689ca3120265fc0. The overlay preserves the complete core's public catalog schema 2 assertions and CLI gallery dependency contract. Its explicit candidate-gallery configuration selects the gallery SHA above; the source manifest transparently declares requiresUnreleasedGallery 2.0.0. The staged manifest differences, exact source SHAs, tarball SHA256/size/file inventories and runtime byte inventories are retained in staged-graph.json. These candidate artifacts are not publishable registry artifacts.

## Reproduction and results

Node 24.21.0, pnpm 10.33.2 and npm 11.16.0 were used. Fresh original frozen-lock installations preceded source linking. Gallery built with its original registry dev dependencies first; candidate-gallery-build then linked gallery dev core/render before the initial core/CLI build, primed all selected source-engine aliases and ran strict one-core ecosystem linking before engine builds. Materialization used the actual gallery 2 candidate, cleaning old generated records. No concurrent process rebuilt this graph during the corrected sequence.

From the disposable core checkout, with CANDIDATE_GALLERY_REF=e0a7eee2dfe996e680b34a907cabfe41905e6d99:

```sh
node scripts/candidate-gallery-build.mjs
node packages/javascript/test/packed-install-smoke.mjs
node packages/cli/test/packed.mjs
node packages/cli/test/packed-files.mjs
node scripts/test-packed-ecosystem.mjs
node scripts/test-packed-browser.mjs
```

Every command exited zero. Build/stage includes actual gallery 75 tests, type/manifest/license checks and 28 previews. Packed smoke checked 101 entries and public schema contracts. Standalone exercised 95 CLI commands and global/npm-exec byte/resolver guards. Peers exercised 77 drawing checks, 16 installed image/font/no-fetch regressions and actual npm-exec SVG/PNG/PPTX/reimport. Installed contracts validated the complete six-package bytes and shared core/gallery resolution, plus TypeScript 5.9/7 NodeNext/Bundler consumers across 21 exports. Installed browser passed all eight suites, including trusted layout, block and table interactions. Complete logs are alongside this note.

All six corrected tarball SHA256 digests and sizes exactly match the earlier complete-graph stage. The supervisor independently confirmed these identities. Source qualification separately passed core 2306 tests, CLI 175 unit/95 command/77 drawing checks, renderer 115 suites with strict reviewed 807 examples and 498 templates unchanged, and editor 71 suites plus prepared region authoring browser controls. No golden or tolerance changed during this replay.

## Superseded failure and correction

The initial parallel smoke/standalone attempt failed ENOENT for core dist/catalog-refs-CSHevLn1.d.ts. Retained superseded-initial-enoent.log gives the actual stack. Packed smoke unconditionally built CLI after candidate artifact validation; CLI build rebuilt core and replaced dist while standalone's second validation read it. The dist replacement timestamp matched that build; the other agent confirmed no builds/access in the disposable graph. A serial control passed, but this did not repair the race.

The reviewed 604 correction validates candidateArtifacts before deciding to build. Candidate mode retains the qualified dist; stale source/runtime/artifact metadata fails before any build, and ordinary mode still builds. Its real six-tar fixture regression passed 3/3, mapped checks passed, and full source suite passed. The corrected serial logs here are authoritative; the failed attempt remains diagnostic evidence only.

## Boundaries

Real gallery 2 registry publication, actual ^2 dependency/lock adoption, genuine preliminary 0.19 metadata and breaking-gate acceptance, OS/engines CI and native Windows review remain separate gates. Historical native evidence remains historical. No version bump, release publication, baseline promotion or runtime source change was performed by this evidence follow-up. A later complete editor qualification must incorporate the supervisor's forthcoming macOS click-test-only correction and rerun its affected test; this record identifies the exact earlier editor source above.
