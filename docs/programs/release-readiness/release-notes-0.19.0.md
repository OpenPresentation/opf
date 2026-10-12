# DRAFT — NOT PUBLISHED: 0.19 release-readiness note

Updated 2026-10-12 for the owner (RR-20/T40). This is internal repository documentation, not a public support claim or completed release. The [execution checklist](0.19-execution.md) and [burndown](burndown.md) remain authoritative. Verified progress is 31/40 after the source lock, patch registry records, engine source, T19 normal Gallery 2 qualification and T27 v1-removal checkpoints landed; all six registry publications are verified: core/PPTX/editor/CLI 0.19.0, renderer 0.19.1 and Gallery 2.0.0; final hosted/merged consumer and site acceptance and fresh native acceptance remain pending.

## Historical gallery publication update — 2026-10-12 03:40 UTC

Gallery **2.0.0** is published at tag/gitHead `48169a9bb38559b8385e6791e7b5e76c0f5a8792` and independently verified, including all eight package files, SLSA provenance and npm signatures. T22/T28/T33 close: **24/40**. [Publication evidence](../../evidence/rr20-gallery2-published/README.md). Earlier statements below about Gallery publication/bootstrap pending describe superseded historical state. Core/render/PPTX/editor source merges are complete; the next action is authentic gallery2 registry adoption, one normal ecosystem roll over the adopted mains, then gated stable release preparation. Native Windows T24/T31, sites and v0.19 engine publication remain incomplete.

## What is intended to ship

OPF 0.19 replaces v1 placeholder layout records with adaptive v2 templates: explicit regions, grids, roles, flow, cards, bleed and pagination. The separately owned `@openpresentation/gallery` 2.0.0 supplies **28 intent layouts** and their canonical previews. Core no longer owns a catalog snapshot or exports the retired v1 layout helpers. The names `agenda`, `comparison`, `dashboard`, `faq`, `timeline` and `two-column` remain with new v2 semantics; they are not old-record or old-API aliases. Retired layout ids and APIs have **no aliases or migration tooling**. The [accepted design](0.19-layouts.md), including section 13 decisions, defines the final contract; its historical mapping table is documentation, not a compatibility API.

The renderer draws core region geometry and measures prepared text with HarfBuzz. PPTX exports native slide layouts and eligible placeholders, preserves supported furniture and import provenance, and maps foreign built-in layouts through the registered gallery. Automatic multi-series Pareto uses an all-series fallback; an explicitly unsupported native request refuses before output. The editor offers intent groups, live previews, empty/collapsed region targets, custom grids up to 12×12, accessible insertion/move controls and undo/redo. CLI output filenames use `{n}` and one zero-padding rule; stable engine readiness rejects prerelease versions that do not satisfy the declared range.

## What is already published

All six current artifacts are trusted-published and independently verified:

| Package | Version | Exact tag/gitHead evidence |
| --- | --- | --- |
| `@openpresentation/gallery` | 2.0.0 | `48169a9bb38559b8385e6791e7b5e76c0f5a8792`; [eight-file/provenance receipt](../../evidence/rr20-gallery2-published/README.md) |
| `@openpresentation/opf` | 0.19.0 | `b3e306d005d3cd0563964d541a834a8a50469536`; [independent registry receipt](../../evidence/rr20-core019-release-progress/README.md) |
| `@openpresentation/opf-render` | 0.19.1 | `7980fea3b0095377cb5a28c22a3a963312f941e7`; [independent registry receipt](../../evidence/rr20-render0191-release-progress/README.md) |
| `@openpresentation/opf-pptx` | 0.19.0 | `6bb89f1e69326532d063bacadd3bbd2acf54bd8c`; [independent registry receipt](../../evidence/rr20-pptx019-release-progress/README.md) |
| `@openpresentation/opf-editor` | 0.19.0 | `ac25857cca8ce776dd23b5ca58b38a06af9d963f`; [registry receipt](../../evidence/rr20-editor019-release-progress/README.md) |
| `@openpresentation/cli` | 0.19.0 | `9d72bc020e4b9287fe34f806e2ed4e9b4f213fd5`; [registry receipt](../../evidence/rr20-cli019-release-progress/README.md) |

CLI 0.19.0 is trusted-published and independently verified at tag/gitHead `9d72bc020e4b9287fe34f806e2ed4e9b4f213fd5`. Publisher 96437 and verifier 31875 exited 0; all ten checks pass, including provenance, three valid signatures with zero invalid/missing and latest. The original pre-tag range failure is retained; merged tooling repair #641 correctly accepts published renderer 0.19.1 within the unchanged ^0.19.0 contract. T38 closes; progress is 31/40. Final registry/site acceptance and native T24/T31 remain open.

The verified patch train remains historical evidence: core 0.18.4, renderer/PPTX/editor 0.18.2, CLI 0.18.1 and Gallery 1.0.0. [Patch receipts](../../evidence/rr20-patch-registry-adoption/actual-registry/README.md) remain unchanged. The untagged `0.19.0-next.0` preparation and burned renderer 0.19.0 tag never become successful stable artifacts. The release plan and standalone consumer now select the verified final graph, with direct Gallery2 and v2-only public APIs.

## Evidence and remaining acceptance

Renderer #215 is merged at `0e18fb532736248ff7c96a2a3c05cbf32a86b68c`, editor #156 at `030e68f5571d665f7a1c11c54adb3e9add723fc1`, and PPTX #240 at `4af1107102d93aafdba2c225486396273d121304`. Exact merged trees preserve the reviewed source carriers and superseded feature scopes; [source merge receipts](../../evidence/rr20-v019-source-merged/README.md). T23/T25 source criteria are complete. **T24 and T31 remain open: fresh native Windows acceptance is UNRUN.**

Core #592 is merged at `00022a4ed3d2576bd09c003aa38659ed5d014bc5`, exact reviewed e25 tree, after 33/33 checks and queue confirmation at 2026-10-12 03:00:37 UTC. T20/T21/T26 source criteria are complete; authentic gallery2 adoption and normal packed/installed gates are complete; Final hosted integrated and native gates remain open. [Earlier exact source qualification](../../evidence/rr20-patch-registry-adoption/v019-source-ci-integration/core-qualification.json) records its own historical graph. Local sibling qualification passed 117/132/72 test files, strict 807-example and 498-template goldens and 84 alignment cases. Reviewed visual migration and offline packet checks do not establish native PowerPoint rendering. Gallery2 publication is verified; authentic downstream adoption locks are merged through core #632, renderer #235, PPTX #251 and editor #162; normal roll #633 merged at `564e0d08` after qualification.

The minimal remaining sequence is:

1. All six registry publications are independently verified. Actual local installed-consumer acceptance passed. Preserve original failures, immutable tags and every release gate; do not raise compatible peer floors merely to hide an unpublished lower bound.
2. All six receipts now exist; the genuine final plan and standalone consumer lock are generated. Local NodeNext/Bundler/emitting consumers, registry library/CLI/browser/quickstart/fidelity and deterministic font-matrix gates passed. Review and merge final adoption, then regenerate and qualify the official source lock. Source tests and the four-package companion are not complete six-package registry acceptance.
3. All three final local adoptions are qualified: main `11c136b9`, dev `a99849cb`, gallery `73f74ae4`, using authentic registry locks and regenerated assets. [Local proofs](../../evidence/rr20-three-sites-final-local/README.md) bind full builds and 76/58/124 browser cases. Complete merged-default and production acceptance under the recorded owner boundaries; local acceptance does not establish deployment.
4. Run the bounded T31 Windows PowerPoint packet: Change Layout/Reset/New Slide, picture changes, title and list styles, tables, furniture, chart modes, controls, save/reimport and raster checks. The [final four-package companion](../../evidence/rr20-t31-final-registry-companion/README.md) proves all 46 archives and ZIP entries equal immutable packet06 and verifies 235 storage files/nine negative controls. Windows execution is UNRUN; fresh raster acceptance is NOT PROVEN. Five historical round-trip mismatches remain retained, not relabeled fixed.

## Issue reconciliation

Source/publication evidence supports closing core [#566](https://github.com/OpenPresentation/opf/issues/566) for its [Mc/six-script estimate correction](../../evidence/script-width-estimates/README.md), renderer [#213](https://github.com/OpenPresentation/opf-render/issues/213) for [HarfBuzz measurement](https://github.com/OpenPresentation/opf-render/blob/main/docs/evidence/harfbuzz-layout-measurement/README.md), and PPTX [#246](https://github.com/OpenPresentation/opf-pptx/issues/246) for its expressly allowed [preserve-or-reject contract](../../evidence/rr20-t31-final-registry-companion/README.md). The supervisor closed these three narrow issues at 16:28 UTC after matching their actual bodies and published evidence; [exact closure receipt](../../evidence/rr20-final-registry19-adoption/final-narrow-issue-closures.json). Keep estimate residuals explicit, native multi-series Pareto unsupported, and native T24/T31 open. The final registry companion retains every series/value through automatic/fallback tag-stripped reimport and refuses native multi-series output before an archive; a distinct authored single-series positive remains supported.

Core #507 includes final site/catalog adoption and stays broader than the completed layout source. Core #636 requires the next genuinely green nightly after registry adoption; green source or queue checks are insufficient. Core #88 public-site preservation/production acceptance, #87/#323 native work, #362 per-family final-host reconciliation and #298 GitHub App owner setup remain separately tracked. Existing queue-operation evidence does not by itself prove every owner ruleset requirement of #297. No new descope is introduced.

## Scope and owner actions

Native video and external-spreadsheet chart sources remain explicitly descoped by the recorded owner decisions in the [program README](README.md); this note adds no new deferrals. PPTX #246 is closed against the published preserve-or-reject evidence; all-series fallback and explicit native refusal do not close Windows acceptance.

Supervisor-controlled Windows/native access is required for T31. Agents do not install fonts or automate Office. Deployment/login/DNS actions for the three sites remain owner-controlled; local builds are not deployed acceptance. GitHub App/ruleset setup remains separately tracked where still applicable. No additional human approval is inferred for ordinary reversible source work or already authorized trusted package publication after gates pass.

Before changing this note to “published”, replace draft source statements with exact merged/released heads, verified registry provenance, final site evidence and native verdicts, and reconcile every remaining checklist item. Do not carry historical source or patch measurements forward as final v0.19 acceptance.
