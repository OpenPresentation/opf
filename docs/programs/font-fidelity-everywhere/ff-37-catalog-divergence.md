# FF-37: catalog divergence and reconciliation plan

The owner directive for FF-37 is that pptx.gallery becomes a first-class
catalog. The contract is in [`docs/default-catalog.md`](../../default-catalog.md).
This page records how far the gallery data and the bundled core catalogs had
drifted, what FF-37 reconciled, and what remains.

Baseline: OPF core `53be042`, plus the FF-18 language fields from `3ba21ff`,
and pptx-gallery `f17e9ae`. FF-22 (#121) and FF-28 (#123) landed on core while
FF-37 was in review; the snapshot in this PR includes them. The counts below
are from before those two PRs.

The gallery side was compared after projecting each gallery item onto its OPF
record schema, meaning OPF fields only, with gallery presentation fields set
aside. "Both, different" counts overlapping ids whose OPF fields differ. In
that column, `+gallery` means only the gallery sets the field, `+core` means
only core sets it, and `≠` means both set it with different values.

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
| audiences | 10 | 14 | 2 | 8 | 12 | 2 (`board`, `all-hands`: ≠ summary, description, recommendedNarratives; `all-hands` ≠ name) | FF-28 bundled the 12 gallery ids; the gallery publishes all 22 core records | subset (22 of 22) |
| narratives | 39 | 10 | 1 | 38 | 9 | 1 (`problem-solution`: ≠ name, summary, audienceFit, tags, beats) | FF-28 bundled the 9 gallery ids; the gallery publishes all 48 core records | subset (48 of 48) |
| chart-types | 76 | 76 | 75 | 1 (`united-kingdom`) | 1 (misspelled `united-kingdom` duplicate) | 75 (+core `mappings`; +gallery `description`, `preview`) | FF-22 records (26 current, 50 deprecated) published verbatim | subset (76 of 76) |
| layouts | 30 | 485 | 30 | 0 | 455 | 30 (+gallery structural fields and preview; 15 ≠ `name`) | follow-up | subset (30 of 485) |

Snapshot changes in this PR are additive and change no OPF semantics:

- 14 color schemes gain `summary`, `description` and `tags`.
- 89 font schemes gain `description`.
- The `font-schemes` and `themes` indexes take the gallery's canonical order.
- Every index gains `kind` and `contentSha256`.
- The serializer reformats the narratives index.

No record id was added or removed, and `check:breaking` reports 0 against
`opf-v0.11.0`.

## How pending kinds are published

For a pending kind, the gallery publishes the core records verbatim from
`data/opf-pending/<kind>.json`, including the core index description and
entries, and then its gallery-only records. It does not publish its own
conflicting projection. That keeps every bundled id resolving to the same
content online and offline.

- Gallery-only records appear only in the published catalog, not in the
  snapshot, until the kind is reconciled and switched to `mirror`.
- Their counts are recorded in the manifest.
- After FF-22 and FF-28, only `layouts` still has gallery-only records (455).
- Audiences, narratives and chart types stay pending because the gallery pages
  still render their own conflicting presentation data. The bundled and
  published records already agree.

Not published at all:

- the four `legacyItems` font pairings (`classic-editorial`,
  `modern-professional`, `bold-impact`, `warm-storytelling`). They have no OPF
  id and an `app` value the schema rejects.
- the gallery chart whose slug misspells `united-kingdom` (it drops the `g`).

## Plan per pending kind

### audiences

- **Reconcile the gallery data.** FF-28 folded gallery-only fields into core
  descriptions.
  1. Make `data/audiences.json` carry the 22 core records, with gallery
     presentation fields beside them.
  2. Drop `data/opf-pending/audiences.json`.
  3. Switch the kind to `mirror`.
- **Deprecated aliases (review item 1).** FF-37 generalises FF-22's chart-type
  `deprecation` object (`replacedBy`, `reason`, `removal`) to every record
  schema. It adds the `deprecated`/`replacedBy` index flags, `check:spec`
  rule (h), a validator warning (including for inline records) and the
  `opf/deprecated-catalog-id` lint rule. The data change keeps the gallery ids
  canonical:

  | Deprecated core id | `deprecation.replacedBy` |
  | --- | --- |
  | `executives` | `executive` |
  | `investors` | `investor` |
  | `customers` | `customer` |
  | `sales-team` | `sales` |
  | `marketing-team` | `marketing` |
  | `regulators` | `regulatory` |

  `candidates`, `engineering-team`, `board` and `all-hands` stay canonical.
  - **Not applied in this PR.** 81 bundled examples (111 references) and
    `spec/reference/engine-defaults.json` (`audience: "executives"`) use the
    plural ids. Deprecating them would add validator warnings to the example
    corpus, which the example tests reject.
  - The follow-up changes three things together:
    1. Move the examples and the engine default to the singular ids.
    2. Add the six `deprecation` objects, through the gallery data and a sync.
    3. Regenerate the example suite.
- **`board` and `all-hands` conflicts.** Take the gallery wording for
  `summary` and `description`. Keep the union of `recommendedNarratives`. Keep
  the core `name` for `all-hands`, since pickers show names and nothing
  resolves by name.

### narratives

- **Reconcile the gallery data.** Same steps as audiences. The gallery pages
  need records for the 38 core-only narratives.
- **Layout hints (review item 2).** The schema says hints resolve against the
  pptx.gallery layouts catalog, but `check:spec` rule (e) only accepts bundled
  layout ids. Once `layouts` is `mirror`, rule (e) accepts gallery layout ids.
  At that point, restore the gallery hints using FF-28's per-beat table
  (`scripts/gallery-catalog/gallery-layout-map.json`).
- **`audienceFit` ids (review item 3).** Before FF-28, core narratives used 49
  distinct `audienceFit` values, and only 6 were audience ids (`board`,
  `executives`, `investors`, `customers`, `candidates`, `all-hands`). The
  gallery used 31 human labels, none of them ids. FF-28 turned its 9 imported
  narratives' labels into kebab slugs, but slugs are not audience ids. Plan:
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

### chart-types

- FF-22 is in core. The gallery half (pptx-gallery #40) is open, and the
  gallery pages still list the pre-FF-22 set.
- When #40 lands, the gallery chart data needs the core `mappings` and
  `deprecation` objects, so the kind can publish projections instead of
  vendored records. Then switch to `mirror`.
- The misspelled gallery slug redirects to `united-kingdom` through #40's
  `chart-redirects.json`.

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
- **Any change to `spec/catalogs/`.** After FF-37 merges, catalog content
  changes go to the gallery first:
  - edit the gallery data, or for a pending kind, edit core and run
    `--refresh-pending`;
  - then run `sync-gallery-catalog.mjs`.

  A hand edit fails `check:spec` rule (g). FF-28's
  `scripts/gallery-catalog/sync-gallery-catalogs.mjs` stays as the record of
  how it derived its records.
- **Merge order.**
  1. Merge the gallery PR first.
  2. Re-pin the core manifest to the gallery merge commit with a re-sync.
  3. Merge core.
