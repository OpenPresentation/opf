# Built font runtime in coordinated harnesses

Core `fb8d5a68af30c24e9c8cb31f206fb960dfbbd071` passed core and CLI CI,
but coordinated run [34976670014](https://github.com/OpenPresentation/opf/actions/runs/34976670014)
failed while importing `opf-render/src/fonts-node.js`: font preparation imports
`font-woff2.js`, which the renderer build generates into `dist`, not `src`.
This is a harness dependency error, separate from native font metric gates.

Node and browser font-loader imports and demo aliases now use the built
renderer graph. Source renderer/editor geometry remains exercised, while fonts
come from the same complete build used by packages. The installed harness
rewriter accepts both older source paths in immutable registry fixtures and
current dist paths; installed browser imports still resolve to package exports.

Node 24.21.0 checks pass for track resize, measured rich text, list geometry,
the editor demo/browser bundle, rich table/browser bundles and the measured
site showcase. Compressed logs retain the original CI failure and these local
results; `manifest.json` hashes stored and decompressed bytes. Full coordinated
CI and fresh installed acceptance remain required after this correction.
