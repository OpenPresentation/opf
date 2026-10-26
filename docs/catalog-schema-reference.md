# OPF Catalog Schema Reference

Catalog records are reusable presets that OPF documents reference by id. This page summarizes every catalog companion schema in `spec/schemas/`. The top-level presentation schema has its own [schema reference](schema-reference.md), and the report format every tool shares has the [validation results reference](finding-schema-reference.md).

OPF documents usually reference these records with string ids such as `design.theme = "minimal"`, `tone = "formal"`, or `chart.type = "line"`. Dense examples may also embed catalog sources or inline records under `catalogs`.

## Audience

- File: `spec/schemas/audience.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-audience/v1`
- Type: `object`
- Required fields: `$schema`, `id`, `name`
- Purpose: Schema for audience records. Each record names an audience archetype (e.g. 'executive', 'engineering-team', 'investor') and carries seniority, technical-fluency, decision-power, and attention-budget hints used by AI-driven generation. Documents reference an audience from 'audience', which also accepts free-form text. A document references a record as a bare id or 'name:id' and resolves it in its own catalogs groups first, then in the catalog the host registered for the group's source; engines...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-audience/v1"` | Identifies a published record file as a audience record. Required in a published file; an embedded copy omits it. |
| `id` | yes | `string` | The audience's id in its catalog, lowercase kebab-case. Required in a published record file; a document references the record by it (a bare id, or 'name:id' for a named group) and embeds it keyed by it, without this f... |
| `name` | yes | `string` | Human-readable audience name shown in pickers. |
| `summary` | no | `string` | One-sentence positioning of the audience who they are and what they care about. |
| `description` | no | `string` | Longer prose describing the audience archetype and how to address them. |
| `seniority` | no | `enum:ic \| manager \| director \| vp \| c-suite \| mixed` | Typical seniority level of the audience. Engines use this as a hint for default depth and pacing. |
| `technicalFluency` | no | `enum:low \| medium \| high \| mixed` | Typical technical fluency of the audience. AI generation uses this to decide whether to expand or assume technical terminology. |
| `decisionPower` | no | `enum:informational \| advisory \| decision-maker` | Whether the audience is expected to be informed, to advise, or to actually decide. Shapes the strength of the closing ask. |
| `attentionBudgetMinutes` | no | `number` | Realistic upper bound on this audience's focused attention for a single presentation, in minutes. Used as a hint when comparing against duration and the resolved narrative's duration range. |
| `recommendedNarratives` | no | `array<string>` | Soft cross-link: ids of narratives in the same catalog that work well for this audience. Used by picker UIs to suggest narratives once an audience is chosen. Never resolved, embedded or validated as references. |
| `recommendedTones` | no | `array<string>` | Soft cross-link: ids of tones in the same catalog that work well for this audience. Never resolved, embedded or validated as references. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional. |

## Catalog Index

- File: `spec/schemas/catalog-index.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-catalog-index/v1`
- Type: `object`
- Required fields: `$schema`, `version`, `description`, `records`
- Purpose: Generic shape shared by every `<kind>/index.json` file of the @openpresentation/gallery package (packages/gallery/catalog in the OPF repo) and by the default-catalog index that pptx.gallery publishes at `https://www.pptx.gallery/<kind>/index.json` (the gallery package is a pinned snapshot of that catalog; see docs/default-catalog.md). An index is a lightweight, ordered summary of the full-record JSON files that live alongside it: each entry names the record's stable id, a human-readable name,...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-catalog-index/v1"` |  |
| `kind` | no | `enum:audiences \| chart-types \| color-schemes \| font-schemes \| languages \| layouts \| narratives \| purposes \| social-platforms \| themes \| tones` | Catalog kind, as the URL segment of the default catalog (`https://www.pptx.gallery/<kind>`) and the `packages/gallery/catalog/<kind>` directory name. |
| `version` | yes | `string` | Index format version, as a string. |
| `description` | yes | `string` | Human-readable description of what this catalog kind holds and how entries are ordered. |
| `contentSha256` | no | `string` | SHA-256 (lowercase hex) of the canonical JSON of the full records this index lists, in index order, with every top-level `x-*` member removed. Canonical JSON sorts object keys and has no insignificant whitespace. Lets... |
| `records` | yes | `array<ref:IndexRecord>` | Ordered list of lightweight record summaries. Order defines the catalog's canonical/display order; full record data lives in the sibling JSON file named by `file`. |

### Nested Types

#### IndexRecord

- Type: `object`
- Required fields: `id`, `name`, `file`
- Purpose: Lightweight summary of one catalog record. Additional per-kind fields (e.g. `summary`, `tags`, `bcp47`, `duration`, `group`, `label`) are allowed and vary by catalog kind.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | yes | `string` | Stable identifier, matching the `id` field inside the record file named by `file`. Lowercase kebab-case; chart-type ids may start with a digit (e.g. '100pct-stacked-bar'). |
| `name` | yes | `string` | Human-readable name shown in pickers. |
| `file` | yes | `string` | Filename of the full record, relative to this index file's directory. |
| `deprecated` | no | `const:true` | Present on the entry of a record that carries `deprecation`. Pickers and default listings hide deprecated entries; the id keeps resolving. |
| `replacedBy` | no | `string` | The deprecated record's `deprecation.replacedBy`, repeated so a picker can offer the replacement without loading the record. |

## Catalog Snapshot Manifest

- File: `spec/schemas/catalog-manifest.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-catalog-manifest/v1`
- Type: `object`
- Required fields: `$schema`, `description`, `publisher`, `source`, `kinds`
- Purpose: Shape of the `manifest.json` of the @openpresentation/gallery package (packages/gallery/catalog/manifest.json), which pins the snapshot of the default OPF catalog published by pptx.gallery. It records the gallery commit the snapshot came from and, per kind, how the snapshot relates to the published catalog plus a content hash of the bundled records. Written by scripts/sync-gallery-catalog.mjs and checked by scripts/check-spec-integrity.mjs; see docs/default-catalog.md. This schema describes a...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-catalog-manifest/v1"` |  |
| `description` | yes | `string` |  |
| `publisher` | yes | `string` | Base URL of the default-catalog publisher. Each kind is published at `<publisher>/<kind>/index.json`. |
| `source` | yes | `object` | The published catalog files the snapshot was taken from. |
| `kinds` | yes | `object` | One entry per catalog kind, keyed by the kind's URL segment. |

### Nested Types

#### KindEntry

- Type: `object`
- Required fields: `mode`, `records`, `contentSha256`, `gallery`

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `mode` | yes | `enum:mirror` | Always 'mirror': the snapshot holds every record the publisher serves for the kind (OPF 0.15). |
| `records` | yes | `integer` | Number of records bundled for this kind. |
| `contentSha256` | yes | `string` | contentSha256 of the bundled records, as defined by the catalog index schema. |
| `gallery` | yes | `object` | The published catalog for this kind at the pinned commit. |

## Chart Type

- File: `spec/schemas/chart-type.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-chart-type/v1`
- Type: `object`
- Required fields: `$schema`, `id`, `name`, `mappings`
- Purpose: Schema for chart-type records: display metadata for chart pickers (name, group, expected series, complexity) and the Open XML mapping a picker can describe. One record per chart type that Aspose.Slides officially supports (see mappings.renderers["aspose-slides"].chartType), plus the column-and-line combination 'combo'. A document's chart.type is an engine vocabulary validated directly; engines never look a chart-type record up. pptx.gallery publishes these records and @openpresentation/galler...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-chart-type/v1"` | Identifies this record as a chart type in the open presentation catalog. |
| `id` | yes | `string` | The chart-type value (`chart.type`) this record describes. Lowercase kebab-case; it may start with a digit (e.g., '100pct-stacked-column') to mirror conventional chart naming. |
| `name` | yes | `string` | Human-readable name of the chart type, as a chart picker shows it. |
| `summary` | no | `string` | One-sentence positioning: when to reach for this chart variant. |
| `description` | no | `string` | Longer prose describing the chart and ideal use cases. |
| `mappings` | yes | `ref:ChartTypeMappings` | Canonical and optional renderer-specific mappings used by engines to render this chart type. |
| `group` | no | `string` | Top-level grouping in the chart picker. |
| `groupSort` | no | `integer` | Display ordering hint within the chart group. |
| `complexity` | no | `enum:simple \| calculated \| hierarchical \| normalized` | Shape of the underlying data: a flat series ('simple'), one with engine-side calculation ('calculated'), parent-child rows ('hierarchical'), or pre-normalized rows ('normalized'). The editor offers only 'simple' types... |
| `series` | no | `integer` | Number of data series this chart type expects: exactly that many, except that a stacked or percent-stacked type and a combination (composition 'mixed', such as combo) expect at least that many. The editor offers a typ... |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available. |

### Nested Types

#### ChartTypeMappings

- Type: `object`
- Required fields: `openxml`

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `openxml` | yes | `ref:OpenXmlChartMapping` | Canonical mapping to Open XML chart structures. |
| `renderers` | no | `object` | Optional renderer-specific mappings. Keys are renderer ids; values are intentionally opaque to OPF. The bundled catalog records the matching Aspose.Slides ChartType enumeration member under the "aspose-slides" key, e.... |

#### OpenXmlChartMapping

- Type: `object`
- Required fields: none

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `element` | no | `string` | Primary Open XML chart element or extension chart element, such as 'barChart', 'lineChart', 'pieChart', 'treemapChart', or 'waterfallChart'. |
| `barDir` | no | `enum:bar \| col` | Bar direction for Open XML barChart mappings. |
| `grouping` | no | `enum:standard \| clustered \| stacked \| percentStacked` | Open XML chart grouping value when the chart family supports grouping. |
| `marker` | no | `boolean` | Whether the chart type expects visible data markers. |
| `radarStyle` | no | `enum:standard \| marker \| filled` | Open XML radarStyle value for radarChart mappings. |
| `scatterStyle` | no | `enum:line \| lineMarker \| marker \| smooth \| smoothMarker` | Open XML scatterStyle value for scatterChart mappings. |
| `composition` | no | `enum:single \| mixed \| extension` | Whether the chart maps to one standard chart element, multiple combined chart elements, or an Open XML extension chart. |
| `extension` | no | `string` | Optional Open XML extension namespace or element hint for extension charts. |
| `series` | no | `array<ref:OpenXmlChartMapping>` | Open XML chart elements used by mixed/composite chart types. |
| `notes` | no | `string` | Short implementation note for mappings that need renderer interpretation. |

## Color Scheme

- File: `spec/schemas/color-scheme.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-color-scheme/v1`
- Type: `object`
- Required fields: `$schema`, `id`, `name`
- Purpose: Schema for color-scheme records. Each scheme is a named palette with the twelve PowerPoint color slots (six accents, two darks, two lights, plus hyperlink and followed-hyperlink), suitable for being mapped directly into OOXML theme XML. Documents reference a scheme from design.colorScheme (or design.colorScheme.id) and from a theme's colorScheme; slot overrides on design.colorScheme take precedence over the resolved scheme. The slot fields here mirror the inline-override fields on the in-docu...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-color-scheme/v1"` | Identifies a published record file as a colour scheme record. Required in a published file; an embedded copy omits it. |
| `id` | yes | `string` | The colour scheme's id in its catalog, lowercase kebab-case. Required in a published record file; a document references the record by it (a bare id, or 'name:id' for a named group) and embeds it keyed by it, without t... |
| `name` | yes | `string` | Human-readable scheme name shown in pickers. |
| `summary` | no | `string` | One-sentence positioning of the palette what mood it evokes and where to use it. |
| `description` | no | `string` | Longer prose describing the palette and its intended use. |
| `accent1` | no | `ref:HexColor` | Accent 1 color (hex). Mirrors the OOXML accent1 slot. |
| `accent2` | no | `ref:HexColor` | Accent 2 color (hex). Mirrors the OOXML accent2 slot. |
| `accent3` | no | `ref:HexColor` | Accent 3 color (hex). Mirrors the OOXML accent3 slot. |
| `accent4` | no | `ref:HexColor` | Accent 4 color (hex). Mirrors the OOXML accent4 slot. |
| `accent5` | no | `ref:HexColor` | Accent 5 color (hex). Mirrors the OOXML accent5 slot. |
| `accent6` | no | `ref:HexColor` | Accent 6 color (hex). Mirrors the OOXML accent6 slot. |
| `dark1` | no | `ref:HexColor` | Dark 1 color (hex). Typically the deepest neutral; OOXML dark1. |
| `dark2` | no | `ref:HexColor` | Dark 2 color (hex). Secondary dark; OOXML dark2. |
| `light1` | no | `ref:HexColor` | Light 1 color (hex). Typically the slide canvas; OOXML lt1. |
| `light2` | no | `ref:HexColor` | Light 2 color (hex). Secondary light surface; OOXML lt2. |
| `hyperlink` | no | `ref:HexColor` | Hyperlink color (hex). OOXML hlink. |
| `followedHyperlink` | no | `ref:HexColor` | Followed-hyperlink color (hex). OOXML folHlink. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available. |

### Nested Types

#### HexColor

- Type: `string`
- Required fields: none
- Purpose: Hex color: '#RGB', '#RRGGBB' or '#RRGGBBAA'. The same definition as HexColor in opf.schema.json.

_No named properties._

## Font Scheme

- File: `spec/schemas/font-scheme.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-font-scheme/v1`
- Type: `object`
- Required fields: `$schema`, `id`, `name`, `major`, `minor`
- Purpose: Schema for font-scheme records. Each scheme pairs a major (heading) and minor (body) font family in the OOXML majorFont/minorFont sense, scoped to a target app (powerpoint or google-slides) and a language family (Latin, East Asian, or Complex Script). Documents reference a scheme from design.fontScheme (or design.fontScheme.id), from a theme's fontScheme and from a language's fontScheme / googleFontScheme. Role overrides on design.fontScheme (heading, body, accent, code), each a font family n...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-font-scheme/v1"` | Identifies a published record file as a font scheme record. Required in a published file; an embedded copy omits it. |
| `id` | yes | `string` | The font scheme's id in its catalog, lowercase kebab-case. Required in a published record file; a document references the record by it (a bare id, or 'name:id' for a named group) and embeds it keyed by it, without thi... |
| `name` | yes | `string` | Human-readable scheme name shown in pickers. |
| `major` | yes | `string` | Heading (major) font family mirrors the OOXML majorFont entry. |
| `minor` | yes | `string` | Body (minor) font family mirrors the OOXML minorFont entry. |
| `code` | no | `string` | Optional monospaced font family name for code blocks and for inline code runs (TextRun.code). It has the same shape as the OPF FontScheme 'code' role, so a record and an inline design.fontScheme override are interchan... |
| `eastAsian` | no | `object` | East Asian script fonts. Maps to the OOXML a:ea element of majorFont (major) and minorFont (minor), and to run-level a:ea. When set, they fill the eastAsian slot for every language; when omitted, the slot comes from t... |
| `complexScript` | no | `object` | Complex-script fonts (for example Arabic, Hebrew, Indic and Thai). Maps to the OOXML a:cs element of majorFont (major) and minorFont (minor), and to run-level a:cs. When set, they fill the complexScript slot for every... |
| `type` | no | `enum:sans-serif \| serif \| monospace` | High-level typographic class of the scheme. |
| `app` | no | `enum:powerpoint \| google-slides` | Target application this font pairing is intended for. Metadata for pickers and catalog filters: no engine changes its output by it. |
| `languageFamily` | no | `enum:latin \| ea \| cs \| eastAsian \| complexScript` | Font-language family this scheme is intended for: 'latin' for Latin-script content, 'ea' (or 'eastAsian', the same value) for East Asian scripts, 'cs' (or 'complexScript', the same value) for Complex Scripts. The long... |
| `languages` | no | `array<string>` | Optional list of BCP-47 language tags this scheme is curated for. Useful for picker UIs that group fonts by language coverage. As the design font scheme, an 'ea' or 'cs' scheme fills its script slot only when this lis... |
| `textSample` | no | `string` | Short specimen string used by picker UIs to preview the scheme. |
| `summary` | no | `string` | One-sentence positioning of the font pairing. |
| `description` | no | `string` | Longer prose describing the font scheme and where it shines. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available. |

## Language

- File: `spec/schemas/language.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-language/v1`
- Type: `object`
- Required fields: `$schema`, `id`, `name`, `bcp47`
- Purpose: Schema for language records: display metadata for the language pickers of authoring tools (name, ISO code, the default font schemes a picker suggests). The document's 'language' is an engine vocabulary, a BCP-47 tag validated directly; engines never look a language record up, and their script, direction, OOXML tag and default script fonts come from spec/reference/engine-vocabularies.json. pptx.gallery publishes these records and @openpresentation/gallery ships them as catalogDisplay.languages.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-language/v1"` | Identifies this record as a language in the openpresentation.org catalog. |
| `id` | yes | `string` | The record's id in the gallery's language catalog, lowercase kebab-case. Documents name a language by its BCP-47 tag ('bcp47'), never by this id. |
| `name` | yes | `string` | Human-readable language name. |
| `code` | no | `string` | ISO 639-3 (or 639-2) three-letter language code. Carried for engines that prefer ISO codes. |
| `bcp47` | yes | `string` | BCP-47 language tag for this record. Use 'en-GB' for UK English; 'en-UK' is not a valid BCP-47 region form. |
| `ooxmlLang` | no | `string` | Curated culture tag for OOXML text-run language attributes (a:rPr/@lang, a:endParaRPr/@lang), in the language-[Script-]REGION form Office recognizes (e.g. 'ja-JP', 'ar-SA', 'ms-MY', 'nb-NO', 'fil-PH', 'zh-CN'). Engine... |
| `direction` | no | `enum:ltr \| rtl` | Base text direction for the language. When omitted, engines derive it from the script: Arabic (Arab), Hebrew (Hebr), Syriac (Syrc), Thaana (Thaa), N'Ko (Nkoo), Adlam (Adlm), Samaritan (Samr), Mandaic (Mand) and Hanifi... |
| `script` | no | `string` | ISO 15924 script code of the language's writing system. The script selects the OOXML font slot the language's text uses: East Asian scripts (Hans, Hant, Hani, Jpan, Kore, Hang, Hira, Kana, Bopo, Yiii) use the eastAsia... |
| `fontScheme` | no | `string` | The font-scheme id a picker suggests for this language when targeting PowerPoint output. Display metadata: engines take a language's default script fonts from their own vocabulary. |
| `googleFontScheme` | no | `string` | The font-scheme id a picker suggests for this language when targeting Google Slides output. Display metadata. |
| `summary` | no | `string` | One-sentence note about coverage or font defaults. |
| `description` | no | `string` | Longer prose describing the language record and any font-pairing rationale. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available. |

## Layout Preview Index

- File: `spec/schemas/layout-preview-index.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-layout-preview-index/v1`
- Type: `object`
- Required fields: `$schema`, `version`, `description`, `records`
- Purpose: Shape of previews/layouts/index.json in @openpresentation/gallery 2: one self-contained SVG preview per v2 intent layout, keyed by the matching catalog layout id. Each record names its SVG file and exact UTF-8 byte length. The gallery package owns the files; this checkout materializes ignored copies under packages/gallery/previews/layouts/. This internal index schema is excluded from the package's published/typed schema surface.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-layout-preview-index/v1"` |  |
| `version` | yes | `const:"2"` | Index format version, as a string. |
| `description` | yes | `string` | Human-readable description of the preview gallery and its rendering conventions. |
| `records` | yes | `array<ref:PreviewRecord>` | One entry per v2 layout and its SVG preview. |

### Nested Types

#### PreviewRecord

- Type: `object`
- Required fields: `id`, `file`, `bytes`
- Purpose: One layout template preview.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | yes | `string` | The matching layout record id, such as cover, chart or two-column. |
| `file` | yes | `string` | SVG filename, relative to this index directory, using the matching layout id. |
| `bytes` | yes | `integer` | Exact UTF-8 byte length of the referenced SVG file. |

## Slide Layout

- File: `spec/schemas/layout.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-layout/v2`
- Type: `object`
- Required fields: `$schema`, `id`, `name`, `regions`
- Purpose: Schema for slide-layout records. A layout is one ordered list of regions, declared once, in reading order: 'direction' says whether the record's 'regions' sit side by side (row) or are stacked (column), and each region says which content kinds it takes and how several blocks share it. A split is an entry that nests a second list the other way, which is how a layout gets two dimensions. 'title' and 'subtitle' are reserved heading regions. Engines compile the list into a grid of tracks (the gui...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-layout/v2"` | Identifies a published record file as a layout template. Required in a published file; an embedded copy omits it. |
| `id` | yes | `string` | The layout's id in its catalog, lowercase kebab-case. Required in a published record file; a document references the record by it (a bare id, or 'name:id' for a named group) and embeds it keyed by it, without this fie... |
| `name` | yes | `string` | Human-readable layout name, shown in layout pickers and as the PowerPoint layout name. |
| `summary` | no | `string` | One-sentence positioning of the layout when to reach for it. |
| `description` | no | `string` | Longer prose describing the layout structure and ideal use cases. |
| `design` | no | `ref:DesignHints` | The layout's design defaults, with the same keys and values as the deck's design and a slide's design (a slide overrides exactly what its layout sets, by the same name). An absent key means the layout has no opinion.... |
| `direction` | no | `enum:row \| column` | How the record's 'regions' are laid out: 'row' places them side by side, left to right in reading order; 'column' stacks them top to bottom. Default 'column'. |
| `anchor` | no | `enum:top \| middle \| bottom` | Vertical position of the content of every body region when it is shorter than the region. A split's 'anchor' replaces it for the regions under that split, and a region's own 'anchor' replaces both. Only 'anchor' is in... |
| `regions` | yes | `array<ref:RegionEntry>` | The record's regions in reading order: 1 to 12 entries, each a region ({ name, size?, ...rules }) or a split ({ direction, regions, size?, anchor? }). Every region is declared once, here, with its content rules; a blo... |
| `overflowRegion` | no | `string` | The region where content that no region accepts goes, whatever its 'accepts', while it has room; content beyond every region's room is drawn there too, with the warning opf/layout-unplaced. Omitted: the first primary... |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available. |
| `composition` | no | `ref:Composition` | Only 'gap', 'padding', 'minFontSize' and 'overflow', with their 0.18 meaning. A template's regions replace composition.mode, columns and weights. |

### Nested Types

#### RegionEntry

- Type: `oneOf:ref:HeadingRegion / ref:Region / ref:Split`
- Required fields: none
- Purpose: One entry of a regions list: a heading region, a body region or a split.

_No named properties._

#### RegionSize

- Type: `oneOf:number / const:"auto"`
- Required fields: none
- Purpose: The region's or split's share along its parent's direction: a number above 0 and up to 100 that siblings share in proportion (the gap is taken out first), default 1; or 'auto', the length the content needs at the starting text size (up to the space the heading rows and the content of the numeric rows leave; auto rows that do not all fit shrink together, each giving up the same fraction of what it can give up above...

_No named properties._

#### HeadingRegion

- Type: `object`
- Required fields: `name`
- Purpose: A reserved heading region: 'title' holds the slide's heading group (tag, title and subtitle, stacked) and 'subtitle' takes the subtitle out of it. A heading region takes only a size. At most one of each; a 'subtitle' needs a 'title'.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `name` | yes | `enum:title \| subtitle` | 'title' or 'subtitle'. |
| `size` | no | `ref:RegionSize` |  |

#### Split

- Type: `object`
- Required fields: `direction`, `regions`
- Purpose: A split nests a list of regions the other way inside one cell of its parent: a row of regions inside a column, or a column inside a row. It has no name; its regions are declared in reading order like the record's own. Splits nest at most three levels (the record's own list is level 1).

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `direction` | yes | `enum:row \| column` | How the split's 'regions' are laid out: 'row' side by side, 'column' stacked. |
| `regions` | yes | `array<ref:RegionEntry>` | The split's regions in reading order: 1 to 12 regions and splits. |
| `size` | no | `ref:RegionSize` |  |
| `anchor` | no | `enum:top \| middle \| bottom` | Vertical position of the content of every body region under this split, unless the region sets its own. The heading regions 'title' and 'subtitle' never inherit it. |

#### Region

- Type: `object`
- Required fields: `name`
- Purpose: One body region of a layout: its name, its share of the space and the rules for which content it takes and how several blocks share it.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `name` | yes | `string` | The region's name, lowercase kebab-case, unique across the whole record. A block targets it with 'region': '<name>'. It may not be 'title' (those are heading regions), 'tag', 'auto' or one of the promoted-region words... |
| `size` | no | `ref:RegionSize` |  |
| `accepts` | no | `array<enum:text \| list \| image \| video \| chart \| table \| code \| metric \| quote \| timeline \| group>` | Content kinds the region takes: the body content kinds, and 'group' for a content group of any content. A group is also accepted where every one of its leaf kinds is. Omitted: every body content kind and 'group'. |
| `role` | no | `enum:primary \| secondary \| media \| supporting` | Which content the region wants first. Binding gives a picture (image, video) to a media region first, then primary, secondary, supporting; every other kind to a primary region first, then secondary, supporting, media;... |
| `flow` | no | `enum:none \| grid \| column \| auto` | How several blocks share the region: 'none' one block fills it; 'grid' by count (1 fills, 2 side by side, 3 in a row, 4 as 2 x 2, 5 as 3 + 2, 6 as 3 x 2, 7 to 12 in four columns; rows and columns swap in a portrait re... |
| `max` | no | `integer` | Blocks the region holds on one slide. Default 1 for flow 'none' (which requires 1), else 6. Content beyond every region's room is drawn in the overflow region with the warning opf/layout-unplaced, and paginate moves i... |
| `bleed` | no | `boolean` | The region's outer edges that lie on the content box's edge extend to the slide edge, as a placed image does. A bled region is never drawn as a card. Default false. |
| `listColumns` | no | `oneOf:const:"auto" / const:1` | 'auto': a list in the region that does not fit its cell at the starting size (a lone list, or one of several blocks) flows into up to three columns before it shrinks, as a list payload's columns: 'auto'. Default 1. |
| `anchor` | no | `enum:top \| middle \| bottom` | Vertical position of the region's content when it is shorter than the region. Replaces the 'anchor' of the record and of the splits around it. Default: the nearest of those that sets one, else 'top'. |
| `empty` | no | `enum:collapse \| keep` | What the region does on a slide that gives it no content: 'collapse' (default) joins its cells to a neighbouring area that shares the full length of one of its edges and is not itself empty; 'keep' leaves the space. |

#### DesignHints

- Type: `object`
- Required fields: none
- Purpose: Design hints a layout carries. The keys and lowercase values are those of the deck's design and a slide's design in opf.schema.json (Design), so a slide overrides a layout by the same name and layout.design can be copied into slide.design unchanged. An absent key means the layout has no opinion. Only the keys the layout sets are stored. scripts/check-spec-integrity.mjs verifies that every key here has the same typ...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `titleAlignment` | no | `enum:left \| center \| right` | Horizontal alignment of the title heading area. |
| `contentAlignment` | no | `enum:left \| center \| right` | Horizontal alignment of the body regions. |
| `contentBox` | no | `boolean` | Whether the body regions are drawn inside a visible card or surface. |
| `contentDirection` | no | `enum:horizontal \| vertical` | Axis along which parallel body content is arranged: 'vertical' is a column, 'horizontal' a row. On a layout slide it turns every flowing region into one row or one column; the slide's own composition.mode, columns and... |
| `chartPrimary` | no | `enum:none \| top \| bottom \| left \| right` | Where the primary chart sits relative to supporting content on automatic slides. Template layouts express this arrangement with their regions; chartPrimary does not override a template. |
| `imageFit` | no | `enum:cover \| contain \| stretch` | Default fit of the slide's image blocks: 'cover' fills the frame and crops around focus, 'contain' shows the whole picture, 'stretch' scales it to the frame. |
| `listBullet` | no | `enum:character \| image \| none` | Marker style of lists: 'character' draws the glyph, 'image' draws the deck's icon logo as a picture bullet, 'none' draws no marker and no hanging indent (label-and-description lists). |
| `mirror` | no | `boolean` | Draw the layout mirrored: each row's cells and the column sizes reversed, so a 'beside' layout puts its picture, chart or table at the end. Logical: a right-to-left deck mirrors on top. Binding and reading order do no... |

#### Composition

- Type: `object`
- Required fields: none
- Purpose: A template's composition: only gap, padding, minFontSize and overflow, with their 0.18 meaning. A slide's composition overrides them; a slide's composition.mode, columns and weights arrange its first primary flowing region.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `gap` | no | `number` | Space between cells as a fraction of the container short edge (canvas at slide root). Default 0.03333333333333333. |
| `padding` | no | `number` | Inset as a fraction of the container short edge. Default 0.08 on a slide, 0 inside a group. |
| `minFontSize` | no | `number` | Minimum readable text size in reference pixels at a 720-pixel canvas short edge. Default 16. Overflow is diagnosed when text cannot fit at this size. |
| `overflow` | no | `enum:warn \| error` | warn returns diagnostics for content that does not fit; error rejects layout. Content is never silently removed. Default warn. |

## Narrative Template

- File: `spec/schemas/narrative.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-narrative/v1`
- Type: `object`
- Required fields: `$schema`, `id`, `name`, `beats`
- Purpose: Schema for narrative records. A narrative is a plan: a named story arc (e.g. 'problem-solution', 'scqa') as an ordered list of beats, each saying what its slide must do. A document points at one with the string 'narrative' and links its slides to beats with 'slides[].beat'; a narrative the document defines itself is a record in catalogs.custom.narratives. Core validate warns about a 'slides[].beat' id the resolved narrative does not define (opf/unknown-beat) and about a root 'duration' outsid...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-narrative/v1"` | Identifies a published record file as a narrative record. Required in a published file; an embedded copy omits it. |
| `id` | yes | `string` | The narrative's id in its catalog, lowercase kebab-case. Required in a published record file; a document references the record by it (a bare id, or 'name:id' for a named group) and embeds it keyed by it, without this... |
| `name` | yes | `string` | Human-readable template name, e.g. 'Problem Solution'. |
| `summary` | no | `string` | One-sentence description of when and why to use this narrative. |
| `description` | no | `string` | Longer prose describing the narrative arc and ideal use cases. Used by AI-driven generation to seed deck-level direction. |
| `audienceFit` | no | `array<string>` | Audiences this narrative works well for, e.g. ['executive', 'investor', 'customer']. |
| `duration` | no | `object` | Typical talk length this narrative suits, as a range in minutes. A deck's own target is the root 'duration' (one number); core validate warns when that target lies outside this range, and when 'min' is greater than 'm... |
| `tags` | no | `array<string>` | Free-form labels for filtering and search, e.g. ['business', 'pitch', 'internal']. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available. |
| `beats` | yes | `array<ref:Beat>` | Ordered list of beats that make up the narrative arc. |

### Nested Types

#### Beat

- Type: `object`
- Required fields: `id`, `name`
- Purpose: A single narrative beat a labeled segment of the story arc with a specific dramatic purpose. One beat is one slide: 'type' is that slide's Slide.type and 'layout' is its Slide.layout, so a planner copies them straight into a skeleton deck. Split a heavy beat into several beats rather than giving it several slides.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | yes | `string` | Stable slug used by Slide.beat to reference this beat. Lowercase kebab-case. |
| `name` | yes | `string` | Human-readable beat name, e.g. 'The Problem'. |
| `description` | no | `string` | Curator-written prose that explains what this beat should accomplish. |
| `instructions` | no | `string` | Short author-facing instruction for the beat typically one phrase. Complements 'description' with a concise directive. |
| `type` | no | `enum:text \| list \| image \| video \| chart \| table \| code \| metric \| quote \| timeline` | Default content kind for the beat's slide: the same values as Slide.type. Helps engines and planners choose a layout when only the beat is known. |
| `layout` | no | `string` | Suggested layout id for the beat's slide, e.g. 'section-divider', 'title-slide', 'text-left'. Resolves the same way as Slide.layout against catalogs.layouts and the default catalog at https://www.pptx.gallery/layouts. |
| `thoughtCues` | no | `array<string>` | Optional speaker or thinking cues for the beat: questions the slide should answer. A planner or author turns them into the slide's notes; no engine copies them there on its own. |

## Purpose

- File: `spec/schemas/purpose.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-purpose/v1`
- Type: `object`
- Required fields: `$schema`, `id`, `name`
- Purpose: Schema for purpose records. Each record names a presentation objective such as informing, aligning, persuading, driving a decision, or selling. Documents reference a purpose from 'purpose', which also accepts free-form text and inline Purpose objects. A document references a record as a bare id or 'name:id' and resolves it in its own catalogs groups first, then in the catalog the host registered for the group's source; engines never fetch a catalog. A published record file carries '$schema' a...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-purpose/v1"` | Identifies a published record file as a purpose record. Required in a published file; an embedded copy omits it. |
| `id` | yes | `string` | The purpose's id in its catalog, lowercase kebab-case. Required in a published record file; a document references the record by it (a bare id, or 'name:id' for a named group) and embeds it keyed by it, without this fi... |
| `name` | yes | `string` | Human-readable purpose name shown in pickers. |
| `summary` | no | `string` | One-sentence positioning of the purpose what this deck is trying to accomplish. |
| `description` | no | `string` | Longer prose describing when to use this purpose and how it should shape a deck. |
| `outcome` | no | `string` | Desired audience outcome after the presentation. |
| `successCriteria` | no | `array<string>` | Observable signals that the deck accomplished this purpose. |
| `recommendedNarratives` | no | `array<string>` | Soft cross-link: ids of narratives in the same catalog that work well for this purpose. Never resolved, embedded or validated as references. |
| `recommendedTones` | no | `array<string>` | Soft cross-link: ids of tones in the same catalog that work well for this purpose. Never resolved, embedded or validated as references. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional. |

## Social Platform

- File: `spec/schemas/social-platform.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-social-platform/v1`
- Type: `object`
- Required fields: `$schema`, `id`, `name`
- Purpose: Schema for social-platform records: display metadata for authoring UIs (name, brand color, handle example) alongside the URL patterns. The keys of a Socials object are an engine vocabulary validated directly; engines link a handle with the patterns in spec/reference/engine-vocabularies.json and never look a social-platform record up. pptx.gallery publishes these records and @openpresentation/gallery ships them as catalogDisplay.socialPlatforms.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-social-platform/v1"` | Identifies this record as a social-platform entry in the openpresentation.org catalog. |
| `id` | yes | `string` | The social platform's key, as written in a Socials object. Lowercase kebab-case. |
| `name` | yes | `string` | Human-readable platform name shown in pickers and footers. |
| `summary` | no | `string` | One-sentence positioning of the platform what it's used for and who's on it. |
| `description` | no | `string` | Longer prose describing the platform and any rendering conventions (e.g., handle prefixes, distributed instances). |
| `baseUrl` | no | `string` | Canonical base URL of the platform used as the prefix when normalizing handles to full URLs. |
| `profileUrlPattern` | no | `string` | URL pattern for individual member profiles. Use '{handle}' as the placeholder for the handle (with the prefix already stripped). |
| `companyUrlPattern` | no | `string` | Optional URL pattern for organization / company pages, when the platform distinguishes them from member profiles. Use '{handle}' as the placeholder. |
| `handlePrefix` | no | `string` | Conventional prefix character displayed before the handle (e.g. '@' for X / Mastodon / Threads / TikTok). Empty string when no prefix is used. Renderers strip it before substituting into URL patterns. |
| `handleExample` | no | `string` | Example handle in its conventional rendered form, used by picker UIs and validation hints. |
| `brandColor` | no | `string` | Brand color (hex) for branded icon chips, link styling, or section accents in authoring UIs. Catalog metadata: engines do not draw it. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available. |

## Theme

- File: `spec/schemas/theme.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-theme/v1`
- Type: `object`
- Required fields: `$schema`, `id`, `name`
- Purpose: Schema for theme records. Each theme is a small, named bundle that pairs a color scheme, a font scheme, a default theme-controlled background, and a slide size. Documents reference a theme from design.theme; design.colorScheme, design.fontScheme, design.background and design.dimensions take precedence over the resolved theme. The theme's own colorScheme and fontScheme references resolve in the theme's group first, so a catalog's theme finds that catalog's schemes. A document references a reco...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-theme/v1"` | Identifies a published record file as a theme record. Required in a published file; an embedded copy omits it. |
| `id` | yes | `string` | The theme's id in its catalog, lowercase kebab-case. Required in a published record file; a document references the record by it (a bare id, or 'name:id' for a named group) and embeds it keyed by it, without this field. |
| `name` | yes | `string` | Human-readable theme name shown in pickers. |
| `summary` | no | `string` | One-sentence positioning of the theme when to reach for it. |
| `description` | no | `string` | Longer prose describing what the theme looks and feels like and the kinds of decks it suits. |
| `colorScheme` | no | `string` | The theme's default colour scheme: a reference (a bare id or 'name:id') resolved like design.colorScheme, but in the theme's own catalogs group first. |
| `fontScheme` | no | `string` | The theme's default font scheme: a reference (a bare id or 'name:id') resolved like design.fontScheme, but in the theme's own catalogs group first. |
| `background` | no | `ref:ThemeBackground` |  |
| `variants` | no | `array<ref:ThemeVariant>` | The color variants the theme offers (OPF 0.23), for example light, light-alt, dark and dark-alt: named values of design.variant over the theme's one color scheme, so a dark deck is a variant of a theme and not a theme... |
| `dimensions` | no | `enum:16:9 \| 4:3 \| 16:10 \| 1:1 \| 4:5 \| 9:16 \| letter \| a4 \| widescreen \| standard` | Default slide size for this theme. Accepts the same preset values as design.dimensions.preset. |
| `design` | no | `object` | The theme's design defaults (OPF 0.19), so a house style such as boxed content or centred titles is set once: the keys and values of the deck's design for titleAlignment, contentAlignment, contentBox, contentDirection... |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available. |

### Nested Types

#### ThemeVariant

- Type: `object`
- Required fields: `id`, `name`, `variant`
- Purpose: One named color variant of a theme.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | yes | `string` | The variant's id within the theme, lowercase kebab-case. |
| `name` | yes | `string` | Human-readable variant name shown in pickers. |
| `variant` | yes | `oneOf:ref:ThemeBackgroundSlot / ref:ColorVariant` | The value design.variant takes when the variant is chosen: a background slot ('light1', 'light2', 'dark1', 'dark2'; the same as { background: slot }) or the ColorVariant object of opf.schema.json, which adds an accent... |

#### ThemeBackgroundSlot

- Type: `enum:light1 | light2 | dark1 | dark2`
- Required fields: none
- Purpose: PowerPoint theme-controlled slide background slot from the active color scheme. These are slots, not assumptions about actual colors: light1 is usually white and dark1 is usually black by convention, but the color scheme controls the real values.

_No named properties._

#### ThemeBackground

- Type: `object`
- Required fields: `type`, `slot`
- Purpose: Theme-controlled PowerPoint slide background. The slot is resolved through the active color scheme and remains theme-aware.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | yes | `const:"theme"` | Theme-controlled background fill. |
| `slot` | yes | `ref:ThemeBackgroundSlot` |  |

## Tone

- File: `spec/schemas/tone.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-tone/v1`
- Type: `object`
- Required fields: `$schema`, `id`, `name`
- Purpose: Schema for tone records. Each record names a presentation tone (e.g. 'formal', 'casual', 'inspirational') and carries voice cues, anti-patterns, and sample phrases that AI-driven generation uses to shape output. Documents reference a tone from 'tone'. A document references a record as a bare id or 'name:id' and resolves it in its own catalogs groups first, then in the catalog the host registered for the group's source; engines never fetch a catalog. A published record file carries '$schema' a...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-tone/v1"` | Identifies a published record file as a tone record. Required in a published file; an embedded copy omits it. |
| `id` | yes | `string` | The tone's id in its catalog, lowercase kebab-case. Required in a published record file; a document references the record by it (a bare id, or 'name:id' for a named group) and embeds it keyed by it, without this field. |
| `name` | yes | `string` | Human-readable tone name shown in pickers. |
| `summary` | no | `string` | One-sentence positioning of the tone when to reach for it. |
| `description` | no | `string` | Longer prose describing the tone and the kinds of decks it suits. |
| `voiceCues` | no | `array<string>` | Short directives that shape AI generation toward this tone. Phrased as imperatives, e.g. 'use second-person', 'favor short sentences', 'lead with the recommendation'. |
| `avoid` | no | `array<string>` | Anti-patterns that AI generation should not produce when this tone is active. |
| `samplePhrases` | no | `array<string>` | Short example phrases that exemplify this tone. Used by picker UIs and as few-shot examples for AI generation. |
| `recommendedNarratives` | no | `array<string>` | Soft cross-link: ids of narratives in the same catalog this tone pairs well with. Used by picker UIs to suggest narratives once a tone is chosen. Never resolved, embedded or validated as references. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional. |
