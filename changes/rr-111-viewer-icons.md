---
type: added
packages: [mcp]
---
RR-111: the MCP viewer (`show_deck`, `open_editor`) draws a deck's set icons (`"icon": "lucide:rocket"`). It cannot fetch, so it reads them from its server through a new app-only tool `read_icons` (`{ set, names, index? }`, at most 100 icons a call, each set's index with its license and copyright once), offered when the server has icon sets and the viewer; `show_deck` and `open_editor` name the sets in `iconSets`. The viewer's checks and the checks in `read_deck` and `edit_deck` results wait for the deck's icons, so they report icons as `validate_deck` does (an unknown name with its nearest names); a load that cannot happen draws the slide without the icon and says why. `opf-mcp` and the `.mcpb` read the installed icon files; a Worker passes `sources.iconSets` over the icon files it serves (docs/mcp.md). The page carries no icon data. `search_icons` no longer describes an empty list of sets on a server without icon sets.
