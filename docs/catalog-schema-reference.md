# OPF Catalog Schema Reference

Catalog records are reusable presets that OPF documents reference by id. This page summarizes every companion schema in `spec/schemas/` except the top-level presentation schema.

OPF documents usually reference these records with string ids such as `design.theme = "minimal"`, `tone = "formal"`, or `chart.type = "line"`. Dense examples may also embed catalog sources or inline records under `catalogs`.

## Audience

- File: `spec/schemas/audience.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-audience/v1`
- Type: `object`
- Required fields: `$schema`, `id`, `name`
- Purpose: Schema for audience records in the pptx.gallery library. Each record names an audience archetype (e.g. 'executives', 'engineering-team', 'investors') and carries seniority, technical-fluency, decision-power, and attention-budget hints used by AI-driven generation. Audiences are referenced from OPF documents via audience; the engine resolves the reference against catalogs.audiences (inline) catalogs.audiences.source the default catalog at https://www.pptx.gallery/audiences. The audience field...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-audience/v1"` | Identifies this record as an audience in the openpresentation.org catalog. |
| `id` | yes | `string` | Stable slug used by OPF documents to reference this audience via audience. Lowercase kebab-case. |
| `name` | yes | `string` | Human-readable audience name shown in pickers. |
| `summary` | no | `string` | One-sentence positioning of the audience who they are and what they care about. |
| `description` | no | `string` | Longer prose describing the audience archetype and how to address them. |
| `seniority` | no | `enum:ic \| manager \| director \| vp \| c-suite \| mixed` | Typical seniority level of the audience. Engines use this as a hint for default depth and pacing. |
| `technicalFluency` | no | `enum:low \| medium \| high \| mixed` | Typical technical fluency of the audience. AI generation uses this to decide whether to expand or assume technical terminology. |
| `decisionPower` | no | `enum:informational \| advisory \| decision-maker` | Whether the audience is expected to be informed, to advise, or to actually decide. Shapes the strength of the closing ask. |
| `attentionBudgetMinutes` | no | `number` | Realistic upper bound on this audience's focused attention for a single presentation, in minutes. Used as a hint when comparing against duration and the resolved narrative's durationRange. |
| `recommendedNarratives` | no | `array<string>` | Soft cross-link: narrative-catalog ids that work well for this audience. Used by picker UIs to suggest narratives once an audience is chosen. Validators warn on unknown ids; never error. |
| `recommendedTones` | no | `array<string>` | Soft cross-link: tone-catalog ids that work well for this audience. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional. |

## Catalog Index

- File: `spec/schemas/catalog-index.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-catalog-index/v1`
- Type: `object`
- Required fields: `$schema`, `version`, `description`, `records`
- Purpose: Generic shape shared by every `spec/catalogs/<kind>/index.json` file in the OPF repo. An index is a lightweight, ordered summary of the full-record JSON files that live alongside it: each entry names the record's stable id, a human-readable name, and the record's filename, plus whatever extra summary fields are useful for picker UIs (e.g. `summary`, `tags`, `bcp47`, `durationRange`). This schema describes the repo-internal catalog index files themselves, not OPF documents or individual catalo...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-catalog-index/v1"` |  |
| `version` | yes | `string` | Index format version, as a string. |
| `description` | yes | `string` | Human-readable description of what this catalog kind holds and how entries are ordered. |
| `records` | yes | `array<ref:IndexRecord>` | Ordered list of lightweight record summaries. Order defines the catalog's canonical/display order; full record data lives in the sibling JSON file named by `file`. |

### Nested Types

#### IndexRecord

- Type: `object`
- Required fields: `id`, `name`, `file`
- Purpose: Lightweight summary of one catalog record. Additional per-kind fields (e.g. `summary`, `tags`, `bcp47`, `durationRange`, `group`, `label`) are allowed and vary by catalog kind.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | yes | `string` | Stable identifier, matching the `id` field inside the record file named by `file`. |
| `name` | yes | `string` | Human-readable name shown in pickers. |
| `file` | yes | `string` | Filename of the full record, relative to this index file's directory. |

## Chart Type

- File: `spec/schemas/chart-type.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-chart-type/v1`
- Type: `object`
- Required fields: `$schema`, `id`, `name`, `mappings`
- Purpose: Schema for chart-type records in the pptx.gallery catalog. The bundled catalog holds one record per chart type that Aspose.Slides officially supports (see mappings.renderers["aspose-slides"].chartType). Each record describes a named chart variant, its Open XML mapping, its series/category cardinality, the column structure of the underlying workbook, and a small sample dataset suitable for previews. Chart types are referenced from OPF chart content payloads; the engine resolves the reference a...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-chart-type/v1"` | Identifies this record as a chart type in the open presentation catalog. |
| `id` | yes | `string` | Stable slug used by OPF documents to reference this chart type. Lowercase kebab-case. Chart type ids may start with a digit (e.g., '100pct-stacked-column', '3d-column') to mirror conventional chart naming. |
| `name` | yes | `string` | Stable display/programmatic name for this chart type. |
| `label` | no | `string` | Human-readable label shown in chart pickers. |
| `summary` | no | `string` | One-sentence positioning: when to reach for this chart variant. |
| `description` | no | `string` | Longer prose describing the chart and ideal use cases. |
| `mappings` | yes | `ref:ChartTypeMappings` | Canonical and optional renderer-specific mappings used by engines to render this chart type. |
| `deprecation` | no | `ref:ChartTypeDeprecation` | Present when this chart type is deprecated. Deprecated records stay resolvable so existing documents keep validating, but pickers and default listings exclude them, validators warn when a document references them, and... |
| `group` | no | `string` | Top-level grouping in the chart picker (column, bar, line, area, pie, radar, etc.). |
| `groupSort` | no | `integer` | Display ordering hint within the chart group. |
| `complexity` | no | `enum:simple \| calculated \| hierarchical \| normalized` | Shape of the underlying data: a flat series ('simple'), one with engine-side calculation ('calculated'), parent-child rows ('hierarchical'), or pre-normalized rows ('normalized'). |
| `series` | no | `integer` | Number of data series this chart type expects. |
| `categories` | no | `integer` | Number of category labels this chart type expects on the primary axis. |
| `seriesGroups` | no | `integer` | Number of series groups (axis bands) this chart type uses; >1 for combo or banded charts. |
| `useSecondaryCategories` | no | `boolean` | Whether the chart type uses a secondary category axis. |
| `workbookRange` | no | `string` | A1 reference to the source range in the embedded workbook. |
| `columns` | no | `array<string>` | Column header names of the embedded workbook, in left-to-right order. |
| `dataColumns` | no | `array<ref:ChartDataColumn>` | Per-column metadata describing the role and position of each column in the workbook source. |
| `helperColumns` | no | `array<string>` | Optional auxiliary column names used by calculated or banded charts (e.g., 'Excellent', 'Good', 'Fair', 'Poor' for a bullet chart). |
| `sampleData` | no | `ref:ChartSampleData` | Inline sample dataset for previews and pickers. |
| `slideNumber` | no | `integer` | Source slide number in the original chart-gallery deck. Carried for traceability. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available. |

### Nested Types

#### ChartTypeDeprecation

- Type: `object`
- Required fields: `replacedBy`

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `replacedBy` | yes | `string` | Id of the non-deprecated chart type that documents should reference instead. |
| `reason` | no | `string` | Why the record is deprecated. |
| `removal` | no | `string` | Package version in which the record is scheduled for removal from the bundled catalog. |

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

#### ChartDataColumn

- Type: `object`
- Required fields: `name`, `role`, `type`
- Purpose: One column of the embedded chart workbook, annotated with its role and grid position.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `name` | yes | `string` | Column header name (e.g. 'Series 1', 'Value', 'Level1', 'Level2'). |
| `role` | yes | `enum:categoryLabel \| series \| helper` | Role this column plays: a category label (axis tick), a series (plotted values), or a helper (calculated/auxiliary). |
| `type` | yes | `enum:string \| number` | Cell value type for the column. |
| `position` | no | `string` | Grid position of the column header in the source workbook, as 'row<N>_col<M>' (zero-indexed). |

#### ChartSampleData

- Type: `object`
- Required fields: `headers`, `rows`
- Purpose: Inline sample dataset for previews. Mirrors a small workbook with header row plus data rows.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `headers` | yes | `array<string>` | Header row labels. The first cell typically labels the series column; the rest are category labels. |
| `rows` | yes | `array<array<string \| number>>` | Two-dimensional sample data. Each row aligns by index with the headers first cell is the row label, remaining cells are values. |

## Color Scheme

- File: `spec/schemas/color-scheme.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-color-scheme/v1`
- Type: `object`
- Required fields: `$schema`, `id`, `name`
- Purpose: Schema for color-scheme records in the pptx.gallery library. Each scheme is a named palette with the twelve PowerPoint color slots (six accents, two darks, two lights, plus hyperlink and followed-hyperlink), suitable for being mapped directly into OOXML theme XML. Color schemes are referenced from OPF documents via design.colorScheme or design.colorScheme.id; the engine resolves the reference against catalogs.colorSchemes (inline) -> catalogs.colorSchemes.source -> the default catalog at http...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-color-scheme/v1"` | Identifies this record as a color scheme in the openpresentation.org catalog. |
| `id` | yes | `string` | Stable slug used by OPF documents to reference this color scheme. Lowercase kebab-case. |
| `name` | yes | `string` | Human-readable scheme name shown in pickers. |
| `summary` | no | `string` | One-sentence positioning of the palette what mood it evokes and where to use it. |
| `description` | no | `string` | Longer prose describing the palette and its intended use. |
| `accent1` | no | `string` | Accent 1 color (hex). Mirrors the OOXML accent1 slot. |
| `accent2` | no | `string` | Accent 2 color (hex). Mirrors the OOXML accent2 slot. |
| `accent3` | no | `string` | Accent 3 color (hex). Mirrors the OOXML accent3 slot. |
| `accent4` | no | `string` | Accent 4 color (hex). Mirrors the OOXML accent4 slot. |
| `accent5` | no | `string` | Accent 5 color (hex). Mirrors the OOXML accent5 slot. |
| `accent6` | no | `string` | Accent 6 color (hex). Mirrors the OOXML accent6 slot. |
| `dark1` | no | `string` | Dark 1 color (hex). Typically the deepest neutral; OOXML dark1. |
| `dark2` | no | `string` | Dark 2 color (hex). Secondary dark; OOXML dark2. |
| `light1` | no | `string` | Light 1 color (hex). Typically the slide canvas; OOXML lt1. |
| `light2` | no | `string` | Light 2 color (hex). Secondary light surface; OOXML lt2. |
| `hyperlink` | no | `string` | Hyperlink color (hex). OOXML hlink. |
| `followedHyperlink` | no | `string` | Followed-hyperlink color (hex). OOXML folHlink. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available. |

## Font Scheme

- File: `spec/schemas/font-scheme.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-font-scheme/v1`
- Type: `object`
- Required fields: `$schema`, `id`, `name`, `major`, `minor`
- Purpose: Schema for font-scheme records in the pptx.gallery library. Each scheme pairs a major (heading) and minor (body) font family in the OOXML majorFont/minorFont sense, scoped to a target app (PowerPoint or Google Slides) and a language family (Latin, East Asian, or Complex Script). Font schemes are referenced from OPF documents via design.fontScheme or design.fontScheme.id; the engine resolves the reference against catalogs.fontSchemes (inline) catalogs.fontSchemes.source the default catalog at...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-font-scheme/v1"` | Identifies this record as a font scheme in the openpresentation.org catalog. |
| `id` | yes | `string` | Stable slug used by OPF documents to reference this font scheme. Lowercase kebab-case. |
| `name` | yes | `string` | Human-readable scheme name shown in pickers. |
| `major` | yes | `string` | Heading (major) font family mirrors the OOXML majorFont entry. |
| `minor` | yes | `string` | Body (minor) font family mirrors the OOXML minorFont entry. |
| `code` | no | `object` | Optional monospaced font for code blocks and inline code. It has the same shape as the OPF FontScheme 'code' role, so a record and an inline design.fontScheme override are interchangeable. OOXML has no code slot, so e... |
| `eastAsian` | no | `object` | East Asian script fonts. Maps to the OOXML a:ea element of majorFont (major) and minorFont (minor), and to run-level a:ea. When set, they fill the eastAsian slot for every language; when omitted, the slot comes from t... |
| `complexScript` | no | `object` | Complex-script fonts (for example Arabic, Hebrew, Indic and Thai). Maps to the OOXML a:cs element of majorFont (major) and minorFont (minor), and to run-level a:cs. When set, they fill the complexScript slot for every... |
| `type` | no | `enum:sans-serif \| serif \| monospace` | High-level typographic class of the scheme. |
| `app` | no | `enum:PowerPoint \| Google Slides` | Target application this font pairing is intended for. |
| `languageFamily` | no | `enum:latin \| ea \| cs` | OOXML font-language family this scheme is intended for: 'latin' for Latin-script content, 'ea' for East Asian scripts, 'cs' for Complex Scripts. As the design font scheme, an 'ea' or 'cs' scheme also fills that script... |
| `languages` | no | `array<string>` | Optional list of human-readable language names this scheme is curated for. Useful for picker UIs that group fonts by language coverage. |
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
- Purpose: Schema for language records in the pptx.gallery library. Each record names a presentation language, carries a BCP-47 language tag, and pairs it with sensible default font schemes for PowerPoint and Google Slides output. Languages are referenced from OPF documents via language; the engine resolves the reference against catalogs.languages (inline) catalogs.languages.source the default catalog at https://www.pptx.gallery/languages. The presentation language field also accepts BCP-47 tags directl...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-language/v1"` | Identifies this record as a language in the openpresentation.org catalog. |
| `id` | yes | `string` | Stable slug used by OPF documents to reference this language via language. Lowercase kebab-case. |
| `name` | yes | `string` | Human-readable language name. |
| `code` | no | `string` | ISO 639-3 (or 639-2) three-letter language code. Carried for engines that prefer ISO codes. |
| `bcp47` | yes | `string` | BCP-47 language tag for this record. Use 'en-GB' for UK English; 'en-UK' is not a valid BCP-47 region form. |
| `ooxmlLang` | no | `string` | Curated culture tag for OOXML text-run language attributes (a:rPr/@lang, a:endParaRPr/@lang), in the language-[Script-]REGION form Office recognizes (e.g. 'ja-JP', 'ar-SA', 'ms-MY', 'nb-NO', 'fil-PH', 'zh-CN'). Engine... |
| `direction` | no | `enum:ltr \| rtl` | Base text direction for the language. When omitted, engines derive it from the script: Arabic (Arab), Hebrew (Hebr), Syriac (Syrc), Thaana (Thaa), N'Ko (Nkoo), Adlam (Adlm), Samaritan (Samr), Mandaic (Mand) and Hanifi... |
| `script` | no | `string` | ISO 15924 script code of the language's writing system. The script selects the OOXML font slot the language's text uses: East Asian scripts (Hans, Hant, Hani, Jpan, Kore, Hang, Hira, Kana, Bopo, Yiii) use the eastAsia... |
| `fontScheme` | no | `string` | Default font-scheme id for this language when targeting PowerPoint output. Resolves against catalogs.fontSchemes the same way design.fontScheme or design.fontScheme.id does. Its major/minor families fill the language'... |
| `googleFontScheme` | no | `string` | Default font-scheme id for this language when targeting Google Slides output. Resolves against catalogs.fontSchemes the same way design.fontScheme or design.fontScheme.id does. Used in place of 'fontScheme' when resol... |
| `summary` | no | `string` | One-sentence note about coverage or font defaults. |
| `description` | no | `string` | Longer prose describing the language record and any font-pairing rationale. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available. |

## Layout Preview Index

- File: `spec/schemas/layout-preview-index.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-layout-preview-index/v1`
- Type: `object`
- Required fields: `$schema`, `version`, `description`, `records`
- Purpose: Shape of `spec/previews/layouts/index.json`, the manifest for the vendored slide-archetype preview gallery under `spec/previews/layouts/`. Each record names a preview id, its self-contained HTML file, and the file's exact UTF-8 byte length. These preview ids are an archetype taxonomy (e.g. 'swot-analysis', 'org-chart') distinct from the structural layout catalog at spec/catalogs/layouts/ (e.g. 'title', 'chart-2x') see spec/README.md. This schema describes a repo-internal index file, not an OP...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-layout-preview-index/v1"` |  |
| `version` | yes | `string` | Index format version, as a string. |
| `description` | yes | `string` | Human-readable description of the preview gallery and its rendering conventions. |
| `records` | yes | `array<ref:PreviewRecord>` | One entry per vendored preview HTML file. |

### Nested Types

#### PreviewRecord

- Type: `object`
- Required fields: `id`, `file`, `bytes`
- Purpose: Summary of one vendored preview HTML file.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | yes | `string` | Slide-archetype preview id (e.g. 'swot-analysis', 'agenda', 'org-chart'). Does not correspond to a spec/catalogs/layouts/ record id. |
| `file` | yes | `string` | HTML filename, relative to this index file's directory. |
| `bytes` | yes | `integer` | Exact UTF-8 byte length of the referenced HTML file's contents. |

## Slide Layout

- File: `spec/schemas/layout.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-layout/v1`
- Type: `object`
- Required fields: `$schema`, `id`, `name`
- Purpose: Schema for slide-layout records in the pptx.gallery library. Each record describes a semantic slide layout what regions it exposes and what content kinds those regions are intended to hold. Layouts are referenced from OPF documents via Slide.layout; the engine resolves the reference against catalogs.layouts (inline) catalogs.layouts.source the default catalog at https://www.pptx.gallery/layouts. Free-form custom layout names that don't resolve through any catalog fall through to engine-define...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-layout/v1"` | Identifies this record as a slide layout in the openpresentation.org catalog. |
| `id` | yes | `string` | Stable slug used by OPF documents to reference this layout via Slide.layout. Lowercase kebab-case. |
| `name` | yes | `string` | Human-readable layout name shown in layout pickers. |
| `summary` | no | `string` | One-sentence positioning of the layout when to reach for it. |
| `description` | no | `string` | Longer prose describing the layout structure and ideal use cases. |
| `contentType` | no | `enum:Title \| Text \| List \| Image \| Number \| Metric \| Chart \| Table \| Code \| Video \| Quote \| Timeline` | Primary kind of content the layout holds. Drives pickers and AI placement decisions. Metric is the canonical numeric/KPI category; Number remains an accepted legacy label. |
| `contentMultiple` | no | `enum:None \| 1x \| 2x \| 3x \| 4x \| 5x \| 6x` | How many parallel content blocks the layout exposes ('2x' = two-column, '3x' = three-up, etc.). |
| `contentAlignment` | no | `enum:None \| Left \| Center` | Default horizontal alignment of the content area. |
| `contentBox` | no | `boolean` | Whether the content area is rendered inside a visible box / card. |
| `contentTypeChartPrimary` | no | `enum:None \| Top \| Bottom \| Left \| Right` | For chart layouts, where the primary chart sits relative to the rest of the content. |
| `contentTypeImageFill` | no | `enum:None \| Crop \| Fit` | For image layouts, how the image fills its slot. |
| `contentTypeListBullet` | no | `enum:None \| Character \| Image` | For list layouts, how bullets are rendered. |
| `contentTypeListHeading` | no | `boolean` | For list layouts, whether each list item carries a heading. |
| `slideTag` | no | `boolean` | Whether the layout includes a small slide-level tag / label region above or near the title. |
| `slideTitle` | no | `boolean` | Whether the layout includes a slide title region. |
| `slideSubtitle` | no | `boolean` | Whether the layout includes a slide-level subtitle or supporting-description region. When placeholders is present, this is true exactly when the layout exposes a placeholder with type 'subtitle'. |
| `slideTitleAlignment` | no | `enum:None \| Left \| Center` | Horizontal alignment of the slide title region. |
| `slideImage` | no | `boolean` | Whether the layout includes a dedicated slide-level image region (separate from any content image). |
| `slideImageAlignment` | no | `enum:None \| Top \| Bottom \| Left \| Right \| Background` | Where the slide-level image sits relative to the content. |
| `slideLayoutDirection` | no | `enum:None \| Horizontal \| Vertical` | Axis along which the layout's primary regions are arranged. |
| `placeholders` | no | `array<ref:Placeholder>` | Ordered regions the layout exposes. The engine fills 'title', 'subtitle', and 'tag' placeholders from Slide.title, Slide.subtitle, and Slide.tag. Other placeholders are content-kind hints for renderers and pickers. Sl... |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available. |
| `composition` | no | `ref:Composition` |  |

### Nested Types

#### Placeholder

- Type: `object`
- Required fields: `type`
- Purpose: A single region inside a slide layout. Title, subtitle, and tag placeholders bind to the corresponding Slide fields; other placeholders describe the intended content kind for that region. The array order in the surrounding 'placeholders' field preserves layout region order.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | yes | `enum:title \| subtitle \| tag \| text \| metric \| quote \| timeline \| list \| chart \| picture \| table \| media \| diagram \| code` | OPF placeholder kind. 'text' and 'list' are flexible textual content regions. 'metric' is a numeric/KPI content region filled by a metric payload, including its optional label, description, unit, delta, and trend. The... |

#### Composition

- Type: `object`
- Required fields: none
- Purpose: Portable dynamic composition. Slide fields override the resolved layout. Nested groups arrange their children independently, inheriting only minFontSize and overflow. Explicit promoted regions retain their positions.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `mode` | no | `enum:auto \| grid \| row \| column` | auto chooses a grid from available space and content; grid uses columns; row and column use one horizontal or vertical track. |
| `columns` | no | `integer` | Column count for grid. In auto mode this caps the number of columns. |
| `gap` | no | `number` | Space between cells as a fraction of the container short edge (canvas at slide root). Default 0.03333333333333333. |
| `padding` | no | `number` | Inset as a fraction of the container short edge. Default 0.08 on a slide, 0 inside a group. |
| `weights` | no | `array<number>` | Relative track sizes: columns for row/grid/auto, rows for column. Omitted tracks have weight 1; extra weights are ignored. |
| `minFontSize` | no | `number` | Minimum readable text size in reference pixels at a 720-pixel canvas short edge. Default 16. Overflow is diagnosed when text cannot fit at this size. |
| `overflow` | no | `enum:warn \| error` | warn returns diagnostics for content that does not fit; error rejects layout. Content is never silently removed. Default warn. |

## Narrative Template

- File: `spec/schemas/narrative.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-narrative/v1`
- Type: `object`
- Required fields: `$schema`, `id`, `name`, `beats`
- Purpose: Schema for narrative template files in the openpresentation.org catalog. Each template describes a named story arc (e.g. 'problem-solution', 'scqa') as an ordered list of beats. Templates are referenced from OPF documents via narrative either as a bare id string (e.g. 'classic-story') or as an inline object whose shape matches this schema (sans '$schema').

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-narrative/v1"` |  |
| `id` | yes | `string` | Stable slug used by OPF documents to reference this template, e.g. 'problem-solution'. Lowercase kebab-case. |
| `name` | yes | `string` | Human-readable template name, e.g. 'Problem Solution'. |
| `summary` | no | `string` | One-sentence description of when and why to use this narrative. |
| `description` | no | `string` | Longer prose describing the narrative arc and ideal use cases. Used by AI-driven generation to seed deck-level direction. |
| `audienceFit` | no | `array<string>` | Audiences this narrative works well for, e.g. ['executives', 'investors', 'customers']. |
| `durationRange` | no | `object` | Typical talk-length window this narrative suits. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search, e.g. ['business', 'pitch', 'internal']. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available. |
| `beats` | yes | `array<ref:Beat>` | Ordered list of beats that make up the narrative arc. |

### Nested Types

#### Beat

- Type: `object`
- Required fields: `id`, `name`
- Purpose: A single narrative beat a labeled segment of the story arc with a specific dramatic purpose. Mirrors the NarrativeBeat definition in opf.schema.json so library entries and inline OPF beats are interchangeable.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | yes | `string` | Stable slug used by Slide.beat to reference this beat. Lowercase kebab-case. |
| `name` | yes | `string` | Human-readable beat name, e.g. 'The Problem'. |
| `description` | no | `string` | Curator-written prose that explains what this beat should accomplish. |
| `instructions` | no | `string` | Short author-facing instruction for the beat typically one phrase. Complements 'description' with a concise directive. |
| `slideCount` | no | `integer` | Optional explicit slide count for this beat. Defaults to 1 when omitted; values >1 are reserved for beats that intentionally span multiple slides. Prefer decomposing a heavy beat into multiple beats over setting a hig... |
| `slideType` | no | `enum:text \| list \| image \| shape \| chart \| table \| video \| code \| metric \| quote \| timeline` | Default content kind for the beat's slide. Uses ContentPayload.type names to help engines choose a layout. The legacy shape value is retained for compatibility and requests an image representation; it is not a native... |
| `layoutHint` | no | `string` | Suggested layout id for the beat's opening slide, e.g. 'section-divider', 'title-slide', 'text-left'. Resolves the same way as Slide.layout against catalogs.layouts and the default catalog at https://www.pptx.gallery/... |
| `thoughtCues` | no | `array<string>` | Optional speaker or thinking cues attached to the beat. Surfaced in presenter notes. |

## Purpose

- File: `spec/schemas/purpose.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-purpose/v1`
- Type: `object`
- Required fields: `$schema`, `id`, `name`
- Purpose: Schema for purpose records in the pptx.gallery library. Each record names a presentation objective such as informing, aligning, persuading, driving a decision, or selling. Purposes are referenced from OPF documents via purpose; the engine resolves the reference against catalogs.purposes (inline) catalogs.purposes.source the default catalog at https://www.pptx.gallery/purposes. The purpose field also accepts free-form strings and inline Purpose objects.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-purpose/v1"` | Identifies this record as a purpose in the openpresentation.org catalog. |
| `id` | yes | `string` | Stable slug used by OPF documents to reference this purpose via purpose. Lowercase kebab-case. |
| `name` | yes | `string` | Human-readable purpose name shown in pickers. |
| `summary` | no | `string` | One-sentence positioning of the purpose what this deck is trying to accomplish. |
| `description` | no | `string` | Longer prose describing when to use this purpose and how it should shape a deck. |
| `outcome` | no | `string` | Desired audience outcome after the presentation. |
| `successCriteria` | no | `array<string>` | Observable signals that the deck accomplished this purpose. |
| `recommendedNarratives` | no | `array<string>` | Soft cross-link: narrative-catalog ids that work well for this purpose. |
| `recommendedTones` | no | `array<string>` | Soft cross-link: tone-catalog ids that work well for this purpose. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional. |

## Social Platform

- File: `spec/schemas/social-platform.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-social-platform/v1`
- Type: `object`
- Required fields: `$schema`, `id`, `name`
- Purpose: Schema for social-platform records in the pptx.gallery library. Each record describes a single social-media platform its base URL, profile-URL pattern, handle prefix, brand color, and themed icons. Records are referenced from OPF documents indirectly: the property keys of any Socials object (Organization.socials, Speaker.socials) match record ids, and renderers use the catalog record to format URLs and pick icons. The engine resolves references against catalogs.socialPlatforms (inline) catalo...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-social-platform/v1"` | Identifies this record as a social-platform entry in the openpresentation.org catalog. |
| `id` | yes | `string` | Stable slug used by OPF documents to reference this platform appears as a property key on Socials objects. Lowercase kebab-case. |
| `name` | yes | `string` | Human-readable platform name shown in pickers and footers. |
| `summary` | no | `string` | One-sentence positioning of the platform what it's used for and who's on it. |
| `description` | no | `string` | Longer prose describing the platform and any rendering conventions (e.g., handle prefixes, distributed instances). |
| `baseUrl` | no | `string` | Canonical base URL of the platform used as the prefix when normalizing handles to full URLs. |
| `profileUrlPattern` | no | `string` | URL pattern for individual member profiles. Use '{handle}' as the placeholder for the handle (with the prefix already stripped). |
| `companyUrlPattern` | no | `string` | Optional URL pattern for organization / company pages, when the platform distinguishes them from member profiles. Use '{handle}' as the placeholder. |
| `handlePrefix` | no | `string` | Conventional prefix character displayed before the handle (e.g. '@' for X / Mastodon / Threads / TikTok). Empty string when no prefix is used. Renderers strip it before substituting into URL patterns. |
| `handleExample` | no | `string` | Example handle in its conventional rendered form, used by picker UIs and validation hints. |
| `brandColor` | no | `string` | Brand color (hex) used for branded icon chips, link styling, or section accents. |
| `icon` | no | `string` | Default icon source. Accepts an HTTPS URL, data URI, relative path, or asset reference. Used as the fallback when a themed (Light/Dark) variant isn't set. |
| `iconLight` | no | `string` | Light-colored icon variant intended for rendering on dark backgrounds. |
| `iconDark` | no | `string` | Dark-colored icon variant intended for rendering on light backgrounds. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available. |

## Theme

- File: `spec/schemas/theme.schema.json`
- Schema id: `https://openpresentation.org/schema/opf-theme/v1`
- Type: `object`
- Required fields: `$schema`, `id`, `name`
- Purpose: Schema for theme records in the pptx.gallery library. Each theme is a small, named bundle that pairs a color scheme, a font scheme, a default theme-controlled background, and a slide size. Themes are referenced from OPF documents via design.theme or design.theme.id; the engine resolves the reference against catalogs.themes (inline) catalogs.themes.source the default catalog at https://www.pptx.gallery/themes. Inline overrides on design.colorScheme / design.fontScheme / design.background / des...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-theme/v1"` | Identifies this record as a theme in the openpresentation.org catalog. |
| `id` | yes | `string` | Stable slug used by OPF documents to reference this theme via design.theme. Lowercase kebab-case. |
| `name` | yes | `string` | Human-readable theme name shown in pickers. |
| `summary` | no | `string` | One-sentence positioning of the theme when to reach for it. |
| `description` | no | `string` | Longer prose describing what the theme looks and feels like and the kinds of decks it suits. |
| `colorScheme` | no | `string` | Catalog reference to the theme's default color scheme resolved against catalogs.colorSchemes the same way design.colorScheme or design.colorScheme.id is. Accepts a bare id, HTTPS URL, or 'pkg:' reference. |
| `fontScheme` | no | `string` | Catalog reference to the theme's default font scheme resolved against catalogs.fontSchemes the same way design.fontScheme or design.fontScheme.id is. Accepts a bare id, HTTPS URL, or 'pkg:' reference. |
| `background` | no | `ref:ThemeBackground` |  |
| `dimensions` | no | `enum:16:9 \| 4:3 \| 16:10 \| letter \| a4 \| widescreen \| standard` | Default slide size for this theme. Accepts the same preset values as design.dimensions.preset. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available. |

### Nested Types

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
- Purpose: Schema for tone records in the pptx.gallery library. Each record names a presentation tone (e.g. 'formal', 'casual', 'inspirational') and carries voice cues, anti-patterns, and sample phrases that AI-driven generation uses to shape output. Tones are referenced from OPF documents via tone; the engine resolves the reference against catalogs.tones (inline) catalogs.tones.source the default catalog at https://www.pptx.gallery/tones.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | yes | `const:"https://openpresentation.org/schema/opf-tone/v1"` | Identifies this record as a tone in the openpresentation.org catalog. |
| `id` | yes | `string` | Stable slug used by OPF documents to reference this tone via tone. Lowercase kebab-case. |
| `name` | yes | `string` | Human-readable tone name shown in pickers. |
| `summary` | no | `string` | One-sentence positioning of the tone when to reach for it. |
| `description` | no | `string` | Longer prose describing the tone and the kinds of decks it suits. |
| `voiceCues` | no | `array<string>` | Short directives that shape AI generation toward this tone. Phrased as imperatives, e.g. 'use second-person', 'favor short sentences', 'lead with the recommendation'. |
| `avoid` | no | `array<string>` | Anti-patterns that AI generation should not produce when this tone is active. |
| `samplePhrases` | no | `array<string>` | Short example phrases that exemplify this tone. Used by picker UIs and as few-shot examples for AI generation. |
| `recommendedNarratives` | no | `array<string>` | Soft cross-link: narrative-catalog ids this tone pairs well with. Used by picker UIs to suggest narratives once a tone is chosen. Validators warn on unknown ids; never error. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional. |
