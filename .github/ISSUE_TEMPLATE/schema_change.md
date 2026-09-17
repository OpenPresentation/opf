---
name: Schema/catalog change proposal
about: Propose a change to the OPF format — spec/schemas or spec/catalogs
title: "[Schema]: "
labels: schema-change
assignees: ""
---

## Motivation

What problem does this change solve? Why can't it be solved with a catalog record, design override, or extension field instead of a schema change?

## Proposed JSON shape

Show the proposed shape as it would appear in a `.opf.json` document, and/or the proposed diff to the relevant `spec/schemas/*.schema.json` file(s).

```jsonc
// example
```

## Breaking or additive?

- [ ] Additive — existing valid documents remain valid.
- [ ] Breaking — existing documents may need to change (explain what breaks and the migration path; a corresponding entry under `docs/migrations/` will be needed).

## Catalogs affected

List any catalog kinds (`spec/catalogs/<kind>/`) whose records need to be added, changed, or removed as part of this proposal, and note whether their `index.json` files need updating.

## Alternatives considered

Any alternative shapes or approaches considered, and why this one was chosen.
