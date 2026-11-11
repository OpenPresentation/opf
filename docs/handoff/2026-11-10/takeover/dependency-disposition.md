# Dependency and content disposition — active review

All nine dependency PRs and both content PRs from the takeover remain accounted for. This record distinguishes source review, checks, merge, and qualification. No runtime upgrade is accepted merely because Dependabot proposed it.

| PR | Exact reviewed scope | Current disposition / next gate |
| --- | --- | --- |
| OPF1241 | pnpm/action-setup6.1.0→6.1.1, one golden workflow SHA | Merged7fb6140804f969550e3a9c9d52916b7610844917 through exact-head required-all gate; default commit verification running. |
| OPF1242 | Playwright1.64.1→1.65.0 in4package manifests/lock | Source review found pinned Docker golden/browser image unchanged. Not integrated; must coordinate every maintained pin and browser/golden environment before acceptance. |
| OPF1243 | NotoColorEmoji0.4.7→0.4.8 across render/PPTX/editor+lock | Not integrated; actual font-byte/license/manifest and selected raster companion compatibility review required before final golden batch. |
| OPF1244 | pdfjs-dist6.4.299→6.5.438 in renderer/editor+lock | Source review complete; affected native-PDF/editor checks and final dependency batch still owed. |
| OPF1245 | Biome2.6.4→2.6.6, lucide-static1.68→1.70, workerd20261030→20261106, parse-xml5.0→5.1, fast-xml-parser5.11.2→5.12+lock | Own candidate normally merges exact source; generator/pinned icon and production-parser test updates required. Actual icon deltas, parser/edge/lint/packed checks remain pending. [Review](../dependency-integration/README.md). |
| OPF1246 | MCP ext-apps1.7.5→2.0.4+lock | Actual proposal omits required client/core2 peers with autoInstallPeers:false. Pinned upstream migration/API/source review done; explicit View peer preparation and isolated server/API/browser/CSP/host-download checks remain pending. [Review](../dependency-integration/README.md). |
| Main site Actions patch | Only official pnpm/action-setup6.1.1SHA | Merged through exact-head required-all gate; production exact-tree guard then refused the stale Preview tree. A source-only revert is prepared on current main; no upload occurred. Reapply only after the actual combined tree is qualified. Detailed source stays private. |
| Gallery Actions patch | Only official pnpm/action-setup6.1.1SHA | Merged through exact-head required-all gate; default commit verification running. Detailed source stays private. |
| DEV Actions patch | Only official pnpm/action-setup6.1.1SHA | Exact-head gate held by failed Native Preview; no merge. Private causal configuration/qualification continues. |
| Two main-site finance content PRs | Seven-slide fictional finance deck, seven-operation patch, blog+media | Source review confirms internally consistent scenario math and explicit historicalCLI0.27video provenance. Durable exact MP4/poster availability and independently verified source/media remain required; no content merge yet. |

The official annotated pnpm/action-setup v6.1.1tag was dereferenced through GitHub to73e46992e05b19abd31f2f3c20e0e7370d762115, matching every proposed Actions pin. Release notes describe bootstrap/store/cache fixes. One maintained batch merged only the three fully green source-reviewed PRs; the fourth red result is retained.

The two content PRs and three private dependency details remain in their access-controlled repositories. This public record contains only the scope already named in the owner's takeover inventory.
