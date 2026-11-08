# LH-110 complete at-least comparisons

Fresh-main branch `codex/lh-110-at-least` normally fast-forwarded to approved 034 fddc0991e4f154a7e2c0969a2c2a5509c5dcf953. Frozen #1169 is untouched. This separate correction addresses the independent review finding: “au moins cinq”, “al menos cinco”, “pelo menos cinco” returned no reference while their digit forms returned 5.

Vetoable decision: exempt only those complete locale-specific positive comparison prefixes from the existing bare-minus guard. Keep the first comparison-language guard, entire-cardinal parser, percent/range rules and refusal of bare minus, malformed phrases, spoken fractions, unsupported scales/families. No text, font, geometry policy or data is changed; authored chart.highlight remains authoritative.

The three direct regressions fail on genuine unchanged fdd source and pass after the correction. Each checks word/digit and percentage/family-tag equality, bare-negative refusal, malformed/fraction/larger-scale refusal, unambiguous signed cardinal and actual composed reference line with unchanged chart data. All 41 focused existing/new localized controls pass. Before/after raw logs are retained under docs/evidence/lh-110-at-least. Required check:changed and exact existing seven-witness CLI reuse proof follow. No Office, old-branch push, golden regeneration or CI watcher by this agent.
