---
type: fixed
packages: [render]
---
Text copied or searched from a vector PDF now reads in logical order for scripts whose shaping reorders or decomposes characters, in readers that ignore `/ActualText` as well as in those that honor it. A cluster whose glyphs are drawn out of logical order (an Indic, Sinhala, Khmer or Myanmar pre-base vowel sign or medial, a Tamil or Malayalam two-part vowel, a Thai or Lao am split into nikhahit and aa) now carries its whole text on its first drawn glyph, its other glyphs map to no character, and its word carries `/ActualText`. pdf.js (Firefox) used to return such syllables in drawing order (`िह न्दी` for `हिन्दी`); over the 19 reordering and right-to-left scripts of the script corpora it now reads every sample in logical order except four that it reorders or drops itself (Arabic-Indic numbers in a right-to-left line, the zero width non-joiner), with HarfBuzz and with fontkit shaping.
