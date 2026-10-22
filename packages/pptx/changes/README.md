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
---
RR-17 (output-changing for Vietnamese decks only): what changed and why, as one CHANGELOG bullet. Write the text of
the bullet without the leading "- "; indent nested lists by four spaces as in the existing sections.
```

- `type` is `added`, `changed` or `fixed`. Entries are listed in that order in the release section. There is one
  changelog, so there is no `packages` line.
- Do not edit `## Unreleased` by hand. It stays as an empty heading. The CI step "Changelog fragments" warns (never
  fails) when a pull request changes `src/` and adds no fragment. A change with no user-facing effect (tests, tooling,
  records) may still add one when it is worth a line in the release notes.

`npm run check:changes` validates every fragment (it runs inside `npm test`).

## Releasing

The release-prep pull request runs the assembler and commits the result:

```sh
node scripts/changelog-fragments.mjs assemble --version X.Y.Z [--date YYYY-MM-DD] [--summary "Patch release: ..."]
```

It adds `## X.Y.Z (date)` under `## Unreleased`, writes the entries (and any bullet still under `## Unreleased`), and
deletes the fragments it used. Pass `--dry-run` to preview. The version must not already be in the changelog. The
release process lives in the core repository (`docs/release-process.md`).
