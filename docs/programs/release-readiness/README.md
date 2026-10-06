# Program: release readiness (RR)

Status: **active** (opened 2026-10-01). Tracker: [burndown.md](burndown.md).
This is the single source of truth for the cross-repository program. Agents and
people resuming work start here, not from chat history or local scratch files.

## Goal

The owner's goal (2026-10-01), restated:

> Every OpenPresentation package, the CLI and the three sites are release-ready:
> shipped features complete and verified natively, known gaps closed or
> explicitly descoped with issues, CI green and cross-platform, and a
> release-readiness note for the owner.

Repositories in scope:

- core: [OpenPresentation/opf](https://github.com/OpenPresentation/opf) (spec,
  catalogs, `@openpresentation/opf`, the CLI, ecosystem CI, evidence)
- [opf-render](https://github.com/OpenPresentation/opf-render) (SVG/PDF preview)
- [opf-pptx](https://github.com/OpenPresentation/opf-pptx) (PPTX export and import)
- [opf-editor](https://github.com/OpenPresentation/opf-editor) (browser editor)
- the three sites: [pptx-gallery](https://github.com/Data-Advantage/pptx-gallery),
  [openpresentation-site](https://github.com/Data-Advantage/openpresentation-site)
  and [pptx-dev](https://github.com/Data-Advantage/pptx-dev)

The program follows the [font fidelity everywhere](../font-fidelity-everywhere/README.md)
program (FF), which is now in closure: its goal state (818 of 819 gallery configs
`works`, parity 739 perfect / 111 near / 0 mismatch of 850, measured on the
published core 0.11.4 train) stands, and its remaining open items are tracked
here as RR items so there is one list. FF items keep their IDs; RR items point
at them.

## Definition of done

The program is done when every burndown item is `done` or `descoped` with its
evidence or issue linked, and specifically:

1. **Shipped features are complete and verified natively.** Each feature an
   RR item names (SVG images, native header/footer, vector PDF, the editor
   switch operations, the preview polish items, the import details) works in the
   preview, the export and re-import, and a bounded native PowerPoint sample
   confirms the PowerPoint-facing ones. Native checks are run only by the
   supervisor (see Invariants).
2. **Known gaps are closed or descoped with issues.** Every gap is either fixed
   or recorded as `descoped` with a GitHub issue that states the current
   behaviour, what full support would need and where the evidence is (RR-18).
3. **CI is green and cross-platform.** Each repository's `main` is green on
   ubuntu and windows, and the core ecosystem matrix runs on ubuntu, windows
   and macos (RR-02, RR-04). No gate or tolerance is relaxed to get there,
   except the dated, owner-decided change recorded under Decisions (RR-15).
4. **Packages are published at the verified heads.** The final lockstep release
   train (core, then renderer and PPTX, then editor, plus the CLI) is published
   through the trusted-publishing workflows in
   [release-process.md](../../release-process.md), each registry artifact and
   its provenance verified, and the three sites adopt it (RR-01, RR-20).
5. **The owner has a release-readiness note** (FF-15, RR-20): what ships, what
   is descoped, what evidence backs each claim, and what a re-audit measured.

## Owner decisions of 2026-10-01

Recorded verbatim in intent; the owner can revise them. Each is binding for the
items that cite it.

- **Native PowerPoint header/footer is WANTED.** Slide-number, date and footer
  content export as native PowerPoint header/footer constructs (`p:hf`, the
  slide-number, date and footer placeholders, Insert > Header & Footer). This
  reverses the earlier deferral ("native `p:hf` stays deferred" in the font
  program and roadmap issue
  [opf#87](https://github.com/OpenPresentation/opf/issues/87), which asked for
  it as the required end state). Tracked as RR-11.
- **PowerPoint video is DESCOPED.** Native `p:video` export and preview
  playback are not part of this release. A future-work issue records it (RR-18).
- **Charts from external spreadsheets are DESCOPED.** `ChartDataSource`
  (`src`, `sheet`, `range`, `columns`) and a host `dataResolver` hook are not
  part of this release. A future-work issue records it (RR-18).
- **SVG images are IN SCOPE.** Native SVG pictures in the PPTX export (with a
  raster fallback) and import (RR-10).
- **AI reconstruction of third-party PPTX belongs in pptx.dev.** opf-pptx and
  the other libraries stay deterministic. `fromPptx` only exposes the raw
  layout and style signals of a third-party deck (RR-13); the "Understand this
  deck" reconstruction with review is a pptx.dev feature (RR-14).
- **opf-render#24 gate widened to 0.15 px.** The variable-font metric gate for
  browser-versus-Fontkit widths moves from 0.1 px to 0.15 px
  ([opf-render#24](https://github.com/OpenPresentation/opf-render/issues/24),
  RR-15). This is the only gate or tolerance change in the program, it is an
  owner decision, and the native 0.02 pt geometry tolerance is unchanged.

## Owner decisions of 2026-10-01, scope 2

Later the same day the owner approved a wider scope. Binding for the items that
cite it; the owner can revise it.

- **In scope (RR-21 to RR-35).** Editor slide management, autosave and restore,
  vector PDF, PNG and SVG downloads, a data grid, deck-wide find and replace,
  image crop and focal point, a mobile layout, the core conversions module, CLI
  render/export/import, a player and `<opf-deck>` web component, `opf audit`,
  Markdown and outline conversion, diff/merge/format and one JSON-patch module,
  templates and variables (beyond colours: text, number, date, image or asset),
  numbered lists, footnotes, citations and captions, and chart options. The
  libraries stay deterministic: templates fill from data the caller supplies,
  with no network or model calls.
- **Declined (no issue).** A VS Code extension, and a language set per slide or
  per run.
- **Deferred with issues, out of v1.** Navigation and motion (transitions,
  builds and reveals, links between slides,
  [opf#250](https://github.com/OpenPresentation/opf/issues/250)) and rich
  speaker notes ([opf#251](https://github.com/OpenPresentation/opf/issues/251);
  plain-text notes stay).
- **The `world` region map chart is parked** (out of v1, handled later;
  [opf-pptx#133](https://github.com/OpenPresentation/opf-pptx/issues/133)). It
  stays on the clustered column fallback with a `chart-data-adapted`
  diagnostic, and the in-scope gallery denominator for the `works` goal is 818.
  This settles open decision 1 below.

## Open decisions

Questions only the owner can settle. Each is also recorded in the font burndown row it blocks (RR-03).

Settled 2026-10-01 (owner): the `world` region map (FF-58) is parked for post-v1, tracked as [opf-pptx#133](https://github.com/OpenPresentation/opf-pptx/issues/133) (label `parked`). The works denominator is 818 and FF-58 is done. RR-20 does not ask the question again.

1. **FF-37, the catalog drift check in CI.** Settled 2026-10-02 (owner): no token. The direction is inverted: core is the source of truth and `@openpresentation/opf` ships `spec/catalogs`, so pptx-gallery's CI verifies its published `public/<kind>/` files against the catalogs of the core version in its lockfile ([pptx-gallery#84](https://github.com/Data-Advantage/pptx-gallery/pull/84), `pnpm check:core-catalog`). The token-gated `catalog-snapshot` job is removed from opf-ci.yml; the offline manifest hash check stays in `pnpm test`. No secret is needed and nothing is left for the owner.
2. **Gaps with no RR item.** Settled in part, 2026-10-05 (owner): saving a copy into a fresh directory is allowed for the FF-13 font-embed attempt and for the save-dependent rows of opf#87; the originals are never saved over. Results ([opf#355](https://github.com/OpenPresentation/opf/pull/355) FF-13: pass on the corrected audit; [opf#356](https://github.com/OpenPresentation/opf/pull/356) opf#87: furniture and provenance pass after a PowerPoint save, PNG, JPEG and cropped pictures pass, the SVG picture fails because PowerPoint keeps the `asvg:svgBlip` and drops the `r:embed` PNG fallback, which is PowerPoint's own form for an SVG it saves). Still open for the owner: accept the lost raster fallback after a PowerPoint save, or track it as a post-v1 issue. The native tab-position row (0.0227 pt against the unchanged 0.02 pt gate) needs no save and is now [opf#366](https://github.com/OpenPresentation/opf/issues/366). The status comments on [opf#87](https://github.com/OpenPresentation/opf/issues/87#issuecomment-5963559477) and [opf#88](https://github.com/OpenPresentation/opf/issues/88#issuecomment-5963559659) also list opf#88's source-preservation and destructive-preset-history box, which no RR item covers (file it as a post-v1 issue, or open an RR item?). Every deferred Windows PowerPoint run is recorded in [opf#323](https://github.com/OpenPresentation/opf/issues/323): sections 1 to 6 ran on 2026-10-05; what remains there is the re-run of the 8 (now 24) size-adjusted families once the `sizeAdjust` rows land ([opf#361](https://github.com/OpenPresentation/opf/issues/361)).
3. **Didot reroute?** Didot is routed to Playfair Display, which is the 24th of 25 bundled faces by width (20.2 / 17.9 / 24.1 percent narrower, 0 of 250 identical line breaks). The closest by metrics are Intos Serif (0.9 percent) and PT Serif (1.9 percent), neither a Didone. Question for the owner (2026-10-03): keep the Didone look-alike, or route to a metric-closer face? A design call ([opf#322](https://github.com/OpenPresentation/opf/pull/322)).
4. **RR-14 owner steps.** The implementation is merged behind default-off flags ([pptx-dev#83](https://github.com/Data-Advantage/pptx-dev/pull/83)); only the owner can finish the launch. Steps (updated 2026-10-05, pptx.dev now runs on a Cloudflare Worker): set `UNDERSTAND_DECK_ENABLED` and `UNDERSTAND_DECK_ALLOWLIST` (Clerk user ids) as Worker variables and `NEXT_PUBLIC_UNDERSTAND_DECK` as a build variable (rebuild and redeploy), not in Vercel; `AI_GATEWAY_API_KEY` is already set as a Worker secret (2026-10-05); confirm the AI Gateway $50 per month hard spend limit; rotate the old gateway key if the removed `.env.example` value was real. pptx.dev runs on the Clerk development instance and a dev Convex deployment for now (owner decision 2026-10-05, no production users yet), so the allowlist holds development-instance Clerk user ids until production Clerk and Convex exist. Then the supervisor runs the live eval once. The privacy copy (D5) is needed only before widening beyond the allowlist.
5. **RR-49: descope the Vercel parts? Settled 2026-10-06 (owner): "we don't need Vercel only checks".** openpresentation.org, pptx.gallery and pptx.dev all serve production from Cloudflare Workers (cut over 2026-10-05); the CF-04 deploy workflows deploy on every push to the default branch and production is checked after each deploy. RR-49 is `descoped`: the Vercel-only checks (the Preview smoke workflows gated on `PREVIEW_SMOKE_ENABLED` and `VERCEL_AUTOMATION_BYPASS_SECRET`, the gallery's `deployment_status` Production trigger and bypass fetch preload) are removed in [openpresentation-site#83](https://github.com/Data-Advantage/openpresentation-site/pull/83), [pptx-gallery#103](https://github.com/Data-Advantage/pptx-gallery/pull/103) and [pptx-dev#107](https://github.com/Data-Advantage/pptx-dev/pull/107). Vercel still builds as a warm rollback, so `vercel.json`, the Ignored Build Step and its test stay until the Vercel projects are removed (CF-08). [opf#299](https://github.com/OpenPresentation/opf/issues/299) (the bypass secret) can be closed. Nothing is left for the owner here; the secrets the CF-04 workflows need are tracked in the Cloudflare program.
6. **FF-46 follow-ups: size adjustments, host fixtures, measurement default (2026-10-06).** The documented-visual run measured all 46 script, visual and code-table families natively: 22 pass, 24 findings ([opf#357](https://github.com/OpenPresentation/opf/pull/357), [opf#382](https://github.com/OpenPresentation/opf/pull/382)). The Windows supervisor decided on 2026-10-05 (vetoable) to use the existing RR-38 mechanism for the findings: a `sizeAdjust` row (and `lineAscent` where the line height differs) per family in `font-policy.json`, measured on the RR-38 basis and cross-checked against the native ratio, never relabelling a family `metric` and never changing a gate ([opf#361](https://github.com/OpenPresentation/opf/issues/361); proposed factors, for example Traditional Arabic 0.79, DilleniaUPC 0.64, Angsana New 0.70, Sakkal Majalla 0.80, Malgun Gothic 1.06, Nirmala UI 1.07, MS Gothic 1.04, plus 16 more families). Moving the 22 passing families to `documented-visual` also needs the family's own fixture in every host (node, browser, editor, gallery editor; [opf#362](https://github.com/OpenPresentation/opf/issues/362)); the gate is not relaxed. And the registry's text measurement may become the default for composition when fonts are prepared ([opf#364](https://github.com/OpenPresentation/opf/issues/364)). Questions for the owner: commission the `sizeAdjust` rows and the per-family host fixtures (one work package each), or record the findings as wide look-alikes; and whether `toPptx` and the preview use the registry measurement by default.
7. **RR-54 release note and merge timing (2026-10-06).** RR-54 (chart and table data) changes behaviour for users who upgrade to 0.13: in non-strict documents a chart text cell such as `"12%"`, `"$5"` or `"Q1"` becomes a gap with a `chart-value-not-numeric` warning (the exporter used to strip the text and write 12 or 5); a two-column scatter plots column 2 against the row numbers; an unknown dataset or mapping column fails validation. The schema change is additive. The supervisor merges [opf#376](https://github.com/OpenPresentation/opf/pull/376), [opf-render#127](https://github.com/OpenPresentation/opf-render/pull/127), [opf-pptx#171](https://github.com/OpenPresentation/opf-pptx/pull/171) and [opf-editor#92](https://github.com/OpenPresentation/opf-editor/pull/92) after the CLI 0.10.1 tag; the 0.13 minor train (core 0.13.0, CLI 0.11.0, opf-render 0.13.0, opf-pptx 0.13.0 with pptxgenjs-plus, per-slide script fonts and RR-54, opf-editor 0.12.0) publishes them. Question for the owner: review the three behaviour changes in the release note before the train, or veto one.


## Decision log (supervisor, vetoable)

Decisions the supervisor took on the owner's behalf. Each is one dated line; the owner can veto any of them. Entries
dated 2026-10-02 for earlier work are the date they were recorded in [HANDOFF.md](HANDOFF.md).

- 2026-10-02: The `arabic` language default stays Arabic Typesetting, fixed in the preview with `sizeAdjust` 0.64 and `lineAscent` 0.70 / 0.78 (RR-38), not replaced.
- 2026-10-02: CJK and Thai line breaking (dictionary word breaking, kinsoku) is descoped from the first release (RR-39, [opf#278](https://github.com/OpenPresentation/opf/issues/278)).
- 2026-10-02: Single-series bar and column charts export in one colour (RR-36).
- 2026-10-02: The editor's image crop is baked into a new asset (RR-25).
- 2026-10-02: The timeline workflow test allows Windows Chromium's whole-pixel ink rounding ([opf#276](https://github.com/OpenPresentation/opf/pull/276)); no other tolerance changed.
- 2026-10-02: The core `packages` job timeout is 40 minutes.
- 2026-10-02: Core `main` requires the per-PR cross-platform checks (ruleset 24382980: `packages`, `Installed candidates` on windows and macos, `Verify OPF packages`); owner-approved.
- 2026-10-02: The FF-37 catalog drift check runs in pptx-gallery against the published `@openpresentation/opf`; no secret is needed.
- 2026-10-02: pptx-dev uses Claude Sonnet 5.5 (`anthropic/claude-sonnet-5-5`, owner decision) with budget guards (10 reconstructions per hour, 60 slides / 20 MB, 16k output tokens) and a privacy notice (RR-14).
- 2026-10-02: pptx-dev's Windows CI leg runs on master, weekly and on Windows-sensitive paths or the `windows` label (RR-40).
- 2026-10-02: FF-05: the theme `ea` is never empty, run-level `ea` / `cs` are not written, `endParaRPr` is kept.
- 2026-10-02: RR-42: native evidence for every gallery value.
- 2026-10-02: Windows PowerPoint native runs are deferred while the supervisor works on the Mac mini (owner): FF-13, the FF-46 Windows measurements and any re-run of the FF-12 sample wait for the Windows host.
- 2026-10-02: Mac and Keynote compatibility checks run on the Mac mini; Keynote is opened read-only, never saved, and only by the supervisor (owner request).
- 2026-10-02: RR-14 stays in-progress until the owner provides the gateway key, decides budget and ZDR and turns the flags on.
- 2026-10-02: opf-pptx 0.12.2 is released as a patch that carries [opf-pptx#154](https://github.com/OpenPresentation/opf-pptx/pull/154) only.
- 2026-10-02: pptx-gallery's no-public-status guard is narrowed from `/\bpipeline:/` to `/(?<!\bsales )\bpipeline:/`, because core's business-review narrative beat says "sales pipeline:" verbatim in `/api/narratives.json`; bare "pipeline:" labels stay forbidden (a gate change, a narrow false-positive fix; supervisor-accepted).
- 2026-10-02: The 38 gallery narrative pages show only core-provided fields; no presentation text is authored for them (supervisor-accepted).
- 2026-10-02: The "Aspect ratios" coming-soon cell is removed from the gallery home grid, for a layout reason; the slide-size page is still tracked by [opf#293](https://github.com/OpenPresentation/opf/issues/293) (supervisor-accepted).
- 2026-10-02: The gallery recommendation fields (density, colours, layouts, slide counts, principles, industries) were authored for the `candidates` and `engineering-team` audiences (supervisor-accepted).
- 2026-10-02: Open question for the owner: the existing `x-gallery.status` "reconciled" field in pptx.gallery's public catalog index files may count as progress-style metadata under the no-public-status invariant.
- 2026-10-03: [opf#292](https://github.com/OpenPresentation/opf/issues/292): the 385 gallery-only layouts stay a subset by design (packed core +54,245 B, but about +382 KB minified / +19 KB gzip in every renderer, editor and exporter browser bundle that never reads layout records); revisit after the per-kind catalogs split ([opf#318](https://github.com/OpenPresentation/opf/issues/318)). The four legacy font pairings are published gallery-first with the app "Google Slides" ([opf#317](https://github.com/OpenPresentation/opf/issues/317)) ([opf#310](https://github.com/OpenPresentation/opf/pull/310); supervisor-accepted).
- 2026-10-03: Editor switches for slide size and purpose ([opf-editor#80](https://github.com/OpenPresentation/opf-editor/pull/80)): both are in `SWITCH_DIMENSIONS` (the tracker reads it); slide size is deck-only and a custom inches size is replaced by the preset; purposes accept free text; the selects sit in the Look and Audience-and-story groups (supervisor-accepted).
- 2026-10-03: RR-49 (Vercel gating, [pptx-gallery#89](https://github.com/Data-Advantage/pptx-gallery/pull/89), [openpresentation-site#68](https://github.com/Data-Advantage/openpresentation-site/pull/68), [pptx-dev#81](https://github.com/Data-Advantage/pptx-dev/pull/81)): the skip rule is an allowlist of ignorable paths (`.github/`, `docs/`, `.agents/`, `.claude/`, `.interface-design/`, root `*.md`, `LICENSE`), not all `*.md`; the gallery's production smoke falls back to the public domain without the secret; the gallery's push-to-main rerun of PR checks is kept; no production workflow is added for the site and pptx-dev (supervisor-accepted).
- 2026-10-03: RR-47 ([openpresentation-site#67](https://github.com/Data-Advantage/openpresentation-site/pull/67)): `json-options.spec.ts:149` got a test-side wait rather than a product change (supervisor-accepted).
- 2026-10-03: [opf#309](https://github.com/OpenPresentation/opf/pull/309): the plural audience ids are deprecated core-first (no `removal` field; validation warns, never errors); the renderer golden digest is handled by a core copy of the baseline selected via `OPF_GOLDEN_BASELINE`; the audience `sales` differs from `sales-team` in technicalFluency and decisionPower (supervisor-accepted).
- 2026-10-03: RR-52 is done on the evidence of [opf-render#115](https://github.com/OpenPresentation/opf-render/pull/115) although it depended on RR-50 (supervisor decision).
- 2026-10-03: RR-50 is done although the GitHub App is not installed (supervisor decision): the criterion "no hand-edited pins and no pin off `main`" is met by `ecosystem.lock.json`, the roller (dispatch only) and the `Depends-On:` trailers ([opf#327](https://github.com/OpenPresentation/opf/pull/327) to [opf#330](https://github.com/OpenPresentation/opf/pull/330), [opf#333](https://github.com/OpenPresentation/opf/pull/333)); the App-dependent automation (roller schedule, `ECOSYSTEM_LOCK_GUARD=blocking`) is follow-up for the owner ([opf#298](https://github.com/OpenPresentation/opf/issues/298)). The siblings test against the lock (the last green set), not raw `main`; adopting the lock moved the sibling pins to core's set; opf-render's linked golden now comes from the lock (core's RR-41 fixture).
- 2026-10-03: RR-51 ([opf#334](https://github.com/OpenPresentation/opf/pull/334), [opf#339](https://github.com/OpenPresentation/opf/pull/339); supervisor-accepted): the tag step gates on the release commit's checks; geometry lockstep is flagged by the script, not decided by it; the README prose it lists is for review; verify retries only a 404 attestation bundle and a not-yet-installable version.
- 2026-10-03: RR-53 (supervisor decision): no PR-tier reduction before the merge queue exists; the core contract tier [opf#335](https://github.com/OpenPresentation/opf/pull/335) stays parked (measured -11 to -15% runner time, no wall-clock gain, `ecosystem-core` is the critical path).
- 2026-10-03: Core 0.12.1 (plural-audience deprecation, additive catalog data) is released without a geometry change (805 raster hashes unchanged in [opf#309](https://github.com/OpenPresentation/opf/pull/309)); the siblings keep their `^0.12.0` floors and are not re-released (supervisor decision).
- 2026-10-03: The pptx.gallery plural audience URLs answer 307, not 308, to the singular pages ([pptx-gallery#94](https://github.com/Data-Advantage/pptx-gallery/pull/94); supervisor-accepted).
- 2026-10-03: RR-19: the 19 kept worktrees (uncommitted or unpushed work) and the `archive-*`, `shared-furniture-*` and `claude/*` branches are left for the owner; 26 no-PR `codex/rr-*` pin branches were deleted after RR-50 (supervisor decision).
- 2026-10-02 (owner decision, not vetoable): RR-14 launches as an allowlist beta first; ZDR is not required ("remove any ZDR requirements"); the current per-user caps are kept; the Vercel AI Gateway has a $50 per month hard spend limit.
- 2026-10-02: RR-14 details ([pptx-dev#83](https://github.com/Data-Advantage/pptx-dev/pull/83); supervisor-accepted): the allowlist holds Clerk user ids, not emails; the capability endpoint answers 404 while the feature is off; one gateway refusal skips the model for the rest of that request.
- 2026-10-02: RR-20 re-audit: audit B's script-slot check accepts the exported theme `ea` / `cs` slot when runs name no face (follows opf-pptx 0.12.1, FF-05); the unchanged-check reading (793 of 819) is preserved as evidence (supervisor-accepted; [opf#314](https://github.com/OpenPresentation/opf/pull/314)).
- 2026-10-03: RR-47 quarantine ([opf#320](https://github.com/OpenPresentation/opf/pull/320), [opf-render#116](https://github.com/OpenPresentation/opf-render/pull/116), [opf-pptx#157](https://github.com/OpenPresentation/opf-pptx/pull/157)): the quarantine id granularity is the suite test id; the supervisor approval is documented in `test/QUARANTINE.md`, not enforced by CODEOWNERS (supervisor-accepted).
- 2026-10-03: Didot reached documented-visual through the qualification-report path (a re-run of `qualify-latin-fonts.mjs` on the Mac), not through `overrides.acceptance` ([opf#322](https://github.com/OpenPresentation/opf/pull/322); supervisor-accepted).
- 2026-10-03: RR-04 ([opf#315](https://github.com/OpenPresentation/opf/pull/315)): the installed-parity job uses a committed gzip of pptx-gallery's gen-snippets output (850 docs, reproduced as a checkout run, 850 of 850), because the opf workflow token cannot read the private gallery repo; a read-only token would let it check out the gallery instead (owner action; supervisor-accepted).
- 2026-10-03: RR-45 ([opf#316](https://github.com/OpenPresentation/opf/pull/316)): the `packages` aggregator requires every shard to succeed; RR-48 ([opf#324](https://github.com/OpenPresentation/opf/pull/324) and the three sibling PRs): the merge queue (`merge_group`) always runs the full ecosystem (supervisor-accepted).
- 2026-10-03: The braces audit ignore (a single advisory, GHSA-vfj7-8cjw-p6xm, tooling-only paths) is accepted in [pptx-dev#84](https://github.com/Data-Advantage/pptx-dev/pull/84) and [pptx-gallery#92](https://github.com/Data-Advantage/pptx-gallery/pull/92) until a patched braces is published ([pptx-dev#85](https://github.com/Data-Advantage/pptx-dev/issues/85)); pptx-gallery allows the `sharp` build in its pnpm `allowBuilds` ([pptx-gallery#93](https://github.com/Data-Advantage/pptx-gallery/pull/93)) (supervisor-accepted).
- 2026-10-03: RR-47 ([openpresentation-site#72](https://github.com/Data-Advantage/openpresentation-site/pull/72)): the fixed test was accepted at 7 of 7 green CI runs instead of a strict 5-run streak, because one run failed on an unrelated flake ([openpresentation-site#73](https://github.com/Data-Advantage/openpresentation-site/issues/73), unreproduced 0 of 180 locally) (supervisor-accepted).
- 2026-10-03: RR-46 ([opf#331](https://github.com/OpenPresentation/opf/pull/331) and the three sibling PRs): tracker staleness is a warning on pull requests and the merge queue and strict on `main`; the sibling test order is by name; the changelog is grouped by type (supervisor-accepted).
- 2026-10-02: Tracker refresh (RR-00, tracker agent): RR-05 and FF-12 are not closed on the CJK run alone, because it records a `Presentation.Fonts` failure on `lang-ja-meiryo`; FF-41 to FF-45 stay at review or in-progress in the font burndown, because the per-family acceptance is open; FF-27 stays in review for lack of a native renumber observation.
- 2026-10-05 (Windows supervisor, vetoable): RR-05 and FF-12 are accepted as met on the 12-deck sample although the comparison script's stricter rule (every used family listed) reports 1 FAIL: PowerPoint's `Presentation.Fonts` leaves out a theme-only East Asian or complex-script family when the deck's Latin family differs, and the theme slots and every run read it back; the FF-12 criterion is about names outside the chosen families, and there are none. The raw script output is kept as measured ([opf#352](https://github.com/OpenPresentation/opf/pull/352)). Recorded by the RR-00 refresh of 2026-10-06.
- 2026-10-05 (owner, not vetoable): saving a copy into a fresh directory is allowed for FF-13 and the save-dependent rows of opf#87; originals are never saved over ([opf#355](https://github.com/OpenPresentation/opf/pull/355), [opf#356](https://github.com/OpenPresentation/opf/pull/356)).
- 2026-10-06 (supervisor refresh, vetoable): FF-13 is done on the corrected audit: audit v1 failed because it compared the EOT `FamilyName` raw and Windows writes it null-terminated; audit v2 strips trailing NULs and nothing else, and both audits are committed ([opf#355](https://github.com/OpenPresentation/opf/pull/355)).
- 2026-10-06 (supervisor refresh, vetoable): FF-27 and RR-03 are closed on the native renumber and update observation ([opf#354](https://github.com/OpenPresentation/opf/pull/354)). The gap that no gallery snippet exercises a `datetime*` field is treated as a coverage observation outside the criterion text (the criterion's gallery clause, the snippet options, is met by pptx-gallery#47; the `datetime*` export is covered by offline tests and by the native run), not as an open criterion.
- 2026-10-05 (Windows supervisor, vetoable): the slide-size presets stay as OPF defines them (`a4` and `letter` are the paper sizes, `16:9` is PowerPoint's Widescreen); PowerPoint's A4 Paper (10.83 x 7.5 in), Letter Paper (10 x 7.5) and On-screen Show 16:9 (10 x 5.625) differ and are documented in [opf#365](https://github.com/OpenPresentation/opf/issues/365), not matched ([opf#354](https://github.com/OpenPresentation/opf/pull/354)).
- 2026-10-05 (Windows supervisor, vetoable): FF-46 findings use the RR-38 `sizeAdjust` mechanism and the passing proprietary families wait for their own host fixtures; the `documented-visual` gate is not relaxed ([opf#361](https://github.com/OpenPresentation/opf/issues/361), [opf#362](https://github.com/OpenPresentation/opf/issues/362)).
- 2026-10-06 (supervisor refresh, vetoable): RR-54 (chart and table data) is added as RR item 54 with status review; its four pull requests merge after the CLI 0.10.1 tag and ship in the 0.13 minor train, with the three behaviour changes named in the release note (Open decisions 7).
- 2026-10-06 (supervisor refresh, vetoable): RR-49 stays in-progress (the owner has not decided the descope); the Cloudflare program items are tracked in its own burndown, with CF-07 done on a live check (apex `/llms.txt` answers 308 to `www`, `/schema/opf/v1` keeps CORS) and CF-04 to CF-06 waiting for the Actions secrets.
- 2026-10-06 (owner, not vetoable): Vercel-only checks are not needed. RR-49 is descoped: the Preview smoke workflows, their Playwright configs and bypass setups, and the gallery's `deployment_status` Production trigger are removed from the three site repositories; production checks run after each Cloudflare deploy. Supervisor corollary (vetoable): the Ignored Build Step, its test and `vercel.json` stay while Vercel still builds as a warm rollback, because `vercel.json` depends on the script; they go with the Vercel projects (CF-08). [opf#299](https://github.com/OpenPresentation/opf/issues/299) can be closed.

## Invariants

- **No public support or progress status on any site.** No badges, legends,
  panels, API fields or `llms.txt` lines about measured, pending, parity or
  release-readiness status on pptx.gallery, openpresentation.org or pptx.dev
  (owner decision 2026-09-30). All tracking stays in this repository.
- **Fonts are bundled or self-hosted, with permissive licenses only** (OFL-1.1,
  Apache-2.0, MIT, UFL-1.0). Never hotlink a font CDN; licensed (proprietary)
  fonts are never bundled or embedded. See
  [Font files: bundling and licenses](../font-fidelity-everywhere/font-licensing.md#font-files-bundling-and-licenses).
  `pnpm check:font-hotlinks` enforces the hotlink half.
- **The libraries are deterministic.** No network or model calls in core,
  opf-render, opf-pptx, opf-editor or the CLI. AI-assisted reconstruction lives
  in pptx.dev.
- **Lockstep core floors when geometry moves.** A change to composition,
  geometry or the preview/export contract raises the minimum core version in
  the dependent packages in the same release train, so a package never runs on
  a core older than the geometry it expects.
- **Native PowerPoint checks run only by the supervisor.** Agents never open
  Office, never automate PowerPoint, never register fonts for it and never
  retry a native attempt in place. They prepare decks and a manifest and ask
  the supervisor, who records read-only evidence under `docs/evidence/`.
- **Never relax a gate or tolerance** to make an item pass (native 0.02 pt,
  renderer 0.1 reference px, except the dated RR-15 decision above, and the
  font allowlists). Preserve failures as evidence.
- **Publish only through the release process.** Releases are authorized by the
  owner (2026-09-29, see [AGENTS.md](../../../AGENTS.md)): only after the
  release gates pass, only from merged `main`, through the trusted-publishing
  workflows, with each registry artifact and provenance verified.
- Keep source, packed and registry claims separate, and schema support
  separate from renderer/editor/export fidelity.

## Naming

- Branches: `codex/rr-<nn>-<slug>` (for example `codex/rr-11-native-header-footer`).
- PR titles start with the item ID: `RR-<nn>: ...` (for example `RR-11: ...`).
- Items inherited from the font program keep their FF ID in the title when they
  close an FF item: `RR-03, FF-07: ...`.
- Statuses: `todo`, `in-progress`, `review` (PR open), `done` (merged and
  evidence linked), `descoped` (owner decision, issue linked).

## Progress reporting

`pnpm report:release` (or `node docs/programs/release-readiness/report.mjs`)
parses the burndown and prints counts by status, the open items and the work
queue: the burndown's **Now** table, one row per open item with its owner (supervisor, a named agent or the owner),
what is being worked on, what blocks it and the next action. `-- --now` prints only the queue; `-- --live` adds the
live state of every pull request a Now row links (merged, or open with its mergeable state and check counts, through
the `gh` CLI; the only mode that uses the network). `--json` prints the same data as JSON; `--file <path>` reads
another burndown. `pnpm check:release-report` runs its unit tests and fails if a table cannot be parsed, uses an
unknown status, names an unknown item, or leaves a closed item in the work queue. Keep the Now table current: update
the row when an item changes hands or state, and delete it when the item closes. This is internal; it is never shown
on a site.

The [gallery tracker](gallery-tracker.md) (RR-41) is the per-item view: one record per item pptx.gallery shows or the
catalogs define (layouts, colour and font schemes, languages, themes, narratives, charts, audiences, tones, socials,
headers and footers, content blocks, image treatments, backgrounds, purposes, fonts, slide sizes and the gallery's
coming teasers), with the columns spec, compose, preview, export, round trip, parity, editor, gallery, native and
fonts taken from the committed audits, parity run, font tracker, native evidence and two pinned snapshots (pptx.gallery
and opf-editor). Each record has a status (`done` to `broken`, with severities) and, per gap, a next action and a link:
an open RR item, a pull request, or an issue for a descoped gap. A record is addressed when every gap has one.
`pnpm build:gallery-tracker` regenerates `gallery-tracker.json` and `.md` (rules in `gallery-tracker.overrides.json`;
refresh the snapshots with `--snapshot-gallery <pptx-gallery> --commit <sha>` and `--snapshot-editor <opf-editor>
--commit <sha>`), and `pnpm check:gallery-tracker`, part of `pnpm test` and so of CI, fails when it is stale, including
after a burndown status change that a gap links to. `pnpm report:release` prints its one-line summary under the
headline.

## Resume protocol

Any session (supervisor or subagent) resuming this program:

1. Read this file, [HANDOFF.md](HANDOFF.md) (the latest supervisor handoff: work in flight, draft PRs with Resume sections, owner actions) and [burndown.md](burndown.md). The progress log at the end
   of the burndown is the latest state, and its Now table says who works on what. Run
   `pnpm report:release -- --live`.
2. `git fetch` every repository in scope. Work only from fresh `origin/main`
   worktrees (never switch or clean the user's checkouts; never resume a
   squash-merged branch).
3. List open program PRs for each repository:
   `gh pr list -R <owner>/<repo> --state all --search "RR- in:title"`
   (also `FF- in:title` for items inherited from the font program). Reconcile
   any status drift into the burndown.
4. Pick the lowest-numbered `todo` item whose dependencies are `done`, or an
   item assigned to you. Branch as `codex/rr-<nn>-<slug>` and start the PR
   title with `RR-<nn>: `.
5. An item is `done` only when its criteria hold, its PR is merged after review
   under the merge policy in force, and the evidence is linked in its row.
   Native-facing criteria need supervisor-recorded native evidence.
6. When an item changes state, update its row and append one dated line to the
   progress log in the same PR, or in a small follow-up tracker PR.
7. Native PowerPoint items are supervisor-only on the Windows host. Inspect the
   host first and record preflight and postflight evidence.

Roles: the supervisor plans, reviews, merges reviewed CI-green PRs and owns
Office. Subagents implement items and open PRs; a separate reviewer reviews each
PR.

## Related

- [Font fidelity everywhere](../font-fidelity-everywhere/README.md) and its
  [burndown](../font-fidelity-everywhere/burndown.md), the predecessor program
- [Release process](../../release-process.md)
- [Release-readiness note for the 0.12.0 release train](release-notes-0.12.0.md) (FF-15, draft)
- [Compatibility matrix](../../compatibility-matrix.md)
- Roadmap issues: [opf#87](https://github.com/OpenPresentation/opf/issues/87)
  (PowerPoint acceptance and native header/footer),
  [opf#88](https://github.com/OpenPresentation/opf/issues/88) (site adoption)
