# PowerPoint: published 0.13 build (p) vs the 0.12-era b- read

p: published @openpresentation/opf-pptx 0.13.1, core @openpresentation/opf 0.13.0, opf-render 0.13.0 (installed, not used by this build) (pptxgenjs-plus 4.3.4); baseline: b- reads from the 0.12-era run (opf-pptx codex/rr-17-pptxgenjs-plus 0773be6, pptxgenjs-plus 4.3.4, core 0.12.0); compare.mjs judges p- against them

PASS 20, WARN 0, FAIL 0, MISSING 0

| Deck | Status | Mode | Presentation.Fonts (p) | Findings (FAIL/WARN/MISSING, first 6) |
|---|---|---|---|---|
| 01-latin-rich-text | PASS | baseline b- read | Georgia |  |
| 02-fonts-serif-mono-code | PASS | baseline b- read | Times New Roman, Roboto Mono |  |
| 03-cjk-japanese | PASS | baseline b- read | Aptos Display, Aptos |  |
| 04-devanagari-hindi | PASS | baseline b- read | Aptos Display, Aptos |  |
| 05-rtl-arabic | PASS | baseline b- read | Aptos Display, Aptos |  |
| 06-rtl-hebrew | PASS | baseline b- read | Tenorite Display, Tenorite |  |
| 07-bullets-numbered | PASS | baseline b- read | Arial Black, Arial |  |
| 08-tables | PASS | baseline b- read | Calibri |  |
| 09-charts-core | PASS | baseline b- read | Aptos Display, Aptos |  |
| 10-charts-variants | PASS | baseline b- read | Aptos Display, Aptos |  |
| 11-charts-chartex | PASS | baseline b- read | Aptos Display, Aptos |  |
| 12-svg-png-fallback | PASS | baseline b- read | Aptos Display, Aptos |  |
| 13-header-footer-numbers | PASS | baseline b- read | Calibri |  |
| 14-speaker-notes | PASS | baseline b- read | Aptos Display, Aptos |  |
| 15-backgrounds | PASS | baseline b- read | Aptos Display, Aptos |  |
| 16-footnotes-captions | PASS | baseline b- read | Georgia |  |
| 17-gallery-bold | PASS | baseline b- read | Tahoma |  |
| 18-gallery-classic | PASS | baseline b- read | Tenorite, Tenorite Display |  |
| 19-gallery-dark | PASS | baseline b- read | Meiryo |  |
| 20-gallery-minimal-indic | PASS | baseline b- read | Aptos, Aptos Display |  |
