/**
 * The plain-words text of the `format`, `references` and `policy` rules (VALIDATOR-HINTS section 8, "Format and references"). Internal module;
 * `finding-text-rules.ts` assembles it with the accessibility, layout and content rules.
 *
 * Every handler writes `{ message, next }` from the structured data the finding carries (`path`, `validation.params`, `suggestions`, the document) and,
 * where a parameter exists only in core's own sentence, from an anchored expression over that sentence. When the sentence is not the expected
 * shape a handler returns core's message kept, with a `next` line, instead of guessing.
 */
import type { Finding } from "./generated/types/finding.js";
import { describeFinding } from "./finding-text.js";
import {
  type RuleText,
  KIND_WORDS,
  cap,
  code,
  describeValue,
  fieldLabel,
  isRecord,
  nearest,
  placeWords,
} from "./finding-text-util.js";
import {
  chooseNext,
  codeList,
  dotted,
  freshName,
  helpAsNext,
  idsAt,
  isText,
  keep,
  keysAt,
  kindPhrase,
  lastName,
  match,
  plainList,
  sentence,
  unquote,
  unquoteList,
  us,
} from "./finding-text-helpers.js";

const params = (finding: Finding): Record<string, unknown> => (isRecord(finding.validation?.params) ? finding.validation.params : {});
const text = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

/** `opf/json-syntax`: the finding's own message (already plain words); `next` is its help. */
const jsonSyntax: RuleText = (finding) => ({
  message: keep(finding.message),
  next: helpAsNext(finding, "fix the syntax error at the marked position."),
});

/** `opf/duplicate-key`: VALIDATOR-HINTS section 6. The JSON Pointer's last segment is the key. */
const duplicateKey: RuleText = (finding, _context, helpers) => {
  const key = helpers.segments.at(-1) ?? unquote(match(finding.message, /^Duplicate JSON property (".*")\.$/)?.[1]);
  const owner = placeWords(helpers.segments.slice(0, -1));
  return {
    message: `${code(key)} appears twice ${owner}. JSON keeps only the last value, so the earlier one is ignored.`,
    next: "keep one of them, or merge their values into one.",
  };
};

/** `opf/schema` without a schema keyword: the finding's message kept, `next` from its help. */
const schemaPlain: RuleText = (finding) => ({
  message: keep(finding.message),
  next: helpAsNext(finding, "check the schema reference for this field."),
});

// ------------------------------------------------------------------------------------------------ references and citations

const referenceIdDuplicate: RuleText = (finding, _context, helpers) => {
  const id = text(params(finding).id) ?? unquote(match(finding.message, /^reference id '(.+?)' is used/)?.[1]);
  const ids = idsAt(helpers, ["references"]);
  const index = Number(helpers.segments[1]);
  const first = ids.indexOf(id);
  const where = first >= 0 && Number.isInteger(index) && first !== index ? ` (references ${first + 1} and ${index + 1})` : "";
  return {
    message: `Two references use the id ${code(id)}${where}.`,
    next: `give the later one another id (for example ${code(freshName(id, ids))}); runs cite references by id.`,
  };
};

const citeUnknownReference: RuleText = (finding, _context, helpers) => {
  const id = text(params(finding).id) ?? unquote(match(finding.message, /^unknown reference '(.+?)'/)?.[1]);
  const ids = idsAt(helpers, ["references"]);
  const add = `add a reference with the id ${code(id)} under ${code("references")}`;
  return {
    message: `${code(`cite: "${id}"`)} names a reference that does not exist.`,
    next: chooseNext(id, ids, add),
  };
};

const citeUnsupportedLocation: RuleText = (finding) => {
  const where = match(finding.message, /^cite and footnote are not supported in ([^;]+);/)?.[1];
  const inReferences = /^reference text cannot cite/.test(finding.message);
  if (inReferences)
    return { message: `${code("cite")} and ${code("footnote")} can't be used inside the text of a reference.`, next: `remove ${code("cite")} and ${code("footnote")} from that run.` };
  return {
    message: `${code("cite")} and ${code("footnote")} are drawn only in titles, text, bullets, list items and quotes${where ? `, not in ${where}` : ""}.`,
    next: "move the cited run into a text block, or remove the citation here.",
  };
};

const captionUnsupportedPayload: RuleText = (finding) => {
  const type = text(params(finding).type) ?? match(finding.message, /; this payload is '(.+?)'/)?.[1];
  const kind = type ?? (/a group cannot carry one/.test(finding.message) ? "group" : undefined);
  const is = kind ? kindPhrase(kind) : "not one of those";
  return {
    message: `A ${code("caption")} belongs to one image, chart, table or video; this block is ${is}.`,
    next: `put the ${code("caption")} on the image, chart, table or video it describes, or remove it.`,
  };
};

const imageOptionUnsupportedPayload: RuleText = (finding) => {
  const field = text(params(finding).field) ?? match(finding.message, /^(\w+) is only valid on an image payload/)?.[1];
  const type = text(params(finding).type) ?? match(finding.message, /; this payload is '(.+?)'/)?.[1];
  const kind = type ?? (/a group cannot carry them/.test(finding.message) ? "group" : undefined);
  if (!field) return undefined;
  return {
    message: `${code(field)} only applies to pictures; this block is ${kind ? kindPhrase(kind) : "not a picture"}.`,
    next: `remove ${code(field)}, or move it onto an image.`,
  };
};

const imagePlacementInvalid: RuleText = (finding) => {
  const { edge, blocks } = params(finding);
  if (typeof edge === "string" && Array.isArray(blocks) && blocks.length === 2) {
    return {
      message: `Blocks ${Number(blocks[0]) + 1} and ${Number(blocks[1]) + 1} are both placed on the ${edge} edge, and a slide edge takes one placed image.`,
      next: `move one of them to another edge, or remove its ${code("placement")}.`,
    };
  }
  return {
    message: `${code("placement")} can't be used here: a block inside a group or a region can't bleed to a slide edge.`,
    next: `use ${code("placement")} on a top-level block of the slide, one per slide edge, or remove it.`,
  };
};

const layoutPlaceholderGroup: RuleText = (finding) => {
  const detail = finding.message.trim();
  return {
    message: detail ? `${cap(keep(detail))} A group holds body regions only, not headings.` : "A placeholder group nests at most three levels and holds body regions only, not headings.",
    next: "flatten the group, and keep the title, subtitle and tag at the layout's top level.",
  };
};

// ------------------------------------------------------------------------------------------------ data

/** The dataset a table's `fields` or a chart's `data` names, read from the document next to the finding's path. */
function datasetOf(helpers: { valueAt(path: readonly string[]): unknown; segments: string[] }): string | undefined {
  const at = helpers.segments.findIndex((segment) => segment === "fields" || segment === "columns" || segment === "mapping" || segment === "highlight");
  const parent = at > 0 ? helpers.segments.slice(0, at) : helpers.segments.slice(0, -1);
  for (const candidate of [parent, [...parent, "data"]]) {
    const value = helpers.valueAt([...candidate, "dataset"]);
    if (isText(value)) return value;
  }
  return undefined;
}

const datasetUnknown: RuleText = (finding, _context, helpers) => {
  const id = unquote(match(finding.message, /^unknown dataset '(.+?)'/)?.[1]) || String(helpers.valueAt(helpers.segments) ?? "");
  if (!id) return undefined;
  const ids = keysAt(helpers, ["datasets"]);
  const here = ids.length ? `Datasets in this deck: ${plainList(ids)}.` : "This deck has no datasets.";
  return {
    message: `${code(`dataset: "${id}"`)} does not exist. ${here}`,
    next: chooseNext(id, ids, `add ${code(`datasets.${id}`)}`),
  };
};

const datasetFieldUnknown: RuleText = (finding, _context, helpers) => {
  const found = match(finding.message, /^field ("(?:[^"\\]|\\.)*") is not a column of the dataset; use one of (.+)$/);
  if (!found) return undefined;
  const field = unquote(found[1]);
  const columns = unquoteList(found[2]);
  const dataset = datasetOf(helpers);
  return {
    message: `${code(field)} is not a column of ${dataset ? code(dataset) : "the dataset"}. Columns: ${plainList(columns)}.`,
    next: chooseNext(field, columns),
  };
};

const dataColumnDuplicate: RuleText = (finding, _context, helpers) => {
  const name = unquote(match(finding.message, /^column name ("(?:[^"\\]|\\.)*") is used by an earlier column/)?.[1]);
  if (!name) return undefined;
  const columns = helpers.valueAt(helpers.segments.slice(0, -1));
  const taken = Array.isArray(columns) ? columns.map((entry) => (isRecord(entry) ? String(entry.name) : String(entry))) : [];
  return {
    message: `Two columns are named ${code(name)}. Series and mappings address columns by name.`,
    next: `rename the second one (for example ${code(freshName(name, taken))}).`,
  };
};

const chartMappingUnknownColumn: RuleText = (finding) => {
  const found = match(finding.message, /^mapping names column ("(?:[^"\\]|\\.)*"), which the chart data does not have; use one of (.+)$/);
  if (!found) return undefined;
  const name = unquote(found[1]);
  const columns = unquoteList(found[2]);
  return {
    message: `The chart mapping names column ${code(name)}, which the data does not have. Columns: ${plainList(columns)}.`,
    next: chooseNext(name, columns),
  };
};

const numberFormatInvalid: RuleText = (finding, _context, helpers) => {
  const value = helpers.valueAt(helpers.segments);
  const reason = match(finding.message, /^Number format '.*?' ((?:needs|scales|has|uses|asks|allows|is)\b.+)$/)?.[1];
  const subject = typeof value === "string" && value ? `${code(value)} is not a number format OPF can read` : "This is not a number format OPF can read";
  return {
    message: `${subject}.${reason ? ` It ${sentence(us(reason))}` : ""}`,
    next: `write a format such as ${code("0.0")}, ${code("#,##0")}, ${code("0%")} or ${code("$#,##0.00")}.`,
  };
};

const chartHighlightUnknownName: RuleText = (finding) => {
  const series = match(finding.message, /^highlight names series ("(?:[^"\\]|\\.)*"), which the chart data does not have as a column; use one of (.+)$/);
  if (series) {
    const name = unquote(series[1]);
    const columns = unquoteList(series[2]);
    return { message: `${code(`highlight: "${name}"`)} matches no series. Available: ${plainList(columns)}.`, next: chooseNext(name, columns) };
  }
  const category = match(finding.message, /^highlight names category ("(?:[^"\\]|\\.)*"), which no row of the chart data has as its label(?:; the labels are (.+))?$/);
  if (category) {
    const name = unquote(category[1]);
    const labels = unquoteList(category[2]);
    return {
      message: `${code(`highlight: "${name}"`)} matches no category.${labels.length ? ` Available: ${plainList(labels)}${/\.\.\.$/.test(category[2] ?? "") ? ", …" : ""}.` : ""}`,
      next: labels.length ? chooseNext(name, labels) : "name a category that appears in the chart data, or remove the entry.",
    };
  }
  return undefined;
};

// ------------------------------------------------------------------------------------------------ variables

/** `{{id}}` for an inline token, `var:id` where the finding's own sentence says the whole-field form. */
const tokenOf = (finding: Finding, id: string): string => (finding.message.includes(`var:${id}`) ? code(`var:${id}`) : code(`{{${id}}}`));

const SAMPLE_BY_KIND: Record<string, string> = {
  number: "a plain number such as 42",
  date: "a date such as 2026-10-24",
  color: "a color such as #1F4E79",
  url: "a web address such as https://example.com",
  image: "an `asset:` reference or an https:// address",
  list: "a list of values",
  text: "some text",
};

const variableInvalidValue: RuleText = (finding) => {
  const found = match(finding.message, /^Value for '(.+?)' \((\w+)\): (.+?)\.?$/);
  const id = text(params(finding).id) ?? found?.[1];
  if (!id) return undefined;
  const kind = found?.[2] ?? "";
  return {
    message: `The value given for ${code(id)} does not fit its type${kind ? ` (${kind})` : ""}${found?.[3] ? `: ${us(found[3])}` : ""}.`,
    next: `give it ${SAMPLE_BY_KIND[kind] ?? "a value of the declared type"}.`,
  };
};

const BUILTINS = ["deck.name", "deck.description", "deck.author", "deck.slideCount", "slide.number", "slide.section", "speakers", "speaker.name", "speaker.title", "speaker.email", "speaker.phone", "speaker.bio", "speaker.photo", "organization.name", "organization.legalName", "organization.tagline", "organization.domain", "organization.email", "organization.phone"];

const variableUnknownBuiltin: RuleText = (finding) => {
  const id = text(params(finding).id) ?? match(finding.message, /^'(.+?)' is not a built-in variable/)?.[1];
  if (!id) return undefined;
  const mentioned = [...finding.message.matchAll(/'((?:deck|slide|speaker|organization)[A-Za-z0-9_.-]*|speakers)'/g)].map((entry) => entry[1] as string).filter((name) => name !== id);
  const candidates = [...new Set([...mentioned, ...BUILTINS])];
  const { close } = nearest(id, candidates);
  const whole = /^'var:/.test(finding.message) || finding.message.includes(`'var:${id}'`);
  const message = whole
    ? `${code(`var:${id}`)} is not supported: ${code(id)} is a slide-scoped built-in, written only as the inline token ${code(`{{${id}}}`)}.`
    : `${tokenOf(finding, id)} is not a built-in variable.`;
  if (whole) return { message, next: `write ${code(`{{${id}}}`)} inside the text instead.` };
  return { message, next: close.length ? `did you mean ${code(close[0])}?` : `use one of ${codeList(mentioned.length ? mentioned : BUILTINS.slice(0, 4), 4, "or")}, or declare ${code(id)} under ${code("variables")}.` };
};

const variableFormat: RuleText = (finding, _context, helpers) => {
  const id = text(params(finding).id);
  const declared = id ? helpers.valueAt(["variables", id, "format"]) : undefined;
  const reason = match(finding.message, /^(?:Number|Date) format '.*?' (.+)$/)?.[1];
  const kind = id ? helpers.valueAt(["variables", id, "type"]) : undefined;
  return {
    message: `The format${typeof declared === "string" ? ` ${code(declared)}` : ""} does not apply to ${kind ? `a ${String(kind)}` : "this"} value${id ? ` (${code(id)})` : ""}${reason ? `: it ${sentence(us(reason)).replace(/\.$/, "")}` : ""}.`,
    next: `change the ${code("format")} of ${id ? code(id) : "the variable"} to one that fits its values, such as ${kind === "date" ? code("MMMM d, yyyy") : code("#,##0.0")}.`,
  };
};

const variableUnfilled: RuleText = (finding, _context, helpers) => {
  const token = match(finding.message, /^Template variable ("\{\{.+\}\}") is still in the text\.$/);
  if (token) {
    const literal = unquote(token[1]);
    const id = /\{\{\s*([a-z][a-z0-9-]*)/.exec(literal)?.[1] ?? literal;
    return {
      message: `${code(literal)} is still in the text, so it would show literally.`,
      next: `declare ${code(id)} under ${code("variables")} and give it a value, or replace the token with the real text.`,
    };
  }
  const id = text(params(finding).id) ?? match(finding.message, /^(?:required variable '(.+?)'|Template variable ("(?:[^"\\]|\\.)*")) has no value/)?.[1] ?? helpers.segments.at(-1);
  const inTemplate = /^Template variable/.test(finding.message);
  if (!id) return undefined;
  const name = id.startsWith('"') ? unquote(id) : id;
  if (inTemplate) {
    return {
      message: `Template variable ${code(name)} has no value yet.`,
      next: `fill it (${code("opf fill")}) before using the deck, or leave it while you edit the template.`,
    };
  }
  return {
    message: `Required variable ${code(name)} has no value, so ${code(`{{${name}}}`)} would show literally.`,
    next: `give it a ${code("value")}, or mark the deck ${code("template: true")}.`,
  };
};

const variableUnknown: RuleText = (finding, _context, helpers) => {
  const id = text(params(finding).id) ?? match(finding.message, /^'\{\{(.+?)\}\}' names no declared variable/)?.[1];
  if (!id) return undefined;
  const declared = keysAt(helpers, ["variables"]);
  const { close } = nearest(id, declared);
  return {
    message: `${code(`{{${id}}}`)} is not declared under ${code("variables")}.`,
    next: close.length ? `did you mean ${code(close[0])}? Or declare ${code(id)} under ${code("variables")}.` : `declare ${code(id)} under ${code("variables")}, or write ${code("\\{{")} for literal braces.`,
  };
};

const variableUnknownValue: RuleText = (finding, _context, helpers) => {
  const id = text(params(finding).id) ?? match(finding.message, /^A value was supplied for '(.+?)'/)?.[1];
  if (!id) return undefined;
  const declared = keysAt(helpers, ["variables"]);
  const { close } = nearest(id, declared);
  return {
    message: `A value was supplied for ${code(id)}, which is not declared.`,
    next: close.length ? `did you mean ${code(close[0])}? Or declare ${code(id)} under ${code("variables")}.` : `declare ${code(id)} under ${code("variables")}, or remove the value.`,
  };
};

const variableUnused: RuleText = (finding, _context, helpers) => {
  const id = text(params(finding).id) ?? helpers.segments.at(-1);
  if (!id) return undefined;
  return {
    message: `Variable ${code(id)} is declared but never used.`,
    next: `use it as ${code(`{{${id}}}`)} or ${code(`var:${id}`)} where it belongs, or remove its declaration.`,
  };
};

const variableReferenceUnknown: RuleText = (finding, _context, helpers) => {
  const id = text(params(finding).id) ?? match(finding.message, /^unknown variable '(.+?)'/)?.[1];
  if (!id) return undefined;
  const declared = keysAt(helpers, ["variables"]);
  const { close } = nearest(id, declared);
  return {
    message: `${code(`var:${id}`)} is not declared, so a default color is used.`,
    next: close.length ? `did you mean ${code(`var:${close[0]}`)}? Or declare ${code(id)} under ${code("variables")}.` : `declare ${code(id)} under ${code("variables")}, or use another color.`,
  };
};

// The names a run `color` may take besides a hex color and a `var:` reference (the color scheme's slots and roles).
const SCHEME_COLORS = ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "dark1", "dark2", "light1", "light2", "hyperlink", "followedHyperlink", "primary", "secondary", "accent", "background", "surface", "surfaceAlt", "text", "textSecondary"];

const runColorUnrecognized: RuleText = (finding, _context, helpers) => {
  const value = text(params(finding).color) ?? match(finding.message, /^run color '(.+?)' is not/)?.[1] ?? text(helpers.valueAt(helpers.segments));
  if (!value) return undefined;
  const { close } = nearest(value, SCHEME_COLORS);
  return {
    message: `${code(`color: "${value}"`)} is not a hex color, a scheme color or a ${code("var:")} reference, so the theme color is used.`,
    next: close.length ? `did you mean ${code(close[0])}?` : `write a hex color like ${code("#1F4E79")}, a scheme color such as ${code("accent1")}, or ${code("var:")} and a variable id.`,
  };
};

const numberingStartIgnored: RuleText = (_finding, _context, helpers) => {
  const owner = lastName(helpers.segments);
  return {
    message: `${code("start")} has no effect without ${code("numbering")} on ${owner ? `the ${code(owner)} list` : "this list"}.`,
    next: `add ${code("numbering")} to the list, or remove ${code("start")}.`,
  };
};

const slideSizeOutOfRange: RuleText = (finding) => {
  const { widthInches, heightInches } = params(finding);
  const size = typeof widthInches === "number" && typeof heightInches === "number" ? `A ${widthInches}×${heightInches} in slide` : "This slide size";
  return {
    message: `${size} is outside PowerPoint's 1 to 56 inch range, so PowerPoint may reject the export.`,
    next: `set ${code("design.dimensions")} to sizes between 1 and 56 inches, or to a preset.`,
  };
};

// ------------------------------------------------------------------------------------------------ catalogs and assets

const undeclaredCatalog: RuleText = (finding) => {
  const found = match(finding.message, /^Reference ("(?:[^"\\]|\\.)*") names catalog group ("(?:[^"\\]|\\.)*"), which/);
  if (!found) return undefined;
  const reference = unquote(found[1]);
  const group = unquote(found[2]);
  const bare = reference.includes(":") ? reference.slice(reference.indexOf(":") + 1) : reference;
  return {
    message: `${code(reference)} uses catalog group ${code(group)}, which ${code("catalogs")} does not declare, so it can never resolve.`,
    next: `declare ${code(`catalogs.${group}`)}, or write ${code(bare)}.`,
  };
};

const assetReference: RuleText = (finding, _context, helpers) => {
  const id = unquote(match(finding.message, /^Asset ("(?:[^"\\]|\\.)*") is missing/)?.[1]);
  if (!id) return undefined;
  const ids = keysAt(helpers, ["assets"]);
  const suggested = (finding.suggestions ?? []).map((entry) => String(entry.value).replace(/^asset:/, ""));
  const known = ids.length ? ids : suggested;
  const { close } = nearest(id, known);
  const add = `add ${code(`assets.${id}`)}`;
  return {
    message: `${code(`asset:${id}`)} is not in ${code("assets")}.${known.length ? ` Assets: ${plainList(known)}.` : " This deck has no assets."}`,
    next: close.length ? `did you mean ${code(`asset:${close[0]}`)}? Or ${add}.` : known.length ? `pick one of ${plainList(known.slice(0, 4))}, or ${add}.` : `${add}.`,
  };
};

const assetCycle: RuleText = (finding) => {
  const chainText = match(finding.message, /^Asset references form a cycle: (.+)\.$/)?.[1];
  const chain = chainText ? chainText.split(" → ").map(unquote) : [];
  const first = chain[0];
  if (!first || chain.length < 2) return undefined;
  const through = chain.slice(1, -1);
  const how = through.length ? ` through ${codeList(through)}` : "";
  return {
    message: `Asset ${code(first)} points back to itself${how}.`,
    next: "give one link a real source (an https:// address or embedded data) instead of an `asset:` reference.",
  };
};

const KIND_SINGULAR = (kind: string): string => KIND_WORDS[kind] ?? kind.replace(/s$/, "");

const catalogRecord: RuleText = (finding, context) => {
  const [root, group, kind, id] = finding.path.split("/").slice(1).map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  if (root !== "catalogs" || !kind || !id) return undefined;
  const inner = describeFinding({ ...finding, ruleId: "opf/schema" }, context);
  const registered = finding.scope === "context";
  const record = `${registered ? "The registered" : "The embedded"} ${KIND_SINGULAR(kind)} ${code(id)}`;
  void group;
  return {
    message: `${record} is invalid: ${inner.message.charAt(0).toLowerCase()}${inner.message.slice(1)}`,
    next: inner.next ?? `fix the record; references to it are reported too.`,
  };
};

/** The place inside a layout record a template finding is about: `regions[1].size`, or "the layout" for the record itself. */
function layoutSpot(finding: Finding): { id?: string; spot: string } {
  const parts = finding.path.split("/").slice(1).map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  if (parts[0] === "catalogs" && parts[2] === "layouts") return { id: parts[3], spot: dotted(parts.slice(4)) };
  return { spot: dotted(parts) };
}

const layoutTemplate: RuleText = (finding) => {
  const { id, spot } = layoutSpot(finding);
  const detail = finding.message.trim().replace(/\.$/, "");
  return {
    message: `The layout's region list is malformed${spot ? ` at ${code(spot)}` : ""}${id ? ` (layout ${code(id)})` : ""}: ${us(detail)}.`,
    next: spot ? `correct ${code(spot)} as described; the layout is not used until it is valid.` : "correct the layout as described; it is not used until it is valid.",
  };
};

const layoutRegion: RuleText = (finding) => {
  const { id, spot } = layoutSpot(finding);
  const detail = finding.message.trim().replace(/\.$/, "");
  const reserved = match(detail, /^'(.+?)' is reserved and cannot name a body region \(reserved: (.+)\)$/);
  if (reserved) {
    return {
      message: `Region name ${code(reserved[1])} is reserved, so it can't name a body region${id ? ` of layout ${code(id)}` : ""}. Reserved names: ${reserved[2]}.`,
      next: `rename it, for example ${code(`${reserved[1]}-area`)}.`,
    };
  }
  const twice = match(detail, /^region name '(.+?)' is used twice/);
  if (twice) {
    return {
      message: `Region name ${code(twice[1])} is used twice; names are unique across the whole layout.`,
      next: `rename one of them (for example ${code(freshName(twice[1] as string))}).`,
    };
  }
  const badName = match(detail, /^'(.+?)' is not a region name/);
  if (badName) {
    const bad = badName[1] as string;
    return {
      message: `${code(bad)} is not a valid region name: use lowercase letters, digits and hyphens, starting with a letter.`,
      next: `rename it, for example ${code(bad.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^[^a-z]+|-+$/g, "") || "body")}.`,
    };
  }
  return {
    message: `A region of the layout is not valid${spot ? ` at ${code(spot)}` : ""}${id ? ` (layout ${code(id)})` : ""}: ${us(detail)}.`,
    next: spot ? `correct ${code(spot)} as described.` : "correct the layout as described.",
  };
};

/** What the engine does when a reference does not resolve, per kind (core: layouts compose automatically, everything else uses the engine default). */
const FALLBACK = (kind: string): string => (kind === "layouts" ? "the slide is laid out automatically" : "the engine default is used");

const unresolvedReference: RuleText = (finding, _context, helpers) => {
  const found = match(finding.message, /^([A-Z][A-Za-z ]*?) '(.+?)' resolves nowhere/);
  const kind = finding.lookup?.[2] ?? "";
  const reference = found?.[2] ?? (() => {
    const value = helpers.valueAt(helpers.segments);
    return typeof value === "string" ? value : undefined;
  })();
  if (!reference) return undefined;
  const noun = cap(KIND_SINGULAR(kind || (found?.[1] ?? "catalog record").toLowerCase()));
  const colon = reference.indexOf(":");
  const group = colon > 0 ? reference.slice(0, colon) : undefined;
  const bare = colon > 0 ? reference.slice(colon + 1) : reference;
  const embeddedIn = group ? [group] : ["custom", "default"];
  const embedded = kind && embeddedIn.some((name) => isRecord(helpers.valueAt(["catalogs", name, kind, bare])));
  const suggestions = (finding.suggestions ?? []).slice(0, 5).map((entry) => String(entry.value));
  if (embedded) {
    return {
      message: `${noun} ${code(reference)} is embedded but invalid, so it is not used and ${FALLBACK(kind)}.`,
      next: `fix the record named in the other problems, or remove the reference.`,
    };
  }
  const message =
    group && /declares no catalogs\./.test(finding.message)
      ? `${noun} ${code(reference)} uses catalog group ${code(group)}, which the deck does not declare, so ${FALLBACK(kind)}.`
      : `${noun} ${code(reference)} is not embedded or in a registered catalog, so ${FALLBACK(kind)}.`;
  const { close } = nearest(reference, suggestions);
  const remove = kind === "layouts" ? "remove the reference to let OPF pick" : "remove the reference";
  return {
    message,
    next: close.length
      ? `did you mean ${code(close[0])}?`
      : suggestions.length
        ? `choose one of ${codeList(suggestions, 5, "or")}, embed the record under ${code("catalogs.custom")}, or ${remove}.`
        : `embed the record under ${code("catalogs.custom")}, register the catalog that defines it, or ${remove}.`,
  };
};

const catalogRecordNotInSource: RuleText = (finding) => {
  const found = match(finding.message, /^Record ("(?:[^"\\]|\\.)*") is embedded under catalogs\.([^.]+)\.(\w+), but the catalog registered for (.+?) has no /);
  if (!found) return undefined;
  const id = unquote(found[1]);
  const group = found[2] as string;
  return {
    message: `${code(id)} says it comes from ${found[4]}, but that catalog has no such record. It is treated as your own.`,
    next: `move it to ${code("catalogs.custom")}${group === "default" ? "" : ` and drop the ${code(`${group}:`)} prefix from its references`}, or use an id that the catalog publishes.`,
  };
};

const unusedReference: RuleText = (finding, _context, helpers) => {
  const id = text(params(finding).id) ?? match(finding.message, /^reference '(.+?)' is never cited/)?.[1];
  if (!id) return undefined;
  void helpers;
  return {
    message: `Reference ${code(id)} is never cited.`,
    next: `cite it from a text, bullet or list item (${code(`cite: "${id}"`)}), or remove it.`,
  };
};

const unusedDataset: RuleText = (finding, _context, helpers) => {
  const id = helpers.segments.at(-1) ?? unquote(match(finding.message, /^Dataset ("(?:[^"\\]|\\.)*") is never referenced/)?.[1]);
  if (!id) return undefined;
  return {
    message: `Dataset ${code(id)} is not used by any chart or table.`,
    next: `point a chart or table at it with ${code(`dataset: "${id}"`)}, or remove it.`,
  };
};

const unknownBeat: RuleText = (finding, _context, helpers) => {
  const found = match(finding.message, /^Slide (\d+) names beat ("(?:[^"\\]|\\.)*"), which narrative ("(?:[^"\\]|\\.)*") does not define/);
  if (!found) return undefined;
  const beat = unquote(found[2]);
  const narrative = unquote(found[3]);
  const beats = (finding.suggestions ?? []).map((entry) => String(entry.value));
  const { close } = nearest(beat, beats);
  void helpers;
  return {
    message: `Slide ${found[1]} names beat ${code(beat)}, which narrative ${code(narrative)} does not define.${beats.length ? ` Its beats include ${plainList(beats.slice(0, 5))}.` : ""}`,
    next: close.length ? `did you mean ${code(close[0])}?` : beats.length ? `use one of ${codeList(beats, 5, "or")}, or remove ${code("beat")}.` : `use a beat the narrative defines, or remove ${code("beat")}.`,
  };
};

const slideThemeDimensions: RuleText = (finding) => {
  const { slideDimensions, deckDimensions } = params(finding);
  const nice = (value: unknown): string | undefined => {
    const found = /^([\d.]+)x([\d.]+) px$/.exec(String(value ?? ""));
    return found ? `${Math.round(Number(found[1]))}×${Math.round(Number(found[2]))} px` : undefined;
  };
  const slide = nice(slideDimensions);
  const deck = nice(deckDimensions);
  return {
    message: `This slide's theme sets another slide size${slide && deck ? ` (${slide}; the deck is ${deck})` : ""}, which is ignored: a deck has one size.`,
    next: `set ${code("design.dimensions")} on the deck, or give every slide's theme the same dimensions.`,
  };
};

// ------------------------------------------------------------------------------------------------ policy

const contract: RuleText = (finding, _context, helpers) => {
  const actual = helpers.valueAt(helpers.segments);
  const allowed = (finding.suggestions ?? []).filter((entry) => entry.origin === "contract").map((entry) => entry.value);
  const standard = match(finding.message, /^This value is outside the allowed values for (.+)\.$/);
  const label = helpers.segments.length ? fieldLabel(helpers.segments) : "the deck";
  const allowedWords = allowed.length ? plainList(allowed.map((value) => (typeof value === "string" ? value : JSON.stringify(value))), 6) : undefined;
  const message = standard
    ? `${cap(label)} is ${actual === undefined ? "missing or unset" : describeValue(actual)}, which this host's policy does not allow.${allowedWords ? ` Allowed: ${allowedWords}.` : ""}`
    : keep(finding.message);
  return {
    message,
    next: allowed.length ? chooseNext(actual, allowed.map((value) => (typeof value === "string" ? value : JSON.stringify(value)))) : helpAsNext(finding, "change it to an allowed value."),
  };
};

export const FORMAT_TEXT: Readonly<Record<string, RuleText>> = {
  "opf/json-syntax": jsonSyntax,
  "opf/duplicate-key": duplicateKey,
  "opf/schema": schemaPlain,
  "opf/reference-id-duplicate": referenceIdDuplicate,
  "opf/cite-unknown-reference": citeUnknownReference,
  "opf/cite-unsupported-location": citeUnsupportedLocation,
  "opf/caption-unsupported-payload": captionUnsupportedPayload,
  "opf/image-option-unsupported-payload": imageOptionUnsupportedPayload,
  "opf/image-placement-invalid": imagePlacementInvalid,
  "opf/layout-placeholder-group": layoutPlaceholderGroup,
  "opf/dataset-unknown": datasetUnknown,
  "opf/dataset-field-unknown": datasetFieldUnknown,
  "opf/data-column-duplicate": dataColumnDuplicate,
  "opf/chart-mapping-unknown-column": chartMappingUnknownColumn,
  "opf/number-format-invalid": numberFormatInvalid,
  "opf/variable-invalid-value": variableInvalidValue,
  "opf/variable-unknown-builtin": variableUnknownBuiltin,
  "opf/chart-highlight-unknown-name": chartHighlightUnknownName,
  "opf/variable-format": variableFormat,
  "opf/variable-unfilled": variableUnfilled,
  "opf/run-color-unrecognized": runColorUnrecognized,
  "opf/numbering-start-ignored": numberingStartIgnored,
  "opf/slide-size-out-of-range": slideSizeOutOfRange,
  "opf/undeclared-catalog": undeclaredCatalog,
  "opf/asset-reference": assetReference,
  "opf/asset-cycle": assetCycle,
  "opf/catalog-record": catalogRecord,
  "opf/layout-template": layoutTemplate,
  "opf/layout-region": layoutRegion,
  "opf/unresolved-reference": unresolvedReference,
  "opf/catalog-record-not-in-source": catalogRecordNotInSource,
  "opf/unused-reference": unusedReference,
  "opf/unused-dataset": unusedDataset,
  "opf/unknown-beat": unknownBeat,
  "opf/slide-theme-dimensions": slideThemeDimensions,
  "opf/variable-unknown": variableUnknown,
  "opf/variable-unknown-value": variableUnknownValue,
  "opf/variable-unused": variableUnused,
  "opf/variable-reference-unknown": variableReferenceUnknown,
  "opf/contract": contract,
};
