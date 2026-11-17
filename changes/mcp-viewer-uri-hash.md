---
type: changed
packages: [mcp]
---
The OPF viewer's resource URI names its HTML: `ui://opf/deck/<hash>`, the first 12 hex digits of the page's SHA-256, set when the package is built (`DECK_APP_URI`). A host caches a view by its URI (ChatGPT's documentation says so), so the URI now changes exactly when the viewer does, in the stdio server and in a hosted one built from the same package. `ui://opf/deck` (0.34 and earlier) and any earlier hash still read as the current viewer, for a host that holds a tool list from before an update; they are listed as resource templates, and only the current URI is in the resource list.
