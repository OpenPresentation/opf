# RR-114: native-export font dependencies — stopped handoff

Owner stop/handoff request received before runtime implementation. This is source analysis, not a completed fix. No install, build, test, native/Office/browser call or release occurred in this lane. No persistent helper or owned job remains.

## Exact checkout

- Task: C:/opf-work/native-font-deps; branch codex/rr-114-native-font-dependencies.
- Fresh origin/main: a52dc9441f7eec9dc6f72debb174339758e1761e.
- Normally merged reviewed staging81f3bf800ac7edcdbd8073df9077ea706ee66145, producing fa954808b3b741ed5a02a7b12ed297881abafb0b.
- No other worktree, folded source branch, schema, font manifest, golden or generated file changed.
- Read AGENTS, opf-export, November7 working rules, current November10 handoff and the font/release program context.

## Existing confirmed failure

    {"slides":[{"title":"Title","text":[{"text":"Bonjour 1\nWelcome 2 ","lang":"ar-SA","fontFamily":"Georgia"},{"text":"Hello 2","lang":"ar-SA","fontFamily":"Times New Roman"}]}]}

The font-slot lane used loadFonts with pack office, substitutionPolicy visual, scripts auto and this presentation, then toPptx with that handle and bodyText native. Its frozen621 focused run passed14/15; the actual native-body case failed with font-unavailable, path slides.0.text, family Aptos, weight400, italicfalse. This lane read the retained source and actual log; it did not rerun the test.

Raw existing log: C:/opf-work/latin-cs-slots-qualification01/review621-focused.log. The stack enters nativeWrapBox through planOne/planNativeBody and the demand handle measurement guard. The separate font-slot successor supplies one pinned caller face to qualify its own capture path; that does not solve automatic preparation.

## Source findings

- PPTX src/index.js calls fonts.ensure with preserveChosenFamilies and optional safe-family mapping before export.
- Renderer font-demand.js uses createFontAnalysis.faces for faces composition/SVG actually uses. Fully rich text can omit the undrawn base body role.
- PPTX native-body.js:nativeWrapBox additionally measures the base style's lowercase alphabet for its existing wrap slack. That actual request needs Aptos400 here.
- Native-body defaults also name that base role for blank/appended paragraphs. Keep the native chosen name Aptos; the pinned Intos face remains a policy measurement stand-in, never a renamed native family.
- The native planner is synchronous; preparation is asynchronous. Resolve that boundary without changing wrap heuristics or measured geometry.
- Font-analysis caches depend on document/options/selection metadata. Do not poison ordinary SVG cache keys or recompose every unchanged export.

## Unimplemented proposal and questions

Prefer a small explicit exporter-to-loader channel for additional measurement requests, separate from OPF properties and ordinary SVG options. Requests carry actual text/size/style and follow the same aliases, substitution and safe-family mapping as real measurement.

Collect only native planner dependencies where actually requested, after existing eligibility guards. Prepare those selected faces from the existing demand universe, then use the unchanged native wrap calculation. Do not load all three design roles or all53 office faces, rewrite geometry, relabel Intos, catch arbitrary provider failures as success, or add eager renderer/font I/O to custom/no-font export.

No concrete API or collection mechanism is implemented or accepted. Resolve these before coding:

1. Can a narrow collector expose the alphabet request without duplicating eligibility or full composition?
2. Extend ensure with request data, or a separate incremental method? Preserve serialization/error recovery and unknown-style refusals.
3. How should older/custom handles without the capability behave? Preserve actual measurement/provider contracts.
4. Inspect native-title/other exporter-only measurements for the same cause; do not expand scope speculatively.

## Acceptance and resume

Add a changelog fragment, RR-114 burndown/progress entry and meaningful package test. Prove public native export succeeds without manual supplementation; ordinary SVG retains its small initial subset; native preparation adds only needed defaults and repeated export adds nothing; safe mapping, mixed families/weights, custom/no-font providers, selected PPTX names, current text/import and wrap geometry remain correct.

Resume only with the coordinator's single heavy-job slot. Pinned Node24.20 is C:/Users/micha/AppData/Local/npm-cache/_npx/00a8f3ae68dc15e1/node_modules/node/bin/node.exe; pnpm10.33.2 is C:/Users/micha/AppData/Local/npm-cache/_npx/334030cfead2389c/node_modules/pnpm/bin/pnpm.cjs; shared store is C:/opf-work/.pnpm-store.

Then install with the frozen lockfile, preserve/reproduce original RED on unchanged runtime, implement the reviewed fix, run focused checks and check:changed against81f3bf800ac7edcdbd8073df9077ea706ee66145, and return exact source/results to root. No mapper/package test started under the stop request. Other B07 ordering/glyph defects remain open.