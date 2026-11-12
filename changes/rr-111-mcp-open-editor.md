---
type: added
packages: [mcp]
---
RR-111: `open_studio`, a direct entry point to the OPF viewer (`_meta["openai/ui"].entrypoints: [{ "type": "global" }]` beside `_meta.ui.resourceUri`). Called with `{}` it opens a two-slide starter deck the user can edit at once; the viewer's start row opens a bundled example or switches to Source for a pasted deck; `example` and `title` are optional. `show_deck`'s contract is unchanged apart from an optional `session` input and a `viewer` key in its result.
