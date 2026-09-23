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

- **pptx.gallery is the canonical publisher.** Catalog content changes land in
  the pptx-gallery repository first.
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
rewrites only the files whose content changed. `--url https://www.pptx.gallery`
reads the live site instead of a checkout, for inspection.

To bundle more of a subset kind, reconcile it in the gallery first, then change
its `mode` to `mirror` in the manifest and re-run the sync.

### Checks

- `pnpm check:spec` and `pnpm check:catalog` (both in `pnpm test`) verify offline
  that every kind's records still hash to the value in its index and the
  manifest. A hand edit to `spec/catalogs/` fails here. Change the gallery and
  sync instead.
- The **Default catalog snapshot** job in `.github/workflows/opf-ci.yml` checks
  out pptx-gallery at the manifest's pinned commit and runs
  `sync-gallery-catalog.mjs --check`. It compares against the gallery's committed
  published files, not the live site. The gallery repository is private, so the
  job needs a `PPTX_GALLERY_READ_TOKEN` secret with read access. Without it the
  job reports a warning and skips the comparison; the offline hash check still
  runs.

## Reconciliation status

The per-kind divergence between the gallery and this snapshot, and the plan for
the subset kinds, is in
[`programs/font-fidelity-everywhere/ff-37-catalog-divergence.md`](programs/font-fidelity-everywhere/ff-37-catalog-divergence.md).
