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

**Script.** Every language record now states `script` (ISO 15924) and
`direction`. For a BCP-47 tag that no record matches, the resolver infers the
script from the tag's CLDR likely subtags (`Intl.Locale#maximize`).

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
   design, then deck design, then theme, then `roboto`, as in pagination.
2. `eastAsian` and `complexScript` each use the first of these that applies:
   1. **`fontScheme`**: an explicit slot on the effective design scheme,
      either the record or the inline override. A missing `major` or `minor`
      falls back to the other.
   2. **`schemeFamily`**: the design scheme's own families, when its
      `languageFamily` is that slot (`ea` or `cs`).
   3. **`language`**: the language's font scheme, when the language's role is
      that slot. PowerPoint output uses `fontScheme`; Google Slides output
      uses `googleFontScheme`. Each falls back to the other.
   4. **`latin`**: the latin family.

**Language lookup.** `language` may be written three ways:

- **A catalog id.** The id is looked up in inline `catalogs.languages.records`
  first, then in the bundled catalog.
- **A BCP-47 tag.** It matches an exact tag first. Otherwise it matches a
  record with the same language and script, preferring the same region and
  then a record with no region. The authored tag is kept as `lang`.
- **A Language object.** Its `id` (or its `bcp47`, matched as above) resolves
  a base record. The object's own fields override that record.

URLs, `pkg:` references and unknown ids resolve to `defaultLanguage`, which is
`en-US`. The result then carries `languageSource: "default"`.

## API

`@openpresentation/opf` exports:

- `resolveScriptFonts(document, options?)`: pure. It takes a presentation or
  any `{ design, language, catalogs, slides }` subset.
- `scriptFontRole(script)`.

The options are `app` (`"PowerPoint"` or `"Google Slides"`), `slideIndex`,
`language` and `defaultLanguage`. The result carries:

- `heading` and `body` slots (`{ latin, eastAsian, complexScript }`). The top
  level repeats `body`.
- `lang`, `languageId`, `languageSource`, `script`, `scriptRole`, `direction`
  and `rtl`.
- `supplement`: the language's font for its own script. It is absent for
  Latn, Cyrl and Grek, which the latin slot covers.
- `sources`: where each of `eastAsian` and `complexScript` came from.

## OOXML mapping (for FF-07)

| Resolver output | PPTX location |
| --- | --- |
| `heading.latin` / `.eastAsian` / `.complexScript` | theme `a:majorFont` `a:latin` / `a:ea` / `a:cs` `@typeface` |
| `body.*` | theme `a:minorFont` `a:latin` / `a:ea` / `a:cs` |
| `supplement` | the only `a:font script="…"` entry in each of major and minor. It replaces the vendored Office 2013 list (G2), which is FF-08's call. `Kore` is written as `Hang`, as Office does. |
| `heading.*` / `body.*` | explicit run `a:rPr` `a:latin` / `a:ea` / `a:cs` for title and body text |
| `lang` | run `a:rPr@lang` and `a:endParaRPr@lang`, instead of a fixed `en-US` |
| `altLang` | omitted. It names the editing-UI language, which OPF does not model. Readers use `lang` when it is absent. |
| `rtl` | paragraph `a:pPr@rtl="1"` for every paragraph, and a run-level RTL flag where the writer supports one (`rtlMode`). Default alignment for RTL text is an FF-07 decision. |

**Latin-only decks.** `ea` and `cs` repeat the chosen heading/body family
instead of staying empty. Then `+mn-ea`/`+mn-cs` references in masters, notes
and `endParaRPr` resolve to a chosen font rather than to `""`, which is the
leading hypothesis (H1) for the Aptos appearance. FF-07 states this rule,
subject to FF-05.

**CJK inside a Latin deck.** The author sets
`design.fontScheme.eastAsian` (for example Noto Sans JP), which fills the slot
for every language. Without it, the slot stays Latin and PowerPoint falls back
by font linking. Per-run language is out of scope.

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
  `direction` fields.
- **`FontScheme`:** it gains optional `eastAsian`/`complexScript` in both the
  companion schema and `opf.schema.json`.
- **Resolver:** it is new. Composition, pagination, validation and existing
  documents are unchanged.
- **Renderer and exporter:** their output does not change until FF-07 and
  FF-19 adopt the resolver.

## Open questions

1. **Region in `lang`.** Does PowerPoint need a region (`ja-JP`) for proofing
   and font linking, or does it accept a neutral `ja`? The resolver returns
   the authored or catalog tag. If regions are needed, add them to catalog
   records rather than infer them at runtime (FF-11 determinism). FF-12
   decides.
2. **Slot for Armenian, Georgian and Ethiopic.** These are classified
   `latin` + `supplement`, which needs native confirmation (FF-12).
3. **Default language.** It is `en-US`, matching today's exporter bytes.
   `engine-defaults.json` names `english` (`en`). This should align with
   FF-17's shared default font scheme (`roboto` here, `aptos` in the exporter).
4. **Empty versus filled `ea`/`cs` in Latin decks.** This depends on FF-05's
   Aptos root cause.
5. **Per-run or per-slide language.** Needed for mixed-script decks beyond an
   explicit `eastAsian` slot. It would be a schema addition, and is not
   proposed here.
6. **Curated slots on records.** Should any bundled schemes gain curated
   `eastAsian`/`complexScript` slots (for example Office-theme-like pairs), and
   should imported PPTX themes populate them?
7. **ICU dependence.** Tags without a catalog record depend on the runtime's
   ICU likely subtags. Catalog ids and catalog tags do not.
