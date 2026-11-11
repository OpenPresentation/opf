# RR-115 persistence discard errors

The isolated branch starts from fresh origin/main and normally includes reviewed staging eebfdf8d07000b27187f10b822c41b7f147d255e. Folded chart7100 and browser3676 producers are untouched.

The actual baseline fails all five public fault-adapter tests: false success on main/earlier deletion failures, deletion beneath a prior write, a newer write during held deletion, and loss of the restorable offer. A fresh owned Edge probe of actual persistence-ui source also fails because an action returning false hides the banner. Original failures and screenshots remain lossless.

The narrow fix puts discard on the existing write promise chain, preserving main-then-earlier key deletion order. Pending/stashed/earlier recovery state clears only after all required deletions succeed. Failure returns false with existing error:'write' and retains the in-memory offer for restore or retry. The prompt disables decision buttons while pending and hides/announces success only for true. Existing keys, record version2 and Promise<boolean> stay unchanged. Restore, clear and storage adapters are not redesigned.

Vetoable decision: preserve the existing two-key order and report partial failure instead of claiming a transaction. If main deletion succeeds but earlier deletion fails, main can already be gone; the in-memory offer is restorable/retryable while this controller lives. No multi-key rollback or atomic recovery across a reload is promised.

Focused candidate results:5/5 new public tests PASS; unchanged maintained persistence.mjs PASS; the actual-UI-source Edge false→retry probe PASS without network/page errors. The existing maintained persistence-browser suite has an added actual host-adapter regression and passes syntax checking, but its full execution remains UNRUN until the coordinated gate. The small UI probe controls public action responses, so its success screenshot can retain the stub host's old error indicator; the actual controller independently clears error state on successful retry. This is a scoped UI contract proof, not a whole-application replay.

Changelog validation, syntax and the actual offline report parser PASS. The release-report contract remains RED only because the assigned RR115 row exposes missing RR113/RR114 rows in this base. The coordinator will fold their authentic sibling rows; the continuity assertion and original RED are retained, without placeholder rows.

All three distinct screenshots were inspected. Source/build/failure/control logs are bound to the exact source objects in receipt.json and retained in raw.json.gz. The required full aggregate is deliberately batched with reviewed chart/RR114/RR116/RR117 work; no separate full suite, CI, native, release or deployment claim.

Replay the archive/source facts offline with node docs/handoff/2026-11-09/rr115-persistence-discard/verify.mjs.
