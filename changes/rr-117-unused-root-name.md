---
type: fixed
packages: [opf]
---

Reuse validation geometry when only an unreferenced presentation name changes, including decks using unrelated built-ins. A shared dependency-only variable walk preserves direct and transitive name references without expanding values. Full validation remains fresh; declarations, templates and unknown callbacks retain conservative invalidation, and the complete original input still passes unchanged cache guards and budgets.
