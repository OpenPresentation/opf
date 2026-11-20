---
type: changed
packages: [opf, cli, render, pptx, editor, mcp]
---
Breaking: American spelling everywhere, including four API values, renamed without an alias. Finding messages, help
texts and fix titles of `validate`, the rule reference, schema descriptions, docs, skills, CLI output, renderer and
exporter diagnostics, editor status messages and the MCP server's tool descriptions now say "color", "center", "gray",
"canceled", "labeled", "neighbor" and "behavior", so a text check that matched the old wording (for example `Use the
slide text colour`, now `Use the slide text color`) must match the new one. The `chart-color-only` message names the
simulated vision `grayscale` (was `greyscale`). No schema key, enum value, rule id, fix id or finding code changed.
`describeFinding` and `explain` no longer rewrite "colour" to "color" in the text they pass on, so an author's own words
(a series named "Colour", alt text) are quoted as written; the suggestion that maps an author's `centre` or `centred` to
`center` stays. Renamed values; update every caller:
    - render: the `text-as-paths-fallback` diagnostic `reason` `"colour-font"` is now `"color-font"` (`toSvg`
      diagnostics type).
    - editor: the export menu status `state` `"cancelled"` is now `"canceled"` (`ExportMenuOptions.onStatus` and the
      `data-state` attribute of `.opf-export-status`, which `[data-state="canceled"]` styles).
    - editor: the change that `transposeGridData` and `transposeChart` return reports `relabeled` (was `relabelled`).
    - editor: the studio-kit drag controller calls `onEnd(session, { canceled })` (was `{ cancelled }`).
