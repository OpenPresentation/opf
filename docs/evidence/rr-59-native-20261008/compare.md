# RR-59 native comparison

Manifest: manifest.json; native dir: native-run1; gated: complete, presentationFonts, themeSlots, themeCs, fonts, direction, alignment, lineCount, itemLines, clipping, placeholder. Position deltas and image scores are reported, not gated.

| Deck | Opened | Complete | Pres.Fonts | Theme | Theme cs | Fonts | Direction | Align | Line count | Not clipped | Placeholder |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ar-title-body | yes | pass | pass | pass | pass | pass | pass | pass | pass | pass | - |
| ar-mixed | yes | pass | pass | pass | pass | pass | pass | pass | pass | pass | - |
| ar-run-in-en | yes | pass | pass | pass | pass | pass | pass | pass | pass | pass | - |
| ar-scheme-override | yes | pass | pass | pass | pass | pass | pass | pass | pass | pass | - |
| unresolved-image | yes | pass | pass | pass | pass | pass | pass | pass | pass | pass | pass |

## Line position deltas against the shared composition (pt; native minus shared; max / mean of the absolute value, mean signed)

| Deck | Lines | Left | Top | Width | Height | Right edge |
| --- | ---: | --- | --- | --- | --- | --- |
| ar-title-body | 6 | 56.46 / 34.77 / 34.77 | 0 / 0 / 0 | 56.56 / 34.87 / -34.87 | 0.81 / 0.52 / -0.52 | 0.11 / 0.1 / -0.1 |
| ar-mixed | 10 | 28.34 / 8.54 / 8.48 | 0 / 0 / 0 | 54.7 / 14.08 / -14.05 | 0.81 / 0.51 / -0.51 | 54.7 / 5.57 / -5.57 |
| ar-run-in-en | 8 | 0.02 / 0.01 / 0.01 | 0.01 / 0 / 0 | 18.43 / 5 / -3.28 | 0.81 / 0.49 / -0.49 | 18.43 / 5 / -3.27 |
| ar-scheme-override | 7 | 223.47 / 56.75 / 56.75 | 0 / 0 / 0 | 223.57 / 56.85 / -56.85 | 0.81 / 0.56 / -0.56 | 0.1 / 0.1 / -0.1 |
| unresolved-image | 1 | 0 / 0 / 0 | 0 / 0 / 0 | 0.13 / 0.13 / 0.13 | 0.81 / 0.81 / -0.81 | 0.13 / 0.13 / 0.13 |

ar-mixed: right-to-left lines only (9): left 28.34 / 9.49 / 9.42, width 28.44 / 9.57 / -9.53, right edge 0.13 / 0.11 / -0.11; left-to-right lines (1): left 0 / 0 / 0, width 54.7 / 54.7 / -54.7.

## Placeholder (unresolved image)

- unresolved-image: pass; panel "OPF image placeholder 1" alt text "Image unavailable: Bar chart of quarterly revenue growing from 12 to 21 million"; label text "Image unavailable"; alt text shape "Bar chart of quarterly revenue growing from 12 to 21 million"; grouped natively: false; editable: true.

## Image scores (reported)

| Deck | close / review / far |
| --- | --- |
| ar-title-body | 0/0/2 |
| ar-mixed | 0/1/2 |
| ar-run-in-en | 0/1/1 |
| ar-scheme-override | 0/0/3 |
| unresolved-image | 1/0/0 |

## Mismatches (first 12 per deck)

### ar-run-in-en
- slide 1 line-wider-than-shape Text 2: {"overhangPt":3.78}

## Notes

- unresolved-image: slide 1: the placeholder is not a group natively as well (panel and text boxes are separate editable shapes)
