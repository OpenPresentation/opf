# Review sheets, 2026-11-07 (handoff)

Before/after review sheets (PNG) from the 2026-11-07 supervisor session. Each sheet shows OPF before (main) and after (the PR), and often Claude Design's version too. This branch only stores evidence, so it is never merged. The decisions on each sheet are in `docs/handoff/2026-11-07/README.md` on main and in each PR's body.

- `supervisor/`: one sheet per item, named by item (LH-175.png, SH-10.png, integration-033-templates.png, ...).
- `lh-184/`: LH-184 rounds v2 and v3, plus the first 37-slide review.
- `lh-186/`: LH-186's probes and template sheets.

- `tools/shapes/`: the scripts and notes from the shapes design folder (SH-09 to SH-19 sweeps, COM probes, the gate: `tools/shapes/sh-19/tools/gate.mjs`, `com-probe.ps1`, `com-checks.ps1`). The generated decks are left out because they're reproducible.
- `tools/sh-live-extras/`: the SH-20 to SH-23 sweep builder (`sweep.mjs`), its runner (`run.ps1`) and the tree measurement (`measure-trees.ps1`).
- `tools/agent-rules.md`, `plan.md`, `com-queue.md`: the supervisor's working notes. The current version of each is in `docs/handoff/2026-11-07/` on main.
