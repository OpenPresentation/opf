# FF-12 / RR-05 native font sample: PowerPoint vs the exported packages

Packages: @openpresentation/opf 0.12.1, @openpresentation/opf-pptx 0.12.3, @openpresentation/opf-render 0.12.0; Node 24.21.0.

Pass rule: Presentation.Fonts names only expectedFonts (case-insensitive), lists every requiredFonts entry, the master theme slots read the manifest theme values, every run and slot name read back is an expected family, and the read reached stage done.

PASS 11, WARN 0, FAIL 1, MISSING 0

| Deck | Status | Presentation.Fonts (native) | Expected | Findings (FAIL / WARN / MISSING, first 6) |
|---|---|---|---|---|
| 01-carlito-code-chart-table-notes | PASS | Carlito, Roboto Mono | Carlito, Roboto Mono |  |
| 02-carlito-code-family-carlito | PASS | Carlito | Carlito |  |
| 03-default-aptos | PASS | Aptos Display, Aptos, Roboto Mono | Aptos, Aptos Display, Roboto Mono |  |
| 04-ja-meiryo | PASS | Meiryo | Meiryo |  |
| 05-ar-rtl | PASS | Aptos Display, Aptos | Aptos, Aptos Display, Arabic Typesetting |  |
| 06-monospace-consolas | PASS | Consolas | Consolas |  |
| 07-per-slide-override | PASS | Calibri, Georgia, Courier New | Calibri, Courier New, Georgia |  |
| 08-cjk-in-latin | FAIL | Aptos Display, Aptos | Aptos, Aptos Display, Meiryo | FAIL Presentation.Fonts: chosen and used family not listed: Meiryo |
| 09-ko-malgun | PASS | Malgun Gothic | Malgun Gothic |  |
| 10-hi-mangal | PASS | Aptos Display, Aptos | Aptos, Aptos Display, Mangal |  |
| 11-he-rtl | PASS | Aptos Display, Aptos | Aptos, Aptos Display, David |  |
| 12-serif-georgia | PASS | Georgia | Georgia |  |

## Notes

- 01-carlito-code-chart-table-notes: host fonts: not installed on this host (PowerPoint still reports the selected name): Carlito, Roboto Mono
- 02-carlito-code-family-carlito: host fonts: not installed on this host (PowerPoint still reports the selected name): Carlito
- 03-default-aptos: host fonts: not installed on this host (PowerPoint still reports the selected name): Aptos, Aptos Display, Roboto Mono
- 04-ja-meiryo: host fonts: not installed on this host (PowerPoint still reports the selected name): Meiryo
- 05-ar-rtl: Presentation.Fonts: soft family not listed (allowed): Arabic Typesetting; host fonts: not installed on this host (PowerPoint still reports the selected name): Aptos, Aptos Display
- 08-cjk-in-latin: host fonts: not installed on this host (PowerPoint still reports the selected name): Aptos, Aptos Display, Meiryo
- 10-hi-mangal: Presentation.Fonts: soft family not listed (allowed): Mangal; host fonts: not installed on this host (PowerPoint still reports the selected name): Aptos, Aptos Display, Mangal
- 11-he-rtl: Presentation.Fonts: soft family not listed (allowed): David; host fonts: not installed on this host (PowerPoint still reports the selected name): Aptos, Aptos Display, David
