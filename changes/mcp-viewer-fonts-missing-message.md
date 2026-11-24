---
type: fixed
packages: [mcp]
---
The OPF viewer on a server that offers no `read_font_file` (a hosted server that passes no `readFontFile`) no longer sits on a blank stage with "Drawing the slides…": it says that the slides cannot be drawn because the fonts the deck needs could not be loaded from the server, and that the host must offer its font files. `docs/mcp.md` no longer claims the view draws with Roboto in that case; only Roboto Regular is inline, and any other face comes from the server.
