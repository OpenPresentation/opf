# Handoff of 2026-11-07: v0.33.0 and v0.34.0

This is the entry point for whoever continues this work. A supervisor session coordinated about a dozen agents on 2026-11-07 while the owner was away. All of their work is on GitHub: in open PRs, on pushed branches, in the evidence branch `handoff/review-sheets-2026-11-07`, and in this folder. Nothing exists only on the old machine. Start with [KICKOFF.md](KICKOFF.md), which is the one prompt to give the next agent.

Files in this folder:
- [wave2-review.md](wave2-review.md): independent code/sheet review of all 17 wave-2 heads, reproduced defects and the assembled preparation branch (not yet CI/native-qualified).
- [working-rules.md](working-rules.md): how to work here (CI batching, goldens, COM, owner rules). Read it before anything else.
- [com-checks.md](com-checks.md): the PowerPoint checks still owed, deck by deck.
- [decisions.md](decisions.md): every judgment call made for the owner; each one is vetoable.
- [sites-docs-inventory.md](sites-docs-inventory.md): every public site, doc, example and gallery, with stale facts and a task list.
- [com-job-sh-08.md](com-job-sh-08.md), [com-job-sh-live-extras.md](com-job-sh-live-extras.md): the SmartArt COM jobs.

Review sheets (before/after PNGs) for every output-changing PR are on the evidence-only branch `handoff/review-sheets-2026-11-07` (never merged): `git fetch origin handoff/review-sheets-2026-11-07`, or browse it on GitHub.

## State at handoff

- `main` is at `acc222502`, 26 commits after v0.32.1 (published). No release has run since 0.32.1.
- The nightly is fixed (#1079 merged; #1072 closed). The weekly slow checks are fixed (#1077; #911 closed). Their next scheduled runs confirm it.
- CI is saturated: the repository's concurrent-job limit is the bottleneck. Batch everything, as described in [working-rules.md](working-rules.md#ci-and-merging).

## Goal

Release **v0.33.0**: the integration PR below, after the final PowerPoint pass. Then **v0.34.0**: wave 2 and the remaining items. Then update the three public sites after each release. The owner asked for everything in at most two releases.

## Step 1: finish v0.33.0

**Integration PR [#1133](https://github.com/OpenPresentation/opf/pull/1133)** (branch `codex/integration-033`, head `70baf5d22` at handoff). It folds in 24 reviewed PRs:

| Folded PRs | What they are |
| --- | --- |
| #1079 | Nightly fix (already on main) |
| #1120 | Editor source worker clones catalogs (icon-set registration broke off-thread checks) |
| #1100 | Core docs, READMEs, a new example deck, skills, the AGENTS.md golden instruction |
| #1085, #1095, #1097 | RR-105 qualification corpus, the academy example fix, flipped-shape text |
| #1082, #1087 | LH-184 (columns keep the largest text) and LH-186 (layout before shrinking), with an integration fix where they meet |
| #1099, #1101, #1107 | RR-87 owned-copy native helper, the #932 regression test, the presenter flake fix |
| #1096, #1102, #1110, #1112, #1116, #1121, #1122 | Layout close-outs; sampler diagram slides; LH-173/174; LH-171/172; LH-75 and its growth; LH-187 |
| #1104, #1105, #1106, #1108, #1111 | Charts: LH-175, LH-176, histogram rounding and Pareto axes (RR-105 finding 5), LH-182, LH-93 |
| #1115 | SH-10: text in large shapes grows |

Already approved: every folded PR's sheet, and the combined template-golden sheet (49 of 624 template slides move; the paginated FAQ pages keep 2 columns). The `full-ci` label is on.

To finish it:
1. Wait for golden run 42421884975 (`golden.yml` on `codex/integration-033`) to push its commit. Review which example goldens moved against the folded PRs' sheets.
2. Merge `origin/main` into the branch and push once; a golden push starts no CI. Watch it: `node scripts/pr-gate.mjs OpenPresentation/opf#1133 --expect-head <full sha> --required all`. If a leg fails, read that job's log once, fix it on the branch, and push once.
3. **Final PowerPoint pass** on that head, on Windows with PowerPoint. Run the RR-105 manifest (`scripts/native-acceptance/qualification/`), plus [com-checks.md](com-checks.md) sections SH-10, Charts and LH-174. A defect in a supported feature blocks the release; fix it on the branch.
4. Squash-merge #1133; its `Closes` lines close the folded PRs.
5. **Release v0.33.0** through the Release workflow (`docs/release-process.md`: Actions, Release, Run workflow on `main`, version 0.33.0, a dry run first, then for real). It is a minor version, because RR-103 removed names.
6. **Mac** (optional, recommended): PowerPoint for Mac and Keynote. The qualification README describes the run; record results in `docs/programs/release-readiness/qualification-0.33-mac.md`. Open Keynote read-only.

## Step 2: sites after the v0.33.0 publish

`bump-sites.yml` opens a bump PR on each site after the release. Fold these drafts into them:

| Site | Draft | Notes |
| --- | --- | --- |
| pptx.gallery | [Data-Advantage/pptx-gallery#169](https://github.com/Data-Advantage/pptx-gallery/pull/169) | SH-02 image field renames, six layout overlays, icon sets, how-tos. Also run `sync-layout-examples` and `sync-layout-contracts --gallery <v0.33.0 checkout>/packages/gallery`, which `opf:bump` doesn't run. |
| openpresentation.org | [Data-Advantage/openpresentation-site#201](https://github.com/Data-Advantage/openpresentation-site/pull/201) | Icon sets, shapes, SmartArt and MCP docs, playground samples, the LibreOffice wording |
| pptx.dev | [Data-Advantage/pptx-dev#199](https://github.com/Data-Advantage/pptx-dev/pull/199) | Icon sets, the OPF docs (diagrams export as native shapes). Rerun `tests/e2e/source-pane.spec.ts` against 0.33.0: it failed before #1120. |

Also do the **hosted MCP viewer** (openpresentation.org): rebase branch `claude/opf-mcp-app-research-ljem5u` (commits ee9eb9be and 2de95594) onto the bumped main, pin 0.33.0, and open a PR. The notes are in commit f2746047 on branch `claude/opf-mcp-app-notes`:
- the rate limit goes from 60 to 600 a minute;
- no environment variable or binding is needed;
- check `wrangler deploy --dry-run` against the size limit;
- the test expectations to update are listed there.
openpresentation.org deploys on every push to `main` (`cloudflare-deploy.yml`). Merge only verified builds.

Owner steps after that deploy: in Claude, Settings, Connectors, Add custom connector, `https://www.openpresentation.org/mcp`; then uninstall the local OPF `.mcpb` extension.

## Step 3: v0.34.0 (wave 2)

Fold these into one wave-2 integration PR, the way #1133 was built:

| PR | Item | State |
| --- | --- | --- |
| #1123 | LH-46 closing lead plus grid | approved |
| #1124 | LH-102 grow then center | approved |
| #1131 | LH-69 placed short texts as tiles | needs sheet review (5 slides; the sheet is on the evidence branch, `supervisor/LH-69.png`) |
| #1130 | LH-30 optional groups collapse, plus the `opf/variable-group-omitted` rule | needs code review (no slide moves) |
| #1129 | LH-61 closed, LH-73 decided (docs) | needs review |
| #1135 (draft) | LH-80 two-line cells beside a picture track | needs a judgment: on m17 the picture gains a track but names wrap. Built on #1116, so review only the commits after 117de8059. |
| #1126 | SH-08 SmartArt import | approved (the inverted pyramid becomes a list; titles move above overlays). Its "Every route" golden is expected to move. |
| #1109, #1119 | SH-12 Graphviz DOT, SH-13 PlantUML (#1119 is stacked on #1109) | need code review; no existing slide moves |
| #1118 | LH-110 reference lines from number words and six languages | needs sheet and code review (`supervisor/LH-110.png`) |
| #1114 | RR-105 native-body wrap margin (#1089) and small-run title baseline (#1091) | needs code review; PPTX-only, with COM checks in [com-checks.md](com-checks.md) |
| #1084, #1117, #1132 (draft) | RR-106 LibreOffice qualification, the importer duplicate-id fix (#1103), and the `opf-preview-fonts --fontconfig` aliases (stacked on #1084) | need code review |
| #1098 | LH-179 editor browser suites on Windows, plus a nightly Windows leg | its slow-set legs failed before #1079 landed; rerun after merging main |
| #1136 (draft) | The never-shrink audit docs and evidence | review |
| #1134 (draft) | COM evidence and qualification results | merge as evidence |

Not started, still in scope for 0.34.0 if time allows:
- Layout: LH-16 (duration-proportional timeline), LH-34 (image callouts), LH-106 (slide-level `language`).
- Fonts and i18n: LH-183 (Yu Gothic draws lighter), LH-177 (Segoe UI Light/Semilight), LH-178 (Arabic complex-script font), LH-121 (timeline status words in other languages).
- SmartArt live extras (SH-20 to SH-23). The COM sweep **has run**, and its results are on draft #1134: 465 of 516 instances live, the ninth node correct on 18 of 18, and 580 tree measurements. The job is described in [com-job-sh-live-extras.md](com-job-sh-live-extras.md).
  - SH-23's code is on branch `codex/sh-23-smartart-more-entries` (aee3d430f). The ninth-node check passed, so open its PR. A reopen check of the ninth node is still owed; #1134 says how.
  - SH-20 and SH-22: run SH-19's `gate.mjs` (in `tools/shapes/sh-19/tools/` on the evidence branch) on the sweep results, and set the live domains from it.
  - SH-21: fit org chart, hierarchy and Venn from the tree measurements. The arrangement values are a format decision.
- Issues filed on 2026-11-07:
  - #1113: overlays anchored to a chart data point
  - #1127: native wrapped titles need slack, like #1089
  - #1128: a pyramid direction option (an inverted pyramid)
  - #1103: fixed in #1117
- Remainders noted by agents:
  - LH-182: a doughnut with chart options still has an open hole.
  - LH-93: stacked horizontal bar siblings keep their own plot.
  - LH-110: number words are English only, and period bands too.
  - LH-75: b15 s23 and s41 are still open (three-line cells, or a fill target over 60%).
  - LH-73: two notes of very different lengths stack.
  - The pptx.dev diagram SVGs were not regenerated.

After v0.34.0 is published, merge the pptx.gallery browsers draft [Data-Advantage/pptx-gallery#171](https://github.com/Data-Advantage/pptx-gallery/pull/171) (`/icons`, `/shapes`), and do the 0.34 site copy (DOT, PlantUML, SmartArt import, the charts lesson). See [sites-docs-inventory.md](sites-docs-inventory.md) section 3b.

## Owner decisions still open

- D2 is recommended against (it waits for the owner).
- Whether to promote LibreOffice from "experimental" (RR-106; the results are in `docs/programs/release-readiness/qualification-0.33-libreoffice.md`, on #1084).
- Every entry in [decisions.md](decisions.md) is vetoable.
