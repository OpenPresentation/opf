# FF-37: catalog divergence and reconciliation plan

The owner directive for FF-37 is that pptx.gallery becomes a first-class
catalog. The contract is in [`docs/default-catalog.md`](../../default-catalog.md).
This page records how far the gallery data and the bundled core catalogs had
drifted, what FF-37 reconciled, and what remains.

Baseline: OPF core `53be042` with FF-18 language fields from `3ba21ff`, and
pptx-gallery `f17e9ae`. The gallery side was compared after projecting each
gallery item onto its OPF record schema, meaning OPF fields only, with gallery
presentation fields set aside. "Both, different" counts overlapping ids whose
OPF fields differ. In that column, `+gallery` means only the gallery sets the
field, `+core` means only core sets it, and `≠` means both set it with
different values.

## Summary

| Kind | Core | Gallery | Both | Only core | Only gallery | Both, different | FF-37 result | Snapshot mode |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| tones | 7 | 7 | 7 | 0 | 0 | 0 | identical | mirror |
| languages | 93 | 93 | 93 | 0 | 0 | 0; FF-18 fields were core-only | FF-18 `ooxmlLang`/`script`/`direction` copied into gallery data | mirror |
| social-platforms | 10 | 10 | 10 | 0 | 0 | 1 (`mastodon` description ≠: gallery mojibake) | gallery text fixed | mirror |
| themes | 4 | 4 | 4 | 0 | 0 | 4 (`background` ≠: gallery slot string vs OPF object) | gallery projects `background` to `{type:"theme",slot}` | mirror |
| color-schemes | 14 | 14 | 14 | 0 | 0 | 14 (+gallery `summary`, `description`, `tags`) | core gains gallery text | mirror |
| font-schemes | 89 | 89 (+4 legacy) | 89 | 0 | 4 legacy pairings | 89 (+gallery `description`); 2 (+core `code`) | core gains descriptions; gallery gains FF-17 `code` | mirror |
| purposes | 9 | 0 | 0 | 9 | 0 | – | 9 records moved into gallery `data/purposes.json` | mirror |
| audiences | 10 | 14 | 2 | 8 | 12 | 2 (`board`, `all-hands`: ≠ summary, description, recommendedNarratives; `all-hands` ≠ name) | pending (FF-28) | subset (10 of 22) |
| narratives | 39 | 10 | 1 | 38 | 9 | 1 (`problem-solution`: ≠ name, summary, audienceFit, tags, beats) | pending (FF-28) | subset (39 of 48) |
| chart-types | 76 | 76 | 75 | 1 (`united-kingdom`) | 1 (misspelled `united-kingdom` duplicate) | 75 (+core `mappings`; +gallery `description`, `preview`) | pending (FF-22) | subset (76 of 76) |
| layouts | 30 | 485 | 30 | 0 | 455 | 30 (+gallery structural fields and preview; 15 ≠ `name`) | pending (follow-up) | subset (30 of 485) |

Snapshot changes in this PR are additive and change no OPF semantics:

- 14 color schemes gain `summary`, `description` and `tags`.
- 89 font schemes gain `description`.
- The `font-schemes` and `themes` indexes take the gallery's canonical order.
- Every index gains `kind` and `contentSha256`.

No record id was added or removed, and `check:breaking` reports 0 against
`opf-v0.11.0`.

## How pending kinds are published

For a pending kind the gallery publishes the core records verbatim from
`data/opf-pending/<kind>.json`, then its gallery-only records. It does not
publish its own conflicting projection. That keeps every bundled id resolving
to the same content online and offline. Gallery-only records appear only in the
published catalog, not in the snapshot, until the kind is reconciled and
switched to `mirror`. Their counts are recorded in the manifest.

Not published at all:

- the four `legacyItems` font pairings (`classic-editorial`,
  `modern-professional`, `bold-impact`, `warm-storytelling`). They have no OPF
  id and an `app` value the schema rejects.
- the gallery chart whose slug misspells `united-kingdom` (it drops the `g`).

## Plan per pending kind

### audiences (FF-28, then FF-37 alias data)

- **FF-28 (#123)** adds the 12 gallery audiences to core. After it merges:
  1. Run `node scripts/build-opf-catalog.mjs --refresh-pending <opf>` in the
     gallery, so all 22 records publish verbatim.
  2. Run `sync-gallery-catalog.mjs --gallery` here. Nothing is gallery-only
     after that.
  3. Switch `audiences` to `mirror`.
- **Deprecated aliases (review item 1).** FF-37 ships the mechanism:
  `deprecatedBy` on every record schema and index entry, a validator warning, a
  `opf/deprecated-catalog-id` lint rule and `check:spec` rule (g). With the
  gallery ids canonical, the data change after FF-28 is six records:

  | Deprecated core id | `deprecatedBy` |
  | --- | --- |
  | `executives` | `executive` |
  | `investors` | `investor` |
  | `customers` | `customer` |
  | `sales-team` | `sales` |
  | `marketing-team` | `marketing` |
  | `regulators` | `regulatory` |

  `candidates`, `engineering-team`, `board` and `all-hands` stay canonical.
  - Add the field in the gallery's audience data once audiences are
    reconciled, or in the core records followed by `--refresh-pending` while
    the kind is still pending.
  - It cannot land before FF-28, because rule (g) requires the targets to be
    bundled.
- **`board` and `all-hands` conflicts.** Take the gallery wording for
  `summary` and `description`. Keep the union of `recommendedNarratives`. Keep
  the core `name` for `all-hands`, since pickers show names and nothing
  resolves by name.

### narratives (FF-28, then layout hints)

- **FF-28** adds the 9 gallery narratives with beat `layoutHint` values mapped
  to bundled layouts. The refresh-and-sync steps are the same as for
  audiences. The 38 core-only narratives move into the gallery at the same time.
  They are already published verbatim; the gallery pages still need records for
  them.
- **Layout hints (review item 2).** The schema says hints resolve against the
  pptx.gallery layouts catalog, but `check:spec` rule (e) only accepts bundled
  layout ids. Once `layouts` is `mirror`, rule (e) accepts gallery layout ids.
  At that point, restore the gallery hints by reversing FF-28's mapping table
  (`title-center`, `stats-metrics`, `data-visualization`, `thank-you-cta` and so
  on).
- **`audienceFit` ids (review item 3).** Core narratives use 49 distinct
  `audienceFit` values, and only 6 are audience ids (`board`, `executives`,
  `investors`, `customers`, `candidates`, `all-hands`). The gallery uses 31
  human labels, none of them ids. Plan:
  1. Map every value to a canonical audience id. `stakeholders` becomes
     `executive`, `prospects` and `buyers` become `customer`, `press` becomes
     `media`, `students` becomes `academic`, and so on.
  2. Move labels with no audience equivalent into `tags`.
  3. Add `audienceFit` to the validator's catalog cross-link fields so unknown
     values warn.
- **`problem-solution` (review item 4).** Core has 7 beats: `hook`, `problem`,
  `stakes`, `solution`, `mechanism`, `evidence`, `ask`. The gallery has 6 and
  replaces `mechanism` and `evidence` with `benefits`.
  - Inline narrative overrides merge by beat id, so removing `mechanism` or
    `evidence` would break documents that override them.
  - Proposal: keep the 7 core beat ids as canonical and fold the gallery's
    `benefits` guidance into `evidence`. Keep the core name "Problem →
    Solution" and the gallery `description`. The gallery page then renders 7
    beats.
  - This is an owner decision because it changes a gallery page.

### chart-types (FF-22)

FF-22 (#121 core, gallery #40) reduces the catalog to Aspose.Slides-supported
types in both repos.

- When it lands, the gallery chart data needs the core `mappings`, so the kind
  can publish projections instead of vendored records.
- The misspelled gallery slug redirects to `united-kingdom` (FF-22's
  `chart-redirects.json`).
- After that, switch to `mirror`.
- Until then, FF-22 must refresh `data/opf-pending/chart-types.json` in the
  gallery and re-sync here, or `check:spec` rejects the hand-edited snapshot.

### layouts (follow-up, largest)

- **Current state.** Core bundles 30 structural layouts; the gallery publishes
  485. All 30 overlap.
  - For those 30, the gallery sets all 16 layout classification fields
    (`contentType`, `contentMultiple`, `slideTitle` …) plus `summary`,
    `description`, `tags` and `preview`. Core records carry only `id`, `name`,
    `placeholders` and `composition`.
  - 15 overlapping names differ (`Chart_1x` vs `Chart 1x`).
- **Gallery-only layouts.** 455 layouts: 190 List, 105 Image, 75 Text, 39
  Chart, 38 Metric, 24 Title, 5 Timeline, 4 Table, 3 Quote, 1 Code, 1 Video. The
  counts cover all 485 gallery layouts.
- **Risk.** Bundling classification fields or 455 extra layouts changes what
  composition and pagination can select. It needs renderer and exporter
  measurement, not only catalog work.
- **Proposal.**
  1. Reconcile names and add the classification fields to the 30 core layouts
     in the gallery data, with a renderer golden check.
  2. Decide which gallery layouts are bundled. Either bundle all of them, or
     bundle a curated subset and make `subset` permanent for layouts.
  3. Switch to `mirror` or keep `subset` accordingly, then restore narrative
     layout hints.

## Coordination notes

- **FF-18.** The language record fields are now also gallery data; the
  languages kind mirrors them.
- **FF-22, FF-28 and any change to `spec/catalogs/`.** After FF-37 merges,
  catalog content changes go to the gallery first. Then run
  `sync-gallery-catalog.mjs`. A hand edit fails `check:spec` rule (f).
- **Merge order.**
  1. Merge the gallery PR first.
  2. Re-pin the core manifest to the gallery merge commit with a re-sync.
  3. Merge core.
