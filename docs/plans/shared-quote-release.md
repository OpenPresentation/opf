# Shared quote release gates

All five targets are published and independently verified from fresh npm installs on Node 20/24. `release-plan.json` and immutable CI refs now select core 0.8.0, CLI 0.6.0, renderer/PPTX 0.6.0 and editor 0.5.0. The complete source/tarball/registry/browser checkpoint is merged in core PR #51 after both runtime matrices and review passed. All three public sites have adopted this set and pass their deployed browser/asset checks. Existing versions must never be republished.

| Order | Published target | Reason |
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

PPTX [PR #14](https://github.com/OpenPresentation/opf-pptx/pull/14) merged as `898e3c27919a2488e1e3d384168d6b25aae4bd5c`, tree-identical to reviewed `268fcb523924c95b453acbe407d1b5359ea5f485`. Linux/Windows Node 20/24 CI `34422214063` and Bugbot pass; trusted publication `34422584331` published 0.6.0 at `2026-09-10T00:47:11.629Z`. Fresh npm installs pass on both runtimes: 19 immutable file matches, the complete 126-deck/805-slide model/export corpus, five browser suites, 66 signatures/17 attestations including test dependencies, and zero advisories. [Actual publication evidence](../evidence/pptx-060-publication-2026-09-09.json).

The Node 24 registry converter run also executes twelve wide/portrait Calibri fixtures in real PowerPoint `16.0.20326.20132` on Windows build `26200.9445`; the executable and reference font bytes are hashed. Accepted lines/font sizes, glyph containment, body/footer separation, twelve native edits/save/reopens and six schema-valid reimports pass. Contact sheets are byte-identical to the reviewed candidate sheets; actual registry export provenance is recorded separately. The registry/native bridge verifies every heading/body/footer in order with exact repeated-line counts on Node 20/24. Some first quote lines are classified as subtitles; quote structure/font scheme/readability policy are not reconstructed. Raster differences have no equivalence threshold. The raw Windows registry product string is legacy metadata, not an assertion that this is Windows 10.

Editor [PR #8](https://github.com/OpenPresentation/opf-editor/pull/8) merged as `dba5fe5e5580a4172c052132c4db5851d1decc4c`, tree-identical to reviewed `4d056532328bdfb765701880cb35ff87a0cc8829`. Node 20/24 CI `34424194308` and final Bugbot review pass. Trusted publication `34424531044` published 0.5.0 at `2026-09-10T01:14:08.133Z`. Fresh npm checks on both runtimes verify 32 immutable files, 67 signatures/18 attestations including test dependencies, nine model/component suites, and offline author/edit/paginate/export/reimport/undo with zero network writes. The no-op review finding is resolved using structural JSON comparison and redo-preservation coverage. [Actual editor publication evidence](../evidence/editor-050-publication-2026-09-09.json).

Reproduce these publication checks without rebuilding installed distributables:

```sh
node scripts/test-pptx-publication.mjs 0.6.0 898e3c27919a2488e1e3d384168d6b25aae4bd5c ../opf-pptx --native
node scripts/test-editor-publication.mjs 0.5.0 dba5fe5e5580a4172c052132c4db5851d1decc4c ../opf-editor
```

Omit `--native` outside Windows PowerPoint. The converter helper captures the exact native reference environment before and after execution. Node 20/24 registry installs execute the same immutable fixtures against shipped bytes. The full coordinator now enables shared quote API/geometry/source tests for registry core 0.8.0 and later, with the reviewed raster baseline pinned to published renderer 0.6.0. All seven combined installed-browser suites, trusted interactions, evidence guards, CLI and registry fidelity passed before the complete-plan checkpoint merged.

Those combined local checks now pass on Node 20.20.2 and 24.20.0 against core candidate `e635249` and all three published downstream merge commits in isolated worktrees. Each tarball/registry browser run executes seven suites, 230 assertions and eight trusted scenarios with no page errors or external requests. Four evidence-rejection guards pass. Twelve pinned fidelity suites include the 805-slide raster corpus and shared quote export tests. The five-package registry installations verify 64 signatures/15 attestations with zero advisories; exact native-tested exports and line-preserving reimports pass against each actual consumer. [Portable coordinated evidence](../evidence/shared-quote-coordinator-2026-09-09.json). The auxiliary quote geometry probe uses checkout core with actual registry font measurement; it remains separately labeled from all-registry API tests and native/raster fidelity.

Core [PR #51](https://github.com/OpenPresentation/opf/pull/51) merged as `c2f6aefd63d1c428ac35ea3da0d600e6c009b367`, tree-identical to reviewed `ce014f1`. Core CI `34426024145`, coordinated packages CI `34426024128` and Bugbot pass. These are actual remote checks of the complete published set, separate from the local candidate reports above.

Website [PR #21](https://github.com/Data-Advantage/openpresentation-site/pull/21) merged as `b0a7733cfa9a97fbb8bdb91f39bcd3075640005a` and is live in READY deployment `dpl_FXtMtDzuUddejNkmXv9R9SkAPMVg`. All six public Edge workflows pass, including the accurate UTC changelog, hash-matched downloads, offline validation, six skills and copied reference/LLM content. [Website evidence](../evidence/site-shared-quote-2026-09-09.json).

Gallery [PR #24](https://github.com/Data-Advantage/pptx-gallery/pull/24) merged as `1403916aea3f50c7d39c965ec7136da6e4b7af32` after CI `34427426307`, review and exact-preview tests passed. READY deployment `dpl_ENk7dmxQ22Czhq18hKZujmcJaN9s` passes all three public workflows and all eight exact bundle/font/license/example hashes. The initial CI timeout was repaired with a bounded initial-preview wait and failure trace capture; ordinary edit assertions remain unchanged.

pptx.dev [PR #29](https://github.com/Data-Advantage/pptx-dev/pull/29) merged as `482f769d4676b65ac16fe3fb4660aeaa03a77a44` after Linux/Windows CI `34427524816`, review and all eight exact-preview workflows passed. Its first public run passed seven workflows but reported a lazy Monaco worker-download error when Author switched offline. [PR #30](https://github.com/Data-Advantage/pptx-dev/pull/30) requires real schema diagnostics before that test goes offline and derives the canvas version marker from the installed editor package. It merged as `b9eefaac764c4a3ec009b17d363663f0c6cfe146`, tree-identical to reviewed `636da78c4b18f732530881cb09da3e5554bdcdd9`, after Linux/Windows CI `34428833533`, Bugbot and all eight exact-preview workflows passed. No page-error assertion was suppressed.

READY application production `dpl_F1LgvvbZ8QwcvCy8ZRnZ2WaunVDe` serves that merge and passes all eight public workflows (29.4s). All 33 public font faces/licenses match registry renderer 0.6.0; 55 served JavaScript fingerprints and installed-package toolkit proofs are recorded. The actual public Author PPTX SHA-256 `383512f28856d1b0d86ddd378d63b5a529e9928983743d9ebac72d99200c8ac4` equals the local/preview download edited, saved and reopened in real Windows PowerPoint, with a schema-valid reimport retaining its table and edited title. [Gallery/application deployment and native bridge evidence](../evidence/gallery-app-shared-quote-2026-09-09.json). Bundled JavaScript hashes identify served assets; they do not imply byte identity with unbundled npm files.

The [fresh seven-repository audit](../evidence/repository-adoption-audit-2026-09-09.json) finds no open PRs or security alerts. It preserves the earlier backlog dispositions and does not dismiss alerts. A website documentation-source pin follow-up should expose the corrected published-version headings from this reviewed documentation checkpoint; the accurate release changelog is already live.

No release should claim complete automatic repair, unified code/metric/timeline/chart internals, arbitrary quote/PPTX semantic round-trip, pixel-equivalent fonts or missing macOS/Keynote evidence. Those remain active goal work.
