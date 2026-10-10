# Stats

`stats(presentation, options?)` and `opf stats <file|->` report neutral facts about a deck: what is in it and how much. Counts and lists only. There are no severities, no judgments and no thresholds, so nothing here says a deck is too long, too dense or missing something; `opf validate` says what is wrong, and a reviewer decides what is good.

```js
import { stats } from '@openpresentation/opf';

const facts = stats(deck);
facts.slides.total;                 // 12
facts.words.content;                // 842 words on the slides
facts.notes.withoutNotes;           // [{ index: 3, id: 'pricing' }, ...]
facts.images.content.missingAlt;    // 2
facts.speakingTime;                 // { basis: 'estimate', wordsPerMinute: 130, notesWords: 410, minutes: 3.2, declaredMinutes: 20 }
stats(deck, { perSlide: true }).perSlide;   // one row per slide
```

```sh
opf stats deck.opf.json                      # JSON: the report { command, ok, input, ..., stats } (CLI 0.18; the facts alone before)
opf stats deck.opf.json --format text        # one readable block per topic
opf stats - --per-slide < deck.opf.json      # adds a row per slide
```

## What it does and does not do

- **Structural only.** It walks the JSON. It does not compose slides, build layouts, measure text or need fonts, and it does not validate: a deck that fails `opf validate` still has facts, and an unknown id is reported as written. It reads what is there and never throws on a malformed deck (it throws only for an argument that is not an object).
- **Cheap.** Measured on the 126 bundled example decks, warm, with the per-slide breakdown: 18 ms for all of them (0.14 ms mean), against 46 ms for `validate(deck, { only: ['format'] })`, 290 ms for `only: ['format', 'references']` and 1.1 s for a full `validate` over the same decks (one machine; the ratios hold). Template variables are read with `listVariables`; nothing else loads a catalog except the theme and font-scheme records that name a size and families.
- **Deterministic.** The same deck gives the same output with the same key order: objects are built in a fixed order, and every count map and id list is sorted (slide lists keep deck order). Nothing reads a clock, a locale or the runtime's Unicode word-break data.
- **Pure.** The input is not changed.

`stats(presentation, { perSlide?, values?, wordsPerMinute? })`: `perSlide` adds `perSlide`, `values` is a variables map to count as filled (as for `resolveVariables`), `wordsPerMinute` sets the speaking pace of the estimate (default 130). The root also exports the result types (`PresentationStats`, `SlideStats`, ...).

## The report

| Section | Facts |
| --- | --- |
| `deck` | `name`, `description` (is there one), `filename`, `author`, `language`, `slideSize` (`preset`, `widthInches`, `heightInches`, `aspectRatio`, and `source`: the deck's `design.dimensions`, its theme, or the default), `template`, `tags`, `takeaways` (how many), `declaredMinutes`, `design` (`theme`, `colorScheme`, `fontScheme`), `audience`, `purpose`, `tone`, `narrative` (with its `beats` count). A reference is `{ id, inline }`: the string as written (a catalog id, URL, `pkg:` reference or free text) or an inline record's `id`, with `inline: true` for the object form. |
| `people` | `organizations` (`id`, `name`, `role`, `hasLogo`) and `speakers` (`id`, `name`, `title`, `organizationId`, `hasPhoto`). |
| `slides` | `total`; `hidden` (`[{ index, id }]`, where `index` is the zero-based position, the same as `/slides/<index>`); `withTitle`, `withoutTitle`; `withBeat`; `sections` (consecutive slides with the same `section` label: `name`, `slides`, `firstSlide`) and `unsectioned`; `layouts` (slides per layout id) and `withoutLayout` (layout left to inference); `withOwnDesign` (slides whose `design` overrides the deck). |
| `payloads` | Content payloads by kind across slide roots, blocks and promoted regions: `text`, `items`, `bullets`, `quote`, `metric`, `code`, `timeline`, `chart`, `table`, `image`, `video`; plus `blocks` (block entries at any depth), `regions` (promoted regions such as `left` or `top:center`), `groups` (blocks and regions that hold nested `blocks`) and `maxDepth` (deepest block nesting). |
| `words` | `content`, `notes`, `total`, and `perSlide` (`min`, `max`, `mean` of content words). |
| `notes` | `withNotes` and `withoutNotes` (`[{ index, id }]`). A note of only whitespace is no note. |
| `speakingTime` | `basis: 'estimate'`, `wordsPerMinute`, `notesWords`, `minutes` (notes words divided by the pace, to a tenth), `declaredMinutes` (the deck's own `duration`). |
| `images` | `content` (`total`, `withAlt`, `decorative`, `missingAlt`), `logos`, `watermarks` (`deck`, `slides`), `backgrounds` (`deck`, `slides`), `headerFooter`, `speakerPhotos`, `videos`. |
| `charts` | `total`, `byType`, and `data`: how many take `inline` data, a `dataset` reference or an external `source`. |
| `tables` | `total`, `datasetBacked`, total `rows` and `columns`, and `items` (`slide`, `path`, `rows`, `columns`, `dataset`). |
| `datasets` | `count`, `withSource`, and `items` (`id`, `title`, `columns`, `rows`, `source`: the declared `source.src` or null, `referencedBy`: charts and tables that use it). |
| `citations` | `references`, `cited` (reference ids some run cites), `citations` (cited runs), `footnotes`, `captions`, `links`. |
| `variables` | `declared`, `byKind`, `required`, `optional`, `filled`, `unfilled`, `unfilledRequired`, `unused` (declared, never referenced). |
| `assets` | `registry` (`entries`, `embedded`, `files`, `remote`), `uses` (every asset-bearing field: `total`, `references`, `embedded`, `files`, `remote`) and `embeddedBytes`. |
| `headerFooter` | `header` and `footer` at deck level (`configured`, `suppressed`, `zones`, `fields`) and `slides` (`headerOverrides`, `headerSuppressed`, `footerOverrides`, `footerSuppressed`). |
| `fonts` | `families` (every family named), `schemeIds` (font schemes in effect), `unresolvedSchemeIds`, `runOverrides` (families set on text runs). |
| `colors` | `variables`: each colour variable with its `value` and number of `uses`. |
| `extensions`, `catalogs` | The keys under `extensions` anywhere; each catalog group the deck embeds records in, with its `source` and its record count per kind. |
| `perSlide` | With `perSlide: true`: per slide `index`, `id`, `title`, `layout`, `section`, `hidden`, `payloads` (kinds present), `words` (`content`, `notes`), `hasNotes`, `speakingSeconds`, `images`, `charts`, `tables`, `citations`. |

## Definitions

- **Words.** Letters and digits in a run, with an internal apostrophe, hyphen, comma or period joining parts (`don't`, `well-known`, `3.5`, `$4.2M` is one word). Thai, Lao, Myanmar, Khmer, kana and Han text, which has no spaces between words, counts one unit per character: a fixed rule, so a count never depends on the runtime's Unicode data. **Content words** are the visible text on slides: `title`, `subtitle`, `tag`, text, items (and their descriptions), bullets, quote text, attribution and source, metric fields, timeline fields, table headers and cells (a number is one word), and captions. Code, chart data, header and footer text and reference texts are not counted. A dataset-backed table has no cells of its own. Variable tokens (`{{name}}`) are counted as written. **Notes words** are the words of `notes`.
- **Speaking time** is `notesWords / wordsPerMinute`. It is an estimate of reading the notes aloud at a steady pace, labelled as one in the report. The deck's own `duration` is reported next to it, not compared to it.
- **Images.** `content` counts image payloads (slide root, blocks, regions, placed or not). Alt text follows the `asset:` references to the registry. An alt text that is empty (`alt: ""`) is *decorative*, the explicit choice `opf validate` accepts; no alt, or only whitespace, is *missing*. Logos, watermarks and image backgrounds are decorative or brand assets by nature and are counted separately, not as content images.
- **Assets.** A source starting `asset:` is a registry reference, `data:` is embedded, `http(s):` (and `pkg:`) is remote, anything else is a file (a relative path resolved against the OPF file, or a local path). `embeddedBytes` is the decoded size of `data:` URIs (exact for base64). A chart that takes its data from an external source counts that source as a use; a `source` on inline data or a dataset is provenance, never read, and is not a use.
- **Fonts.** Families come from the font schemes in effect (the deck's, and a slide's own scheme or theme), inline scheme records, and `fontFamily` on runs, resolved the way every engine resolves them. A scheme that names no `code` role does not add a code family.

## What stats leaves out

Everything in the schema that is presentation detail rather than a countable or present fact is left out; the deck itself has it: text run formatting (bold, colour, size), list numbering styles, chart styling (axis titles, legend, data labels, series mapping), table cell styles and spans, `composition` hints, design preferences such as alignment, `contentBox`, `contentDirection`, `chartPrimary`, `imageFit`, `listBullet`, image treatments and placement, solid and gradient backgrounds, the individual `Language`, `Tone` and `Audience` record fields, and the contents of `extensions`. Findings (alt text that is missing, a missing title, text that overflows) belong to `opf validate`, which reports them with severities; `stats` only counts the underlying things.
