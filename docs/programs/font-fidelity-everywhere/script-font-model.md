# Language and script font model (FF-18)

Program: font-fidelity-everywhere, item FF-18. Consumers: FF-07 (PPTX exporter)
and FF-19 (renderer). Source finding: the font-flow map's gap G7. The
`language` field is read by nothing, theme `ea`/`cs` are empty, and every run
is `lang="en-US"`.

## Problem

- Each of the 93 language records names only a font-scheme id (`ja` to
  `meiryo`, `ar` to `arabic-typesetting`).
- Each font scheme has one `languageFamily` and one major/minor pair.
- Nothing states which OOXML slot a language needs, which direction it runs,
  or how the language's font combines with the deck's chosen scheme.

Without that, the exporter can only repeat the Latin family (or leave the slot
empty), and the renderer cannot choose CJK, Arabic or Indic faces.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A. Per-script slots on font schemes (major/minor × latin/ea/cs, as in an OOXML `a:fontScheme`) | Mirrors OOXML exactly. Round-trips imported themes. Lets a brand pick its CJK face. | A scheme cannot know the deck's language: the right `ea` face differs for ja, zh-Hans, zh-Hant and ko (OOXML solves that with its per-script list). All 89 records would need curation. |
| B. Resolve `language.fontScheme` into a script role | Uses data the catalogs already curate. No font-scheme record changes. Language-specific by construction. | No way to choose a CJK or Arabic face other than the language default. CJK inside a Latin deck cannot name a font. Cannot carry an imported theme's `ea`/`cs`. |
| C. Both: B by default, A as optional explicit slots | Keeps B's zero-curation default. Adds A's explicit choice where an author or importer needs one. | Two sources for one slot, so it needs a stated precedence. |

**Chosen: C.** B does the work for every bundled language. The new optional
`eastAsian`/`complexScript` slots on `FontScheme` are for explicit choices. No
bundled record sets them, so catalog behavior does not change.

## Model

**Script.** Every language record now states `script` (ISO 15924),
`direction` and a curated OOXML culture tag, `ooxmlLang` (see Language
tags). Catalog ids and catalog tags resolve without the runtime's locale data:

- Tags are parsed and cased by the resolver itself, not by `Intl`.
- A vendored alias table treats `iw`/`he`, `in`/`id`, `ji`/`yi`,
  `no`/`nb`, `zsm`/`ms` and `ku`/`kmr` as equal when matching. `ku` matches
  the Kurmanji record only in Latin script, so `ku-Arab` (Sorani) stays
  uncatalogued. The catalog has no Yiddish record. If one is added, its
  curated `ooxmlLang` should be `yi-001`, the MS-LCID culture name, not `yi`.
- A vendored likely-script table (from CLDR likely subtags) covers the catalog
  languages written in more than one script:

  | Language | Default script | By region |
  | --- | --- | --- |
  | `zh` | Hans | TW, HK, MO: Hant |
  | `sr` | Cyrl | ME: Latn |
  | `pa` | Guru | PK: Arab |
  | `az` | Latn | IR: Arab |
  | `uz` | Latn | AF: Arab |
  | `mn` | Cyrl | CN: Mong |
  | `bs`, `ms` | Latn | |

- An inline record without `script` takes the script of the bundled record its
  tag matches.

Only a tag that matches no catalog record, has no script subtag and is not in
the vendored table falls through to the runtime's ICU likely subtags
(`Intl.Locale#maximize`). Its result can differ between ICU versions (FF-11).
A tag whose script cannot be found (including `und`) is unresolvable.

**Script role.** The script picks the OOXML slot (`scriptFontRole`):

| Role | Scripts |
| --- | --- |
| `eastAsian` (`a:ea`) | Hans, Hant, Hani, Hanb, Jpan, Kore, Hang, Jamo, Hira, Kana, Hrkt, Bopo, Yiii |
| `complexScript` (`a:cs`) | Arab, Hebr, Syrc, Thaa, Nkoo, Adlm, Rohg, Mand, Samr, Deva, Beng, Guru, Gujr, Orya, Taml, Telu, Knda, Mlym, Sinh, Thai, Laoo, Tibt, Mymr, Khmr, Mong, Bali, Java, Lana, Tale, Talu, Cakm, Olck |
| `latin` (`a:latin`) | everything else: Latn, Cyrl, Grek, Armn, Geor, Ethi, unknown |

**Direction.** The language's `direction` is used when stated. Otherwise it
comes from the script: Arab, Hebr, Syrc, Thaa, Nkoo, Adlm, Rohg, Mand and Samr
are right-to-left.

**Slot precedence.** Each of major (heading) and minor (body) is resolved in
this order:

1. `latin` is the design font scheme's heading/body, exactly as
   `resolveFontFamilies` computes it. The design scheme comes from slide
   design, then deck design, then theme, then the shared `DEFAULT_FONT_SCHEME`
   (`aptos`), which core now exports. There is no per-call option, so the
   last resort cannot drift between engines. By owner decision, one default applies across core
   pagination, opf-render, opf-editor and opf-pptx, so preview matches export.
   The resolver uses it, and FF-35 wires core pagination, opf-render and
   opf-editor to it (they used `roboto` before).
2. `eastAsian` and `complexScript` each use the first of these that applies:
   1. **`fontScheme`**: an explicit slot on the effective design scheme,
      either the record or the inline override. A missing `major` or `minor`
      falls back to the other.
   2. **`schemeFamily`**: the design scheme's own families, when its
      `languageFamily` is that slot (`ea` or `cs`) and its `languages` list
      is empty or names the presentation language. Names match
      case-insensitively, and a base name matches a qualified one, so
      `Punjabi` admits `Punjabi (Gurmukhi)`. A `meiryo` design scheme
      (`["Japanese"]`) therefore does not put Meiryo in `ea` for Korean text;
      Korean gets its own language scheme.
   3. **`language`**: the language's font scheme, when the language's role is
      that slot. PowerPoint output uses `fontScheme`; Google Slides output
      uses `googleFontScheme`. Each falls back to the other.
   4. **`latin`**: the latin family.

**Language lookup.** `language` may be written three ways:

- **A catalog id.** The id is looked up in inline `catalogs.languages.records`
  first, then in the bundled catalog.
- **A BCP-47 tag.** It matches an exact tag first (case-insensitive, with
  deprecated subtags replaced). Otherwise it matches a record with the same
  language and script, preferring the same region and then a record with no
  region.
- **A Language object.** Its `id` (or its `bcp47`, matched as above) resolves
  a base record. The object's own fields override that record.

URLs, `pkg:` references, unknown ids, empty tags and `und` resolve to
`defaultLanguage`, which is `en-US`. The result then carries
`languageSource: "default"`.

**Language tags.** The result carries two tags. Both are canonically cased
(`en-us` becomes `en-US`, `zh-hant-tw` becomes `zh-Hant-TW`), and
deprecated language subtags are replaced (`iw` becomes `he`).

- `bcp47` is the authored tag, else the record's `bcp47`. Renderers use it
  for HTML/SVG `lang`.
- `lang` is the OOXML tag, taken from the first of these:
  1. an `ooxmlLang` written on the document's Language object;
  2. an authored tag that carries a region (`en-NZ`, `ar-SA`);
  3. the record's curated `ooxmlLang`, for example `zsm` to `ms-MY`,
     `no` to `nb-NO`, `tl` to `fil-PH`, `ber-Latn` to `tzm-Latn-DZ`,
     `vi-Latn` to `vi-VN`, `ja` to `ja-JP`, `ar` to `ar-SA`;
  4. the canonical `bcp47`.

Regions are curated in the catalog, never inferred at runtime.

The curated values are Windows culture names, with these noted choices:

- `en` is `en-US` and `pt` is `pt-BR` (the CLDR likely region).
- `ctg` (Chittagonian) is `bn-BD`, because it is written in standard Bengali
  orthography.
- `ay-BO`, `ceb-PH`, `kmr-TR`, `mg-MG` and `sn-Latn-ZW` have no known
  legacy Office LCID. FF-12 should check how PowerPoint treats them.

## API

`@openpresentation/opf` exports:

- `resolveScriptFonts(document, options?)`: pure. It takes a presentation or
  any `{ design, language, catalogs, slides }` subset.
- `scriptFontRole(script)`.

The options are `app` (`"PowerPoint"` or `"Google Slides"`), `slideIndex`,
`language` and `defaultLanguage`. The result carries:

- `heading` and `body` slots (`{ latin, eastAsian, complexScript }`). The top
  level repeats `body`.
- `lang` (OOXML), `bcp47`, `languageId`, `languageSource`, `script`,
  `scriptRole`, `direction` and `rtl`.
- `supplement`: the font for the language's own script. It is present only
  when an explicit slot, the design scheme's own script family, or the
  language's font scheme supplies one. It is never the latin family repeated:
  a `bo-Tibt` deck with no Tibetan font gets no `supplement`. It is absent
  for Latn, Cyrl and Grek, which the latin slot covers.
- `sources`: where each of `eastAsian` and `complexScript` came from.

## OOXML mapping (for FF-07)

| Resolver output | PPTX location |
| --- | --- |
| `heading.latin` / `.eastAsian` / `.complexScript` | theme `a:majorFont` `a:latin` / `a:ea` / `a:cs` `@typeface` |
| `body.*` | theme `a:minorFont` `a:latin` / `a:ea` / `a:cs` |
| `supplement` | the only `a:font script="…"` entry in each of major and minor. It replaces the vendored Office 2013 list (G2), which is FF-08's call. `Kore` is written as `Hang`, as Office does. |
| `heading.*` / `body.*` | explicit run `a:rPr` `a:latin` / `a:ea` / `a:cs` for title and body text |
| `lang` | run `a:rPr@lang` and `a:endParaRPr@lang`, instead of a fixed `en-US`. It is always the curated OOXML tag or an authored region tag, never a bare `zsm` or `no`. |
| `altLang` | omitted. It names the editing-UI language, which OPF does not model. Readers use `lang` when it is absent. |
| `rtl` + `paragraphDirection(text, direction)` | paragraph `a:pPr@rtl="1"` only for paragraphs that `paragraphDirection()` makes right-to-left, and master default levels only when the deck is right-to-left. Alignment stays the composed absolute alignment (FF-07). |

**Latin-only decks.** `ea` and `cs` repeat the chosen heading/body family
instead of staying empty, so `+mn-ea`/`+mn-cs` references in masters, notes
and `endParaRPr` resolve to a chosen font rather than to `""`. This keeps
every slot on a chosen font, but it is not by itself the Aptos fix. Native
evidence shows that PowerPoint's `Presentation.Fonts` reports a nameless font
plus Aptos at open for the Carlito deck, and filling theme `ea`/`cs` with
Carlito did not change that. FF-07 therefore keeps the fill gated on FF-05.

**CJK inside a Latin deck.** The author sets
`design.fontScheme.eastAsian` (for example Noto Sans JP), which fills the slot
for every language. Without it, the slot stays Latin and PowerPoint falls back
by font linking. Per-run language is out of scope.

## Paragraph direction (FF-07, FF-19)

`paragraphDirection(text, deckDirection)` is the one rule both the renderer and the exporter use for a paragraph's base direction:

- In a left-to-right deck every paragraph is left-to-right.
- In a right-to-left deck a paragraph is right-to-left when its first strong character is right-to-left, or when it has no strong character (digits, punctuation, marks or empty text). A paragraph whose first strong character is left-to-right, such as an English quote or code, stays left-to-right.
- Strong characters follow UAX #9 rule P2: text inside directional isolates is skipped, and LRM/RLM/ALM count. Letters are strong; letters of right-to-left scripts (Bidi_Class R/AL) are right-to-left. No locale data is used, only the JavaScript engine's Unicode tables.

The PPTX exporter writes `rtl="1"` on exactly those paragraphs. The renderer sets the SVG/HTML `direction` of each paragraph from the same function.

## Renderer (FF-19)

The renderer calls the same resolver:

- `app: "Google Slides"` yields Noto families for every non-Latin catalog
  language, all openly licensed.
- PowerPoint names can instead go through the caller's font registry
  substitution.
- `lang` and `direction` become SVG/HTML `lang` and `direction`/`dir`.
- Registry theme tokens (`majorEastAsia`, `minorComplexScript`, …) map to the
  matching `heading`/`body` slots.

## Licensing

The resolver returns family names only. It loads, bundles and downloads no
font binaries.

Test fixtures choose openly licensed families:

- Carlito (OFL) for the Calibri class;
- Noto Sans JP/SC/TC/KR, Noto Naskh Arabic, Noto Sans Hebrew, Noto Sans
  Devanagari and Noto Sans Thai (OFL) for CJK, Arabic, Hebrew, Indic and Thai.

PowerPoint-target names from the catalogs, such as Meiryo, Arabic Typesetting
and Mangal, appear only as expected strings. Any later raster or native test
that needs glyphs must use the open families. The proprietary faces are for
native Office checks on a licensed machine (FF-12) only.

## Catalog observations (recorded, unchanged)

- The Google `noto-sans` scheme is labeled `cs` but serves Cyrillic and Greek
  languages. The resolver keys on `script`, so the label does not matter.
- Pashto and Punjabi (Shahmukhi) use the `arial` scheme (labeled `latin`) for
  Arabic script. The resolver still puts Arial in `cs`.
- Armenian, Georgian and Amharic schemes are labeled `cs`. OOXML covers those
  scripts through the latin slot plus a per-script theme font, so their
  families surface as `supplement`.
- The ids `noto-sans-devangari` and `noto-naksh-arabic` are misspelled. They
  are kept for compatibility.
- `mongolian` (`mn`) is Cyrillic in practice, but its Google scheme is Noto
  Sans Mongolian (traditional script).
- `spec/reference/engine-defaults.json` names per-script default schemes
  (`microsoft-yahei`, `nirmala-ui`). The resolver deliberately does not use
  them for unchosen slots, because FF-08 and FF-12 require only chosen fonts.

## Compatibility

All changes are additive:

- **Language records:** they gain the already-defined optional `script` and
  `direction` fields, plus a new optional `ooxmlLang` field (in both the
  companion schema and `$defs/Language`).
- **`FontScheme`:** it gains optional `eastAsian`/`complexScript` in both the
  companion schema and `opf.schema.json`.
- **Resolver:** it is new. Composition, pagination, validation and existing
  documents are unchanged.
- **Renderer and exporter:** their output does not change until FF-07 and
  FF-19 adopt the resolver.

## Decisions on the open questions (review of opf#118)

1. **Region in `lang`.** Catalog records carry a curated `ooxmlLang`
   (Windows culture form). Regions are not inferred at runtime. FF-12 still
   checks the records without a legacy LCID (`ay-BO`, `ceb-PH`, `kmr-TR`,
   `mg-MG`, `sn-Latn-ZW`).
2. **Armenian, Georgian and Ethiopic.** Keep `latin` + `supplement`. Add
   Mongolian (Mong) and Tibetan (Tibt) to the FF-12 native sample, next to
   Armenian, Georgian and Amharic, to confirm how PowerPoint assigns their
   slots.
3. **Default language and font scheme.** Keep `en-US`. The owner chose one
   shared default font scheme, `aptos` (`DEFAULT_FONT_SCHEME`), for every
   engine. The resolver falls back to it, with no per-call override, and FF-35 wires pagination, the
   renderer and the editor to it (done). Reconciling `engine-defaults.json` (`english`, `en`)
   with `en-US` remains an FF-17 follow-up.
4. **Filled `ea`/`cs` in Latin decks.** The resolver reports the chosen
   heading/body family for these slots. FF-07 keeps writing them gated on
   FF-05. Native evidence shows that filling theme `ea`/`cs` with Carlito did
   not remove the nameless font or Aptos that `Presentation.Fonts` lists at
   open, so the fill is not by itself the Aptos fix.
5. **Per-run language.** Deferred. The explicit `eastAsian`/`complexScript`
   slots cover CJK or Arabic text inside a Latin deck until then.
6. **Curated slots.** Bundled schemes stay uncurated. Imported PPTX themes
   should populate explicit `eastAsian`/`complexScript` slots from their
   `a:ea`/`a:cs` typefaces so they round-trip. This is an FF-07/import
   follow-up.
7. **ICU dependence.** Catalog ids and catalog tags are deterministic
   (vendored alias and likely-script tables, as above). Only uncatalogued tags
   without a script subtag use `Intl.Locale`.
