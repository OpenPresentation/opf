# Catalogs and the default catalog

OPF 0.15 keeps catalogs out of the engine. A document embeds every record it uses, hosts register the catalogs they
trust, and core ships no records in its main entry. pptx.gallery publishes the **default catalog**; core carries a
pinned snapshot of it only as the opt-in subpath `@openpresentation/opf/catalog`.

This page is the contract: the document shape, the one resolution rule, how hosts register catalogs, the authoring
helpers, the diagnostics, and how the snapshot stays tied to pptx.gallery. The design behind it is
[0.15-design.md](programs/format-audit/0.15-design.md).

## Catalogs in a document

`catalogs` groups the records a document embeds by the catalog they came from. Inside a group, records are keyed by
kind and then by id:

```json
"catalogs": {
  "default": {
    "source": "https://www.pptx.gallery",
    "layouts": { "two-column": { "name": "Two column", "placeholders": [{ "type": "title" }, { "type": "text" }, { "type": "text" }] } },
    "themes": { "minimal": { "name": "Minimal", "colorScheme": "cool-horizon", "fontScheme": "aptos" } }
  },
  "acme": { "source": "pkg:@acme/opf-catalog", "layouts": { "hero": { "name": "Hero", "placeholders": [{ "type": "title" }] } } },
  "custom": { "layouts": { "q4-special": { "name": "Q4 special", "placeholders": [{ "type": "title" }, { "type": "chart" }] } } }
}
```

- **`default`** is the catalog bare ids come from. It needs a `source` when it holds records. Omitted: bare ids fall
  back to the host's default catalog. `"default": false`: no catalog fallback at all, so every bare id must be embedded.
- **`custom`** holds the records the document defines itself. It has no source. Forking a catalog record copies it here
  under a new id, so the change of ownership is visible.
- **Any other name** (lowercase kebab-case) is an extra catalog, identified by its `source`: an HTTPS URL or a `pkg:`
  package reference. The name is the prefix its references use (`acme:hero`).
- The kinds are `layouts`, `themes`, `colorSchemes`, `fontSchemes`, `narratives`, `audiences`, `purposes` and `tones`.
- An embedded record has the fields of its kind's companion schema without `$schema` and `id` (the key is the id), and
  without the catalog's `x-*` display metadata. `validate` checks each one against the companion schema
  (`opf/catalog-record`).

## References

Every content reference is a bare `id` or `name:id`, and every prefix must name a group (`opf/undeclared-catalog`
otherwise, a format error that engines reject at their format check). URLs and `pkg:` strings are not references; a named group replaces them. The references are
`Slide.layout`, `design.theme`, `design.colorScheme` (or its `id`), `design.fontScheme` (or its `id`), the same three on
`Slide.design`, `narrative`, `audience`, `purpose` and `tone` (a string or an object's `id`), a theme record's
`colorScheme` and `fontScheme`, and a `language` object's `fontScheme` and `googleFontScheme`. An `audience` or
`purpose` string that is not an id (it has spaces, capitals or punctuation) is free text, never looked up.

## Resolution

One rule for every kind; nothing is ever fetched:

1. A bare id: `catalogs.custom`, then the records embedded under `catalogs.default`, then the catalog the host
   registered for `default.source` (the host's default catalog when `default` is omitted; nothing when it is `false`).
2. `name:id`: the records embedded under `catalogs.<name>`, then the catalog the host registered for its `source`.
3. A reference written inside an embedded record (a theme's `colorScheme`) resolves in that record's own group first,
   so acme's `brand` theme finds acme's `ocean` before the default catalog's.
4. Otherwise the reference is **unresolved**: the `opf/unresolved-reference` warning names the reference and the
   source it was looked for in, a slide composes automatically, and a design uses the engine default. A strict export
   fails with the same reference.

A record embedded under `catalogs.default` or a named group whose registered catalog has no record of that kind and id is the warning `opf/catalog-record-not-in-source`: it is the document's own record and belongs in `catalogs.custom`. The check is silent when no catalog is registered for the group's source, for a record the catalog has with other content (an update difference) and for `custom`; rendering is unchanged.

A slide with no `layout` is automatic composition, not a missing reference, and has no finding. Engines never
substitute a different layout for one that does not resolve.

## Registering catalogs

Every entry point that resolves references takes the same option, `catalogs`: the catalogs the host registered,
matched by `source`.

> **The host-default rule.** The first registered catalog is the default for documents that omit `catalogs.default`:
> their bare ids resolve in `custom`, then in that catalog. A document whose `default` names a `source` uses the
> registered catalog with that source, and nothing when the host did not register it, even if it registered others.
> `"default": false` uses no catalog for bare ids. Without the `catalogs` option nothing is registered: core has no
> fallback of its own, so only what the document embeds resolves. Hosts (the CLI, the editor app, the sites) register
> `@openpresentation/opf/catalog`; libraries and engines pass the option through.

```js
import { validate, resolveSlideContext, paginate, embed } from '@openpresentation/opf';
import { defaultCatalog } from '@openpresentation/opf/catalog';

const catalogs = [defaultCatalog, acmeCatalog]; // acmeCatalog = { source: 'pkg:@acme/opf-catalog', layouts: { hero: { … } } }
validate(document, { catalogs });
resolveSlideContext(document, 0, { catalogs, strictReferences: true }); // throws OPFUnresolvedReferenceError
paginate(document, { catalogs });
```

A registered catalog has the shape of a document group with `source` required: `{ source, layouts?: { <id>: record },
themes?, … }`. Records may keep their `x-*` display metadata there; embedding strips it. `resolveSlideContext`,
`paginate`, `validate`, `stats`, `resolveScriptFonts` (`/composition`), `resolveReference`, `catalogRecords`, `embed`,
`copySlides`, `moveToCustom` and `updateFromCatalog` all take it, and opf-render, opf-pptx and opf-editor pass it through to core, so a
record a host registers resolves the same in preview, editor and export. Without it only what the document embeds
resolves. A `catalogs` value that is not an array of registered catalogs throws `OPFCatalogsOptionError`
(`code: "invalid-catalogs"`) at every entry point. `resolveSlideContext(...).resolved.provenance` (and
`resolveDesignRecords(...).provenance`) says where each resolved layout, theme, colour scheme and font scheme came from
(`{ kind, reference, id, group, source?, origin }`, origin `document` or `host`), so engines record provenance without
resolving again.

`@openpresentation/opf/catalog` exports:

| Export | What it is |
| --- | --- |
| `defaultCatalog` | The snapshot's content records, keyed by kind and id, registered under `DEFAULT_CATALOG_SOURCE` |
| `DEFAULT_CATALOG_SOURCE` | `https://www.pptx.gallery` |
| `catalogDisplay` | Display metadata for pickers: `chartTypes`, `languages` and `socialPlatforms` by id |
| `catalogIndexes` | Each kind's `index.json` from the snapshot |
| `layoutPreviews`, `layoutPreviewIndex`, `getLayoutPreview`, `hasLayoutPreview` | The static HTML layout previews |

No other entry of the package imports catalog data; `pnpm check:catalog-free` holds that with an esbuild metafile
budget.

## Authoring helpers

- **`embed(document, { catalogs })`** embeds each referenced record once, in the group it resolves in, together with
  the records it references (a theme's colour and font schemes). A bare id from the host default goes under
  `catalogs.default` with the catalog's source. Records already embedded are kept as they are; `x-*`, `$schema` and `id`
  are stripped. It returns `{ document, added, unresolved }` and is idempotent. Authoring tools call it on save and
  export; `opf embed` does it on the command line.
- **`copySlides(from, to, indexes, { catalogs, at })`** copies slides with their records. Groups match by `source`, not
  by name: references are rewritten to the target's name for that source, and a missing group is added (renamed
  `<name>-2` when its name is taken). A source document without `catalogs.default` inherits the host default's
  source; when the target's default has another source, or is `false`, that catalog is added to the target as a named
  group and the copied bare references get its prefix, so copied slides never change catalog. A record the target
  already has with the same content is reused. A `custom` id
  the target uses for different content is renamed `<id>-2`. A catalog record whose revision differs from the one the
  target resolves moves into `custom` as `<id>-2`, so the copied slides look the same, and is listed in `renamed`.
  `renamed` lists only the records a call creates under a new id: a later copy that reuses one is not a rename.
- **`moveToCustom(document, { kind, reference }, { catalogs })`** moves a record embedded under `default` or a named
  group into `custom`: the fix `opf/catalog-record-not-in-source` suggests. Every reference that named it is rewritten
  to name it in `custom`, and its own references keep naming what they named. It keeps its id unless `custom` holds a
  different record under it (then `<id>-2` and up, reported in `renamed`; an identical one is reused). It returns
  `{ document, from, to, references, patch, renamed? }`, where `patch` is RFC 6902 for review and undo, and throws
  `OPFMoveToCustomError` (`invalid-reference`, `already-custom`, `not-embedded`, `invalid-id`). Fork:
  `moveToCustom(document, ref, { id })` copies the record into `custom` under the new id (`<id>-2` on conflict) and
  rewrites every reference to the copy, qualified references inside other records included, so the original is dropped
  from its group; an editor calls it on the first edit of a catalog record and applies the edit to the copy.
- **`updateFromCatalog(document, catalogs, refs?)`** compares the records embedded under `default` and the named groups
  with the registered catalogs' current ones and returns `{ changes, patch }`. Nothing changes until the author applies
  `patch` (`applyPatch`); `custom` records are never compared.
- **`resolveReference`**, **`parseReference`** and **`catalogRecords`** (the records a picker can offer, with the
  reference to write for each) are the building blocks.

## Engine vocabularies and engine defaults

Values an engine must understand to draw are not catalog references:

- `chart.type` is a schema enum;
- the keys of `Organization.socials` and `Speaker.socials` are a schema enum, linked with URL patterns in code;
- `language` is a BCP-47 tag (or a `Language` object with a `bcp47` tag); engines know the script, direction, OOXML
  culture tag and default script fonts of the vocabulary's tags and infer the script of any other well-formed tag.

They are listed in [`spec/reference/engine-vocabularies.json`](../spec/reference/engine-vocabularies.json) and exported
as `CHART_TYPES`, `SOCIAL_PLATFORMS` and `LANGUAGES`. Their labels, descriptions and icons stay in the catalog as
display metadata (`catalogDisplay`).

When nothing names a theme, colour scheme or font scheme, or a reference resolves nowhere, every engine draws with the
same engine defaults: [`spec/reference/engine-defaults.json`](../spec/reference/engine-defaults.json), exported as
`ENGINE_DEFAULT_THEME`, `ENGINE_DEFAULT_COLOR_SCHEME` and `ENGINE_DEFAULT_FONT_SCHEME`. They are the drawing fields of
the gallery's `minimal`, `cool-horizon` and `aptos` records, compiled into code.

## Ownership

- **pptx.gallery owns every catalog record** and publishes it; each id has one owner. Its display metadata lives under
  `x-*` members.
- **`spec/catalogs/` is a pinned, one-way snapshot.** `spec/catalogs/manifest.json` records the gallery commit and a
  content hash per kind. Records change in the gallery and reach core through the sync below; a record rewrite that the
  0.15 spec itself requires lands in the snapshot and in the gallery in the same release train.
- **A catalog release never needs a core release.** Hosts register the catalog version they choose; documents carry
  the records they were saved with.

## Endpoints

| Request | Response |
| --- | --- |
| `GET https://www.pptx.gallery/<kind>/index.json` | Catalog index |
| `GET https://www.pptx.gallery/<kind>` with `Accept: application/json` | Same catalog index |
| `GET https://www.pptx.gallery/<kind>/<id>.json` | One published record |
| `GET https://www.pptx.gallery/<kind>/<id>` with `Accept: application/json` | Same record |
| Either URL from a browser | The gallery's HTML page |

Engines never call these. A host may, to build the catalog it registers. Catalog files are served with
`Access-Control-Allow-Origin: *`, and negotiated URLs send `Vary: Accept`. The older
`https://www.pptx.gallery/api/<dimension>.json` envelopes carry the gallery's presentation data in its own shape; they
are not OPF records and link their catalog index with `Link: <…/<kind>/index.json>; rel="alternate"`.

## Kinds

| `<kind>` (URL and snapshot directory) | Key | Record schema | Role | Snapshot mode |
| --- | --- | --- | --- | --- |
| `audiences` | `audiences` | `opf-audience/v1` | content, `audience` | mirror |
| `color-schemes` | `colorSchemes` | `opf-color-scheme/v1` | content, `design.colorScheme` | mirror |
| `font-schemes` | `fontSchemes` | `opf-font-scheme/v1` | content, `design.fontScheme` | mirror |
| `layouts` | `layouts` | `opf-layout/v1` | content, `Slide.layout` | mirror |
| `narratives` | `narratives` | `opf-narrative/v1` | content, `narrative` | mirror |
| `purposes` | `purposes` | `opf-purpose/v1` | content, `purpose` | mirror |
| `themes` | `themes` | `opf-theme/v1` | content, `design.theme` | mirror |
| `tones` | `tones` | `opf-tone/v1` | content, `tone` | mirror |
| `chart-types` | `chartTypes` | `opf-chart-type/v1` | display metadata for `chart.type` | mirror |
| `languages` | `languages` | `opf-language/v1` | display metadata for `language` | mirror |
| `social-platforms` | `socialPlatforms` | `opf-social-platform/v1` | display metadata for `socials` keys | mirror |

Record schema ids are `https://openpresentation.org/schema/<name>`. A font scheme's `languages` list holds BCP-47 tags.

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
- `contentSha256` is the lowercase hex SHA-256 of the canonical JSON of the full records in index order, with every
  top-level `x-*` member removed. Canonical JSON sorts object keys and has no insignificant whitespace (`canonicalJson()`
  in `scripts/catalog-snapshot.mjs`). The bundled index and the published index carry the same value for a mirrored kind.

A **published record file** names its companion schema in `$schema` and carries its `id`; `validateCatalogRecord(kind,
record)` checks one. Publishers may add top-level `x-*` members (pptx.gallery puts page URLs, mood tags, contrast
notes and font stacks in `x-gallery`); the snapshot never carries them. The copy a document embeds has neither
`$schema` nor `id` nor `x-*` members.

Before v1 an id is renamed or removed outright: there are no deprecated records, aliases or redirects. A document that
names a retired id gets `opf/unresolved-reference`.

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

Every kind is `mirror`: the snapshot holds every record the gallery publishes (all 278 layouts, for example), so
`@openpresentation/opf/catalog` is the full gallery catalog and a host registers it as is. It costs nothing in the
engine bundles: only `/catalog` carries the snapshot, and `pnpm check:catalog-free` budgets it on its own.

The snapshot never loses an id by accident: the sync refuses a publisher that stopped serving a held id. The one waiver
is explicit and per id: `--allow-removed <kind>:<id>[,<id>...]` (repeatable) drops exactly those ids and deletes their
files.

### Updating it

```sh
# in the pptx-gallery checkout: edit data/, then
pnpm build:opf-catalog            # regenerate and validate public/<kind>/
git commit                        # the snapshot pins a commit

# in this repository
node scripts/sync-gallery-catalog.mjs --gallery ../pptx-gallery          # writes spec/catalogs + manifest
node scripts/sync-gallery-catalog.mjs --gallery ../pptx-gallery --report # per-kind counts
```

The sync validates every published index and record against the schemas in `spec/schemas/`, checks the published
`contentSha256`, drops `x-*` members, and rewrites only the files whose content changed. Writes require a clean gallery
checkout so the manifest commit identifies the actual catalog bytes. `--url https://www.pptx.gallery` reads the live
site for inspection and requires `--check` or `--report`. Every kind takes every published record; there is no
per-id selection.

A record rewrite the spec itself requires (the 0.15 font-scheme `languages` tags, for example) is edited under
`spec/catalogs/<kind>/` and rehashed, and the gallery publishes the same records in the same train:

```sh
node scripts/sync-gallery-catalog.mjs --rehash                  # index contentSha256, manifest records and contentSha256
node scripts/sync-gallery-catalog.mjs --rehash --match-gallery  # also each kind's gallery block
```

### Checks

- `pnpm check:spec` and `pnpm check:catalog` (both in `pnpm test`) verify offline that every kind's records still hash
  to the value in its index and the manifest.
- `pnpm check:catalog-free` fails when a catalog module reappears in the import graph of core's root or of any subpath
  other than `/catalog`, or when their gzip size passes the recorded budget.
- `sync-gallery-catalog.mjs --check` compares a local gallery checkout with the snapshot.

## Reconciliation status

The per-kind divergence between the gallery and this snapshot is in
[`programs/font-fidelity-everywhere/ff-37-catalog-divergence.md`](programs/font-fidelity-everywhere/ff-37-catalog-divergence.md).
