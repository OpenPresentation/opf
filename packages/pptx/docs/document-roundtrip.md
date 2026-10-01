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

Inline layout records may omit the standalone `$schema` identifier. Reimport
supplies that known identifier only to the layout validator, preserving the
authored record. An explicitly wrong identifier or other invalid record content
still produces the existing per-record diagnostic and fallback.

## What is embedded: `toPptx(document, {provenance})`

Only values the document states are stored; engine defaults are not. A document that states none of the values below gets no tags and its bytes are unchanged.

| field | `'full'` (default) | `'references-only'` | `false` |
|---|---|---|---|
| `design.theme`, `colorScheme`, `fontScheme`, `dimensions`, `background` | yes | yes, unless the value names an image, logo, file or URL | no tags at all |
| deck composition defaults (`titleAlignment`, `contentAlignment`, `contentBox`, `contentDirection`, `chartPrimary`, `imageFill`, `listBullet`) | yes | yes | |
| `design.logo` (deck and slide design; brand assets, spec-gap P1) | yes | no (a logo always names a source) | |
| `narrative`, `tone`, `purpose`, `language`, `audience` | yes, any form | only as catalog ids (bundled or inline records) | |
| `organization`, `speaker`, `takeaway`, `duration`, `tags`, `variables`, `filename`, `extensions` | yes | no | |
| slide `id`, `section`, `extensions` | yes | no | |
| slide `beat`, `layout`, `type`, `composition`, slide design references and hints | yes | yes (design values without image/file/URL sources) | |
| slide `layoutRecord`: the inline `catalogs.layouts` record for the slide's `layout` (FF-29) | yes | yes, unless it names an image, file or URL (its own `$schema` excepted) | |
| slide `content`: the content topology (groups, regions, root form, block ids and extensions, group composition, leaf boxes; below) | yes | no | |
| the whole `assets` registry (referenced or not), one field per asset id | yes | no | |
| inline `catalogs` records referenced by the document | yes | yes, referenced by stored values | |
| native evidence (hashes and theme values, below) | yes | yes | |

Slide `section` labels are additionally written as PowerPoint's native section list whatever the mode (below).

### Compatibility with published importers (`supplement`)

Importers up to 0.11.6 reject an `OPF_DOCUMENT_V1` whose `design` or `metadata` holds a key they do not know, and an `OPF_SLIDE_V1` whose `design` does; the whole tag is then dropped. Keys added since P1 (`design.logo`, `filename`, `extensions`; slide `design.logo`) are therefore written under a top-level `supplement` container (`{design: {...}, metadata: {...}}`) that those importers ignore, and merged back into the legacy sections on read; a legacy section that carries a supplement key rejects the tag. Slide `section`, `extensions` and `content` are top-level slide fields, which every reader ignores when unknown. `test/provenance-interop.mjs` (the `test:packed` lane) imports an export of this build with the published 0.11.6 package and requires its design references, metadata and layout intent to survive. Every new design or metadata key must join the supplement lists, never the legacy sections.

The default stays `'full'` for now; the owner will decide whether it changes. The tags hold what the source document states, including personal metadata such as speaker names and email addresses. Hosts that share PPTX files outside the authoring context should consider `'references-only'` or `false`.

**Open question for the root Office check:** whether PowerPoint's Document Inspector offers to remove presentation and slide tags. Record the observed behaviour before changing the default.

### No embedded bytes

Video placeholders (`OPF_MEDIA_V1`) follow the same privacy choice. In `full`
mode, the frame stores the authored video and its referenced asset chain, up to
256 KiB total. Data URIs have no exported video part and are omitted, with
`media-provenance-omitted` at export and `invalid-media-provenance` at import.
In `references-only`, media tags contain only group identity, roles and caption
line indices; they store no authored URL, file source, title, description or
asset entry. Import derives a video from the current native web hyperlink and
caption. With `false`, no media tags are written and placeholders import as
ordinary shapes and caption text.

A full-mode video restores only while its source hyperlink and caption still
match. An edited web hyperlink imports the current URL and caption and reports
`media-source-changed`; old hidden metadata and assets are dropped. Removing a
web link cannot restore the old tagged source. A non-web source restores only
when the caption itself shows that source. Media identities follow slides
through reordering and copying; diagnostics use the current slide index.
Conflicting asset IDs recover the affected video's native URL and caption with
`media-asset-conflict`, rather than pointing it at another video's registry
entry. These are package conversion checks; native Office parity is separate.

A `data:` source whose bytes are identical to an exported media part (for example an asset-backed or inline picture background) is not duplicated: the tag stores `{"$opfMedia": "ppt/media/imageN.png", "prefix": "data:image/png;base64,"}` and import rebuilds the `data:` URI from the current media part.

Inline data rule (spec-gap P1, vetoable): any other `data:` source, one with no exported media part (a logo that is not drawn on any slide, a speaker photo, an unused asset, a WebP converted to PNG), is stored inline when its field stays under the 256 KiB limit. Otherwise the field is omitted and `toPptx` reports `document-provenance-omitted` at the field path, such as `assets.logo`, as before. A design reference whose asset could not be stored is omitted too, so import never restores a bare `asset:` reference without its registry entry. `references-only` stores no sources at all, so this rule never applies to it. The P2 logo picture (`OPF_LOGO_V1`) consumes a drawn `design.logo`, whose bytes then are a media part and take the `$opfMedia` form; `design.logo` itself always returns from this record.

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

Authoring metadata (`filename` and `extensions` included), `design.logo`, slide `id`, `beat` and `extensions` have no native counterpart and are restored from the stored value; `design.logo` after its media and asset references resolve.

- The organization fields that current furniture shows (the name, and linked socials) win over the stored ones.
- If slides disagree on the organization name, `metadata-reference-changed` is reported and the organization is not restored.
- A metadata property whose `asset:` reference no longer resolves is left out, with `unresolved-asset-reference` at that path (for example `organization.logo`).
- A design reference that needs an unavailable asset or media part is not restored, with `unresolved-asset-reference`.
- When a duplicated slide carries a copied tag, its layout is restored and the repeated slide id is reported as `duplicate-slide-id`; a repeated block id as `duplicate-block-id` (the first occurrence keeps it; ids are unique across slides and blocks).
- The whole stored `assets` registry returns, one restore group per asset id; an id the import already provides (a media asset read from a video placeholder) keeps its observed value. Inline catalog records return only for ids that the restored document references.

### Content topology (spec-gap P1)

PowerPoint has no counterpart for OPF's content structure. Import rebuilds flat `blocks` from the native shapes in reading order, which loses nested groups, promoted regions, the root payload form (and with it a valid `slide.type`), block ids and extensions, and group composition. In `full` mode each `OPF_SLIDE_V1` record therefore carries `content`:

```
Topology = {form: 'root', field, box?, lines?, wrap?}  // root payload on the slide (`text`, `items`, `chart` ...)
         | {form: 'blocks', blocks: Node[]}
         | {form: 'regions', regions: {[key]: Node}}   // key = promoted region key (`left`, `top:left`, ...)
Node     = {t: 'group', id?, ext?, comp?, typed?, blocks: Node[]}
         | {t: 'leaf', k, id?, ext?, typed?, bullets?, box?, lines?, wrap?}  // k = text|list|image|video|chart|table|code|metric|quote|timeline
```

Leaf boxes are `[x, y, w, h]` in reference pixels (one decimal) from the same `composeSlide` geometry the export draws; `typed` records that the authored block spelled out its `type`; `bullets` is `true` when the authored list block used the `bullets` key (`{bullets: [...]}`, also beside `type: 'text'`, the only type `bullets` is valid with); `lines` (2 or more, `text` leaves and the root `text` field only) is the number of native line shapes a rich-text `text` payload exported as when the authored runs can be rebuilt exactly from those lines, and, whenever a line break was a hard break, `wrap` = `{lines: N, gaps}` (RR-09) replaces `lines` (an importer before RR-09 ignores `wrap` and keeps the flat blocks, rather than join the lines without their separators; pure soft wraps keep the `lines` form). `gaps` lists the N-1 separators between the lines: `''` for a soft wrap (no character deleted) or the whitespace the break held (a newline, CR LF, several newlines for a blank line, trimmed spaces), as a string, or as `[whitespace, k]` when the first k characters end the previous line's last run (the rest start the next one). Only whitespace is ever stored (each gap is at most 256 characters of space, tab, CR and LF), never a word. Leading or trailing whitespace outside the lines, a dropped or changed character, or a break that spans a differently styled run cannot be proven, so the leaf is left unmarked. A root shorthand with several payload fields (`{text, chart}`) composes one item per field and is stored as `{form: 'root', fields: [{field, box?}, ...]}`; each field returns as its own root property. A root or block `bullets` payload takes its key back on import (the importer names every list `items`; a payload with a list item description keeps `items`, which `bullets` cannot hold). Plain PPTX has no record, so its lists come back as `items`. The record holds structure, ids, extensions, composition and boxes only, never words, images or payload values. Core precedence applies: regions win over blocks, blocks over a root payload. Ids are any schema string up to 256 characters (the empty string included); groups nested deeper than 3 levels, slides with more than 256 content nodes, or an id longer than 256 characters leave the slide's topology unstored (`document-provenance-omitted` at `slides.N.content`, recorded in the tag), and import rejects the same bounds.

Import, while the slide's arrangement is unchanged (the same structure hash as `layout`/`type`/`composition`): each imported block (its native bounds in inches × 96) is matched to the smallest stored leaf whose box contains it within 3 px and whose kind is compatible (`text` and `list` are both text kinds); a block contained by no box (content that overflowed its box under `overflow: 'warn'`, whose lines still start inside it) matches the smallest compatible box that contains its origin. Exactly one block per leaf; a leaf with no block is dropped (empty payloads export nothing), an empty group with it. Several list blocks on one `list` leaf rejoin that list (native list lines interleave in reading order when another list sits beside them). Rich-text lines carry no shape names or tags, so a `text` leaf with `lines: N` and exactly N imported text blocks in its box rejoins them top to bottom into the one authored payload: the runs concatenated in order with the recorded separator between them (none for a soft wrap, which deletes no character; the stored whitespace for a hard break), the two runs at each seam merged when they differ only in text. The words are the current native ones; a payload whose runs could not be proven to rebuild has no `lines`, so it keeps the `content-structure-changed` fallback. Hard breaks inside list items are recorded separately (see below). A block that fits no leaf, or several non-list blocks on one leaf, abort the rebuild for that slide: it keeps its flat blocks and reports `content-structure-changed` at `slides.N`. On success the authored form returns: `slide.text = ...` (and the stored `type` with it, as one restore group `slides.N.content`), `slide['top:left'] = host`, nested groups with `composition`, `id`, `extensions`. A changed arrangement reports `slide-reference-changed` at `slides.N.content` and keeps the flat blocks. A damaged record (unknown form, kind or region key, bad box, too deep, too many nodes) rejects the slide tag as a whole (`invalid-document-provenance` at `slides.N`). Without the document tag, slide records still rebuild their content (a pasted slide keeps its groups).

### Hard line breaks inside list items (RR-09)

A list exports one native shape per line of every entry, named `OPF list <path> line N` (the entry's text lines, the first bulleted, then its description lines, numbered in that order; a blank line is a shape with no text). Import joins an entry's continuation lines without a separator and tells description lines from text lines by size, so a newline inside an item used to vanish and a blank line became an empty description. `OPF_SLIDE_V1.lists` = `[[path, [[line, gap], ...]], ...]` stores, per list path, the whitespace each hard break deleted keyed by the number of the line that follows it (a gap is whitespace or `[whitespace, keep]` as in `wrap`; soft wraps store nothing, and no word is stored). Import reads it before the shapes are merged into lists, while the slide's arrangement is unchanged (the structure hash), and joins the continuation line (a text line or a description line) with the recorded whitespace. A blank line's empty shape is skipped, so it never becomes a description (also without a record). A recorded line that is no longer a continuation reports `list-line-break-changed` at `slides.N`; a slide whose arrangement changed applies none. When the export cannot account for an item's characters exactly (leading or trailing whitespace outside the lines, changed characters), it reports `document-provenance-omitted` at the list path and import joins that list's lines as before. Plain PPTX has no record: it cannot tell a wrap from a break, so continuation lines still join without a separator. A damaged record (bad path, prototype key, non-whitespace or empty gap, unordered or out-of-range lines, more than 256 lists or 20000 breaks) rejects the slide tag (`invalid-document-provenance`).

### Import details (RR-08)

- **`author`.** `docProps/core.xml` `dc:creator` holds several authors joined by `; `. Import splits a creator on exactly that separator when every part is a non-empty name without outer whitespace (so the array joins back to the identical text) and never cuts a single name, a trailing `;` or a `;` without a space. In `full` mode `OPF_DOCUMENT_V1` also stores the authored `author` (`supplement.metadata.author`, ignored by older importers) when it is an array, a string that would read as a list or the literal default `OpenPresentation`, and the stored form returns while the PowerPoint field still equals it (an edited field wins with `metadata-reference-changed` at `author`). The exporter writes `OpenPresentation` when no author was authored; with the document tag present that default is not imported as an author. A plain PPTX whose creator is `OpenPresentation` keeps it (nothing says it was a default).
- **Run colours.** A `TextRun.color` that names a ColorRef (`var:brand`, a colour-scheme slot such as `accent2`, a role such as `primary`) is written as the resolved colour (or the theme slot that holds it, FF-24), so import used to return only hex. `OPF_SLIDE_V1.colors` = `{n, at: [[slot, name], ...]}` stores the names (no words): the slots are the text runs of the slide's content in a fixed order (text runs, then list item and description runs; regions by name, else blocks and groups in order, else the root payload) and `n` is how many the authored slide had. When the content structure was restored and the imported slide has exactly `n` runs, each stored name returns for its slot while it still resolves, in the imported document's own colour resolution (its variables and colour scheme, with slide overrides), to the run's current colour; a colour edited in PowerPoint keeps its edited value. A count mismatch reports `color-reference-changed` at `slides.N` and keeps the resolved colours. A slide with no OPF record (plain PPTX) maps a run painted with a bare `a:schemeClr` (no colour transform) back to its slot (`accent2`, `dark1`, `light1`, `hyperlink`, ...), again only where the document's colour scheme holds that exact colour; variables and roles cannot be recovered there. Table cells and quote, metric, code and timeline text have no record: their cell and run colours come back as hex (a bare scheme colour in a plain deck is mapped).
- **List item descriptions** come back as the item's `description` (the small continuation lines of an `OPF list` shape group), in every container and in plain PPTX; checked by `test/import-details.mjs`.

### Native sections (spec-gap P1)

Slide `section` labels are PowerPoint's own sections. Export writes `p14:sectionLst` into `ppt/presentation.xml` (`p:extLst/p:ext uri="{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"`, the last child of `p:presentation`, after the `p:custDataLst` the document tag adds before `p:defaultTextStyle`) whenever any slide has a non-blank `section`, whatever the `provenance` option. Each maximal run of consecutive slides with the same label is one `p14:section` listing its `p:sldId` ids; runs of slides without a label become a section named `Default Section`, PowerPoint's own default name (vetoable), so every slide is covered. Section ids are deterministic GUIDs (cyrb53 of the run index and name, formatted as a version-4 GUID). Decks without sections write no list and their presentation part is unchanged. A label is an XML attribute value: a character XML cannot carry (C0 controls other than tab/LF/CR, lone surrogates, U+FFFE/U+FFFF) fails the export with `invalid-text` at `slides.N.section`, exactly as a text run would; tab, LF and CR are written as spaces, since every XML reader normalizes them in an attribute, and labels are compared the same way on import, so a re-saved list never disagrees with the authored label (which returns from the stored tag).

Import reads the list: a slide in a section named exactly `Default Section` has no `section`, any other name is the slide's `section` (so an authored section literally named `Default Section` does not return, vetoable). The list is native data and wins over the stored `OPF_SLIDE_V1.section` and over the section text a footer or header shows, with `section-reference-changed` at `slides.N.section` when a shown text disagrees (the furniture line keeps its text). One exception keeps the previous behaviour for edited footers: when the list still equals the stored value and the shown text differs, the footer line was edited and its text is kept. Without a list the stored value is the fallback for a slide whose furniture shows no section. A malformed list counts as none. Native PowerPoint confirmation (sections pane names and membership, save/reopen keeping the list) is a separate gate: `scratchpad/spec-gaps-native/sections.pptx`.

### Per-field fallback

Restores are applied as independent groups, one per OPF field. The deck background group also removes background copies observed on unchanged inheriting slides. When the combined result does not validate, each group is tried on its own. Only a group that makes the document invalid is left out, with `invalid-document-provenance` at its path; all other restores still apply. A record that cannot be decoded, has an unknown version or names an unknown field is rejected as a whole and reported at `''` or `slides.N`.

## Untrusted input

Tags can be written by anyone who can edit the file. The hash is a change detector, not a signature. Tag values are size-limited and decoded as JSON. Only known fields are accepted, media references must name an existing `ppt/media/` part, and every restored field must validate with `validatePresentation`. Nothing in a tag is executed or fetched. A package whose tags were all stripped imports as an ordinary foreign deck without a diagnostic. When only `OPF_DOCUMENT_V1` is missing or unreadable, the slide tags still restore their layout intent (below).

## Layout intent (FF-29)

Layout intent is part of each slide's `OPF_SLIDE_V1` record, not a separate tag: the slide's `layout` id, `type`, `composition` and composition hints (`design.titleAlignment`, `contentAlignment`, `contentBox`, `contentDirection`, `chartPrimary`, `imageFill`, `listBullet`), plus `layoutRecord`. `layoutRecord` is the document's inline `catalogs.layouts` record for that id, stored with the slide as well as in the document's `catalogs`. Bundled ids carry no record. Geometry, text and images are never stored; composition re-derives placement from the restored intent, and native shapes supply every word and payload.

Neither mode stores the asset registry entries a layout record references; as before FF-29, catalog records never pull assets into the tags.

Import restores the intent while the slide's arrangement is unchanged (see the table above). Each layout id resolves to exactly one record, in this order:

1. the document's inline record (`OPF_DOCUMENT_V1`, FF-32);
2. a bundled layout. A slide's override of a bundled id is used only when there is no document record, or its record for that id was rejected, and every restored slide with that id carries the same override, so it never changes the layout of another slide;
3. the first restored slide's `layoutRecord`.

- A slide whose own `layoutRecord` disagrees with the chosen record keeps its content and composition hints without the layout id and reports `layout-reference-changed` at `slides.N.layout`. Examples: a slide pasted from another deck whose `gallery-hero` record differs, or a pasted slide whose inline record overrides a bundled id such as `title-subtitle` that the host's own slides use. The override is never added to the host's catalog.
- A pasted slide whose inline-only id the host lacks brings its own `layoutRecord`, which is added to `catalogs.layouts`.
- A layout id that resolves to no record (for example a deck exported before FF-29, whose slides carry no `layoutRecord`, after its document tag was stripped) is not restored, and `unresolved-layout-reference` names the layout at `slides.N.layout`. The imported document therefore always renders.
- Without `OPF_DOCUMENT_V1`, or when it is unreadable (`invalid-document-provenance` at `''`), slide records still restore layout intent under these rules. Deck references, deck composition defaults, metadata, slide ids and beats need the document record and are not restored.
- A `layoutRecord` whose `id` differs from the slide's `layout` is ignored and reported as `invalid-document-provenance` at `slides.N.layoutRecord`; a malformed one rejects the slide record (`slides.N`).
- Inline layout records from both document and slide tags must also validate against the core layouts catalog schema after resolving packaged media. Invalid records are omitted with `invalid-document-provenance` at `catalogs.layouts.records.N` or `slides.N.layoutRecord`. A valid other copy can still supply the layout; otherwise an inline-only id is omitted with `unresolved-layout-reference`. Native content and unrelated composition hints remain available.

Importers from before FF-29 ignore the `layoutRecord` field, as `OPF_SLIDE_V1` readers ignore unknown top-level fields.

## Media caption boundaries (FF-29)

Media import uses current native caption characters and the current frame hyperlink. A soft wrap adds no character. Full caption tags retain validated CR/LF/CRLF separators and emitted-line fingerprints; exact current text must also agree with the stored authored caption before the original video value is restored. Older full tags with an explicit soft/end boundary and no separator safely imply an empty separator; older hard boundaries remain conservative because their CR/LF spelling is unavailable. Edited captions and missing or invalid boundary evidence leave current native lines as separate ordinary text with `invalid-media-provenance`, following ordinary-import item ordering. That fallback does not reconstruct the original cross-shape source CRLF spelling.

References-only tags carry structural boundaries without authored separator bytes or fingerprints; hard breaks become semantic LF. Provenance-off writes no media tags. Neither limited mode promises original CRLF spelling. A cleared current caption cannot safely become a video with an empty title because the renderer displays the source for that authored value; import instead keeps the current URL as linked text and the cleared caption as empty text, with a diagnostic. Native formatting, geometry and general native-shape reading order are not reconstructed as authored OPF by these rules. Fallback caption shapes remain separate so unrelated or repositioned native items can retain their ordinary-import ordering; re-export can reflow them.

## Contract for layout-structure recovery (FF-29)

`restoreDocumentProvenance()` in `src/document-provenance.js` reads the tags without modifying the document, with or without `OPF_DOCUMENT_V1`. `fromPptx` keeps its per-slide result as `slideProvenance`:

```js
slideProvenance[i] = {
  layout,         // stored layout id (string) or undefined
  structure,      // 'match' | 'changed' | 'untagged'
  record,         // validated OPF_SLIDE_V1 value without native evidence:
                  // {v, slide, id?, beat?, layout?, type?, composition?, design?, layoutRecord?, omitted?}
  catalogRecord   // the inline catalogs.layouts record for `layout`, if any: the document's, else the slide's layoutRecord
};
```

With `structure: 'match'`, the layout id, composition and slide hints are already restored. With `'changed'`, they are reported and not restored, and layout-structure recovery may re-validate `layout`/`catalogRecord` against the observed arrangement. Layout intent needs no separate slide tag. New fields belong in `OPF_SLIDE_V1`, whose reader ignores unknown top-level fields, so they are added there rather than as a second `p:tags` in `custDataLst`, which the schema forbids.

## Follow-ups

- Keys that FF-24 theme recovery infers but the source never stated remain in the import. For example, a theme-only deck gains `design.colorScheme`.
- FF-24's `theme-unverified` diagnostic is suppressed when the stored `design.theme` is restored, because the two would contradict each other.
- `design.slideImage` is not stored in the document tag; `design.slideImage` and `design.watermark` are recovered from their own tagged native pictures while those are unchanged. `design.logo` and `extensions` are stored since spec-gap P1. The drawn cover logo is a tagged native picture (`OPF_LOGO_V1`): it is consumed on import, `design.logo` returns from this tag, and the picture's own image is the fallback only when nothing restored a logo. Header/footer `logo: true` is listed in the furniture manifest's `logos` key, outside `parts` and `definitions`, which released importers validate strictly (spec-gap P2).
- A native PowerPoint save/reopen of a tagged deck, and Document Inspector behaviour, are separate Office gates.

## Scope

`npm test` runs `test/document-provenance.mjs`, which covers:

- package shape, full round trip and re-export, and benign editor rewrites;
- theme color, font, size, arrangement and background edits;
- duplicated slides; stripped, damaged and invalid tags; per-field fallback;
- shared furniture tag lists;
- asset-backed backgrounds through media references, inline data sources, unresolved media and assets;
- size limits and omitted-field records, provenance modes, and the per-slide contract.

`test/content-topology.mjs` covers the content topology (nested groups, every region family, block ids and extensions, group composition, root payloads with slide type, side-by-side lists, edited geometry, box mismatches, damaged records, duplicated and pasted slides, modes) and `test/sections.mjs` the native section list (runs, Default Section, deterministic ids, schema order with the customer data, import from the list with and without tags, renamed and moved slides, the stored fallback, footer agreement and `section-reference-changed`). `test/export-corpus.mjs` and `npm run test:determinism` stay green; the corpus diff of this change touches tag parts, `presentation.xml` (sections, and the customer data of decks that previously stated nothing) and the customer-data lines of slides that previously carried no tag.

`test/background-fills.mjs` checks that every FF-25 background returns authored, or observed when it is not stored. These are XML-level checks.
