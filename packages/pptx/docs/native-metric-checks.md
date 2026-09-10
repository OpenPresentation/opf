# Bounded native metric checks

Generate fresh fixtures with Node 20.20.2 or 24.20.0 and local Calibri reference fonts. Each directory contains six decks of eight slides: wide/portrait and left/center/right. Font bytes stay local; only reference hashes and rendered pixels are retained.

```powershell
node test/native-metric.mjs generate artifacts/native-metric-new
powershell.exe -NoProfile -NonInteractive -File test/native-metric.ps1 -EvidenceDirectory artifacts/native-metric-new -Deck metric-1280-left
node test/native-metric.mjs compare-deck artifacts/native-metric-new metric-1280-left
```

Select exactly one deck per invocation: `metric-1280-left`, `metric-1280-center`, `metric-1280-right`, `metric-540-left`, `metric-540-center`, or `metric-540-right`. Each hidden helper has a 45-second default deadline and 60-second maximum. A timeout terminates only that helper, never Office or descendants, and does not establish fixture cleanup. Do not retry a blocked Office call. The parent rejects existing attempt directories; the worker rejects already-open fixtures. Only presentations demonstrably opened by this run may be closed. Run one Office verifier at a time and preserve all user documents.

Worker logs, progress, failures and native records are under `runs/<deck>`. A single-deck comparison is explicitly partial. After all six native decks complete, `node test/native-metric.mjs compare artifacts/native-metric-new` reads all six run records. It preserves the existing source/type checks, tab tolerance of 0.02 points, character-bound tolerance of 0.1 points, integer raster containment, isolated-mask coverage and inter-part collision gates. Failed comparisons write their results before exiting nonzero. Completion of native calls or source import does not turn a failed visual gate into a pass.

On 2026-09-10, both pinned Node runtimes completed six separate bounded native runs on PowerPoint 16.0.20326.20132. Each produced 144 correct original/saved/edited slide imports, zero character-bound outliers, zero inter-part collisions and complete isolated-mask coverage. Both reproduced **eight tab-position outliers**, maximum **0.0673828125 points**, and **one portrait/right native ink overflow**: slide 4's Latency label reaches x=497 beyond the accepted right edge of 496.8. The fidelity gate remains failed. No source text, tolerance, clipping or consumer offset was changed to conceal it.

The tab-stop coordinates remain precise in both original and native-saved DrawingML, while COM reports different character offsets. This rules out loss of the saved tab coordinates as the explanation; it does not by itself identify whether native shaping, character-bound reporting or both cause the discrepancy. The metric layout currently accepts advance-based line positions without the general text placement's outline clearance. A shared layout/measurement investigation remains necessary; these bounded-worker changes do not claim a product fix.
