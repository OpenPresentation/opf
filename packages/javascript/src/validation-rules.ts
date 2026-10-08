import { rule, type ValidationRule } from './rule-context.js';
import { accessibilityRules } from './rules-accessibility.js';
import { layoutContentRules } from './rules-layout-content.js';
import {
	validationCategories,
	type ValidationRuleInfo,
	type ValidationThresholds,
} from './validation-types.js';

/**
 * The rule registry: every rule `validate` can report, with its category, default severity, cost, rationale and the
 * standard it follows. The format, references and policy rules are produced by the schema and reference checks; the
 * accessibility, layout and content rules are implemented in `rules-*.ts`. Each rule has a stable `opf/<name>` id.
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
		{ cost: 'syntax', standard: 'RFC 8259 (strict JSON: no comments, no trailing commas)', approximations: 'Only text input is checked. A string is always read as JSON; a text that looks like YAML or Markdown gets a hint to use fromYaml or fromMarkdown first.' },
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
		{ standard: SCHEMA, approximations: 'All alternatives of a union are reported, with the failing schema location in `validation`. A required variable with no value is reported by `opf/variable-unfilled`, in the same category.' },
	),
	rule('reference-id-duplicate', 'format', 'error', 'Two references share an id.', 'A citation names a reference by id; a repeated id makes it ambiguous which entry is cited.', { standard: SCHEMA }),
	rule('cite-unknown-reference', 'format', 'error', 'A citation names a reference that does not exist.', 'A cited id with no entry in `references` has nothing to show in the footnote area.', { standard: SCHEMA }),
	rule('cite-unsupported-location', 'format', 'error', 'A citation or footnote sits where no engine draws it.', '`cite` and `footnote` apply to runs in text, bullets and list items; table cells, captions, and reference and footnote texts have no marker.', { standard: SCHEMA }),
	rule('caption-unsupported-payload', 'format', 'error', 'A caption is on a payload that cannot carry one.', 'A caption belongs to exactly one image, chart, table or video; a group, text or code block has no place to draw it.', { standard: SCHEMA }),
	rule('dataset-unknown', 'format', 'error', 'A chart or table names a dataset that does not exist.', 'The data cannot be drawn without the dataset it refers to.', { standard: SCHEMA }),
	rule('dataset-field-unknown', 'format', 'error', 'A table asks a dataset for a column it does not have.', 'The column cannot be shown when the dataset has no column of that name.', { standard: SCHEMA }),
	rule('data-column-duplicate', 'format', 'error', 'A dataset or table has two columns with the same name.', 'Series, mappings and fields address columns by name, so a repeated name makes them ambiguous.', { standard: SCHEMA }),
	rule('chart-mapping-unknown-column', 'format', 'error', 'A chart mapping names a column the data does not have.', 'The series cannot be built from a column that is not there.', { standard: SCHEMA }),
	rule('number-format-invalid', 'format', 'error', 'A number format cannot be read.', 'A format code that no engine can parse is drawn as the plain number or fails to export.', { standard: 'Excel number format codes, as far as OPF supports them' }),
	rule('variable-invalid-value', 'format', 'error', 'A variable value does not match its declared type.', 'A number variable given text, or a date given a non-date, cannot be filled into the deck.', { standard: SCHEMA }),
	rule('variable-unknown-builtin', 'format', 'error', 'A token names a built-in variable that does not exist.', 'The `deck.`, `speaker.` and `organization.` names (and `speakers`) are reserved for built-in variables; a name under them that is not a built-in can never be filled, so the token would show literally.', { standard: SCHEMA }),
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
		'unresolved-reference',
		'references',
		'warning',
		'A content reference resolves nowhere.',
		'A layout, theme, colour scheme, font scheme, narrative, audience, purpose or tone reference that neither the document embeds nor a registered catalog defines falls back: a slide composes automatically, a design uses the engine default. A strict export fails instead. A slide with no layout is automatic composition and is never reported.',
		{ standard: SCHEMA, approximations: 'Resolved like every engine resolves it: catalogs.custom, then the records embedded under catalogs.default, then the catalog registered for its source (the first registered catalog when `default` is omitted); `name:id` in catalogs.<name>, then the catalog registered for its source. Nothing is fetched. Free-form audience and purpose text is not a reference.' },
	),
	rule(
		'catalog-record-not-in-source',
		'references',
		'warning',
		'A record embedded under a catalog group is not in that catalog.',
		'A record under catalogs.default or a named group says it came from the catalog its source names. When the catalog the host registered for that source has no record of that kind and id, the record is the document\'s own and belongs in catalogs.custom, where an update from the catalog never looks for it. Rendering is unchanged: the embedded record still wins.',
		{ standard: SCHEMA, approximations: 'Checked only against a catalog the host registered for the group\'s source (the first registered catalog for an omitted default.source); with none registered for it the check is silent. A record the catalog has with different content is an update difference (updateFromCatalog), not this finding. catalogs.custom is never checked.' },
	),
	rule('undeclared-catalog', 'references', 'error', 'A reference names a catalog group the document does not declare.', 'The prefix of a `name:id` reference names the group of `catalogs` it resolves in. A prefix with no group can never resolve.', { standard: SCHEMA }),
	rule('unused-reference', 'references', 'warning', 'A reference is never cited.', 'A listed reference that no run cites is not drawn anywhere.', { standard: SCHEMA }),
	rule('unused-dataset', 'references', 'warning', 'A dataset is never used.', 'A dataset no chart or table references is not drawn anywhere.', { standard: SCHEMA }),
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
	rule('code-highlight-out-of-range', 'content', 'warning', 'A code highlight marks a line the code does not have.', 'Marked lines count from 1 by line break in code.source; an entry past the last line marks nothing.', { standard: SCHEMA }),
	rule('code-highlight-range-reversed', 'content', 'warning', 'A code highlight range ends before it starts.', 'A range written end before start marks nothing; write the smaller line number first.', { standard: SCHEMA }),
	rule('variable-builtin-missing', 'content', 'warning', 'A built-in variable has no value in this document.', 'A `{{deck.*}}`, `{{speaker.*}}` or `{{organization.*}}` token whose field the document does not set resolves to nothing, so the text shows a gap.', { standard: SCHEMA }),
	rule('duration-outside-narrative', 'content', 'warning', 'The target duration is outside the range the narrative suits.', 'A narrative records the talk lengths it suits. A deck whose duration is outside that range probably needs a different narrative or a different length; nothing is drawn or exported differently.', { standard: SCHEMA }),
	rule('narrative-duration-range', 'content', 'warning', 'An inline narrative duration range has min greater than max.', 'A range with its bounds swapped matches no duration, so the duration check cannot help.', { standard: 'spec/schemas/narrative.schema.json' }),
];

const implementations: readonly ValidationRule[] = [...accessibilityRules, ...layoutContentRules];

/** The rule implementations of the accessibility, layout and content categories, in report order. */
export const ruleImplementations = implementations;

const infos: ValidationRuleInfo[] = [
	...formatRules,
	...referenceRules,
	...policyRules,
	...dataRules,
	...implementations.flatMap((entry) => [entry.info, ...(entry.also ?? [])]),
];

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
