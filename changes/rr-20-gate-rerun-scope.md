---
type: changed
packages: [opf]
---

The shared PR gate supports opt-in `--rerun-once --rerun-scope all` to rerun successful prerequisite jobs within failing workflows, including coordinated graph selection. Failed-only remains the default; required checks, head guards and one-request-per-workflow deduplication remain unchanged.
