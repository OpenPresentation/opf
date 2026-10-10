# Catalogs and the gallery package

OPF 0.15 keeps catalogs out of the engine. A document embeds every record it uses, hosts register the catalogs they
trust, and core ships no records. pptx.gallery publishes the **default catalog**; its pinned snapshot is the npm
package **`@openpresentation/gallery`** (`packages/gallery`, RR-78), released on its own version line. Core and the CLI
depend on it and register it in Node; core has no `/catalog` subpath (removed in 0.19, with no alias).

This page is the contract: the document shape, the one resolution rule, how hosts register catalogs, the authoring
helpers, the diagnostics, and how the gallery package stays tied to pptx.gallery. The design behind it is
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
> `"default": false` uses no catalog for bare ids. Without the `catalogs` option the browser build and every engine
> register nothing, so only what the document embeds resolves; in Node, core's file API and `validate`, `stats`,
> `paginate`, `embed` and `edit` register `gallery`, as the CLI does. Hosts (the CLI, the editor app, the sites)
> register `@openpresentation/gallery`; libraries and engines pass the option through.

```js
import { validate, resolveSlideContext, paginate, embed } from '@openpresentation/opf';
import { gallery } from '@openpresentation/gallery';

const catalogs = [gallery, acmeCatalog]; // acmeCatalog = { source: 'pkg:@acme/opf-catalog', layouts: { hero: { … } } }
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

`@openpresentation/gallery` exports:

| Export | What it is |
| --- | --- |
| `gallery` | The content records, keyed by kind and id, registered under `GALLERY_SOURCE` |
| `GALLERY_SOURCE` | `https://www.pptx.gallery` |
| `CATALOG_SCHEMA` | The version of core's catalog record schemas the records target (also `opf.catalogSchema` in its `package.json`) |
| `catalogDisplay` | Display metadata for pickers: `chartTypes`, `languages` and `socialPlatforms` by id |
| `catalogIndexes` | Each kind's `index.json` |
| `catalogManifest` | The pptx.gallery commit the records were synced from, and a content hash per kind |

`@openpresentation/gallery/previews` exports the static HTML layout previews: `layoutPreviews`, `layoutPreviewIndex`,
`layoutPreviewSlugs`, `getLayoutPreview` and `hasLayoutPreview`.

Core reads catalog schema `CATALOG_SCHEMA` (exported from its root). When the installed gallery declares another one,
core never registers it: the Node defaults throw `OPFApiError` `gallery-schema-mismatch` and the CLI stops with the same
code, naming both versions. No browser entry of core imports catalog data; `pnpm check:catalog-free` holds that with an
esbuild metafile budget.

OPF 0.19 removed `@openpresentation/opf/catalog` (`defaultCatalog`, `DEFAULT_CATALOG_SOURCE`, `catalogDisplay`,
`catalogIndexes` and the layout previews) and core's `spec/catalogs/` and `spec/previews/` files, with no alias: import
the same records from `@openpresentation/gallery`, where `defaultCatalog` is `gallery` and `DEFAULT_CATALOG_SOURCE` is
`GALLERY_SOURCE`.

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
- **`packages/gallery/catalog/` is a pinned, one-way snapshot** (RR-78), published as `@openpresentation/gallery`.
  Its `manifest.json` records the gallery commit and a content hash per kind. Records change in the gallery and reach
  the package through the sync below. Core has no copy.
- **A catalog release never needs a core release.** `@openpresentation/gallery` has its own version line and its own
  publish workflow (see below). Core and the CLI depend on `@openpresentation/gallery@^1`, so an application gets the
  newest 1.x gallery its lockfile allows; core's own tests pin the workspace gallery through the lockfile. Hosts
  register the catalog version they choose; documents carry the records they were saved with.

## The `@openpresentation/gallery` package

```js
import { gallery } from '@openpresentation/gallery';
validate(document, { catalogs: [gallery] });
```

`gallery` holds `source` and the eight content kinds, each record keyed by id without `$schema`, `id` or `x-*` members
(what core 0.15 to 0.18 exported as `defaultCatalog` from `/catalog`). The exports are listed under "Registering
catalogs" above. It has no runtime dependency; its types name core's `Catalog`.

It is built from `packages/gallery/catalog/` and `packages/gallery/previews/layouts/` in this repository and published
from it, so its npm provenance names `OpenPresentation/opf`. Versions:

- **minor**: new records only. A minor or patch release draws every existing record exactly as the previous published
  release does and removes no id.
- **major**: an id removed or renamed, a change to how an existing record draws, or a record schema change
  (`CATALOG_SCHEMA`).

`pnpm check:gallery-stability` enforces the rule on every pull request (OPF CI) and before every publish
(`gallery-publish.yml`). It downloads the highest published version at or below the candidate's, and for every layout,
theme, colour scheme and font scheme both releases have, it draws a fixture deck (`packages/gallery/scripts/fixtures.mjs`:
a slide with sample content in every region of a layout, a six-slide sample deck for a design record) with the pinned
core and opf-render of the package's devDependencies, once per release. The SVG bytes are hashed first; only a mismatch
is rasterized (resvg, the renderer's bundled faces) to report how many pixels differ. A mismatch fails unless the
candidate's major version is higher; so does a removed id of any kind. New ids, and changes to text a drawing never
shows (names, summaries, tags), pass. The run draws 770 slides in under two seconds; with the download of the previous
release's tarball it takes a few seconds.

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

`packages/gallery/catalog/manifest.json` (schema `spec/schemas/catalog-manifest.schema.json`):

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
`gallery` is the full pptx.gallery catalog and a host registers it as is. It costs nothing in the engine bundles: no
browser entry of core imports it (`pnpm check:catalog-free`).

The snapshot never loses an id by accident: the sync refuses a publisher that stopped serving a held id. The one waiver
is explicit and per id: `--allow-removed <kind>:<id>[,<id>...]` (repeatable) drops exactly those ids and deletes their
files.

### Updating it

```sh
# in the pptx-gallery checkout: edit data/, then
pnpm build:opf-catalog            # regenerate and validate public/<kind>/
git commit                        # the snapshot pins a commit

# in this repository
node scripts/sync-gallery-catalog.mjs --gallery ../pptx-gallery          # writes packages/gallery/catalog + manifest
node scripts/sync-gallery-catalog.mjs --gallery ../pptx-gallery --report # per-kind counts
```

A sync pull request against this repository changes the package's records. It needs a changelog fragment for the
gallery (`packages: [gallery]`) and, when it is released, the version bump the rule above asks for; OPF CI's
pixel-stability step tells a new record (minor) from a changed one (major).

The sync validates every published index and record against the schemas in `spec/schemas/`, checks the published
`contentSha256`, drops `x-*` members, and rewrites only the files whose content changed. Writes require a clean gallery
checkout so the manifest commit identifies the actual catalog bytes. `--url https://www.pptx.gallery` reads the live
site for inspection and requires `--check` or `--report`. Every kind takes every published record; there is no
per-id selection.

A record rewrite the spec itself requires (the 0.15 font-scheme `languages` tags, for example) is edited under
`packages/gallery/catalog/<kind>/` and rehashed, and the gallery publishes the same records in the same train:

```sh
node scripts/sync-gallery-catalog.mjs --rehash                  # index contentSha256, manifest records and contentSha256
node scripts/sync-gallery-catalog.mjs --rehash --match-gallery  # also each kind's gallery block
```

### Checks

- `pnpm check:spec` and `pnpm check:catalog` (both in `pnpm test`) verify offline that every kind's records still hash
  to the value in its index and the manifest.
- `pnpm check:gallery` (in `pnpm test`) builds `@openpresentation/gallery` and runs its tests (shape, hashes, that core
  resolves its records, the stability rule itself); `pnpm check:gallery-stability` is the pixel-stability check above.
- `pnpm check:catalog-free` fails when a catalog module (the gallery package, or a former core catalog module)
  appears in the import graph of a browser entry of core, or when an entry's gzip size passes the recorded budget.
- `sync-gallery-catalog.mjs --check` compares a local gallery checkout with the snapshot.

## Reconciliation status

The per-kind divergence between the gallery and this snapshot is in
[`programs/font-fidelity-everywhere/ff-37-catalog-divergence.md`](programs/font-fidelity-everywhere/ff-37-catalog-divergence.md).
