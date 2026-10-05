# Changelog fragments

One file per change, instead of an edit to the shared `## Unreleased` block of `CHANGELOG.md`. Two pull requests then
never conflict on the changelog, and a release-prep pull request assembles the fragments into the release section
(RR-46).

## Adding a fragment

Create `changes/<slug>.md` in the pull request that makes the change. The slug is a short kebab-case name that starts
with the item id (`rr-17-viet-supplement.md`, `fix-patch-pointer.md`); fragments within a type are listed in slug order.

```markdown
---
type: fixed
packages: [opf]
---
RR-17 (output-changing for Vietnamese decks only): what changed and why, as one CHANGELOG bullet. Write the text of
the bullet without the leading "- "; indent nested lists by four spaces as in the existing sections.
```

- `type` is `added`, `changed` or `fixed`. Entries are listed in that order in the release section.
- `packages` names the changelogs the entry belongs to: `opf` is the root `CHANGELOG.md` (the core package) and `cli`
  is `packages/cli/CHANGELOG.md`; `[opf, cli]` puts the entry in both. `[]` (or no `packages` line) is for records,
  docs and tooling with no package change; it goes into the core changelog, which is where those entries live today.
- Do not edit `## Unreleased` by hand. It stays as an empty heading. The CI step "Changelog fragments" warns (never
  fails) when a pull request changes package code or the schemas and catalogs and adds no fragment. A change with no
  user-facing effect needs none.

`pnpm check:changes` validates every fragment (it runs inside `pnpm test`).

## Releasing

The release-prep pull request runs the assembler for each package it releases, then commits the result:

```sh
node scripts/changelog-fragments.mjs assemble --version 0.13.0 --package opf [--date 2026-10-09] [--summary "Patch release: ..."]
node scripts/changelog-fragments.mjs assemble --version 0.11.0 --package cli
```

It adds `## 0.13.0 (date)` under `## Unreleased`, writes the entries (and any bullet still under `## Unreleased`), and
deletes the fragments it used; a fragment that names two packages is kept until both changelogs have it. Pass
`--dry-run` to preview. The version must not already be in the changelog. See `docs/release-process.md`.
