# RR-112: saved foreign-PPTX autofit sizes

Worktree C:/opf-work/fontscale, branch codex/rr-112-fontscale-import, from fresh origin/main then normal fast-forward to 606cc9c26d622c747999e9f245c2b90402337ab0. This is a bounded import fix, not release/native acceptance. Never edit folded source 1228.

## Decision and behavior

Vetoable RR112-SAVED-FONT-SCALE: honor saved effective run points once after style inheritance, do not enable export autofit or change the OPF schema. Literal below-floor sizes are retained with review diagnostics. Local choices cancel inherited caches; only the existing unambiguous Body/idx cascade supplies inherited factors. Unknown/ambiguous bindings, malformed caches and unsupported1–100% factors do not guess or clamp. Table cells use their own body context. Fixed shape text still recomposes at OPF sizes and now reports that limitation. Signals include scaled size summaries and percentage-only spacing reduction; OPF paragraph spacing remains an explicitly reported reflow limitation.

Primary definitions: [NormalAutoFit](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.normalautofit?view=openxml-3.0.1), [FontScale](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.normalautofit.fontscale?view=openxml-3.0.1). The saved factor scales every resolved run; font and emphasis selection remain independent.120% line spacing minus10% reduction is110%, while point spacing and paragraph before/after spacing remain unchanged.

## Evidence in progress

Owned external raw path C:/opf-work/fontscale-evidence-20261109-01. The genuine baseline public importer returns 24/12 pt for a saved 55% foreign body instead of13.2/6.6 pt. The complete corrected31-group baseline passes6/fails25; candidate initially 31/31 PASS and now34/34 PASS after adding duplicate-index/relationship guards. Two owned measured/native exports and imported presentation hashes are exact across the Git-source 606 baseline and candidate. Initial fixture assumptions, packaging omission and floating summary failure are retained as history, not product acceptance. Baseline reconstructed module files are exact606 Git blobs in this worktree's ignored artifacts; the maintained builder copies those JS bytes unchanged.

Public bug: https://github.com/OpenPresentation/opf/issues/1229 (eventual source PR Closes #1229). Required mapped check, portable output inspection, peer source review and final sealing are pending. No Office/provider/API/CI/release/golden action. The existing PowerPoint process and chart approval hold remain untouched. Nothing here closes original issue1139.

## Independent review correction

The first frozen source 2f272375248b8158914fa967dedc0a665e2b83f0 passes34 controls and six existing import/body/list/shape/table suites. Peer review identified repeated local bodyPr disagreement between OPF and signals, and an unreduced percentage falsely called effective when the subtraction would be negative. Both new public groups genuinely fail on2f (34/36), with raw receipts preserved. The correction rejects repeated body properties for factor recovery and omits unrecoverable negative percentage spacing; it does not clamp or change export policy. Invalid reduction diagnostics now describe only the refused cache property, because a separately valid font factor still applies.

## Frozen source and completed qualification

Runtime/test source is frozen at 373d472f8d7d1be73cd4518a79a655fecc204979, tree24fd40f289ef676ef1fda4cf1dc6ae1f37751555, after independent source approval. This documentation descendant does not change that runtime, its regression or any exporter. The authoritative schema defines TextRun.fontSize as requested points (spec4233); docs/rich-text.md and composition.ts richMinimum/fitPlacedText retain the existing painted readability floor.

The required maintained check at 373, measured from reviewed 606, terminates exit1 in 1521.0 s:12/13 stepsPASS; all 281PPTXcontract scripts plus browser bundlesPASS1383.5 s; globaltypesPASS37.7 s. The only failed step is strict gallery-tracker freshness17/18. Its committed input count is111 while the newRR112 row makes112. Generator/tests/overrides/catalog/schema/evidence remain unchanged. No warning override or regeneration occurred. The original aggregate, exact table/exit and all 13 step logs (171011raw bytes) were snapshotted before documentation checks can reuse the log directory. Every original failure/skip remains in those logs. Coordinator may refresh font then gallery trackers in the integration PR because that broader integration actually changes the font overrides; this leaf does not invoke that allowance.

The source proof binds 13 owned paths, the exact85-file606 public-import baseline module,18 protected Git objects and measured/native export byte identities. Frozen code/fragment bindings remain373; the package README is separately qualified at this documentation commit. Schema/chart, core, renderer, vendor, fixtures/goldens, package pins, CI and other packages stay protected.

## Actual portable observations and limits

The first QA call has a setup refusal from using an old object catalogs option; no render is claimed for it. QA02 then genuinely fails its expected literal17.6/8.8 px assertion. Preserve both failures. Root and peer independently identify the existing richMinimum floor as the cause: the 6.6 pt run would paint8.8 px, so the 16 px floor enlarges the entire rich ratio. This is not a newly introduced core defect or a physical-size/native-fidelity pass. No minimum/cap/import flag or geometry workaround was added.

- Original unmodified foreign24/12 pt/y1 in input: actual OPF24/12 → 13.2/6.6 pt; actual default before/afterSVG glyph sizes32/16 px in both. Their baseline positions differ, so pixels are **not** declared identical. Default before/after OPF, SVG, trace and PNG are retained.
- One separately approved larger foreign body36/24 pt/y3 in input: same candidate 373, only saved factor100% → 55% changes. All other XML parts/bytes, role/content/order and non-size styles are identical. Actual requested points36/24 → 19.8/13.2; actual painted glyphs48/32 → 26.4/17.6 px. The authored y3 in keeps both members outside unowned heading inference; it is explicitly separate from the original y1 in observation. The already captured606/373 comparison of this same larger input remains separately attributed.
- Four key PNGs were viewed individually: all words and the bold/italic Beta survive, with no visible clipping or overlap. The pinned office pack uses its metric substitutions (Arial draws as Arimo); no installed/system/Office fonts, network or native application is involved. The SVG trace binds slides.2.blocks.0.text. Runtime hashes remain unchanged through acquisition.

Source/signal point retention, default adaptive paint and native Office fidelity are separate claims. The larger control never replaces the original default observation. Physical saved-layout fidelity is not certified here, and PowerPoint/Mac/Keynote qualification remains separate.

## Resume and publication

Run the offline verify.mjs from this isolated leaf after installing its exact dependencies. It checks transport/source/receipt identities and preserves the strict RED. It intentionally refuses unrelated companion changes in a combined worktree; it is not a global integration certificate. Required documentation-only qualification follows after this source note and packet are sealed, without rerunning the package suite. Its separate raw tail preserves its actual outcome.

Coordinator owns review, push and a source PR with Closes #1229, normal folding into the integration, the allowed coordinated tracker refresh, pinned goldens and final combined/native/release gates. No branch was pushed by this agent. Original issue1139, chart agreement, Office holds and all remaining site/publication/owner work stay open. No release or provider action occurred in this task.

## Documentation qualification and final evidence tail

The maintained documentation-only check atde563073bd0a969568a9766b0be91c343bec9442 (measured from373) is terminal exit1:9 stepsPASS, the same strict gallery-tracker freshnessFAIL, TypeScriptSKIPPED with no TypeScript change, and no package tests selected. The literal timing/table/exit/plan and only its10 selected step logs are retained in final-docs-checks.zip; the old package/type/stability logs left in the working directory are not relabeled as new runs. The main251-file packet remains immutable. This final evidence-only tail also records the actual post-seal verifier output and the refreshed RR112 work-queue text; no runtime, regression, package README, protected object or generated tracker changed after qualification. Final source/package identities remain source373 and the independently qualified README29fe4f7db.
