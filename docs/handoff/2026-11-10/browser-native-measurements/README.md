# RR-114 browser measurement preparation

Source branch: `codex/rr-114-browser-native-measurements`. Base `3aea758a19a794aba14aa991a3c2bbd4420e8da1` normally merges canonical integration, W03 successor `31e89778ce4abafeed960ca16e911f4d5e3ab703`, and Node W04 source `6fb439401b132ed8342041a343313ec5932d72bd`. No Office, release or site deployment was run. Full coherent mapped/browser/native acceptance remains pending.

## Actual browser defect and repair

The maintained-style real Chromium harness bundles the browser font loader, SVG renderer and PPTX exporter, uses the browser's actual `FontFace` API, and serves real pinned local font bytes. No mocked measurement or DOM substitutes for the renderer. With only the three initial faces the minimal source draws (Tinos 400, Gelasio 400 and Intos Display 700), original selected export refuses Aptos and safe export refuses Arial. Neither attempts measurement preparation or a lazy font fetch. The fully prepared browser oracle exports successfully.

The browser registry previously exposed no nominal-name metadata, so the exporter's demand-preparation gates did not recognize it. It also could not resolve an undrawn default role before native wrapping reached its additional measurement. Browser handles now expose genuine metadata-only resolution over their held and advertised lazy faces; the exporter uses it only for otherwise unresolved styles. Actual measurement still uses verified physical font bytes. Ordinary SVG measurement is unchanged.

Browser `ensure` now accepts the Node lane's explicit `measurementRequests` channel, separately from SVG demand analysis/cache keys, and prepares only the selected faces through the existing hash/fetch/FontFace/atomic-registration gate. Chosen-family and safe mapping reach the existing analysis through its established options. Shared type declarations describe the channel. Unknown faces and malformed requests reject without adding faces or poisoning a later export.

Vetoable decision RR114-BROWSER-MEASUREMENTS: use the same nominal-name capability as the Node demand loader and an exporter-only unresolved-style adapter. Do not change ordinary browser measurement, load a whole pack, invent asset endpoints, relabel a face or change native wrap geometry. Arimo is not a vendored browser asset: the test advertises the host's real hash-pinned Arimo files through the existing `extraLazyFonts` API. Only two required styles are fetched in safe mode.

Peer review found that a name resolver can return an unchanged request on failure. Consuming that as success would bypass the exporter's existing 500→400 / 800→700 normalization under metric policy. The adapter now requires an explicit successful finite `resolvedWeight`; Node's existing metadata fallbacks do not provide it and retain their original retry. The new public metric regression checks unsupported raw 500/800 requests and exact eager/demand XML equality.

## Actual results and remaining gates

- Real Chromium `156.0.8078.4`: three cases PASS. Selected export adds exactly Intos 400 with one pinned fetch; safe export adds only host Arimo 700/400; a safe-mode control with the host's ordinary Roboto fallback retains byte-exact SVG before/after native preparation. Native XML, selected names, import, repeated exports, source immutability and real loaded FontFaces are checked.
- Public metric-weight regression PASS (one group); strict workspace typecheck PASS.
- Existing `font-analysis-incremental.mjs` PASS, including all example-deck comparisons, the full Unicode classifier differential and browser-handle cache/edit counters.
- `lazy-faces.mjs` was mistakenly started briefly alongside the incremental control, then the owned test was stopped with Ctrl-C. Its exit 130 is retained; no passing result is claimed. It remains part of final required coverage.
- The first candidate selected case passed but safe mode refused the unadvertised Arimo source. After advertising the existing host source, safe native export reached the extra measurement but the test then tried an ordinary SVG with an unprepared undrawn Aptos role. The final test separates that three-face native-export case from the four-face ordinary-SVG control. Both original test/setup refusals are retained.
- The standalone real-browser test is wired at the end of maintained `test/browser-check.mjs`, after its previous owned browser/server close. The standalone test has run; the complete old-plus-new browser runner and full mapper remain pending.

The original native Latin-body test's one-face supplementation is separately removed after coherent integration. B07 visible glyph/order cases 05/06/09/10, current PowerPoint Save/reopen and final pinned golden review remain OPEN. These browser/archive results are not native PowerPoint acceptance.

## Correction to the earlier W03 mapped scope

The immutable `31e89778c` handoff and an initial coordinator message overstated the W03 mapper's `tests pptx` row as full package/browser coverage. Its unchanged raw `tests_pptx.log` proves that the test-only delta ran exactly three changed files: native Latin slots, RTL layout and script fonts. The 15/15, RTL and 13-language results remain valid. The full package/browser gate was not run in that W03 delta. W04's later 298-script result is a different source and does not qualify the combined W03 runtime. Keep the original receipt immutable and use this explicit correction.

Raw original failures, setup refusals, final results and source identities are retained in `raw-results.json.gz`. Final coherent checks and the schema lane's authored `lang`→`language` fixture migration remain required before integration acceptance.
