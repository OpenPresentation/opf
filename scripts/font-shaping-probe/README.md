# Source-preserving shaping probe

This test-only project compares current Fontkit, two pinned HarfBuzz bindings,
and actual Chromium SVG text using the same twelve reviewed Akasia v0.0.2 files.
It changes no product dependency, registry default, font pack or authored OPF.
The model accepts one static SFNT face and one horizontal script run. It is not
a production font registry, font fallback system, script itemizer or bidi engine.

Use Node 24, the built sibling `opf-render` checkout (Fontkit and Playwright),
and the built core package. Supply the twelve original fonts from the release
documented in `docs/evidence/akasia-assessment/README.md`. Every file is checked
against that committed assessment's SHA-256 values; no fonts are downloaded.

```sh
npm ci --prefix scripts/font-shaping-probe --ignore-scripts
python3 -m venv /tmp/opf-shaping-venv
/tmp/opf-shaping-venv/bin/pip install -r scripts/font-shaping-probe/requirements.txt
node scripts/font-shaping-probe/prepare.mjs /path/to/Akasia-v0.0.2 /tmp/opf-shaping-new
/tmp/opf-shaping-venv/bin/python scripts/font-shaping-probe/shape.py /path/to/Akasia-v0.0.2 /tmp/opf-shaping-new
node scripts/font-shaping-probe/shape-js.mjs /path/to/Akasia-v0.0.2 /tmp/opf-shaping-new
node scripts/font-shaping-probe/browser.mjs /path/to/Akasia-v0.0.2 /tmp/opf-shaping-new
```

`prepare` requires a new output directory. It enumerates canonical decomposition
pairs from each font's cmap, retaining only pairs whose decomposed components
are covered. Normalization is used only to generate labeled test inputs. Each
engine receives those strings unchanged. JSON evidence escapes non-ASCII code
units, preserving their exact values after parsing.

The Python binding independently invokes HarfBuzz and records one complete
normalization/GSUB trace. The JavaScript probe compares every glyph ID, cluster,
advance and offset with Python, then passes its width callback into the actual
core `fitText` API. It verifies original UTF-16 ranges, grapheme boundaries,
tabs, mixed line endings, blank lines and a fixed 32px readability floor. Its
supplementary-character control verifies offsets only: the emoji is deliberately
missing, so that control cannot establish glyph coverage.

Chromium loads the same JavaScript model and WASM bytes, compares all glyph runs
and outline extents with Node, and separately measures actual unadjusted SVG
text. All page/module/WASM requests are intercepted and fulfilled from explicit
local bytes; every other request is rejected and reported. The browser check
requires the retained current-measurement overflow counterexample, zero
HarfBuzz/Chromium advance differences in the matrix, and corrected line widths.
It writes evidence before asserting so failures remain inspectable.

Advance containment is not ink containment. The diagnostic screenshot makes
negative left side bearings visible; it does not certify complete glyph paint,
baseline placement, native Office behavior, Aptos equivalence, or mixed-script
and language support. See `docs/plans/font-shaping.md` for production integration
requirements and `docs/evidence/akasia-shaping-20260914/verify.mjs` for an offline
verifier of the retained observation set.
