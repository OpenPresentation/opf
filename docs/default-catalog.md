# The default catalog

Every OPF catalog reference resolves through the same chain: inline
`catalogs.<kind>.records[]`, then `catalogs.<kind>.source`, then engine defaults,
then the **default catalog** at `https://www.pptx.gallery/<kind>`. The
referencing fields are `narrative`, `language`, `tone`, `audience`, `purpose`,
`design.theme`, `design.colorScheme`, `design.fontScheme`, `Slide.layout`,
`Chart.type` and the platform keys in `socials`.

This page defines who publishes that catalog, how to fetch it, and how the copy
bundled in `@openpresentation/opf` stays tied to it.

## Contract

- **pptx.gallery publishes the catalog; core is the source of truth for its
  content.** Since the FF-37 decision (2026-10-02) a record can change here first:
  the gallery's CI checks its published files against the `@openpresentation/opf`
  release in its lockfile (`pnpm check:core-catalog`) and adopts the change with
  the next core release. A change that begins in the gallery still lands through
  the sync below.
- **`spec/catalogs/` is a pinned snapshot.** `spec/catalogs/manifest.json`
  records the gallery commit and a content hash per kind.
- **Engines never fetch at run time by default.** Renderers, exporters,
  validators and the CLI resolve the default catalog from the bundled snapshot,
  so resolution is deterministic offline and in the cloud.
- **A declared `catalogs.<kind>.source` is an opt-in.** The engine's caller
  performs that fetch; the OPF packages do not.

## Endpoints

| Request | Response |
| --- | --- |
| `GET https://www.pptx.gallery/<kind>/index.json` | Catalog index |
| `GET https://www.pptx.gallery/<kind>` with `Accept: application/json` | Same catalog index |
| `GET https://www.pptx.gallery/<kind>/<id>.json` | One record |
| `GET https://www.pptx.gallery/<kind>/<id>` with `Accept: application/json` | Same record |
| Either URL from a browser | The gallery's HTML page |

`/<kind>/index.json` is the stable explicit alias. It is the index-file form that
the `CatalogSource` contract already defines, so both
`"source": "https://www.pptx.gallery/tones"` (directory form, records at
`<base>/<id>.json`) and `"source": "https://www.pptx.gallery/tones/index.json"`
(index form) address the published catalog. Catalog files are served with
`Access-Control-Allow-Origin: *`, and negotiated URLs send `Vary: Accept`.

The older `https://www.pptx.gallery/api/<dimension>.json` envelopes carry the
gallery's presentation data in the gallery's own shape. They stay
backward compatible, but they are not OPF records. Each one now links its
catalog index with `Link: <…/<kind>/index.json>; rel="alternate"`.

## Kinds and URL mapping

The URL segment is the one each `Catalogs` property names as its default source
in `spec/schemas/opf.schema.json`. It is also the `spec/catalogs/<kind>`
directory name.

| `<kind>` | `catalogs.<key>` | Record schema | Referenced from | Gallery page | Snapshot mode |
| --- | --- | --- | --- | --- | --- |
| `audiences` | `audiences` | `opf-audience/v1` | `audience` | `/audiences` | subset |
| `chart-types` | `chartTypes` | `opf-chart-type/v1` | `Chart.type` | `/charts` | subset |
| `color-schemes` | `colorSchemes` | `opf-color-scheme/v1` | `design.colorScheme` | `/colors` | mirror |
| `font-schemes` | `fontSchemes` | `opf-font-scheme/v1` | `design.fontScheme` | `/font-schemes` | mirror |
| `languages` | `languages` | `opf-language/v1` | `language` | `/languages` | mirror |
| `layouts` | `layouts` | `opf-layout/v1` | `Slide.layout` | `/layouts` | subset |
| `narratives` | `narratives` | `opf-narrative/v1` | `narrative` | `/narratives` | subset |
| `purposes` | `purposes` | `opf-purpose/v1` | `purpose` | none yet | mirror |
| `social-platforms` | `socialPlatforms` | `opf-social-platform/v1` | `socials` keys | `/socials` | mirror |
| `themes` | `themes` | `opf-theme/v1` | `design.theme` | `/themes` | mirror |
| `tones` | `tones` | `opf-tone/v1` | `tone` | `/tones` | mirror |

Record schema ids are `https://openpresentation.org/schema/<name>`.

## Index and record shape

An index validates against `spec/schemas/catalog-index.schema.json`:

```json
{
  "$schema": "https://openpresentation.org/schema/opf-catalog-index/v1",
  "kind": "tones",
  "version": "1",
  "description": "…",
  "contentSha256": "b5a8d093…",
  "records": [{ "id": "formal", "name": "Formal", "summary": "…", "file": "formal.json" }]
}
```

- `records` is in canonical order. `file` is relative to the index.
- `version` is the index format version.
- `contentSha256` is the lowercase hex SHA-256 of the canonical JSON of the full
  records in index order, with every top-level `x-*` member removed. Canonical
  JSON sorts object keys and has no insignificant whitespace
  (`canonicalJson()` in `scripts/catalog-snapshot.mjs`). The bundled index and
  the published index carry the same value for a mirrored kind.

Each record validates against its kind's companion schema and names it in
`$schema`. Publishers may add top-level `x-*` extension members. pptx.gallery
puts its presentation metadata (page URL, mood tags, contrast notes, font stacks)
in `x-gallery`. Consumers ignore `x-*` members, and the snapshot never carries
them.

## Deprecated aliases

Any record may carry `deprecation: { "replacedBy": "<id>", "reason"?, "removal"? }`.
This is the chart-type mechanism from FF-22, now available on every kind.
Aliases use it too, for example an old plural audience id kept next to its
canonical singular id. The record stays for backward compatibility:

- the old id keeps resolving to its own record, unchanged;
- `validatePresentation` warns (`deprecated <kind> catalog id '<id>'; use '<replacedBy>'`);
- `lintPresentation` reports `opf/deprecated-catalog-id` and suggests the replacement;
- pickers and generators should offer only non-deprecated records. Index entries
  carry `"deprecated": true` and `replacedBy`, so a picker can hide the old id
  without loading records.

`check:spec` requires the replacement to be a bundled record of the same kind
that is not deprecated itself: rule (f) for chart types, rule (h) for every
other kind. Inline `catalogs.<kind>.records` may use the same field.

## The snapshot

`spec/catalogs/manifest.json` (schema `spec/schemas/catalog-manifest.schema.json`):

```json
{
  "publisher": "https://www.pptx.gallery",
  "source": { "repository": "https://github.com/Data-Advantage/pptx-gallery", "commit": "<sha>", "path": "public" },
  "kinds": {
    "tones": { "mode": "mirror", "records": 7, "contentSha256": "…", "gallery": { "records": 7, "contentSha256": "…" } }
  }
}
```

- **mirror**: the snapshot holds every published record of the kind.
- **subset**: the snapshot keeps the ids it already bundles, with content taken
  from the publisher, while the publisher also serves records that are not
  reconciled for bundling yet (for example the gallery's extra layouts).

The snapshot never loses an id. Removing a catalog record is a breaking change,
so the sync refuses a publisher that stopped serving a bundled id.

### Updating it

Either side can start a change. To start in core (a deprecation, a wording
fix), edit the records and index entries under `spec/catalogs/<kind>/`, then
rewrite the hashes and counts:

```sh
node scripts/sync-gallery-catalog.mjs --rehash   # index contentSha256, manifest records and contentSha256
```

`--rehash` leaves the manifest `source` and each kind's `gallery` block alone,
because they describe the pinned gallery commit, and it does not touch `mode`. A
mirrored kind must also match the gallery hash, so a core-first change to a mirror
kind needs the gallery to publish it first, or the kind to move to `subset`; when the gallery change that
publishes the same records is already in review, `--rehash --match-gallery` also sets that kind's `gallery`
block to the new hash. The
gallery adopts a core-first change with the next `@openpresentation/opf` release
(its `check:core-catalog` reads that release).

To start in the gallery:

```sh
# in the pptx-gallery checkout: edit data/, then
pnpm build:opf-catalog            # regenerate and validate public/<kind>/
git commit                        # the snapshot pins a commit

# in this repository
node scripts/sync-gallery-catalog.mjs --gallery ../pptx-gallery          # writes spec/catalogs + manifest
node scripts/sync-gallery-catalog.mjs --gallery ../pptx-gallery --report # per-kind counts and gallery-only ids
```

The sync validates every published index and record against the schemas in
`spec/schemas/`, checks the published `contentSha256`, drops `x-*` members, and
rewrites only the files whose content changed. Writes require a clean gallery
checkout so the manifest commit identifies the actual catalog bytes.
`--url https://www.pptx.gallery` reads the live site for inspection and requires
`--check` or `--report`; a live response cannot prove a source commit.
Dirty checkout inspection also stays read-only: `--allow-dirty` is accepted only
with `--check` or `--report` and cannot bypass the write guard.

To bundle more of a subset kind, reconcile it in the gallery first, then change
its `mode` to `mirror` in the manifest and re-run the sync. To bundle only some of
the published ids, pass them once with `--include <kind>:<id>[,<id>...]`
(repeatable); the snapshot keeps them from then on, like every bundled id, and
the sync reports an id the gallery does not publish. The layouts snapshot uses
this for the 70 legacy gallery slugs (FF-55): it holds 100 of the gallery's 485
layouts, and the rest stay gallery-only.

### Layouts stay a subset by design (RR-41, opf#292)

`layouts` is a permanent `subset`, decided on 2026-10-02 (vetoable by the owner).
The other 385 layouts (the Dark master; 24 of them deprecated aliases from FF-52)
are published only by pptx.gallery. A document names one of them and resolves it
online through the default catalog, or offline with an inline
`catalogs.layouts.records` entry, which the gallery snippets add and
`bundlePresentation` inlines for the 100 bundled ids. All 485 compose, validate
and export; this decision is about where the records live, not about the engines.

Measured on `@openpresentation/opf` 0.12.0 with all 485 layouts synced (`npm pack
--dry-run`, then minified esbuild browser bundles of the published `opf-render`
0.12.0 against each core build, and of the gallery editor playground at the
`opf-editor` 0.11.1 release commit):

| | 100 layouts (now) | 485 layouts | Change |
| --- | ---: | ---: | ---: |
| Packed tarball | 2,925,351 B | 2,979,596 B | +54,245 B (+1.9%) |
| Unpacked | 9,177,405 B | 10,327,874 B | +1,150,469 B (+12.5%) |
| Files | 645 | 1,030 | +385 |
| `opf-render` bundle (minified / gzip) | 1,186,297 / 307,353 B | 1,568,259 / 326,443 B | +381,962 / +19,090 B (+32% / +6.2%) |
| Gallery editor playground bundle (minified / gzip) | 3,656,803 / 1,207,310 B | 4,038,759 / 1,225,176 B | +381,956 / +17,866 B (+10.4% / +1.5%) |

The packed growth is small (gzip compresses the repetitive records). The bundle
growth is not: `opf-render`, `opf-editor` and `opf-pptx` never import
`@openpresentation/opf/catalogs` and never read a layout record from the bundled
catalog, but `composition`, `validator`, `pagination` and `convert` all reach the
one generated catalogs chunk, which a bundler cannot tree-shake, so every browser
bundle would carry about 382 KB more for data it does not use. The catalog is not
lazily loadable today. The supervisor rule was to bundle only when the packed
core grows by less than about 1.5 MB and the bundles do not meaningfully grow;
the second condition fails, so the subset is kept on purpose. Narrative layout
hints do not need the rest: the FF-28 beat table references 17 gallery layouts,
13 of them already bundled, and the other four (`text-1x-left`, `title-left`,
`title-center`, `list-2x-title-center`) can be added with `--include` if the
hints are restored.

To revisit: split the generated catalogs module per kind (or load it lazily) so a
consumer that does not read layouts does not carry them. After that, bundling all
485 costs about 54 KB of packed size and nothing in the browser bundles, and the
kind can be switched to `mirror` with a core release.

### Checks

- `pnpm check:spec` and `pnpm check:catalog` (both in `pnpm test`) verify offline
  that every kind's records still hash to the value in its index and the
  manifest. A hand edit to `spec/catalogs/` fails here until `--rehash` (core
  first) or the sync (gallery first) has rewritten them.
- Drift between the gallery and this snapshot is checked on the gallery side
  (FF-37): pptx-gallery's `pnpm check:core-catalog` compares its
  published `public/<kind>/` files with `spec/catalogs` of the
  `@openpresentation/opf` release it depends on, in its own CI. Core is the source
  of truth and the package is public, so no secret is needed. The core CI no longer
  reads the private gallery. `sync-gallery-catalog.mjs --check` still compares a
  local gallery checkout when you sync.

## Reconciliation status

The per-kind divergence between the gallery and this snapshot, and the plan for
the subset kinds, is in
[`programs/font-fidelity-everywhere/ff-37-catalog-divergence.md`](programs/font-fidelity-everywhere/ff-37-catalog-divergence.md).
