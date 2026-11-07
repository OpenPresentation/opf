import { rule } from './rule-info.js';
import { validationCategories, type ValidationRuleInfo, type ValidationThresholds } from './validation-types.js';

/**
 * The rule metadata: every rule `validate` can report, with its category, default severity, cost, rationale and the
 * standard it follows, and nothing that runs a check. Light on purpose: `explain`, `describeFinding` and the source entry
 * (`@openpresentation/opf/source`) read it without the rule implementations (`rules-*.ts`: composition, contrast, language tags),
 * which import their infos from here. `validation-rules.ts` adds the implementations and re-exports this module; a test builds
 * the registry from the implementations and requires it to equal `validationRules`, so the two cannot drift.
 *
 * The format, references and policy rules are produced by the schema and reference checks; the accessibility, layout and
 * content rules are implemented in `rules-*.ts`. Each rule has a stable `opf/<name>` id.
 */

export const DEFAULT_VALIDATION_THRESHOLDS: Readonly<ValidationThresholds> = Object.freeze({
	contrastNormal: 4.5,
	contrastLarge: 3,
	minFontSizePt: 11,
	minImagePpi: 96,
	minSeriesColorDifference: 10,
});

const SCHEMA = 'spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF';

const formatRules: ValidationRuleInfo[] = [
	rule(
		'json-syntax',
		'format',
		'error',
		'The text is not strict JSON.',
		'Every OPF tool reads JSON. A misplaced comma, quote, comment or trailing comma makes the file unreadable, and the range says where.',
		{ cost: 'syntax', standard: 'RFC 8259 (strict JSON: no comments, no trailing commas)', approximations: 'Only text input is checked. A string is always read as JSON. One finding per root cause, in position order and at most five (a key with no value, a missing comma, a bracket never closed; not the damage each one causes further on): `message` says what is wrong, `help` what to do next and `location` is the range to underline. A text that looks like YAML or Markdown gets one finding with a hint to use fromYaml or fromMarkdown first. Source editors get the same causes with their quick fixes from analyzeJsonSyntax (@openpresentation/opf/source).' },
	),
	rule(
		'duplicate-key',
		'format',
		'error',
		'A JSON object repeats a key.',
		'JSON.parse keeps only the last value of a repeated key, so the earlier one disappears without a trace. The check compares escaped and literal spellings of the same key.',
		{ cost: 'syntax', standard: 'RFC 8259 section 4 (names within an object should be unique)' },
	),
	rule(
		'schema',
		'format',
		'error',
		'The document breaks the OPF schema or a structural rule the schema cannot express.',
		'The schema is the contract every engine, exporter and editor relies on. A field of the wrong type, a missing required field, an unknown property or content fields that cannot be mixed make the document ambiguous or undrawable.',
		{ standard: SCHEMA, approximations: 'All alternatives of a union are reported, with the failing schema location in `validation`. A required variable with no value is reported by `opf/variable-unfilled`, in the same category. A chart written in the Chart.js or ECharts shape (`categories` and `series`, or `labels` and `datasets`, and no `data`) is one finding on the chart whose hint shows its own values as `data: { columns, rows }`, with a patch fix; the additional-property findings that repeat it are dropped.' },
	),
	rule('reference-id-duplicate', 'format', 'error', 'Two references share an id.', 'A citation names a reference by id; a repeated id makes it ambiguous which entry is cited.', { standard: SCHEMA }),
	rule('cite-unknown-reference', 'format', 'error', 'A citation names a reference that does not exist.', 'A cited id with no entry in `references` has nothing to show in the footnote area.', { standard: SCHEMA }),
	rule('cite-unsupported-location', 'format', 'error', 'A citation or footnote sits where no engine draws it.', '`cite` and `footnote` apply to runs in text, bullets and list items; table cells, captions, and reference and footnote texts have no marker.', { standard: SCHEMA }),
	rule('caption-unsupported-payload', 'format', 'error', 'A caption is on a payload that cannot carry one.', 'A caption belongs to exactly one image, chart, table or video; a group, text or code block has no place to draw it.', { standard: SCHEMA }),
	rule('image-option-unsupported-payload', 'format', 'error', 'An image option is on a payload that is not an image.', '`fit`, `focus`, the image treatments (`shape`, `adjust`, `stroke`, `opacity`, `recolor`, `overlay`, `aspectRatio`), `placement` and `portrait` describe how a picture is drawn; a group, text or chart block has no picture for them to apply to. A shape block takes `shape`, `adjust`, `stroke`, `opacity` and `aspectRatio` too.', { standard: SCHEMA }),
	rule('shape-option-unsupported-payload', 'format', 'error', 'A shape option is on a payload that is not a shape block.', '`fill`, `style`, `rotate`, `flip`, `anchor`, `padding`, `textDirection`, `alt`, `decorative`, `hidden`, `link` and the effects (`shadow`, `innerShadow`, `glow`, `softEdge`, `reflection`, `blur`) describe how a shape block is drawn; a text, chart or image block, or a group, has no shape for them to apply to.', { standard: SCHEMA }),
	rule('shape-adjust-unknown', 'format', 'warning', 'An adjust value names a guide the preset does not have.', 'Each preset has its own adjust handles (DrawingML\'s avLst guides: `adj`, `adj1`, `adj2`, ...); a name the preset does not have changes nothing, and a custom `path` has none. The preset\'s default is drawn.', { standard: 'ECMA-376 Part 1, 20.1.10.56 (ST_ShapeType) and presetShapeDefinitions.xml' }),
	rule('shape-adjust-range', 'format', 'warning', 'An adjust value is outside the range of the preset\'s handle.', 'An adjust value outside the range its handle allows is pinned by the preset\'s own formulas, so the shape is not drawn as the value says; core draws the preset\'s default instead and both engines agree.', { standard: 'ECMA-376 Part 1, 20.1.10.56 (ST_ShapeType) and presetShapeDefinitions.xml', approximations: 'Ranges are checked at a square shape of the default size; a handle whose range depends on the shape\'s proportions is checked at those proportions when the shape is drawn.' }),
	rule('shape-link-hidden', 'format', 'warning', 'A hidden shape carries a link.', 'A hidden shape (`hidden: true`) is not drawn, so its `link` can never be clicked in a slide show.', { standard: SCHEMA }),
	rule('shape-anchor-missing', 'format', 'error', 'An overlay shape is attached to a block that is not on the slide.', 'An overlay shape placed with `at` sits against a composed block of its slide, named by the block\'s `id`. With no block of that id on the slide there is nowhere to put it, so it is not drawn.', { standard: SCHEMA }),
	rule('connector-end-missing', 'format', 'error', 'A connector end names no block or overlay shape on the slide.', 'A connector joins two shapes of its slide, each named by the `id` of a block or an overlay shape. With an end that names nothing (or names a connector) there is nothing to glue it to, so it is not drawn.', { standard: SCHEMA }),
	rule('image-placement-invalid', 'format', 'error', 'An image placement cannot be honoured.', 'A placed image bleeds to a slide edge and the rest of the slide composes beside it. Only a top-level block (slides.N.blocks.I) can do that, and a slide edge holds one placed image; a block in a group or a promoted region, or a second block on the same edge, has nowhere to go.', { standard: SCHEMA }),
	rule('layout-placeholder-group', 'format', 'error', 'A layout record\'s placeholder group breaks a nesting rule.', 'A placeholder group arranges body regions inside one cell of its layout record. Groups nest at most three levels inside a record, and a group holds body regions and groups only: the headings (title, subtitle, tag) stay at the record\'s top level, where the engine places them. Composition cannot use a record that breaks either rule.', { standard: SCHEMA }),
	rule('dataset-unknown', 'format', 'error', 'A chart or table names a dataset that does not exist.', 'The data cannot be drawn without the dataset it refers to.', { standard: SCHEMA }),
	rule('dataset-field-unknown', 'format', 'error', 'A table asks a dataset for a column it does not have.', 'The column cannot be shown when the dataset has no column of that name.', { standard: SCHEMA }),
	rule('data-column-duplicate', 'format', 'error', 'A dataset or table has two columns with the same name.', 'Series, mappings and fields address columns by name, so a repeated name makes them ambiguous.', { standard: SCHEMA }),
	rule('chart-mapping-unknown-column', 'format', 'error', 'A chart mapping names a column the data does not have.', 'The series cannot be built from a column that is not there.', { standard: SCHEMA }),
	rule('number-format-invalid', 'format', 'error', 'A number format cannot be read.', 'A format code that no engine can parse is drawn as the plain number or fails to export.', { standard: 'Excel number format codes, as far as OPF supports them' }),
	rule('variable-invalid-value', 'format', 'error', 'A variable value does not match its declared type.', 'A number variable given text, or a date given a non-date, cannot be filled into the deck.', { standard: SCHEMA }),
	rule('variable-unknown-builtin', 'format', 'error', 'A token names a built-in variable that does not exist.', 'The `deck.`, `speaker.`, `organization.` and `slide.` names (and `speakers`) are reserved for built-in variables; a name under them that is not a built-in can never be filled, so the token would show literally. The slide-scoped `slide.number`, `slide.section` and `deck.slideCount` are inline tokens only, so `var:slide.*` and `var:deck.slideCount` are reported too; organization logos are whole-field references only (`var:organization.logo.icon`), so a `{{organization.logo}}` token, an unknown logo shape or an unknown organization id is reported.', { standard: SCHEMA }),
	rule('table-highlight-unknown-name', 'format', 'error', 'A table highlight names a row the table does not have.', '`table.highlight` emphasizes body rows by their first-column text; a name that matches no row highlights nothing, so the table is not drawn as authored.', { standard: SCHEMA }),
	rule('chart-highlight-unknown-name', 'format', 'error', 'A chart highlight names a series or category the chart does not have.', '`chart.highlight` emphasises marks by name; a name that matches no series or category in the chart data highlights nothing, so the chart is not drawn as authored.', { standard: SCHEMA }),
	rule('variable-format', 'format', 'error', 'A variable cannot be formatted.', 'A number or date format that does not apply to the value leaves the token unreadable.', { standard: SCHEMA }),
	rule(
		'variable-unfilled',
		'format',
		'error',
		'A required template variable has no value.',
		'A variable a deck declares as required, with no value, is template scaffolding: `{{name}}` tokens show up literally and colour variables fall back to a default. A normal deck must be filled, so this is an error and the deck is not valid; a template (`template: true`) is incomplete on purpose, so it is a warning.',
		{
			approximations:
				'Required variables are those the variable machinery reports as unfilled for the document (declared, no value, not `required: false`, not given by the `values` option). For a document that declares no content variables, `{{id}}` / `{{id|format}}` tokens (`\{{` escapes) left in any string outside `variables`, `extensions`, `catalogs` and `assets` are reported as warnings. `var:` colour references with no declaration are reported as `opf/variable-reference-unknown`. Fill a template with `opf fill` or `resolveVariables` to clear the findings.',
		},
	),
	rule('run-color-unrecognized', 'format', 'warning', 'A text run colour is none of the documented forms.', 'Run colours are open strings so imported decks stay valid, but a value that is not a hex colour, a colour-scheme name or a `var:` reference falls back to the theme colour.', { standard: SCHEMA }),
	rule('numbering-start-ignored', 'format', 'warning', 'A list entry sets `start` where nothing is numbered.', 'A start value only restarts an auto-number; without `numbering` on the payload it has no effect.', { standard: SCHEMA }),
	rule(
		'slide-size-out-of-range',
		'format',
		'warning',
		"The slide size is outside PowerPoint's 1 to 56 inch range.",
		"The schema accepts any positive custom `widthInches` and `heightInches`, but a PPTX stores the size as `p:sldSz` with each side between 914400 and 51206400 EMU, which is 1 to 56 inches. A custom size outside that range exports a file that does not conform to the standard, which PowerPoint may reject or clamp. It is a warning because the document is still correct OPF and the preview draws it.",
		{
			standard: 'ECMA-376 / ISO/IEC 29500-1 section 19.2.1.39 (p:sldSz) and section 19.7.17 (ST_SlideSizeCoordinate): 914400 to 51206400 EMU',
			approximations: "Checks the deck's resolved size: `design.dimensions`, else the resolved theme's `dimensions`. Inches are converted to EMU as the PPTX exporter does (`Math.round(inches * 914400)`), so a side of exactly 1 in or 56 in passes. A slide-level theme with another size is `opf/slide-theme-dimensions`. Presets are always in range. PowerPoint's own behaviour at the limits was not measured.",
		},
	),
];

const referenceRules: ValidationRuleInfo[] = [
	rule(
		'asset-reference',
		'references',
		'error',
		'An `asset:` reference names an asset that is not in the registry.',
		'An image, logo or video that points at a missing asset cannot be drawn or exported. The check reads the document\'s own registry only; no file or URL is fetched.',
		{ standard: SCHEMA },
	),
	rule('asset-cycle', 'references', 'error', 'Asset references form a cycle.', 'An asset whose source points back at itself never resolves to a file.', { standard: SCHEMA }),
	rule(
		'catalog-record',
		'references',
		'error',
		'An embedded or registered catalog record is invalid.',
		'A record that fails its companion schema cannot be resolved. Invalid records are left out of the lookup, so the references to them are reported too.',
		{ standard: 'spec/schemas/<kind>.schema.json' },
	),
	rule(
		'layout-template',
		'references',
		'error',
		"A layout template's region list is malformed.",
		'A layout is one ordered list of regions, nested through splits for two dimensions. Engines cannot compose a list that is not 1 to 12 entries, an entry that is neither a region nor a split, a direction or size that is not valid, an "auto" size anywhere but in a column, splits nested more than three levels deep (the record\'s own list is level 1), or regions that compile to a grid larger than 12 x 12. composeSlide refuses such a record, so a slide that names it composes automatically.',
		{ standard: 'spec/schemas/layout.schema.json and the region list rules (docs/layout-templates.md)', approximations: 'Checked on every layout record the document embeds and every registered record it uses, once the record passes its schema.' },
	),
	rule(
		'layout-region',
		'references',
		'error',
		"A layout template's regions are not valid.",
		"Region names are unique across the whole record and may not be tag, auto or a promoted-region word (left, center, right, top, middle, bottom), so a Markdown block's region= stays unambiguous; title and subtitle name the heading regions, which take only a size, an anchor and (the title) a rule; a subtitle region needs a title region; a region accepts at least one content kind; a region with flow 'none' holds one block; overflowRegion must name a body region. composeSlide refuses such a record.",
		{ standard: 'spec/schemas/layout.schema.json and the region rules (docs/layout-templates.md)' },
	),
	rule(
		'unresolved-reference',
		'references',
		'warning',
		'A content reference resolves nowhere.',
		'A layout, theme, colour scheme, font scheme, narrative, audience, purpose or tone reference that neither the document embeds nor a registered catalog defines falls back: a slide composes automatically, a design uses the engine default. A strict export fails instead. A slide with no layout is automatic composition and is never reported.',
		{ standard: SCHEMA, approximations: 'Resolved like every engine resolves it: catalogs.custom, then the records embedded under catalogs.default, then the catalog registered for its source (the first registered catalog when `default` is omitted); `name:id` in catalogs.<name>, then the catalog registered for its source. Nothing is fetched. Free-form audience and purpose text is not a reference. It is a warning, not an error, because catalogs are open and a host may register the id; `--fail-on warning` is the check that a deck is done. With a catalog registered, the hint names the nearest records that exist ("Did you mean `two-column`?").' },
	),
	rule(
		'catalog-record-not-in-source',
		'references',
		'warning',
		'A record embedded under a catalog group is not in that catalog.',
		'A record under catalogs.default or a named group says it came from the catalog its source names. When the catalog the host registered for that source has no record of that kind and id, the record is the document\'s own and belongs in catalogs.custom, where an update from the catalog never looks for it. Rendering is unchanged: the embedded record still wins.',
		{ standard: SCHEMA, approximations: 'Checked only against a catalog the host registered for the group\'s source (the first registered catalog for an omitted default.source); with none registered for it the check is silent. A record the catalog has with different content is an update difference (updateFromCatalog), not this finding. catalogs.custom is never checked.' },
	),
	rule('undeclared-catalog', 'format', 'error', 'A reference names a catalog group the document does not declare.', 'The prefix of a `name:id` reference names the group of `catalogs` it resolves in. A prefix with no group can never resolve, whatever the host registers, so it is a format error: engines reject the document at their format check instead of drawing a fallback.', { standard: SCHEMA }),
	rule('unused-reference', 'references', 'warning', 'A reference is never cited.', 'A listed reference that no run cites is not drawn anywhere.', { standard: SCHEMA }),
	rule('unused-dataset', 'references', 'warning', 'A dataset is never used.', 'A dataset no chart or table references is not drawn anywhere.', { standard: SCHEMA }),
	rule('icon-unknown', 'references', 'warning', 'An icon names a set or an icon that does not exist.', 'An `icon` is "<set>:<name>" (a set the document embeds or a registered catalog defines, such as lucide and tabler of the gallery), a name of the `icons` of the deck, or an SVG source. One that resolves nowhere is not drawn: the entry, metric or group keeps its text and has no chip.', { standard: SCHEMA, approximations: 'A set a host registers as a loader is checked once it is loaded (ensureIcons): the CLI, the MCP and the Node file API load the sets a deck names before they validate it; the synchronous validate alone checks only the set ids and the sets the document embeds. Suggestions are the nearest names of the set (or of the icons of the deck).' }),
	rule('icon-invalid', 'references', 'warning', 'The SVG of an icon cannot be drawn as an icon.', 'The SVG of an icon is read, never run: a script, an event handler, an external reference (an href or url() that is not a fragment) or a raster image makes it unusable, as does SVG text that is not well formed or has no size. It is not drawn.', { standard: SCHEMA }),
	rule('unknown-beat', 'references', 'warning', 'A slide names a beat its narrative does not define.', '`slides[].beat` links a slide to a step of the narrative plan. A beat id the narrative does not have links to nothing; nothing is drawn from a beat.', { standard: SCHEMA, approximations: 'The narrative resolves like every content reference: the document\'s catalogs groups, then the registered catalogs. A narrative that resolves nowhere is not checked.' }),
	rule('slide-theme-dimensions', 'references', 'warning', 'A slide theme sets a slide size that differs from the deck.', 'A PPTX has one slide size. The size a slide-level theme carries is never used: design.dimensions of the deck (or of its theme) wins in every engine, and without them the exporter stops with mixed slide sizes.', { standard: SCHEMA }),
	rule('variable-unknown', 'references', 'warning', 'A `{{token}}` names a variable that is not declared.', 'An undeclared token is shown literally.', { standard: SCHEMA }),
	rule('variable-unknown-value', 'references', 'warning', 'A value was supplied for a variable that is not declared.', 'The value is never used.', { standard: SCHEMA }),
	rule('variable-unused', 'references', 'warning', 'A variable is declared but never used.', 'A declaration nothing refers to has no effect.', { standard: SCHEMA }),
	rule('variable-reference-unknown', 'references', 'warning', 'A `var:` colour names a variable that is not declared.', 'An undeclared colour variable falls back to a default colour.', { standard: SCHEMA }),
];

const policyRules: ValidationRuleInfo[] = [
	rule(
		'contract',
		'policy',
		'error',
		'A field is outside the values a host policy allows.',
		'A host that needs brand layouts, fonts or other fixed choices states them as contracts. The default severity is error; a contract can set its own. Document metadata never installs policy.',
		{ approximations: 'Only the `contracts` option supplies policy, and it checks existing fields: a contract does not require an omitted field or insert a default.' },
	),
];

const dataRules: ValidationRuleInfo[] = [
	rule('chart-option-adapted', 'layout', 'warning', 'A chart option cannot be shown by the chart type.', 'An axis title, legend or data label option the chart type does not support is adapted by every engine, so the chart is not drawn exactly as authored.', { standard: SCHEMA }),
	rule(
		'chart-value-not-numeric',
		'content',
		'warning',
		'A chart value is text, not a number.',
		'A chart plots numbers. A text cell such as "12%" is plotted as a gap. When every text value of a column is written in one display style the finding carries the fix that stores the numbers and gives the column the matching format.',
		{ standard: SCHEMA },
	),
	rule('chart-mapping-adapted', 'content', 'warning', 'A chart mapping entry is ignored.', 'A mapping that names a column the chart type cannot use is left out of the chart.', { standard: SCHEMA }),
	rule('chart-highlight-adapted', 'content', 'warning', 'A chart highlight is adapted by the chart type.', 'A highlight the chart type cannot show as authored (a category highlight on a chart without categories, for example) is adapted by every engine, so the emphasis is not exactly what was written.', { standard: SCHEMA }),
	rule('chart-series-dropped', 'content', 'warning', 'A chart series is not drawn by the chart type.', 'A treemap, histogram, one-series Pareto, waterfall, funnel, map or single-series pie plots one value series, and a scatter plots no X column without numbers. Every engine leaves the same columns out (LH-60), so the warning names them instead of losing them silently.', { standard: SCHEMA, approximations: 'Read from the drawn chart (chartDrawPlan): a world chart over categories that are mostly not places and a Pareto chart of several series are drawn as columns, a box-and-whisker chart with one value per category as one box per series and a pie or doughnut of several series as nested rings, and none of those drops a series.' }),
	rule('code-highlight-out-of-range', 'content', 'warning', 'A code highlight marks a line the code does not have.', 'Marked lines count from 1 by line break in code.source; an entry past the last line marks nothing.', { standard: SCHEMA }),
	rule('code-highlight-range-reversed', 'content', 'warning', 'A code highlight range ends before it starts.', 'A range written end before start marks nothing; write the smaller line number first.', { standard: SCHEMA }),
	rule('variable-builtin-missing', 'content', 'warning', 'A built-in variable has no value in this document.', 'A `{{deck.*}}`, `{{speaker.*}}` or `{{organization.*}}` token whose field the document does not set resolves to nothing, so the text shows a gap; a `var:organization.logo` reference to an organization without a logo draws no image. `{{slide.section}}` is checked per slide: a slide without a `section` that uses it, in its own text or in the header or footer it inherits, is reported at that slide.', { standard: SCHEMA }),
	rule('duration-outside-narrative', 'content', 'warning', 'The target duration is outside the range the narrative suits.', 'A narrative records the talk lengths it suits. A deck whose duration is outside that range probably needs a different narrative or a different length; nothing is drawn or exported differently.', { standard: SCHEMA }),
	rule('narrative-duration-range', 'content', 'warning', 'An inline narrative duration range has min greater than max.', 'A range with its bounds swapped matches no duration, so the duration check cannot help.', { standard: 'spec/schemas/narrative.schema.json' }),
];

// rules-accessibility.ts
export const contrastRule = rule(
	'text-contrast',
	'accessibility',
	'warning',
	'Text colour has too little contrast against the background it sits on.',
	'Low-contrast text is hard or impossible to read for people with low vision, colour-vision differences, glare on a projector or a poor display. WCAG sets 4.5:1 for normal text and 3:1 for large text.',
	{
		standard: 'WCAG 2.2 SC 1.4.3 Contrast (Minimum), level AA',
		thresholds: ['contrastNormal', 'contrastLarge'],
		cost: 'composition',
		approximations:
			'Computed on sRGB colours with the WCAG relative-luminance formula, against the background the preview draws: a solid or theme colour, the card surface, a table cell fill, every colour a gradient takes under the text box (sampled on a 5x5 grid, angle respected), or both colours of a pattern. Anti-aliasing, text shadows and font weight are not modelled. Text colour is the preview\'s (the scheme\'s text role or dark1 on a light background and light1 on a dark one, chosen from the background luminance, where a gradient or picture background uses the scheme\'s default background colour), so a default can fail on a dark gradient. A link with no colour of its own is measured in the scheme\'s hyperlink colour.',
	},
);
export const onImageRule = rule(
	'text-on-image',
	'accessibility',
	'info',
	'Text sits on a background picture: a note when core draws its automatic scrim behind it, otherwise its contrast cannot be guaranteed.',
	'Contrast over a photograph depends on the photograph. Core draws an automatic scrim behind text on a picture background that has no overlay, at the lowest opacity that keeps it at 4.5:1 over any picture, and this note names it. With an edge-band overlay, or the scrim turned off (overlay: false), only a full-frame overlay that guarantees readability for every possible image certifies the result from the document.',
	{
		standard: 'WCAG 2.2 SC 1.4.3 Contrast (Minimum), level AA',
		thresholds: ['contrastNormal', 'contrastLarge'],
		cost: 'composition',
		approximations:
			'Core reads picture pixels only through a host that measures them (ComposeSlideOptions.pictureLuminance). Otherwise the picture is bounded by a gray ramp from black to white, composited through the image opacity and a full-frame design.background overlay or the automatic scrim over the text it covers; the text passes only when every step of that ramp passes. An edge-banded overlay is not counted.',
	},
);
export const altRule = rule(
	'missing-alt-text',
	'accessibility',
	'warning',
	'A picture has no alt text and is not marked decorative.',
	'People using a screen reader get nothing for a picture without alternative text. A picture that is purely decorative should say so with an empty alt (alt: ""), which is an explicit, reviewed choice instead of an omission.',
	{
		standard: 'WCAG 2.2 SC 1.1.1 Non-text Content, level A',
		approximations:
			'Checks the alt field of images (image blocks, Slide.image and region images, placed or not), video, organization logos (each shape and background), header/footer images (a logo reference such as var:organization.logo.icon is checked on the organization), quote photos and speaker photos, following asset: references to the assets registry. Whether the text describes the picture well is not judged here (see opf/poor-alt-text). Charts carry `chart.alt` and are checked by opf/chart-text-alternative. Picture backgrounds are decorative unless they carry their own alt, and watermarks are decorative, so neither is checked.',
	},
);
export const poorAltRule = rule(
	'poor-alt-text',
	'accessibility',
	'info',
	'Alt text is a file name, a URL, a generic word or very long.',
	'Alt text such as "image", "IMG_2041.png" or a 400-character paragraph does not do the job of describing a picture: it is read out and adds noise without information.',
	{ standard: 'WCAG 2.2 SC 1.1.1 Non-text Content, level A', approximations: 'Pattern checks only: file extensions and camera-style names, a bare generic word, a URL, a leading "image of", and more than 250 characters. Chart alt text (chart.alt) is checked too: a bare chart word, a URL, a leading "chart of" or more than 250 characters. It cannot tell whether a plausible sentence is accurate.' },
);
export const missingTitleRule = rule(
	'missing-slide-title',
	'accessibility',
	'warning',
	'A slide has no title.',
	'Slide titles are how people using a screen reader, an outline view or keyboard navigation find and tell slides apart; PowerPoint\'s own accessibility checker reports a missing title too.',
	{ standard: 'WCAG 2.2 SC 2.4.2 Page Titled and SC 2.4.6 Headings and Labels, level AA (PowerPoint: "Missing slide title")', approximations: 'Only the slide-level title field counts. Text that merely looks like a heading inside a block does not.' },
);
export const duplicateTitleRule = rule(
	'duplicate-slide-title',
	'accessibility',
	'info',
	'Two slides have the same title.',
	'Identical titles make slides indistinguishable in an outline or a screen reader\'s slide list.',
	{ approximations: 'Titles are compared case-insensitively with whitespace collapsed. Slides that continue one another are not exempt; give a continuation a distinct title such as "(continued)".' },
);
export const readingOrderRule = rule(
	'reading-order',
	'accessibility',
	'warning',
	'The order content is read differs from the order it appears on the slide.',
	'Screen readers, keyboard focus and PowerPoint\'s selection pane follow the composed order. When it differs from the visual order (top to bottom, then start to end of the reading direction), the slide is read out of sequence.',
	{
		standard: 'WCAG 2.2 SC 1.3.2 Meaningful Sequence, level A (PowerPoint: "Check reading order")',
		cost: 'composition',
		approximations:
			'Compares the composed content order with a visual order recomputed from the composed boxes: items whose vertical centres fall in the same row are ordered along the reading direction (a right-to-left deck is checked by rows only), rows from top to bottom. Headings are expected first. Content drawn entirely above the title, over the columns of the title, is reported; content in a column beside the title is read after it. Free-form overlap is not analysed. On a slide with a template layout (OPF 0.19) the expected order is the binding order instead (the regions in reading order, then the blocks of each region), and items outside a region (placed images, the row below the grid) are not compared.',
	},
);
export const linkRule = rule(
	'link-text',
	'accessibility',
	'warning',
	'Link text does not say where the link goes.',
	'People who scan links out of context (a screen reader\'s links list, a link tab order) hear only the text. "click here", "read more" or a long raw URL tells them nothing about the destination.',
	{ standard: 'WCAG 2.2 SC 2.4.4 Link Purpose (In Context), level A; PowerPoint: "Hyperlink text is not meaningful"', approximations: 'Matches a short list of generic phrases in English (after lower-casing and removing punctuation), blank link text, and raw URLs longer than 40 characters. Adjacent runs sharing one link are read as one link.' },
);
export const chartColorRule = rule(
	'chart-color-only',
	'accessibility',
	'info',
	'Chart series may be indistinguishable without colour vision.',
	'OPF charts have no data labels or patterns, so series are told apart by colour alone (and legend order). Colours that look alike to someone with colour-vision deficiency, or when printed in greyscale, make series impossible to tell apart.',
	{
		standard: 'WCAG 2.2 SC 1.4.1 Use of Color, level A',
		thresholds: ['minSeriesColorDifference'],
		approximations:
			'Uses the engine\'s series palette (ValidateOptions.chartPalette; default chartSeriesPalette of each slide color scheme (accent1 to accent6, then their tints), adjusted for the slide background and softened like the engines draw them, LH-105) in series order: series i takes color i, pie/doughnut/treemap/funnel slices take colours per category. Pairs are compared by CIE76 distance after simulating protanopia, deuteranopia, tritanopia (Machado 2009, severity 1) and greyscale. Neighbouring series (and neighbouring slices, on a pie or doughnut the last beside the first, which the engines move off the first by at most 20 L* or, where that is not enough, separate with a surface-colored slice border that this rule accepts, LH-161) must also differ by at least 11 in CIE L* (the lightness step the engines keep when they adjust a palette), since lightness is the cue left without hue (LH-35); a pair under it is reported as a lightness pair. Single-series charts and chart types without a series legend are skipped.',
	},
);
export const chartAltRule = rule(
	'chart-text-alternative',
	'accessibility',
	'info',
	'A chart has no text alternative, or is marked decorative.',
	'A chart conveys a message; people who cannot see it need the message and ideally the numbers in text. The chart\'s alt field is that text alternative (the preview exposes it as the chart\'s accessible name and the PowerPoint export writes it as the frame\'s alternative text); a sentence or table beside the chart also serves. An empty alt marks a chart decorative, which is reported as info so the choice is reviewed: a chart rarely carries no message.',
	{ standard: 'WCAG 2.2 SC 1.1.1 Non-text Content, level A', approximations: 'A chart passes when chart.alt has text. Without alt, it passes when the slide has any other text, list, table, quote or metric content besides title and tag, or a subtitle. It does not judge whether alt or that text states the chart\'s point (see opf/poor-alt-text for generic alt text). alt: "" is reported as a decorative chart, whatever else is on the slide.' },
);
export const chartColorsRule = rule(
	'chart-colors-adjusted',
	'accessibility',
	'warning',
	'A chart colour cannot be used as authored.',
	'`chart.colors` sets the colour of series 1, 2, 3 and so on. A colour that cannot be resolved (a `var:` colour variable the deck does not define, or a name that is not a colour) is ignored and the deck palette colour of that position is used. A colour with under 3:1 contrast against the slide background the chart stands on is kept for its hue but drawn lighter or darker, so the chart does not show the colour that was written.',
	{
		standard: 'WCAG 2.2 SC 1.4.11 Non-text Contrast, level AA',
		approximations: 'Resolves each entry like any colour reference (hex, colour-scheme slot or role, `var:` variable) against the slide\'s scheme and compares it with the slide background (no chart has a panel, LH-105; a chart in a card stands on the card, which is not measured) by WCAG contrast; 3:1 is the threshold the engines enforce. Translucent colours and unresolved backgrounds are not measured. Colours that look alike to colour-vision deficiency are reported by opf/chart-color-only, which judges the authored colours.',
	},
);
export const languageRule = rule(
	'missing-language',
	'accessibility',
	'info',
	'The presentation does not declare its language.',
	'Screen readers and text-to-speech choose pronunciation and hyphenation from the declared language; spell checkers and translation tools use it too.',
	{ standard: 'WCAG 2.2 SC 3.1.1 Language of Page, level A', approximations: 'Only the presentation-level `language` is checked, not the language of individual runs (`TextRun.lang`; opf/language-tag checks how those tags are written).' },
);

// rules-layout-content.ts

/** A header or footer zone is a band at the slide edge; text past this many lines grows upward into the content. */
export const MAX_FURNITURE_LINES = 2;

export const overflowRule = rule(
	'text-overflow',
	'layout',
	'warning',
	'Text or a table does not fit its space at the smallest allowed size.',
	'Core composition changes the arrangement (columns, the automatic grid, another design) before it sets text smaller, fits dense content that no arrangement holds down the type scale to the readable minimum, never below it, and then reports what still does not fit. Overflowing text is clipped or runs over other content in the preview and in PowerPoint.',
	{
		cost: 'composition',
		approximations:
			'Uses composeSlide at the deck\'s slide size with the fonts of the resolved font scheme. Without a host-supplied text measurement (ValidateOptions.fonts.textMeasurement) widths are core\'s portable estimate, which can differ from the real font by a few percent; pass the renderer\'s measurement for font-exact results. A composition that sets overflow: "error" is reported as a warning here, so that `valid` never depends on font metrics; rendering and export still refuse such a slide when it does not fit.',
	},
);
export const unresolvedRule = rule(
	'unresolved-content',
	'layout',
	'warning',
	'Content cannot be drawn as authored.',
	'composeSlide reports content it cannot place or an effect it does not support (for example a picture bullet without a logo, a date field without a date, or an unsupported image treatment). The preview and the export fall back.',
	{ cost: 'composition' },
);
export const layoutFailedRule = rule(
	'layout-failed',
	'layout',
	'warning',
	'The slide layout could not be computed.',
	'Composition threw for a slide that passed schema validation, so geometry-based rules (contrast, overflow, reading order, resolution) were skipped for it.',
	{ cost: 'composition' },
);
export const minFontRule = rule(
	'min-font-size',
	'layout',
	'warning',
	'Text is drawn smaller than the readable minimum.',
	'Small type is unreadable from the back of a room and on a phone. The engine\'s own default floor is 12 pt (16 px); anything much below that was lowered on purpose or by a composition that could not fit the text.',
	{
		cost: 'composition',
		standard: 'Common presentation guidance (12 pt minimum for body text; 18 pt or more is easier to read from a distance).',
		thresholds: ['minFontSizePt'],
		approximations: 'Sizes are those composeSlide fitted, expressed on the 13.33 x 7.5 in reference slide (96 px per inch, so 1 px is 0.75 pt; a smaller canvas scales type down with it) and explicit run fontSize values in points. Per payload, the smallest part (a metric label or a quote attribution) is reported. Table cell text (default 11.25 pt), code and header/footer furniture are not checked.',
	},
);
export const regionUnknownRule = rule(
	'region-unknown',
	'layout',
	'warning',
	'A block is pinned to a region the layout does not have.',
	'A region pin (`region` on a root block) names a region of the slide\'s layout. A name the layout does not have is ignored: the block is placed by its kind, which may not be where the author meant.',
	{ cost: 'composition' },
);
export const regionKindRule = rule(
	'region-kind',
	'layout',
	'warning',
	'A block is pinned to a region that does not accept its kind.',
	'A region says which content kinds it takes. A pin to a region that does not take the block\'s kind is ignored and the block is placed by its kind.',
	{ cost: 'composition' },
);
export const regionFullRule = rule(
	'region-full',
	'layout',
	'warning',
	'A block is pinned to a region that is already full.',
	'A region holds at most `max` blocks on one slide. A pin to a full region is ignored and the block is placed by its kind.',
	{ cost: 'composition' },
);
export const iconDroppedRule = rule(
	'icon-dropped',
	'layout',
	'warning',
	'An icon is not drawn.',
	'An icon is decoration: it never costs text its size. When the chips would set any block smaller than the slide sets it without them, the slide is drawn without its icons, and an icon on something icons do not mark (a nested or numbered list entry) is not drawn either. The text is always drawn.',
	{ cost: 'composition' },
);
export const arrangementAdaptedRule = rule(
	'arrangement-adapted',
	'layout',
	'info',
	'A pyramid, matrix, cycle, row of chevrons or flow is drawn another way.',
	"A `pyramid`, `matrix`, `cycle`, `chevrons`, `flow` or `vertical-flow` region draws a list of one level of short entries as that diagram (docs/smartart.md). A matrix needs exactly four entries for its quadrants; with another count its entries are drawn as a grid of cards. A list the arrangement does not draw (nested entries, descriptions, icons, numbering, too many entries), or whose entries fit neither PowerPoint's design nor OPF's at the list's size, is drawn as a list.",
	{ cost: 'composition' },
);
export const unplacedRule = rule(
	'layout-unplaced',
	'layout',
	'warning',
	'No region of the layout has room for a block.',
	'Content is never dropped: a block no region has room for is drawn in the layout\'s overflow region beyond its max (or below the grid), where it crowds the others. Paginate moves it to a continuation slide with the same layout.',
	{ cost: 'composition' },
);
export const furnitureWrapsRule = rule(
	'furniture-wraps',
	'layout',
	'warning',
	`A header or footer zone wraps onto more than ${MAX_FURNITURE_LINES} lines.`,
	'Header and footer text repeats on every slide in a band at the slide edge. A zone that wraps onto three or more lines grows into the body, and long source lines read poorly at footer size. Footers carry short repeated text (a title, a date, a page number); sources belong in a caption or the speaker notes.',
	{
		cost: 'composition',
		approximations: 'Uses the lines core composed for the zone at the deck\'s slide size; without a host-supplied text measurement (ValidateOptions.fonts.textMeasurement) widths are core\'s portable estimates. A deck-level header or footer is reported once.',
	},
);
export const outsideRule = rule(
	'font-outside-scheme',
	'layout',
	'warning',
	'Text uses a font family that is not in the deck\'s font scheme.',
	'The font scheme is the deck\'s font choice. A run that names another family will not follow a font-scheme change, may be missing on the viewer\'s machine, and breaks the deck\'s typographic consistency.',
	{ approximations: 'Compares the run\'s fontFamily (case-insensitively) with the heading, body, code and accent families of the slide\'s resolved font scheme and the scheme\'s major/minor fonts. Families that the host substitutes are still different names here.' },
);
export const resolutionRule = rule(
	'image-resolution',
	'layout',
	'warning',
	'An image has too few pixels for the size it is shown at.',
	'An image stretched beyond its pixel size looks blurry or blocky on a projector or a high-density screen.',
	{
		cost: 'composition',
		thresholds: ['minImagePpi'],
		approximations:
			'Only embedded data: images (and asset: references to them) have readable pixel sizes; URLs and files are never fetched, so they are not checked. The displayed size is the composed frame (cover and stretch are measured as the cover scale, contain as the contain scale). Effective ppi is the image pixels per inch of the 96 px/inch reference slide. SVG is vector and exempt.',
	},
);
export const placeholderRule = rule(
	'placeholder-text',
	'content',
	'warning',
	'Placeholder text was left in the deck.',
	'"Lorem ipsum", "Click to add title", "TBD" and bracketed prompts are scaffolding. Shipping them reads as unfinished work.',
	{ approximations: 'Case-insensitive patterns for lorem ipsum, template prompts ("Click to add...", "Your title here", "[Insert ...]", a bare "Title" or "Text"), and the markers TBD, TBC, TODO, FIXME and XXX in capitals. A deliberate use of the words is flagged too; disable the rule for that slide with ignorePaths.' },
);
export const emptyTextRule = rule(
	'empty-text',
	'content',
	'info',
	'A text field is present but empty.',
	'An empty title, text block or list item draws nothing, and leaves a hole in the outline and for assistive technology.',
);
export const emptySlideRule = rule(
	'empty-slide',
	'content',
	'warning',
	'A slide has no content at all.',
	'A slide with no title, no content and no picture is almost always an accident of editing. (A deliberately blank slide can use the blank layout.)',
);
export const unusedBeatRule = rule(
	'unused-beat',
	'content',
	'info',
	'A beat of the narrative has no slide that references it.',
	'The narrative is the plan and the slides are the product. When some slides name a beat (slides[].beat) and a beat of the plan has none, the deck skips a step of the story or the plan is out of date.',
	{
		approximations:
			'Resolved like every content reference: the document\'s catalogs groups, then the registered catalogs. A narrative that resolves nowhere is not checked. A deck in which no slide references any beat is not checked either, because it has not linked its slides to the plan. A slide that lists several beats covers each of them.',
	},
);

// rules-language.ts
export const languageTagRule = rule(
	'language-tag',
	'content',
	'warning',
	'A language tag is malformed, uses an unassigned region or is not in canonical case.',
	'Engines read the deck language and each run\'s `lang` as BCP 47 tags to choose script fonts, text direction, proofing language and the PowerPoint `lang` attribute. A tag such as `en-a`, or a region that does not exist (`en-UK`; the United Kingdom is `GB`), is guessed at or dropped, and a wrong-case tag (`EN-us`) is not what a locale lookup expects.',
	{
		standard: 'BCP 47 (RFC 5646, section 2.1) and the platform locale data (Intl.getCanonicalLocales, Intl.DisplayNames)',
		approximations:
			'Checks the root `language` (a tag string, or the `bcp47` of an inline Language object) and `lang` on the TextRun objects of titles, subtitles, tags, text, lists, tables, quotes, metrics and timelines. A region is assigned when the runtime\'s CLDR data names it (ISO 3166-1 codes and UN M.49 areas such as 419); private-use regions (`AA`, `QM`-`QZ`, `XA`-`XZ`) and `ZZ` are accepted, as are private-use (`x-...`) tags. Only the spelling of a tag is checked, not whether the language subtag is assigned or whether the language suits the text. The schema rejects tags with characters other than letters, digits and hyphens (`en_US` is a schema error, with no suggestion), and `en-UK` as the deck language is already an error of the schema rule, so those are not reported twice.',
	},
);

// rules-layout-findings.ts (LH-19, LH-31): info findings that read the composed geometry and the slide sequence.

/** `opf/text-shrunk`: a fitted size below this fraction of its role's starting size. */
export const SHRUNK_RATIO = 0.7;
/** `opf/centered-body`: a centered paragraph or list is reported past this many lines or characters. */
export const CENTERED_BODY_LINES = 2, CENTERED_BODY_CHARACTERS = 120;
/** `opf/centered-body`: a text of at most this many characters is a short note, whatever it wraps to in a narrow cell. */
export const CENTERED_NOTE_CHARACTERS = 80;
/** `opf/tight-spacing`: sibling blocks closer than this, in inches of the reference slide, where the author set the gap (the slide's default gap is 1/30 of the short side, 0.25 in). */
export const TIGHT_GAP_INCHES = 0.25;
/** `opf/tight-spacing`: a block closer than this to the slide edge (the engine's default padding is 0.6 in). */
export const TIGHT_MARGIN_INCHES = 0.5;
/** `opf/layout-monotony`: this many content slides in a row with one layout record. */
export const MONOTONY_RUN = 4;

export const textShrunkRule = rule(
	'text-shrunk',
	'layout',
	'info',
	`Text is fitted far below its role's starting size (under ${SHRUNK_RATIO * 100}%).`,
	'Composition starts each type role at a size meant to be read across a room (prose 28 px, a list 32 px, a table 25 px, a quote 40 px, code 22 px on the 720 px reference slide) and shrinks text that does not fit. Text that ends far below that size still fits, but the slide carries more than it can show at a comfortable size; it is usually two slides.',
	{
		cost: 'composition',
		standard: `The type roles of composition (docs/dynamic-composition.md); the fitted size composeSlide computed, compared with ${SHRUNK_RATIO} of the role size.`,
		approximations: 'Reads the fitted size of text and list blocks, the quote body, the code body and the smallest body cell of a table, on the 720 px reference slide. Headings, metrics and timelines have their own scales and are not checked. A block whose runs set `fontSize` is the author\'s choice and is skipped; text that overflows is opf/text-overflow. One finding per slide, at the block shrunk the most; `measured.blocks` counts the shrunk blocks.',
	},
);
export const centeredBodyRule = rule(
	'centered-body',
	'layout',
	'info',
	`A paragraph or list of more than ${CENTERED_BODY_LINES} lines or ${CENTERED_BODY_CHARACTERS} characters is centered.`,
	'Each line of centered text starts at a different place, so the eye has to search for the next line. Centering suits a title, a metric or a statement of a line or two; a paragraph or a list reads faster from a straight start edge.',
	{
		cost: 'composition',
		standard: `Typographic convention for running text: a straight start edge. The alignment and the line count are those composeSlide computed; more than ${CENTERED_BODY_LINES} lines or ${CENTERED_BODY_CHARACTERS} characters.`,
		approximations: 'Checks text and list blocks whose composed alignment is center. Titles, subtitles, tags, metrics, quotes and timelines are not checked, nor a short note of at most 80 characters, whatever it wraps to in a narrow cell. A text block alone on the slide or alone in its layout region (a statement, or the note of the metrics layout) is reported only past 3 lines, and on a cover, section or closing layout not at all. One finding per slide, at the longest block; `measured.blocks` counts the long centered blocks.',
	},
);
export const tightSpacingRule = rule(
	'tight-spacing',
	'layout',
	'info',
	`Blocks are closer than ${TIGHT_GAP_INCHES} in to each other or ${TIGHT_MARGIN_INCHES} in to the slide edge.`,
	'Space between blocks tells the audience which things belong together, and a margin keeps content clear of the edge that projectors, screen-sharing and printing crop. Blocks closer together than the engine\'s own default gap read as one crowded block.',
	{
		cost: 'composition',
		standard: `Measured on the composed boxes (the card frame, the picture frame, else the cell) of sibling blocks and groups, on the 13.33 x 7.5 in reference slide: a gap under ${TIGHT_GAP_INCHES} in (the default gap is 1/30 of the short side, 0.25 in) or a margin under ${TIGHT_MARGIN_INCHES} in (the default padding is 0.6 in).`,
		approximations: 'Only a gap the author set is checked: `composition.gap` on the slide, its layout record or a group. Without one the default gap of the engine applies (1/30 of the shorter side of the container: 0.25 in on the slide, less in a short nested group) and is not reported. Only blocks of one parent are compared, and only when they face each other across one axis. Headings, header and footer furniture, pictures placed on a slide edge and blocks in a bleed region are exempt. A cell is measured, not the ink inside it, so text that does not fill its cell looks further apart than reported. At most one gap and one margin finding per slide, the tightest of each.',
	},
);
export const layoutMonotonyRule = rule(
	'layout-monotony',
	'layout',
	'info',
	`${MONOTONY_RUN} or more content slides in a row use the same layout record.`,
	'A run of slides with one arrangement looks the same from slide to slide, so the audience stops noticing that the content changed. The structure of the content (a comparison, a sequence, a number, a picture) usually asks for different layouts.',
	{
		standard: `Counted on the slide sequence: ${MONOTONY_RUN} or more consecutive visible slides with body content and the same \`layout\`.`,
		approximations: 'Compares the layout reference of each slide (a catalog prefix is ignored). Cover, section and closing slides, slides with no body content and slides without a layout record (automatic composition) break a run and are not counted; hidden slides are skipped. One finding per run, at its first slide.',
	},
);
export const straightQuotesRule = rule(
	'straight-quotes',
	'content',
	'info',
	'Text uses straight quotation marks (" or \') where the language has typographic ones.',
	'Straight marks are a typewriter substitute. Typeset text uses the quotation marks of its language (“…” in English, «…» in French, „…“ in German), and a deck that mixes them with the marks the engine draws around quotes looks unfinished.',
	{
		standard: 'The quotation marks of the deck language, as the engines draw them around a quote (QUOTE_MARKS in core).',
		approximations: 'Checks titles, subtitles, tags, body text, list items and descriptions, and quotes; not table cells, metrics, timelines, code or runs with `code: true`. A `"` after a digit is an inch mark and a `\'` between letters or after a digit is an apostrophe or a foot mark; single quotes count only as a pair around words. A language with no typographic marks of its own (one OPF draws ASCII quotes for) is not checked. When only double quotes are found, the finding carries a patch to the language\'s marks.',
	},
);

// rules-chart-findings.ts (LH-105): info findings for charts that Few's principles advise against; nothing drawn changes.

/** `opf/chart-pie-many-slices`: a pie or doughnut of more than this many categories. */
export const PIE_MAX_SLICES = 5;

export const chartDualAxisRule = rule(
	'chart-dual-axis',
	'content',
	'info',
	'A combo chart plots a series on a secondary value axis.',
	'Two value scales in one plot invite the reader to compare heights that are not comparable: where the lines cross, and which is higher, depends only on how each axis was scaled. Two charts side by side, each with its own axis, read more truly than one chart with two scales (Few, Show Me the Numbers).',
	{
		standard: 'Stephen Few, Show Me the Numbers (2012), on dual-scaled graphs.',
		approximations: 'Reports a `combo` chart whose `secondaryAxis` names at least one plotted line series (the axis core resolves). A combo chart on one axis is not reported.',
	},
);
export const chartPieManySlicesRule = rule(
	'chart-pie-many-slices',
	'content',
	'info',
	`A pie or doughnut chart has more than ${PIE_MAX_SLICES} slices.`,
	'People compare angles and areas poorly, and past a few slices the small ones cannot be told apart or labelled. Bars along one axis show the same parts of a whole and let them be compared and ranked (Few, Show Me the Numbers).',
	{
		standard: `Stephen Few, Show Me the Numbers (2012), on pie charts; more than ${PIE_MAX_SLICES} categories.`,
		approximations: 'Counts the rows (categories) of a `pie` or `doughnut` chart as its data resolves; a doughnut of several series (nested rings) counts the categories of a ring. Treemaps and funnels are not checked.',
	},
);

/**
 * The infos of the implemented rules in the order their implementations report: the order of `ruleImplementations` (accessibility,
 * layout, content), each rule followed by the further rules it can report (`also`).
 */
const implementedRules: ValidationRuleInfo[] = [
	contrastRule,
	onImageRule,
	altRule,
	poorAltRule,
	missingTitleRule,
	duplicateTitleRule,
	readingOrderRule,
	linkRule,
	chartColorRule,
	chartColorsRule,
	chartAltRule,
	languageRule,
	overflowRule,
	unresolvedRule,
	layoutFailedRule,
	minFontRule,
	regionUnknownRule,
	regionKindRule,
	regionFullRule,
	unplacedRule,
	iconDroppedRule,
	arrangementAdaptedRule,
	furnitureWrapsRule,
	outsideRule,
	resolutionRule,
	placeholderRule,
	emptyTextRule,
	unusedBeatRule,
	emptySlideRule,
	languageTagRule,
	textShrunkRule,
	centeredBodyRule,
	tightSpacingRule,
	layoutMonotonyRule,
	straightQuotesRule,
	chartDualAxisRule,
	chartPieManySlicesRule,
];

const infos: ValidationRuleInfo[] = [...formatRules, ...referenceRules, ...policyRules, ...dataRules, ...implementedRules];

/**
 * Every rule `validate` can report, with its category, default severity, cost, rationale and approximations, ordered by
 * category (format, references, policy, accessibility, layout, content) and, within one, in report order.
 */
export const validationRules: readonly ValidationRuleInfo[] = Object.freeze(
	infos
		.map((info, index) => ({ info, index }))
		.sort((a, b) => validationCategories.indexOf(a.info.category) - validationCategories.indexOf(b.info.category) || a.index - b.index)
		.map(({ info }) => Object.freeze({ ...info })),
);

const byName = new Map<string, ValidationRuleInfo>();
for (const info of validationRules) {
	if (byName.has(info.id) || byName.has(info.name)) throw new Error(`Duplicate validation rule ${info.id}.`);
	byName.set(info.id, info);
	byName.set(info.name, info);
}

/** The rule a full id (`opf/text-contrast`) or bare name (`text-contrast`) names, or undefined. */
export function findValidationRule(name: string): ValidationRuleInfo | undefined {
	return byName.get(name);
}

/** The registered rule of an id a check is about to report. A missing one is a bug in core, not in the document. */
export function ruleInfo(id: string): ValidationRuleInfo {
	const found = byName.get(id);
	if (!found) throw new Error(`Validation rule ${JSON.stringify(id)} is not registered.`);
	return found;
}

const VALIDATE_DOCS = 'https://github.com/OpenPresentation/opf/blob/main/docs/validate.md';

/** The documentation link of a rule: docs/validate.md at the rule's heading. It is the `definition` of the rule's findings and the `docs` of `explain`. */
export function ruleDocumentation(id: string): string {
	return `${VALIDATE_DOCS}#${id.replace('/', '')}`;
}
