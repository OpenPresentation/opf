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
- `packages` names the changelogs the entry belongs to, one name per package of the monorepo: `opf` is the root
  `CHANGELOG.md` (the core package, `packages/javascript`) and `cli`, `render`, `pptx`, `editor`, `gallery` and `mcp` are
  `packages/<name>/CHANGELOG.md`; `[opf, render]` puts the entry in both, and a change that spans packages is one
  fragment naming each of them. `[]` (or no `packages` line) is for records, docs and tooling with no package change; it
  goes into the core changelog, which is where those entries live today. Any other name fails `pnpm check:changes`, as
  does naming a package whose changelog is not in the repository yet (`changes/config.json` lists the seven targets).
- Do not edit `## Unreleased` by hand. It stays as an empty heading. The CI step "Changelog fragments" warns (never
  fails) when a pull request changes package code or the schemas and catalogs and adds no fragment. A change with no
  user-facing effect needs none.

`pnpm check:changes` validates every fragment (it runs inside `pnpm test`).

## Declaring a gallery drawing change (`drawing`)

A change to `packages/gallery` that makes an existing record draw differently, or removes a record id, is declared in its
fragment (MR-35, the gallery's stability rule on the shared 0.x line):

```markdown
---
type: changed
packages: [gallery]
drawing: ["layouts:hero", "themes:minimal"]
---
Moved the hero layout's media region; the minimal theme follows its color scheme.
```

- Each entry is `<kind>:<id>`, the kind in camelCase: `layouts`, `themes`, `colorSchemes`, `fontSchemes`, `narratives`,
  `audiences`, `purposes`, `tones`, `chartTypes`, `languages` or `socialPlatforms`. The field is valid only on a fragment
  that names `gallery`; `pnpm check:changes` rejects anything else.
- `pnpm check:stability` draws the `latest` dist-tag release of `@openpresentation/gallery` and the candidate with the same
  renderer and compares them. A changed or removed id that no fragment declares **fails the pull request** (a color scheme or
  font scheme change also changes every theme that uses it: declare those too); a declared id that did not change warns; new
  ids always pass.
- A declared drawing change, a removed record id or a `CATALOG_SCHEMA` change makes the release a **minor** train at least,
  never a patch: `scripts/gallery-stability.mjs` exports `minimumBump` and `gateVersion` for the release script, and
  `pnpm check:breaking` accepts a removed record id only with that bump or a gallery fragment declaring it.
- `assemble` adds the declared ids to the gallery changelog bullet, so the release note carries them.

## Naming the slide that shows the change in an app (`native`)

A change that alters the exported `.pptx` is looked at in PowerPoint, Keynote and LibreOffice Impress, on a slide that shows
it. The fragment names that slide (NT-07), so a native-app run reads the list instead of the whole changelog:

```markdown
---
type: fixed
packages: [pptx]
native: [coverage-charts#16, chart-type-sampler#1]
---
Chart data labels keep their number format in the exported file.
```

- `native: [<deck>#<slide>, ...]`: `deck` is the `id` of a deck in `scripts/native-acceptance/qualification/manifest.json`
  or the path of an example under `examples/` without its extension (`technical/shapes`); `slide` is a positive whole
  number. `pnpm check:changes` fails on a malformed entry and on a deck that is in neither place.
- `native: none` with `native-reason: <one sentence>` says the change does not alter the exported file, or cannot be seen
  in an application, and why. Either key without the other fails the check.
- Both keys are optional; a fragment without them is valid. **Warning rule** (never an error): a fragment that is new on the
  branch against `origin/main`, has neither key and touches the exported file gets `warning: changes/<slug>.md: ...` from
  `pnpm check:native-fragment` (part of `pnpm check:changed`; a `::warning` annotation in the CI step "Changelog fragment").
  A fragment touches the exported file when its `type` is `changed` or `fixed` and `packages` names `pptx`, `opf` or
  `gallery`, or its `type` is `added` and `packages` names `pptx`. Fragments already on `main` are not warned about.
- The keys never reach a `CHANGELOG.md`. `nativeSlides(root)` in `scripts/changelog-fragments.mjs` returns
  `[{fragment, deck, slide}]` for every unreleased fragment, for the native-app runner.

## Releasing

The release-prep pull request runs the assembler for each package it releases, then commits the result:

```sh
node scripts/changelog-fragments.mjs assemble --version 0.13.0 --package opf [--date 2026-10-09] [--summary "Patch release: ..."]
node scripts/changelog-fragments.mjs assemble --version 0.11.0 --package cli
```

It adds `## 0.13.0 (date)` under `## Unreleased`, writes the entries (and any bullet still under `## Unreleased`), and
deletes the fragments it used; a fragment that names two packages is kept until both changelogs have it. Pass
`--dry-run` to preview. The version must not already be in the changelog. See `docs/release-process.md`.
