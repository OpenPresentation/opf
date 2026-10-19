---
type: changed
packages: [opf, cli]
---
Theme records (`opf-theme/v1`) accept an optional `variants` array of `{ id, name, variant }`, where `variant` is a value of `design.variant` (a background slot, or the `ColorVariant` object of `opf.schema.json`, referenced and not copied). Gallery 4 gives `minimal`, `classic` and `bold` the variants `light`, `light-alt`, `dark` and `dark-alt`. They are for pickers: a document keeps the chosen `variant` in `design.variant`, never the entry id, and the engines read only `design.variant`. The generated `Theme` type gains `variants?: ThemeVariant[]`, and the schema docs, the design-resolution and default-catalog docs and the opf-presets skill describe them.
