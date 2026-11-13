# RR-105 logical-anchor fixture repair — SOURCE ONLY

2026-11-10: new descendant of clean `d48fba96d8f59da959d588ba722be39bd0b96cfe`; active common gate90247 on `1c80183a2288a04f5506a23bb88ece278cde277d` remains untouched. This checkpoint is UNQUALIFIED: no product imports, tests, builds, renders, CI or native actions run here. Only syntax and diff checks are permitted.

The actual renderer suite stopped at115/192 in `pdf-harfbuzz-scripts.mjs`118: Arab/arab-joining glyph14 was at−257.25 while its independent reference assumes physical leftx10. The fixture sets directionRTL with default logical start atx10; corrected SVG/PDF semantics correctly make that the physical right edge. A fixture asserting physical leftx10 must use logical end for RTL. The already qualified six external-SVG anchor controls establish that relationship; product behavior and tolerances must not be rolled back.

Only the RTL branch of the two fixture markup helpers now adds `text-anchor=end`: the actual failing PDF corpus helper and the same source-confirmed assumption in `text-as-paths-scripts.mjs`21. The latter file was UNRUN after the first failure, not a second observed RED. LTR helper output is byte-identical. Corpus roster, skips, glyph IDs,0.02px tolerance, repeatability, Latin byte equality and full-text assertions are unchanged. This fixes reference placement while retaining every fidelity obligation.

The first combined failure/raw logs remain immutable under the coordinator's gate evidence. Root owns the replay and final current-source qualification after the active aggregate reaches terminal.

Local source checks: pinned Node24 `--check` passed both changed helpers; `git diff --check` passed. These are syntax/whitespace checks only, not an executed corpus replay.
