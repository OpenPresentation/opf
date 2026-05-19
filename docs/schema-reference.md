# OPF Presentation Schema Reference

This reference documents the author-facing shape of a complete `*.opf.json` presentation document. It summarizes the canonical schema in `spec/schemas/opf.schema.json`; the schema remains the source of truth for validators.

## Document Contract

- Schema id: `https://openpresentation.org/schema/opf/v1`
- Required top-level fields: `slides`
- Additional top-level fields: not allowed

## Top-Level Fields

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `$schema` | no | `const:"https://openpresentation.org/schema/opf/v1"` | Optional OPF schema version. When omitted, validators and engines should assume the latest supported OPF schema. |
| `name` | no | `string` | Display name of the presentation for GUI/TUI lists, library/search indexing, OS-level metadata, and default export filenames. This is deck identity, not slide content. Use slides[].title and slides[].subtitle for text... |
| `description` | no | `string` | Free-form prose describing what this presentation is about. Used by agents and humans as a deck-level summary; complements purpose (the goal) and narrative (the structured storyline). Round-trips to OOXML 'docProps/co... |
| `filename` | no | `string` | Optional base filename for exports (without extension). Engine strips a trailing .pptx, .pdf, .png, or .svg (case-insensitive) and appends the target format's extension. When omitted, the engine slugifies name when pr... |
| `organization` | no | `oneOf:ref:Organization / array<ref:Organization>` | Organization associated with the presentation, usually the presenting company. Array form supports hosts, partners, clients, and sponsors. The primary organization (declared via Organization.role or, if no role is set... |
| `speaker` | no | `oneOf:ref:Speaker / array<ref:Speaker>` | Person presenting the deck. Array form supports panels and multi-speaker decks. Used for cover slides, bio slides, footers, and panel attribution. |
| `author` | no | `oneOf:string / array<string>` | Optional credit for the person who authored or contributed to the deck, distinct from speaker. Array form supports multiple contributors. Round-trips to OOXML 'docProps/core.xml' as '<dc:creator>' (semicolon-joined wh... |
| `audience` | no | `oneOf:string / array<oneOf:string / ref:Audience>` | Intended audiences for the presentation. Accepts either: - A single string shorthand: free-form description ('Series B investors'), an audiences catalog id ('executives'), an HTTPS URL, or a 'pkg:' reference. - An arr... |
| `purpose` | no | `oneOf:string / ref:Purpose` | Primary goal of the presentation. Accepts either: - A string shorthand: free-form goal ('Raise a Series B round of $30M'), a purposes catalog id ('decide', 'align'), an HTTPS URL, or a 'pkg:' reference. - An inline Pu... |
| `language` | no | `oneOf:string / ref:Language` | Language for the presentation content. Accepts either: - A string shorthand: a BCP-47 language tag ('en-US', 'en-GB', 'ja-JP', 'fr'), a languages catalog id ('english', 'japanese'), an HTTPS URL, or a 'pkg:' reference... |
| `tone` | no | `oneOf:string / ref:Tone` | Desired tone for the presentation. Accepts either: - A string shorthand: a tones catalog id ('formal'), an HTTPS URL, or a 'pkg:' reference. - An inline Tone object for custom tone metadata or catalog-backed overrides... |
| `takeaway` | no | `oneOf:string / array<string>` | Audience-facing takeaway the presentation should leave behind. Array form supports multiple takeaways. Deck-level intent used by AI to seed and pressure-test slide content. |
| `duration` | no | `integer` | Target presentation duration, as an integer number of minutes. Used by AI to set pace and depth, and to compare against the resolved narrative's durationRange. |
| `tags` | no | `array<string>` | Free-form labels used for categorization, search, and filtering. Lowercase kebab-case is recommended for consistency across a deck library. |
| `design` | no | `ref:Design` | Optional design system covering theme, color scheme, font scheme, dimensions, background, logo, watermark, header, and footer applied to the deck. When omitted, engines use their default design configuration. |
| `narrative` | no | `oneOf:string / ref:Narrative` | Structured storyline describing the deck's arc and beats. Resolves to the 'id' of a 'narratives' catalog record. Accepts two forms: - String shorthand for the common case: 'narrative = "classic-story"'. Accepts a bare... |
| `slides` | yes | `array<ref:Slide>` | Ordered array of slides that make up the presentation. |
| `assets` | no | `ref:Assets` | Optional reusable asset registry for images, data files, videos, documents, fonts, and other resources referenced elsewhere in the deck via 'asset:<id>' strings. |
| `catalogs` | no | `ref:Catalogs` | Optional per-kind catalog overrides. Each kind may declare a non-default 'source' and/or inline 'records' that override or supplement the default catalog at https://www.pptx.gallery/<kind>. References elsewhere in the... |
| `extensions` | no | `object` | Custom data passthrough for agent workflows; ignored by the engine but preserved across read/write round-trips. |

## Object And Type Reference

### Assets

- Type: `object`
- Required fields: none
- Purpose: Reusable asset registry for resources used by slides, charts, metadata, and design. Keys are stable asset ids referenced elsewhere as 'asset:<id>'. Each asset can be a source string or an object with src plus optional metadata.

_No named properties._


### Asset

- Type: `oneOf:string / object`
- Required fields: none
- Purpose: Reusable or inline resource. A string is shorthand for { "src": value }. Source strings accept 'asset:<id>' references, HTTPS URLs, data URIs, relative paths resolved against the OPF file location, or local filesystem paths. Use object form when metadata such as alt text, title, mediaType, or format matters.

_No named properties._


### Audience

- Type: `anyOf:schema / schema`
- Required fields: none
- Purpose: Inline audience metadata for the presentation. Use 'id' to reference an audiences catalog record and override selected fields, or use 'name' for a custom inline audience.
- Conditional requirement: `id` or `name`

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | no | `string` | Optional audiences catalog id to resolve before applying inline overrides. |
| `name` | no | `string` | Human-readable audience name shown in pickers. |
| `summary` | no | `string` | One-sentence positioning of the audience. |
| `description` | no | `string` | Longer prose describing the audience and how to address them. |
| `seniority` | no | `enum:ic \| manager \| director \| vp \| c-suite \| mixed` | Typical seniority level of the audience. |
| `technicalFluency` | no | `enum:low \| medium \| high \| mixed` | Typical technical fluency of the audience. |
| `decisionPower` | no | `enum:informational \| advisory \| decision-maker` | Whether the audience is expected to be informed, advise, or decide. |
| `attentionBudgetMinutes` | no | `number` | Realistic upper bound on focused attention for a single presentation, in minutes. |
| `recommendedNarratives` | no | `array<string>` | Soft cross-link: narrative-catalog ids that work well for this audience. |
| `recommendedTones` | no | `array<string>` | Soft cross-link: tone-catalog ids that work well for this audience. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |


### Purpose

- Type: `anyOf:schema / schema`
- Required fields: none
- Purpose: Inline purpose metadata for the presentation. Use 'id' to reference a purposes catalog record and override selected fields, or use 'name' for a custom inline purpose.
- Conditional requirement: `id` or `name`

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | no | `string` | Optional purposes catalog id to resolve before applying inline overrides. |
| `name` | no | `string` | Human-readable purpose name shown in pickers. |
| `summary` | no | `string` | One-sentence positioning of the purpose. |
| `description` | no | `string` | Longer prose describing when to use this purpose and how it should shape a deck. |
| `outcome` | no | `string` | Desired audience outcome after the presentation. |
| `successCriteria` | no | `array<string>` | Observable signals that the deck accomplished this purpose. |
| `recommendedNarratives` | no | `array<string>` | Soft cross-link: narrative-catalog ids that work well for this purpose. |
| `recommendedTones` | no | `array<string>` | Soft cross-link: tone-catalog ids that work well for this purpose. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |


### Language

- Type: `anyOf:schema / schema`
- Required fields: none
- Purpose: Inline language metadata for the presentation. Use 'id' to reference a languages catalog record and override selected fields, or use 'bcp47' for a custom language tag without a catalog record.
- Conditional requirement: `id` or `bcp47`

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | no | `string` | Optional languages catalog id to resolve before applying inline overrides. |
| `name` | no | `string` | Human-readable language name. |
| `bcp47` | no | `string` | BCP-47 language tag used for locale-aware rendering, proofing, and accessibility metadata. Use 'en-GB' for UK English; 'en-UK' is not a valid BCP-47 region form. |
| `code` | no | `string` | ISO 639-3 or 639-2 language code carried for engines that prefer ISO codes. |
| `direction` | no | `enum:ltr \| rtl` | Base text direction for the language. |
| `script` | no | `string` | ISO 15924 script code when the writing system should be explicit. |
| `fontScheme` | no | `string` | Default font-scheme id for this language when targeting PowerPoint output. |
| `googleFontScheme` | no | `string` | Default font-scheme id for this language when targeting Google Slides output. |
| `summary` | no | `string` | One-sentence note about coverage or font defaults. |
| `description` | no | `string` | Longer prose describing the language record and any font-pairing rationale. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |


### Tone

- Type: `anyOf:schema / schema`
- Required fields: none
- Purpose: Inline tone metadata for the presentation. Use 'id' to reference a tones catalog record and override selected fields, or use 'name' for a custom inline tone.
- Conditional requirement: `id` or `name`

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | no | `string` | Optional tones catalog id to resolve before applying inline overrides. |
| `name` | no | `string` | Human-readable tone name shown in pickers. |
| `summary` | no | `string` | One-sentence positioning of the tone. |
| `description` | no | `string` | Longer prose describing the tone and the kinds of decks it suits. |
| `voiceCues` | no | `array<string>` | Short directives that shape AI generation toward this tone. |
| `avoid` | no | `array<string>` | Anti-patterns that AI generation should not produce when this tone is active. |
| `samplePhrases` | no | `array<string>` | Short example phrases that exemplify this tone. |
| `recommendedNarratives` | no | `array<string>` | Soft cross-link: narrative-catalog ids this tone pairs well with. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |


### Organization

- Type: `object`
- Required fields: `id`, `name`
- Purpose: An organization associated with the presentation typically the presenting company, but also hosts, partners, clients, or sponsors. Surfaced on cover slides, footers, and brand bars; the primary organization's logo is the default deck logo unless overridden by design.logo.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | yes | `string` | Stable identifier for the organization, used to reference it from Speaker.organizationId. Must be unique within the deck. |
| `name` | yes | `string` | Display name shown on slides. |
| `legalName` | no | `string` | Optional legal entity name when it differs from the display name. |
| `logo` | no | `ref:Asset` | Source for the organization's logo image. Accepts an HTTPS URL, data URI, relative path (resolved against the OPF file location), local path, or 'asset:<id>' reference. Common formats are SVG (preferred for vector log... |
| `domain` | no | `string` | Bare internet domain for the organization. Used for footers, contact slides, and engine-driven asset lookups (e.g., favicon-based brand defaults). |
| `email` | no | `string` | General contact email for the organization. Used on contact slides and footer attribution. |
| `phone` | no | `string` | Main contact phone number for the organization. E.164 format is recommended. |
| `tagline` | no | `string` | Short tagline rendered alongside the organization name on cover slides. |
| `role` | no | `enum:primary \| partner \| client \| sponsor \| host` | Role of the organization relative to the presentation. When omitted, the single organization or first organization in array form is treated as primary. |
| `socials` | no | `ref:Socials` | Optional social media handles or URLs for the organization. |


### Speaker

- Type: `object`
- Required fields: `id`, `name`
- Purpose: A person presenting the deck. Used for cover slides, bio/intro slides, footer attribution, and panel formats with multiple presenters.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | yes | `string` | Stable identifier for the speaker, used for cross-references within the deck. Must be unique within the deck. |
| `name` | yes | `string` | Display name. |
| `title` | no | `string` | Role or title. Often paired with the speaker's organization on cover slides. |
| `photo` | no | `ref:Asset` | Source for the speaker's headshot image. Accepts an HTTPS URL, data URI, relative path (resolved against the OPF file location), local path, or 'asset:<id>' reference. Common formats are JPG or PNG; SVG is not appropr... |
| `email` | no | `string` | Contact email, used on contact slides or footer attribution when appropriate. |
| `phone` | no | `string` | Contact phone number for the speaker. E.164 format is recommended. |
| `bio` | no | `string` | Short biographical paragraph for bio or 'about the speaker' slides. |
| `organizationId` | no | `string` | Reference to an Organization.id in organization. Lets a speaker be attributed to their org in panel or multi-org decks without repeating organization details. |
| `socials` | no | `ref:Socials` | Optional social media handles or URLs for the speaker. |


### Socials

- Type: `object`
- Required fields: none
- Purpose: Social media handles or URLs, keyed by platform id from the 'socialPlatforms' catalog. Each value is a string either a full URL or a platform handle (e.g., '@acme'). The catalog record for each platform carries the URL pattern, handle prefix, brand color, and themed icons used by renderers. Keys resolve to the 'id' of a 'socialPlatforms' catalog record. Resolution order: inline catalogs.socialPlatforms.records[] catalogs.socialPlatforms.source default catalog at https://www.pptx.gallery/socia...

_No named properties._


### Narrative

- Type: `object`
- Required fields: none
- Purpose: Structured storyline used by AI to shape generated content. Mirrors the OPF Narrative Template record at https://openpresentation.org/schema/opf-narrative/v1 (sans '$schema'), so a library record and an inline narrative are interchangeable. Narrative declares the deck's intended story arc; slides may opt into beats via Slide.beat. The narrative does not constrain slide structure validators warn on drift (orphan slides, unused beats) but never error. Slides are the source of truth; narrative i...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | no | `string` | Stable slug identifying this narrative. When it matches a record in the resolved 'narratives' catalog, the catalog record's beats and metadata seed this narrative; inline fields override per-key. When it doesn't match... |
| `name` | no | `string` | Human-readable narrative name. |
| `summary` | no | `string` | One-sentence description of when and why to use this narrative. |
| `description` | no | `string` | Longer prose describing the narrative arc and ideal use cases. Used by AI-driven generation to seed deck-level direction. |
| `audienceFit` | no | `array<string>` | Audiences this narrative works well for. Free-form strings or 'audiences' catalog ids. |
| `durationRange` | no | `object` | Typical talk-length window this narrative suits. Compared by validators against duration. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |
| `preview` | no | `object` | Visual previews of the narrative, used by picker UIs and inline rendering. All sub-fields are optional. |
| `beats` | no | `array<ref:NarrativeBeat>` | Ordered list of beats that make up the narrative arc. When 'id' matches a catalog record, beats here override or extend matching catalog beats by their own 'id'. Beat IDs must be unique within the narrative. |


### NarrativeBeat

- Type: `object`
- Required fields: `id`, `name`
- Purpose: A single narrative beat a labeled segment of the story arc with a specific dramatic purpose (e.g. 'hook', 'problem', 'evidence', 'ask'). Slides reference beats via Slide.beat. Beats may also carry slide-blueprint hints (slideType, layoutHint, thoughtCues, instructions) that guide the assigned slide. Mirrors the Beat definition in narrative.schema.json (https://openpresentation.org/schema/opf-narrative/v1) so library entries and inline OPF beats are interchangeable.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | yes | `string` | Stable slug used by Slide.beat to reference this beat. Lowercase kebab-case. |
| `name` | yes | `string` | Human-readable beat name. |
| `description` | no | `string` | Curator-written prose that explains what this beat should accomplish. |
| `instructions` | no | `string` | Short author-facing instruction for the beat typically one phrase. Complements 'description' with a concise directive. |
| `slideCount` | no | `integer` | Optional explicit slide count for this beat. Defaults to 1 when omitted; values >1 are reserved for beats that intentionally span multiple slides. Prefer decomposing a heavy beat into multiple beats over setting a hig... |
| `slideType` | no | `enum:text \| list \| image \| chart \| table \| video \| code \| metric \| quote \| timeline` | Default content kind for the beat's slide. Mirrors ContentPayload.type and helps engines choose a sensible layout when only the beat is specified. |
| `layoutHint` | no | `string` | Suggested layout id for the beat's opening slide. Resolves the same way as Slide.layout against catalogs.layouts and the default catalog at https://www.pptx.gallery/layouts. |
| `thoughtCues` | no | `array<string>` | Optional speaker or thinking cues attached to the beat. Surfaced in presenter notes. |


### Design

- Type: `object`
- Required fields: none
- Purpose: Visual design system applied to the presentation; individual slides may override fields via Slide.design.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `theme` | no | `oneOf:string / ref:Theme` | Theme for the deck. Accepts two forms: - String shorthand: 'design.theme = "minimal"'. Bare id, HTTPS URL, or 'pkg:' reference resolved as the 'id' of a 'themes' catalog record. - Object form: a Theme with an optional... |
| `colorScheme` | no | `oneOf:string / ref:ColorScheme` | Color scheme for the presentation. Accepts two forms: - String shorthand: 'design.colorScheme = "cool-horizon"'. Bare id, HTTPS URL, or 'pkg:' reference resolved as the 'id' of a 'colorSchemes' catalog record. - Objec... |
| `fontScheme` | no | `oneOf:string / ref:FontScheme` | Font scheme for heading, body, accent, and code text. Accepts two forms: - String shorthand: 'design.fontScheme = "aptos"'. Bare id, HTTPS URL, or 'pkg:' reference resolved as the 'id' of a 'fontSchemes' catalog recor... |
| `dimensions` | no | `oneOf:ref:DimensionPreset / ref:Dimensions` | Slide dimensions and aspect ratio. String shorthand such as 'widescreen' is equivalent to { preset: 'widescreen' }. |
| `background` | no | `oneOf:ref:BackgroundShortcut / ref:Background` | Default slide background applied across the deck unless overridden on a slide. String shorthand accepts theme slots ('light1', 'light2', 'dark1', 'dark2') or hex colors; object forms support theme, solid, gradient, im... |
| `logo` | no | `oneOf:ref:Asset / ref:LogoSet` | Deck logo assets used by layouts, covers, section dividers, headers, and footers. A string is the default logo source; object form provides light/dark, stacked, icon, and wordmark variants. When omitted, the renderer... |
| `watermark` | no | `oneOf:const:false / ref:Asset / ref:Watermark` | Optional decorative watermark applied across slides. Use false to suppress an inherited watermark in slide-level design; a string is equivalent to { src: value }. |
| `header` | no | `oneOf:const:false / ref:HeaderFooter` | Repeated header furniture rendered outside the main slide content. Use false to suppress an inherited header. |
| `footer` | no | `oneOf:const:false / ref:HeaderFooter` | Repeated footer furniture rendered outside the main slide content. Use false to suppress an inherited footer. |
| `titleAlignment` | no | `enum:left \| center \| right` | Default horizontal alignment for title placeholders in resolved layouts. |
| `contentAlignment` | no | `enum:left \| center \| right` | Default horizontal alignment for body/content regions in resolved layouts. |
| `contentBox` | no | `boolean` | Whether body/content regions are rendered inside a visible card or surface. |
| `slideImage` | no | `oneOf:ref:Asset / object` | Optional slide-level image treatment used by layouts that support a decorative or editorial image separate from content images. |
| `contentDirection` | no | `enum:horizontal \| vertical` | Axis along which parallel body/content regions are arranged. |
| `chartPrimary` | no | `enum:none \| top \| bottom \| left \| right` | For chart layouts, where the primary chart sits relative to supporting content. 'none' means chart regions have equal weight. |
| `imageFill` | no | `enum:crop \| fit` | How picture placeholders fill their allocated region. |
| `listBullet` | no | `enum:character \| image` | Default bullet rendering style for list layouts. |


### Theme

- Type: `object`
- Required fields: none
- Purpose: Theme bundle used by the design system. In design.theme, 'id' resolves a themes catalog record as the base; any sibling fields override the resolved theme. The string shorthand on design.theme is equivalent to setting only 'id'.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | no | `string` | Theme reference. Resolves to the 'id' of a 'themes' catalog record. Accepts a bare id (lowercase kebab-case, e.g. 'minimal'), an HTTPS URL pointing at a record file, or a 'pkg:' reference. Field overrides on the surro... |
| `name` | no | `string` | Human-readable theme name shown in pickers. |
| `summary` | no | `string` | One-sentence positioning of the theme - when to reach for it. |
| `description` | no | `string` | Longer prose describing what the theme looks and feels like and the kinds of decks it suits. |
| `colorScheme` | no | `oneOf:string / ref:ColorScheme` | Default color scheme for this theme. A string resolves against catalogs.colorSchemes; an object may provide an 'id' base reference plus overrides. |
| `fontScheme` | no | `oneOf:string / ref:FontScheme` | Default font scheme for this theme. A string resolves against catalogs.fontSchemes; an object may provide an 'id' base reference plus overrides. |
| `background` | no | `oneOf:ref:BackgroundShortcut / ref:Background` | Default background for this theme. String shorthand accepts theme slots ('light1', 'light2', 'dark1', 'dark2') or hex colors. |
| `dimensions` | no | `oneOf:ref:DimensionPreset / ref:Dimensions` | Default slide size for this theme. A string preset is equivalent to { preset: value }. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |


### ColorScheme

- Type: `object`
- Required fields: none
- Purpose: Color palette used by the design system. The slot fields (accent1-accent6, dark1, dark2, light1, light2, hyperlink, followedHyperlink) mirror color-scheme.schema.json (https://openpresentation.org/schema/opf-color-scheme/v1) so library records and inline OPF overrides are interchangeable on those fields. Two parallel models are supported and may be mixed: - OOXML slots - the 12-slot PowerPoint theme model that round-trips directly to OOXML. Use these for full control over the palette as Power...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | no | `string` | Color scheme reference. Resolves to the 'id' of a 'colorSchemes' catalog record. Accepts a bare id (lowercase kebab-case, e.g. 'cool-horizon'), an HTTPS URL pointing at a record file, or a 'pkg:' reference. Slot and r... |
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
| `primary` | no | `string` | Abstract role: primary brand color (hex). The engine maps this onto an OOXML accent slot when serializing. |
| `secondary` | no | `string` | Abstract role: secondary brand color (hex). |
| `accent` | no | `string` | Abstract role: accent color used for highlights and emphasis (hex). |
| `background` | no | `string` | Abstract role: default slide background color (hex). The engine maps this to one of light1 / light2 / dark1 / dark2 when serializing. |
| `surface` | no | `string` | Abstract role: color for elevated surfaces such as cards and panels (hex). |
| `text` | no | `string` | Abstract role: primary body text color (hex). |
| `textSecondary` | no | `string` | Abstract role: secondary or muted text color used for captions and supporting copy (hex). |
| `custom` | no | `object` | Map of custom named colors for advanced or theme-specific use. |


### FontScheme

- Type: `object`
- Required fields: none
- Purpose: Typography selections used by the design system. The pair fields (major, minor) and refinement fields (type, app, languageFamily) mirror font-scheme.schema.json (https://openpresentation.org/schema/opf-font-scheme/v1) so library records and inline OPF overrides are interchangeable on those fields. Two parallel models are supported and may be mixed: - OOXML pairs (major, minor) - heading and body family names that round-trip directly to PowerPoint majorFont/minorFont entries. - Abstract roles...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | no | `string` | Font scheme reference. Resolves to the 'id' of a 'fontSchemes' catalog record. Accepts a bare id (lowercase kebab-case, e.g. 'aptos'), an HTTPS URL pointing at a record file, or a 'pkg:' reference. Field overrides on... |
| `major` | no | `string` | Heading (major) font family mirrors the OOXML majorFont entry. Pairs with 'minor'. |
| `minor` | no | `string` | Body (minor) font family mirrors the OOXML minorFont entry. Pairs with 'major'. |
| `type` | no | `enum:sans-serif \| serif \| monospace` | High-level typographic class of the scheme. |
| `app` | no | `enum:PowerPoint \| Google Slides` | Target application this font pairing is intended for. |
| `languageFamily` | no | `enum:latin \| ea \| cs` | OOXML font-language family this scheme is intended for: 'latin' for Latin-script content, 'ea' for East Asian scripts, 'cs' for Complex Scripts. |
| `heading` | no | `ref:Font` | Abstract role: font used for slide titles and headings. Maps onto the OOXML major slot when serializing. |
| `body` | no | `ref:Font` | Abstract role: font used for body copy. Maps onto the OOXML minor slot when serializing. |
| `accent` | no | `ref:Font` | Abstract role: font used for accent text such as quotes or callouts. No direct OOXML slot. |
| `code` | no | `ref:Font` | Abstract role: monospaced font used for code blocks. No direct OOXML slot. |


### Font

- Type: `object`
- Required fields: `family`
- Purpose: Specification for a single font role.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `family` | yes | `string` | Font family name. |
| `weight` | no | `number` | Numeric font weight (e.g., 400 for regular, 700 for bold). |
| `style` | no | `enum:normal \| italic` | Font style. |
| `letterSpacing` | no | `number` | Letter spacing (tracking) in ems. |


### DimensionPreset

- Type: `enum:16:9 | 4:3 | 16:10 | letter | a4 | widescreen | standard`
- Required fields: none
- Purpose: Named dimension preset; chooses both aspect ratio and physical size. 'widescreen' is an alias for 16:9 in PowerPoint widescreen size; 'standard' is an alias for 4:3 in PowerPoint standard size.

_No named properties._


### Dimensions

- Type: `object`
- Required fields: none
- Purpose: Slide dimensions; either pick a preset or specify custom inches.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `preset` | no | `ref:DimensionPreset` |  |
| `widthInches` | no | `number` | Custom slide width in inches; overrides the preset width when provided. |
| `heightInches` | no | `number` | Custom slide height in inches; overrides the preset height when provided. |


### ThemeBackgroundSlot

- Type: `enum:light1 | light2 | dark1 | dark2`
- Required fields: none
- Purpose: PowerPoint theme-controlled slide background slot from the active color scheme. These are slots, not assumptions about actual colors: light1 is usually white and dark1 is usually black by convention, but the color scheme controls the real values.

_No named properties._


### HexColor

- Type: `string`
- Required fields: none
- Purpose: Hex color shorthand accepted by selected string fields.

_No named properties._


### BackgroundShortcut

- Type: `oneOf:ref:ThemeBackgroundSlot / ref:HexColor`
- Required fields: none
- Purpose: String shorthand for a background. Theme slots ('light1', 'light2', 'dark1', 'dark2') are equivalent to { type: 'theme', slot: value }; hex colors are equivalent to { type: 'solid', color: value }.

_No named properties._


### Background

- Type: `oneOf:ref:ThemeBackground / ref:SolidBackground / ref:GradientBackground / ref:ImageBackground / ref:PatternBackground`
- Required fields: none
- Purpose: Background fill applied to slides. Theme backgrounds preserve PowerPoint's color-scheme background choice; other variants represent fixed background fills.

_No named properties._


### ThemeBackground

- Type: `object`
- Required fields: `type`, `slot`
- Purpose: Theme-controlled PowerPoint slide background. The slot is resolved through the active color scheme and remains theme-aware.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | yes | `const:"theme"` | Theme-controlled background fill. |
| `slot` | yes | `ref:ThemeBackgroundSlot` |  |


### SolidBackground

- Type: `object`
- Required fields: `type`, `color`
- Purpose: Fixed solid slide background fill.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | yes | `const:"solid"` | Fixed solid background fill. |
| `color` | yes | `string` | Fixed solid fill color, usually a hex string. Use { type: 'theme', slot: ... } for PowerPoint's four theme-controlled background choices. |
| `opacity` | no | `number` | Background opacity from 0 (fully transparent) to 1 (fully opaque). |


### GradientBackground

- Type: `object`
- Required fields: `type`, `gradient`
- Purpose: Fixed gradient slide background fill.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | yes | `const:"gradient"` | Fixed gradient background fill. |
| `gradient` | yes | `object` | Gradient fill definition. |
| `opacity` | no | `number` | Background opacity from 0 (fully transparent) to 1 (fully opaque). |


### ImageBackground

- Type: `object`
- Required fields: `type`, `image`
- Purpose: Fixed image slide background fill.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | yes | `const:"image"` | Fixed image background fill. |
| `image` | yes | `object` | Image fill definition. |
| `opacity` | no | `number` | Background opacity from 0 (fully transparent) to 1 (fully opaque). |


### PatternBackground

- Type: `object`
- Required fields: `type`, `pattern`
- Purpose: Fixed pattern slide background fill.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | yes | `const:"pattern"` | Fixed pattern background fill. |
| `pattern` | yes | `object` | Pattern fill definition. |
| `opacity` | no | `number` | Background opacity from 0 (fully transparent) to 1 (fully opaque). |


### LogoSet

- Type: `object`
- Required fields: none
- Purpose: Deck logo variants surfaced by layouts, covers, section dividers, headers, and footers. Organization identity lives in organization; this object only controls visual rendering assets. Renderer convention: on dark backgrounds prefer the 'light' variant, on light backgrounds prefer the 'dark' variant, and in square/vertical slots prefer the stacked family when present.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `default` | no | `ref:Asset` | Default full-lockup logo. Used as fallback when no more specific variant is set. |
| `light` | no | `ref:Asset` | Light-colored full-lockup logo intended for rendering on dark backgrounds. |
| `dark` | no | `ref:Asset` | Dark-colored full-lockup logo intended for rendering on light backgrounds. |
| `stacked` | no | `ref:Asset` | Stacked vertical logo lockup, suited to portrait or square brand-mark slots. |
| `stackedLight` | no | `ref:Asset` | Light-colored stacked logo variant intended for rendering on dark backgrounds. |
| `stackedDark` | no | `ref:Asset` | Dark-colored stacked logo variant intended for rendering on light backgrounds. |
| `icon` | no | `ref:Asset` | Default icon, mark, or symbol without wordmark. Useful for tight spaces such as footers, badges, and slide-corner marks. |
| `iconLight` | no | `ref:Asset` | Light-colored icon variant intended for rendering on dark backgrounds. |
| `iconDark` | no | `ref:Asset` | Dark-colored icon variant intended for rendering on light backgrounds. |
| `wordmark` | no | `ref:Asset` | Default wordmark: the organization name set in branded typography, without icon. |
| `wordmarkLight` | no | `ref:Asset` | Light-colored wordmark variant intended for rendering on dark backgrounds. |
| `wordmarkDark` | no | `ref:Asset` | Dark-colored wordmark variant intended for rendering on light backgrounds. |


### Watermark

- Type: `object`
- Required fields: `opacity`
- Purpose: Decorative watermark image and rendering options. Use design.watermark = false to disable an inherited watermark.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `src` | no | `string` | Source for the watermark image. |
| `opacity` | yes | `number` | Watermark opacity from 0 (fully transparent) to 1 (fully opaque). |


### HeaderFooter

- Type: `object`
- Required fields: none
- Purpose: Repeated header or footer content split into left, center, and right zones. Header/footer content is slide furniture, separate from the main slide content payloads.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `left` | no | `ref:HeaderFooterItem` | Left-aligned header/footer content. |
| `center` | no | `ref:HeaderFooterItem` | Centered header/footer content. |
| `right` | no | `ref:HeaderFooterItem` | Right-aligned header/footer content. |


### HeaderFooterItem

- Type: `object`
- Required fields: none
- Purpose: One header/footer zone. Fields may be combined when the renderer supports it; otherwise renderers should prefer image, then text-like generated content.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `text` | no | `string` | Literal text rendered in this zone. |
| `image` | no | `ref:Asset` | Generic image rendered in this zone, such as a logo, partner mark, certification badge, or icon. |
| `slideNumber` | no | `boolean` | Whether to render the current slide number in this zone. |
| `date` | no | `oneOf:boolean / string` | Whether to render the presentation date, or a literal date string to render. |
| `organization` | no | `boolean` | Whether to render the primary organization name from organization. |
| `section` | no | `boolean` | Whether to render the current slide section label. |


### Slide

- Type: `object`
- Required fields: none
- Purpose: A single slide. Content can be authored as a full-slide root payload, or inside promoted named region keys such as 'left', 'center+right', and 'top:left'.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | no | `string` | Optional stable identifier for the slide within the document. Use when another system needs to reference a slide across edits, comments, generation state, exports, or narrative tooling. Slide order is defined by the s... |
| `type` | no | `enum:text \| list \| image \| chart \| table \| video \| code \| metric \| quote \| timeline` | Optional full-slide content kind. When omitted, engines infer the kind from root payload fields. |
| `beat` | no | `oneOf:string / array<string>` | Optional reference to one or more narrative beats (each value matches an id from narrative.beats or the resolved template). A single string declares the slide's primary beat; an array declares that one slide covers mu... |
| `layout` | no | `string` | Optional slide layout reference. Resolves to the 'id' of a 'layouts' catalog record. When omitted, engines infer a layout from the slide's root payload or promoted region keys. Accepts a bare id (lowercase kebab-case,... |
| `title` | no | `string` | Slide-level title content. When the resolved layout exposes a 'title' placeholder, the engine renders this value there. |
| `subtitle` | no | `string` | Slide-level subtitle or supporting line. When the resolved layout exposes a 'subtitle' placeholder, the engine renders this value there. |
| `tag` | no | `string` | Small slide-level label or badge. When the resolved layout exposes a 'tag' placeholder, the engine renders this value there. |
| `text` | no | `oneOf:string / array<ref:TextRun>` | Full-slide text payload. Use a string for plain text or TextRun[] for inline rich text. TextRun items may be plain strings or formatted run objects. |
| `items` | no | `array<ref:ListItem>` | Full-slide generic list payload. Presence of this field infers type 'list'. At slide root, multiple content payload kinds with no explicit type, blocks, or regions are accepted as shorthand for layout-agnostic blocks. |
| `bullets` | no | `array<ref:BulletItem>` | Full-slide text-style bullet payload. Presence of this field infers type 'text'. |
| `image` | no | `ref:Asset` | Full-slide image source. Presence of this field infers type 'image'. |
| `video` | no | `ref:Asset` | Full-slide video source. Presence of this field infers type 'video'. |
| `chart` | no | `ref:Chart` | Full-slide chart payload. Presence of this field infers type 'chart'. |
| `table` | no | `ref:Table` | Full-slide table payload. Presence of this field infers type 'table'. |
| `code` | no | `oneOf:string / ref:Code` | Full-slide code payload. A string is shorthand for { "source": value }; object form carries optional syntax language and filename metadata. |
| `metric` | no | `oneOf:string / number / ref:Metric` | Full-slide metric payload. A string or number is shorthand for { "value": value }; object form carries optional label, description, unit, delta, and trend metadata. Numeric values remain numbers; renderers format them... |
| `quote` | no | `oneOf:string / ref:Quote` | Full-slide quote payload. A string is shorthand for { "text": value }; object form carries optional attribution and source metadata. Presence of this field infers type 'quote'. |
| `timeline` | no | `ref:Timeline` | Full-slide timeline payload. An array is shorthand for { "events": value }; object form carries optional name and description metadata. Presence of this field infers type 'timeline'. |
| `blocks` | no | `array<ref:ContentPayload>` | Layout-agnostic content blocks rendered together as a composed payload when exact placement is unspecified. At slide root, multiple content payload kinds with no explicit type, blocks, or regions are accepted as shorthand for equivalent blocks. |
| `design` | no | `ref:Design` | Slide-level design applied on top of the deck-wide design. |
| `left` | no | `ref:ContentPayload` |  |
| `center` | no | `ref:ContentPayload` |  |
| `right` | no | `ref:ContentPayload` |  |
| `left+center` | no | `ref:ContentPayload` |  |
| `center+right` | no | `ref:ContentPayload` |  |
| `left+center+right` | no | `ref:ContentPayload` |  |
| `top` | no | `ref:ContentPayload` |  |
| `middle` | no | `ref:ContentPayload` |  |
| `bottom` | no | `ref:ContentPayload` |  |
| `top+middle` | no | `ref:ContentPayload` |  |
| `middle+bottom` | no | `ref:ContentPayload` |  |
| `top+middle+bottom` | no | `ref:ContentPayload` |  |
| `top:left` | no | `ref:ContentPayload` |  |
| `top:center` | no | `ref:ContentPayload` |  |
| `top:right` | no | `ref:ContentPayload` |  |
| `top:left+center` | no | `ref:ContentPayload` |  |
| `top:center+right` | no | `ref:ContentPayload` |  |
| `top:left+center+right` | no | `ref:ContentPayload` |  |
| `middle:left` | no | `ref:ContentPayload` |  |
| `middle:center` | no | `ref:ContentPayload` |  |
| `middle:right` | no | `ref:ContentPayload` |  |
| `middle:left+center` | no | `ref:ContentPayload` |  |
| `middle:center+right` | no | `ref:ContentPayload` |  |
| `middle:left+center+right` | no | `ref:ContentPayload` |  |
| `bottom:left` | no | `ref:ContentPayload` |  |
| `bottom:center` | no | `ref:ContentPayload` |  |
| `bottom:right` | no | `ref:ContentPayload` |  |
| `bottom:left+center` | no | `ref:ContentPayload` |  |
| `bottom:center+right` | no | `ref:ContentPayload` |  |
| `bottom:left+center+right` | no | `ref:ContentPayload` |  |
| `top+middle:left` | no | `ref:ContentPayload` |  |
| `top+middle:center` | no | `ref:ContentPayload` |  |
| `top+middle:right` | no | `ref:ContentPayload` |  |
| `top+middle:left+center` | no | `ref:ContentPayload` |  |
| `top+middle:center+right` | no | `ref:ContentPayload` |  |
| `top+middle:left+center+right` | no | `ref:ContentPayload` |  |
| `middle+bottom:left` | no | `ref:ContentPayload` |  |
| `middle+bottom:center` | no | `ref:ContentPayload` |  |
| `middle+bottom:right` | no | `ref:ContentPayload` |  |
| `middle+bottom:left+center` | no | `ref:ContentPayload` |  |
| `middle+bottom:center+right` | no | `ref:ContentPayload` |  |
| `middle+bottom:left+center+right` | no | `ref:ContentPayload` |  |
| `top+middle+bottom:left` | no | `ref:ContentPayload` |  |
| `top+middle+bottom:center` | no | `ref:ContentPayload` |  |
| `top+middle+bottom:right` | no | `ref:ContentPayload` |  |
| `top+middle+bottom:left+center` | no | `ref:ContentPayload` |  |
| `top+middle+bottom:center+right` | no | `ref:ContentPayload` |  |
| `top+middle+bottom:left+center+right` | no | `ref:ContentPayload` |  |
| `notes` | no | `string` | Speaker notes shown in presenter view. |
| `section` | no | `string` | PowerPoint-style slide section label. Consecutive slides with the same value belong to the same section in presenter view, outlines, and PowerPoint section-aware exports. |
| `hidden` | no | `boolean` | Whether the slide is hidden from the presented sequence. |


### ContentPayload

- Type: `allOf:schema + schema + schema + schema + schema + schema + schema + schema + schema`
- Required fields: none
- Purpose: A single content payload. The optional 'type' discriminator can make intent explicit, but validators and engines infer it from fields such as text, bullets, items, image, video, chart, table, code, metric, quote, or timeline.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | no | `enum:text \| list \| image \| chart \| table \| video \| code \| metric \| quote \| timeline` | Optional content kind. When omitted, engines infer the kind from the fields present. |
| `text` | no | `oneOf:string / array<ref:TextRun>` | Text payload. Use a string for plain text or TextRun[] for inline rich text. TextRun items may be plain strings or formatted run objects. |
| `items` | no | `array<ref:ListItem>` | Generic list payload. Each item is either a plain string, a TextRun[] rich text sequence, or a ListItem object. List nesting uses item.level rather than nested content payloads. |
| `bullets` | no | `array<ref:BulletItem>` | Text-style bullet payload. Presence of this field infers type 'text'. |
| `image` | no | `ref:Asset` | Source for an image item. |
| `video` | no | `ref:Asset` | Source for a video item. |
| `chart` | no | `ref:Chart` | Chart payload. Presence of this field infers type 'chart'. |
| `table` | no | `ref:Table` | Table payload. Presence of this field infers type 'table'. |
| `code` | no | `oneOf:string / ref:Code` | Code payload. A string is shorthand for { "source": value }; object form carries optional syntax language and filename metadata. |
| `metric` | no | `oneOf:string / number / ref:Metric` | Metric payload. A string or number is shorthand for { "value": value }; object form carries optional label, description, unit, delta, and trend metadata. Numeric values remain numbers; renderers format them for display. |
| `quote` | no | `oneOf:string / ref:Quote` | Quote payload. A string is shorthand for { "text": value }; object form carries optional attribution and source metadata. |
| `timeline` | no | `ref:Timeline` | Timeline payload ordered by narrative or chronology. |


### Quote

- Type: `object`
- Required fields: `text`
- Purpose: Quote content with optional attribution metadata. Use 'text' for the quoted text, 'attribution' for the credited person or organization, and 'source' for a citation or URL. A string value in a quote field is shorthand for { "text": value }.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `text` | yes | `string` | Quoted text. |
| `attribution` | no | `string` | Person or organization credited for the quote. |
| `source` | no | `string` | Optional quote source, citation, or URL. |


### Code

- Type: `object`
- Required fields: `source`
- Purpose: Code content with optional rendering metadata. Use 'source' for the code text, 'language' for syntax highlighting, and 'filename' when the rendered block should show a file label. A string value in a code field is shorthand for { "source": value }.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `source` | yes | `string` | Source code text to display. |
| `language` | no | `string` | Language identifier used for syntax highlighting. |
| `filename` | no | `string` | Optional file label shown with the code block. |


### Metric

- Type: `object`
- Required fields: `value`
- Purpose: Metric content with optional display metadata. Use 'value' for the primary value, 'label' for the metric name, 'description' for supporting context, 'unit' for a suffix/currency marker, 'delta' for change, and 'trend' for direction. A string or number value in a metric field is shorthand for { "value": value }; numeric values remain numbers and are formatted by renderers.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `value` | yes | `oneOf:string / number` | Primary metric value. |
| `label` | no | `string` | Metric label. |
| `description` | no | `string` | Optional supporting context for the metric. |
| `unit` | no | `string` | Metric unit, suffix, or currency marker. |
| `delta` | no | `oneOf:string / number` | Metric change value. |
| `trend` | no | `enum:up \| down \| flat` | Metric trend direction. |


### Timeline

- Type: `oneOf:array<ref:TimelineEvent> / object`
- Required fields: none
- Purpose: Timeline content. An array is shorthand for { "events": value }; object form carries optional name and description metadata.

_No named properties._


### TimelineEvent

- Type: `object`
- Required fields: `what`
- Purpose: A single event inside a timeline content payload.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `when` | no | `string` | Event time, date, or sequence label. Use ISO-like values when possible, but human labels are allowed for quarters, eras, and relative milestones. |
| `what` | yes | `string` | Short event label. |
| `description` | no | `string` | Optional event detail. |


### ListItem

- Type: `oneOf:string / array<ref:TextRun> / object`
- Required fields: none
- Purpose: A flat item inside a list. Strings cover the common case, TextRun[] supports inline rich text without an object wrapper, and object form adds description and nesting depth without creating nested slide content payloads.

_No named properties._


### BulletItem

- Type: `oneOf:string / array<ref:TextRun> / object`
- Required fields: none
- Purpose: A flat bullet item. Strings cover the common case, TextRun[] supports inline rich text without an object wrapper, and object form adds nesting depth without list-item descriptions.

_No named properties._


### TextRun

- Type: `oneOf:string / object`
- Required fields: none
- Purpose: A contiguous run of text. Strings cover unformatted spans; object form adds character formatting.

_No named properties._


### Chart

- Type: `object`
- Required fields: `type`, `data`
- Purpose: Chart content. The chart object keeps chart-specific fields together so slides and regions do not expose loose chart fields.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | yes | `string` | Chart type id. Resolves to the id of a chartTypes catalog record; renderers map that record through mappings.openxml and any renderer-specific mapping they understand. |
| `data` | yes | `oneOf:ref:ChartData / ref:ChartDataSource` | Chart data. Inline data uses a tabular columns/rows shape; renderers convert rows to chart series internally. |


### Table

- Type: `object`
- Required fields: `rows`
- Purpose: Table content. Columns are optional; rows are the only required field.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `columns` | no | `array<string>` | Optional column labels rendered above table rows. |
| `rows` | yes | `array<array<ref:TableCell>>` | Two-dimensional table row data; each row aligns by index with columns when columns are supplied. |


### ChartData

- Type: `object`
- Required fields: `columns`, `rows`
- Purpose: Inline tabular data driving a chart. The first column usually supplies category/x-axis labels; subsequent columns are plotted measures unless a chart type or renderer maps them differently.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `columns` | yes | `array<string>` | Ordered column labels for the chart data table. |
| `rows` | yes | `array<array<ref:ChartDataCell>>` | Tabular chart rows. Each row aligns by index with columns. |


### ChartDataSource

- Type: `object`
- Required fields: `src`
- Purpose: Chart data sourced from an asset reference, URL, data URI, relative path, or local path such as CSV, TSV, JSON, or XLSX. The source is interpreted as a table; optional columns select or order fields from that table.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `src` | yes | `string` | Data source. Use 'asset:<id>' to reference the top-level assets registry, or provide an HTTPS URL, data URI, relative path, or local filesystem path. |
| `sheet` | no | `string` | Optional sheet name or table name for spreadsheet-like assets. |
| `range` | no | `string` | Optional A1-style range or engine-defined range selector for spreadsheet-like assets. |
| `columns` | no | `array<string>` | Optional ordered columns or fields to read from the source. When omitted, renderers may use the source's own header row or schema. |


### ChartDataCell

- Type: `oneOf:string / number / boolean / null`
- Required fields: none
- Purpose: A cell in inline chart data.

_No named properties._


### TableCell

- Type: `oneOf:string / number / boolean / null`
- Required fields: none
- Purpose: A cell in table content.

_No named properties._


### Catalogs

- Type: `object`
- Required fields: none
- Purpose: Catalog overrides for the in-document references. Every property is optional. The default catalog for a kind lives at https://www.pptx.gallery/<kind> (e.g. https://www.pptx.gallery/narratives, https://www.pptx.gallery/themes). For each kind, declaring a 'source' replaces the default registry and/or 'records' adds inline records that take precedence over anything fetched from a source. Resolution order for any reference (e.g. narrative, design.theme): inline catalogs.<kind>.records[] catalogs....

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `narratives` | no | `ref:CatalogEntry` | Catalog of narrative templates. Records validate against https://openpresentation.org/schema/opf-narrative/v1. Default source: https://www.pptx.gallery/narratives. |
| `themes` | no | `ref:CatalogEntry` | Catalog of themes. Records validate against https://openpresentation.org/schema/opf-theme/v1. Default source: https://www.pptx.gallery/themes. |
| `colorSchemes` | no | `ref:CatalogEntry` | Catalog of color schemes. Records validate against https://openpresentation.org/schema/opf-color-scheme/v1. Default source: https://www.pptx.gallery/color-schemes. |
| `fontSchemes` | no | `ref:CatalogEntry` | Catalog of font schemes. Records validate against https://openpresentation.org/schema/opf-font-scheme/v1. Default source: https://www.pptx.gallery/font-schemes. |
| `languages` | no | `ref:CatalogEntry` | Catalog of languages. Records validate against https://openpresentation.org/schema/opf-language/v1. Default source: https://www.pptx.gallery/languages. |
| `layouts` | no | `ref:CatalogEntry` | Catalog of slide layouts. Records validate against https://openpresentation.org/schema/opf-layout/v1. Default source: https://www.pptx.gallery/layouts. |
| `chartTypes` | no | `ref:CatalogEntry` | Catalog of chart types. Records validate against https://openpresentation.org/schema/opf-chart-type/v1. Default source: https://www.pptx.gallery/chart-types. |
| `tones` | no | `ref:CatalogEntry` | Catalog of presentation tones. Records validate against https://openpresentation.org/schema/opf-tone/v1. Default source: https://www.pptx.gallery/tones. Referenced from tone. |
| `purposes` | no | `ref:CatalogEntry` | Catalog of presentation purposes. Records validate against https://openpresentation.org/schema/opf-purpose/v1. Default source: https://www.pptx.gallery/purposes. Referenced from purpose. |
| `audiences` | no | `ref:CatalogEntry` | Catalog of presentation audiences. Records validate against https://openpresentation.org/schema/opf-audience/v1. Default source: https://www.pptx.gallery/audiences. Referenced from audience. |
| `socialPlatforms` | no | `ref:CatalogEntry` | Catalog of social-media platforms. Records validate against https://openpresentation.org/schema/opf-social-platform/v1. Default source: https://www.pptx.gallery/social-platforms. Referenced via the property keys of an... |


### CatalogEntry

- Type: `object`
- Required fields: none
- Purpose: A catalog override for one record kind. 'source' replaces the default registry; 'records' adds inline records that take precedence over anything fetched from a source. Either or both may be provided; both omitted means the kind uses its default catalog.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `source` | no | `oneOf:ref:CatalogSource / array<ref:CatalogSource>` | Single source or an ordered search path of sources. When omitted, the engine falls back to https://www.pptx.gallery/<kind>. |
| `records` | no | `array<object>` | Inline catalog records embedded in this OPF document. Each record validates against the kind's companion schema (e.g. https://openpresentation.org/schema/opf-narrative/v1 for narratives). Inline records win over anyth... |


### CatalogSource

- Type: `string`
- Required fields: none
- Purpose: Catalog source location. Accepts: - A bare URL pointing at a catalog directory (e.g. 'https://acme.com/decks/narratives'); record ids resolve to '<base>/<id>.json'. - A URL pointing at an index file (e.g. 'https://acme.com/decks/narratives/index.json'); records are resolved relative to the index file's directory and the index entries describe what's available. - A package reference of the form 'pkg:<package>[/<subpath>]'; resolved through a locally-installed package on the engine's package path.

_No named properties._
