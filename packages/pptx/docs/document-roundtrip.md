# Document references and metadata round trips (FF-32)

PPTX has no native field for an OPF catalog reference such as `design.colorScheme: "boost"` or a slide `layout: "title-slide"`. It also has none for authoring metadata such as `narrative`, `tone`, `audience`, `purpose`, `language`, `organization` or `speaker`. Before FF-32, `fromPptx` rebuilt only what the native parts showed, so every reference and metadata value was dropped without a diagnostic. The pptx.gallery parity harness recorded that loss for all 900 gallery values.

## Storage: PresentationML customer-data tags

Export writes two kinds of standard [customer-data tags](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.customerdatatags?view=openxml-3.0.1). They use the same mechanism as the existing `OPF_CODE_V1`, `OPF_HEADING_V1` and `OPF_FURNITURE_V1` provenance tags.

| tag | location |
|---|---|
| `OPF_DOCUMENT_V1` | `p:presentation/p:custDataLst` → `ppt/tags/opfDocument.xml` |
| `OPF_SLIDE_V1` | `p:cSld/p:custDataLst` of each slide → `ppt/tags/opfSlideN.xml`, or the slide's existing furniture tag list |

Values are UTF-8 JSON encoded as uppercase hex, as for the other OPF tags, because PowerPoint's [Tags API](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.tags) treats tags case-insensitively. `custDataLst` is placed in schema order: after `notesSz` and before `defaultTextStyle` in `presentation.xml`, and after `spTree` in a slide.

`CT_CustomerDataList` allows **one** `p:tags` per list. A slide that already has an `OPF_FURNITURE_V1` tag list therefore gets its `OPF_SLIDE_V1` tag in that same list, and furniture import ignores it when it checks for ambiguous identities. Other slide-level records, such as layout intent, must join `OPF_SLIDE_V1` or that list; they must never add a second `p:tags`.

Alternatives considered:

- **Custom document properties (`docProps/custom.xml`)** are visible and editable in File > Info > Properties. Office limits text property values to 255 characters, which is too small for inline catalog records. They are also deck-wide only, so they cannot follow a slide that is copied or reordered.
- **A `customXml` data-store part** needs its own item-properties part, a GUID and a schema namespace, and it is also deck-wide only. It would be a second provenance mechanism next to the tags the package already uses.
- **Tags** are not shown anywhere in PowerPoint's UI, and PowerPoint preserves them on save. It copies a slide's tags with the slide. Every other OPF provenance record already uses them, so import has one reader and one threat model.

## What is embedded: `toPptx(document, {provenance})`

Only values the document states are stored; engine defaults are not. A document that states none of the values below gets no tags and its bytes are unchanged.

| field | `'full'` (default) | `'references-only'` | `false` |
|---|---|---|---|
| `design.theme`, `colorScheme`, `fontScheme`, `dimensions`, `background` | yes | yes, unless the value names an image, logo, file or URL | no tags at all |
| deck composition defaults (`titleAlignment`, `contentAlignment`, `contentBox`, `contentDirection`, `chartPrimary`, `imageFill`, `listBullet`) | yes | yes | |
| `narrative`, `tone`, `purpose`, `language`, `audience` | yes, any form | only as catalog ids (bundled or inline records) | |
| `organization`, `speaker`, `takeaway`, `duration`, `tags`, `variables` | yes | no | |
| slide `id` | yes | no | |
| slide `beat`, `layout`, `type`, `composition`, slide design references and hints | yes | yes (design values without image/file/URL sources) | |
| `assets` entries referenced by stored values | yes | no | |
| inline `catalogs` records referenced by the document | yes | yes, referenced by stored values | |
| native evidence (hashes and theme values, below) | yes | yes | |

The default stays `'full'` for now; the owner will decide whether it changes. The tags hold what the source document states, including personal metadata such as speaker names and email addresses. Hosts that share PPTX files outside the authoring context should consider `'references-only'` or `false`.

**Open question for the root Office check:** whether PowerPoint's Document Inspector offers to remove presentation and slide tags. Record the observed behaviour before changing the default.

### No embedded bytes

A `data:` source is never copied into a tag. When its bytes are identical to an exported media part (for example an asset-backed or inline picture background), the tag stores `{"$opfMedia": "ppt/media/imageN.png", "prefix": "data:image/png;base64,"}`. Import rebuilds the `data:` URI from the current media part.

Any other `data:` source makes its field unstorable. Examples are a logo that is not drawn on any slide, or a WebP converted to PNG. `toPptx` then reports `document-provenance-omitted` at the field path, such as `assets.logo`. A design reference whose asset could not be stored is omitted too, so import never restores a bare `asset:` reference without its registry entry.

### Size limits

- Each stored field (design, metadata, asset or slide field) is limited to 256 KiB after media references.
- Referenced inline catalogs are limited to 1 MiB.
- If a tag would still exceed the 16 MiB import limit, export removes catalogs, then assets, then the largest remaining field, until the tag fits.

Every omission is reported at export with `document-provenance-omitted` and recorded by path in the tag's `omitted` list. Import reports those paths again and keeps the observed values instead of treating the fields as unstated. For example, an omitted slide background is not removed as "inherited".

## Native evidence and restore rules

Each stored reference records the native values it produced. Those values are read from the final normalized package, after FF-24 writes the theme colors and FF-25 the background fills. Import restores a reference only while that evidence is unchanged. **Stored references win when the package still matches them. Otherwise the observed values stay, including FF-24's recovered theme and color scheme and FF-25's imported background, and a diagnostic names the reference.**

| reference | restored when unchanged | on change |
|---|---|---|
| `design.colorScheme` | theme `clrScheme` slot colors (`sysClr` by system name; `lastClr` is ignored) | `design-reference-changed` at `design.colorScheme`, naming the changed slots |
| `design.fontScheme` | theme major/minor `latin`/`ea`/`cs` typefaces | `design-reference-changed` at `design.fontScheme` |
| `design.theme` | theme colors and theme fonts | `design-reference-changed` at `design.theme` |
| `design.dimensions` | `p:sldSz` | `design-reference-changed`; the observed inches stay |
| `design.background` | the background of the slides that inherited it (image fills compared by target bytes): kept while at least one of them is unchanged, or when every slide overrides it | slides whose background changed keep a local override and report at `slides.N.design.background`; if all inheriting slides changed, the deck value is reported at `design.background` |
| slide `layout`, `type`, `composition`, slide composition hints | the slide's object kinds, positions, sizes, rotation and flips. Stacking order and table frame height (which viewers grow to fit text) are ignored | `layout-reference-changed` at `slides.N.layout`; `slide-reference-changed` / `design-reference-changed` for the others |
| slide `design.background` | that slide's `p:bg` | `design-reference-changed` at `slides.N.design.background` |
| slide `design.theme`/`colorScheme`/`fontScheme` | the set of typefaces and colors used on the slide | `design-reference-changed` |
| deck composition defaults | every slide present and structurally unchanged | `design-reference-changed` at `design.<key>` |

Authoring metadata, slide `id` and slide `beat` have no native counterpart and are restored from the stored value.

- The organization fields that current furniture shows (the name, and linked socials) win over the stored ones.
- If slides disagree on the organization name, `metadata-reference-changed` is reported and the organization is not restored.
- A metadata property whose `asset:` reference no longer resolves is left out, with `unresolved-asset-reference` at that path (for example `organization.logo`).
- A design reference that needs an unavailable asset or media part is not restored, with `unresolved-asset-reference`.
- When a duplicated slide carries a copied tag, its layout is restored and the repeated slide id is reported as `duplicate-slide-id`.
- Inline catalog records and stored assets return only for ids that the restored document references.

### Per-field fallback

Restores are applied as independent groups, one per OPF field. The deck background group also removes background copies observed on unchanged inheriting slides. When the combined result does not validate, each group is tried on its own. Only a group that makes the document invalid is left out, with `invalid-document-provenance` at its path; all other restores still apply. A record that cannot be decoded, has an unknown version or names an unknown field is rejected as a whole and reported at `''` or `slides.N`.

## Untrusted input

Tags can be written by anyone who can edit the file. The hash is a change detector, not a signature. Tag values are size-limited and decoded as JSON. Only known fields are accepted, media references must name an existing `ppt/media/` part, and every restored field must validate with `validatePresentation`. Nothing in a tag is executed or fetched. A package whose tags were stripped imports as an ordinary foreign deck without a diagnostic.

## Contract for layout-structure recovery (FF-29)

`restoreDocumentProvenance()` in `src/document-provenance.js` reads the tags without modifying the document. `fromPptx` keeps its per-slide result as `slideProvenance`:

```js
slideProvenance[i] = {
  layout,         // stored layout id (string) or undefined
  structure,      // 'match' | 'changed' | 'untagged'
  record,         // validated OPF_SLIDE_V1 value without native evidence:
                  // {v, slide, id?, beat?, layout?, type?, composition?, design?, omitted?}
  catalogRecord   // the stored inline catalogs.layouts record for `layout`, if any
};
```

With `structure: 'match'`, the layout id, composition and slide hints are already restored. With `'changed'`, they are reported and not restored, and layout-structure recovery may re-validate `layout`/`catalogRecord` against the observed arrangement. Layout intent needs no separate slide tag. New fields belong in `OPF_SLIDE_V1`, whose reader ignores unknown top-level fields, so they are added there rather than as a second `p:tags` in `custDataLst`, which the schema forbids.

## Follow-ups

- Keys that FF-24 theme recovery infers but the source never stated remain in the import. For example, a theme-only deck gains `design.colorScheme`.
- FF-24's `theme-unverified` diagnostic is suppressed when the stored `design.theme` is restored, because the two would contradict each other.
- `design.logo`, `design.watermark`, `design.slideImage` and `extensions` are not stored.
- A native PowerPoint save/reopen of a tagged deck, and Document Inspector behaviour, are separate Office gates.

## Scope

`npm test` runs `test/document-provenance.mjs`, which covers:

- package shape, full round trip and re-export, and benign editor rewrites;
- theme color, font, size, arrangement and background edits;
- duplicated slides; stripped, damaged and invalid tags; per-field fallback;
- shared furniture tag lists;
- asset-backed backgrounds through media references, unresolved media and assets;
- size limits and omitted-field records, provenance modes, and the per-slide contract.

`test/background-fills.mjs` checks that every FF-25 background returns authored, or observed when it is not stored. These are XML-level checks.
