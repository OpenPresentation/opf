/**
 * The plain-words text of the YAML and Markdown readers' findings (`yaml/*`, `markdown/*`; VALIDATOR-HINTS sections 9 and 10), and what `explain` says
 * about those rules. Internal module; `describeFinding` (`finding-text.ts`) and `explain` dispatch here.
 *
 * The readers already write a message and a help for every finding (the YAML syntax in `yaml/syntax.ts`); this table adds the part a person needs
 * after the sentence, the `next` line: the keys an options comment takes, the fence that closes a block, the chart types, the near miss of a name.
 */
import { BLOCK_OPTION_KEYS, METRIC_KEYS, SLIDE_OPTION_KEYS } from "./markdown/dialect.js";
import { type ExplainEntry, type FindingText, type RuleText, asNext, code } from "./finding-text-util.js";

const keep = (finding: { message: string }, next: string | undefined): FindingText => (next ? { message: finding.message, next } : { message: finding.message });
const wholeHelp: RuleText = (finding) => keep(finding, finding.help ? asNext(finding.help) : undefined);
const line = (finding: { location?: { line: number } }): number => finding.location?.line ?? 1;
const quoted = (text: string, pattern: RegExp): string | undefined => pattern.exec(text)?.[1];

const optionKeys = (kind: string): readonly string[] => (kind === "block" ? BLOCK_OPTION_KEYS : SLIDE_OPTION_KEYS);

const options: Record<string, RuleText> = {
  "markdown/options-unknown-key": (finding) => {
    const kind = quoted(finding.message, /^Unknown (slide|block) option/) ?? "slide";
    const key = quoted(finding.message, /option "(.*)"\.$/) ?? "";
    const guess = finding.suggestions?.[0]?.value;
    const keys = optionKeys(kind).join(", ");
    return {
      message: `${code(key)} is not a ${kind} option.`,
      next: guess !== undefined ? `did you mean ${code(guess)}? The keys are ${keys}. Anything else goes in an \`opf-${kind}\` fence.` : `use one of ${keys}. Anything else goes in an \`opf-${kind}\` fence.`,
    };
  },
  "markdown/options-value": (finding) => {
    if (/^hidden takes/.test(finding.message)) return keep(finding, "write `hidden=true`, `hidden=false` or just `hidden`.");
    const key = quoted(finding.message, /^Option (\w+) needs a value/);
    if (key) return keep(finding, `write ${code(`${key}=value`)}, for example ${code(key === "layout" ? "layout=title" : key === "id" ? "id=cover" : `${key}=name`)}.`);
    if (/^as takes/.test(finding.message)) return keep(finding, "write `as=bullets` before a list or `as=video` before an image line.");
    return keep(finding, "put `as=bullets` before a list and `as=video` before an image line, or remove `as`.");
  },
  "markdown/options-syntax": (finding) => keep(finding, `write options as ${code("key=value")} pairs, with text in double quotes: ${code('<!-- slide: layout=title section="Part 1" -->')}.`),
  "markdown/options-duplicate": (finding) => {
    const key = quoted(finding.message, /^Option (\w+) is given twice/);
    if (key) return keep(finding, `keep one ${code(`${key}=`)} in the comment.`);
    return keep(finding, "merge them into one.");
  },
  "markdown/options-orphan": (finding) => keep(finding, "put the `<!-- block: … -->` comment directly before the block it describes, or remove it."),
  "markdown/options-trailing": (finding) => keep(finding, "put the content on its own line after the options comment."),
  "markdown/options-embedded": (finding) => keep(finding, "remove the comment and put `id` and `type` inside the `opf-block` YAML."),
};

const markdown: Record<string, RuleText> = {
  "markdown/front-matter-unterminated": (finding) => keep(finding, "add a line with only `---` after the settings, or remove the opening `---` (a deck without front matter starts with its first slide)."),
  "markdown/front-matter-slides": () => ({
    message: "The front matter can't hold `slides`: the slides are the Markdown below it.",
    next: "remove the `slides` key and write the slides below the front matter, separated by `---`.",
  }),
  "markdown/front-matter-comments": (finding) => keep(finding, "add the deck properties as `key: value` lines, or remove the first `---` if the file starts with a slide."),
  "markdown/no-slides": (finding) => keep(finding, "write a `# Title` line, or any content, then `---` between slides."),
  "markdown/comment-unterminated": (finding) => ({ message: `The ${code("<!--")} on line ${line(finding)} has no ${code("-->")}.`, next: "end the comment with `-->`." }),
  "markdown/fence-unterminated": (finding) => {
    const fence = /Add a closing (`{3,}|~{3,}) line/.exec(finding.help ?? "")?.[1] ?? "```";
    return { message: `The ${fence} fence opened on line ${line(finding)} is never closed.`, next: `add a line with ${fence} to close it.` };
  },
  "markdown/code-fence": (finding) => ({ message: `The code fence opened on line ${line(finding)} could not be read as code.`, next: "close the fence with at least as many backticks as opened it." }),
  "markdown/chart-type": (finding) => keep(finding, "write ```chart column (also `bar`, `line`, `pie`, …), then the data."),
  "markdown/chart-attributes": (finding) => keep(finding, 'write ```chart column alt="What the data shows" (`alt` is optional).'),
  "markdown/chart-data": wholeHelp,
  "markdown/chart-ragged": (finding) => keep(finding, "give every row one value per column."),
  "markdown/metric-block": (finding) => keep(finding, `write ${code("key: value")} lines using ${METRIC_KEYS.join(", ")}; a value is plain text or a JSON string in double quotes.`),
  "markdown/timeline-attributes": (finding) => keep(finding, 'write ```timeline name="Roadmap" description="…" (both are optional).'),
  "markdown/timeline-description": (finding) => keep(finding, "put the event first, then its description indented below it."),
  "markdown/timeline-events": (finding) => keep(finding, "write one event per line, for example `2024 Q1 — Pilot`."),
  "markdown/slide-property-conflict": (finding) => {
    const field = quoted(finding.message, /property "(.*)" is set twice/) ?? finding.path.split("/").at(-1) ?? "field";
    return { message: `${code(field)} is set both in the Markdown and in the \`opf-slide\` fence.`, next: "keep it in one of the two places." };
  },
  "markdown/duplicate-title": (finding) => keep(finding, "use `---` to start a new slide, or `##` for the subtitle."),
  "markdown/duplicate-subtitle": (finding) => keep(finding, "write further lines as paragraphs; a slide has one subtitle."),
  "markdown/empty-heading": (finding) => keep(finding, "write the title after the `#`, or remove the line."),
  "markdown/empty-quote": (finding) => keep(finding, "write the quote after `>`."),
  "markdown/image-source": (finding) => keep(finding, "write the file or address inside the parentheses: `![alt](path.png)`."),
  "markdown/heading-demoted": (finding) => keep(finding, "use `#` for the title and `##` for the subtitle; a bold paragraph on purpose silences this."),
  "markdown/empty-slide": (finding) => keep(finding, "remove the extra `---`, or write `<!-- slide -->` to keep an empty slide."),
  "markdown/numbered-list": () => ({
    message: "Numbers in a list aren't kept: the list becomes bullets.",
    next: "add `numbering` to the slide in an `opf-slide` fence (see docs/numbered-lists.md), write the numbers into the text, or use a bulleted list.",
  }),
  "markdown/table-ragged": (finding) => keep(finding, "give every row the same number of cells as the header."),
  "markdown/formatting-dropped": (finding) => keep(finding, "use a plain string here, or put the field in an `opf-slide` fence."),
  "markdown/front-matter": wholeHelp,
  "markdown/front-matter-not-mapping": wholeHelp,
  "markdown/opf-slide": wholeHelp,
  "markdown/opf-slide-not-mapping": wholeHelp,
  "markdown/opf-block": wholeHelp,
  "markdown/opf-block-not-mapping": wholeHelp,
};

const yaml: Record<string, RuleText> = Object.fromEntries(
  ["yaml/syntax", "yaml/empty", "yaml/not-mapping", "yaml/multiple-documents", "yaml/duplicate-key", "yaml/key", "yaml/tag", "yaml/number", "yaml/alias", "yaml/alias-limit", "yaml/alias-cycle"].map((id) => [id, wholeHelp]),
);

/** The text of each YAML and Markdown reader rule, by finding `ruleId`. */
export const SOURCE_TEXT: Readonly<Record<string, RuleText>> = { ...yaml, ...markdown, ...options };

// ---- explain ------------------------------------------------------------------------------------------------------------------------

const entry = (category: string, severity: "error" | "warning", summary: string, rationale: string, fix: string, problem?: string, fixed?: string, language: "yaml" | "markdown" = "markdown"): ExplainEntry => ({
  category,
  severity,
  summary,
  rationale,
  fix,
  ...(problem !== undefined && fixed !== undefined ? { example: { problem, fixed, language } } : {}),
});

const YAML_WHY = "OPF reads JSON-compatible YAML 1.2, so a file that is not valid YAML cannot be opened at all; the finding says where the reader gave up.";

/** What `explain` says about the readers' rules, by finding `ruleId`. */
export const SOURCE_EXPLAIN: Readonly<Record<string, ExplainEntry>> = {
  "yaml/syntax": entry("format", "error", "The YAML text cannot be parsed.", YAML_WHY, "Fix the line the message names: indent with spaces, close quotes and brackets, give every key a colon and a value.", "slides:\n\t- title: a", "slides:\n  - title: a", "yaml"),
  "yaml/empty": entry("format", "error", "The YAML document is empty.", "An empty file (or one that is all comments) holds no deck.", "Write `slides:` and at least one `- title:` line.", "# deck", "slides:\n  - title: Title", "yaml"),
  "yaml/not-mapping": entry("format", "error", "The top level of the YAML is not a mapping.", "A deck is a mapping of properties (`name`, `slides`, ...); a bare list or value has nowhere to put them.", "Start with `key: value` lines, and put a list of slides under `slides:`.", "- title: a", "slides:\n  - title: a", "yaml"),
  "yaml/multiple-documents": entry("format", "error", "The file holds more than one YAML document.", "An OPF file is exactly one document; a second `---` starts a document the reader would silently ignore.", "Remove the extra `---`, or put each deck in its own file.", "a: 1\n---\nb: 2", "a: 1\nb: 2", "yaml"),
  "yaml/duplicate-key": entry("format", "error", "A YAML mapping repeats a key.", "Parsers keep one value of a repeated key and drop the other, so an author loses content without a trace.", "Keep one of the two, or rename the one you meant as another key.", "name: A\nname: B", "name: B", "yaml"),
  "yaml/key": entry("format", "error", "A YAML mapping key is not a string.", "JSON keys are always strings; a number, a list or a null as a key cannot be carried.", "Quote the key: `\"1\": value`.", "1: x", "\"1\": x", "yaml"),
  "yaml/tag": entry("format", "error", "A YAML tag is not allowed.", "OPF reads the YAML core schema; custom tags (`!!binary`, `!!set`) have no JSON form.", "Remove the tag; quote a value to keep it as text.", "a: !!set {x}", "a: x", "yaml"),
  "yaml/number": entry("format", "error", "A YAML number is not a finite number.", "JSON cannot carry `.inf` or `.nan`.", "Quote the value to keep it as text, or write a finite number.", "n: .inf", "n: \".inf\"", "yaml"),
  "yaml/alias": entry("format", "error", "A YAML anchor, alias or merge key is not allowed.", "Anchors and aliases make one value stand in for another, which OPF tools do not expand unless asked.", "Write each value out, or read the file with `aliases: true` (CLI: `--aliases`).", "a: &x 1\nb: *x", "a: 1\nb: 1", "yaml"),
  "yaml/alias-limit": entry("format", "error", "The anchors expand past the limit.", "Aliases that contain aliases grow exponentially; the reader stops at 100.", "Write the repeated values out, or reduce the aliasing.", undefined, undefined, "yaml"),
  "yaml/alias-cycle": entry("format", "error", "An alias refers to the value that contains it.", "A value that contains itself is infinitely deep and cannot be written as JSON.", "Write the nested value out.", undefined, undefined, "yaml"),
  "markdown/front-matter-unterminated": entry("format", "error", "The front matter is not closed.", "Without the closing `---` the reader cannot tell where the settings end and the first slide begins.", "Add a line with only `---` after the settings.", "---\nname: x\n\n# A", "---\nname: x\n---\n\n# A"),
  "markdown/front-matter": entry("format", "error", "The front matter is not valid YAML.", YAML_WHY, "Fix the line the message names.", "---\nname x\n---", "---\nname: x\n---"),
  "markdown/front-matter-not-mapping": entry("format", "error", "The front matter is not a mapping.", "Front matter holds deck properties as `key: value` lines.", "Write `key: value` lines.", "---\nname x\n---", "---\nname: x\n---"),
  "markdown/front-matter-slides": entry("format", "error", "The front matter holds `slides`.", "In Markdown the slides are the text below the front matter.", "Remove the `slides` key and write the slides below, separated by `---`.", "---\nslides: []\n---", "---\nname: x\n---"),
  "markdown/front-matter-comments": entry("format", "warning", "The front matter is only comments.", "A file that opens with `---` then only comments reads as empty front matter, not as slide content.", "Add the deck properties, or remove the first `---`.", undefined, undefined),
  "markdown/no-slides": entry("format", "error", "The Markdown has no slides.", "A deck needs at least one slide.", "Write a `# Title` line, or any content, then `---` between slides.", "", "# Title"),
  "markdown/options-syntax": entry("format", "error", "A slide or block options comment is malformed.", "Options are `key=value` pairs; a stray quote or missing value cannot be read.", "Write `<!-- slide: layout=title -->` with values bare or in double quotes.", "<!-- slide: layout= -->", "<!-- slide: layout=title -->"),
  "markdown/options-unknown-key": entry("format", "error", "An options comment names an option that does not exist.", "The dialect reads a fixed set of keys; an unknown one would be silently lost.", "Use one of the keys, or put other fields in an `opf-slide` fence.", "<!-- slide: layot=cover -->", "<!-- slide: layout=cover -->"),
  "markdown/options-value": entry("format", "error", "An option has a value it cannot take.", "Each option reads a specific kind of value, for example `hidden` is true or false.", "Write a value the option takes.", "<!-- slide: hidden=maybe -->", "<!-- slide: hidden=true -->"),
  "markdown/options-duplicate": entry("format", "error", "An option or an options comment is repeated.", "Two comments or two copies of one key leave it unclear which one is meant.", "Merge them into one.", "<!-- slide: layout=a layout=b -->", "<!-- slide: layout=b -->"),
  "markdown/options-orphan": entry("format", "error", "A block options comment is not followed by a block.", "The comment describes the block right after it.", "Put the comment directly before its block, or remove it."),
  "markdown/options-trailing": entry("format", "error", "Text follows an options comment on the same line.", "Everything after `-->` on that line would be ignored.", "Put the content on its own line."),
  "markdown/options-embedded": entry("format", "error", "A block options comment precedes an `opf-block` fence.", "The fence carries its own `id` and `type`.", "Put them inside the fence's YAML."),
  "markdown/comment-unterminated": entry("format", "error", "An HTML comment is never closed.", "Everything after an unclosed `<!--` would be swallowed into the comment.", "End the comment with `-->`.", "<!-- note", "<!-- note -->"),
  "markdown/fence-unterminated": entry("format", "error", "A fenced block is never closed.", "Everything after an unclosed fence would be read as its content.", "Add a closing fence line with at least as many backticks as opened it.", "```js\nx", "```js\nx\n```"),
  "markdown/code-fence": entry("format", "error", "A fenced block could not be read as code.", "A fence closes only with a line of at least as many backticks as opened it.", "Close the fence with at least as many backticks."),
  "markdown/chart-type": entry("format", "error", "A chart fence has no type.", "A chart needs its type (`column`, `bar`, `line`, `pie`, ...) to be drawn.", "Write the type after `chart`.", "```chart\n```", "```chart column\nCategory,Value\nA,1\n```"),
  "markdown/chart-attributes": entry("format", "error", "A chart fence has an attribute it cannot take.", "A chart fence takes `alt`, a text alternative in double quotes.", "Write ```chart column alt=\"What the data shows\"."),
  "markdown/chart-data": entry("format", "error", "A chart fence has no usable data.", "The chart is drawn from CSV with a header row, or a JSON object with `columns` and `rows`.", "Write CSV with a header row and at least one data row."),
  "markdown/chart-ragged": entry("format", "warning", "A chart row has a different number of values than the header.", "Missing cells plot as gaps.", "Give every row one value per column."),
  "markdown/metric-block": entry("format", "error", "A metric fence is malformed.", "A metric is `key: value` lines using a fixed set of keys.", "Write `value:` and, if you like, `label:`, `unit:`, `delta:`, `trend:` and `sentiment:`.", "```metric\nlabel: Revenue\n```", "```metric\nvalue: 42\nlabel: Revenue\n```"),
  "markdown/timeline-attributes": entry("format", "error", "A timeline fence has an attribute it cannot take.", "A timeline fence takes `name` and `description`.", "Remove the attribute, or use `name=` or `description=`."),
  "markdown/timeline-description": entry("format", "error", "An indented line has no event above it.", "A description belongs to the event before it.", "Put the event first, then its description indented below it."),
  "markdown/timeline-events": entry("format", "error", "A timeline fence has no events.", "A timeline is drawn from its events.", "Write one event per line, for example `2024 Q1 — Pilot`."),
  "markdown/opf-slide": entry("format", "error", "The YAML of an `opf-slide` fence is not valid.", YAML_WHY, "Fix the line the message names."),
  "markdown/opf-slide-not-mapping": entry("format", "error", "An `opf-slide` fence is not a mapping.", "The fence holds the slide's fields as `key: value` lines.", "Write `key: value` lines."),
  "markdown/opf-block": entry("format", "error", "The YAML of an `opf-block` fence is not valid.", YAML_WHY, "Fix the line the message names."),
  "markdown/opf-block-not-mapping": entry("format", "error", "An `opf-block` fence is not a mapping.", "The fence holds the block's fields as `key: value` lines.", "Write `key: value` lines."),
  "markdown/slide-property-conflict": entry("format", "error", "A slide field is set in the Markdown and in the `opf-slide` fence.", "Two values for one field leave it unclear which wins.", "Keep it in one place."),
  "markdown/duplicate-title": entry("format", "error", "A slide has more than one `#` title.", "A slide has one title; a second `#` is the start of the next slide.", "Use `---` to start a new slide, or `##` for the subtitle."),
  "markdown/duplicate-subtitle": entry("format", "error", "A slide has more than one `##` subtitle.", "A slide has one subtitle.", "Write further lines as paragraphs."),
  "markdown/empty-heading": entry("format", "error", "A heading has no text.", "An empty title is an empty field.", "Write the title after the `#`, or remove the line."),
  "markdown/empty-quote": entry("format", "error", "A block quote has no text.", "A quote without text draws nothing.", "Write the quote after `>`."),
  "markdown/image-source": entry("format", "error", "An image has no source.", "A picture needs a file or an address.", "Write it inside the parentheses: `![alt](path.png)`."),
  "markdown/heading-demoted": entry("format", "warning", "A heading below level 2 has no OPF form.", "Only `#` (title) and `##` (subtitle) are slide fields.", "Use a bold paragraph on purpose to silence this."),
  "markdown/empty-slide": entry("format", "warning", "Two `---` lines in a row gave an empty slide.", "The empty slide was skipped.", "Remove the extra `---`, or write `<!-- slide -->` to keep it."),
  "markdown/numbered-list": entry("format", "warning", "List numbers are not kept.", "The dialect does not read numbers as `numbering`, so each item became a bullet.", "Add `numbering` in an `opf-slide` fence, or use a bulleted list.", "1. one\n2. two", "```opf-slide\nitems:\n  - one\n  - two\nnumbering: decimal\n```"),
  "markdown/table-ragged": entry("format", "warning", "A table row has a different number of cells than the header.", "Missing cells are empty.", "Give every row the same number of cells."),
  "markdown/formatting-dropped": entry("format", "warning", "Inline formatting was dropped.", "The field takes a plain string.", "Use plain text here, or put the field in an `opf-slide` fence."),
};
