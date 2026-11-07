# Supervisor plan: v0.33.0 and v0.34.0 (2026-11-07, owner away)

Sources: "How OPF layouts work" (claude.ai/artifact/S5qA5Fk1X9HMyCjG32jeqg, Open work tracker), "Diagrams in OPF" (claude.ai/artifact/VeMs9vDVk6kSN9QFKubQU5, Work tracker), and the owner's request to update every public site, doc, example, sample and gallery.

## v0.33.0 (in flight; release when green plus qualified)
- Nightly fix #1079 (Windows MCP build plus the rich-text fixture). Slow checks #1077: merged.
- Never-shrink batch (session "Explore OPF's never-shrink-text rule"): RR-104, LH-184, LH-185 (#1080), LH-186 (owner approved), SH-11.
- RR-105 qualification: corpus #1085, stepper fix #1086, flipped-triangle text (6), data-story-academy slide 3 (3). Windows final pass; Mac (owner pastes the brief); LibreOffice RR-106 #1084 (non-blocking).
- Docs PR #1078 (layout explainer session): layout counts 30/28 to 36 in dynamic-composition.md and the opf-layout skill.
- After publish: the site MCP follow-up (openpresentation-site branch claude/opf-mcp-app-research-ljem5u, notes on claude/opf-mcp-app-notes).

## v0.34.0 (agents)
| Agent | Items |
|---|---|
| charts | LH-175 Pareto two-series, LH-176 native gap/overlap/axis scale, LH-182 doughnut hole motif, LH-93 horizontal-bar siblings, LH-110 remainder, RR-105 finding 5 (histogram rounding, Pareto axis) |
| layout | Close-outs LH-10, LH-35, LH-65, LH-115, LH-33, LH-39, LH-129. Build LH-46, LH-80, LH-61, LH-69, LH-73, LH-102, LH-171, LH-172, LH-173, LH-174, LH-30. Decide LH-75, LH-138, LH-149 (vetoable). Layout sampler: add the six diagram layouts |
| layout-big | LH-16 duration timeline, LH-34 image callouts, LH-106 slide-level language |
| diagram-langs | SH-12 Graphviz DOT, SH-13 PlantUML (own parsers into pele), SH-10 large-shape text grows |
| smartart | SH-08 SmartArt import; live-gate extras (cycle ring/loops/quadrants, non-Latin/RTL, org chart/hierarchy/Venn, ninth entry). COM through the Office owner |
| i18n-fonts | LH-183 Yu Gothic weight, LH-177 Segoe UI Light/Semilight, LH-178 Arabic complex-script font, LH-121 status words i18n |
| editor | LH-179 editor browser suites on Windows, #932 autosave during an edit, the flaky presenter playground test |
| pptx-0.34 | The native-body re-wrap (card overflow), the small-run title offset (RR-105 findings 2 and 4) |
| sites-docs | Inventory every public site, doc, example, sample and gallery; update for 0.33 and 0.34: vendor names removed (RR-103) on the 3 sites, LH-159 pptx.gallery icon browsing, LH-167 icon sets registered on the 3 sites, examples and README counts, refreshed review artifacts |

Decisions owner: D2 recommended against (waiting); SH-06 phone toolbar and SH-09 text floor (vetoable, recorded).

## Supervisor decisions on the sites/docs inventory (vetoable, 2026-11-07)
- B6: reword the banned vendor name in openpresentation.org's frozen schema copies (0.28.0 to 0.32.1). The descriptions are non-normative, and the owner's rule that the name appears nowhere is newer and stricter than the site's freeze rule; record the exception in the site's AGENTS.md.
- A6: edit the opf-v0.11.1 GitHub release notes to remove the name (RR-103 already rewrote history).
- A7 (`.mcpb` attached to the GitHub release): moved to 0.34.0, so the 0.33.0 release pipeline isn't touched right before it runs.
- C3: remove the progress/gap/"in progress" statements on pptx.gallery, as the owner's no-badges rule requires.
- C6 (pptx.gallery shapes browser): in for 0.34.0.
- Site changes that state 0.33 facts merge only after the 0.33.0 publish; pure cleanups (RR-103, badges, the blog count) merge now.

## Sites state (2026-11-07, the sites agent finished)
- Merged and deployed: openpresentation-site#200, pptx-gallery#168, pptx-gallery#170 (deployed-asset check), pptx-dev#198.
- After the 0.33.0 publish, fold these drafts into the bot bump PRs: pptx-gallery#169, openpresentation-site#201, pptx-dev#199. On pptx-gallery also run `sync-layout-examples` and `sync-layout-contracts --gallery <v0.33.0 checkout>/packages/gallery`. Re-pack and rerun pptx-dev's `source-pane.spec.ts` after core #1120 (the source-worker icon-set fix). Do the hosted MCP viewer branch too.
- After the 0.34.0 publish: pptx-gallery#171 (the /icons and /shapes browsers), plus the 0.34 copy (DOT, PlantUML, SmartArt import, the charts lesson).
- Worktrees: C:\opf-work\site-gallery, site-op and site-dev (their uncommitted tarball overrides must never be committed); sites-pack; tarballs in sites-tgz and sites-tgz33.
- The editor agent was stopped (it kept re-reporting). The supervisor owns: #1120 (gate on), and #1098 (wait for #1079, then check run 42409272401's slow-set failures and the Windows editor legs). After merge, remove C:\opf-work editor-worker-clone, editor-lh179, editor-rr87, editor-932 and editor-pres with agent-worktree.mjs.

## Wave 2 (the second integration PR; review state)
- Approved: #1123 LH-46 (modest form), #1124 LH-102 (v2 at 84d309869), LH-186 #1087 once its sheet is approved.
- Code review still to do: #1109 SH-12 DOT, #1119 SH-13 PlantUML (stacked on #1109), #1118 LH-110, #1114 pptx (#1089/#1091), #1117 RR-106 importer.
- Remaining layout items (needs a third layout agent): LH-69 (WIP from layout-2), LH-80, LH-61, LH-73, LH-30; the bigger items LH-16, LH-34, LH-106. Fonts and i18n: LH-183, LH-177, LH-178, LH-121. SmartArt: SH-08 and SH-20 to SH-23 (smartart agent).
- Wave 2 ready-for-review heads: #1126 SH-08 at 9570ebea55036ec3bca8687e6f0e21f74b8d1f44 (sheets approved; its "Every route" golden is expected red); #1114 at b7aff87f8b9e65d9acd526dd90fd94f3d1e38511; #1123 at 67490486efa29af76b45d060526642dd53aabd15; #1124 at 84d309869cce3df112ee45be820dd663368cf65d. Issues filed: #1127 (native title slack), #1128 (pyramid direction).
- The SmartArt agent stopped (out of context). After the COM sweep (`com-jobs\sh-live-extras\run.ps1`) returns, start a new smartart agent:
  - run SH-19's `gate.mjs` on `sweep\` and set the live domains for SH-20 (OPF cycles, quadrants, compact) and SH-22 (Japanese, Chinese, Arabic, Hebrew);
  - SH-23: open a PR from branch `codex/sh-23-smartart-more-entries` at aee3d430f once step 2 confirms the ninth node;
  - SH-21: fit org chart, hierarchy and Venn from `trees\trees.json` (arrangement values are a format decision).
  Worktrees: `C:\opf-work\sh-08-smartart-import`, `C:\opf-work\sh-live-extras`.
- Wave 2 RR-106: #1084 at 3ba3dee92eeac29cbb5b7aa10733960e15d7fba0; #1117 at 6e6102af6e099e352d155166ffe57fd674b23fe5; branch codex/rr-106-fontconfig-aliases at 21b747c2f2676ecb9c7f94a5e9d5e0d62c88b9a8 (on top of #1084, no PR). Code review is still to do for all three.
