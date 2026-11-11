# Actual browser CI repairs: original run

The sourceac837 browser batch completed12commands:11PASS/1RED. The generated reference refresh and --check, breaking-change declaration check, playground build, design-controls(98checks), design-gaps, canvas-fonts, phase0keyboard, JSONkeyboard(325cases), YAMLkeyboard(186cases), and renderer plain-whitespace allPASS. Markdown passes190cases and fails exactlytwo stale expectations; the first unmodified logs and receipt are archived here.

M-OPT-009 still expects removed regionleft, while actual authoritative completions offerfirst/second and promotedstart/end. M-SNP-007 expects oldLeft/Right placeholder text; approved schema integration3f6160cf6 already explicitly changed the maintained snippet's generated placeholder content toFirst/Second. The follow-up updates only these exact expectations. It keeps the original keyboard events, complete emitted Markdown assertion, test roster, performance checks and timeouts, and additionally forbids left/right aliases. No user-authored literal is rewritten.

Original JSON performance checks observe maximum19ms completion and15ms paint; YAML maximum26ms completion/15ms paint. All original budgets remain. Chromium158.0.8127.18 uses the actual Mac keymap. Subsequent Markdown verification remains separately recorded.
