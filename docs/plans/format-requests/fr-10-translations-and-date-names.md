# FR-10 design note: translations and localized date names (CR 15)

A builder's brief for item FR-10 of the format-requests program (`docs/programs/format-requests/burndown.md` on `main`). Two parts: variable
translations, and month and weekday names in the language where a date is drawn. The owner chose on 2026-11-25 that nothing is cut
from 0.37.0 (`r-one`), so both parts ship; part 1 is still committed first and stands on its own. The measured size of the date-name table is in [Size](#size), with what it means for each budget.

Who decided what:

- **Owner, 2026-11-24**: no `locale` field, a subtag on `language` says it (`cr15-locale`); the language where the variable is drawn
  selects the translation, falling back from `de-AT` to `de` to the plain value (`cr15-pick`); names from a generated table, measured
  before it is committed (`cr15-names`).
- **Analysis, for the supervisor to confirm**: everything else, marked *(analysis)*.

## The need

A template for a German team needs German text in its blanks and German dates. Numbers already follow the deck's language (grouping and
digits, from OPF's locale table). Dates do not: month and weekday names are English whatever the language, and a variable has one value
for every language. A variable may carry translations, and dates use the names of the language they are drawn in.

## Part 1: translations

### Schema

A new definition and a new optional property on the variable kinds whose value is language-dependent:

```json
"LanguageTag": {
  "type": "string",
  "pattern": "^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$",
  "description": "A BCP 47 language tag, as 'language' takes: 'de', 'de-AT', 'zh-Hant', 'sr-Latn'."
}
```

| Variable kind | `translations` | Each entry |
| --- | --- | --- |
| `text` | yes | `{ "value": <string or TextRun[]> }` |
| `list` | yes | `{ "value": <the list's value form> }` |
| `url` | yes | `{ "value": <url> }` (a localized landing page) |
| `image` | yes | `{ "value": <image source> }` (a localized screenshot) |
| `date` | yes | `{ "format": <date pattern> }`: the date is the same in every language; how it is written is not |
| `number`, `color` | no | Numbers already follow the language; colors do not change with it. |

For example, on `TextVariable`:

```json
"translations": {
  "type": "object",
  "propertyNames": { "$ref": "#/$defs/LanguageTag" },
  "additionalProperties": {
    "type": "object", "additionalProperties": false, "required": ["value"],
    "properties": { "value": { "oneOf": [ { "type": "string" }, { "type": "array", "items": { "$ref": "#/$defs/TextRun" } } ] } }
  },
  "minProperties": 1,
  "description": "The value in other languages, keyed by language tag. Where the variable is drawn, the slide's language (else the deck's) selects an entry: the exact tag, then the tag with its last subtag removed, and so on ('de-AT', then 'de'), else 'value'."
}
```

- `date` translations take `format`, not `value`. *(analysis: the burndown says "a map from a language tag to `{ value }`"; a date's
  value is the same everywhere, and "5. März 2026" against "March 5, 2026" is a difference of pattern, which the date names of part 2
  alone do not fix.)*
- No translations on `number` and `color`. *(analysis)*
- Keys compare case-insensitively (`de-at` matches `de-AT`); two keys that differ only in case are the warning
  `variable-translation-duplicate`.

### Which entry is drawn

1. The language of the place where the variable is drawn: the slide's declared `language`, else the deck's declared `language`. A
   language read from the text (v0.35, for decks that declare none) does **not** select a translation. *(analysis: the reading is made
   from the text the translation would replace.)*
2. Look up the exact tag, then remove the last subtag and look again (`zh-Hant-TW`, `zh-Hant`, `zh`), case-insensitively.
3. None found: `value`, as today.

This applies to inline `{{id}}` tokens and whole `var:id` fields alike, in titles, text, notes, captions, alt text and furniture. A
deck with no declared language always draws `value`.

### Other rules

- `required`: a variable is filled where it is drawn when that place selects a translation or the variable has a `value`. A template may
  hold translations without `value`; a place that selects none is then unfilled, with today's rule. *(analysis)*
- FR-09's limits (`maxLength`, `maxLines`, `maxItems`) apply to every translation as to `value`; an overflow reports the translation's
  path (`/variables/cta/translations/de/value`).
- `opf fill`: a fill record that sets `value` and gives no `translations` **removes** the variable's translations in the filled deck, so a
  German slide cannot keep the template's German text beside a new English value; a fill record may give `translations` itself.
  `opf fill` reports each removal in its summary. *(analysis)*
- Built-in variables (`deck.name`, `speaker.name`, `organization.name`, ...) take no translations.

| Id | Severity | When | Path |
| --- | --- | --- | --- |
| schema | error | A key that is not a language tag, a `value` of the wrong form for the kind | the key |
| `variable-translation-duplicate` *(analysis: name)* | warning | Two keys equal except for case: the first matching key in document order is used, and the message names it | `/variables/{id}/translations` |
| `variable-translation-unused` *(analysis: name)* | warning | No slide and not the deck selects a translation (its language is used nowhere) | `/variables/{id}/translations/{tag}` |

The duplicate is a warning (supervisor, 2026-11-25): the README fixes the errors to a short list. The first matching key in document order
is used, and the message says which.

## Part 2: date names

### What changes

The date tokens of `DateVariable.format` and of the footer's `dateFormat` (`yyyy`, `yy`, `MMMM`, `MMM`, `MM`, `M`, `dd`, `d`, `EEEE`,
`EEE`, quoted literals) are drawn by one formatter (`furniture-fields.ts`, which holds the English month names today). With this part:

- `MMMM` and `MMM` print the month's long and short name, `EEEE` and `EEE` the weekday's, **in the language where the date is drawn**
  (the same language as part 1: the slide's, else the deck's declared language; English when none is declared or the language has no
  data).
- **Format and stand-alone forms**: in a pattern with a day token (`d`, `dd`), `MMMM` and `MMM` print the format form ("5 марта"); without
  one, the stand-alone form ("март 2026"), as LDML's `MMMM` and `LLLL` do. *(analysis: Slavic, Baltic, Greek, Catalan and other languages
  inflect the month after a day; 23 of the 88 languages differ.)* Where a language writes its months as numbers with a counter (Japanese,
  Chinese, Korean), `MMMM` prints the whole label ("3月", "3월").
- **The default pattern**: a date variable without `format` uses the language's long date pattern, read from the same data ("d. MMMM yyyy"
  in German, "d MMMM yyyy" in French and British English, "yyyy年M月d日" in Japanese, "d' de 'MMMM' de 'yyyy" in Spanish). US English and
  a deck with no language keep `"MMMM d, yyyy"`, so English decks without a language draw as before. *(analysis: without it, a German
  deck prints "März 5, 2026", a German name in English order. The patterns cost 543 bytes gzipped.)* An era token in a language's
  pattern (Pashto) is dropped.
- Digits stay the numerals table's (LH-106), as for every number.

### The table

- A generator, `packages/javascript/scripts/build-date-names.mjs` (a starting point is `build-date-names.mjs` beside this note, the script
  the sizes below were measured with), writes `packages/javascript/src/date-name-data.ts` from the runtime's
  `Intl` data, as `build-number-locales.mjs` writes the numbers table: the same ICU and CLDR versions (ICU 78.3, CLDR 48.0 today), recorded
  in the file. `test/date-names.mjs` compares the table with the running `Intl` and fails on the ICU version the table was made with when
  they disagree; the table is regenerated on purpose, with a changelog fragment.
- **Languages**: the gallery's language records (93 distinct tags). The runtime has data for 88; `ay` (Aymara), `ber-Latn` (Berber) and
  `ctg` (Chittagonian) have none and draw English names, which the docs list. Regional variants equal to their base language (`en-US`,
  `en-CA`) are not stored.
- **Per language**: the long and short month names in the format form, the stand-alone forms where they differ, the long and short
  weekday names, and the long date pattern. Stored as one `|`-joined string per list (smaller than JSON arrays after compression).
- Lookup falls back as part 1 does (`sr-Latn` and `sr-Cyrl` are separate entries).

### Size

Measured on 2026-11-25 with ICU 78.3 / CLDR 48.0, for the 88 languages, as a TypeScript module (`date-name-data.ts`) of joined strings:

| Table | Source bytes | gzip (level 9) | brotli |
| --- | ---: | ---: | ---: |
| Month and weekday names, long and short, format and stand-alone | 33,836 | 11,963 | 9,504 |
| Long date patterns | 1,864 | 543 | |
| **Both** | 35,700 | **12,502** | |
| As one generated module, comments included (`build-date-names.mjs` beside this note) | 36,418 | 12,967 | |
| Variants: long names only (no `MMM`, `EEE`) | | 9,013 | |
| Variants: without stand-alone forms | | 11,099 | |

Against the budgets the supervisor named (headroom on `main` on 2026-11-25):

| Budget | Headroom | +12.5 KB gzip |
| --- | ---: | --- |
| `scripts/catalog-free-budget.json`, `composition` | 9,045 | **Over by about 3.5 KB** |
| `browser`, `convert`, `deck`, `ids`, `markdown`, `pagination`, `patch`, `validator`, `yaml` | 15,300 to 19,100 | Fits, using most of the 3% headroom |
| Entries that do not draw dates (`schema*`, `format`, `diff`, `shape-*`, `data`, ...) | n/a | Not affected, if the table is imported only by the formatter |
| Lean MCP Worker, gzip ceiling (`mcp-workerd.test.mjs`) | 32,958 before the 0.37 items | Fits today; each 0.37 item adds code, so the builder measures it on the branch |
| Lean MCP Worker, minified and unminified ceilings | about 3% | The unminified table (35.7 KB) fits the unminified ceiling's headroom only if earlier items left it |
| MCP bundled documentation (`mcp.test.mjs`) | n/a | Not affected: the table is code, not documentation |
| The site's llms chunks | n/a | Not affected; the schema adds only `translations` and `LanguageTag` |

**Recommendation** *(analysis, for the supervisor and the owner)*: ship the full table and the patterns, and raise the budgets the table
passes by its measured size, recorded as data (as the numbers table is), not as headroom. Even the long-names-only variant (9.5 KB with
the patterns) does not fit `composition`'s headroom, so trimming does not avoid the raise; it only makes `MMM` and `EEE` English. With nothing
cut (owner, 2026-11-25), the raise is the path; the owner sees the size and the before and after pictures before the item merges.

### Drawing changes

This part changes what existing decks draw: a deck that declares a language other than English and uses `MMMM`, `MMM`, `EEEE` or `EEE` in a
date variable's format or a footer date, or a date variable with no `format`, now prints that language's names and order. That is the
point of the part, but it is a declared drawing change: the changelog fragment carries `drawing`, the goldens move, and the owner sees the
before and after pictures of the affected gallery examples before it merges. The builder lists the affected examples first. *(The owner's
rule: a drawing change needs his yes on pictures.)*

## PowerPoint export and import

Content variables do not round-trip through PowerPoint today, so there is nothing to store for translations (supervisor, measured on
2026-11-25: a deck with a text, a list and a color variable, exported with a 0.37 build and imported with the 0.37 build and with the
released 0.36.0 importer alike, comes back with the resolved text, and its `variables` hold only the color variable; the document record
stores the variables that remain after resolution, which are colors).

- Variables resolve before export, so each slide's text is in that slide's language: the selected translation and the localized date.
  No new native part, no new record key.
- Import returns that text as literals, as it does today. The docs say so: a template's translations live in the OPF file, not in its
  PowerPoint export.
- **Native check**: a two-language deck (German and French slides) with a translated call to action, a translated date format and a footer
  date exports; PowerPoint shows each slide in its own language; the released 0.36.0 importer and the 0.37 importer both return a valid
  deck with the resolved text.

## Editor

- The variable panel shows a variable's translations as rows (language, value) with **Add translation**, offering the languages the deck
  and its slides declare first.
- The canvas draws each slide in its language, so a German slide shows the German value while it is edited.
- A date variable's format field offers the language's default pattern as a placeholder.

## Markdown and YAML

`translations` rides as a nested property of the variable in the front matter. The round-trip test covers a text, a list and a date
variable with translations.

## Docs, skills, examples

- `docs/variables.md`: "Translations" (the lookup order, the declared-language rule, `opf fill`'s rule) and "Dates in other languages" (the
  tokens, format and stand-alone forms, the default pattern, the languages without data).
- The author skill: one bilingual template.
- One example deck in two languages (the burndown's).

## Examples

Valid (two languages):

```json
{
  "name": "Bilingual event",
  "language": "de",
  "template": false,
  "variables": {
    "cta": { "type": "text", "value": "Book a demo",
             "translations": { "de": { "value": "Demo buchen" }, "fr": { "value": "Réserver une démo" } } },
    "event-date": { "type": "date", "value": "2026-03-05",
                    "translations": { "fr": { "format": "EEEE d MMMM yyyy" } } }
  },
  "slides": [
    { "title": "Am {{event-date}} in Berlin", "text": "{{cta}}" },
    { "language": "fr", "title": "Le {{event-date}} à Paris", "text": "{{cta}}" }
  ]
}
```

Drawn: "Am 5. März 2026 in Berlin" and "Demo buchen"; "Le jeudi 5 mars 2026 à Paris" and "Réserver une démo".

Invalid (schema: a key that is not a language tag):

```json
{ "variables": { "cta": { "type": "text", "value": "Book a demo", "translations": { "German": { "value": "Demo buchen" } } } },
  "slides": [ { "title": "{{cta}}" } ] }
```

Invalid (schema: `translations` on a number variable):

```json
{ "variables": { "growth": { "type": "number", "value": 0.12, "translations": { "de": { "value": 0.12 } } } },
  "slides": [ { "title": "{{growth}}" } ] }
```

Conformance: the valid deck above; the two invalid decks.

## Edge cases

| Case | Answer |
| --- | --- |
| A slide in `de-CH`, translations for `de` only | `de` is drawn. |
| A deck with no declared language, slides with none | `value`; English date names, today's default pattern. |
| A slide declares `en-GB` in an `en-US` deck | British date order by default ("5 March 2026"); `value` (no `en-GB` translation). |
| A rich-text translation | Drawn as rich text, as a rich `value` is. |
| A translation for a language no slide uses | Kept; `variable-translation-unused` warns. |
| `yy` and `yyyy` | Unchanged (digits from the numerals table). |
| A month token in a language without data (`ay`) | English names; the docs list these languages. |
| A pattern with a literal word (`"'Woche' w"`) | Literals print as written; `w` is not a token. |
| A footer date and a date variable on one slide | Both in the slide's language. |
| Speaker notes in a slide's language | Notes draw the same selection as the slide. |
| A translation that is longer than `maxLength` | `opf/variable-overflow` at the translation's path. |

## Decisions the card leaves open, with the option taken

| Question | Option taken | Why |
| --- | --- | --- |
| Which kinds take translations *(analysis)* | text, list, url, image; date takes `format` | The kinds whose output changes with the language. |
| A read language selecting a translation *(analysis)* | No, declared languages only | The reading is made from the text being replaced. |
| `opf fill` and stale translations *(analysis)* | A new `value` without translations removes them | A filled deck must not mix a new value with old translations. |
| Format and stand-alone month forms *(analysis)* | Format form with a day token, stand-alone without | Correct grammar in 23 languages. |
| The default pattern *(analysis)* | The language's long date pattern; US English unchanged | A German name in English order is wrong. |
| Table encoding *(analysis)* | Joined strings per list | Smaller after compression. |
| The budget *(analysis, for the supervisor and the owner)* | Raise by the table's measured size (no cut: owner, 2026-11-25) | Trimming does not avoid the raise. |
| Storage in PowerPoint | Nothing stored: content variables do not round-trip; the export holds each slide's resolved text (supervisor, 2026-11-25) | Measured with both importers. |

## Two lessons from the earlier 0.37 builds (supervisor, 2026-11-25)

- **The editor's keyboard browser suites pin completion counts by key name.** A new or renamed key changes how many completions the
  source editor offers at the pinned positions, so those suites fail until their counts are updated. Run them before the pull request
  opens, not after the first red check.
- **The breaking-change gate needs every removed schema path named.** A `type: changed` fragment must name each schema path the change
  removes, in the gate's form (for example `opf.schema.json:$defs.DataSourceRef`); a renamed key is a removed path and an added one.
