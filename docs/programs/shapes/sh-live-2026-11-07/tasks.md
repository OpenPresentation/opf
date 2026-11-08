# SH-20 to SH-23 acceptance tasks

The coordinator's unified cross-repository list is [opf#1139](https://github.com/OpenPresentation/opf/issues/1139). This is the concrete acceptance list for this lane; a source helper or process-safe native run alone does not close an item. No new live domain is enabled at this checkpoint.

| Item | Acceptance step | State / evidence |
| --- | --- | --- |
| SH-20 | Run original SH-19 gate without threshold changes on all 516 instances | Done; [gate](gate.json), all465 live node layouts/sizes pass, full gate201pass/264fail |
| SH-20 | Classify actual paint/geometry, text density, wrapping and baseline causes per candidate | In progress; existing eligible Latin domain passes, no broad reductions |
| SH-20 | Fix shared causes, request only affected native witnesses, set domains only when all measured eligible instances pass | In progress; spacing-only experiment rejected after native comparison; explicit paragraph-marker diagnostic prepared |
| SH-21 | Fit Basic Venn circles and inside/outside label boxes | Done geometry increment; all140frames within0.000101pt, [independent fixture](../../../../packages/javascript/test/fixtures/sh21-venn-native-geometry.json) |
| SH-21 | Define single-root list-level semantics and reject malformed jumps/forests without mutation | Done helper increment; [tree model](../../../../packages/javascript/src/tree-arrangement.ts), three source tests pass |
| SH-21 | Fit Organization Chart/Hierarchy including all foreground/background/connector shapes | Rectangle models done:200 Organization Chart +220 Hierarchy; connectors/freeform paint and actual topology still owed, inspect read-only seed before any further Sync |
| SH-21 | Add schema/catalog arrangement values org-chart/hierarchy/venn, shared composition/render/export and docs/skills/editor/MCP consumers | Owed; vetoable direction approved; helpers do not yet enable values |
| SH-21 | Preserve native SmartArt parent/level data semantics and qualify supported text/node edits, save/reopen and geometry | Owed; fixed coordinates alone are insufficient |
| SH-21 | Exclude unmeasured assistants/unsupported forests with explicit refusal or reported content-preserving fallback | Owed in composition; helper refuses these now, no silently reparented/drop claims |
| SH-21 | Review new slides at full body size, no shrink and short measures; regenerate goldens only through workflow | Owed after implementation |
| SH-22 | Measure real font slots, spacing and line bounds with live groups materialized | Done three-pair baseline; [raw03](native/sh20-baseline-03/), all seven source hashes unchanged |
| SH-22 | Isolate/fix shared exact-pitch versus single-spacing baseline behavior and Arabic horizontal placement | In progress; identical fonts proven, single-spacing change worsens matches; exact pitch retained |
| SH-22 | Rerun affected Japanese/Chinese/Arabic/Hebrew candidates, retain unchanged gate thresholds and record measured eligibility reasons | Owed; no script domain enabled/reduced |
| SH-23 | Review aee3d430f layout tables for9–12, preserve contained nodes and unique table identities | Done source review; staged on this branch, interpreter/native-part acceptance passes |
| SH-23 | Open source PR, fragment, burndown and log | Fragment/row/log staged; PR waits for coordinator's033 CI batching window |
| SH-23 | Add ninth node, retain text/geometry, SaveCopyAs and reopen, compare against ninth-entry table | In progress; ninth-node save/reopen structural pass, original visual alignment fail preserved; shared layout defaults fixed, fresh qualification owed |
| All | Full changed-branch/package checks and final native qualification on assembled release head | Owed after coordinator pause; prior run passes build/typecheck, known sparse-input/Windows symlink failures retained |

Vetoable: Basic Venn supports the measured1–7 set domain; trees use a single level-zero root with explicit child depths; assistants remain outside native eligibility until measured; SH-23 tables cover at most12 native-edited entries as documented. None of these choices silently clamps authored input or treats an unmeasured domain as qualified.
