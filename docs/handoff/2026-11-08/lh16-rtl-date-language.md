# LH16 native Latin date correction

The original1150source5c8 is folded/frozen. This derived branch starts from verified033main then normally merges accepted0341e454. It changes only native PPTX serialization and adds a regression, fragment and program log.

[Actual four controlled native observations](https://github.com/OpenPresentation/opf/tree/codex/rr105-final-evidence/docs/handoff/2026-11-08/native034-continuation) preserve the complete failed/effective input and Office evidence. Run-level rtl=0 alone has no effect; adding cs changes appearance but not range order. Changing only three Latin date a:rPr language tags to en-US makes Weeks2–5 read correctly. No Unicode direction controls, font-size changes, displacement or XML source mutation is proposed.

Vetoable scope: only timeline when labels, on an effectively RTL slide, containing Latin letters and otherwise only Latin/ASCII-digit/punctuation/space/symbol characters receive the existing protected en-US native run language. Arabic labels, numeric-only dates, other timeline parts and all LTR slides keep their existing route. The source OPF deck language is preserved.

The regression fails before on lang=ar-SA and passes after on Arabic/Hebrew milestone and duration cases; it checks complete editable date text, LTR paragraph/no shrink, base-language preservation, exact timeline import and current native date edits without changing numeric duration. Non-Latin/numeric controls use maintained automatic script-font preparation. Two initial incomplete test font-provider attempts are retained as test-fixture failures; no product assertion or font policy was loosened.

Final clean CLI output, actual Office save/reopen/import qualification, independent source review and assembled CI are still owed.


Required changed check:156.7seconds, seven steps pass; exact sparse painting fixture restored and only text rerun passes. PPTX contract stops at inherited9archive lock (237laterfiles unrun). Fourfocusedfiles pass including13script-language controls; oldduration fixture exposes a separate generated-Arabic-status automaticfont-preparation gap, now assigned to a new derived fix. Its attempted automatic-provider setup is retained in logs but not kept as a test-only workaround. Raw checked receipts.


Independent review found and fixed two genuine P2s: automatic date shaping must not promote its own protected en-US run to the base language when it is the only text; preferBaseRuns now has no observed base in that case, allowing existing provenance reconciliation to preserve the stored language. Untagged native observation still votes all runs, and an unprotected native base-language edit remains authoritative. A second before-failing regression covers minimal date-only decks, explicit-language-only text, per-slide overrides and native edits. Arabic-Indic and Eastern Arabic digits remain outside this empirically qualified Latin/ASCII domain. Fourfocusedfiles now pass, including13scriptlanguages. The separate generated-status glyph gap remains assigned and is not hidden by changing the old fixture.
