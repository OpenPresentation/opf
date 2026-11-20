---
type: changed
packages: [opf, cli, render, pptx, editor, mcp]
---
Finding messages, help texts and fix titles of `validate`, the rule reference, schema descriptions, docs, skills, CLI
output, renderer and exporter diagnostics, editor status messages and the MCP server's tool descriptions now use American
spelling ("color", "center", "gray", "canceled", "labeled", "neighbor", "behavior"), so a text check that matched the old
wording (for example `Use the slide text colour`, now `Use the slide text color`) must match the new one. Format and API
names are unchanged: no schema key, enum value, rule id, fix id, finding code or exported option was renamed, and values
such as the render `colour-font` reason, the editor export status `cancelled` and the grid change field `relabelled` keep
their spelling. The `chart-color-only` message names the simulated vision `grayscale` (was `greyscale`).
