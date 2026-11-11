# Complete current open-PR workstream inventory

**57open PRs: OPF46 / Org4 / Gallery3 / DEV4;22drafts.** Snapshot 2026-11-10T17:40:24.6631664Z. The initial60 became64after four takeover drafts. Normal alignment of the existing integration to its already-folded source then caused GitHub to mark seven child PRs MERGED into codex/integration-034 at17:38:54Z. No merge into main or release occurred.

## Public OPF — all46current open PRs

Full heads, base refs and status snapshots: [currentJSON](opf-current-inventory.json). The canonical final handoff may add documentation after this exact snapshot; its finalSHA is in the closeout and per-repo recovery snapshot. CI rollup is a dated observation, not a maintained required-all acceptance gate.

| PR / title | Draft | Workstream | Head | Disposition | CI snapshot |
| --- | --- | --- | --- | --- | --- |
| [#1225](https://github.com/OpenPresentation/opf/pull/1225) RR-20: integrate v0.34 layouts, diagrams, fonts and compatibility work | yes | integration | ffd6e0a42ba24c33d52ecb6f6c1e5f17ed0588de | Aligned umbrella; unfinished | PENDING |
| [#1270](https://github.com/OpenPresentation/opf/pull/1270) RR-114: record native-export font preparation gap for takeover | yes | W04 native font preparation | b964ab9ab42a89bac2627ac5461c665b1e4dbf86 | Unfolded takeover draft | SUCCESS |
| [#1269](https://github.com/OpenPresentation/opf/pull/1269) FA-34: review complete schema consistency proposals before adoption | yes | W05 schema review — NEVERMERGE | 5b7c64225e2100539deacb270cb266b68820b116 | NEVERMERGE / retain | SUCCESS |
| [#1268](https://github.com/OpenPresentation/opf/pull/1268) RR-111: finish v0.34 viewer and connector handoff materials | yes | W08 viewer/connector | 1644f461e796dd37fa68a2f6e8e54e32724c1ddd | Unfolded takeover draft | SUCCESS |
| [#1267](https://github.com/OpenPresentation/opf/pull/1267) RR-105: preserve chosen Latin font slots under Arabic proofing | yes | W03 fonts/PPTX | a72850e125493da4d88b3e93ef236665d58bc0b4 | Unfolded takeover draft | FAILURE |
| [#1246](https://github.com/OpenPresentation/opf/pull/1246) Bump @modelcontextprotocol/ext-apps from 1.7.5 to 2.0.4 | no | dependency-updates | c1d522ae5730af483a4efa0cc59349240c2a7c6b | unfolded-dependency-proposal | FAILURE |
| [#1245](https://github.com/OpenPresentation/opf/pull/1245) Bump the npm-minor-patch group with 5 updates | no | dependency-updates | a526432223382db3854709b55e134cb827ac0263 | unfolded-dependency-proposal | FAILURE |
| [#1244](https://github.com/OpenPresentation/opf/pull/1244) Bump pdfjs-dist from 6.4.299 to 6.5.438 in the native-image-pdf group | no | dependency-updates | 60377f471254e9d0ed80dfb21aad3c57b414226b | unfolded-dependency-proposal | SUCCESS |
| [#1243](https://github.com/OpenPresentation/opf/pull/1243) Bump @expo-google-fonts/noto-color-emoji from 0.4.7 to 0.4.8 in the expo-google-fonts group | no | dependency-updates | 9c2d21939cc3f13470254a5e1e2bbf841b1297c2 | unfolded-dependency-proposal | FAILURE |
| [#1242](https://github.com/OpenPresentation/opf/pull/1242) Bump playwright from 1.64.1 to 1.65.0 in the playwright group | no | dependency-updates | b7302c5a9182dbe5a28ef125303c56e461778637 | unfolded-dependency-proposal | FAILURE |
| [#1241](https://github.com/OpenPresentation/opf/pull/1241) Bump pnpm/action-setup from 6.1.0 to 6.1.1 in the actions-minor-patch group | no | dependency-updates | 0a38bac7e0f4e471208db57974696840f43d76ca | unfolded-dependency-proposal | SUCCESS |
| [#1206](https://github.com/OpenPresentation/opf/pull/1206) RR-20: make Windows qualification test fixtures portable | no | release-portability-and-provenance | ebf7e8f07778b7eb4ecf54ed920a5cbf664c6ebf | folded-source-freeze | SUCCESS |
| [#1205](https://github.com/OpenPresentation/opf/pull/1205) RR-20: preserve append-only archive review provenance and lock history | no | release-portability-and-provenance | 2a5e9cd643b4498ad828dc6aebc099e46248ebfb | folded-source-freeze | SUCCESS |
| [#1204](https://github.com/OpenPresentation/opf/pull/1204) RR-105: qualify a separately owned pinned Roboto Mono profile | no | native-pptx-tooling-and-fixes | 203879c982ddc7cc5886b78329643cab7049d5f2 | folded-source-freeze | FAILURE |
| [#1201](https://github.com/OpenPresentation/opf/pull/1201) RR-20: use Windows directory junctions in the CodeMirror fixture | yes | release-portability-and-provenance | 58cc9cdc27d0f6a3180f35a65b203b80ade803dd | folded-source-freeze | FAILURE |
| [#1200](https://github.com/OpenPresentation/opf/pull/1200) RR-105: Add bounded read-only whole-slide native survey | yes | native-pptx-tooling-and-fixes | ce92ccc65d8cb40cc6532b2d9082e12202d6c283 | folded-source-freeze | NO REPORT |
| [#1198](https://github.com/OpenPresentation/opf/pull/1198) RR-20: resolve archive reviewer runtimes through Node ESM | yes | release-portability-and-provenance | fcb18d4afb9ba85cfc904c9ca9196abff83ce647 | folded-source-freeze | FAILURE |
| [#1193](https://github.com/OpenPresentation/opf/pull/1193) RR-20: preserve reviewed site bump history without force pushes | yes | release-portability-and-provenance | 09bb7cf19d67ae5dc02122d6df113ef77f7f6611 | folded-source-freeze | SUCCESS |
| [#1181](https://github.com/OpenPresentation/opf/pull/1181) RR-20: add verified registry E1 comparison refresh route | no | release-portability-and-provenance | 34ae758d71abb77845d6b3feb08d2d53308f3a99 | folded-source-freeze | SUCCESS |
| [#1165](https://github.com/OpenPresentation/opf/pull/1165) LH-34: retain callouts after native empty-panel normalization | yes | layouts-and-content | 8a03dfe1f4fa8d60a9869e2553bf023849e36aaf | folded-source-freeze | FAILURE |
| [#1155](https://github.com/OpenPresentation/opf/pull/1155) LH-34: readable image callouts as real SVG and native editable text | no | layouts-and-content | 0a4a909688850637b955664df6d20b5ac2744bd1 | folded-source-freeze | FAILURE |
| [#1150](https://github.com/OpenPresentation/opf/pull/1150) LH-16: proportional timeline periods with readable native labels | no | layouts-and-content | 5c8b84047ea40e2f29ec77240dc1574229c1ae8e | folded-source-freeze | FAILURE |
| [#1151](https://github.com/OpenPresentation/opf/pull/1151) RR-105: archive light-font and localized-status native acceptance | yes | retained-evidence-and-audit | dc3d2b682c8cac10d28752f61861b94932a4d1b3 | NEVERMERGE / retain | SUCCESS |
| [#1148](https://github.com/OpenPresentation/opf/pull/1148) SH-23: qualify added SmartArt nodes after save/reopen | yes | diagrams-and-smartart | 3e20cd6e8f47629e4f5d55ee4534f863d7903f6b | folded-source-freeze | FAILURE |
| [#1147](https://github.com/OpenPresentation/opf/pull/1147) RR-105: retain mixed-language native save witnesses | yes | retained-evidence-and-audit | e1f8a0921640f2b4100d6807fc3590dbe26abeed | NEVERMERGE / retain | SUCCESS |
| [#1141](https://github.com/OpenPresentation/opf/pull/1141) LH-106, LH-178: resolve and preserve each slide language | no | fonts-and-localization | dde3809913e9d2e38d9c199f67ece8741426067e | folded-source-freeze | FAILURE |
| [#1144](https://github.com/OpenPresentation/opf/pull/1144) LH-121: localize generated timeline status words | no | fonts-and-localization | b9642636e297a1d2dfbf65cb77bea133841beee1 | folded-source-freeze | FAILURE |
| [#1143](https://github.com/OpenPresentation/opf/pull/1143) RR-107: Attach checked MCP bundles to releases | no | mcp-release-bundles | cabd3c8a03d02255329edd2352eb1e39df7fb40c | folded-source-freeze | FAILURE |
| [#1142](https://github.com/OpenPresentation/opf/pull/1142) LH-177: preserve lightweight named font emphasis and record Yu Gothic gap | no | fonts-and-localization | 6f46dd2255b27abb4af7ecbfaf2e07ec5fba34a6 | folded-source-freeze | FAILURE |
| [#1134](https://github.com/OpenPresentation/opf/pull/1134) RR-105/SH-20..23: COM evidence and qualification results (handoff) | yes | retained-evidence-and-audit | f00b59a90b42d54ec4e5116f89f09d2a831c2bee | NEVERMERGE / retain | SUCCESS |
| [#1136](https://github.com/OpenPresentation/opf/pull/1136) Docs: the never-shrink audit, its evidence and the LH-186 review | yes | retained-evidence-and-audit | 5ba72b90d1fbf9919550e066da0ce6e474826539 | NEVERMERGE / retain | SUCCESS |
| [#1129](https://github.com/OpenPresentation/opf/pull/1129) LH-61, LH-73: close LH-61 (nothing left); LH-73's caption form decided, not built | no | layouts-and-content | 3e64e6a86583940f55a33ceb0e81ca3d0ae95b64 | folded-source-freeze | SUCCESS |
| [#1130](https://github.com/OpenPresentation/opf/pull/1130) LH-30: an optional template group whose variables are all unfilled collapses whole | no | layouts-and-content | 0b661cad609bdde72d4a17f6780337fcfc8e91fd | folded-source-freeze | FAILURE |
| [#1131](https://github.com/OpenPresentation/opf/pull/1131) LH-69: a placed region's short text draws as a tile | no | layouts-and-content | aa680dcfabcce0f34495d0c820b484d10c40adcd | folded-source-freeze | FAILURE |
| [#1135](https://github.com/OpenPresentation/opf/pull/1135) LH-80: a table beside a picture track may wrap a cell onto two lines when no track keeps every cell on one | yes | layouts-and-content | 91c07d230e0ccab6c568ad3c5c975ac56be2c95f | folded-source-freeze | SUCCESS |
| [#1117](https://github.com/OpenPresentation/opf/pull/1117) RR-106: unique ids across the presentation when import binds connectors (fixes #1103) | no | libreoffice-and-import-compatibility | 6e6102af6e099e352d155166ffe57fd674b23fe5 | folded-source-freeze | SUCCESS |
| [#1084](https://github.com/OpenPresentation/opf/pull/1084) RR-106: LibreOffice qualification of the PPTX export (opf#926) | no | libreoffice-and-import-compatibility | 3ba3dee92eeac29cbb5b7aa10733960e15d7fba0 | folded-source-freeze | FAILURE |
| [#1132](https://github.com/OpenPresentation/opf/pull/1132) RR-106: opf-preview-fonts --fontconfig writes the font-policy aliases; charts: picture for LibreOffice | yes | libreoffice-and-import-compatibility | 21b747c2f2676ecb9c7f94a5e9d5e0d62c88b9a8 | folded-source-freeze | FAILURE |
| [#1126](https://github.com/OpenPresentation/opf/pull/1126) SH-08: SmartArt PowerPoint users made imports into OPF | no | diagrams-and-smartart | 9570ebea55036ec3bca8687e6f0e21f74b8d1f44 | folded-source-freeze | FAILURE |
| [#1124](https://github.com/OpenPresentation/opf/pull/1124) LH-102: under-filled automatic stacks and promoted-region bodies center | no | layouts-and-content | 84d309869cce3df112ee45be820dd663368cf65d | folded-source-freeze | FAILURE |
| [#1123](https://github.com/OpenPresentation/opf/pull/1123) LH-46: a closing's details draw as a lead plus cards | no | layouts-and-content | 67490486efa29af76b45d060526642dd53aabd15 | folded-source-freeze | SUCCESS |
| [#1109](https://github.com/OpenPresentation/opf/pull/1109) SH-12: Graphviz DOT diagrams, read by OPF and laid out by pele | no | diagrams-and-smartart | 36979baa67540ce35ad340af31d85b53365a6378 | folded-source-freeze | FAILURE |
| [#1119](https://github.com/OpenPresentation/opf/pull/1119) SH-13: PlantUML diagrams, read by OPF and drawn by pele | no | diagrams-and-smartart | 4d5905db4bb515f79ef5beeca6d8946cec7cb166 | folded-source-freeze | FAILURE |
| [#1118](https://github.com/OpenPresentation/opf/pull/1118) LH-110: reference lines from English number words and German, French, Spanish, Italian, Portuguese and Dutch titles | no | chart-reference-lines | c4b0227f58bd934499ca5a85271f982fd3f847b0 | folded-source-freeze | SUCCESS |
| [#1114](https://github.com/OpenPresentation/opf/pull/1114) RR-105: native body wrap margin (#1089) and small-run title baseline (#1091) | no | native-pptx-tooling-and-fixes | b7aff87f8b9e65d9acd526dd90fd94f3d1e38511 | folded-source-freeze | SUCCESS |
| [#1098](https://github.com/OpenPresentation/opf/pull/1098) LH-179: the editor browser suites run on Windows, with a nightly Windows leg | no | release-portability-and-provenance | b425ae984ccd96f76e99c563c737ba3ad91977e1 | folded-source-freeze | FAILURE |

## Seven child PRs now recorded as merged into integration

| PR | Base | Original head | Recorded merge commit |
| --- | --- | --- | --- |
| [#1261](https://github.com/OpenPresentation/opf/pull/1261) | codex/integration-034 | 990c67920a26a5c9f19d685cc9ea28b9404ef959 | 764b63acd1cfb46e17c1d5437d1755538ad73d07 |
| [#1251](https://github.com/OpenPresentation/opf/pull/1251) | codex/integration-034 | 58e0d7939fc318119f5f81a8ba1455bbfab7f1cd | 58e0d7939fc318119f5f81a8ba1455bbfab7f1cd |
| [#1250](https://github.com/OpenPresentation/opf/pull/1250) | codex/integration-034 | 7ece2739f1fa1e629c47e71c464832e024917efb | 782a1534bf4bd76673fc33d577d55a95f49d885b |
| [#1249](https://github.com/OpenPresentation/opf/pull/1249) | codex/integration-034 | 372031577291116f3533225822082d1c2d61e1cd | 86573ef94a8095444a401abd262897f04135c2be |
| [#1248](https://github.com/OpenPresentation/opf/pull/1248) | codex/integration-034 | f9897413098c01d14c0c38e813790bd6897365ea | 169055e9b5431aab58d3cf16199bf9d2bc38af97 |
| [#1247](https://github.com/OpenPresentation/opf/pull/1247) | codex/integration-034 | 62e41b41451758458f532f06b0ca2085131de492 | 47a0bbcde55d80ecc47cb1da2d0caeeab5c439ba |
| [#1240](https://github.com/OpenPresentation/opf/pull/1240) | codex/integration-034 | 623e4dbc1c958132ae055b2c544e8f3b986fe85d | 81d1d5cce1f8230209035afed14fd0162373b1a3 |

This is a GitHub consequence of pushing the already-folded history to their integration base, not new source integration or main/release acceptance. Their source branches stay frozen. The [original49-PR ancestry report](opf-pr-handoff.md) remains unchanged historical evidence.

## All11private site PRs

Exact private branches/heads/titles are retained in each private repository recovery branch and the owner's prompt; only scope links are copied publicly.

| PR | Draft | Workstream / next action |
| --- | --- | --- |
| [Data-Advantage/openpresentation-site#216](https://github.com/Data-Advantage/openpresentation-site/pull/216) | yes | W11 G1/G2static source prepared; actual0.34interactive generation/preview owed |
| [Data-Advantage/openpresentation-site#213](https://github.com/Data-Advantage/openpresentation-site/pull/213) | no | W13content/media; exactR2cut/poster holds merge |
| [Data-Advantage/openpresentation-site#212](https://github.com/Data-Advantage/openpresentation-site/pull/212) | no | W13financecut; independent content/durablemedia review |
| [Data-Advantage/openpresentation-site#211](https://github.com/Data-Advantage/openpresentation-site/pull/211) | no | W13Actions dependency; review and qualify |
| [Data-Advantage/pptx-gallery#180](https://github.com/Data-Advantage/pptx-gallery/pull/180) | yes | W11H2/H3four additions authored; reconcile genuine0.34 |
| [Data-Advantage/pptx-gallery#179](https://github.com/Data-Advantage/pptx-gallery/pull/179) | no | W13Actions dependency; review and qualify |
| [Data-Advantage/pptx-gallery#171](https://github.com/Data-Advantage/pptx-gallery/pull/171) | yes | W11H1icons/shapes browsers; review/preview |
| [Data-Advantage/pptx-dev#206](https://github.com/Data-Advantage/pptx-dev/pull/206) | yes | W11CF18retiredconfig cleanup unmerged |
| [Data-Advantage/pptx-dev#205](https://github.com/Data-Advantage/pptx-dev/pull/205) | no | W13Actions dependency against MASTER |
| [Data-Advantage/pptx-dev#204](https://github.com/Data-Advantage/pptx-dev/pull/204) | yes | W11CF17CIselfownership; hostedPreview owed |
| [Data-Advantage/pptx-dev#200](https://github.com/Data-Advantage/pptx-dev/pull/200) | no | W11owner-held genuine0.33adoption/credentials/preview/auth/service |

## Current validation findings

Maintained exact-head gate for1267 actually exited1 at17:42:21Z. Run42864408344 has seven failed execution legs plus failed aggregateverify. One bounded7-call log collection is preserved on the public recovery branch; there was no rerun or polling loop. Observed failures: core source-docs-currency.test.mjs:14; renderer/golden legs report7raster baselines changed; PPTX rtl-layout.mjs:117, native-latin-slots.mjs:37(native body rich faces), and script-fonts.mjs:108(ar run CS expectation). Review each contract/current-output cause; do not assume all are the one locally known failure or weaken assertions.1270/1269/1268rollupSUCCESS reflects their selected doc/proposal scope, not feature/native/browser acceptance.1225wasPENDING at the snapshot.
