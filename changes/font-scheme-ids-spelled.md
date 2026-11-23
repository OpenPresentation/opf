---
type: changed
packages: [gallery]
---
Breaking (0.35): two font scheme ids were misspelled and are now spelled as the fonts are. `noto-naksh-arabic` is `noto-naskh-arabic`, and `noto-sans-devangari` is `noto-sans-devanagari`; the `persian`, `hindi`, `marathi` and `nepali` language records name the new ids as their Google Slides scheme. There is no alias: a deck that names an old id gets `opf/unresolved-reference`, whose help suggests the new id, and draws with the engine default until it is corrected. Decks that embed their records are unaffected, and the fonts (Noto Naskh Arabic, Noto Sans Devanagari) are unchanged.
