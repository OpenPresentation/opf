---
type: fixed
packages: [editor]
---
The playground example imports only public entries: `layoutOptionsFor` (the script-aware text measurement for composing one slide) is now exported by `@openpresentation/opf-editor/workspace`, and `examples/playground.js` imports it from there instead of `../src/workspace-measure.js`, which the package does not export. The 0.27.0 example failed the pptx.gallery vendoring step ("Package subpath './workspace-measure' is not defined by exports"). `check:gallery-editor-imports` and the packed-install test now fail when an example imports a module the package does not export.
