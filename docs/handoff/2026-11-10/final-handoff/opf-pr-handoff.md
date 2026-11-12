# OPF open-PR and workstream handoff

Handoff only; no source/PR changes, tests, Office, release or CI watcher. Frozen staging **55db07face8e1e9777be6ce7ff493d0c53b68ac1**, tree`96280eeedad56768e710102247a63267917bc86e`; main in the retained snapshot`a52dc9441f7eec9dc6f72debb174339758e1761e`. Source/index stayed exact and clean.

## Census and actions

The retained inventory is complete: **49OPEN / 20draft**, **41ancestor heads**, **8not ancestors**. Of the latter, six are unreviewed dependency proposals and two are standalone native evidence. PR1225 is the umbrella but its snapshotted e5de head lags audited55db. Exact full heads/trees/merge bases and per-PR action are inJSON. One bounded named-ref blobless fetch, zero additional GitHub API calls. No merge/close/push performed.

**Do not remerge or push folded leaves.** Preserve immutable producer/worker/evidence branches regardless of ancestry; evidence retention and product acceptance are different decisions. Close stale PRs only under coordinator control after umbrella disposition; never delete a provenance-bound worktree merely to tidy the PR list. Snapshot mergeability is not current CI.

| PR | Draft | Stream | Head | In55db | Disposition |
| --- | --- | --- | --- | --- | --- |
|[#1225](https://github.com/OpenPresentation/opf/pull/1225) RR-20: integrate v0.34 layouts, diagrams, fonts and compatibility work|yes|integration|`e5de880999`|yes|umbrella-head-lags-reviewed-staging|
|[#1261](https://github.com/OpenPresentation/opf/pull/1261) RR-117: verify session-validator entrypoint defaults|yes|validator-entrypoint-contract|`990c67920a`|yes|folded-source-freeze|
|[#1246](https://github.com/OpenPresentation/opf/pull/1246) Bump @modelcontextprotocol/ext-apps from 1.7.5 to 2.0.4|no|dependency-updates|`c1d522ae57`|no|unfolded-dependency-proposal|
|[#1251](https://github.com/OpenPresentation/opf/pull/1251) SH-27: preserve overlay positions outside the slide|yes|signed-positioning|`58e0d7939f`|yes|folded-source-freeze|
|[#1250](https://github.com/OpenPresentation/opf/pull/1250) RR-105: align native table color qualification with maximum contrast|yes|native-pptx-tooling-and-fixes|`7ece2739f1`|yes|folded-source-freeze|
|[#1249](https://github.com/OpenPresentation/opf/pull/1249) RR-105: keep ChartEx captions out of data fingerprints|yes|native-pptx-tooling-and-fixes|`3720315772`|yes|folded-source-freeze|
|[#1248](https://github.com/OpenPresentation/opf/pull/1248) RR-105: add owned six-slide table-color qualification|yes|native-pptx-tooling-and-fixes|`f989741309`|yes|folded-source-freeze|
|[#1247](https://github.com/OpenPresentation/opf/pull/1247) RR-105: preserve negative histogram categories in PowerPoint|yes|native-pptx-tooling-and-fixes|`62e41b4145`|yes|folded-source-freeze|
|[#1240](https://github.com/OpenPresentation/opf/pull/1240) RR-105: bind an explicit dense-slide read-only survey controller|yes|native-pptx-tooling-and-fixes|`623e4dbc1c`|yes|folded-source-freeze|
|[#1245](https://github.com/OpenPresentation/opf/pull/1245) Bump the npm-minor-patch group with 5 updates|no|dependency-updates|`a526432223`|no|unfolded-dependency-proposal|
|[#1244](https://github.com/OpenPresentation/opf/pull/1244) Bump pdfjs-dist from 6.4.299 to 6.5.438 in the native-image-pdf group|no|dependency-updates|`60377f4712`|no|unfolded-dependency-proposal|
|[#1243](https://github.com/OpenPresentation/opf/pull/1243) Bump @expo-google-fonts/noto-color-emoji from 0.4.7 to 0.4.8 in the expo-google-fonts group|no|dependency-updates|`9c2d21939c`|no|unfolded-dependency-proposal|
|[#1242](https://github.com/OpenPresentation/opf/pull/1242) Bump playwright from 1.64.1 to 1.65.0 in the playwright group|no|dependency-updates|`b7302c5a91`|no|unfolded-dependency-proposal|
|[#1241](https://github.com/OpenPresentation/opf/pull/1241) Bump pnpm/action-setup from 6.1.0 to 6.1.1 in the actions-minor-patch group|no|dependency-updates|`0a38bac7e0`|no|unfolded-dependency-proposal|
|[#1206](https://github.com/OpenPresentation/opf/pull/1206) RR-20: make Windows qualification test fixtures portable|no|release-portability-and-provenance|`ebf7e8f077`|yes|folded-source-freeze|
|[#1205](https://github.com/OpenPresentation/opf/pull/1205) RR-20: preserve append-only archive review provenance and lock history|no|release-portability-and-provenance|`2a5e9cd643`|yes|folded-source-freeze|
|[#1204](https://github.com/OpenPresentation/opf/pull/1204) RR-105: qualify a separately owned pinned Roboto Mono profile|no|native-pptx-tooling-and-fixes|`203879c982`|yes|folded-source-freeze|
|[#1201](https://github.com/OpenPresentation/opf/pull/1201) RR-20: use Windows directory junctions in the CodeMirror fixture|yes|release-portability-and-provenance|`58cc9cdc27`|yes|folded-source-freeze|
|[#1200](https://github.com/OpenPresentation/opf/pull/1200) RR-105: Add bounded read-only whole-slide native survey|yes|native-pptx-tooling-and-fixes|`ce92ccc65d`|yes|folded-source-freeze|
|[#1198](https://github.com/OpenPresentation/opf/pull/1198) RR-20: resolve archive reviewer runtimes through Node ESM|yes|release-portability-and-provenance|`fcb18d4afb`|yes|folded-source-freeze|
|[#1193](https://github.com/OpenPresentation/opf/pull/1193) RR-20: preserve reviewed site bump history without force pushes|yes|release-portability-and-provenance|`09bb7cf19d`|yes|folded-source-freeze|
|[#1181](https://github.com/OpenPresentation/opf/pull/1181) RR-20: add verified registry E1 comparison refresh route|no|release-portability-and-provenance|`34ae758d71`|yes|folded-source-freeze|
|[#1165](https://github.com/OpenPresentation/opf/pull/1165) LH-34: retain callouts after native empty-panel normalization|yes|layouts-and-content|`8a03dfe1f4`|yes|folded-source-freeze|
|[#1155](https://github.com/OpenPresentation/opf/pull/1155) LH-34: readable image callouts as real SVG and native editable text|no|layouts-and-content|`0a4a909688`|yes|folded-source-freeze|
|[#1150](https://github.com/OpenPresentation/opf/pull/1150) LH-16: proportional timeline periods with readable native labels|no|layouts-and-content|`5c8b84047e`|yes|folded-source-freeze|
|[#1151](https://github.com/OpenPresentation/opf/pull/1151) RR-105: archive light-font and localized-status native acceptance|yes|retained-evidence-and-audit|`dc3d2b682c`|no|standalone-evidence-retain-outside-product|
|[#1148](https://github.com/OpenPresentation/opf/pull/1148) SH-23: qualify added SmartArt nodes after save/reopen|yes|diagrams-and-smartart|`3e20cd6e8f`|yes|folded-source-freeze|
|[#1147](https://github.com/OpenPresentation/opf/pull/1147) RR-105: retain mixed-language native save witnesses|yes|retained-evidence-and-audit|`e1f8a09216`|no|standalone-evidence-retain-outside-product|
|[#1141](https://github.com/OpenPresentation/opf/pull/1141) LH-106, LH-178: resolve and preserve each slide language|no|fonts-and-localization|`dde3809913`|yes|folded-source-freeze|
|[#1144](https://github.com/OpenPresentation/opf/pull/1144) LH-121: localize generated timeline status words|no|fonts-and-localization|`b9642636e2`|yes|folded-source-freeze|
|[#1143](https://github.com/OpenPresentation/opf/pull/1143) RR-107: Attach checked MCP bundles to releases|no|mcp-release-bundles|`cabd3c8a03`|yes|folded-source-freeze|
|[#1142](https://github.com/OpenPresentation/opf/pull/1142) LH-177: preserve lightweight named font emphasis and record Yu Gothic gap|no|fonts-and-localization|`6f46dd2255`|yes|folded-source-freeze|
|[#1134](https://github.com/OpenPresentation/opf/pull/1134) RR-105/SH-20..23: COM evidence and qualification results (handoff)|yes|retained-evidence-and-audit|`f00b59a90b`|yes|historical-evidence-already-in-staging|
|[#1136](https://github.com/OpenPresentation/opf/pull/1136) Docs: the never-shrink audit, its evidence and the LH-186 review|yes|retained-evidence-and-audit|`5ba72b90d1`|yes|historical-evidence-already-in-staging|
|[#1129](https://github.com/OpenPresentation/opf/pull/1129) LH-61, LH-73: close LH-61 (nothing left); LH-73's caption form decided, not built|no|layouts-and-content|`3e64e6a865`|yes|folded-source-freeze|
|[#1130](https://github.com/OpenPresentation/opf/pull/1130) LH-30: an optional template group whose variables are all unfilled collapses whole|no|layouts-and-content|`0b661cad60`|yes|folded-source-freeze|
|[#1131](https://github.com/OpenPresentation/opf/pull/1131) LH-69: a placed region's short text draws as a tile|no|layouts-and-content|`aa680dcfab`|yes|folded-source-freeze|
|[#1135](https://github.com/OpenPresentation/opf/pull/1135) LH-80: a table beside a picture track may wrap a cell onto two lines when no track keeps every cell on one|yes|layouts-and-content|`91c07d230e`|yes|folded-source-freeze|
|[#1117](https://github.com/OpenPresentation/opf/pull/1117) RR-106: unique ids across the presentation when import binds connectors (fixes #1103)|no|libreoffice-and-import-compatibility|`6e6102af6e`|yes|folded-source-freeze|
|[#1084](https://github.com/OpenPresentation/opf/pull/1084) RR-106: LibreOffice qualification of the PPTX export (opf#926)|no|libreoffice-and-import-compatibility|`3ba3dee92e`|yes|folded-source-freeze|
|[#1132](https://github.com/OpenPresentation/opf/pull/1132) RR-106: opf-preview-fonts --fontconfig writes the font-policy aliases; charts: picture for LibreOffice|yes|libreoffice-and-import-compatibility|`21b747c2f2`|yes|folded-source-freeze|
|[#1126](https://github.com/OpenPresentation/opf/pull/1126) SH-08: SmartArt PowerPoint users made imports into OPF|no|diagrams-and-smartart|`9570ebea55`|yes|folded-source-freeze|
|[#1124](https://github.com/OpenPresentation/opf/pull/1124) LH-102: under-filled automatic stacks and promoted-region bodies center|no|layouts-and-content|`84d309869c`|yes|folded-source-freeze|
|[#1123](https://github.com/OpenPresentation/opf/pull/1123) LH-46: a closing's details draw as a lead plus cards|no|layouts-and-content|`67490486ef`|yes|folded-source-freeze|
|[#1109](https://github.com/OpenPresentation/opf/pull/1109) SH-12: Graphviz DOT diagrams, read by OPF and laid out by pele|no|diagrams-and-smartart|`36979baa67`|yes|folded-source-freeze|
|[#1119](https://github.com/OpenPresentation/opf/pull/1119) SH-13: PlantUML diagrams, read by OPF and drawn by pele|no|diagrams-and-smartart|`4d5905db4b`|yes|folded-source-freeze|
|[#1118](https://github.com/OpenPresentation/opf/pull/1118) LH-110: reference lines from English number words and German, French, Spanish, Italian, Portuguese and Dutch titles|no|chart-reference-lines|`c4b0227f58`|yes|folded-source-freeze|
|[#1114](https://github.com/OpenPresentation/opf/pull/1114) RR-105: native body wrap margin (#1089) and small-run title baseline (#1091)|no|native-pptx-tooling-and-fixes|`b7aff87f8b`|yes|folded-source-freeze|
|[#1098](https://github.com/OpenPresentation/opf/pull/1098) LH-179: the editor browser suites run on Windows, with a nightly Windows leg|no|release-portability-and-provenance|`b425ae984c`|yes|folded-source-freeze|

## Scoped achievements and remaining gates

- **Published platform / v0.33 train:** Seven-package monorepo, coordinated shared-version publisher/default catalog and v0.33 publication are recorded. Nov7 v0.33-pending language is historical. **Limits:** v0.34 is unpublished. No v0.33.1 or new release is authorized by this handoff. Some program READMEs retain historical six-package plans; use current root package map/publisher and current handoff. [Source](https://github.com/OpenPresentation/opf/blob/55db07face8e1e9777be6ce7ff493d0c53b68ac1/docs/handoff/2026-11-10/README.md).

- **Wave2 layout/content and localization source:** The original reviewed closing/centering/tiles/optional-groups/table-track decisions, duration timelines, image callouts, slide language, localized status and lightweight font source heads are in staging ancestry. **Limits:** Source fold is not blanket readability/native glyph qualification; preserve current open facets and never-shrink exceptions. [Source](https://github.com/OpenPresentation/opf/blob/55db07face8e1e9777be6ce7ff493d0c53b68ac1/docs/handoff/2026-11-07/README.md).

- **Shapes/diagrams/SmartArt:** DOT and PlantUML engines, SmartArt import and added-node save/reopen source/evidence are folded; shared preset geometry and bounded arrangement fallbacks remain the design. **Limits:** Do not infer every187preset/live-domain/native edit scenario passed; retained COM acceptance belongs only to its original source/cases. [Source](https://github.com/OpenPresentation/opf/blob/55db07face8e1e9777be6ce7ff493d0c53b68ac1/docs/programs/shapes/burndown.md).

- **Explicit references and signed positioning:** Current staging contains explicit reference-line and signed-origin/RTL/callout work; historical title inference has been superseded. Current handoff records genuine consumers and four native Save/import cases with12PNG pairs and full-model/diagnostic equality. **Limits:** Chart edits/all-seven/full corpus and final combined source gates remain owed. Schema-review branch c7d proposes further changes but is not adopted; native Latin-slot731 is separate/unmerged. [Source](https://github.com/OpenPresentation/opf/blob/55db07face8e1e9777be6ce7ff493d0c53b68ac1/docs/handoff/2026-11-10/README.md).

- **Portable qualification / native ownership tooling:** Windows fixtures, archive history/reviewer resolution, E1 route, ce92 survey, dense and owned six-slide table controls, table expectations, histogram negative categories and ChartEx caption source are folded. **Limits:** Keep immutable producer/runtime/worker/envelope identities. Current59 preparation is not59native passes; original failure/cleanup observations must survive. Table current successful facet is separate from frozen failed profile02. [Source](https://github.com/OpenPresentation/opf/blob/55db07face8e1e9777be6ce7ff493d0c53b68ac1/docs/handoff/2026-11-10/README.md).

- **Demand fonts / render performance / review:** Demand preparation, strict coverage/raster companion/order repairs, HarfBuzz carrier traversal, private cmap preparation, text-metric cache and review work have reviewed source/evidence. Latest published six-child36-slide cold trial reports startup means3.417s demand/3.461s whole, lower process HWM but higher startup CPU. **Limits:** Historical13.6%slowdown is not current general behavior; n2/arm, local workload, not browser/mobile/cloud certification. Held48-slide-regressing replay is not folded. Final combined renderer/goldens/browser/platform/CI remain owed. [Source](https://github.com/OpenPresentation/opf/blob/55db07face8e1e9777be6ce7ff493d0c53b68ac1/docs/handoff/2026-11-10/README.md).

- **Actual qualification coverage and remaining failures:** Current handoff records repaired863 delta15PASS,149portable decks/966slides and previously unvisited PPTX128/128PASS. Historical full/delta/tail failures and sparse prerequisite recoveries are retained. **Limits:** These are composited exact-source facets, not final fullCI green. Renderer exact goldens/held comparisons and final full/platform/registry/Release/site034 acceptance remain open. [Source](https://github.com/OpenPresentation/opf/blob/55db07face8e1e9777be6ce7ff493d0c53b68ac1/docs/handoff/2026-11-10/README.md).

- **Hosted recovery / MCP site work:** Current handoff records organization site214/217/218 recovery/test-orchestration fixes, actual current immutable production source/provider checks and scoped owner/MCP/privacy results on org148. **Limits:** Other site0.34drafts/assets/bump/deployed acceptance remain owed. Owner-held DEV secret transfer and Claude/local-extension/submission actions stay explicit; do not infer complete site release from one production facet. [Source](https://github.com/OpenPresentation/opf/blob/55db07face8e1e9777be6ce7ff493d0c53b68ac1/docs/handoff/2026-11-10/README.md).

- **B07 glyph diagnostics and new schema/viewer handoffs:** Original primary-language/font/UTF16 guards and rejected A/B/C/LtrRun/proofing/partition/CS/LRE/LRO evidence are retained. Source731 independent review, schema report5b7 and LROsource1f5/proofcd8 are separate deliveries. **Limits:** Glyph05/06/09/10 remain open; LRE/LROcurrent18-unit diagnostics do not meet original16-unit equality and did not fix word order. No speculative new mutant, product adoption or approval question. Finish review-first schema/viewer deliveries via coordinator. [Source](https://github.com/OpenPresentation/opf/blob/55db07face8e1e9777be6ce7ff493d0c53b68ac1/docs/handoff/2026-11-10/README.md).

## Immediate resume rules

- Stop state: no new implementation/tests/Office/deploy/release/CI watcher is authorized. Root owns publication and the user-requested pause.
- Read current Nov10 README/workstreams and binding Nov7 working rules; historical live handles in old sections are not current processes.
- One heavy aggregate only when coordinator allocates it; no duplicate watchers or blind retries.
- Ancestry is source inclusion, not CI/native/current-runtime/release acceptance. Snapshot mergeability/draft flags may be stale; no fresh GitHub status calls were used.
- Preserve NEVERMERGE evidence, all frozen/qualified producer and worker heads, exact input/output bytes and original RED receipts. Do not push any folded leaf.
- v0.34 remains unpublished; final coherent source/golden/fullCI/platform/native/registry/release/site gates remain required.

This is a classified handoff of the retained snapshot, not a fresh PR/issue census or a blanket completion certificate. The current Nov10 entrypoint itself includes historical checkpoints/live handles; source-specific terminal receipts take precedence over an old “running” paragraph. Root owns the final publication and new-agent prompt, then stops as the owner requested.
