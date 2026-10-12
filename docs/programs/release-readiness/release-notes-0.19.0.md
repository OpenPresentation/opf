# DRAFT — NOT PUBLISHED: 0.19 release-readiness note

Updated 2026-10-12 for the owner (RR-20/T40). This is internal repository documentation, not a public support claim or completed release. The [execution checklist](0.19-execution.md) and [burndown](burndown.md) remain authoritative. Verified progress is 18/40 after the source lock, patch registry records and renderer/editor source checkpoints landed; v0.19 publication, final site adoption and fresh native acceptance are still pending.

## What is intended to ship

OPF 0.19 replaces v1 placeholder layout records with adaptive v2 templates: explicit regions, grids, roles, flow, cards, bleed and pagination. The separately owned `@openpresentation/gallery` 2.0.0 supplies **28 intent layouts** and their canonical previews. Core no longer owns a catalog snapshot or exports the retired v1 layout helpers. The names `agenda`, `comparison`, `dashboard`, `faq`, `timeline` and `two-column` remain with new v2 semantics; they are not old-record or old-API aliases. Retired layout ids and APIs have **no aliases or migration tooling**. The [accepted design](0.19-layouts.md), including section 13 decisions, defines the final contract; its historical mapping table is documentation, not a compatibility API.

The renderer draws core region geometry and measures prepared text with HarfBuzz. PPTX exports native slide layouts and eligible placeholders, preserves supported furniture and import provenance, and maps foreign built-in layouts through the registered gallery. Automatic multi-series Pareto uses an all-series fallback; an explicitly unsupported native request refuses before output. The editor offers intent groups, live previews, empty/collapsed region targets, custom grids up to 12×12, accessible insertion/move controls and undo/redo. CLI output filenames use `{n}` and one zero-padding rule; stable engine readiness rejects prerelease versions that do not satisfy the declared range.

## What is already published

The independently verified patch train is core **0.18.4**, renderer/PPTX/editor **0.18.2**, CLI **0.18.1**, and gallery **1.0.0**. These are actual registry artifacts, not the v0.19 source candidates. [Registry adoption receipts](../../evidence/rr20-patch-registry-adoption/actual-registry/README.md) and the release-plan/compatibility matrix record their identities. Untagged core `0.19.0-next.0` metadata is genuine developmental preparation; it is not a stable publication or a waiver of release gates.

## Evidence and remaining acceptance

Renderer #215 is merged at `0e18fb532736248ff7c96a2a3c05cbf32a86b68c`, editor #156 at `030e68f5571d665f7a1c11c54adb3e9add723fc1`, and PPTX #240 at `4af1107102d93aafdba2c225486396273d121304`. Exact merged trees preserve the reviewed source carriers and superseded feature scopes; [source merge receipts](../../evidence/rr20-v019-source-merged/README.md). T23/T25 source criteria are complete. **T24 and T31 remain open: fresh native Windows acceptance is UNRUN.**

Core #592 remains pending at `e25d32f7d2465ef5dff2bd552a90832ab002a839` (supervisor snapshot: 26/30 checks at 2026-10-12 01:50:37 UTC, not a completed gate). Its reviewed font-fixture and registry-isolation repairs pass local contracts; that is not a core merge or publication. [Earlier exact source qualification](../../evidence/rr20-patch-registry-adoption/v019-source-ci-integration/core-qualification.json) records its own historical graph. Local sibling qualification passed 117/132/72 test files, strict 807-example and 498-template goldens and 84 alignment cases. Reviewed visual migration and offline packet checks do not establish native PowerPoint rendering. Gallery2 remains unpublished; authentic adoption locks remain incomplete.

The minimal remaining sequence is:

1. Complete core #592 exact-head source/published-control CI and merge it without losing accepted scopes. Renderer, PPTX and editor source merges are already verified; final integrated and release gates remain required.
2. Refresh gallery bootstrap core/renderer pins to the actual merged source commits, then qualify and publish gallery 2 through trusted publishing. The current e0 candidate authorization remains unchanged until that reviewed refresh.
3. Adopt real gallery2 dependency metadata and authentic registry locks; remove temporary candidate declarations in a separate reviewed adoption change before stable release preparation. Publish and independently verify the stable train in dependency order, with real 0.19 peer floors and all ordinary packed/release gates.
4. All three local source integrations are completed: main-site `f5a`, pptx.dev `689d9f5` and gallery-site `4c9adda`; dev/gallery preservation was independently approved. Adopt actual registry dependencies and locks, regenerate authoritative editor/schema/font/WASM/preview assets from the published graph, and pass full site build/browser checks. Local source passes and existing patch assets do not establish final registry adoption.
5. Run the bounded T31 Windows PowerPoint packet: Change Layout/Reset/New Slide, picture changes, title and list styles, tables, furniture, chart modes, controls, save/reimport and raster checks. Offline packet06 hashes, archives, round-trips and pixels are evidence of preparation only; no fresh native run is claimed.

## Scope and owner actions

Native video and external-spreadsheet chart sources remain explicitly descoped by the recorded owner decisions in the [program README](README.md); this note adds no new deferrals. Multi-series Pareto limitations remain tracked by [PPTX #246](https://github.com/OpenPresentation/opf-pptx/issues/246); fallback/refusal source fixes do not close native acceptance automatically.

Supervisor-controlled Windows/native access is required for T31. Agents do not install fonts or automate Office. Deployment/login/DNS actions for the three sites remain owner-controlled; local builds are not deployed acceptance. GitHub App/ruleset setup remains separately tracked where still applicable. No additional human approval is inferred for ordinary reversible source work or already authorized trusted package publication after gates pass.

Before changing this note to “published”, replace draft source statements with exact merged/released heads, verified registry provenance, final site evidence and native verdicts, and reconcile every remaining checklist item. Do not carry historical source or patch measurements forward as final v0.19 acceptance.
