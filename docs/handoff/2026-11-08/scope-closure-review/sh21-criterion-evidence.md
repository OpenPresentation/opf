# SH-21 exact criterion, code and remaining work

The original row was introduced in commit `aee3d430f3dd4b0509e0b3851d8b1078f12d2b1f`, dated **2026-11-07T13:41:00-08:00**. Exact acceptance text at `docs/programs/shapes/burndown.md` (currently line 26):

> Each layout is written live only inside the domain its COM sweep passed (node rectangles within 0.1 pt, SH-07's gate); OPF's Mermaid drawing elsewhere

The item description says: “Org charts, hierarchies and Basic Venn as live SmartArt: PowerPoint's Organization Chart, Hierarchy and Basic Venn measured through COM and fitted in core, then drawn by OPF where the fit is exact”. The acceptance text is conditional. It does **not**, by itself, promise that every arrangement/count/script becomes live. The export rule in November 7 `working-rules.md:47` authorizes live SmartArt only if identical, otherwise editable shapes/text, otherwise SVG. The current editable production tier complies with that policy. It is therefore inappropriate to classify the absence of promotion alone as a supported product defect or an automatic release blocker.

However, the lane has an explicit unfinished acceptance task, beyond the conditional item title. `docs/programs/shapes/sh-live-2026-11-07/tasks.md:14` states:

> Preserve native SmartArt parent/level data semantics and qualify supported text/node edits, save/reopen and geometry

Its state is “In progress”, retaining full02/Venn04 failures and saying parent/node/text/edit/save/reopen is still owed. This is a live qualification obligation, not satisfied by the eleven production **editable-shape** cases.

Current executable guard:

- `packages/javascript/src/arrangements.ts:534–537` reads `domain.count[kind]`; if absent, returns `${SMART_ART_NAMES[kind].layout} text and edits are awaiting native qualification`. `SMART_ART_DOMAIN.count` has the six existing families and no org-chart/hierarchy/venn entry.
- `packages/pptx/src/smart-art.js:224–232` delegates production live eligibility to that shared guard. There is no accidental enabled domain.
- `packages/javascript/test/sh21-arrangement-composition.test.mjs:12` explicitly requires `/awaiting native qualification/`.
- `packages/pptx/test/sh21-native-arrangements.mjs:14` asserts no `ppt/diagrams/` parts and a `smartart-unavailable` diagnostic with that reason. This is positive coverage of the authorized editable tier, not evidence of live qualification.

What is known negative versus unrun:

- Original org3 cached connector-order failure was reproduced and corrected by a strict shared ordering regression. It is historical failed evidence.
- Full02 hierarchy5 materialization/count guard failed; a later fresh hierarchy5 measurement passes but does not explain the earlier failure.
- Venn04 completes Venn1 then fails Venn2 with two semantic nodes and zero GroupItems. This is an actual materialization failure; it is not proof that every possible Venn live domain is impossible.
- Token-only identity hypotheses remain unexecuted. Complete intended count/design/script materialization/text/paint/geometry gates and real parent/child/level/text edits plus save/reopen are still owed. The direct data-model tests and measured rectangles do not substitute for those native runs.
- The immutable experiment producer/evidence is `77cbe3b41f2fb647cf014cfd1008d053165f7b3b`, branch `codex/sh-21-qualification`, NEVERMERGE. See `docs/handoff/2026-11-08/sh21-draft.md:19–21` and the preserved materialization review in `docs/programs/shapes/sh-live-2026-11-07/product-pilot-review/materialization-review.md`.

Recorded staging decision, not invented by this audit:

Commit `9b066b2dbcdaa2ba571e58780fd4405cd683ec4f`, dated **2026-11-08T00:56:24-08:00**, added the coordinator-approved vetoable decision in `docs/handoff/2026-11-08/sh21-draft.md:15`:

> keep new live eligibility off until every measured instance in a candidate-specific domain passes. Ship/qualify editable-shape output separately from future live eligibility. Do not silently narrow the live program to the passing subset.

The November 7 decisions file likewise says to keep all new live domains unavailable until product exports, parent/node edits and save/reopen pass the unchanged native gate. These decisions establish a staged editable-tier delivery. They do not contain an owner declaration that all remaining live work is completed or removed from the original two-release goal.

Concrete next scope action: root should reconcile the original remaining live qualification task with this recorded staging decision and the user's full two-release scope. Keep its current state visible. If the original goal requires completion now, the next technical work is to diagnose the retained materialization failure and qualify an explicitly bounded intended domain plus actual edits/save/reopen before adding any domain entry. If the staged future lane is accepted as the intended completion boundary, record that explicit scope judgment and retain the unqualified live work as open. This audit makes neither decision and does not authorize a new Office run.
