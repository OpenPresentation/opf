# Logical-vocabulary fixture qualification, 2026-11-11

The three approved test-fixture repairs passed their actual direct boundary/browser checks. The single maintained aggregate remains **RED: 8 passed, 2 failed, 3 unselected**. After restoring only seven declared frozen Git blobs, the separate text replay passed; the tracker replay remains RED on strict freshness in this local sparse evidence checkout. No tracker policy, catalog data, generator or golden was changed.

Tested source: `f73d20d5bc9570d3bd74cec61f79ce85b6013749`, tree `a95acd5d971efbe9ba2a58aaf5c3b8c117e418c5`, base `9a20aed56f2d1a762c3a88ab24f8cc25d849d61f`. The original PPTX-only checkpoint `f39e981267ddf9e1e25244b3732a2178cabcd258` and its source-only note remain unchanged. These checkpoints change three tests and documentation, with no production, schema, dependency, fixture-lock or tolerance change. The retained inverse proofs identify the exact substitutions.

| Actual command | Result | Elapsed |
| --- | --- | --- |
| Own pinned frozen install / package build | PASS / PASS | 2.286s / 6.635s |
| Full-only `dependency-boundary.mjs` | PASS; 24 alignment cases, 168 cells; structural corpus 149 decks / 966 slides | 72.811s |
| Full-only `zip-bundle-boundary.mjs` | PASS | 0.400s |
| Actual Chromium `rich-flow-browser.mjs` | 30/30 PASS; zero page errors or external requests | 1.213s |
| Maintained editor playground build | PASS | 1.457s |
| Actual Chromium full `source-pane-browser.mjs` | PASS; warning/path, embedded design, cursor, edit/roundtrip and Undo assertions retained | 8.248s |
| One `check:changed --base 9a20…` | RED: 8 PASS / 2 RED / 3 unselected; all 317 PPTX contracts PASS (815.5s) | 833.386s |
| Separate `check:gallery-tracker` replay | RED: 17/18; strict freshness remains unresolved locally | 0.965s |
| Separate `check:text` replay | PASS: 7 controls; 10,521 files valid | 2.503s |

The original aggregate failures were missing declared historical inputs. `seven-declared-restoration.json` records the ONLY seven restored paths, frozen Git blob OIDs, modes, byte lengths and SHA-256 hashes (218,999 bytes total). Sparse configuration and logical index entries remained unchanged. Both first failures and both separate replays are retained losslessly in `selected-logs.zip`; replays do not replace or relabel the original aggregate. No aggregate repetition, bulk hydration, tracker regeneration or warning-policy override occurred.

The remaining freshness failure is an **unresolved local sparse-input limitation**, not a proved product defect or PASS. The coordinator reports no tracker failure in the original full-checkout 9a20 CI, and this fixture wave changes no tracker/catalog implementation or data. Complete tracked input closure in final CI must qualify freshness; this packet does not.

`commands.json` binds each actual argv, exit, source/tree, log digest and runtime comparison under Node 24.21.0 / pnpm 10.33.2. The 609 files from this worktree's own compiled packages remained byte-identical throughout the focused checks, mapper and replays. All 217 JavaScript files in the four domains covered by the coordinator's 301-file reference (`javascript`, `gallery`, `render`, `pptx`) match exactly, including membership. The other 191 JavaScript files in CLI/editor/MCP have recorded own identities but no supplied comparison baseline. This is no whole Git/packages tree identity claim; the original e092 performance measurement remains separately bound.

`source-inputs.json` records source/schema/lock/selected playground asset identities; its top-level asset list is not a complete font/resource closure. The dependency boundary substitutes assets and fonts for structural coverage; it does not qualify typography or Office fidelity. This packet contains public local test evidence only, with no private-site inventory, owner workload or new raw Windows/Office evidence.

The Mac heavy lease was released after the two replays. No further checks are part of this metadata checkpoint. The coordinator will cover the integrated metadata and independent native tooling successor with one maintained native/doc delta based on f73; no second 317-contract aggregate is claimed here.
