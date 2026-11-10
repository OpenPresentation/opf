# RR-114 native measurement dependencies — Mac successor

This successor starts from fresh main `a52dc9441f7eec9dc6f72debb174339758e1761e`, normally merges canonical integration `7618e916dacc166463cddf5f2ea029f523bbe51d`, then the analysis-only PR1270. It does not modify the frozen font-slot lane or assert native PowerPoint acceptance.

The untouched build reproduces the public-API failure in [baseline-probe.log](baseline-probe.log): `loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation})` prepares three drawn faces, but `toPptx(..., {fonts, bodyText: 'native'})` then measures the undrawn Aptos400 role in `nativeWrapBox` and throws `font-unavailable`.

Vetoable decision **RR114-NATIVE-MEASUREMENTS** adds explicit `{text, size, style}` dependencies to the serialized Node `ensure` channel. Additional requests are removed from SVG options before analysis/cache identity is computed. The existing native planner collects its actual alphabet measurement only after its current body eligibility and line checks. The async slide exporter prepares it before running the unchanged synchronous wrap calculation. Requests already use the exporter's chosen/safe measurement wrapper; loader selection applies its existing aliases and substitution policy once. Native chosen-family names remain unchanged. A per-export set avoids preparing duplicate requests. Unsupported bodies do not cause default-role loading. No whole-pack loading or heuristic changes are used.

Focused regressions cover public native selected/safe exports against exact eager slide/theme XML, actual native body shape presence, imported text/style equality, preserved outlined SVG, bounded incremental faces, repeat export, in-place style/text edits, aliases, custom and no-font providers, missing/malformed requests and queue recovery, and rejected-body behavior. Their execution status is pending until recorded below. Existing native wrap, demand, fault and optional-renderer controls must also run. Required `check:changed` remains pending.

Node24.21.0 and pinned pnpm10.33.2 are used. The first build attempt hit the unrelated global pnpm executable; only its exact owned parent/child PIDs were stopped, and the pinned task-local shim build passed. No Office, browser, golden regeneration, release or merge ran.

## Actual source qualification

Implementation source is `6fb439401b132ed8342041a343313ec5932d72bd`. The source is pushed on `codex/rr-114-native-deps-mac`. Root and a separate font-lane reviewer found no Node-channel source blocker. A distinct browser-lazy preparation gap is assigned to W04B: browser registries do not currently expose Node demand's `fontNames` capability, so this Node correction does not establish browser font preparation or browser native export acceptance.

- New public regression suite: [9/9 PASS](logs/focused02.log), including a genuine wrapped engineering-capacity-planning title and an assertion its title-path measurement dependency ran. The initial eight-case pass is also retained.
- Affected neighbors: [37/37 PASS](logs/neighbors.log) across nine files. This includes demand/failure/private-glyph controls, exact eager/native/script comparisons, rich body import, optional-renderer custom-provider behavior, 200 native bodies and 38 native wrapped titles with unchanged wrap margins.
- Required canonical delta: [10 PASS / 3 RED](logs/changed02.log), 13 steps / 1,183.8 seconds. [Strict root types PASS](logs/mapped-types.log); [all 298 PPTX contract scripts and the browser bundle build PASS](logs/mapped-pptx.log), 924.8 seconds. This is a bundle build, not an actual browser or native application run.
- The renderer contract passes its first 58 scripts, then [golden-gate refuses seven raster mismatches](logs/mapped-render.log) at ordinal59/188; 129 later scripts are unrun. No hashes/tolerances were changed, no local golden regeneration ran, and this result does not attribute those mismatches to a specific source change. Final coherent pinned golden review and remaining renderer acceptance stay open.
- The other two original REDs are retained exact: [gallery tracker missing declared sparse evidence](logs/mapped-gallery-sparse.log), and [text guard missing the historical painting-Linux.json.gz](logs/mapped-text-sparse.log). Exact Git blob hydration and only those narrow replays are recorded separately below; the aggregate is not relabelled green.
- The [original sandbox slot-lock refusal](logs/changed01-slot-refusal.log) occurred before any build. The successful normal escalation then ran the full required delta once. There is no aggregate retry or duplicate observer.

No Office, native visual/glyph acceptance, browser UI, golden regeneration, release or integration merge occurred in this lane. Existing bidi/order defects remain separate.

## Exact sparse-input recovery

A [byte-verified manifest](hydration.json) binds 1,844 materialized files to source6fb Git blob identities (47,022,080 archive bytes). These are the gallery tracker's declared native/limitation/proof inputs, the native/powerpoint JSON/Markdown corpus its verifier scans, and the text guard's historical compressed fixture. No file was stubbed, no index/source guard was disabled, and no generated tracker changed.

Only the two failed sparse checks were replayed: [gallery18/18 plus863-record freshness PASS](logs/gallery-replay.log); [text7/7 plus11,599 valid files PASS](logs/text-replay.log). Original10PASS/3RED remains literal; final renderer/pinned golden/browser/native gates remain open. [Source and raw-log hashes](source-and-log-hashes.json) bind the implementation/test files and retained outputs. The source/test bytes remain exact6fb; subsequent commits only record results and decisions.

These results qualify only canonical7618 plus the W04 Node successor source6fb. They do not include the W03 font-slot runtime, W05 schema changes or W04B browser successor. The final combined source must run its coherent package/platform/native/browser gates. The coordinator will fold reviewed source; no extra branch PR or duplicate remote CI is started here.

Final results-only metadata delta against source6fb: [7 PASS / type SKIP](logs/metadata-check.log), 23.6 seconds. No package or type change was present in that delta; no package suite was repeated. All source/test bytes in the hash manifest remain exact6fb. No owned test/watcher/server process remains after this lane's completion.
