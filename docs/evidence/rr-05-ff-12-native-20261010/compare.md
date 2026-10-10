# RR-05 / FF-12 native compare (0.18)

Generated 2026-10-10T21:50:11.217Z by `compare.mjs` from the native read-outs of `native/attempt-1`. Packages: `@openpresentation/opf` 0.18.1, `@openpresentation/opf-render` 0.18.0, `@openpresentation/opf-pptx` 0.18.0, `@openpresentation/opf-editor` 0.18.0, `fontkit` 2.0.4. PowerPoint 16.0 build 20430, Microsoft Windows NT 10.0.26200.0, culture en-US.

## RR-05 / FF-12

Criterion: Presentation.Fonts names only the chosen families (Latin run families listed; theme-only script families may be absent), theme slots of the slide and notes masters resolve to them, and no run names another family.

**12 PASS, 0 FAIL, 0 not run** of 12.

| Deck | Verdict | Presentation.Fonts (native) | Extras | Missing required | Soft, absent (accepted) | Theme slots | Runs | Run health |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01-carlito-code-chart-table-notes | PASS | Carlito, Roboto Mono | - | - | - | ok | ok (30) | ok |
| 02-carlito-code-family-carlito | PASS | Carlito | - | - | - | ok | ok (30) | ok |
| 03-default-aptos | PASS | Aptos Display, Aptos, Roboto Mono | - | - | - | ok | ok (16) | ok |
| 04-ja-meiryo | PASS | Meiryo | - | - | - | ok | ok (16) | ok |
| 05-ar-rtl | PASS | Aptos Display, Aptos | - | - | Arabic Typesetting | ok | ok (7) | ok |
| 06-monospace-consolas | PASS | Consolas | - | - | - | ok | ok (16) | ok |
| 07-per-slide-override | PASS | Calibri, Georgia, Courier New | - | - | - | ok | ok (8) | ok |
| 08-cjk-in-latin | PASS | Aptos Display, Aptos | - | - | Meiryo | ok | ok (6) | ok |
| 09-ko-malgun | PASS | Malgun Gothic | - | - | - | ok | ok (6) | ok |
| 10-hi-mangal | PASS | Aptos Display, Aptos | - | - | Mangal | ok | ok (5) | ok |
| 11-he-rtl | PASS | Aptos Display, Aptos | - | - | David | ok | ok (5) | ok |
| 12-serif-georgia | PASS | Georgia | - | - | - | ok | ok (6) | ok |
