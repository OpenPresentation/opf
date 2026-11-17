---
type: changed
packages: [render, opf]
---
Every path that reports `script-font-not-installed` (loadFonts with `scripts: "auto"`, `ensure`, the CJK glyph-fallback chain and demand loading) now words it the same way in the renderer: the package at its pinned version, then the global, project and npx install commands. The message used to get that wording only on the `loadFonts` path through the CLI and core; the core wrapper that added it is removed.
