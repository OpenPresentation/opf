# Complete localized at-least comparisons

The old source fddc0991e4f154a7e2c0969a2c2a5509c5dcf953 returns no target for au moins cinq/fr, al menos cinco/es and pelo menos cinco/pt, while digit forms return 5. The narrow positive-prefix exemption in producer 40fcf45f6054852a0b19acfe4f59b566b228a20a restores their existing digit meaning without relaxing the bare-minus guard.

[Before: three failures](before.log), [after: all 41 focused tests pass](after.log). Each new control also covers percentage/family tags, bare-minus refusal, malformed/fraction/larger-scale refusal, signed cardinals and an actual composed target 5 line with complete unchanged source chart data.

[Exact existing native-input reuse](existing-witness-identity.json): all seven PNGs and all seven complete PPTX archives match the frozen 1169 hashes exactly; [CLI reports](cli-logs) and the replay helper are retained. These identical archive/image bytes already reside in [frozen 1169 evidence](https://github.com/OpenPresentation/opf/tree/aee237aaad5740afb731d88cc44b6c1160947a65/docs/evidence/lh-110-localized-references/after), so no duplicate files or new native acceptance are claimed. Existing parent native queue/input manifest remains valid.

Required check:changed passes build, Biome, browser safety, fragments, diagram images, hotlinks, skills, text, stability and typecheck. Full core 4,101 pass/1 inherited missing-template golden-keyset failure; all stored existing values agree. Catalog-free budgets await the maintained combined 034 refresh: composition 261353>256668, ids 455024>454914, pagination 454789>454689, patch 452988>452921, validator 448578>448547. No budget or golden is hand-edited. All seven existing frozen 1169 witness inputs were re-exported through the maintained CLI: every PNG and complete PPTX is byte-identical, allowing exact native-input reuse without another Office run.

[Changed-scope receipt](check-changed.log), [complete core log](core-full.log.gz), [budget receipt](budget.log), [hashes](hashes.json). Frozen1169 and 1171 sources are untouched. No Office, old-source push, CI watcher or golden generation by this agent.
