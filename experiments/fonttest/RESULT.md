# Font test in Keynote 16.0 (7052.0.68), 2026-11-25 16:46 UTC

Deck: qualification corpus `coverage-images` (16 slides), OPF 0.36.0. Opened by AppleScript `open`; read with a window capture (Keynote in the background). Seen by the supervisor session.

| File | Fonts named | Layout picture placeholders | "This presentation has missing fonts." banner |
|---|---|---|---|
| A-default-aptos.pptx (default export) | Aptos, Aptos Display | 5 | **shown** (Replace Fonts sheet lists Aptos and Aptos Display as missing, Helvetica as present) |
| B-typefaces-safe.pptx (`--typefaces safe`) | Arial | 5 | not shown |
| C-helvetica-neue.pptx (XML edit: Aptos -> Helvetica Neue) | Helvetica Neue | 5 | not shown |
| D-helvetica-neue-no-picture-placeholders.pptx | Helvetica Neue | 0 | not shown |
| E-aptos-no-picture-placeholders.pptx | Aptos, Aptos Display | 0 | **shown** |

- The banner follows the Latin theme fonts only. The theme's per-script font list still names Windows fonts this Mac lacks (Angsana New, Cordia New, DaunPenh, ...) in B, C and D, and Keynote does not flag them (they are not used by any text).
- Not read yet: the Warnings window's "Unsupported media were removed" line for C against D. That window is a panel Keynote hides while it is not the front app, so a background capture cannot see it.
