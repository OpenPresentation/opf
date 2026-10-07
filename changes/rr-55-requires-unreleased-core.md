---
type: changed
packages: []
---
RR-55: `scripts/release-train.mjs` supports the sibling CI gate `opf.requiresUnreleasedCore` (a package.json field that lets a sibling pull request skip only its packed install against published core while core is not yet released). `prep` deletes the field from the release-prep PR and refuses one above the train's core or that is not a version, and `plan` flags a release commit that still carries it. See `docs/release-process.md`.
