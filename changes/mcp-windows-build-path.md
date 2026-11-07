---
type: fixed
packages: [mcp]
---
The deck view's build (`scripts/build-app.mjs`) works on Windows: it passed esbuild `URL.pathname`, a `/C:/...` path that does not resolve there.
