# Measured mixed authored-run ownership — source-only regression preparation

Fresh successor `codex/rr-105-measured-run-ownership` normally merges exact frozen combined source `c6d52fbe9f674663bf4194959298cbfbce69aa64`. Frozen fragment leaf57e800 and the active combined gate/runtime were not modified. No install, build, test execution or Office action occurred in this successor; only Node syntax and diff checks ran.

Static trace: `composition.ts` builds one RichTextFragment per authored run and tab segment. The exact one-run text `البند: Bonjour 1` is one non-ASCII fragment. `planNativeTextFragments` requires the whole candidate fragment inside an original-source Latin range and entirely ASCII; it therefore does not activate. The existing W03 CS source-span ownership handles the native script split instead. Consequently the new group reader does not receive a same-source Arabic carrier/Latin-word group for this exact current case. This is static evidence, not a new measured result or a cure claim.

Existing actual measured native-latin-slots coverage (passed in the frozen leaf's five neighbor files) already strictly round-trips one Georgia run containing `العربية 1 Bonjour 2 العربية 3`. It supplies related evidence, not qualification of the new exact example.

New automatically discovered package test `native-text-fragment-mixed-run.mjs` is UNRUN. It uses a real public fonts handle and two genuine public exports: one mixed authored run must retain exact JSON, one authored run and W03 boundary ownership; the two-authored-part spelling must actually activate the new four-shape fragment path and retain its distinct exact JSON. Five edited-native variants then require exact current UTF16 and retained bold/font/proofing/point-size edits, without spreading changed style across the original whole run or replaying stale text. No historical fixture or expectation was changed. Execution awaits the coordinator's release of the single heavy slot and a reviewed successor validation assignment.

## Executed root qualification

After the c6d aggregate completed, root normally folded test-only67b0f242 into bda1d7365fd6297a7d289036b9d47105c7c7d212 and executed both groups against the actual freshly built c6d product runtime. **2PASS/0FAIL/0SKIP**,608.170708ms; all five native edit variants ran. Original focus01 is retained. Strict authored-run JSON, active two-part four-shape control and current text/style ownership passed; no new product defect or native pixel cure is inferred. The subsequent combined changed gate remains separate.
