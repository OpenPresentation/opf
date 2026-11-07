---
type: fixed
packages: [mcp]
---
The deck view (`show_deck`) builds on Windows again: `scripts/build-app.mjs` passed esbuild a URL's `pathname` (`/D:/...`) as its entry point, which esbuild cannot resolve there; it now converts the URL with `fileURLToPath`. The package's build and tests failed on every Windows checkout and in the nightly Windows legs (opf#1072).
