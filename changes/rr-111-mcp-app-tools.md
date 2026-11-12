---
type: added
packages: [mcp]
---
RR-111: the OPF viewer registers three MCP Apps app tools, so a host that calls tools in a view (Claude, with a remote connector) lets the model work on the deck that is already open: `read_deck` (revision, name, outline, selected slide, check findings, and the source in JSON, YAML or Markdown in pieces under the 100,000-character result limit), `select_slide` (by index or id) and `edit_deck` (JSON Patch operations with a required `expectedRevision`, applied as one undoable edit through the editor session; a stale revision, a whole-deck replace or an edit that would break a valid deck changes nothing). The definitions never change at run time, each tool acts on its own view only, and the tools refuse with a clear result while loading, when read-only, after a newer viewer of the same deck replaced the view, and after teardown. Hosts without app tools keep the existing context updates and Send.
