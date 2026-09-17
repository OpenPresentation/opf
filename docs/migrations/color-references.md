# Color-reference migration notes

The color-reference release (unreleased at the time of writing; the changelog
entry is under "Unreleased") narrows `TextRun.color` from an unconstrained
string to the shared `ColorRef` union. This is a breaking schema change for
documents that stored arbitrary strings there.

## What changed

`TextRun.color` — and the styled table cell `style.fill` / `style.color` and
cell border `color` fields — validate against `ColorRef`:

- a literal hex color: `#RGB`, `#RRGGBB`, `#RRGGBBAA`
- a color-scheme slot name: `accent1`–`accent6`, `dark1`, `dark2`, `light1`,
  `light2`, `hyperlink`, `followedHyperlink`
- an abstract role name: `primary`, `secondary`, `accent`, `background`,
  `surface`, `text`, `textSecondary`
- a variable reference: `var:<id>` into the top-level `variables` map

For the styled table cell fields this is a pure widening (they were hex-only).
For `TextRun.color` it is a narrowing: the schema previously accepted any
string, documented as hex, so values like `"red"`, `"rgb(20,30,40)"`, or
`"Accent2"` validated as undefined behavior and now fail validation.

## Migrating documents

Replace non-conforming `color` values with one of the `ColorRef` forms:

```diff
- { "text": "at risk", "color": "red" }
+ { "text": "at risk", "color": "#B42318" }

- { "text": "at risk", "color": "Accent2" }
+ { "text": "at risk", "color": "accent2" }
```

Prefer scheme names or `var:` references over hex where the color should
follow the deck's design system; see `docs/content-payloads.md` → "Color
references".

`opf validate` pinpoints every offending run with a JSON-pointer path.

## Why the breaking gate did not fire

`scripts/check-breaking-changes.mjs` detects removals (files, top-level
properties/`$defs`, enum values), not constraint narrowing, so this change
passes the gate mechanically. It is nevertheless a breaking change for the
purposes of the 0.x versioning promise ("expect breaking changes between minor
versions"): it must ship in a **minor** release, not a patch.
