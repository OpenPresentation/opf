---
type: added
---
FF-46 (opf#362; tests only): `test/font-gate-script-names.mjs` drives the editor's font gate with the 22 proprietary script, emoji, math and code-table names that pass the native visual comparison (`test/fixtures/script-name-families.json`, the table opf-render checks against core's policy and the FF-44 corpus). For each name the gate loads only the route's script packages, the registry resolves the name to its policy route with the policy `sizeAdjust`, and every sample draws in its route face with no other fallback (Sylfaen's Armenian and Georgian in their designated Noto faces; every mapped symbol code in the chain face that has it). It writes `artifacts/script-name-hosts/editor.json`, the evidence the core font tracker reads.
