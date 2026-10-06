# Native probe builders (2026-10-05)

Builder scripts, expected manifests (with per-deck sha256) and read-only PowerPoint readers for two probe sets, so the
Windows host can rebuild the decks instead of copying binaries. Not for merging; branch only.

- `per-slide-script-fonts/` — opf-pptx#170 (opf-pptx#168). `node build.mjs <opf-pptx base checkout at 3fb1387 (codex/rr-17-pptxgenjs-plus)> <opf-pptx fix checkout at codex/rr-17-per-slide-script-fonts d65390a>`; both checkouts need `npm ci` and a built `dist/`.
- `ff46-ethiopic-supplement/` — opf#377 (opf#375). `node --import <core>/scripts/register-local-opf.mjs build.mjs before <opf-pptx main checkout>` with core at b66ea0c0, then `... build.mjs after <opf-pptx>` with core at d9d7880, then `node build.mjs manifest b66ea0c0 d9d7880`. See RUN.md in each folder.

Compare your rebuilt decks' sha256 with `manifest.json`.

- `rr54-recheck/` — RR-54 native re-check (opf-pptx#171 b076bb6 format re-spelling fix; opf-pptx#173 4baa171 workbook zeros). See its RUN.md; `node build.mjs` needs the #171 builds with core opf#376 linked and #173. Compare sha256 with manifest.json.

- `rr54-slash/`: number format codes with `/` and Excel's other special characters (opf#387 FAIL: `0.0 m/s` was written `0.0 "m"/"s"`; fixed in core opf#376 `d955d600`). One deck built by opf-pptx#171 `b076bb6` with that core linked. Run `../rr54-recheck/read-deck.ps1` on it, then `node check.mjs <core>/packages/javascript out`. See its RUN.md.
