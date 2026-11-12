---
type: fixed
packages: [mcp]
---
RR-111: viewer downloads and messages follow Claude's MCP Apps rules. A download's file name is the URI's last segment as written (no percent-encoding, which a host does not decode; the characters a host would replace are replaced in the view), one request runs at a time, the timeout is ten minutes, and the outcomes read "Download started.", "The download didn't finish." and "The download couldn't be confirmed."; no file type a host refuses outright is offered. Send to Claude handles a refused and an unconfirmed message, says a sent message waits for the user's approval rather than that the model read it, and stays usable to retry. When a newer viewer of the same deck opens (the server mints a session key and an order key; nothing is stored), the older one greys out and stops sending context, messages and tool edits; other decks stay independent.
