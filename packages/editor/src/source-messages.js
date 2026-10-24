// Problem text for the source pane (artifacts/source-editor/VALIDATOR-HINTS.md): what is wrong, where, and what could come next, written from what core's
// findings already carry (the schema keyword and its parameters, the suggestions, the help). Pure functions, no DOM: `describeFinding(finding, context)`
// returns `{ message, next }`; the quick fix edits that go with a message are in source-fixes.js.

/**
 * `context`: `{ valueAt(segments) }` reads a value of the document being checked (the actual value makes "but is `middle`" possible),
 * `{ schemaAt(segments) }` the resolved schema of a field, `{ catalogKind(segments) }` the catalog kind a field references,
 * `{ catalogCount(kind) }` how many records of a kind are available, `{ keysOf(segments) }` the property names the schema allows in an object.
 */

const WORDS = { object: "an object", array: "a list", string: "text", number: "a number", integer: "a whole number", boolean: "true or false", null: "null" };
const KIND_WORDS = { layouts: "layout", themes: "theme", colorSchemes: "color scheme", fontSchemes: "font scheme", narratives: "narrative", audiences: "audience", purposes: "purpose", tones: "tone", languages: "language" };
const KIND_EXAMPLES = { layouts: "`pillars` or `acme:hero`", themes: "`minimal` or `acme:bold`", colorSchemes: "`boost` or `acme:night`", fontSchemes: "`aptos` or `acme:brand`", narratives: "`classic-story`", audiences: "`board`", purposes: "`inform`", tones: "`formal`" };
const ALIASES = { middle: "center", centre: "center", centered: "center", centred: "center", justify: "left", horizontal: "horizontal", col: "column", cols: "column", pic: "image", picture: "image", photo: "image", paragraph: "text", bullets: "list", bullet: "list" };

/** The segments of a JSON Pointer ("/slides/0/title"); "" is the document. */
export function segmentsOf(path) {
  if (Array.isArray(path)) return path.map(String);
  if (typeof path !== "string" || path === "" || path === "/") return [];
  return path.replace(/^\//, "").split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
}

const code = (value) => `\`${value}\``;
const isIndex = (segment) => /^\d+$/.test(String(segment));

/** What a field is called in a sentence: its name, or "<name> entry" for a list item. */
export function fieldLabel(segments) {
  if (!segments.length) return "the deck";
  const last = segments[segments.length - 1];
  if (isIndex(last)) {
    const owner = [...segments].reverse().find((segment) => !isIndex(segment));
    return owner === "slides" ? `slide ${Number(last) + 1}` : owner ? `${owner} entry ${Number(last) + 1}` : `entry ${Number(last) + 1}`;
  }
  return code(last);
}
/** What an object is called in a sentence ("the deck", "a slide", "`design`"). */
function containerName(segments) {
  if (!segments.length) return "the deck";
  if (segments.length === 2 && segments[0] === "slides" && isIndex(segments[1])) return "a slide";
  const last = segments[segments.length - 1];
  return isIndex(last) ? fieldLabel(segments) : code(last);
}

/** What a value is, with its text: "text (`Hello`)", "a number (`42`)", "a list". */
function describeKind(value) {
  if (typeof value === "string") return value === "" ? "empty text" : `text (${describeValue(value)})`;
  return describeValue(value);
}

function typeWords(type) {
  const list = (Array.isArray(type) ? type : [type]).filter(Boolean).map((entry) => WORDS[entry] ?? String(entry));
  return [...new Set(list)].join(" or ") || "a different kind of value";
}
/** A value in a sentence: "`Hello`", "a number (`42`)", "a list". */
export function describeValue(value) {
  if (value === undefined) return "missing";
  if (value === null) return "null";
  if (Array.isArray(value)) return value.length ? `a list of ${value.length}` : "an empty list";
  if (typeof value === "object") return "an object";
  if (typeof value === "string") return value === "" ? "empty" : `${code(value.length > 30 ? `${value.slice(0, 29)}…` : value)}`;
  return `${typeof value === "number" ? "a number" : "true or false"} (${code(String(value))})`;
}

/** Edit distance between two short strings (Damerau-free; enough for "did you mean"). */
export function distance(a, b) {
  const x = a.toLowerCase(), y = b.toLowerCase();
  if (x === y) return 0;
  const row = Array.from({ length: y.length + 1 }, (_, index) => index);
  for (let i = 1; i <= x.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const keep = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (x[i - 1] === y[j - 1] ? 0 : 1));
      previous = keep;
    }
  }
  return row[y.length];
}
/** The candidates ordered by closeness to `value`; only those within an edit distance of 2 (or a known alias) come first. */
export function nearest(value, candidates, limit = 5) {
  const text = String(value ?? "");
  const alias = ALIASES[text.toLowerCase()];
  const ranked = candidates.map((candidate) => ({ candidate, score: String(candidate).toLowerCase() === alias ? 0 : distance(text, String(candidate)) }));
  ranked.sort((a, b) => a.score - b.score);
  const close = ranked.filter((entry) => entry.score <= Math.max(2, Math.floor(text.length / 4))).map((entry) => entry.candidate);
  return { close: close.slice(0, limit), all: ranked.map((entry) => entry.candidate) };
}

/** Values joined for a sentence: "left, center or right"; above five, the first three and the count. */
function valueList(values, max = 5) {
  const list = values.map((value) => (typeof value === "string" ? value : JSON.stringify(value)));
  if (list.length <= max) return list.length > 1 ? `${list.slice(0, -1).join(", ")} or ${list.at(-1)}` : list.join("");
  return `one of ${list.length} values (${list.slice(0, 3).join(", ")}, …)`;
}

const firstSentence = (text) => /^.*?[.!?](?=\s|$)/.exec(String(text ?? "").replace(/\s+/g, " ").trim())?.[0] ?? "";
const chord = (name) => name;

/** The schema keywords of `opf/schema` findings, written in plain words. */
function describeSchema(finding, segments, context) {
  const { keyword, params = {}, alternatives } = finding.validation ?? {};
  const label = fieldLabel(segments);
  const actual = context.valueAt?.(segments);
  switch (keyword) {
    case "required": {
      const property = params.missingProperty;
      const sample = property === "slides" ? '[ { "title": "…" } ]' : starterText(context.schemaAt?.([...segments, property]), property);
      return { message: `${cap(containerName(segments))} is missing ${code(property)}.`, next: `add "${property}": ${sample}.` };
    }
    case "type": {
      const expected = typeWords(params.type);
      const next = params.type === "array" && typeof actual === "string" ? `write [${JSON.stringify(actual)}].` : params.type === "string" && typeof actual === "number" ? `write ${JSON.stringify(String(actual))}.` : `write ${expected}.`;
      return { message: `${cap(label)} should be ${expected}, but it is ${describeKind(actual)}.`, next };
    }
    case "oneOf":
    case "anyOf": {
      const forms = (alternatives ?? []).map((entry) => String(entry).split(":")[0].trim());
      const words = forms.length ? [...new Set(forms.map((form) => WORDS[form] ?? form))].slice(0, 3).join(" or ") : "a different kind of value";
      return { message: `${cap(label)} should be ${words}, but it is ${describeKind(actual)}.`, next: forms.length ? `write ${words}.` : "check the schema reference for this field." };
    }
    case "enum": {
      const values = params.allowedValues ?? finding.suggestions?.map((entry) => entry.value) ?? [];
      const where = nearest(actual, values);
      const guess = where.close[0];
      const is = actual === undefined ? "" : `, but is ${describeValue(actual)}`;
      return {
        message: `${cap(label)} must be ${valueList(values)}${is}.`,
        next: guess !== undefined ? `did you mean ${code(guess)}?` : values.length > 5 ? `press ${chord("Ctrl+Space")} for the ${values.length} values.` : "choose one of these values.",
      };
    }
    case "const":
      return { message: `${cap(label)} must be exactly ${code(params.allowedValue)}.`, next: `write ${JSON.stringify(params.allowedValue)}.` };
    case "pattern": {
      const kind = context.catalogKind?.(segments);
      if (kind) {
        const word = KIND_WORDS[kind] ?? "catalog";
        const count = context.catalogCount?.(kind);
        const is = actual === "" ? "it is empty" : `it is ${describeValue(actual)}`;
        return { message: `${cap(label)} must be a ${word} id such as ${KIND_EXAMPLES[kind] ?? "`id` or `name:id`"} (lowercase letters, digits and hyphens), but ${is}.`, next: `press ${chord("Ctrl+Space")}${count ? ` for the ${count} ${word}s` : " for the available ids"}, or remove it${kind === "layouts" ? " to let OPF pick" : ""}.` };
      }
      if (/#/.test(params.pattern ?? "") && /0-9a-fA-F/.test(params.pattern ?? "")) return { message: `${cap(label)} must be a hex color like ${code("#1F4E79")} (3, 6 or 8 hex digits), but is ${describeValue(actual)}.`, next: "write the color as #RRGGBB." };
      return { message: `${cap(label)} does not match the expected format${typeof actual === "string" ? `: ${describeValue(actual)}` : ""}.`, next: "check the schema reference for this field." };
    }
    case "additionalProperties": {
      const name = params.additionalProperty ?? segments.at(-1);
      const parent = segments.slice(0, -1);
      const allowed = context.keysOf?.(parent) ?? [];
      const hint = nearest(name, allowed).close[0];
      return {
        message: `${code(name)} is not a property of ${containerName(parent)}.`,
        next: `${hint ? `did you mean ${code(hint)}? ` : ""}To keep custom data, put it under ${code("extensions")}.`.trim(),
      };
    }
    case "minItems":
      return { message: `${cap(label)} needs at least ${params.limit} item${params.limit === 1 ? "" : "s"}.`, next: label === "`slides`" ? "add a slide." : "add an item." };
    case "maxItems":
      return { message: `${cap(label)} can hold at most ${params.limit} items.`, next: "remove the extra ones." };
    case "uniqueItems":
      return { message: `${cap(label)} repeats an entry.`, next: "remove the repeated entry." };
    case "minLength":
      return { message: `${cap(label)} is empty.`, next: "write some text, or remove the key." };
    case "maxLength":
      return { message: `${cap(label)} is longer than ${params.limit} characters.`, next: "shorten it." };
    case "minimum":
    case "exclusiveMinimum":
    case "maximum":
    case "exclusiveMaximum": {
      const bound = /minimum/i.test(keyword) ? "at least" : "at most";
      return { message: `${cap(label)} must be ${keyword.startsWith("exclusive") ? (bound === "at least" ? "greater than" : "less than") : bound} ${params.limit}, but is ${describeValue(actual)}.`, next: `write ${params.limit}${keyword.startsWith("exclusive") ? " or a different number" : ""}.` };
    }
    case "format":
      return { message: `${cap(label)} must be a ${params.format === "uri" ? "web address like https://example.com" : params.format}.`, next: "check the value." };
    default:
      return null;
  }
}

function cap(text) {
  return text[0] === "`" ? text : text.charAt(0).toUpperCase() + text.slice(1);
}
function starterText(schema, property) {
  const example = schema?.examples?.find((value) => typeof value === "string" && !value.includes("..."));
  if (example) return JSON.stringify(example);
  const type = Array.isArray(schema?.type) ? schema.type[0] : schema?.type;
  if (type === "object") return "{ … }";
  if (type === "array") return "[ … ]";
  if (type === "number" || type === "integer") return "0";
  if (type === "boolean") return "false";
  return property === "id" ? '"acme"' : '"…"';
}

/**
 * The message and the hint for a finding. Findings of the schema are written from their keyword and parameters, an unresolved reference from
 * its suggestions, a duplicate key plainly; any other finding keeps core's own sentence and takes its help as the hint.
 * `finding.path` is a JSON Pointer.
 */
export function describeFinding(finding, context = {}) {
  const segments = segmentsOf(finding.path);
  let described = null;
  if (finding.ruleId === "opf/schema" && finding.validation?.keyword) described = describeSchema(finding, segments, context);
  else if (finding.ruleId === "opf/duplicate-key") {
    const key = segments.at(-1);
    described = { message: `${code(key)} appears twice in this object.`, next: "JSON keeps only the last one, so the first value is ignored. Keep one of them." };
  } else if (finding.ruleId === "opf/unresolved-reference" && finding.suggestions?.length) {
    const first = finding.suggestions[0].value;
    described = { message: finding.message, next: `did you mean ${code(first)}?${finding.suggestions.length > 1 ? ` Others: ${finding.suggestions.slice(1, 4).map((entry) => code(entry.value)).join(", ")}.` : ""}` };
  }
  if (described) return described;
  // A problem that brings its own hint (the syntax analyzer's) keeps it whole; core's help is cut to its first sentence.
  if (finding.next) return { message: finding.message, next: finding.next };
  const help = firstSentence(finding.help);
  return { message: finding.message, next: help ? help.charAt(0).toLowerCase() + help.slice(1) : undefined };
}

/** The values a quick fix can change an enum or a reference to: the nearest first, then the rest, at most `limit`. */
export function replacementValues(finding, context = {}, limit = 5) {
  const segments = segmentsOf(finding.path);
  const keyword = finding.validation?.keyword;
  if (keyword === "enum") {
    const values = finding.validation.params?.allowedValues ?? [];
    const { close, all } = nearest(context.valueAt?.(segments), values, limit);
    return [...new Set([...close, ...all])].slice(0, limit);
  }
  if (finding.ruleId === "opf/unresolved-reference" && finding.suggestions?.length) return finding.suggestions.map((entry) => entry.value).slice(0, limit);
  if (keyword === "additionalProperties") {
    const parent = segments.slice(0, -1);
    return nearest(finding.validation.params?.additionalProperty ?? segments.at(-1), context.keysOf?.(parent) ?? [], 3).close;
  }
  return [];
}
