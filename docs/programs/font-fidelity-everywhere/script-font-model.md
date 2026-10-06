# Language and script font model (FF-18)

Program: font-fidelity-everywhere, item FF-18. Consumers: FF-07 (PPTX exporter)
and FF-19 (renderer). Source finding: the font-flow map's gap G7. The
`language` field is read by nothing, theme `ea`/`cs` are empty, and every run
is `lang="en-US"`. That was the state before FF-07 and FF-19; the exporter and
renderer now implement this model. [Language contract (FF-50)](#language-contract-ff-50-model-c)
states what a language sets, and [Theme slots (FF-49)](#theme-slots-ff-49-amended-by-ff-05) what
the theme's `ea`/`cs` typefaces are for every font scheme.

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
| `heading.*` / `body.*` | explicit run `a:rPr` `a:latin` for title and body text; no run `a:ea` / `a:cs` (FF-05: PowerPoint lists such a run font as an empty-name font; the theme slots carry them) |
| `lang` | run `a:rPr@lang` and `a:endParaRPr@lang`, instead of a fixed `en-US`. It is always the curated OOXML tag or an authored region tag, never a bare `zsm` or `no`. |
| `altLang` | omitted. It names the editing-UI language, which OPF does not model. Readers use `lang` when it is absent. |
| `rtl` + `paragraphDirection(text, direction)` | paragraph `a:pPr@rtl="1"` only for paragraphs that `paragraphDirection()` makes right-to-left, and master default levels only when the deck is right-to-left. Alignment is logical for right-to-left text: `algn="r"` for the authored `left` (RR-05, [Layout direction](#layout-direction-rr-05)). |

**Latin-only decks.** The resolver reports the chosen heading/body family for `ea` and
`cs` (`sources` is `"latin"`), so the preview and the theme have a face for the `ea` slot.
The exported theme's `a:ea` is never empty (FF-05, 2026-10-02): it repeats the latin family when
no script font is selected, because PowerPoint lists an empty theme `ea` as an empty-name font
through every paragraph end mark (native evidence in
[ff-05-native-20261002](../../evidence/ff-05-native-20261002/README.md)). `a:cs` stays empty, as in
Office's own themes, unless a script font is selected for that slot. Slide and notes runs carry no
explicit `a:ea`/`a:cs` typeface (PowerPoint lists such a run font as an empty-name font); the faces come
from the theme slots through `+mn-ea`/`+mn-cs`. FF-49 originally kept both slots empty
(owner font policy, Office's per-language default); see [Theme slots (FF-49)](#theme-slots-ff-49-amended-by-ff-05).

**CJK inside a Latin deck.** The author sets
`design.fontScheme.eastAsian` (for example Noto Sans JP), which fills the slot
for every language. Without it, the slot stays Latin and PowerPoint falls back
by font linking. Per-run language is out of scope.

## Language contract (FF-50, Model C)

The presentation `language` is the language of the text. It sets exactly these
four things, and no others:

1. **`lang`.** The curated OOXML tag (`ooxmlLang`, or an authored region tag) on
   every run, end-of-paragraph and default run property in PPTX; SVG/HTML
   `lang` in the preview. `altLang` is not written: it names the editing-UI
   language, which OPF does not model. `a:ea` and `a:cs` carry no `lang`
   attribute (DrawingML `CT_TextFont` has `typeface`, `panose`, `pitchFamily`
   and `charset` only), so the language is stated once, on the run.
2. **Direction.** `rtl` for right-to-left scripts (Arabic, Hebrew, Syriac,
   Thaana and the other scripts listed under [Direction](#model)): PPTX
   paragraph `rtl="1"` by `paragraphDirection()`, master default levels, and
   the preview's `direction`/`dir`. The same value mirrors the layout: see
   [Layout direction](#layout-direction-rr-05).
3. **The script font slots.** The slot the language's script uses (`ea` for
   CJK, `cs` for Arabic, Hebrew, Indic, Thai and the other complex scripts)
   takes the language's script font from its catalog record (`fontScheme`, or
   `googleFontScheme` for Google Slides), unless the design font scheme names
   that slot itself. The language's own script also gets the theme's
   `a:font script="…"` entry. Every other script slot follows the
   [Theme slots](#theme-slots-ff-49-amended-by-ff-05) rule.
4. **Mixed-script layout.** The preview itemizes text by Unicode script and
   gives each run the slot its script uses (opf-render, FF-19).

**A language never sets the Latin scheme.** `latin` is the design font
scheme's heading/body (slide, then deck, then theme, then the shared default
`aptos`) whatever the language is. A Japanese deck with `design.fontScheme:
"calibri"` has Calibri in `latin` and Meiryo in `ea` (its `cs` stays empty). The language's font
scheme is a source for the language's own script slot, never for `latin`. A
record's `fontScheme` is therefore a *script* default, not a deck font: it
does not change how Latin text in that deck looks. An engine that changed the
Latin fonts when a language was set would violate this contract, and the gallery
audit measures that as a gap.

| Language | Script role | Direction | `lang` | Theme `a:latin` (`aptos` deck) | Theme `a:ea` | Theme `a:cs` | Own-script entry |
| --- | --- | --- | --- | --- | --- | --- | --- |
| English, French, Russian, Greek | `latin` | ltr | `en-US`, `fr-FR`, `ru-RU`, `el-GR` | Aptos Display / Aptos | Aptos Display / Aptos | empty | none |
| Japanese | `eastAsian` | ltr | `ja-JP` | Aptos Display / Aptos | Meiryo | empty | `Jpan`: Meiryo |
| Chinese (simplified) | `eastAsian` | ltr | `zh-CN` | Aptos Display / Aptos | Microsoft YaHei | empty | `Hans`: Microsoft YaHei |
| Chinese (traditional) | `eastAsian` | ltr | `zh-TW` | Aptos Display / Aptos | Microsoft JhengHei | empty | `Hant`: Microsoft JhengHei |
| Korean | `eastAsian` | ltr | `ko-KR` | Aptos Display / Aptos | Malgun Gothic | empty | `Hang`: Malgun Gothic |
| Arabic | `complexScript` | rtl | `ar-SA` | Aptos Display / Aptos | Aptos Display / Aptos | Arabic Typesetting | `Arab`: Arabic Typesetting |
| Hebrew | `complexScript` | rtl | `he-IL` | Aptos Display / Aptos | Aptos Display / Aptos | David | `Hebr`: David |
| Hindi | `complexScript` | ltr | `hi-IN` | Aptos Display / Aptos | Aptos Display / Aptos | Mangal | `Deva`: Mangal |
| Thai | `complexScript` | ltr | `th-TH` | Aptos Display / Aptos | Aptos Display / Aptos | Angsana New | `Thai`: Angsana New |
| Amharic | `latin` | ltr | `am-ET` | Aptos Display / Aptos | Aptos Display / Aptos | empty | `Ethi`: Nyala |
| Armenian, Georgian | `latin` | ltr | `hy-AM`, `ka-GE` | Aptos Display / Aptos | Aptos Display / Aptos | empty | `Armn`, `Geor`: Sylfaen |

(Heading and body take the same value in these bundled records. The script fonts are
`resolveScriptFonts` output for an `aptos` deck; the `ea` column repeats the latin family where nothing selects a script font (FF-05); "empty" is the theme's typeface,
where the preview and the run-level slots use the latin family. Every family named is a
scheme family in the font catalog.)

Armenian, Georgian and Ethiopic keep their script font in the per-script entry,
not in `cs`. PowerPoint classifies those scripts with the latin slot (see the
decision below), so a `cs` value would not be applied to their text. Their
catalog font scheme is labelled `cs` for picker grouping only. FF-12 checks the
classification natively.

The deck chooses the font for these three scripts through the complex-script slot, as the native FF-46 decks do: an
explicit `complexScript` pair in `design.fontScheme` (the inline form), or a design font scheme that is a `cs` scheme for
the deck's language (its `languageFamily` is `cs` and its `languages` list is empty or names the language: source
`schemeFamily`). The per-script entry then names that family instead of the language's catalog default (FF-46, opf#375:
an Amharic deck on Ebrima wrote `Ethi` as Nyala, and PowerPoint listed Nyala in `Presentation.Fonts`). A latin-only
scheme, an `eastAsian` slot and a `cs` scheme for another language name no family for these scripts, so the language's
default stays. The East Asian and complex-script scripts (`Jpan`, `Hang`, `Hans`, `Hant`, `Arab`, `Deva`, ...) already
read their own resolved slot, so an explicit `eastAsian` / `complexScript` slot is their entry.

**Who implements what.**

| Part | Implementation |
| --- | --- |
| Resolution | core `resolveScriptFonts()`, `paragraphDirection()`, `scriptFontRole()` |
| Export | opf-pptx `src/script-fonts.js`: `lang`, `rtl`, theme `ea`/`cs` (FF-05: no run `ea`/`cs`), own-script entry |
| Preview | opf-render `src/script-fonts.js` and `svg.js`: per-script itemization, slots, `lang`, `direction`, open replacement faces loaded through the shipped host |
| Re-import | opf-pptx: the run `lang` maps back to the catalog id (an FF-32 stored id wins); a theme `ea`/`cs` that repeats latin or matches what the imported language resolves to raises no `script-font-not-imported` |
| Audit | audit B's language classifier measures the contract: the run `lang`, the direction of a native-name sample, the script slot named in runs, and in the theme where the language or scheme selected a script font (an empty slot is a gap only then), the language's script face present under the modelled host (FF-48), re-import keeps the language, and the Latin scheme unchanged by the language. It no longer expects an engine to derive the Latin font scheme from `language` alone |

No schema field changes. The `language` and font scheme descriptions already
say this (`language.schema.json` `fontScheme`: "the latin slot always follows
the design font scheme").

## Theme slots (FF-49, amended by FF-05)

The presentation theme's major and minor `a:ea` and `a:cs` typefaces follow **the owner font policy: the PPTX names
what the author selected, and nothing they did not select**, with one amendment from the FF-05 native evidence
(2026-10-02, [ff-05-native-20261002](../../evidence/ff-05-native-20261002/README.md)): the `ea` slot always names a font,
because an empty theme `ea` is listed by PowerPoint as an empty-name font in `Presentation.Fonts` through every
paragraph end mark, and the exporter's paragraphs all carry `a:endParaRPr`. Each of the four slots is resolved like the
run slots, and the resolver's `sources` says which case applies:

| Situation (`sources[slot]`) | Theme `a:ea` | Theme `a:cs` |
| --- | --- | --- |
| The design font scheme sets the slot (`fontScheme`: `eastAsian` / `complexScript`, record or inline) | that explicit family | that explicit family |
| The scheme's own `languageFamily` is that slot and its `languages` list is empty or names the language (`schemeFamily`) | the scheme's family for the slot | the scheme's family for the slot |
| The language's script uses the slot (`language`) | the language's font scheme (its script font) | the language's font scheme (its script font) |
| Nothing selects a script font for the slot (`latin`), and the deck text has no East Asian characters | **the latin family of that font group (FF-05)** | **empty, as Office leaves it** |
| Nothing selects `ea` and the deck text has East Asian characters (exporter rule, below) | **a font for that text (FF-05)** | empty |

**East Asian text in a Latin-language deck (FF-05).** When no script font is selected for `ea` but the deck's slide text holds
kana, hangul or Han characters, the exporter names a real East Asian family in the theme `ea`, as the resolver gives it for
the language of that script: kana is Japanese (Meiryo), hangul Korean (Malgun Gothic), Han characters alone Simplified
Chinese (Microsoft YaHei). Without it the East Asian characters read an unresolved `+mn-ea` (native `NameFarEast`). A deck
`language` that selects an East Asian font wins over the text. This content rule lives in the exporter: core's
`resolveScriptFonts` has no content-based mode, and the preview draws such text with its own script face, so the preview and the
export differ for this one case. A Han-only text meant as Traditional Chinese or Japanese needs the deck `language`.

So a Latin, Cyrillic or Greek deck writes the latin family in `ea` and nothing in `cs` (89 of 89 catalog font schemes in the
default language: no bundled record sets `eastAsian` or `complexScript`), a Japanese deck writes `ea` only from the language
(its `cs` stays empty), and an Arabic deck writes `cs` from the language and the latin family in `ea`.

**Why the slot is not left empty (amends the FF-49 rationale).** FF-49 (review, 2026-09-30) rejected filling every empty
slot with the latin family. Its two arguments were that an empty slot lets PowerPoint pick its per-language default for text
typed later, and that the PPTX would name a font the author never selected. The native probes show a cost the review could not
see: the empty `ea` is an empty-name font in `Presentation.Fonts`, and the earlier controls that filled the slots (E6, E7)
could not have shown the effect, because other package defects (the out-of-order notes master list, run-level `ea`/`cs`)
listed the same entry. The decision (root agent, vetoable): `ea` names the latin family or a script font, `cs` keeps the
FF-49 rule. The latin family is the deck's own chosen family, so no font the author did not choose enters the package; what is
lost is only the per-language default for East Asian text typed into such a deck later, which then uses the chosen latin
family with PowerPoint's font linking.

**Per-script supplements.** Office defaults per script (Microsoft YaHei, Nirmala UI, Times New Roman for Arabic,
`spec/reference/engine-defaults.json`) are still not written: nobody selected them. The vendored `a:font script=…` list is
unchanged except for the language's own script entry (see the OOXML mapping).

**The preview needs a face for every slot; the theme now names the `ea` face too.** The preview draws text of a script
with the slot for that script, so its slot is the selected script font where one is selected and the latin family where
nothing is. opf-render's per-slide script profile therefore equals the exported theme in `ea` (the selected font or the
latin family) and in `cs` where the theme names a family, and equals the latin family where `cs` is empty. The rule is
checked for every catalog font scheme times every catalog language (89 × 93 combinations), and by
`test/theme-script-slots.mjs` in opf-pptx and `test/theme-slots.mjs` in opf-render in CI. A preview draws a slot's family
through the policy table's open replacement and the script pack (FF-19, FF-31); the PPTX keeps the selected name. The one
difference is the content rule above.

**Audit.** "Theme major/minor `ea` or `cs` typeface is empty" is a gap only when a script font was selected for the
slot (a `sources` value other than `latin`) and the export wrote nothing or a different name, including a preview
replacement. The `ea` slot repeating the latin family when nothing was selected is `works`, and so is an empty `cs`. The
audit measures the expectation with the core resolver (`expectedThemeEaCs`, the selected family per slot, `''` when nothing
was selected), so the reason follows the rule above instead of counting empty slots. It applies to the font-scheme,
language and theme dimensions alike.

**FF-05.** The Aptos origin is determined (the notes master list, its shared theme, run-level `ea`/`cs` and the empty
theme `ea` through `endParaRPr`); the amendment above is its outcome. Native reads of the final exporter output list only the
deck's fonts (Georgia, Meiryo; the mixed Latin and Japanese decks list the Japanese face). Other native confirmation of
slot fidelity remains a root-only FF-12/FF-46 gate.

**Re-import.** With FF-32 provenance the stored `design.fontScheme` and `language` are restored (the stored theme
snapshot records the written slots, so an unedited theme matches). Without provenance the importer reads no font scheme
from a theme (unchanged). A theme `ea`/`cs` that is empty, repeats latin or matches what the imported language resolves
to raises no `script-font-not-imported`.

**`checkPptxTypefaces`.** An empty theme `ea`/`cs` is accepted when nothing was selected. Passing
`themeScripts: {major: {ea, cs}, minor: {ea, cs}}` (the families the author selected) makes it report a selected slot
that is empty or different (`theme-script-slot`).

## Paragraph direction (FF-07, FF-19)

`paragraphDirection(text, deckDirection)` is the one rule both the renderer and the exporter use for a paragraph's base direction:

- In a left-to-right deck every paragraph is left-to-right.
- In a right-to-left deck a paragraph is right-to-left when its first strong character is right-to-left, or when it has no strong character (digits, punctuation, marks or empty text). A paragraph whose first strong character is left-to-right, such as an English quote or code, stays left-to-right.
- Strong characters follow UAX #9 rule P2: text inside directional isolates is skipped, and LRM/RLM/ALM count. Letters are strong; letters of right-to-left scripts (Bidi_Class R/AL) are right-to-left. No locale data is used, only the JavaScript engine's Unicode tables.

The PPTX exporter writes `rtl="1"` on exactly those paragraphs. The renderer sets the SVG/HTML `direction` of each paragraph from the same function.

Since RR-05 composition computes this once per paragraph, not per line: `TextFit.directions` (and `ListEntryLayout.direction`, `TableCellLayout.direction`) carry the direction of the paragraph each displayed line belongs to, using `paragraphDirectionAt(text, direction)`, which maps a source offset to its paragraph (the text between hard line breaks). A wrapped Arabic paragraph whose last line holds only Latin words, or an English paragraph whose last line holds only digits, therefore keeps its paragraph's direction on every line, in the preview and in the PPTX.

## Layout direction (RR-05)

The deck direction is the direction of the presentation `language`'s script (`resolveScriptFonts().direction`, also `resolveSlideDirection(presentation, slideIndex)`); `composeSlide` reads it from `options.presentation` or from an explicit `options.direction`. It is **deck level**: a left-to-right deck that holds Arabic phrases (`scripts-inside-latin`) is not mirrored, and a right-to-left deck mirrors even when one slide holds only English. A left-to-right deck composes exactly as before RR-05 (no `direction`, no `directions`).

In a right-to-left deck:

- **Alignment is logical.** The authored or default `left` alignment means *start*, `right` means *end*, `center` is unchanged. A right-to-left paragraph aligned `left` is drawn against the right edge; a left-to-right paragraph (an English quote, code) keeps the left edge. The decision is per paragraph (`physicalAlignment(alignment, direction)`). `item.alignment` stays the logical authored value and `placement.lines[i].alignment` records the physical edge.
- **The arrangement mirrors.** Grid columns, the `left`/`center`/`right` region names, a banded slide image, the cover logo and the header/footer zones swap sides inside their container. Track sizes, weights and the scoring are unchanged; only each box moves to its mirrored place, at every nesting level. Header/footer zones keep their authored name (`zone`) and carry the physical edge in `alignment`.
- **Lists.** An entry whose own paragraph is right-to-left puts its marker at the right (`marker.anchor: "end"`, `marker.x` is the right edge), its text column to the left of the marker, and nested levels step in from the right. A Latin entry keeps the left-to-right list shape.
- **Tables** lay the columns out from the right (the first column is the rightmost; indices stay logical) and each cell reports its own paragraph direction. The PPTX writes `a:tblPr rtl="1"`.
- **Metric** blocks align per their own text direction; **timelines** run right to left (the first event at the right; a vertical rail runs at the right).
- **Charts**: column, line and area charts reverse their category axis (`c:catAx` orientation `maxMin`), which puts the value axis at the right, as PowerPoint draws a chart with reversed categories. Bar charts keep their vertical category axis.

Why the composition mirrors, not only the text: an Arabic or Hebrew author reads a slide from the right, so a two-column slide's first column, a table's first column and a list's markers belong at the right. PowerPoint does not mirror a slide when a paragraph is set right to left (the paragraph flips its bullet side and its start edge only, and `a:tblPr rtl` is the one structural switch), so OPF applies the rule to the whole composition from the language, and the preview and the export read the same geometry.

PPTX mapping (native evidence of 2026-10-01 and the follow-up set, see [rr-05-rtl-layout.md](../release-readiness/rr-05-rtl-layout.md)): `a:pPr@algn` is physical (`rtl="1"` with `algn="l"` hugs the left edge with the bullet at the right of the text, which is what the earlier export drew); `marL` and `indent` are the start-side margin and hanging indent, so `rtl="1" algn="r" marL=m indent=-m` hangs the bullet at the right; PowerPoint orders a Latin phrase inside a run tagged with a right-to-left `lang` as separate items (`v2.0` read `2.0v`), so the exporter writes each Latin phrase (letters, joining spaces and word punctuation, and the digits of the phrase) as its own `en-US` run and keeps digits that touch Arabic words in the Arabic run.

## Renderer (FF-19)

The renderer calls the same resolver:

- `app: "Google Slides"` yields Noto families for every non-Latin catalog
  language, all openly licensed.
- PowerPoint names can instead go through the caller's font registry
  substitution. This applies to preview drawing and measurement only; the PPTX
  keeps the selected names (FF-31).
- `lang` and `direction` become SVG/HTML `lang` and `direction`/`dir`.
- Registry theme tokens (`majorEastAsia`, `minorComplexScript`, …) map to the
  matching `heading`/`body` slots.

### Which host loads the script faces (measured 2026-09-30)

The script pack is optional, and the shipped hosts load it per document rather than up front:

- The pptx.gallery editor (opf-editor 0.10.x) builds its browser registry from the office pack's eager faces and runs its font gate before every render:
  `registry.ensureLazyFonts(document)` and `registry.ensureScripts(document)` fetch the vendored faces and the script faces the document needs (its text, and, since
  opf-render 0.11.2, the faces its font schemes name, so a Latin sample in a Meiryo scheme loads Noto Sans JP).
- Node uses `prepareNodeFonts({scripts: 'auto', presentation})` for the same selection. It differs in one case: the Latin Noto Sans is loaded as a glyph-fallback face and `auto`
  does not reload it as a designated replacement, so Sylfaen (replacement Noto Sans) with Latin text is `font-unavailable` in Node and works in the editor.
- The parity harness models the editor (`gallery-support/parity/scripts/font-host.mjs`); see [the run](gallery-support/parity/PARITY-2026-09-30-gallery-font-host.md).
  Loading a face is not qualifying it: the 61 gallery values whose scheme is a proprietary script font are `near` (a visual Noto replacement). The script corpora
  (FF-44, [script-corpora.md](script-corpora.md)) qualify each pinned face's coverage and shaping; the pinned Noto Sans Mongolian face, which could not shape any text in fontkit when this
  run was made, shapes since the undecodable-lookup guard (it equals HarfBuzz on the corpus).

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
   heading/body family for these slots, and the preview uses it. FF-07 gated a fill of the
   theme's `a:ea`/`a:cs` on FF-05, and FF-49 (review, 2026-09-30) rejected filling them with
   the latin family because Office leaves them empty and the owner font policy names only
   what the author selected. FF-05 (2026-10-02) amended that for `ea` only: native probes
   show an empty theme `ea` is an empty-name font in `Presentation.Fonts`, so the theme `ea`
   names the latin family (or a script font, or a font for East Asian text in the deck) and
   `cs` stays empty unless a script font is selected; run-level `ea`/`cs` are not written.
   See [Theme slots](#theme-slots-ff-49-amended-by-ff-05).
5. **Per-run language.** Deferred. The explicit `eastAsian`/`complexScript`
   slots cover CJK or Arabic text inside a Latin deck until then.
6. **Curated slots.** Bundled schemes stay uncurated (still true for all 89 in FF-49: no record selects a script font by itself, so the theme slots follow the language). Imported PPTX themes
   should populate explicit `eastAsian`/`complexScript` slots from their
   `a:ea`/`a:cs` typefaces so they round-trip. This is an FF-07/import
   follow-up.
7. **ICU dependence.** Catalog ids and catalog tags are deterministic
   (vendored alias and likely-script tables, as above). Only uncatalogued tags
   without a script subtag use `Intl.Locale`.
