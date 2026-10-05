---
type: changed
packages: []
---
RR-53 (repository tooling; no package change): consumer-driven contract suites. On a pull request the `Coordinated public packages` shards run each sibling's `npm run test:contract` (opf-render, opf-pptx, opf-editor: the part of their suites that exercises core's APIs; `test/suites.json` `contractExclude` lists, with reasons, what it leaves out) instead of its full `npm test`; `merge_group`, pushes to `main`, a new nightly schedule and manual runs keep the full suites, and so do the roller's branch, a lock change, a change to the tiering and the label `ecosystem-full`. Check names and the `packages` aggregator are unchanged. A failed full run on `main` or nightly also opens a `main-red` issue (closed by the next green run). See `docs/ecosystem-development.md`.
