---
type: added
packages: [mcp]
---
RR-111: `open_editor` ("OPF deck editor"), a direct entry point to the OPF viewer's editor (`_meta["openai/ui"].entrypoints: [{ "type": "global" }]` beside `_meta.ui.resourceUri`). Called with `{}` it opens a two-slide starter deck the user can edit at once; the start row opens a bundled example or pastes a deck (Paste selects the whole source and focuses it, and reads the clipboard where the host allows it); `example` and `title` are optional, and a title given with an example renames it. The model's first context names what opened and carries the deck. `show_deck`'s contract is unchanged apart from an optional `session` input and a `viewer` key in its result.
