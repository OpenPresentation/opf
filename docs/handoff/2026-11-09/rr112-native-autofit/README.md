# RR-112: saved foreign-PPTX autofit sizes

Worktree C:/opf-work/fontscale, branch codex/rr-112-fontscale-import, from fresh origin/main then normal fast-forward to606cc9c26d622c747999e9f245c2b90402337ab0. This is a bounded import fix, not release/native acceptance. Never edit folded source1228.

## Decision and behavior

Vetoable RR112-SAVED-FONT-SCALE: honor saved effective run points once after style inheritance, do not enable export autofit or change the OPF schema. Literal below-floor sizes are retained with review diagnostics. Local choices cancel inherited caches; only the existing unambiguous Body/idx cascade supplies inherited factors. Unknown/ambiguous bindings, malformed caches and unsupported1–100% factors do not guess or clamp. Table cells use their own body context. Fixed shape text still recomposes at OPF sizes and now reports that limitation. Signals include scaled size summaries and percentage-only spacing reduction; OPF paragraph spacing remains an explicitly reported reflow limitation.

Primary definitions: [NormalAutoFit](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.normalautofit?view=openxml-3.0.1), [FontScale](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.normalautofit.fontscale?view=openxml-3.0.1). The saved factor scales every resolved run; font and emphasis selection remain independent.120% line spacing minus10% reduction is110%, while point spacing and paragraph before/after spacing remain unchanged.

## Evidence in progress

Owned external raw path C:/opf-work/fontscale-evidence-20261109-01. The genuine baseline public importer returns24/12pt for a saved55% foreign body instead of13.2/6.6pt. The complete corrected31-group baseline passes6/fails25; candidate initially31/31PASS and now34/34PASS after adding duplicate-index/relationship guards. Two owned measured/native exports and imported presentation hashes are exact across the Git-source606 baseline and candidate. Initial fixture assumptions, packaging omission and floating summary failure are retained as history, not product acceptance. Baseline reconstructed module files are exact606 Git blobs in this worktree's ignored artifacts; the maintained builder copies those JS bytes unchanged.

Public bug: https://github.com/OpenPresentation/opf/issues/1229 (eventual source PR Closes #1229). Required mapped check, portable output inspection, peer source review and final sealing are pending. No Office/provider/API/CI/release/golden action. The existing PowerPoint process and chart approval hold remain untouched. Nothing here closes original issue1139.
