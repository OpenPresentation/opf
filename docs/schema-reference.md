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
| `organization` | no | `oneOf:ref:Organization / array<ref:Organization>` | Organization associated with the presentation, usually the presenting company. Array form supports hosts, partners, clients, and sponsors. The primary organization (Organization.role 'primary', else the first item) su... |
| `speaker` | no | `oneOf:ref:Speaker / array<ref:Speaker>` | Person presenting the deck. Array form supports panels and multi-speaker decks. The first speaker is the primary speaker: the built-in variables 'speaker.<field>' and the 'speaker' header/footer field read it, 'speake... |
| `author` | no | `oneOf:string / array<string>` | Optional credit for the person who authored or contributed to the deck, distinct from speaker. Array form supports multiple contributors. Round-trips to OOXML 'docProps/core.xml' as '<dc:creator>' (semicolon-joined wh... |
| `audience` | no | `oneOf:string / array<oneOf:string / ref:Audience>` | Intended audiences for the presentation. Accepts either: - A single string shorthand: free-form description ('Series B investors'), an audiences catalog id ('executive'), an HTTPS URL, or a 'pkg:' reference. - An arra... |
| `purpose` | no | `oneOf:string / ref:Purpose` | Primary goal of the presentation. Accepts either: - A string shorthand: free-form goal ('Raise a Series B round of $30M'), a purposes catalog id ('decide', 'align'), an HTTPS URL, or a 'pkg:' reference. - An inline Pu... |
| `language` | no | `oneOf:string / ref:Language` | Language for the presentation content. Accepts either: - A string shorthand: a BCP-47 language tag ('en-US', 'en-GB', 'ja-JP', 'fr'), a languages catalog id ('english', 'japanese'), an HTTPS URL, or a 'pkg:' reference... |
| `tone` | no | `oneOf:string / ref:Tone` | Desired tone for the presentation. Accepts either: - A string shorthand: a tones catalog id ('formal'), an HTTPS URL, or a 'pkg:' reference. - An inline Tone object for custom tone metadata or catalog-backed overrides... |
| `takeaway` | no | `oneOf:string / array<string>` | Audience-facing takeaway the presentation should leave behind. Array form supports multiple takeaways. Deck-level intent used by AI to seed and pressure-test slide content. |
| `duration` | no | `integer` | Target presentation duration, as an integer number of minutes. Used by AI to set pace and depth, and to compare against the resolved narrative's durationRange. |
| `tags` | no | `array<string>` | Free-form labels used for categorization, search, and filtering. Lowercase kebab-case is recommended for consistency across a deck library. |
| `design` | no | `ref:Design` | Optional design system covering theme, color scheme, font scheme, dimensions, background, logo, watermark, header, and footer applied to the deck. When omitted, engines use their default design configuration. |
| `variables` | no | `ref:Variables` | Optional named variables: deck colors referenced as 'var:<id>' (the original use), and typed content variables (text, number, date, image, url, list) referenced inline as '{{<id>}}' or whole as 'var:<id>'. Variables a... |
| `template` | no | `boolean` | Marks this document as a template: an incomplete OPF file. A template declares variables (top-level 'variables') and references them from content, and may leave required variables unfilled; validation then reports the... |
| `narrative` | no | `oneOf:string / ref:Narrative` | Structured storyline describing the deck's arc and beats. Resolves to the 'id' of a 'narratives' catalog record. Accepts two forms: - String shorthand for the common case: 'narrative = "classic-story"'. Accepts a bare... |
| `slides` | yes | `array<ref:Slide>` | Ordered array of slides that make up the presentation. |
| `references` | no | `array<ref:Reference>` | Sources that text runs cite with 'cite'. Ids are unique. A cited reference is listed in the footnote area of every slide that cites it, with a marker number assigned per deck in order of first use; a reference no run... |
| `datasets` | no | `ref:Datasets` | Optional shared data tables, keyed by id. A chart ('chart.data': { "dataset": "<id>" }) or a table ('table': { "dataset": "<id>" }) references one instead of holding its own copy; engines inline the reference before c... |
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
| `ooxmlLang` | no | `string` | Curated culture tag for OOXML text-run language attributes (a:rPr/@lang, a:endParaRPr/@lang), in the language-[Script-]REGION form Office recognizes (e.g. 'ja-JP', 'ar-SA', 'ms-MY', 'nb-NO', 'fil-PH', 'zh-CN'). Engine... |
| `code` | no | `string` | ISO 639-3 or 639-2 language code carried for engines that prefer ISO codes. |
| `direction` | no | `enum:ltr \| rtl` | Base text direction for the language. When omitted, engines derive it from the script: Arabic (Arab), Hebrew (Hebr), Syriac (Syrc), Thaana (Thaa), N'Ko (Nkoo), Adlam (Adlm), Samaritan (Samr), Mandaic (Mand) and Hanifi... |
| `script` | no | `string` | ISO 15924 script code of the language's writing system. The script selects the OOXML font slot the language's text uses: East Asian scripts (Hans, Hant, Hani, Jpan, Kore, Hang, Hira, Kana, Bopo, Yiii) use the eastAsia... |
| `fontScheme` | no | `string` | Default font-scheme id for this language when targeting PowerPoint output. Resolves against catalogs.fontSchemes the same way design.fontScheme or design.fontScheme.id does. Its major/minor families fill the language'... |
| `googleFontScheme` | no | `string` | Default font-scheme id for this language when targeting Google Slides output. Resolves against catalogs.fontSchemes the same way design.fontScheme or design.fontScheme.id does. Used in place of 'fontScheme' when resol... |
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
- Purpose: An organization associated with the presentation, typically the presenting company, but also hosts, partners, clients, or sponsors. The primary organization (role 'primary', else the first one) supplies the default deck logo (unless design.logo overrides it), the 'organization' header/footer field (its name) and the 'socials' field (its socials). Every field is also a built-in variable ('{{organization.name}}', 'var:organization.logo', 'organization.<id>.<field>'). Nothing else about an organ...

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | yes | `string` | Stable identifier for the organization, used to reference it from Speaker.organizationId and to address it in built-in variables as 'organization.<id>.<field>'. Must be unique among organizations (a duplicate is a val... |
| `name` | yes | `string` | Display name. Drawn by the 'organization' header/footer field for the primary organization; the built-in variable 'organization.name' (or 'organization.<id>.name') carries it into any string. |
| `legalName` | no | `string` | Optional legal entity name when it differs from the display name. Never drawn automatically; available as the built-in variable 'organization.legalName'. |
| `logo` | no | `ref:Asset` | Source for the organization's logo image. Accepts an HTTPS URL, data URI, relative path (resolved against the OPF file location), local path, or 'asset:<id>' reference. Common formats are SVG (preferred for vector log... |
| `domain` | no | `string` | Bare internet domain for the organization. Never drawn automatically and not used to look up assets; available as the built-in variable 'organization.domain'. |
| `email` | no | `string` | General contact email for the organization. Never drawn automatically; available as the built-in variable 'organization.email'. |
| `phone` | no | `string` | Main contact phone number for the organization. E.164 format is recommended. Never drawn automatically; available as the built-in variable 'organization.phone'. |
| `tagline` | no | `string` | Short tagline. Never drawn automatically (cover slides do not show it); available as the built-in variable 'organization.tagline', for example in a footer 'text' of '{{organization.tagline}}'. |
| `role` | no | `enum:primary \| partner \| client \| sponsor \| host` | Role of the organization relative to the presentation. Only 'primary' has behavior: it selects the primary organization (deck logo, 'organization' and 'socials' header/footer fields, and the 'organization.<field>' bui... |
| `socials` | no | `ref:Socials` | Optional social media handles or URLs for the organization. The primary organization's socials render in header/footer zones that set socials: true; otherwise they are authoring metadata. |


### Speaker

- Type: `object`
- Required fields: `id`, `name`
- Purpose: A person presenting the deck. A speaker is drawn only through built-in variables ('{{speaker.name}}' inside any string, 'var:speaker.photo' as a whole image field) and the 'speaker' header/footer field (the first speaker's name and title). No layout, cover or bio slide places a speaker on its own. See docs/templates-and-variables.md.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | yes | `string` | Stable identifier for the speaker. Must be unique among speakers (a duplicate is a validation error). Addresses this speaker in built-in variables as 'speaker.<id>.<field>', such as '{{speaker.alice.title}}'. |
| `name` | yes | `string` | Display name. Built-in variable 'speaker.name' (first speaker) or 'speaker.<id>.name'; the first speaker's name is also drawn by the 'speaker' header/footer field and every name is listed by 'speakers'. |
| `title` | no | `string` | Role or title. Built-in variable 'speaker.title'; the 'speaker' header/footer field draws it after the name ('Alice Chen, VP of Engineering'). |
| `photo` | no | `ref:Asset` | Source for the speaker's headshot image. Accepts an HTTPS URL, data URI, relative path (resolved against the OPF file location), local path, or 'asset:<id>' reference. Common formats are JPG or PNG; SVG is not appropr... |
| `email` | no | `string` | Contact email. Never drawn automatically; available as the built-in variable 'speaker.email'. |
| `phone` | no | `string` | Contact phone number for the speaker. E.164 format is recommended. Never drawn automatically; available as the built-in variable 'speaker.phone'. |
| `bio` | no | `string` | Short biographical paragraph. Never drawn automatically; available as the built-in variable 'speaker.bio', for a bio or 'about the speaker' slide you write. |
| `organizationId` | no | `string` | Reference to an Organization.id in organization; it must name an existing organization (a validation error otherwise). Attribution metadata for hosts: no engine draws it or changes which organization is primary becaus... |
| `socials` | no | `ref:Socials` | Optional social media handles or URLs for the speaker. Authoring metadata only: nothing draws speaker socials and there is no built-in variable for them (the 'socials' header/footer field draws the primary organizatio... |


### Socials

- Type: `object`
- Required fields: none
- Purpose: Social media handles or URLs, keyed by platform id from the 'socialPlatforms' catalog. Each value is a string either a full URL or a platform handle (e.g., '@acme'). The catalog record for each platform carries the URL pattern and handle prefix that engines use to render and link the profile URL, plus brand color and themed icons as catalog metadata for authoring UIs (engines render the profile URL, not icons or brand colors). Keys resolve to the 'id' of a 'socialPlatforms' catalog record. Re...

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
| `logo` | no | `oneOf:ref:Asset / ref:LogoSet` | Deck logo assets used by covers, section dividers, headers, footers and picture bullets. A string or Asset object is the default logo source; the LogoSet object form provides light/dark, stacked, icon, and wordmark va... |
| `watermark` | no | `oneOf:const:false / ref:Asset / ref:Watermark` | Optional decorative watermark applied across slides. Use false to suppress an inherited watermark in slide-level design; a string is equivalent to { src: value }. |
| `header` | no | `oneOf:const:false / ref:HeaderFooter` | Repeated header furniture rendered outside the main slide content. Use false to suppress an inherited header. |
| `footer` | no | `oneOf:const:false / ref:HeaderFooter` | Repeated footer furniture rendered outside the main slide content. Use false to suppress an inherited footer. |
| `titleAlignment` | no | `enum:left \| center \| right` | Default horizontal alignment for title placeholders in resolved layouts. |
| `contentAlignment` | no | `enum:left \| center \| right` | Default horizontal alignment for body/content regions in resolved layouts. |
| `contentBox` | no | `boolean` | Whether body/content regions are rendered inside a visible card or surface. |
| `slideImage` | no | `oneOf:ref:Asset / object` | Optional slide-level image, separate from content images. It applies to a slide that sets its own design.slideImage, and to slides whose layout declares slideImage: true or whose root image is the same source as a dec... |
| `contentDirection` | no | `enum:horizontal \| vertical` | Axis along which parallel body content is arranged. Sets the root arrangement mode of blocks and root payloads when no composition.mode is set on the slide or on its layout record: 'vertical' is column, 'horizontal' i... |
| `chartPrimary` | no | `enum:none \| top \| bottom \| left \| right` | Where the primary chart sits relative to supporting content. Effective value: slide design, then deck design, then the layout record's contentTypeChartPrimary. When the slide has no promoted regions and no composition... |
| `imageFill` | no | `enum:crop \| fit` | How picture placeholders fill their allocated region. |
| `listBullet` | no | `enum:character \| image` | Marker style for items and bullets lists. 'character' (the default) draws the glyph marker. 'image' draws the deck's icon logo (a slide's design.logo, then design.logo, then the primary organization's logo; light vari... |


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
| `eastAsian` | no | `object` | East Asian script fonts. Maps to the OOXML a:ea element of majorFont (major) and minorFont (minor), and to run-level a:ea. When set, they fill the eastAsian slot for every language; when omitted, the slot comes from t... |
| `complexScript` | no | `object` | Complex-script fonts (for example Arabic, Hebrew, Indic and Thai). Maps to the OOXML a:cs element of majorFont (major) and minorFont (minor), and to run-level a:cs. When set, they fill the complexScript slot for every... |
| `type` | no | `enum:sans-serif \| serif \| monospace` | High-level typographic class of the scheme. |
| `app` | no | `enum:PowerPoint \| Google Slides` | Target application this font pairing is intended for. |
| `languageFamily` | no | `enum:latin \| ea \| cs` | OOXML font-language family this scheme is intended for: 'latin' for Latin-script content, 'ea' for East Asian scripts, 'cs' for Complex Scripts. As the design font scheme, an 'ea' or 'cs' scheme also fills that script... |
| `heading` | no | `ref:Font` | Abstract role: font used for slide titles and headings. Maps onto the OOXML major slot when serializing. |
| `body` | no | `ref:Font` | Abstract role: font used for body copy. Maps onto the OOXML minor slot when serializing. |
| `accent` | no | `ref:Font` | Abstract role: font used for accent text. When set, the slide tag (eyebrow) and the quote body use this family instead of the body and heading families; nothing else changes. resolveFontFamilies() returns it as accent... |
| `code` | no | `ref:Font` | Abstract role: monospaced font used for code blocks and inline code. No direct OOXML slot. Resolution: this override, then the resolved catalog record's 'code' (for example Consolas for the consolas scheme), then the... |


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


### ColorRef

- Type: `anyOf:ref:HexColor / enum:accent1 | accent2 | accent3 | accent4 | accent5 | accent6 | dark1 | dark2 | light1 | light2 | hyperlink | followedHyperlink | primary | secondary | accent | background | surface | text | textSecondary / string`
- Required fields: none
- Purpose: A color value or reference, enforced on styled table cell fill and text colors and on cell border colors. Three forms: - Literal hex: '#RGB', '#RRGGBB', or '#RRGGBBAA'. - Color-scheme name, resolved through the effective color scheme after design resolution: an OOXML slot ('accent1'-'accent6', 'dark1', 'dark2', 'light1', 'light2', 'hyperlink', 'followedHyperlink') or an abstract role ('primary', 'secondary', 'accent', 'background', 'surface', 'text', 'textSecondary'). Roles resolve through th...

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
| `color` | yes | `string` | Fixed solid fill color: a hex string, a color-scheme slot or role name, or a var:<id> variable reference (a ColorRef, resolved against the effective color scheme and the deck variables). Use { type: 'theme', slot: ...... |
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
- Purpose: Deck logo variants surfaced by covers, section dividers, headers, footers and picture bullets. Organization identity lives in organization; this object only controls visual rendering assets. Engines select one variant per slot and background tone (resolveLogo in @openpresentation/opf): same-tone variants first, neutral ones next, the opposite tone last. Lockup on a dark background: light, default, stackedLight, stacked, wordmarkLight, wordmark, iconLight, icon, then dark, stackedDark, wordmar...

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
- Purpose: One header/footer zone. Every configured field renders; fields in one zone stack top to bottom in the order logo, image, text, organization, speaker, socials, section, slide number, date. Put a date and a slide number in different zones to keep each on the zone's single line.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `logo` | no | `boolean` | Whether to render the deck's icon logo in this zone: a slide's design.logo, then design.logo, then the primary organization's logo (LogoSet icon variants first, light ones on dark backgrounds). It is a generated image... |
| `text` | no | `string` | Literal text rendered in this zone. |
| `image` | no | `ref:Asset` | Generic image rendered in this zone, such as a logo, partner mark, certification badge, or icon. |
| `slideNumber` | no | `boolean` | Whether to render the current slide number in this zone. PPTX export writes a native slide-number field when its value fits within one accepted text line; a value split across lines exports as static text with a diagn... |
| `slideNumberFormat` | no | `string` | Template for the slide number when slideNumber is true. {current} is the displayed slide number (a native PPTX field when its value fits within one accepted text line); {total} is the number of slides in the rendered... |
| `date` | no | `oneOf:boolean / string` | true renders the current date: the renderer or exporter must be given an explicit ISO date by its host (core never reads a clock). PPTX export writes a native date field only for a supported dateFormat whose complete... |
| `dateFormat` | no | `string` | Date pattern for date. Tokens: yyyy (2026), yy (26), MMMM (April), MMM (Apr), MM (04), M (4), dd (09), d (9), EEEE (Thursday), EEE (Thu). Text in single quotes and other non-letter characters are literal. Month and we... |
| `organization` | no | `boolean` | Whether to render the primary organization's name from organization (role 'primary', else the first organization). |
| `speaker` | no | `boolean` | Whether to render the primary (first) speaker's name and title from speaker, joined as 'Ada Lovelace, CTO' (just the name when the speaker has no title). It is generated text: without a named speaker the engine report... |
| `section` | no | `boolean` | Whether to render the current slide section label. |
| `socials` | no | `boolean` | Whether to render the primary organization's social profiles from organization.socials, one line per platform in key order. A handle is formatted through the platform's socialPlatforms record (companyUrlPattern, else... |


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
| `numbering` | no | `ref:NumberingSpec` | Number the full-slide `items` or `bullets` instead of bulleting them. A style name (arabic, roman-upper, roman-lower, alpha-upper, alpha-lower) or a Numbering object applies to every list level; an array gives one ent... |
| `image` | no | `ref:Asset` | Full-slide image source. Presence of this field infers type 'image'. |
| `video` | no | `ref:Asset` | Full-slide video source. Presence of this field infers type 'video'. |
| `chart` | no | `ref:Chart` | Full-slide chart payload. Presence of this field infers type 'chart'. |
| `table` | no | `ref:Table` | Full-slide table payload. Presence of this field infers type 'table'. |
| `code` | no | `oneOf:string / ref:Code` | Full-slide code payload. A string is shorthand for { "source": value }; object form carries optional syntax language and filename metadata. |
| `metric` | no | `oneOf:string / number / ref:Metric` | Full-slide metric payload. A string or number is shorthand for { "value": value }; object form carries optional label, description, unit, delta, and trend metadata. Numeric values remain numbers; renderers format them... |
| `quote` | no | `oneOf:string / ref:Quote` | Full-slide quote payload. A string is shorthand for { "text": value }; object form carries optional attribution and source metadata. Presence of this field infers type 'quote'. |
| `timeline` | no | `ref:Timeline` | Full-slide timeline payload. An array is shorthand for { "events": value }; object form carries optional name and description metadata. Presence of this field infers type 'timeline'. |
| `caption` | no | `ref:Caption` | Caption for the slide's root image, chart, table or video payload. Valid only when the slide root holds exactly one of those payloads. |
| `blocks` | no | `array<ref:ContentPayload>` | Layout-agnostic content blocks rendered together as a composed payload when exact placement is unspecified. At slide root, multiple content payload kinds with no explicit type, blocks, or regions are accepted as short... |
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
| `items` | no | `array<ref:ListItem>` | Generic list payload. Each item is either a plain string, a TextRun[] rich text sequence, or a ListItem object. List nesting uses item.level rather than nested content payloads. |
| `bullets` | no | `array<ref:BulletItem>` | Text-style bullet payload. Presence of this field infers type 'text'. |
| `numbering` | no | `ref:NumberingSpec` | Number the payload's `items` or `bullets` instead of bulleting them. A style name (arabic, roman-upper, roman-lower, alpha-upper, alpha-lower) or a Numbering object applies to every list level; an array gives one entr... |
| `image` | no | `ref:Asset` | Source for an image item. |
| `video` | no | `ref:Asset` | Source for a video item. |
| `chart` | no | `ref:Chart` | Chart payload. Presence of this field infers type 'chart'. |
| `table` | no | `ref:Table` | Table payload. Presence of this field infers type 'table'. |
| `code` | no | `oneOf:string / ref:Code` | Code payload. A string is shorthand for { "source": value }; object form carries optional syntax language and filename metadata. |
| `metric` | no | `oneOf:string / number / ref:Metric` | Metric payload. A string or number is shorthand for { "value": value }; object form carries optional label, description, unit, delta, and trend metadata. Numeric values remain numbers; renderers format them for display. |
| `quote` | no | `oneOf:string / ref:Quote` | Quote payload. A string is shorthand for { "text": value }; object form carries optional attribution and source metadata. |
| `timeline` | no | `ref:Timeline` | Timeline payload ordered by narrative or chronology. |
| `caption` | no | `ref:Caption` | Caption for an image, chart, table or video payload, composed inside the block's region (below the media by default). Invalid on other payload kinds and on groups. |
| `blocks` | no | `array<ref:ContentPayload>` | Ordered children of a group. Each child is a leaf or another group. |
| `composition` | no | `ref:Composition` | Arrangement within this group. Only minFontSize and overflow inherit from the parent; strict overflow cannot be weakened. |


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
| `type` | yes | `string` | Chart type id. Resolves to the id of a chartTypes catalog record; renderers map that record through mappings.openxml and any renderer-specific mapping they understand. The bundled catalog covers the chart types Aspose... |
| `data` | yes | `oneOf:ref:ChartData / ref:ChartDataSource / ref:DatasetRef` | Chart data. Inline data uses a tabular columns/rows shape; renderers convert rows to chart series internally. A DatasetRef ({ "dataset": "<id>" }) plots a top-level dataset instead. A ChartDataSource is not resolved b... |
| `mapping` | no | `ref:ChartMapping` | Optional series mapping by column name: which column is the category, which is the X column of a scatter chart, and which columns are plotted, in order. Absent keeps the positional rule (first column the category, the... |
| `axisTitles` | no | `ref:ChartAxisTitles` | Optional axis titles. Absent keeps today's untitled axes. Supported on the chart types that have a category/value (or X/Y) axis pair (column, bar, line, area, scatter, and the histogram, pareto, waterfall and box-and-... |
| `legend` | no | `enum:none \| top \| bottom \| left \| right` | Optional legend position. 'none' hides the legend. Absent keeps today's behaviour exactly (a legend at the right of multi-series charts and of pie and doughnut charts, none for single-series charts). A named position... |
| `dataLabels` | no | `oneOf:boolean / ref:ChartDataLabels` | Optional data labels. true shows value labels at each type's default position, false (or absent) shows none, which is today's behaviour. Use the object form for the label content, position and separator. |


### ChartAxisTitles

- Type: `object`
- Required fields: none
- Purpose: Titles for the two axes of a chart. 'category' is the axis that carries the row labels (the horizontal axis of a column or line chart, the vertical axis of a bar chart, the X axis of a scatter chart); 'value' is the other axis.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `category` | no | `string` | Title of the category (X) axis. |
| `value` | no | `string` | Title of the value (Y) axis. |


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

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `columns` | no | `array<oneOf:string / array<ref:TextRun> / ref:StyledTableCell / ref:DataColumn / null>` | Optional column labels. Labels may be strings, rich runs, styled cell objects or DataColumn objects ({ "name", "format" }). A header's 'format' (DataColumn or StyledTableCell) is the column's number format; a body cel... |
| `rows` | no | `array<array<ref:TableCell>>` | Two-dimensional table row data; each row aligns by index with columns when columns are supplied. |
| `dataset` | no | `ref:DatasetId` | Id of a top-level dataset that supplies this table's headers, rows and column formats. Excludes 'rows' and 'columns'. An unknown id is a 'dataset-unknown' error. |
| `fields` | no | `ref:DatasetFields` | Dataset tables only: the dataset columns to show, by name and in order. Absent shows every column. An unknown name is a 'dataset-field-unknown' error. |


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
- Purpose: Catalog overrides for the in-document references. Every property is optional. The default catalog for a kind lives at https://www.pptx.gallery/<kind> (e.g. https://www.pptx.gallery/narratives, https://www.pptx.gallery/themes). pptx.gallery is its canonical publisher: GET https://www.pptx.gallery/<kind>/index.json (or https://www.pptx.gallery/<kind> with Accept: application/json) returns a catalog index (https://openpresentation.org/schema/opf-catalog-index/v1) and https://www.pptx.gallery/<ki...

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
| `source` | no | `oneOf:ref:CatalogSource / array<ref:CatalogSource>` | Single source or an ordered search path of sources. When omitted, the engine falls back to the default catalog at https://www.pptx.gallery/<kind>, resolved from its bundled snapshot. Fetching a declared source is an e... |
| `records` | no | `array<object>` | Inline catalog records embedded in this OPF document. Each record validates against the kind's companion schema (e.g. https://openpresentation.org/schema/opf-narrative/v1 for narratives). Inline records win over anyth... |


### CatalogSource

- Type: `string`
- Required fields: none
- Purpose: Catalog source location. Accepts: - A bare URL pointing at a catalog directory (e.g. 'https://acme.com/decks/narratives'); record ids resolve to '<base>/<id>.json'. - A URL pointing at an index file (e.g. 'https://acme.com/decks/narratives/index.json'); records are resolved relative to the index file's directory and the index entries describe what's available. Index files follow https://openpresentation.org/schema/opf-catalog-index/v1; the default catalog's index is https://www.pptx.gallery/<...

_No named properties._


### Composition

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
