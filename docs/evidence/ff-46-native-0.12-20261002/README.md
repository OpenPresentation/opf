# FF-46: native PowerPoint evidence per font family on the 0.12.0 train (2026-10-02)

Supervisor-run native check (PowerPoint 365, Windows host, build 16.0.20430) of 43 decks built with the published
`@openpresentation/opf` 0.12.0 and `@openpresentation/opf-render` 0.12.0 and `@openpresentation/opf-pptx` at main `a0ee3e5`
(0.12.0 plus FF-05, opf-pptx#152). Every family of the font tracker (168) is named by at least one deck. Each deck was opened
read-only through the running PowerPoint, one deck per invocation (90 s deadline), and read through COM (`Presentation.Fonts`,
the master theme font scheme, `Font.Name` / `NameFarEast` / `NameComplexScript` and bold / italic per run, plus a 1280 px PNG per
slide). Decks, PNGs and the native read-outs are not committed; the comparison output is.

- [compare.md](compare.md) and [compare.json](compare.json): output of `node compare.mjs --native native --sets
  latin,scripts,symbol,emoji-math --root .` (the comparison script of the scratch `native-0.12` set, derived from the RR-05
  `compare.mjs`; it reads files only and never opens Office). Absolute paths were replaced by relative ones.
- The tracker reads this file through `overrides.nativeEvidence` (`id: ff-46-native-0.12-20261002`), like the two RR-05 runs.

## Result

43 decks compared, 225 slides read (no truncation, no COM read errors), 767 text shapes. **0 failing gated checks.**

| Check | Gated | Result |
| --- | --- | --- |
| `fonts`: every text shape's runs read the names the file writes in `Name`, `NameFarEast`, `NameComplexScript` | yes | 767 / 767 shapes, 0 missing shapes |
| `themeSlots`: major / minor Latin, East Asian, complex script of the master theme | yes | 43 / 43 decks |
| `presentationFonts`: `Presentation.Fonts` lists no name outside the deck's names and every name the deck's text draws with | yes | 43 / 43 decks: 0 extra names (FF-05 holds: no Aptos in a non-Aptos deck), 0 missing required names, 0 empty-name entries |
| `slideFamilies`: the family a slide is meant to show (from the generator, not from the file) is read on that slide's runs | yes | 42 decks with intended families pass; `scripts-27` is a probe with none (below) |
| `styles`: bold / italic combinations of each shape's runs | reported | every shape agrees |
| `language` ids | reported | 758 / 758 runs |
| image scores against the renderer preview | reported | 10 close, 7 review, 207 far (the preview draws an open look-alike, not the real face: expected, not gated) |

What the check proves and does not: it is a name read-back. PowerPoint reports the selected family on every run and theme slot and
lists exactly the deck's fonts; it says nothing about whether the preview face matches the real font's look or metrics, and a
family that is not installed on the host is still reported by its selected name (a substitution is a host finding). A deck has
one theme, so only the first family of a multi-family deck is read through its own theme slot; every family is read through
per-run names and `Presentation.Fonts` (a family the deck names only in a theme slot, for example Segoe UI Emoji in
`emoji-math-03`, is not required to be listed there).

## Decks

Sets: `latin` (the 122 proprietary-latin and open families other than Cambria Math and Segoe UI Emoji, one slide per family with
Regular / Bold / Italic / Bold italic lines for the styles the family has, the family as that slide's major and minor Latin
font), `scripts` (the 41 proprietary-script families, per-language decks), `symbol` (Wingdings, Webdings, Symbol, Wingdings 2 / 3 with
code-table text in the private-use and plain forms), `emoji-math` (Segoe UI Emoji, Cambria Math, emoji in an Aptos deck).

| Set | Deck | Slides | Fonts (shapes ok) | Theme | Pres.Fonts | SHA-256 (12) |
| --- | --- | ---: | --- | --- | --- | --- |
| latin | `latin-01-aptos` | 14 | 65/65 | pass | pass | 6d758b6ebff1 |
| latin | `latin-02-lucida-console` | 14 | 57/57 | pass | pass | 18bec0183bae |
| latin | `latin-03-tahoma` | 14 | 53/53 | pass | pass | 26659f69f2dd |
| latin | `latin-04-bodoni-mt` | 14 | 64/64 | pass | pass | c1cfc5873180 |
| latin | `latin-05-bitter` | 14 | 70/70 | pass | pass | 0cfd78f1643d |
| latin | `latin-06-libre-caslon-text` | 13 | 46/46 | pass | pass | 13ae7b2e37d4 |
| latin | `latin-07-noto-sans-ethiopic` | 13 | 37/37 | pass | pass | ac51a0b6c282 |
| latin | `latin-08-noto-sans-myanmar` | 13 | 41/41 | pass | pass | ed56a718566f |
| latin | `latin-09-playfair-display` | 13 | 60/60 | pass | pass | 47ee8057e24c |
| scripts | `scripts-01-japanese` | 5 | 19/19 | pass | pass | 70d52cbe9f9e |
| scripts | `scripts-02-chinese-simplified` | 5 | 15/15 | pass | pass | 6959e5f485e9 |
| scripts | `scripts-03-chinese-traditional` | 4 | 13/13 | pass | pass | 2b43460fb7c4 |
| scripts | `scripts-04-korean` | 3 | 12/12 | pass | pass | 1681a6ebd1c5 |
| scripts | `scripts-05-arabic` | 6 | 18/18 | pass | pass | 16d266a24f75 |
| scripts | `scripts-06-urdu` | 2 | 6/6 | pass | pass | 05fac8f0dbfe |
| scripts | `scripts-07-persian` | 1 | 3/3 | pass | pass | fa3f4e89f688 |
| scripts | `scripts-08-hebrew` | 3 | 9/9 | pass | pass | 814d488c200a |
| scripts | `scripts-09-hindi` | 3 | 9/9 | pass | pass | 79c096e832a3 |
| scripts | `scripts-10-bengali` | 2 | 6/6 | pass | pass | 0da95ecf4406 |
| scripts | `scripts-11-punjabi` | 1 | 3/3 | pass | pass | ef594001d6da |
| scripts | `scripts-12-gujarati` | 1 | 3/3 | pass | pass | a0a63b126dcf |
| scripts | `scripts-13-odia` | 1 | 3/3 | pass | pass | 444f4dcdd924 |
| scripts | `scripts-14-tamil` | 1 | 3/3 | pass | pass | 3a201ca2a186 |
| scripts | `scripts-15-telugu` | 1 | 3/3 | pass | pass | 9debec942347 |
| scripts | `scripts-16-kannada` | 1 | 3/3 | pass | pass | ae481e72e400 |
| scripts | `scripts-17-malayalam` | 1 | 3/3 | pass | pass | 2ec4878d3934 |
| scripts | `scripts-18-thai` | 5 | 15/15 | pass | pass | a87751fa2bf5 |
| scripts | `scripts-19-khmer` | 2 | 6/6 | pass | pass | d5ecbea0202f |
| scripts | `scripts-20-myanmar` | 1 | 3/3 | pass | pass | 85704981d8ff |
| scripts | `scripts-21-tibetan` | 1 | 2/2 | pass | pass | 5533f702787a |
| scripts | `scripts-22-mongolian` | 1 | 2/2 | pass | pass | 2133388bc130 |
| scripts | `scripts-23-dhivehi` | 1 | 2/2 | pass | pass | b4cd46a06835 |
| scripts | `scripts-24-amharic` | 2 | 6/6 | pass | pass | f51e537f96ce |
| scripts | `scripts-25-armenian` | 1 | 3/3 | pass | pass | bd0980f97bd8 |
| scripts | `scripts-26-georgian` | 1 | 2/2 | pass | pass | f2981f416f0f |
| scripts | `scripts-27-latin-deck-slots` | 7 | 21/21 | pass | pass | 40a5ceee8560 |
| symbol | `symbol-01-wingdings` | 6 | 12/12 | pass | pass | 4443818c2ae6 |
| symbol | `symbol-02-webdings` | 2 | 4/4 | pass | pass | 3850599968db |
| symbol | `symbol-03-symbol` | 4 | 8/8 | pass | pass | de0d7864895a |
| symbol | `symbol-04-wingdings-2-3` | 2 | 4/4 | pass | pass | be436d033d16 |
| emoji-math | `emoji-math-01-segoe-ui-emoji` | 11 | 22/22 | pass | pass | 74cb2b2ec4be |
| emoji-math | `emoji-math-02-cambria-math` | 13 | 26/26 | pass | pass | 6b786b3cd7a3 |
| emoji-math | `emoji-math-03-emoji-in-aptos-deck` | 2 | 5/5 | pass | pass | b3f9fd9fc545 |

## Notes

- `scripts-27-latin-deck-slots` is an exporter probe, not a family check: since FF-49 the per-slide East Asian / complex-script
  slots of a Latin-language deck are not written on the runs (only the first slide's scheme reaches the theme), so the deck has no
  intended families; its runs read Aptos Display and Aptos with `NameFarEast` Yu Gothic (the first slide's theme slot). Recorded as behaviour, not a failure.
- `scripts-24-amharic`: Nyala and Ebrima are both listed by `Presentation.Fonts`; the theme reads Nyala (first slide).
- `emoji-math-03-emoji-in-aptos-deck`: the theme East Asian and complex-script slots read Segoe UI Emoji; `Presentation.Fonts` lists
  only Aptos and Aptos Display (the emoji font link is not listed).
- Where the file writes no `a:cs` on a run (every Latin, CJK, symbol and emoji deck, 20 decks) PowerPoint reads `NameComplexScript` as the
  unresolved theme reference `+mn-cs`, because the theme's complex-script slot is empty. The comparison treats a slot the file does not
  write as a wildcard, so this is not a failure; it is how an empty `<a:cs typeface=""/>` reads, and no family name is involved.
- The `presentationFonts` check is stricter than the RR-05 one (which only rejected extra names): it also requires every name the
  deck's text draws with, and an empty-name entry is reported (none occurred).
