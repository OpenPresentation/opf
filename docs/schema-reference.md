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
| `filename` | no | `string` | Optional base filename for exports (without extension). The opf CLI (render, export) and the editor strip a trailing .pptx, .pdf, .png, or .svg (case-insensitive) and append the target format's extension. When omitted... |
| `organization` | no | `oneOf:ref:Organization / array<ref:Organization>` | Organization associated with the presentation, usually the presenting company. Array form supports hosts, partners, clients, and sponsors. The primary organization (Organization.role 'primary', else the first item) su... |
| `speaker` | no | `oneOf:ref:Speaker / array<ref:Speaker>` | Person presenting the deck. Array form supports panels and multi-speaker decks. The first speaker is the primary speaker: the built-in variables 'speaker.<field>' read it, 'speakers' lists every name, and 'speaker.<id... |
| `author` | no | `oneOf:string / array<string>` | Optional credit for the person who authored or contributed to the deck, distinct from speaker. Array form supports multiple contributors. Round-trips to OOXML 'docProps/core.xml' as '<dc:creator>' (semicolon-joined wh... |
| `audience` | no | `oneOf:string / ref:Audience / array<oneOf:string / ref:Audience>` | Intended audiences for the presentation. Accepts any of: - A single string: an audiences reference ('executive', or 'acme:board' for a record of the catalogs.acme group), or free-form text ('Series B investors'). A st... |
| `purpose` | no | `oneOf:string / ref:Purpose` | Primary goal of the presentation. Accepts either: - A string: a purposes reference ('decide', or 'acme:fundraise' for a record of the catalogs.acme group), or a free-form goal ('Raise a Series B round of $30M'). A str... |
| `language` | no | `oneOf:ref:LanguageTag / ref:Language` | Language of the presentation content, an engine vocabulary: a BCP-47 language tag, validated directly with no catalog lookup. Accepts either: - A BCP-47 tag ('en-US', 'en-GB', 'ja', 'zh-Hans', 'ar-SA'). - An inline La... |
| `tone` | no | `oneOf:ref:CatalogReference / ref:Tone` | Desired tone for the presentation. Accepts either: - A tones reference: a bare id ('formal') or 'name:id' for a record of a named catalogs group. - An inline Tone object for custom tone metadata or overrides on a refe... |
| `takeaway` | no | `oneOf:string / array<string>` | Audience-facing takeaway the presentation should leave behind. Array form supports multiple takeaways. Deck-level intent used by AI to seed and pressure-test slide content. |
| `duration` | no | `integer` | Target presentation duration, as an integer number of minutes. The opf-render presenter view counts the elapsed time against it, and core validate warns when it lies outside the resolved narrative's 'duration' range.... |
| `tags` | no | `array<string>` | Free-form labels used for categorization, search, and filtering. Lowercase kebab-case is recommended for consistency across a deck library. |
| `design` | no | `ref:Design` | Optional design system covering theme, color scheme, font scheme, dimensions, background, logo, watermark, header, and footer applied to the deck. When omitted, engines use their default design configuration. |
| `variables` | no | `ref:Variables` | Optional named variables: deck colors referenced as 'var:<id>' (the original use), and typed content variables (text, number, date, image, url, list) referenced inline as '{{<id>}}' or whole as 'var:<id>'. Variables a... |
| `template` | no | `boolean` | Marks this document as a template: an incomplete OPF file. A template declares variables (top-level 'variables') and references them from content, and may leave required variables unfilled; validation then reports the... |
| `narrative` | no | `ref:CatalogReference` | The deck's narrative plan, by reference: a bare narratives id ('classic-story') or 'name:id' for a record of a named catalogs group ('acme:founder-pitch'). The deck holds only this pointer; the plan (the arc, its beat... |
| `slides` | yes | `array<ref:Slide>` | Ordered array of slides that make up the presentation. |
| `references` | no | `array<ref:Reference>` | Sources that text runs cite with 'cite'. Ids are unique. A cited reference is listed in the footnote area of every slide that cites it, with a marker number assigned per deck in order of first use; a reference no run... |
| `datasets` | no | `ref:Datasets` | Optional shared data tables, keyed by id. A chart ('chart.data': { "dataset": "<id>" }) or a table ('table': { "dataset": "<id>" }) references one instead of holding its own copy; engines inline the reference before c... |
| `assets` | no | `ref:Assets` | Optional reusable asset registry for images, data files, videos, documents, fonts, and other resources referenced elsewhere in the deck via 'asset:<id>' strings. |
| `catalogs` | no | `ref:Catalogs` | The catalog records this document embeds, grouped by the catalog they came from: 'default' (the catalog bare ids come from), 'custom' (records the document defines itself) and any number of named catalogs ('acme', ref... |
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
- Purpose: Reusable or inline resource. A string is shorthand for { "src": value }. Source strings accept 'asset:<id>' references, HTTPS URLs, data URIs, relative paths resolved against the OPF file location, or local filesystem paths. Use object form when metadata such as alt text, title or mediaType matters.

_No named properties._


### Audience

- Type: `anyOf:schema / schema`
- Required fields: none
- Purpose: Inline audience metadata for the presentation. Use 'id' to reference an audiences record (a bare id or 'name:id') and override selected fields, or use 'name' for a custom inline audience.
- Conditional requirement: `id` or `name`

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | no | `ref:CatalogReference` | Optional audiences reference (a bare id or 'name:id') resolved before applying the inline overrides. |
| `name` | no | `string` | Human-readable audience name shown in pickers. |
| `summary` | no | `string` | One-sentence positioning of the audience. |
| `description` | no | `string` | Longer prose describing the audience and how to address them. |
| `seniority` | no | `enum:ic \| manager \| director \| vp \| c-suite \| mixed` | Typical seniority level of the audience. |
| `technicalFluency` | no | `enum:low \| medium \| high \| mixed` | Typical technical fluency of the audience. |
| `decisionPower` | no | `enum:informational \| advisory \| decision-maker` | Whether the audience is expected to be informed, advise, or decide. |
| `attentionBudgetMinutes` | no | `number` | Realistic upper bound on focused attention for a single presentation, in minutes. |
| `recommendedNarratives` | no | `array<string>` | Soft cross-link: narrative ids that work well for this audience, for picker UIs. Never resolved, embedded or validated as references. |
| `recommendedTones` | no | `array<string>` | Soft cross-link: tone ids that work well for this audience, for picker UIs. Never resolved, embedded or validated as references. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |


### Purpose

- Type: `anyOf:schema / schema`
- Required fields: none
- Purpose: Inline purpose metadata for the presentation. Use 'id' to reference a purposes record (a bare id or 'name:id') and override selected fields, or use 'name' for a custom inline purpose.
- Conditional requirement: `id` or `name`

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | no | `ref:CatalogReference` | Optional purposes reference (a bare id or 'name:id') resolved before applying the inline overrides. |
| `name` | no | `string` | Human-readable purpose name shown in pickers. |
| `summary` | no | `string` | One-sentence positioning of the purpose. |
| `description` | no | `string` | Longer prose describing when to use this purpose and how it should shape a deck. |
| `outcome` | no | `string` | Desired audience outcome after the presentation. |
| `successCriteria` | no | `array<string>` | Observable signals that the deck accomplished this purpose. |
| `recommendedNarratives` | no | `array<string>` | Soft cross-link: narrative ids that work well for this purpose, for picker UIs. Never resolved, embedded or validated as references. |
| `recommendedTones` | no | `array<string>` | Soft cross-link: tone ids that work well for this purpose, for picker UIs. Never resolved, embedded or validated as references. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |


### Language

- Type: `object`
- Required fields: `bcp47`
- Purpose: Inline language metadata for the presentation: a BCP-47 'bcp47' tag plus overrides of what engines know about it. Languages are an engine vocabulary, not catalog records, so there is no 'id'.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `name` | no | `string` | Human-readable language name. |
| `bcp47` | yes | `ref:LanguageTag` | BCP-47 language tag used for locale-aware rendering, proofing, and accessibility metadata. Use 'en-GB' for UK English; 'en-UK' is not a valid BCP-47 region form. |
| `ooxmlLang` | no | `string` | Culture tag for OOXML text-run language attributes (a:rPr/@lang, a:endParaRPr/@lang), in the language-[Script-]REGION form Office recognizes (e.g. 'ja-JP', 'ar-SA', 'ms-MY', 'nb-NO', 'fil-PH', 'zh-CN'). Without it, en... |
| `code` | no | `string` | ISO 639-3 or 639-2 language code carried for engines that prefer ISO codes. |
| `direction` | no | `enum:ltr \| rtl` | Base text direction for the language. When omitted, engines derive it from the script: Arabic (Arab), Hebrew (Hebr), Syriac (Syrc), Thaana (Thaa), N'Ko (Nkoo), Adlam (Adlm), Samaritan (Samr), Mandaic (Mand) and Hanifi... |
| `script` | no | `string` | ISO 15924 script code of the language's writing system. The script selects the OOXML font slot the language's text uses: East Asian scripts (Hans, Hant, Hani, Jpan, Kore, Hang, Hira, Kana, Bopo, Yiii) use the eastAsia... |
| `fontScheme` | no | `ref:CatalogReference` | Font-scheme reference (a bare id or 'name:id') for this language's script slot when targeting PowerPoint output. Its major/minor families fill the language's script slot (eastAsian or complexScript, chosen by 'script'... |
| `googleFontScheme` | no | `ref:CatalogReference` | Font-scheme reference (a bare id or 'name:id') used in place of 'fontScheme' when resolving script fonts for Google Slides output. |
| `summary` | no | `string` | One-sentence note about coverage or font defaults. |
| `description` | no | `string` | Longer prose describing the language record and any font-pairing rationale. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |


### Tone

- Type: `anyOf:schema / schema`
- Required fields: none
- Purpose: Inline tone metadata for the presentation. Use 'id' to reference a tones record (a bare id or 'name:id') and override selected fields, or use 'name' for a custom inline tone.
- Conditional requirement: `id` or `name`

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | no | `ref:CatalogReference` | Optional tones reference (a bare id or 'name:id') resolved before applying the inline overrides. |
| `name` | no | `string` | Human-readable tone name shown in pickers. |
| `summary` | no | `string` | One-sentence positioning of the tone. |
| `description` | no | `string` | Longer prose describing the tone and the kinds of decks it suits. |
| `voiceCues` | no | `array<string>` | Short directives that shape AI generation toward this tone. |
| `avoid` | no | `array<string>` | Anti-patterns that AI generation should not produce when this tone is active. |
| `samplePhrases` | no | `array<string>` | Short example phrases that exemplify this tone. |
| `recommendedNarratives` | no | `array<string>` | Soft cross-link: narrative ids this tone pairs well with, for picker UIs. Never resolved, embedded or validated as references. |
| `tags` | no | `array<string>` | Free-form labels for filtering and search. |


### Organization

- Type: `object`
- Required fields: `id`, `name`
- Purpose: An organization associated with the presentation, typically the presenting company, but also hosts, partners, clients, or sponsors. The primary organization (role 'primary', else the first one) supplies the cover and section logo (unless design.logo overrides it) and the 'socials' header/footer field (its socials). Every field is also a built-in variable ('{{organization.name}}', 'organization.<id>.<field>'), and every logo a slide-scoped image ('var:organization.logo.icon', 'var:organization...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | yes | `string` | Stable identifier for the organization, used to reference it from Speaker.organizationId and to address it in built-in variables as 'organization.<id>.<field>'. Must be unique among organizations (a duplicate is a val... |
| `name` | yes | `string` | Display name. The built-in variable 'organization.name' (primary organization) or 'organization.<id>.name' carries it into any string, such as a header or footer text of '{{organization.name}}'. |
| `legalName` | no | `string` | Optional legal entity name when it differs from the display name. Never drawn automatically; available as the built-in variable 'organization.legalName'. |
| `logo` | no | `oneOf:ref:Asset / ref:OrganizationLogo` | The organization's logo. A path, URL or Asset is one logo for every shape; an object gives up to four shapes (full, stacked, icon, wordmark), each a path or Asset, or { onLight, onDark } for the two backgrounds. A pat... |
| `domain` | no | `string` | Bare internet domain for the organization. Never drawn automatically and not used to look up assets; available as the built-in variable 'organization.domain'. |
| `email` | no | `string` | General contact email for the organization. Never drawn automatically; available as the built-in variable 'organization.email'. |
| `phone` | no | `string` | Main contact phone number for the organization. E.164 format is recommended. Never drawn automatically; available as the built-in variable 'organization.phone'. |
| `tagline` | no | `string` | Short tagline. Never drawn automatically (cover slides do not show it); available as the built-in variable 'organization.tagline', for example in a footer 'text' of '{{organization.tagline}}'. |
| `role` | no | `enum:primary \| partner \| client \| sponsor \| host` | Role of the organization relative to the presentation. Only 'primary' has behavior: it selects the primary organization (cover and section logo, the 'socials' header/footer field, and the 'organization.<field>' built-... |
| `socials` | no | `ref:Socials` | Optional social media handles or URLs for the organization. The primary organization's socials render in header/footer zones that set socials: true; otherwise they are authoring metadata. |


### Speaker

- Type: `object`
- Required fields: `id`, `name`
- Purpose: A person presenting the deck. A speaker is drawn only through built-in variables ('{{speaker.name}}' inside any string, a header or footer text included, and 'var:speaker.photo' as a whole image field). No layout, cover or bio slide places a speaker on its own. See docs/templates-and-variables.md.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | yes | `string` | Stable identifier for the speaker. Must be unique among speakers (a duplicate is a validation error). Addresses this speaker in built-in variables as 'speaker.<id>.<field>', such as '{{speaker.alice.title}}'. |
| `name` | yes | `string` | Display name. Built-in variable 'speaker.name' (first speaker) or 'speaker.<id>.name'; every name is listed by 'speakers'. |
| `title` | no | `string` | Role or title. Built-in variable 'speaker.title' (or 'speaker.<id>.title'), for example in a footer text of '{{speaker.name}}, {{speaker.title}}'. |
| `photo` | no | `ref:Asset` | Source for the speaker's headshot image. Accepts an HTTPS URL, data URI, relative path (resolved against the OPF file location), local path, or 'asset:<id>' reference. Common formats are JPG or PNG; SVG is not appropr... |
| `email` | no | `string` | Contact email. Never drawn automatically; available as the built-in variable 'speaker.email'. |
| `phone` | no | `string` | Contact phone number for the speaker. E.164 format is recommended. Never drawn automatically; available as the built-in variable 'speaker.phone'. |
| `bio` | no | `string` | Short biographical paragraph. Never drawn automatically; available as the built-in variable 'speaker.bio', for a bio or 'about the speaker' slide you write. |
| `organizationId` | no | `string` | Reference to an Organization.id in organization; it must name an existing organization (a validation error otherwise). Attribution metadata for hosts: no engine draws it or changes which organization is primary becaus... |
| `socials` | no | `ref:Socials` | Optional social media handles or URLs for the speaker. Authoring metadata only: nothing draws speaker socials and there is no built-in variable for them (the 'socials' header/footer field draws the primary organizatio... |


### Socials

- Type: `object`
- Required fields: none
- Purpose: Social media handles or URLs, keyed by platform. The keys are an engine vocabulary validated directly (no catalog lookup): engines link a handle with the platform's URL pattern and handle prefix (spec/reference/engine-vocabularies.json). Each value is a string, either a full URL or a platform handle (e.g., '@acme'). Brand colours and icons are catalog display metadata for authoring UIs; engines render the profile URL, not icons or brand colours. Used both for organization and speaker records.

_No named properties._


### Design

- Type: `object`
- Required fields: none
- Purpose: Visual design system applied to the presentation; individual slides may override fields via Slide.design.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `theme` | no | `ref:CatalogReference` | Theme for the deck: a themes reference, a bare id ('minimal') or 'name:id' ('acme:brand'). The theme supplies the default colour scheme, font scheme, background and dimensions; design.colorScheme, design.fontScheme, d... |
| `colorScheme` | no | `oneOf:string / ref:ColorScheme` | Color scheme for the presentation. Accepts two forms: - A colorSchemes reference: a bare id ('cool-horizon') or 'name:id' ('acme:ocean'). - Object form: a ColorScheme with an optional 'id' reference as the base plus s... |
| `fontScheme` | no | `oneOf:string / ref:FontScheme` | Font scheme for heading, body, accent, and code text. Accepts two forms: - A fontSchemes reference: a bare id ('aptos') or 'name:id' ('acme:inter'). - Object form: a FontScheme with an optional 'id' reference as the b... |
| `dimensions` | no | `oneOf:ref:DimensionPreset / ref:Dimensions` | Slide dimensions and aspect ratio. String shorthand such as 'widescreen' is equivalent to { preset: 'widescreen' }. |
| `background` | no | `oneOf:ref:BackgroundShortcut / ref:Background` | Default slide background applied across the deck unless overridden on a slide (slides.N.design.background); the resolved theme's background is the fallback. A background is the only canvas fill and never moves content... |
| `logo` | no | `oneOf:string / const:false` | Which logo covers, section dividers and picture bullets draw. Logos live on the organization (Organization.logo); without this field covers and sections draw the primary organization's full logo and picture bullets it... |
| `watermark` | no | `oneOf:const:false / ref:Asset / ref:Watermark` | Optional decorative watermark applied across slides: an image or a text stamp, in the fixed frame and at the opacity described on Watermark. Use false to suppress an inherited watermark in slide-level design; a string... |
| `header` | no | `oneOf:const:false / ref:HeaderFooter` | Repeated header furniture rendered outside the main slide content. Use false to suppress an inherited header. |
| `footer` | no | `oneOf:const:false / ref:HeaderFooter` | Repeated footer furniture rendered outside the main slide content. Use false to suppress an inherited footer. |
| `titleAlignment` | no | `enum:left \| center \| right` | Default horizontal alignment for title placeholders in resolved layouts. Effective value: the slide's design, then the deck's design, then the layout record's design.titleAlignment, then the engine default. |
| `contentAlignment` | no | `enum:left \| center \| right` | Default horizontal alignment for body/content regions in resolved layouts. Effective value: the slide's design, then the deck's design, then the layout record's design.contentAlignment, then the engine default. A cove... |
| `contentBox` | no | `boolean` | Whether body/content regions are rendered inside a visible card or surface. Effective value: the slide's design, then the deck's design, then the layout record's design.contentBox, then the engine default. |
| `contentDirection` | no | `enum:horizontal \| vertical` | Axis along which parallel body content is arranged. Sets the root arrangement mode of blocks and root payloads when no composition.mode is set on the slide or on its layout record: 'vertical' is column, 'horizontal' i... |
| `chartPrimary` | no | `enum:none \| top \| bottom \| left \| right` | Where the primary chart sits relative to supporting content. Effective value: slide design, then deck design, then the layout record's design.chartPrimary. When the slide has no promoted regions and no composition.mod... |
| `imageFit` | no | `enum:cover \| contain \| stretch` | Default fit of image blocks (and Slide.image) that set no fit of their own: 'cover' fills the frame and crops what overflows around the block's focus, 'contain' shows the whole picture centered in the frame, 'stretch'... |
| `listBullet` | no | `enum:character \| image` | Marker style for items and bullets lists. Effective value: the slide's design, then the deck's design, then the layout record's design.listBullet, then 'character'. 'character' (the default) draws the glyph marker. 'i... |


### ColorScheme

- Type: `object`
- Required fields: none
- Purpose: Color palette used by the design system. Every slot and role is a hex color ('#RGB', '#RRGGBB' or '#RRGGBBAA'); a color-scheme name or a 'var:<id>' reference is not valid here, because those resolve through the scheme. The slot fields (accent1-accent6, dark1, dark2, light1, light2, hyperlink, followedHyperlink) mirror color-scheme.schema.json (https://openpresentation.org/schema/opf-color-scheme/v1) so library records and inline OPF overrides are interchangeable on those fields. Two parallel...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | no | `ref:CatalogReference` | Colour-scheme reference (a bare id or 'name:id') resolved as the base; slot and role overrides on the surrounding ColorScheme object take precedence over the resolved scheme. |
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
| `hyperlink` | no | `ref:HexColor` | Hyperlink color (hex). OOXML hlink. Link runs with no color of their own are drawn underlined in it, in the preview and in PowerPoint, unless it has under 4.5:1 contrast against the slide background, then in the slide... |
| `followedHyperlink` | no | `ref:HexColor` | Followed-hyperlink color (hex). OOXML folHlink. |
| `primary` | no | `ref:HexColor` | Abstract role: primary brand color (hex). The engine maps this onto an OOXML accent slot when serializing. |
| `secondary` | no | `ref:HexColor` | Abstract role: secondary brand color (hex). |
| `accent` | no | `ref:HexColor` | Abstract role: accent color used for highlights and emphasis (hex). |
| `background` | no | `ref:HexColor` | Abstract role: default slide background color (hex), used when the design names no single-color background (and for gradient and picture backgrounds). Overrides light1 as that default. |
| `surface` | no | `ref:HexColor` | Abstract role: color for elevated surfaces such as cards and panels (hex). Overrides the default of light2 (dark2 on a dark slide). |
| `text` | no | `ref:HexColor` | Abstract role: primary body text color (hex). Overrides dark1 on a light slide only; a dark slide always uses light1. |
| `textSecondary` | no | `ref:HexColor` | Abstract role: secondary or muted text color used for captions and supporting copy (hex). Overrides the default of dark2 (light2 on a dark slide). |


### FontScheme

- Type: `object`
- Required fields: none
- Purpose: Typography selections used by the design system. The pair fields (major, minor) and refinement fields (type, app, languageFamily) mirror font-scheme.schema.json (https://openpresentation.org/schema/opf-font-scheme/v1) so library records and inline OPF overrides are interchangeable on those fields. Two parallel models are supported and may be mixed: - OOXML pairs (major, minor) - heading and body family names that round-trip directly to PowerPoint majorFont/minorFont entries. - Abstract roles...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | no | `ref:CatalogReference` | Font-scheme reference (a bare id or 'name:id') resolved as the base; field overrides on the surrounding FontScheme object take precedence over the resolved scheme. |
| `major` | no | `string` | Heading (major) font family mirrors the OOXML majorFont entry. Pairs with 'minor'. |
| `minor` | no | `string` | Body (minor) font family mirrors the OOXML minorFont entry. Pairs with 'major'. |
| `eastAsian` | no | `object` | East Asian script fonts. Maps to the OOXML a:ea element of majorFont (major) and minorFont (minor), and to run-level a:ea. When set, they fill the eastAsian slot for every language; when omitted, the slot comes from t... |
| `complexScript` | no | `object` | Complex-script fonts (for example Arabic, Hebrew, Indic and Thai). Maps to the OOXML a:cs element of majorFont (major) and minorFont (minor), and to run-level a:cs. When set, they fill the complexScript slot for every... |
| `type` | no | `enum:sans-serif \| serif \| monospace` | High-level typographic class of the scheme. |
| `app` | no | `enum:powerpoint \| google-slides` | Target application this font pairing is intended for. Metadata for pickers and catalog filters: no engine changes its output by it. |
| `languageFamily` | no | `enum:latin \| ea \| cs \| eastAsian \| complexScript` | Font-language family this scheme is intended for: 'latin' for Latin-script content, 'ea' (or 'eastAsian', the same value) for East Asian scripts, 'cs' (or 'complexScript', the same value) for Complex Scripts. The long... |
| `heading` | no | `string` | Abstract role: font family name used for slide titles and headings. Maps onto the OOXML major slot when serializing. |
| `body` | no | `string` | Abstract role: font family name used for body copy. Maps onto the OOXML minor slot when serializing. |
| `accent` | no | `string` | Abstract role: font family name used for accent text. When set, the slide tag (eyebrow) and the quote body use this family instead of the body and heading families; nothing else changes. resolveFontFamilies() returns... |
| `code` | no | `string` | Abstract role: monospaced font family name used for code blocks and for inline code runs (TextRun.code). No direct OOXML slot. Resolution: this override, then the resolved font-scheme record's 'code' (for example Cons... |


### SlideDesign

- Type: `allOf:ref:Design + schema`
- Required fields: none
- Purpose: A slide's design: every Design field except dimensions. A PPTX has one slide size, so the size is set once, on the deck's design.dimensions (or its theme), and a slide's design cannot set it. A slide-level theme whose resolved dimensions differ from the deck's is a validate warning (opf/slide-theme-dimensions); exporting such a deck to PPTX fails with mixed-slide-dimensions.

_No named properties._


### DimensionPreset

- Type: `enum:16:9 | 4:3 | 16:10 | 1:1 | 4:5 | 9:16 | letter | a4 | widescreen | standard`
- Required fields: none
- Purpose: Named dimension preset; chooses both aspect ratio and physical size. 'widescreen' is an alias for 16:9 in PowerPoint widescreen size; 'standard' is an alias for 4:3 in PowerPoint standard size. The social-feed ratios keep the widescreen short edge of 7.5 in: 1:1 is 7.5 x 7.5 in, 4:5 is 7.5 x 9.375 in and 9:16 is 7.5 x 13.333 in (portrait).

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


### ColorRef

- Type: `anyOf:ref:HexColor / enum:accent1 | accent2 | accent3 | accent4 | accent5 | accent6 | dark1 | dark2 | light1 | light2 | hyperlink | followedHyperlink | primary | secondary | accent | background | surface | surfaceAlt | text | textSecondary / string`
- Required fields: none
- Purpose: A color value or reference, enforced on styled table cell fill and text colors, cell border colors, solid background colors, gradient stop colors and pattern foreground and background colors. Three forms: - Literal hex: '#RGB', '#RRGGBB', or '#RRGGBBAA'. - Color-scheme name, resolved through the effective color scheme after design resolution: an OOXML slot ('accent1'-'accent6', 'dark1', 'dark2', 'light1', 'light2', 'hyperlink', 'followedHyperlink') or an abstract role ('primary', 'secondary',...

_No named properties._


### Variables

- Type: `object`
- Required fields: none
- Purpose: Named variables, keyed by stable kebab-case id. A variable is a typed, named value the deck declares once and uses in many places: a color ('var:<id>' in color fields, the original use), or content that fills a template (text, number, date, image, url, list). Content is referenced inline as '{{<id>}}' inside any string, or whole as 'var:<id>' in a field of the matching type; '\{{' writes a literal '{{'. A hex string is shorthand for a color variable. A variable with no 'value' is unfilled: ex...

_No named properties._


### Variable

- Type: `oneOf:ref:HexColor / ref:ColorVariable / ref:TextVariable / ref:NumberVariable / ref:DateVariable / ref:ImageVariable / ref:UrlVariable / ref:ListVariable`
- Required fields: none
- Purpose: A single named variable: a hex string (shorthand for a color variable) or an object whose 'type' is color, text, number, date, image, url or list. 'value' is the current value and is optional: a variable with no value is unfilled, which a template allows and a normal deck does not. 'example' only illustrates the slot (fill forms, template previews) and never reaches output.

_No named properties._


### ColorVariable

- Type: `object`
- Required fields: `type`
- Purpose: A named color. Content color fields reference it as 'var:<id>'. Colors resolve at render time through the ordinary color-reference path, so a color variable keeps working as before.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | yes | `const:"color"` | Variable kind. One of color, text, number, date, image, url or list. |
| `value` | no | `ref:HexColor` | Hex color this variable resolves to. |
| `required` | no | `boolean` | Whether the variable must be filled. Defaults to true: a variable with no 'value' is unfilled, and an unfilled required variable is an error in a normal deck and expected in a template. Set false for an optional slot:... |
| `label` | no | `string` | Optional short human label for forms and fill panels. |
| `description` | no | `string` | Optional prose describing what the variable is for, surfaced by pickers, fill forms and agents. |
| `example` | no | `ref:HexColor` | Illustrative color shown in fill forms and used when a template is previewed with examples. Never written to output. |


### TextVariable

- Type: `object`
- Required fields: `type`
- Purpose: Text content. Plain string or rich TextRun[]. Insert it inline as '{{<id>}}' inside any string (rich text is flattened to plain text there), or reference it whole as 'var:<id>' in a field that accepts string or TextRun[] (the rich runs are kept).

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | yes | `const:"text"` | Variable kind. One of color, text, number, date, image, url or list. |
| `value` | no | `oneOf:string / array<ref:TextRun>` | Text this variable resolves to: a plain string, or TextRun[] for rich text. |
| `required` | no | `boolean` | Whether the variable must be filled. Defaults to true: a variable with no 'value' is unfilled, and an unfilled required variable is an error in a normal deck and expected in a template. Set false for an optional slot:... |
| `label` | no | `string` | Optional short human label for forms and fill panels. |
| `description` | no | `string` | Optional prose describing what the variable is for, surfaced by pickers, fill forms and agents. |
| `example` | no | `oneOf:string / array<ref:TextRun>` | Illustrative text shown in fill forms and used when a template is previewed with examples. Never written to output. |


### NumberVariable

- Type: `object`
- Required fields: `type`
- Purpose: A number. '{{<id>}}' inserts it as text using 'format'; 'var:<id>' as a whole field supplies the number itself (chart values, font sizes).

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | yes | `const:"number"` | Variable kind. One of color, text, number, date, image, url or list. |
| `value` | no | `number` | Number this variable resolves to. |
| `required` | no | `boolean` | Whether the variable must be filled. Defaults to true: a variable with no 'value' is unfilled, and an unfilled required variable is an error in a normal deck and expected in a template. Set false for an optional slot:... |
| `label` | no | `string` | Optional short human label for forms and fill panels. |
| `description` | no | `string` | Optional prose describing what the variable is for, surfaced by pickers, fill forms and agents. |
| `example` | no | `number` | Illustrative number shown in fill forms and used when a template is previewed with examples. Never written to output. |
| `format` | no | `ref:NumberFormat` | Display pattern used by '{{<id>}}' (the shared NumberFormat syntax). A literal prefix, a numeric part of '#', '0', ',' and '.', and a literal suffix. '0' pads digits, '#' is optional, ',' groups thousands, digits afte... |


### NumberFormat

- Type: `string`
- Required fields: none
- Purpose: Number display pattern, shared by NumberVariable.format, data column formats (DataColumn.format) and table cell formats (StyledTableCell.format). An optional literal prefix, a numeric part of '#', '0', ',' and '.', and an optional literal suffix. '0' pads digits, '#' is optional, ',' groups thousands, digits after '.' fix the decimals ('0' required, '#' optional), and a '%' in the prefix or suffix multiplies the value by 100. English separators only. A format applies only to number values; st...

_No named properties._


### DateVariable

- Type: `object`
- Required fields: `type`
- Purpose: A calendar date as an ISO YYYY-MM-DD string. No time zone and no clock are involved. '{{<id>}}' inserts it formatted with 'format'.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | yes | `const:"date"` | Variable kind. One of color, text, number, date, image, url or list. |
| `value` | no | `string` | ISO calendar date (YYYY-MM-DD) this variable resolves to. |
| `required` | no | `boolean` | Whether the variable must be filled. Defaults to true: a variable with no 'value' is unfilled, and an unfilled required variable is an error in a normal deck and expected in a template. Set false for an optional slot:... |
| `label` | no | `string` | Optional short human label for forms and fill panels. |
| `description` | no | `string` | Optional prose describing what the variable is for, surfaced by pickers, fill forms and agents. |
| `example` | no | `string` | Illustrative ISO date shown in fill forms and used when a template is previewed with examples. Never written to output. |
| `format` | no | `string` | Date display pattern, the same LDML-style tokens as header/footer dateFormat: yyyy, yy, MMMM, MMM, MM, M, dd, d, EEEE, EEE and quoted literals. English names. Default 'MMMM d, yyyy'. |


### ImageVariable

- Type: `object`
- Required fields: `type`
- Purpose: An image source: any Asset (an 'asset:<id>' reference, HTTPS URL, data URI, relative or local path, or an object with src, alt and metadata). Reference it whole as 'var:<id>' in an image, asset or src field; '{{<id>}}' inserts the source string.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | yes | `const:"image"` | Variable kind. One of color, text, number, date, image, url or list. |
| `value` | no | `ref:Asset` | Image source this variable resolves to. |
| `required` | no | `boolean` | Whether the variable must be filled. Defaults to true: a variable with no 'value' is unfilled, and an unfilled required variable is an error in a normal deck and expected in a template. Set false for an optional slot:... |
| `label` | no | `string` | Optional short human label for forms and fill panels. |
| `description` | no | `string` | Optional prose describing what the variable is for, surfaced by pickers, fill forms and agents. |
| `example` | no | `ref:Asset` | Illustrative image source shown in fill forms and used when a template is previewed with examples. Never written to output. |


### UrlVariable

- Type: `object`
- Required fields: `type`
- Purpose: A link target (http, https, mailto or tel). Use it as '{{<id>}}' inside a link string or reference it whole as 'var:<id>' in a link field.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | yes | `const:"url"` | Variable kind. One of color, text, number, date, image, url or list. |
| `value` | no | `string` | Link target this variable resolves to. |
| `required` | no | `boolean` | Whether the variable must be filled. Defaults to true: a variable with no 'value' is unfilled, and an unfilled required variable is an error in a normal deck and expected in a template. Set false for an optional slot:... |
| `label` | no | `string` | Optional short human label for forms and fill panels. |
| `description` | no | `string` | Optional prose describing what the variable is for, surfaced by pickers, fill forms and agents. |
| `example` | no | `string` | Illustrative link shown in fill forms and used when a template is previewed with examples. Never written to output. |


### ListVariable

- Type: `object`
- Required fields: `type`
- Purpose: A list of strings, for bullets and list items. A whole-string array element 'var:<id>' splices every entry into the array in place; a whole field 'var:<id>' becomes the array; '{{<id>}}' joins the entries with ', ' (or the separator after a pipe: '{{<id>|; }}').

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | yes | `const:"list"` | Variable kind. One of color, text, number, date, image, url or list. |
| `value` | no | `array<string>` | Entries this variable resolves to. |
| `required` | no | `boolean` | Whether the variable must be filled. Defaults to true: a variable with no 'value' is unfilled, and an unfilled required variable is an error in a normal deck and expected in a template. Set false for an optional slot:... |
| `label` | no | `string` | Optional short human label for forms and fill panels. |
| `description` | no | `string` | Optional prose describing what the variable is for, surfaced by pickers, fill forms and agents. |
| `example` | no | `array<string>` | Illustrative entries shown in fill forms and used when a template is previewed with examples. Never written to output. |


### BackgroundShortcut

- Type: `oneOf:ref:ThemeBackgroundSlot / ref:HexColor / ref:ImageSource`
- Required fields: none
- Purpose: String shorthand for a background. Theme slots ('light1', 'light2', 'dark1', 'dark2') are equivalent to { type: 'theme', slot: value }; hex colors are equivalent to { type: 'solid', color: value }; an image source (starting with 'asset:', 'https://', 'data:', './' or '../') is equivalent to { type: 'image', src: value }, a cover image. Any other string is invalid.

_No named properties._


### ImageSource

- Type: `string`
- Required fields: none
- Purpose: An image source in a string shorthand: an 'asset:<id>' reference, an HTTPS URL, a data URI, or a relative path starting with './' or '../' (resolved against the OPF file location).

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
| `color` | yes | `ref:ColorRef` | Fixed solid fill color: a hex string, a color-scheme slot or role name, or a var:<id> variable reference (a ColorRef, resolved against the effective color scheme and the deck variables). Use { type: 'theme', slot: ...... |
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
- Required fields: `type`, `src`
- Purpose: Picture background: the image fills the whole canvas behind everything and never moves content (to push content aside, use an image block with placement). The string shorthand 'asset:x' (or any image source) is { type: 'image', src: 'asset:x' }, a cover image. Paint order: the colour scheme's default slide background, the picture, then the overlay, then furniture and content.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | yes | `const:"image"` | Picture background. |
| `src` | yes | `string` | Source for the background image: an 'asset:<id>' reference, HTTPS URL, data URI, or a relative path resolved against the OPF file location. |
| `alt` | no | `string` | Alternative text. A background with alt is meaningful: PowerPoint export draws it as a full-slide picture at the back that carries the text, so screen readers see it. Without alt it is decorative and exports as the na... |
| `fit` | no | `enum:cover \| contain \| stretch \| tile` | How the picture fills the canvas: 'cover' fills it and crops what overflows around focus; 'contain' shows the whole picture centered over the colour scheme's default background; 'stretch' scales it to the canvas exact... |
| `focus` | no | `ref:ImageFocus` | Point of the picture to keep in view when 'cover' crops it. Ignored by the other fits. |
| `opacity` | no | `number` | Picture opacity from 0 (fully transparent) to 1 (fully opaque); the overlay keeps its own opacity. Default 1. |
| `recolor` | no | `ref:ImageRecolor` | Grayscale or duotone treatment of the picture's pixels, as on an image block: recolor and opacity apply to the pixels, then the overlay is drawn above. |
| `overlay` | no | `ref:Overlay` | Scrim over the whole picture or a band along one edge (edge, size), beneath furniture and content, for example to keep a title readable over a busy photo. |


### ImageFocus

- Type: `object`
- Required fields: `x`, `y`
- Purpose: A point of a picture as fractions of its width and height, from the top-left corner. A cover fit centers this point in the frame as far as the picture still covers the frame, so it always stays in view: { x: 0.5, y: 0.5 } (the default) is a center crop, { x: 0, y: 0 } keeps the top-left corner.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `x` | yes | `number` | Horizontal position, 0 (left edge) to 1 (right edge). |
| `y` | yes | `number` | Vertical position, 0 (top edge) to 1 (bottom edge). |


### Overlay

- Type: `object`
- Required fields: `color`, `opacity`
- Purpose: Solid scrim over a picture: the whole frame in the frame's shape, or a band along one edge. Shared by image backgrounds and image blocks. Drawn directly above its picture and beneath headings and content; PowerPoint export writes one native shape above the picture.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `color` | yes | `ref:ColorRef` | Overlay fill color: a hex color (eight-digit hex keeps its alpha), a color-scheme slot or role name, or a 'var:<id>' variable reference. |
| `opacity` | yes | `number` | Overlay fill opacity. |
| `edge` | no | `enum:top \| bottom \| left \| right` | Cover only a band along this edge of the frame, for example a caption strip. Backgrounds and rectangle image frames only; on another shape the overlay is not drawn and composition reports unsupported-image-treatment.... |
| `size` | no | `number` | Band share of the frame for an edge overlay. Default 0.3. Ignored without edge. |


### ImagePlacement

- Type: `object`
- Required fields: `edge`
- Purpose: Bleeds an image block to one edge of the slide: the image takes a band along that edge, edge to edge, and the headings and other content compose in the rest of the slide at the normal padding. Only top-level blocks (slides.N.blocks.I) can be placed, at most one per edge; a layout's image placeholder may carry the same placement for the slide's image. Bands are taken in block order, each spanning the free area left by earlier ones. Placement is the only mechanism that moves content aside; a ba...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `edge` | yes | `enum:left \| right \| top \| bottom` | The slide edge the image bleeds to. |
| `size` | no | `number` | Share of the slide width (left, right) or height (top, bottom) given to the band. Default 0.5. |
| `inset` | no | `boolean` | Draw the frame inside the slide padding on every side of the band, like a card, instead of edge to edge. Default false. |


### ImageBorder

- Type: `object`
- Required fields: `color`, `width`
- Purpose: Solid line along the image frame's shape, centered on the outline with a miter join, like a native picture line. A thick dark border on a rounded portrait frame gives a device bezel.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `color` | yes | `ref:ColorRef` | Line color: a hex color, a color-scheme slot or role name, or a 'var:<id>' variable reference. |
| `width` | yes | `number` | Line width in reference pixels at a 720-pixel short edge. 0 removes the line. |


### ImageRecolor

- Type: `oneOf:const:"grayscale" / object`
- Required fields: none
- Purpose: Color treatment for the image pixels. Luminance uses Rec. 601 weights (0.299, 0.587, 0.114) on sRGB values.

_No named properties._


### PatternBackground

- Type: `object`
- Required fields: `type`, `pattern`
- Purpose: Fixed pattern slide background fill.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | yes | `const:"pattern"` | Fixed pattern background fill. |
| `pattern` | yes | `object` | Pattern fill definition. |
| `opacity` | no | `number` | Background opacity from 0 (fully transparent) to 1 (fully opaque). |


### OrganizationLogo

- Type: `object`
- Required fields: none
- Purpose: An organization's logo in up to four shapes. Each shape is a path or Asset, or { onLight, onDark } for the two backgrounds. A missing shape falls back to full, and full to the first defined of wordmark, stacked and icon; within a shape a missing onLight or onDark uses the other. Shapes are placed with slide-scoped references such as 'var:organization.logo.icon'.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `full` | no | `ref:LogoSource` | The full logo (lockup): mark and name side by side. Drawn on cover and section slides, and placed by 'var:organization.logo'. |
| `stacked` | no | `ref:LogoSource` | The stacked lockup: mark above the name, for portrait or square slots. Placed by 'var:organization.logo.stacked'. |
| `icon` | no | `ref:LogoSource` | The mark or symbol without the name, for tight spaces such as header and footer zones and picture bullets. Placed by 'var:organization.logo.icon'. |
| `wordmark` | no | `ref:LogoSource` | The name set in the brand's lettering, without the mark. Placed by 'var:organization.logo.wordmark'. |


### LogoSource

- Type: `oneOf:ref:Asset / object`
- Required fields: none
- Purpose: One logo shape: a path or Asset for every background, or { onLight, onDark }. onLight is drawn on light backgrounds (usually dark artwork) and onDark on dark backgrounds (usually light artwork), by each slide's background; a missing one uses the other.

_No named properties._


### Watermark

- Type: `oneOf:schema / schema`
- Required fields: `opacity`
- Purpose: Decorative watermark: an image ('src') or a text stamp ('text'), exactly one of the two, with its opacity. An image is drawn once per slide, contained and centered in a fixed frame (the middle 40% of the slide width and height, from 30% to 70% on each axis). A text watermark is one line of text in the heading font and the theme text color at the given opacity, centered on the slide and rotated 30 degrees counterclockwise (rising to the right), sized to span at most 70% of the slide width and...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `src` | no | `string` | Source for the watermark image: an 'asset:<id>' reference, HTTPS URL, data URI, relative path or local path, as for Asset.src. Exactly one of src and text is set. |
| `text` | no | `string` | Text for a text watermark, such as DRAFT or CONFIDENTIAL; line breaks are drawn as spaces. Exactly one of src and text is set. |
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
- Purpose: One header/footer zone. Every configured field renders, side by side in one row in the order image, text, socials, date (mirrored in a right-to-left deck), aligned to the zone's edge (left, center or right) and vertically centered on each other; a line break inside text or socials ('\n') stacks lines within that part. When the parts are wider than the zone their text wraps, and a row that cannot fit even so is reported as overflow. Generated values such as the slide number, the slide count, t...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `text` | no | `string` | Text rendered in this zone. Variables resolve inside it like any string: deck-wide ones ('{{organization.name}}', '{{speaker.name}}, {{speaker.title}}', '{{customer}}') before composition, and the slide-scoped built-i... |
| `image` | no | `ref:Asset` | Image rendered first in this zone's row, such as a logo, partner mark, certification badge, or icon: a path, URL or Asset, or an organization logo reference ('var:organization.logo.icon', 'var:organization.<id>.logo.w... |
| `date` | no | `oneOf:boolean / string` | true renders the current date: the renderer or exporter must be given an explicit ISO date by its host (core never reads a clock). PPTX export writes a native date field only for a supported dateFormat whose complete... |
| `dateFormat` | no | `string` | Date pattern for date. Tokens: yyyy (2026), yy (26), MMMM (April), MMM (Apr), MM (04), M (4), dd (09), d (9), EEEE (Thursday), EEE (Thu). Text in single quotes and other non-letter characters are literal. Month and we... |
| `socials` | no | `boolean` | Whether to render the primary organization's social profiles from organization.socials, one line per platform in key order. A handle is formatted through the platform's socialPlatforms record (companyUrlPattern, else... |


### Slide

- Type: `object`
- Required fields: none
- Purpose: A single slide. Content can be authored as a full-slide root payload, or inside promoted named region keys such as 'left', 'center+right', and 'top:left'.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | no | `string` | Optional stable identifier for the slide within the document. Use when another system needs to reference a slide across edits, comments, generation state, exports, or narrative tooling. Slide order is defined by the s... |
| `type` | no | `enum:text \| list \| image \| chart \| table \| video \| code \| metric \| quote \| timeline` | Optional full-slide content kind. When omitted, engines infer the kind from root payload fields. |
| `beat` | no | `oneOf:string / array<string>` | Optional reference to one or more beats of the deck's narrative (each value is the id of a beat in the narrative record that the root 'narrative' resolves to). A single string declares the slide's primary beat; an arr... |
| `layout` | no | `ref:CatalogReference` | Optional layout: a layouts reference, a bare id ('title-subtitle') or 'name:id' ('acme:hero'). When omitted, the slide is composed with no layout record: engines arrange title, subtitle, tag and content automatically,... |
| `title` | no | `oneOf:string / array<ref:TextRun>` | Slide-level title content. When the resolved layout exposes a 'title' placeholder, the engine renders this value there. Use a string for plain text or TextRun[] for inline rich text (a colored word, bold, a link, a ci... |
| `subtitle` | no | `oneOf:string / array<ref:TextRun>` | Slide-level subtitle or supporting line. When the resolved layout exposes a 'subtitle' placeholder, the engine renders this value there. Use a string for plain text or TextRun[] for inline rich text (a colored word, b... |
| `tag` | no | `oneOf:string / array<ref:TextRun>` | Small slide-level label or badge. When the resolved layout exposes a 'tag' placeholder, the engine renders this value there. Use a string for plain text or TextRun[] for inline rich text (a colored word, bold, a link,... |
| `text` | no | `oneOf:string / array<ref:TextRun>` | Full-slide text payload. Use a string for plain text or TextRun[] for inline rich text. TextRun items may be plain strings or formatted run objects. |
| `items` | no | `array<ref:ListItem>` | Full-slide structured list payload. Presence of this field infers type 'list'. Entries are strings, TextRun[] or objects with `text`, optional `description` (supporting detail under the entry), `level` and `start`. Us... |
| `bullets` | no | `array<ref:BulletItem>` | Full-slide prose bullet payload: short talking points, each standing alone. Presence of this field infers type 'text', so it may sit beside `text` in one payload. Entries are strings, TextRun[] or objects with `text`,... |
| `numbering` | no | `ref:NumberingSpec` | Number the full-slide `items` or `bullets` instead of bulleting them. A style name (arabic, roman-upper, roman-lower, alpha-upper, alpha-lower) or a Numbering object applies to every list level; an array gives one ent... |
| `image` | no | `ref:Asset` | Shorthand for one image block: the picture composes as body content, like { type: 'image', image: value }, with the effective design.imageFit. A layout's image placeholder may place it along an edge (placement). For f... |
| `video` | no | `ref:Asset` | Full-slide video source. Presence of this field infers type 'video'. Engines do not play video: the preview draws a placeholder (a play badge with the asset's title or source as its caption), and PPTX export draws the... |
| `chart` | no | `ref:Chart` | Full-slide chart payload. Presence of this field infers type 'chart'. |
| `table` | no | `ref:Table` | Full-slide table payload. Presence of this field infers type 'table'. |
| `code` | no | `oneOf:string / ref:Code` | Full-slide code payload. A string is shorthand for { "source": value }; object form carries optional syntax language and filename metadata. |
| `metric` | no | `oneOf:string / number / ref:Metric` | Full-slide metric payload. A string or number is shorthand for { "value": value }; object form carries optional label, description, unit, delta, trend, and sentiment metadata. Numeric values remain numbers; renderers... |
| `quote` | no | `oneOf:string / ref:Quote` | Full-slide quote payload. A string is shorthand for { "text": value }; object form carries optional attribution and source metadata. Presence of this field infers type 'quote'. |
| `timeline` | no | `ref:Timeline` | Full-slide timeline payload. An array is shorthand for { "events": value }; object form carries optional name and description metadata. Presence of this field infers type 'timeline'. |
| `caption` | no | `ref:Caption` | Caption for the slide's root image, chart, table or video payload. Valid only when the slide root holds exactly one of those payloads. |
| `blocks` | no | `array<ref:ContentPayload>` | Layout-agnostic content blocks rendered together as a composed payload when exact placement is unspecified. At slide root, multiple content payload kinds with no explicit type, blocks, or regions are accepted as short... |
| `design` | no | `ref:SlideDesign` | Slide-level design applied on top of the deck-wide design. |
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
| `section` | no | `string` | PowerPoint-style slide section label. Consecutive slides with the same value belong to the same section in presenter view, outlines, and PowerPoint section-aware exports. Also the slide-scoped built-in variable '{{sli... |
| `hidden` | no | `boolean` | Whether the slide is hidden from the presented sequence. The player skips it, the PPTX export writes it as a hidden slide, and per-slide image and PDF output skips it unless the caller asks to include hidden slides (o... |
| `composition` | no | `ref:Composition` |  |
| `extensions` | no | `object` | Custom data passthrough for agent workflows at slide scope; ignored by the engine but preserved across read/write round-trips. Use for review state, generation provenance, or authoring conventions such as { "authoring... |


### ContentPayload

- Type: `allOf:schema + schema + schema + schema + schema + schema + schema + schema + schema + schema + schema + schema`
- Required fields: none
- Purpose: A content leaf or recursively composed group. A group contains blocks and optional composition; it cannot mix blocks with leaf payload fields. Groups may nest up to 32 levels.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | no | `string` | Optional stable identifier for this payload, unique among slide and payload ids in the document. Use when another system needs to address the payload across edits patch-style agent edits, comments, review state, or ge... |
| `extensions` | no | `object` | Custom data passthrough for agent workflows at payload scope; ignored by the engine but preserved across read/write round-trips. |
| `type` | no | `enum:text \| list \| image \| chart \| table \| video \| code \| metric \| quote \| timeline \| group` | Optional content kind. When omitted, engines infer the kind from the fields present. |
| `text` | no | `oneOf:string / array<ref:TextRun>` | Text payload. Use a string for plain text or TextRun[] for inline rich text. TextRun items may be plain strings or formatted run objects. |
| `items` | no | `array<ref:ListItem>` | Structured list payload (type 'list'). Each item is either a plain string, a TextRun[] rich text sequence, or a ListItem object with optional `description`. List nesting uses item.level rather than nested content payl... |
| `bullets` | no | `array<ref:BulletItem>` | Prose bullet payload: short talking points, each standing alone. Presence of this field infers type 'text', so it may sit beside `text` in one payload. Entries have no `description`; use `items` for entries with suppo... |
| `numbering` | no | `ref:NumberingSpec` | Number the payload's `items` or `bullets` instead of bulleting them. A style name (arabic, roman-upper, roman-lower, alpha-upper, alpha-lower) or a Numbering object applies to every list level; an array gives one entr... |
| `image` | no | `ref:Asset` | Source for an image item. |
| `fit` | no | `enum:cover \| contain \| stretch` | Image payloads only. How the picture fills its frame: 'cover' fills it and crops what overflows around focus; 'contain' shows the whole picture centered; 'stretch' scales it to the frame exactly. Default: the effectiv... |
| `focus` | no | `ref:ImageFocus` | Image payloads only. Point of the picture to keep in view when 'cover' crops it. Ignored by the other fits. |
| `aspectRatio` | no | `number` | Image payloads only. Width-to-height ratio of the frame: the frame becomes the largest centered box with this ratio inside the block's region, for example 2.39 for a cinematic letterbox or 0.5 for a phone-shaped frame... |
| `shape` | no | `enum:rectangle \| rounded \| circle \| hexagon` | Image payloads only. Mask applied to the frame, exported as the picture's native preset geometry (rect, roundRect, ellipse, hexagon). 'circle' makes the frame square. Default 'rectangle'. |
| `cornerRadius` | no | `number` | Image payloads only. Corner radius for shape 'rounded' as a fraction of the frame's shorter side. Default 0.16667, PowerPoint's roundRect default. |
| `border` | no | `ref:ImageBorder` | Image payloads only. Line along the frame's shape. |
| `opacity` | no | `number` | Image payloads only. Picture opacity from 0 to 1, exported as a native alphaModFix. The border and overlay keep their own opacity. Default 1. |
| `recolor` | no | `ref:ImageRecolor` | Image payloads only. Grayscale or duotone treatment of the picture's pixels. |
| `overlay` | no | `ref:Overlay` | Image payloads only. Scrim over the picture in the frame's shape, or a band along one edge of a rectangle frame. |
| `placement` | no | `ref:ImagePlacement` | Image payloads only, and only on a top-level block (slides.N.blocks.I), at most one per edge. Bleeds the image to one slide edge; the headings and the other blocks compose in the rest of the slide. |
| `video` | no | `ref:Asset` | Source for a video item. Engines do not play video: the preview draws a placeholder (a play badge with the asset's title or source as its caption), and PPTX export draws the same placeholder as native shapes linked to... |
| `chart` | no | `ref:Chart` | Chart payload. Presence of this field infers type 'chart'. |
| `table` | no | `ref:Table` | Table payload. Presence of this field infers type 'table'. |
| `code` | no | `oneOf:string / ref:Code` | Code payload. A string is shorthand for { "source": value }; object form carries optional syntax language and filename metadata. |
| `metric` | no | `oneOf:string / number / ref:Metric` | Metric payload. A string or number is shorthand for { "value": value }; object form carries optional label, description, unit, delta, trend, and sentiment metadata. Numeric values remain numbers; renderers format them... |
| `quote` | no | `oneOf:string / ref:Quote` | Quote payload. A string is shorthand for { "text": value }; object form carries optional attribution, role, photo and source metadata. |
| `timeline` | no | `ref:Timeline` | Timeline payload ordered by narrative or chronology. |
| `caption` | no | `ref:Caption` | Caption for an image, chart, table or video payload, composed inside the block's region (below the media by default). Invalid on other payload kinds and on groups. |
| `blocks` | no | `array<ref:ContentPayload>` | Ordered children of a group. Each child is a leaf or another group. |
| `composition` | no | `ref:Composition` | Arrangement within this group. Only minFontSize and overflow inherit from the parent; strict overflow cannot be weakened. |


### Quote

- Type: `object`
- Required fields: `text`
- Purpose: Quote content with optional attribution metadata. Use 'text' for the quoted text, 'attribution' for the credited person or organization, 'role' for that person's title and organization, 'photo' for their headshot and 'source' for a citation or URL. A string value in a quote field is shorthand for { "text": value }.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `text` | yes | `oneOf:string / array<ref:TextRun>` | Quoted text: a string, or TextRun[] for inline rich text (a colored phrase, bold, a link, or a citation or footnote marker). The engine draws the surrounding quotation marks. |
| `attribution` | no | `string` | Person or organization credited for the quote. Drawn after the quote text, in the muted text color. |
| `role` | no | `string` | Title and organization of the attributed person. Drawn on its own line under the attribution; without an attribution it stands alone. It does not replace the attribution, so the person's name belongs in 'attribution'. |
| `photo` | no | `ref:Asset` | Headshot of the attributed person, drawn as a circle beside the attribution and role lines (on the end side in a right-to-left deck). Give it alt text (validate's opf/missing-alt-text rule checks it). A raster photogr... |
| `source` | no | `string` | Optional quote source, citation, or URL. Follows the attribution and role after ' - '. |


### Code

- Type: `object`
- Required fields: `source`
- Purpose: Code content with optional rendering metadata. Use 'source' for the code text, 'language' for syntax highlighting, 'filename' when the rendered block should show a file label, and 'highlight' to emphasize lines. A string value in a code field is shorthand for { "source": value }.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `source` | yes | `string` | Source code text to display. |
| `language` | no | `string` | Language identifier used for syntax highlighting. |
| `filename` | no | `string` | Optional file label shown with the code block. |
| `highlight` | no | `array<oneOf:integer / array<integer>>` | Source lines to emphasize, 1-based: each entry is a line number or an inclusive [start, end] range, so [3, [5, 7]] marks lines 3 and 5 to 7. Lines are counted by line break in 'source', so a line that wraps stays one... |


### Metric

- Type: `object`
- Required fields: `value`
- Purpose: Metric content with optional display metadata. Use 'value' for the primary value, 'label' for the metric name, 'description' for supporting context, 'unit' for a suffix/currency marker, 'delta' for change, 'trend' for direction, and 'sentiment' for whether the change is good news. A string or number value in a metric field is shorthand for { "value": value }; numeric values remain numbers and are formatted by renderers.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `value` | yes | `oneOf:string / number` | Primary metric value. |
| `label` | no | `string` | Metric label. |
| `description` | no | `string` | Optional supporting context for the metric. |
| `unit` | no | `string` | Metric unit, suffix, or currency marker. |
| `delta` | no | `oneOf:string / number` | Metric change value. |
| `trend` | no | `enum:up \| down \| flat` | Metric trend direction. The preview and the PowerPoint export draw an arrow beside the trend word that always points the way the trend does (up, down or flat) and colour the arrow, the trend word and the delta text by... |
| `sentiment` | no | `enum:positive \| negative \| neutral` | Whether the change is good news. Positive draws the trend arrow and the trend and delta text in green, negative in red and neutral in the neutral text colour, each kept at 4.5:1 contrast or more against the slide back... |


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
| `status` | no | `enum:done \| current \| planned` | Progress of the event, drawn from the deck's own colors by both the SVG renderer and the PPTX exporter. Absent means no status and the event is drawn as a plain filled marker with normal text, which is also how 'done'... |


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


### NumberingStyle

- Type: `enum:arabic | roman-upper | roman-lower | alpha-upper | alpha-lower`
- Required fields: none
- Purpose: A list number style: 1, 2, 3; I, II, III; i, ii, iii; A, B, C; a, b, c. Alphabetic numbering past 26 repeats the letter as PowerPoint does (aa, bb, cc). Roman numerals stop at 3999; larger values are drawn in arabic with a numbering-adapted diagnostic.

_No named properties._


### Numbering

- Type: `object`
- Required fields: none
- Purpose: Numbering of one list level.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `style` | no | `ref:NumberingStyle` | Number style. Default arabic. |
| `start` | no | `integer` | First number counted at this level. Default 1. Native PowerPoint accepts 1 to 32767. |
| `suffix` | no | `enum:period \| paren \| paren-both` | Text after the number: period (1.), paren (1)) or paren-both ((1)). Default period. |


### NumberingSpec

- Type: `oneOf:ref:NumberingStyle / ref:Numbering / array<oneOf:ref:NumberingStyle / ref:Numbering>`
- Required fields: none
- Purpose: The value of a numbering field: a style name or Numbering object for every level, or an array with one entry per level (at most 9, the native depth).

_No named properties._


### TextRun

- Type: `oneOf:string / object`
- Required fields: none
- Purpose: A contiguous run of text. Strings cover unformatted spans; object form adds character formatting.

_No named properties._


### Caption

- Type: `oneOf:string / array<ref:TextRun> / object`
- Required fields: none
- Purpose: A caption for an image, chart, table or video payload. A string or TextRun[] is the caption text placed below the media; object form adds the position and alignment.

_No named properties._


### Reference

- Type: `object`
- Required fields: `id`, `text`
- Purpose: A source that runs cite with 'cite'. Cited references are listed in the footnote area of the slides that cite them, numbered per deck in order of first use; referencesSlide() builds an ordinary list slide of them.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | yes | `string` | Identifier runs cite. Unique within the references list. |
| `text` | yes | `oneOf:string / array<ref:TextRun>` | The reference as it is listed: a string or TextRun[] for inline rich text. |
| `url` | no | `string` | Optional link for the reference; a references slide links its entry to it. |


### Chart

- Type: `object`
- Required fields: `type`, `data`
- Purpose: Chart content. The chart object keeps chart-specific fields together so slides and regions do not expose loose chart fields.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | yes | `enum:100pct-stacked-area \| 100pct-stacked-bar \| 100pct-stacked-column \| area \| bar \| box-and-whisker \| column \| combo \| doughnut \| filled-radar \| funnel \| histogram \| line \| line-with-markers \| pareto \| pie \| radar \| radar-with-markers \| scatter \| stacked-area \| stacked-bar \| stacked-column \| stacked-line \| stacked-line-with-markers \| treemap \| waterfall \| world` | Chart type, an engine vocabulary validated directly (no catalog lookup): the chart types Aspose.Slides officially supports, plus 'combo' (clustered columns with line series, see 'line' and 'secondaryAxis'). Each engin... |
| `data` | yes | `oneOf:ref:ChartData / ref:DatasetRef` | Chart data. Inline data uses a tabular columns/rows shape; renderers convert rows to chart series internally. A DatasetRef ({ "dataset": "<id>" }) plots a top-level dataset instead. Data from a spreadsheet or file is... |
| `mapping` | no | `ref:ChartMapping` | Optional series mapping by column name: which column is the category, which is the X column of a scatter chart, and which columns are plotted, in order. Absent keeps the positional rule (first column the category, the... |
| `line` | no | `array<string>` | Combo charts only (type 'combo'): the plotted series, by column name, that are drawn as lines with markers; every other plotted series is drawn as clustered columns. Absent: the last plotted series is the line. A comb... |
| `secondaryAxis` | no | `array<string>` | Combo charts only: line series, by column name, plotted against a secondary value axis at the right of the plot. That axis has its own scale, and its tick labels use the number format of the first secondary series' co... |
| `axisTitles` | no | `ref:ChartAxisTitles` | Optional axis titles. Absent keeps today's untitled axes. Supported on the chart types that have a category/value (or X/Y) axis pair (column, bar, line, area, scatter, and the histogram, pareto, waterfall and box-and-... |
| `legend` | no | `enum:none \| top \| bottom \| left \| right` | Optional legend position. 'none' hides the legend. Absent keeps today's behaviour exactly (a legend at the right of multi-series charts and of pie and doughnut charts, none for single-series charts). A named position... |
| `dataLabels` | no | `oneOf:boolean / ref:ChartDataLabels` | Optional data labels. true shows value labels at each type's default position, false (or absent) shows none, which is today's behaviour. Use the object form for the label content, position and separator. |
| `alt` | no | `string` | Text alternative for the chart: what the data shows (the point and the key numbers), not 'a chart' or 'bar chart'. The preview exposes it as the chart's accessible name (role img with aria-label) and the PowerPoint ex... |
| `highlight` | no | `ref:ChartHighlight` | Optional emphasis: the series and/or categories that carry the message. The engines draw the highlighted marks in the deck's primary (accent) color and every other mark in a muted neutral derived from the theme (a lig... |


### ChartAxisTitles

- Type: `object`
- Required fields: none
- Purpose: Titles for the axes of a chart. 'category' is the axis that carries the row labels (the horizontal axis of a column or line chart, the vertical axis of a bar chart, the X axis of a scatter chart); 'value' is the other axis; 'secondary' is the secondary value axis of a combo chart.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `category` | no | `string` | Title of the category (X) axis. |
| `value` | no | `string` | Title of the value (Y) axis. On a combo chart, the primary (left) value axis. |
| `secondary` | no | `string` | Combo charts only: title of the secondary value axis at the right of the plot, drawn rotated like the primary value axis title. Dropped with a 'chart-option-adapted' diagnostic on any other chart type and on a combo c... |


### ChartHighlight

- Type: `object`
- Required fields: none
- Purpose: Which series and categories a chart emphasizes. Names are matched exactly: series by data column name (after any 'fields' selection; a series is a plotted value column), categories by row label (the first column, or mapping.category), as text. A category label shared by several rows highlights each of them.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `series` | no | `array<string>` | Series (value columns) to highlight: all marks of each named series. A name that is not a column is a 'chart-highlight-unknown-name' error; a column that is not plotted as a series (the category or X column, or one ma... |
| `categories` | no | `array<string>` | Categories (row labels) to highlight: the marks of each named category (a column or bar of every series, a line's points, a pie or doughnut slice). A label no row has is a 'chart-highlight-unknown-name' error. |


### ChartDataLabels

- Type: `object`
- Required fields: none
- Purpose: Data label settings. A label shows the selected content parts in the fixed order category, value, percent, joined by the separator.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `content` | no | `array<enum:value \| percent \| category>` | Which parts a label shows. Defaults to ['value']. 'percent' is the share of the total and exists only on pie and doughnut charts; 'category' shows the category name (the X value on a scatter chart). A part a chart typ... |
| `position` | no | `enum:auto \| center \| inside-end \| inside-base \| outside-end \| above \| below \| left \| right` | Where a label sits relative to its mark. 'auto' (the default) is the type's default: outside-end for clustered columns and bars, pie slices and the histogram, pareto and waterfall constructs; center for stacked column... |
| `separator` | no | `string` | Text between the parts of a label that shows more than one. Defaults to ', '. |


### Table

- Type: `object`
- Required fields: none
- Purpose: Table content, inline or dataset-backed. An inline table has 'rows' (required) and optional 'columns'. A dataset-backed table has 'dataset' (required) and optional 'fields', and no 'rows' or 'columns': it takes its headers, rows and column formats from the dataset (per-cell styles need an inline table).
- Conditional requirement: `dataset`, or otherwise `rows`

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `columns` | no | `array<oneOf:string / array<ref:TextRun> / ref:StyledTableCell / ref:DataColumn / null>` | Optional column labels. Labels may be strings, rich runs, styled cell objects or DataColumn objects ({ "name", "format" }). A header's 'format' (DataColumn or StyledTableCell) is the column's number format; a body cel... |
| `rows` | no | `array<array<ref:TableCell>>` | Two-dimensional table row data; each row aligns by index with columns when columns are supplied. |
| `dataset` | no | `ref:DatasetId` | Id of a top-level dataset that supplies this table's headers, rows and column formats. Excludes 'rows' and 'columns'. An unknown id is a 'dataset-unknown' error. |
| `fields` | no | `ref:DatasetFields` | Dataset tables only: the dataset columns to show, by name and in order. Absent shows every column. An unknown name is a 'dataset-field-unknown' error. |
| `alt` | no | `string` | Text alternative for the table: what it shows (the point and the key numbers), not 'a table'. The preview exposes it as the table's accessible name (role group with aria-label; the cells stay readable) and the PowerPo... |


### ChartData

- Type: `object`
- Required fields: `columns`, `rows`
- Purpose: Inline tabular data driving a chart. The first column usually supplies category/x-axis labels; subsequent columns are plotted measures unless 'chart.mapping' or a chart type maps them differently. Value cells are numbers; a string is read only in strict decimal syntax ('12', '-3.5', '1e6'), and anything else ('12%', '$5', '(5)', '1,234') is a gap and a 'chart-value-not-numeric' warning.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `columns` | yes | `array<oneOf:string / ref:DataColumn>` | Ordered column labels for the chart data table. A label is a string or a DataColumn ({ "name", "format" }) whose number format the data labels, value axis and exported workbook use. |
| `rows` | yes | `array<array<ref:ChartDataCell>>` | Tabular chart rows. Each row aligns by index with columns. |
| `source` | no | `ref:DataSourceRef` | Optional provenance: where this inline data came from. Engines never read, fetch or refresh it; they keep it through editing, export and re-import. |


### DataColumn

- Type: `object`
- Required fields: `name`
- Purpose: A named data column with an optional number format. Anywhere a chart or dataset column is a string it may be a DataColumn; the string form is { "name": value } with no format. A table column header may also be a DataColumn.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `name` | yes | `string` | Column label, used as the series name, the table header and the name 'fields' and 'chart.mapping' address. |
| `format` | no | `ref:NumberFormat` | Number format of the column's number values (data labels, value axis, table cells, exported workbook). Absent: the General form. |


### DataSourceRef

- Type: `object`
- Required fields: `src`
- Purpose: Provenance of inline data or a dataset: the file, sheet and range it came from and when. Engines never read, fetch or refresh it; they keep it through editing, export and re-import. Re-import the data to update it.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `src` | yes | `string` | Where the data came from: an 'asset:<id>' reference, a URL, or a relative or local path. |
| `sheet` | no | `string` | Sheet or table name inside a spreadsheet source. |
| `range` | no | `string` | A1-style range inside a spreadsheet source. |
| `fields` | no | `array<string>` | The source fields the data was taken from, in order. |
| `retrieved` | no | `anyOf:schema / schema` | When the data was taken from the source: an ISO 8601 date or date-time. |
| `description` | no | `string` | Free-form note about the source. |


### DatasetId

- Type: `string`
- Required fields: none
- Purpose: Id of an entry in the top-level datasets map (the assets id pattern).

_No named properties._


### DatasetFields

- Type: `array<string>`
- Required fields: none
- Purpose: Dataset column names to use, in order, each at most once. Selects and orders the dataset's columns; an unknown name is a 'dataset-field-unknown' error.

_No named properties._


### Datasets

- Type: `object`
- Required fields: none
- Purpose: Shared data tables keyed by id (the assets id pattern). Charts reference one with 'chart.data': { "dataset": "<id>" } and tables with 'table': { "dataset": "<id>" }.

_No named properties._


### Dataset

- Type: `object`
- Required fields: `columns`, `rows`
- Purpose: One shared data table: named columns (strings or DataColumn objects with a number format) and rows of scalar cells. Column names are unique ('data-column-duplicate' error). Rich text and styling belong in an inline table.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `title` | no | `string` | Human name of the dataset, shown by editors. |
| `description` | no | `string` | What the dataset holds. |
| `columns` | yes | `array<oneOf:string / ref:DataColumn>` | Ordered, uniquely named columns. |
| `rows` | yes | `array<array<ref:ChartDataCell>>` | Rows of scalar cells (string, number, boolean, null); each row aligns by index with columns. |
| `source` | no | `ref:DataSourceRef` | Optional provenance. Engines never read, fetch or refresh it. |


### DatasetRef

- Type: `object`
- Required fields: `dataset`
- Purpose: Chart data taken from a top-level dataset. Engines inline it before plotting; 'chart.mapping' names columns after the 'fields' selection.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `dataset` | yes | `ref:DatasetId` | Id of the dataset. An unknown id is a 'dataset-unknown' error. |
| `fields` | no | `ref:DatasetFields` | The dataset columns to use, by name and in order. Absent uses every column. |


### ChartMapping

- Type: `object`
- Required fields: none
- Purpose: Series mapping by column name (after any 'fields' selection). Mapping only selects and orders columns; pie, doughnut and other single-series constructs still plot one series. An unknown name is a 'chart-mapping-unknown-column' error; a series that repeats the category or X column, and an X column on a chart type without an X axis, are dropped with a 'chart-mapping-adapted' warning.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `category` | no | `string` | The label (category) column. Default: the first column. |
| `x` | no | `string` | The X column of an XY (scatter) chart. Default: the second column (the first, when the category is the second column), and only when there are three or more columns: with two, the second column is the one series, plot... |
| `series` | no | `array<string>` | The plotted columns, in order. Default: every column that is not the category or the X column. |


### ChartDataCell

- Type: `oneOf:string / number / boolean / null`
- Required fields: none
- Purpose: A cell in inline chart data.

_No named properties._


### TableCell

- Type: `oneOf:ref:TableCellValue / ref:StyledTableCell`
- Required fields: none
- Purpose: A scalar, rich-run array, or styled/spanning cell object. Existing scalar and rich forms remain valid.

_No named properties._


### TableCellValue

- Type: `oneOf:string / number / boolean / null / array<ref:TextRun>`
- Required fields: none
- Purpose: A scalar table value or canonical rich text runs, without cell decoration or geometry.

_No named properties._


### StyledTableCell

- Type: `object`
- Required fields: `value`
- Purpose: A cell with explicit visual style or merged geometry. Its position remains its array column index; use null placeholders for every covered grid position.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `value` | yes | `ref:TableCellValue` | Editable cell content; styling and spans do not change its scalar type or rich runs. |
| `style` | no | `ref:TableCellStyle` |  |
| `colSpan` | no | `integer` | Number of grid columns covered, starting at this cell. Covered positions must contain null. Default 1. |
| `rowSpan` | no | `integer` | Number of grid rows covered, starting at this cell. Covered positions must contain null. Header cells cannot span into body rows. Default 1. |
| `format` | no | `ref:NumberFormat` | Number format. On a body cell it formats that cell's number value (and wins over the column's format); on a header cell (in 'columns') it is the column's format, the same as a DataColumn header. Strings, booleans, nul... |


### TableCellStyle

- Type: `object`
- Required fields: none
- Purpose: Cell appearance. Sizes use reference pixels at a 720-pixel canvas short edge and scale with the slide.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `fill` | no | `ref:ColorRef` | Cell background: a hex color, a color-scheme slot or role name, or a 'var:<id>' variable reference. Eight-digit hex colors include alpha; #00000000 is transparent. |
| `color` | no | `ref:ColorRef` | Default text color, overridden by individual rich run colors. Accepts a hex color, a color-scheme slot or role name, or a 'var:<id>' variable reference. |
| `align` | no | `enum:left \| center \| right` | Horizontal text alignment inside the cell. |
| `verticalAlign` | no | `enum:top \| middle \| bottom` | Vertical alignment inside the padded cell box. |
| `padding` | no | `ref:TableCellPadding` |  |
| `borders` | no | `object` | Independent cell edges. Omitted edges retain the table theme border; width 0 removes an edge. |


### TableCellPadding

- Type: `object`
- Required fields: none
- Purpose: Text insets in reference pixels. Defaults: top 8, right 10, bottom 4, left 10.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `top` | no | `number` |  |
| `right` | no | `number` |  |
| `bottom` | no | `number` |  |
| `left` | no | `number` |  |


### TableCellBorder

- Type: `object`
- Required fields: `color`, `width`
- Purpose: One explicit cell border.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `color` | yes | `ref:ColorRef` | Border color: a hex color, a color-scheme slot or role name, or a 'var:<id>' variable reference. Eight-digit hex colors include alpha; #00000000 is transparent. |
| `width` | yes | `number` | Border width in reference pixels; 0 removes this edge. |
| `dash` | no | `enum:solid \| dash \| dot` | Default solid. |


### Catalogs

- Type: `object`
- Required fields: none
- Purpose: The catalog records a document embeds, grouped by the catalog they came from. Each property is a group; inside a group, records are keyed by kind and then by id. - 'default': the catalog bare ids come from. It needs a 'source' when it holds records. Omitted: bare ids fall back to the host's default catalog. false: no catalog fallback, so every bare id must be embedded (under 'custom' or 'default'). - 'custom': the records the document defines itself. It has no source. - any other name ('acme'...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `default` | no | `oneOf:allOf:ref:CatalogGroup + schema / const:false` | The catalog bare ids come from: its source and the records of it this document embeds. false turns off the catalog fallback for bare ids. |
| `custom` | no | `allOf:ref:CatalogGroup + schema` | Records the document defines itself, referenced by bare id. Checked first for every bare id. Forking a catalog record copies it here under a new id, so the change of ownership is visible. |


### CatalogGroup

- Type: `object`
- Required fields: none
- Purpose: One catalog group: the catalog's source and the records of it the document embeds, by kind and then by id.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `source` | no | `ref:CatalogSource` |  |
| `layouts` | no | `ref:CatalogRecords` | Layout records keyed by id, each with the fields of https://openpresentation.org/schema/opf-layout/v1. Referenced from Slide.layout. |
| `themes` | no | `ref:CatalogRecords` | Theme records keyed by id, each with the fields of https://openpresentation.org/schema/opf-theme/v1. Referenced from design.theme. |
| `colorSchemes` | no | `ref:CatalogRecords` | Colour-scheme records keyed by id, each with the fields of https://openpresentation.org/schema/opf-color-scheme/v1. Referenced from design.colorScheme and a theme's colorScheme. |
| `fontSchemes` | no | `ref:CatalogRecords` | Font-scheme records keyed by id, each with the fields of https://openpresentation.org/schema/opf-font-scheme/v1. Referenced from design.fontScheme, a theme's fontScheme and a language's font schemes. |
| `narratives` | no | `ref:CatalogRecords` | Narrative records keyed by id, each with the fields of https://openpresentation.org/schema/opf-narrative/v1. Referenced from narrative. |
| `audiences` | no | `ref:CatalogRecords` | Audience records keyed by id, each with the fields of https://openpresentation.org/schema/opf-audience/v1. Referenced from audience. |
| `purposes` | no | `ref:CatalogRecords` | Purpose records keyed by id, each with the fields of https://openpresentation.org/schema/opf-purpose/v1. Referenced from purpose. |
| `tones` | no | `ref:CatalogRecords` | Tone records keyed by id, each with the fields of https://openpresentation.org/schema/opf-tone/v1. Referenced from tone. |


### CatalogSource

- Type: `string`
- Required fields: none
- Purpose: Identity of a catalog: an HTTPS URL ('https://www.pptx.gallery') or a package reference ('pkg:@acme/opf-catalog'). It names the catalog; engines never fetch or install it. A host registers the catalog's records under this exact string, and copying slides between documents matches groups by it.

_No named properties._


### CatalogRecords

- Type: `object`
- Required fields: none
- Purpose: Embedded records of one kind, keyed by id. The key is the record's id; an embedded record carries no '$schema', 'id', origin or digest. Catalog display metadata ('x-*' members) is stripped when a record is embedded.

_No named properties._


### CatalogReference

- Type: `string`
- Required fields: none
- Purpose: A content reference: a bare id ('two-column') or 'name:id' ('acme:hero'), where the prefix names a group of 'catalogs'. URLs and 'pkg:' strings are not references; a named catalog group replaces them. See Catalogs for the resolution order.

_No named properties._


### LanguageTag

- Type: `string`
- Required fields: none
- Purpose: A BCP-47 language tag ('en-US', 'ja', 'zh-Hans', 'sr-Latn-ME'), an engine vocabulary. Use 'en-GB' for UK English; 'en-UK' is not a valid region.

_No named properties._


### Composition

- Type: `object`
- Required fields: none
- Purpose: Portable dynamic composition. Slide fields override the resolved layout. Nested groups (content groups here, placeholder groups in a layout record) arrange their children independently, inheriting only minFontSize and overflow. Explicit promoted regions retain their positions.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `mode` | no | `enum:auto \| grid \| row \| column` | auto chooses a grid from available space and content; grid uses columns; row and column use one horizontal or vertical track. |
| `columns` | no | `integer` | Column count for grid. In auto mode this caps the number of columns. |
| `gap` | no | `number` | Space between cells as a fraction of the container short edge (canvas at slide root). Default 0.03333333333333333. |
| `padding` | no | `number` | Inset as a fraction of the container short edge. Default 0.08 on a slide, 0 inside a group. |
| `weights` | no | `array<number>` | Relative track sizes: columns for row/grid/auto, rows for column. Omitted tracks have weight 1; extra weights are ignored. |
| `minFontSize` | no | `number` | Minimum readable text size in reference pixels at a 720-pixel canvas short edge. Default 16. Overflow is diagnosed when text cannot fit at this size. |
| `overflow` | no | `enum:warn \| error` | warn returns diagnostics for content that does not fit; error rejects layout. Content is never silently removed. Default warn. |
