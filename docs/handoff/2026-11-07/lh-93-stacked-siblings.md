# LH-93 stacked horizontal sibling plots

Branch `codex/lh-93-stacked-siblings` starts from fresh main and merges approved v0.34 preparation `67698fadd1b729526718e3d9e4f74909dd2e465e`. Do not push after folding.

The earlier LH-93 fix shared clustered horizontal charts while excluding layered stacks. Stacked-bar and 100pct-stacked-bar now share their actual plot inset. After sharing, core refits each horizontal stack’s series names and value-label eligibility. Both preview/native export already consume the resulting `layer.plot`, marks and visibility flags; no duplicated renderer geometry, schema or data changes.

Decision (vetoable): keep type size and all source values. If series names no longer fit their segment starts, restore their existing full-size legend. If not every nonzero segment can carry its value, restore the numeric axis and its tick band. Re-share after those monotonic fallbacks, at most two per chart, then refresh positions at the stable geometry. Chart options and table-row alignment retain precedence. SH25 should anchor marks against the final plot from composition.

New core controls cover shared standard/percentage plots, exact final name starts/line height, restored original legend, axis/tick band/label refitting, negative/null data and option precedence. Native archive controls pin equal inner plot width/height/top, retain current data through import, keep names or restore legend, restore axis and delete crowded labels. Existing clustered and LH-125 contracts pass. Before/after sheets, affected bundled slide scan and coordinator native acceptance are owed before release. Goldens may only be refreshed once by the integration workflow.
